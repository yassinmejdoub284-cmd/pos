const express = require('express');
const { prisma } = require('../lib/prisma');
const { authenticateToken } = require('../middleware/auth');
const { logAudit } = require('../lib/audit');

// Import calculateSessionSummary from sessions route
async function calculateSessionSummary(sessionId) {
  const session = await prisma.sessionCaisse.findUnique({
    where: { id: sessionId },
    include: {
      sales: {
        include: {
          paymentMethod: true
        }
      },
      cashMovements: true
    }
  });

  if (!session) return null;

  // Calculate cash from sales
  const cashSales = session.sales
    .filter(sale => sale.paymentMethod?.type === 'CASH')
    .reduce((sum, sale) => sum + parseFloat(sale.finalTotal), 0);

  // Calculate cash movements
  const entree = session.cashMovements
    .filter(m => m.type === 'ENTREE')
    .reduce((sum, m) => sum + parseFloat(m.amount), 0);

  const sortie = session.cashMovements
    .filter(m => ['SORTIE', 'DEPOT_COFFRE', 'RETRAIT_CENTRALE'].includes(m.type))
    .reduce((sum, m) => sum + parseFloat(m.amount), 0);

  // Start expected cash from opening
  let expectedCash = parseFloat(session.openingFund);

  // Calculate outstanding credit from client debt transactions tied to this session's sales
  let creditOutstanding = 0;
  try {
    const debtTransactions = await prisma.clientDebtTransaction.findMany({
      where: {
        saleId: { in: session.sales.map(s => s.id) },
        type: 'DEBT'
      }
    });
    creditOutstanding = debtTransactions.reduce((sum, t) => sum + parseFloat(t.amount), 0);
  } catch (e) {}

  // Add standalone client payments (credit encashments) to expected cash
  let clientPaymentsTotal = 0;
  try {
    const standalonePayments = await prisma.clientDebtTransaction.findMany({
      where: {
        type: 'PAYMENT',
        saleId: null,
        userId: session.userId,
        createdAt: {
          gte: session.openedAt,
          lte: session.closedAt || new Date()
        }
      }
    });
    clientPaymentsTotal = standalonePayments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
  } catch (e) {}

  expectedCash = expectedCash + clientPaymentsTotal;

  // Compute cash from sales as totalSales - creditOutstanding and add entries then subtract sorties
  const totalSalesAmount = session.sales.reduce((sum, sale) => sum + parseFloat(sale.finalTotal), 0);
  const cashFromSalesNetCredit = Math.max(0, totalSalesAmount - creditOutstanding);
  expectedCash = expectedCash + cashFromSalesNetCredit + entree - sortie;

  return {
    expectedCash,
    cashSales,
    entree,
    sortie,
    totalSales: session.sales.reduce((sum, sale) => sum + parseFloat(sale.finalTotal), 0),
    totalTickets: session.sales.length,
    creditOutstanding,
    clientPaymentsTotal
  };
}

const router = express.Router();

async function generateDocumentNumber(type) {
  const prefix = type === 'BON_EXPEDITION' ? 'BS' : 
                 type === 'BON_ENTREE_DEPOT' ? 'BE' :
                 type === 'BON_TRANSFERT' ? 'BT' :
                 type === 'BON_ENTREE_MAGASIN' ? 'BL' :
                 type === 'FACTURE' ? 'FAC' : 'DOC';
  
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  
  // Get the next sequential number for this document type
  const nextId = await getNextDocumentId(type);
  const sequenceNumber = String(nextId).padStart(4, '0');
  
  return `${prefix}-${year}${month}-${sequenceNumber}`;
}

async function getNextDocumentId(type) {
  try {
    // Get the highest sequence number from existing document numbers of this type
    const prefix = type === 'BON_EXPEDITION' ? 'BS' : 
                   type === 'BON_ENTREE_DEPOT' ? 'BE' :
                   type === 'BON_TRANSFERT' ? 'BT' :
                   type === 'BON_ENTREE_MAGASIN' ? 'BL' :
                   type === 'FACTURE' ? 'FAC' : 'DOC';
    
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const yearMonth = `${year}${month}`;
    
    // Find documents with the same prefix and year-month
    const documents = await prisma.stockDocument.findMany({
      where: {
        numero: {
          startsWith: `${prefix}-${yearMonth}-`
        }
      },
      select: { numero: true }
    });
    
    // Extract sequence numbers and find the highest
    let maxSequence = 0;
    documents.forEach(doc => {
      const parts = doc.numero.split('-');
      if (parts.length === 3) {
        const sequence = parseInt(parts[2]);
        if (!isNaN(sequence) && sequence > maxSequence) {
          maxSequence = sequence;
        }
      }
    });
    
    return maxSequence + 1;
  } catch (error) {
    console.error('Error getting next document ID:', error);
    return 1;
  }
}

function parseQuantity(q) {
  if (typeof q === 'number') return q;
  const s = String(q || '').trim().replace(/,/g, '.');
  const isNeg = s.startsWith('-');
  let cleaned = s.replace(/[^0-9.]/g, '');
  const firstDot = cleaned.indexOf('.');
  if (firstDot !== -1) {
    cleaned = cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, '');
  }
  const result = parseFloat((isNeg ? '-' : '') + cleaned);
  return Number.isFinite(result) ? result : 0;
}



router.get('/', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 20, type, status, depotId, clientId, dateFrom, dateTo, fromDepotOnly, toDepotOnly } = req.query;
    const skip = (page - 1) * limit;
        
    const where = {};
    
    if (type) {
      // Only allow valid DocumentType enum values
      const validTypes = ['BON_EXPEDITION', 'BON_ENTREE_DEPOT', 'BON_TRANSFERT', 'BON_ENTREE_MAGASIN', 'FACTURE'];
      
      if (!validTypes.includes(type)) {
        console.log(`Invalid document type: ${type}. Valid types are: ${validTypes.join(', ')}`);
        return res.status(400).json({ 
          error: `Invalid document type: ${type}. Valid types are: ${validTypes.join(', ')}`,
          validTypes 
        });
      }
      
      where.type = type;
    }
    
    if (status) {
      where.status = status;
    }
    
    if (depotId) {
      const depotIdNum = parseInt(depotId);
      if (String(fromDepotOnly).toLowerCase() === 'true') {
        where.emetteurId = depotIdNum;
      } else if (String(toDepotOnly).toLowerCase() === 'true') {
        where.destinataireId = depotIdNum;
      } else {
        where.OR = [
          { emetteurId: depotIdNum },
          { destinataireId: depotIdNum }
        ];
      }
    }
    if (clientId) {
      where.notes = { contains: `Client:${parseInt(clientId)}` };
    }
    
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }
    
    console.log('Stock documents query:', { where, skip, limit, type, status, depotId, fromDepotOnly, toDepotOnly });
    
    const [documents, total] = await Promise.all([
      prisma.stockDocument.findMany({
        where,
        skip: parseInt(skip),
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          emetteur: { include: { company: true } },
          destinataire: { include: { company: true, clients: true } },
          client: true,
          items: {
            include: {
              product: true
            }
          },
          statusHistory: {
            include: {
              user: true
            },
            orderBy: { createdAt: 'desc' }
          }
        }
      }),
      prisma.stockDocument.count({ where })
    ]);
    
    console.log('Stock documents result:', { documentsCount: documents.length, total });
    
    // Attach client objects for docs that reference a client in notes
    const clientIdMatches = documents
      .map(d => (typeof d.notes === 'string' ? d.notes.match(/Client:(\d+)/) : null))
      .filter(Boolean)
      .map(m => parseInt(m[1]))
      .filter((v, i, a) => a.indexOf(v) === i);

    let clientsById = {};
    if (clientIdMatches.length > 0) {
      const clients = await prisma.client.findMany({ where: { id: { in: clientIdMatches } } });
      clientsById = clients.reduce((acc, c) => { acc[c.id] = c; return acc; }, {});
    }

    const data = documents.map(d => {
      const match = typeof d.notes === 'string' ? d.notes.match(/Client:(\d+)/) : null;
      if (match) {
        const cid = parseInt(match[1]);
        return { ...d, client: clientsById[cid] || null };
      }
      return d;
    });

    res.json({
      data, // match frontend expectation
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching stock documents:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des documents' });
  }
});

router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { depotId } = req.query;
    
    // Enforce depot isolation - use user's depot, visiting depot, or provided depot
    const userDepotId = req.user?.depotId;
    const visitingDepotHeader = req.headers['x-depot-id'];
    const visitingDepotId = visitingDepotHeader ? parseInt(visitingDepotHeader) : null;
    const targetDepotId = depotId ? parseInt(depotId) : (visitingDepotId || userDepotId);
    
    // For non-admin users, check depot access
    if (req.user?.role !== 'ADMIN' && targetDepotId && userDepotId && targetDepotId !== userDepotId) {
      return res.status(403).json({ error: 'Access denied: Cannot access other depot documents' });
    }
    
    const document = await prisma.stockDocument.findFirst({
      where: {
        id: parseInt(req.params.id),
        ...(targetDepotId ? {
          OR: [
            { emetteurId: targetDepotId },
            { destinataireId: targetDepotId }
          ]
        } : (req.user?.role === 'ADMIN' ? {} : {
          OR: [
            { emetteurId: userDepotId },
            { destinataireId: userDepotId }
          ]
        }))
      },
      include: {
      emetteur: { include: { company: true } },
      destinataire: { include: { company: true } },
      client: true,
      vehicle: { include: { brand: true } },
      driver: true,
        items: {
          include: {
            product: true
          }
        },
        statusHistory: {
          include: {
            user: true
          },
          orderBy: { createdAt: 'desc' }
        },
        sourceLinks: {
          include: {
            targetDocument: {
              include: {
                emetteur: true,
                destinataire: true
              }
            }
          }
        },
        targetLinks: {
          include: {
            sourceDocument: {
              include: {
                emetteur: true,
                destinataire: true
              }
            }
          }
        }
      }
    });
    
    if (!document) {
      return res.status(404).json({ error: 'Document non trouvé' });
    }

    // Debug: Log TVA values from database
    console.log('Document items TVA values:');
    if (document.items) {
      document.items.forEach((item, index) => {
        console.log(`Item ${index}: productId=${item.productId}, tva=${item.tva}, type=${typeof item.tva}`);
      });
    }

    // Extract supplier information from notes if present
    let supplierInfo = null;
    if (document.notes && document.notes.includes('Supplier:')) {
      const supplierMatch = document.notes.match(/Supplier:(\d+)/);
      if (supplierMatch) {
        const supplierId = parseInt(supplierMatch[1]);
        try {
          const supplier = await prisma.supplier.findUnique({
            where: { id: supplierId }
          });
          if (supplier) {
            supplierInfo = {
              id: supplier.id,
              name: supplier.name,
              contactName: supplier.contactName,
              email: supplier.email,
              phone: supplier.phone,
              taxNumber: supplier.taxNumber
            };
          }
        } catch (error) {
          console.error('Error fetching supplier:', error);
        }
      }
    }

    // Use client from relation if available, otherwise parse from notes
    console.log('Document client relation:', document.client);
    console.log('Document clientId:', document.clientId);
    console.log('Document notes:', document.notes);
    
    let client = document.client;
    if (!client && document.notes && document.notes.includes('Client:')) {
      const m = document.notes.match(/Client:(\d+)/);
      if (m) {
        const cid = parseInt(m[1]);
        console.log('Parsing client from notes, clientId:', cid);
        try {
          client = await prisma.client.findUnique({ where: { id: cid } });
          console.log('Client found from notes:', client);
        } catch (e) {
          console.error('Error fetching client from notes:', e);
        }
      }
    }

    // Add supplier and client info to the document
    const documentWithSupplier = {
      ...document,
      supplier: supplierInfo,
      client
    };
    
    res.json(documentWithSupplier);
  } catch (error) {
    console.error('Error fetching stock document:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération du document' });
  }
});

// Update document
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    // Check if document exists
    const existingDocument = await prisma.stockDocument.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existingDocument) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Prepare update data
    const dataToUpdate = {};
    
    // Update basic fields
    if (updateData.clientId !== undefined) {
      dataToUpdate.clientId = updateData.clientId ? parseInt(updateData.clientId) : null;
    }
    if (updateData.destination !== undefined) dataToUpdate.destination = updateData.destination;
    if (updateData.validationFromDate !== undefined) {
      dataToUpdate.validationFromDate = updateData.validationFromDate ? new Date(updateData.validationFromDate) : null;
    }
    if (updateData.validationToDate !== undefined) {
      dataToUpdate.validationToDate = updateData.validationToDate ? new Date(updateData.validationToDate) : null;
    }
    if (updateData.notes !== undefined) dataToUpdate.notes = updateData.notes;

    // Update document
    const updatedDocument = await prisma.stockDocument.update({
      where: { id: parseInt(id) },
      data: dataToUpdate,
      include: {
        emetteur: {
          include: {
            company: true
          }
        },
        destinataire: {
          include: {
            company: true
          }
        },
        client: true,
        items: {
          include: {
            product: true
          }
        },
        statusHistory: {
          include: {
            user: true
          },
          orderBy: {
            createdAt: 'desc'
          }
        }
      }
    });

    // Update items if provided
    if (updateData.items && Array.isArray(updateData.items)) {
      // Get original items for stock synchronization
      const originalItems = await prisma.stockDocumentItem.findMany({
        where: { documentId: parseInt(id) }
      });

      // Delete existing items
      await prisma.stockDocumentItem.deleteMany({
        where: { documentId: parseInt(id) }
      });

      // Create new items
      for (const item of updateData.items) {
        await prisma.stockDocumentItem.create({
          data: {
            documentId: parseInt(id),
            productId: item.productId,
            famille: typeof item.famille === 'object' ? item.famille.name : item.famille,
            quantity: parseFloat(item.quantity),
            count: parseInt(item.count) || 1,
            colisCount: parseInt(item.colisCount) || 1,
            notes: item.notes || '',
            purchasePrice: item.purchasePrice !== undefined ? parseFloat(item.purchasePrice) : null,
            batch: item.batch || null,
            barcode: item.barcode || null,
            prixUnitaire: item.prixUnitaire !== undefined ? parseFloat(item.prixUnitaire) : null,
            tva: item.tva !== undefined ? parseFloat(item.tva) : null,
            montantHT: item.montantHT !== undefined ? parseFloat(item.montantHT) : null,
            montantTVA: item.montantTVA !== undefined ? parseFloat(item.montantTVA) : null,
            montantTTC: item.montantTTC !== undefined ? parseFloat(item.montantTTC) : null,
            parentProductId: item.parentProductId || null,
            childProductName: item.childProductName || null,
            childProductId: item.childProductId || null
          }
        });
      }

      // Handle stock synchronization
      await synchronizeStockForDocumentUpdate(existingDocument, originalItems, updateData.items, req.user.id);

      // Fetch updated document with items
      const finalDocument = await prisma.stockDocument.findUnique({
        where: { id: parseInt(id) },
        include: {
          emetteur: {
            include: {
              company: true
            }
          },
          destinataire: {
            include: {
              company: true
            }
          },
          items: {
            include: {
              product: true
            }
          },
          statusHistory: {
            include: {
              user: true
            },
            orderBy: {
              createdAt: 'desc'
            }
          }
        }
      });

      return res.json(finalDocument);
    }

    // Log audit
    await logAudit(req.user.id, 'stock_documents', parseInt(id), 'UPDATE', existingDocument, updatedDocument);

    res.json(updatedDocument);
  } catch (error) {
    console.error('Error updating document:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/expedition', authenticateToken, async (req, res) => {
  try {
    const { emetteurId, destinataireId, items, notes } = req.body;
    
    console.log('Received expedition request:', { emetteurId, destinataireId, items, notes });
    
    if (!emetteurId || !destinataireId || !items || items.length === 0) {
      console.log('Validation failed:', { emetteurId, destinataireId, itemsLength: items?.length });
      return res.status(400).json({ error: 'Données manquantes' });
    }
    
    const numero = await generateDocumentNumber('BON_EXPEDITION');
    

    const document = await prisma.$transaction(async (tx) => {
      // Create the document
      const doc = await tx.stockDocument.create({
        data: {
          numero,
          type: 'BON_EXPEDITION',
          status: 'PREPARED',
          emetteurId: parseInt(emetteurId),
          destinataireId: parseInt(destinataireId),
          notes,
          items: {
            create: items.map(item => ({
              productId: item.productId,
              famille: typeof item.famille === 'object' ? item.famille.name : item.famille,
              quantity: parseFloat(item.quantity),
              batch: item.batch || null,
              notes: typeof item.famille === 'object' ? item.famille.name : (item.notes || null),
              barcode: null
            }))
          },
          statusHistory: {
            create: {
              status: 'PREPARED',
              userId: 1, // Default user for development
              notes: 'Document créé'
            }
          }
        },
        include: {
          emetteur: true,
          destinataire: true,
          client: true,
          items: {
            include: {
              product: true
            }
          }
        }
      });

      // Update inventory and create stock movements
      for (const item of items) {
        const productId = item.productId;
        const quantity = parseFloat(item.quantity);
        const emetteurIdInt = parseInt(emetteurId);

        // Check if MAIN depot has enough stock
        const inventory = await tx.inventory.findUnique({
          where: {
            depotId_productId: {
              depotId: emetteurIdInt,
              productId: productId
            }
          }
        });

        // Stock validation removed - frontend handles warnings, backend allows all operations

        // Reduce stock from MAIN depot or create inventory record if it doesn't exist
        if (inventory) {
          const currentQuantity = parseFloat(inventory.quantity) || 0;
          const reduceQuantity = parseFloat(quantity) || 0;
          const newQuantity = currentQuantity - reduceQuantity;
          
          await tx.inventory.update({
            where: { id: inventory.id },
            data: {
              quantity: newQuantity
            }
          });
        } else {
          // Create inventory record with negative quantity
          const negativeQuantity = -(parseFloat(quantity) || 0);
          await tx.inventory.create({
            data: {
              depotId: emetteurIdInt,
              productId: productId,
              quantity: negativeQuantity
            }
          });
        }

        // Create stock movement record
        await tx.stockMovement.create({
          data: {
            productId: productId,
            depotId: emetteurIdInt,
            quantity: -quantity, // Negative for outgoing
            type: 'OUT',
            fromDepotId: emetteurIdInt,
            toDepotId: parseInt(destinataireId),
            reason: 'EXPEDITION',
            reference: numero,
            userId: 1
          }
        });
      }

      return doc;
    });
    
    await logAudit(req.user.id, 'stock_documents', document.id, 'CREATE', null, document);
    
    res.status(201).json(document);
  } catch (error) {
    console.error('Error creating expedition document:', error);
    res.status(500).json({ error: 'Erreur lors de la création du document' });
  }
});

// Create supplier entry (Bon d'entrée)
router.post('/entry', authenticateToken, async (req, res) => {
  try {
    const { depotId, supplierId, items, notes, payCash, isReturn } = req.body;

    if (!depotId || !items || items.length === 0) {
      return res.status(400).json({ error: 'Données manquantes' });
    }

    // Check if depot is a shop and validate cash availability
    const depot = await prisma.depot.findUnique({
      where: { id: parseInt(depotId) }
    });

    if (!depot) {
      return res.status(400).json({ error: 'Dépôt introuvable' });
    }

    // If depot is a shop, check if session exists (but don't validate cash availability)
    if (depot.type === 'SHOP') {
      const activeSession = await prisma.sessionCaisse.findFirst({
        where: { 
          userId: req.user.id, 
          status: 'OPEN',
          depotId: parseInt(depotId)
        }
      });

      if (!activeSession) {
        return res.status(400).json({ 
          error: 'Session de caisse requise pour créer un bon d\'entrée dans un magasin' 
        });
      }

      // Note: We don't validate cash availability here because:
      // 1. The payment can be made via credit/deferred payment
      // 2. The payment is handled separately via the payment dialog
      // 3. The purchase price entered may be different from the product's selling price
    }

    // Use valid DocumentType enum values only
    const numberType = isReturn ? 'BON_EXPEDITION' : 'BON_ENTREE_DEPOT';
    const numero = await generateDocumentNumber(numberType);

    // If paying cash, we must have an open caisse session
    let activeSession = null;
    if (payCash) {
      activeSession = await prisma.sessionCaisse.findFirst({
        where: { userId: req.user.id, status: 'OPEN' }
      });
      if (!activeSession) {
        return res.status(400).json({ error: 'Aucune session de caisse ouverte pour effectuer le paiement en espèces' });
      }
    }

    const document = await prisma.$transaction(async (tx) => {
      // Create the document as received directly (supplier -> depot)
      const doc = await tx.stockDocument.create({
        data: {
          numero,
          type: isReturn ? 'BON_EXPEDITION' : 'BON_ENTREE_DEPOT',
          status: 'RECEIVED',
          // Schema requires depots; we set both to the receiving depot
          emetteurId: parseInt(depotId),
          destinataireId: parseInt(depotId),
          notes: supplierId ? `Supplier:${supplierId}${notes ? ' | ' + notes : ''}` : (notes || null),
          items: {
            create: items.map((item) => ({
              productId: item.productId,
              famille: typeof item.famille === 'object' ? item.famille.name : item.famille,
              quantity: parseQuantity(item.quantity),
              purchasePrice: item.purchasePrice ? parseFloat(item.purchasePrice) : null,
              batch: item.batch || null,
              notes: typeof item.famille === 'object' ? item.famille.name : (item.notes || null),
              barcode: null
            }))
          },
          statusHistory: {
            create: {
              status: 'RECEIVED',
              userId: req.user.id,
              notes: isReturn ? 'Bon de retour fournisseur' : 'Bon d\'entrée fournisseur'
            }
          }
        },
        include: {
          emetteur: true,
          destinataire: true,
          items: { include: { product: true } }
        }
      });

      // Adjust inventory and create movement (IN for entries, OUT for returns)
      for (const item of items) {
        const productId = parseInt(item.productId);
        const quantity = parseQuantity(item.quantity);
        const depotIdInt = parseInt(depotId);

        const inventory = await tx.inventory.findUnique({
          where: { depotId_productId: { depotId: depotIdInt, productId } }
        });

        if (inventory) {
          const currentQuantity = parseFloat(inventory.quantity);
          const newQuantity = isReturn ? (currentQuantity - Math.abs(quantity)) : (currentQuantity + quantity);
          
          // For returns, ensure we don't go below zero
          if (isReturn && newQuantity < 0) {
            throw new Error(`Cannot return ${Math.abs(quantity)} units of product ${productId}: only ${currentQuantity} units available`);
          }
          
          await tx.inventory.update({
            where: { id: inventory.id },
            data: { quantity: newQuantity }
          });
        } else {
          // For returns, if no inventory exists, we can't return items
          if (isReturn) {
            throw new Error(`Cannot return product ${productId}: no inventory found`);
          }
          await tx.inventory.create({
            data: { depotId: depotIdInt, productId, quantity }
          });
        }

        await tx.stockMovement.create({
          data: {
            productId,
            depotId: depotIdInt,
            quantity,
            type: isReturn ? 'OUT' : 'IN',
            fromDepotId: isReturn ? depotIdInt : null,
            toDepotId: isReturn ? null : depotIdInt,
            reason: isReturn ? 'RETURN_SUPPLIER' : 'ENTRY_SUPPLIER',
            reference: numero,
            userId: req.user.id
          }
        });
      }

      // If paid cash, record a cash movement sortie for total purchase amount
      if (payCash) {
        // Compute total purchase amount from items
        const totalPurchase = items.reduce((sum, it) => {
          const qty = parseFloat(it.quantity || 0);
          const price = it.purchasePrice !== undefined && it.purchasePrice !== null ? parseFloat(it.purchasePrice) : 0;
          return sum + qty * price;
        }, 0);

        // Only create movement if amount > 0
        if (totalPurchase > 0) {
          await tx.cashMovement.create({
            data: {
              sessionId: activeSession.id,
              type: 'SORTIE',
              amount: totalPurchase,
              reason: `Achat fournisseur ${numero}${supplierId ? ` (FOURN:${supplierId})` : ''}`,
              ticketId: null,
              createdById: req.user.id
            }
          });
        }
      }

      return doc;
    });

    await logAudit(req.user.id, 'stock_documents', document.id, 'CREATE', null, document);

    res.status(201).json(document);
  } catch (error) {
    console.error('Error creating supplier entry:', error);
    res.status(500).json({ error: 'Erreur lors de la création du bon d\'entrée' });
  }
});

router.post('/prepare-lot', authenticateToken, async (req, res) => {
  try {
    const { emetteurId, destinataireId, items, notes } = req.body;
    
    if (!emetteurId || !destinataireId || !items || items.length === 0) {
      return res.status(400).json({ error: 'Données manquantes' });
    }
    
    const numero = await generateDocumentNumber('BON_EXPEDITION');
    
    const document = await prisma.stockDocument.create({
      data: {
        numero,
        type: 'BON_EXPEDITION',
        status: 'PREPARED',
        emetteurId: parseInt(emetteurId),
        destinataireId: parseInt(destinataireId),
        notes,
        items: {
          create: items.map(item => ({
            productId: item.productId,
            famille: typeof item.famille === 'object' ? item.famille.name : item.famille,
            quantity: parseFloat(item.quantity),
            batch: item.batch || null,
            notes: typeof item.famille === 'object' ? item.famille.name : (item.notes || null),
            barcode: null
          }))
        },
        statusHistory: {
          create: {
            status: 'PREPARED',
            userId: req.user.id,
            notes: 'Lot préparé'
          }
        }
      },
      include: {
        emetteur: true,
        destinataire: true,
        items: {
          include: {
            product: true
          }
        }
      }
    });
    
    await logAudit(req.user.id, 'stock_documents', document.id, 'CREATE', null, document);
    
    res.status(201).json(document);
  } catch (error) {
    console.error('Error preparing lot:', error);
    res.status(500).json({ error: 'Erreur lors de la préparation du lot' });
  }
});

router.post('/:id/validate', authenticateToken, async (req, res) => {
  try {
    const documentId = parseInt(req.params.id);
    const { status, notes } = req.body;
    
    const document = await prisma.stockDocument.findUnique({
      where: { id: documentId },
      include: {
        items: true,
        emetteur: true,
        destinataire: true
      }
    });
    
    if (!document) {
      return res.status(404).json({ error: 'Document non trouvé' });
    }
    
    if (document.status === 'CANCELLED') {
      return res.status(400).json({ error: 'Document annulé, impossible de modifier' });
    }
    
    const oldStatus = document.status;
    
    const updatedDocument = await prisma.stockDocument.update({
      where: { id: documentId },
      data: {
        status,
        statusHistory: {
          create: {
            status,
            userId: req.user.id,
            notes: notes || `Status changé de ${oldStatus} à ${status}`
          }
        }
      },
      include: {
        emetteur: true,
        destinataire: true,
        items: {
          include: {
            product: true
          }
        }
      }
    });
    
    await logAudit(req.user.id, 'stock_documents', documentId, 'UPDATE', { status: oldStatus }, { status });
    
    res.json(updatedDocument);
  } catch (error) {
    console.error('Error updating document status:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour du statut' });
  }
});

router.post('/scan', authenticateToken, async (req, res) => {
  try {
    const { barcode, depotId, documentType } = req.body;
    
    if (!barcode || !depotId) {
      return res.status(400).json({ error: 'Code-barres et dépôt requis' });
    }
    
    // If documentType is provided, create a new document with auto-incrementing ID
    if (documentType) {
      const nextId = await getNextDocumentId(documentType);
      const numero = await generateDocumentNumber(documentType);
      
      // Create a new document for the scan
      const newDocument = await prisma.stockDocument.create({
        data: {
          id: nextId,
          numero,
          type: documentType,
          status: 'PREPARED',
          emetteurId: parseInt(depotId),
          destinataireId: parseInt(depotId),
          notes: `Document créé par scan - ${barcode}`,
          items: {
            create: [{
              productId: 1, // Default product, will be updated based on barcode lookup
              famille: 'SCAN',
              quantity: 1,
              batch: null,
              notes: `Scanné: ${barcode}`,
              barcode: barcode
            }]
          },
          statusHistory: {
            create: {
              status: 'PREPARED',
              userId: req.user.id,
              notes: 'Document créé par scan'
            }
          }
        },
        include: {
          emetteur: true,
          destinataire: true,
          client: true,
          items: {
            include: {
              product: true
            }
          }
        }
      });
      
      return res.json({
        document: newDocument,
        item: newDocument.items[0],
        canReceive: true,
        isNewDocument: true
      });
    }
    
    // Original scan logic for existing documents
    const item = await prisma.stockDocumentItem.findUnique({
      where: { barcode },
      include: {
        document: {
          include: {
            emetteur: true,
            destinataire: true,
            items: {
              include: {
                product: true
              }
            }
          }
        },
        product: true
      }
    });
    
    if (!item) {
      return res.status(404).json({ error: 'Code-barres non trouvé' });
    }
    
    const document = item.document;
    
    if (document.status === 'CANCELLED') {
      return res.status(400).json({ error: 'Document annulé' });
    }
    
    if (document.destinataireId !== parseInt(depotId)) {
      return res.status(400).json({ 
        error: `Document destiné à ${document.destinataire.name}, pas à ce dépôt` 
      });
    }
    
    if (document.status === 'PREPARED') {
      return res.status(400).json({ error: 'Document non encore envoyé' });
    }
    
    if (document.status === 'RECEIVED') {
      return res.status(400).json({ error: 'Document déjà reçu' });
    }
    
    res.json({
      document,
      item,
      canReceive: document.status === 'SENT',
      isNewDocument: false
    });
  } catch (error) {
    console.error('Error scanning barcode:', error);
    res.status(500).json({ error: 'Erreur lors du scan' });
  }
});

router.post('/scan-transfer', authenticateToken, async (req, res) => {
  try {
    const { fromDepotId, toDepotId, barcode } = req.body;
    
    if (!fromDepotId || !toDepotId || !barcode) {
      return res.status(400).json({ error: 'Données manquantes' });
    }
    
    const item = await prisma.stockDocumentItem.findUnique({
      where: { barcode },
      include: {
        document: {
          include: {
            emetteur: true,
            destinataire: true,
            items: {
              include: {
                product: true
              }
            }
          }
        },
        product: true
      }
    });
    
    if (!item) {
      return res.status(404).json({ error: 'Code-barres non trouvé' });
    }
    
    const document = item.document;
    
    if (document.status === 'CANCELLED') {
      return res.status(400).json({ error: 'Document annulé' });
    }
    
    if (document.destinataireId !== parseInt(toDepotId)) {
      return res.status(400).json({ 
        error: `Document destiné à ${document.destinataire.name}, pas à ce dépôt` 
      });
    }
    
    if (document.status !== 'SENT') {
      return res.status(400).json({ error: 'Document non encore envoyé' });
    }
    
    if (document.status === 'RECEIVED') {
      return res.status(400).json({ error: 'Document déjà reçu' });
    }
    
    const fromInventory = await prisma.inventory.findUnique({
      where: {
        depotId_productId: {
          depotId: parseInt(fromDepotId),
          productId: item.productId
        }
      }
    });
    
    // Stock validation removed - frontend handles warnings, backend allows all operations
    
    res.json({
      document,
      item,
      canTransfer: true,
      availableStock: fromInventory.quantity
    });
  } catch (error) {
    console.error('Error scanning transfer barcode:', error);
    res.status(500).json({ error: 'Erreur lors du scan' });
  }
});

// Get inventory for a depot
router.get('/inventory/:depotId', authenticateToken, async (req, res) => {
  try {
    const depotId = parseInt(req.params.depotId);
    
    const inventory = await prisma.inventory.findMany({
      where: { depotId },
      include: {
        product: true
      }
    });
    
    res.json(inventory);
  } catch (error) {
    console.error('Error fetching inventory:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération de l\'inventaire' });
  }
});

// Create transfer from BRANCH to SHOP
router.post('/transfer', authenticateToken, async (req, res) => {
  try {
    const { emetteurId, destinataireId, items, notes } = req.body;
    
    console.log('Received transfer request:', { emetteurId, destinataireId, items, notes });
    
    if (!emetteurId || !destinataireId || !items || items.length === 0) {
      console.log('Validation failed:', { emetteurId, destinataireId, itemsLength: items?.length });
      return res.status(400).json({ error: 'Données manquantes' });
    }
    
    const numero = await generateDocumentNumber('BON_TRANSFERT');
    
    const document = await prisma.$transaction(async (tx) => {
      // Create the document
      const doc = await tx.stockDocument.create({
        data: {
          numero,
          type: 'BON_TRANSFERT',
          status: 'PREPARED',
          emetteurId: parseInt(emetteurId),
          destinataireId: parseInt(destinataireId),
          notes,
          items: {
            create: items.map(item => ({
              productId: item.productId,
              famille: typeof item.famille === 'object' ? item.famille.name : item.famille,
              quantity: parseFloat(item.quantity),
              batch: null,
              notes: typeof item.famille === 'object' ? item.famille.name : null,
              barcode: null
            }))
          },
          statusHistory: {
            create: {
              status: 'PREPARED',
              userId: 1, // Default user for development
              notes: 'Transfert créé'
            }
          }
        },
        include: {
          emetteur: true,
          destinataire: true,
          client: true,
          items: {
            include: {
              product: true
            }
          }
        }
      });

      // Update inventory and create stock movements
      for (const item of items) {
        const productId = item.productId;
        const quantity = parseFloat(item.quantity);
        const emetteurIdInt = parseInt(emetteurId);

        // Check if BRANCH depot has enough stock
        const inventory = await tx.inventory.findUnique({
          where: {
            depotId_productId: {
              depotId: emetteurIdInt,
              productId: productId
            }
          }
        });

        // Stock validation removed - frontend handles warnings, backend allows all operations

        // Reduce stock from BRANCH depot or create inventory record if it doesn't exist
        if (inventory) {
          const currentQuantity = parseFloat(inventory.quantity) || 0;
          const reduceQuantity = parseFloat(quantity) || 0;
          const newQuantity = currentQuantity - reduceQuantity;
          
          await tx.inventory.update({
            where: { id: inventory.id },
            data: {
              quantity: newQuantity
            }
          });
        } else {
          // Create inventory record with negative quantity
          const negativeQuantity = -(parseFloat(quantity) || 0);
          await tx.inventory.create({
            data: {
              depotId: emetteurIdInt,
              productId: productId,
              quantity: negativeQuantity
            }
          });
        }

        // Create stock movement record
        await tx.stockMovement.create({
          data: {
            productId: productId,
            depotId: emetteurIdInt,
            quantity: -quantity, // Negative for outgoing
            type: 'OUT',
            fromDepotId: emetteurIdInt,
            toDepotId: parseInt(destinataireId),
            reason: 'TRANSFERT',
            reference: numero,
            userId: 1
          }
        });
      }

      return doc;
    });
    
    await logAudit(1, 'stock_documents', document.id, 'CREATE', null, document);
    
    res.status(201).json(document);
  } catch (error) {
    console.error('Error creating transfer document:', error);
    res.status(500).json({ error: 'Erreur lors de la création du transfert' });
  }
});

router.post('/:id/receive', authenticateToken, async (req, res) => {
  try {
    const documentId = parseInt(req.params.id);
    const { depotId } = req.body;
    
    console.log('Receive document request:', { documentId, depotId, userId: req.user.id });
    
    const document = await prisma.stockDocument.findUnique({
      where: { id: documentId },
      include: {
        items: {
          include: {
            product: true
          }
        },
        emetteur: true,
        destinataire: true
      }
    });
    
    if (!document) {
      console.log('Document not found:', documentId);
      return res.status(404).json({ error: 'Document non trouvé' });
    }
    
    console.log('Document found:', { 
      id: document.id, 
      status: document.status, 
      destinataireId: document.destinataireId, 
      requestedDepotId: parseInt(depotId),
      emetteurType: document.emetteur?.type,
      itemsCount: document.items?.length 
    });
    
    if (document.destinataireId !== parseInt(depotId)) {
      console.log('Wrong destination depot:', { expected: document.destinataireId, received: parseInt(depotId) });
      return res.status(400).json({ error: 'Mauvais dépôt de destination' });
    }
    
    if (document.status !== 'PREPARED' && document.status !== 'SENT') {
      console.log('Document not ready for reception:', { status: document.status });
      return res.status(400).json({ error: 'Document non prêt pour réception' });
    }
    
    await prisma.$transaction(async (tx) => {
      console.log('Starting stock addition transaction for', document.items.length, 'items');
      
      for (const item of document.items) {
        console.log('Processing item:', { productId: item.productId, quantity: item.quantity });
        
        // Check if the product exists with this ID
        let product = await tx.product.findUnique({
          where: { id: item.productId }
        });
        console.log('Product found by ID:', product ? { id: product.id, name: product.name } : 'NOT FOUND');
        
        // If product not found by ID, try to find by name (famille or notes)
        if (!product && (item.famille || item.notes)) {
          const searchTerm = item.famille || item.notes;
          console.log('Searching for product by name:', searchTerm);
          
          // Try exact match first
          product = await tx.product.findFirst({
            where: {
              name: {
                equals: searchTerm,
                mode: 'insensitive'
              }
            }
          });
          
          // If no exact match, try contains
          if (!product) {
            product = await tx.product.findFirst({
              where: {
                name: {
                  contains: searchTerm,
                  mode: 'insensitive'
                }
              }
            });
          }
          
          console.log('Product found by name:', product ? { id: product.id, name: product.name } : 'NOT FOUND');
          
          // If we found the correct product, update the item's productId
          if (product) {
            await tx.stockDocumentItem.update({
              where: { id: item.id },
              data: { productId: product.id }
            });
            console.log('Updated item productId from', item.productId, 'to', product.id);
            item.productId = product.id; // Update for inventory operations
          }
        }
        
        const inventory = await tx.inventory.findUnique({
          where: {
            depotId_productId: {
              depotId: parseInt(depotId),
              productId: item.productId
            }
          }
        });
        
        if (inventory) {
          const currentQuantity = parseFloat(inventory.quantity) || 0;
          const addingQuantity = parseFloat(item.quantity) || 0;
          const newQuantity = currentQuantity + addingQuantity;
          
          console.log('Updating existing inventory:', { 
            currentQuantity: currentQuantity, 
            adding: addingQuantity, 
            newQuantity: newQuantity 
          });
          await tx.inventory.update({
            where: { id: inventory.id },
            data: {
              quantity: newQuantity
            }
          });
        } else {
          const newQuantity = parseFloat(item.quantity) || 0;
          console.log('Creating new inventory entry:', { 
            depotId: parseInt(depotId), 
            productId: item.productId, 
            quantity: newQuantity 
          });
          await tx.inventory.create({
            data: {
              depotId: parseInt(depotId),
              productId: item.productId,
              quantity: newQuantity
            }
          });
        }

        // Create stock movement record
        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            depotId: parseInt(depotId),
            quantity: item.quantity, // Positive for incoming
            type: 'IN',
            fromDepotId: document.emetteurId,
            toDepotId: parseInt(depotId),
            reason: document.type === 'BON_EXPEDITION' ? 'RECEPTION_EXPEDITION' : 'RECEPTION_TRANSFERT',
            reference: document.numero,
            userId: 1
          }
        });
      }
      
      await tx.stockDocument.update({
        where: { id: documentId },
        data: {
          status: 'RECEIVED',
          statusHistory: {
            create: {
              status: 'RECEIVED',
              userId: req.user.id,
              notes: 'Document reçu'
            }
          }
        }
      });
    });
    
    const updatedDocument = await prisma.stockDocument.findUnique({
      where: { id: documentId },
      include: {
        emetteur: true,
        destinataire: true,
        items: {
          include: {
            product: true
          }
        }
      }
    });
    
    await logAudit(req.user.id, 'stock_documents', documentId, 'UPDATE', { status: document.status }, { status: 'RECEIVED' });
    
    res.json(updatedDocument);
  } catch (error) {
    console.error('Error receiving document:', error);
    res.status(500).json({ error: 'Erreur lors de la réception' });
  }
});

// Approve receipt - similar to receive but for delivery documents
router.post('/:id/approve-receipt', authenticateToken, async (req, res) => {
  try {
    console.log('🚀 APPROVE RECEIPT ENDPOINT CALLED');
    const documentId = parseInt(req.params.id);
    const { depotId } = req.body;
    
    console.log('Approve receipt request:', { documentId, depotId, userId: req.user.id });
    
    const document = await prisma.stockDocument.findUnique({
      where: { id: documentId },
      include: {
        items: {
          include: {
            product: true
          }
        },
        emetteur: true,
        destinataire: true
      }
    });
    
    if (!document) {
      console.log('Document not found:', documentId);
      return res.status(404).json({ error: 'Document non trouvé' });
    }
    
    console.log('Document found:', { 
      id: document.id, 
      status: document.status, 
      type: document.type,
      destinataireId: document.destinataireId,
      itemsCount: document.items?.length 
    });
    
    if (document.status !== 'SENT') {
      console.log('Document not ready for approval:', { status: document.status });
      return res.status(400).json({ error: 'Document non prêt pour approbation' });
    }
    
    // Allow all document types to be approved for receipt
    // Previously only BON_ENTREE_MAGASIN and FACTURE were allowed
    console.log('Document type approved for receipt:', { type: document.type });
    
    await prisma.$transaction(async (tx) => {
      console.log('Starting stock addition transaction for', document.items.length, 'items');
      
      // Group items by parent product to consolidate quantities
      const groupedItems = new Map();
      
      for (const item of document.items) {
        console.log('Processing item - full object:', JSON.stringify(item, null, 2));
        console.log('Processing item:', { 
          productId: item.productId, 
          parentProductId: item.parentProductId,
          famille: item.famille,
          quantity: item.quantity 
        });
        
        // Use parentProductId if available, otherwise try to find parent by famille
        let parentProduct = null;
        let targetProductId = item.productId;
        
        if (item.parentProductId) {
          console.log('✅ Using parentProductId from document item:', item.parentProductId);
          targetProductId = item.parentProductId;
          parentProduct = await tx.product.findUnique({
            where: { id: item.parentProductId }
          });
          console.log('✅ Found parent product by parentProductId:', parentProduct ? { id: parentProduct.id, name: parentProduct.name } : 'NOT FOUND');
        } else if (item.famille) {
          console.log('Searching for parent product by famille:', item.famille);
          
          // Try exact match first
          parentProduct = await tx.product.findFirst({
            where: {
              name: item.famille
            }
          });
          
          // If no exact match, try contains
          if (!parentProduct) {
            parentProduct = await tx.product.findFirst({
              where: {
                name: {
                  contains: item.famille
                }
              }
            });
          }
          
          if (parentProduct) {
            console.log('Found parent product by famille:', { id: parentProduct.id, name: parentProduct.name });
            targetProductId = parentProduct.id;
          } else {
            console.log('No parent product found for famille:', item.famille, 'using original productId:', item.productId);
          }
        }
        
        // If no parent found, use the original product
        if (!parentProduct) {
          parentProduct = await tx.product.findUnique({
            where: { id: item.productId }
          });
          console.log('Using original product:', parentProduct ? { id: parentProduct.id, name: parentProduct.name } : 'NOT FOUND');
        }
        
        // Group by target product ID and sum quantities
        const quantity = parseFloat(item.quantity) || 0;
        console.log('🎯 Final targetProductId:', targetProductId, 'quantity:', quantity);
        if (groupedItems.has(targetProductId)) {
          groupedItems.get(targetProductId).quantity += quantity;
          console.log('📊 Added to existing group, new total:', groupedItems.get(targetProductId).quantity);
        } else {
          groupedItems.set(targetProductId, {
            productId: targetProductId,
            quantity: quantity,
            parentProduct: parentProduct
          });
          console.log('🆕 Created new group for productId:', targetProductId);
        }
      }
      
      // Process grouped items
      for (const [productId, groupedItem] of groupedItems) {
        console.log('Processing grouped item:', { productId, quantity: groupedItem.quantity });
        
        const inventory = await tx.inventory.findUnique({
          where: {
            depotId_productId: {
              depotId: parseInt(depotId),
              productId: productId
            }
          }
        });
        
        if (inventory) {
          const currentQuantity = parseFloat(inventory.quantity) || 0;
          const addingQuantity = groupedItem.quantity;
          const newQuantity = currentQuantity + addingQuantity;
          
          console.log('Updating existing inventory:', { 
            currentQuantity: currentQuantity, 
            adding: addingQuantity, 
            newQuantity: newQuantity 
          });
          await tx.inventory.update({
            where: { id: inventory.id },
            data: {
              quantity: newQuantity
            }
          });
        } else {
          console.log('Creating new inventory entry:', { 
            depotId: parseInt(depotId), 
            productId: productId, 
            quantity: groupedItem.quantity 
          });
          await tx.inventory.create({
            data: {
              depotId: parseInt(depotId),
              productId: productId,
              quantity: groupedItem.quantity
            }
          });
        }

        // Create stock movement record
        await tx.stockMovement.create({
          data: {
            productId: productId,
            depotId: parseInt(depotId),
            quantity: groupedItem.quantity, // Positive for incoming
            type: 'IN',
            fromDepotId: document.emetteurId,
            toDepotId: parseInt(depotId),
            reason: 'RECEPTION_LIVRAISON',
            reference: document.numero,
            userId: req.user.id
          }
        });
      }
      
      await tx.stockDocument.update({
        where: { id: documentId },
        data: {
          status: 'RECEIVED',
          statusHistory: {
            create: {
              status: 'RECEIVED',
              userId: req.user.id,
              notes: 'Reçu approuvé - produits ajoutés au stock'
            }
          }
        }
      });
    });
    
    const updatedDocument = await prisma.stockDocument.findUnique({
      where: { id: documentId },
      include: {
        emetteur: true,
        destinataire: true,
        items: {
          include: {
            product: true
          }
        }
      }
    });
    
    await logAudit(req.user.id, 'stock_documents', documentId, 'UPDATE', { status: document.status }, { status: 'RECEIVED' });
    
    res.json(updatedDocument);
  } catch (error) {
    console.error('Error approving receipt:', error);
    res.status(500).json({ error: 'Erreur lors de l\'approbation du reçu' });
  }
});


router.get('/:id/print-labels', authenticateToken, async (req, res) => {
  try {
    const documentId = parseInt(req.params.id);
    
    const document = await prisma.stockDocument.findUnique({
      where: { id: documentId },
      include: {
        items: {
          include: {
            product: true
          }
        },
        emetteur: true,
        destinataire: true,
        client: true
      }
    });
    
    if (!document) {
      return res.status(404).json({ error: 'Document non trouvé' });
    }
    
    const labels = document.items.map(item => ({
      barcode: item.barcode,
      productName: item.product.name,
      famille: item.famille,
      quantity: item.quantity,
      batch: item.batch,
      documentNumber: document.numero,
      emetteur: document.emetteur.name,
      destinataire: document.destinataire.name
    }));
    
    res.json({ labels, document });
  } catch (error) {
    console.error('Error generating labels:', error);
    res.status(500).json({ error: 'Erreur lors de la génération des étiquettes' });
  }
});

router.get('/:id/export-pdf', authenticateToken, async (req, res) => {
  try {
    const documentId = parseInt(req.params.id);
    
    const document = await prisma.stockDocument.findUnique({
      where: { id: documentId },
      include: {
        items: {
          include: {
            product: true
          }
        },
        emetteur: true,
        destinataire: true,
        client: true,
        statusHistory: {
          include: {
            user: true
          },
          orderBy: { createdAt: 'asc' }
        }
      }
    });
    
    if (!document) {
      return res.status(404).json({ error: 'Document non trouvé' });
    }
    
    const pdfData = {
      document,
      qrCode: document.numero,
      signatureZone: 'Signature du responsable'
    };
    
    res.json(pdfData);
  } catch (error) {
    console.error('Error exporting PDF:', error);
    res.status(500).json({ error: 'Erreur lors de l\'export PDF' });
  }
});

// Get next document number for a specific type
router.get('/next-number/:type', authenticateToken, async (req, res) => {
  try {
    const { type } = req.params;
    const numero = await generateDocumentNumber(type);
    res.json(numero);
  } catch (error) {
    console.error('Error generating next document number:', error);
    res.status(500).json({ error: 'Erreur lors de la génération du numéro' });
  }
});

// General document creation endpoint
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { 
      type, 
      numero, 
      depotId, 
      fromDepotId, 
      destinationDepotId,
      clientId,
      vehicleId,
      driverId,
      destination,
      validationFromDate,
      validationToDate,
      totalHT,
      totalTVA,
      totalTTC,
      status,
      items,
      notes 
    } = req.body;

    if (!type || !items || items.length === 0) {
      return res.status(400).json({ error: 'Type et items requis' });
    }

    const documentNumber = numero || await generateDocumentNumber(type);
    
    // Validate and convert status to valid DocumentStatus enum value
    const validStatuses = ['PREPARED', 'SENT', 'RECEIVED', 'CANCELLED', 'COMPLETED'];
    const validatedStatus = validStatuses.includes(status) ? status : 'PREPARED';
    
    if (status && !validStatuses.includes(status)) {
      console.log(`Invalid status '${status}' received, converting to 'PREPARED'`);
    }
    
    console.log('Creating document with clientId:', clientId);
    console.log('Document data:', { type, numero: documentNumber, clientId, fromDepotId, destinationDepotId });
    
    // Check if document number already exists
    const existingDocument = await prisma.stockDocument.findUnique({
      where: { numero: documentNumber }
    });
    
    if (existingDocument) {
      return res.status(400).json({ 
        error: `Le numéro de document '${documentNumber}' existe déjà. Veuillez utiliser un autre numéro.` 
      });
    }
    
    // Enforce depot isolation - use user's depotId if not specified
    const userDepotId = req.user?.depotId;
    const visitingDepotHeader = req.headers['x-depot-id'];
    const visitingDepotId = visitingDepotHeader ? parseInt(visitingDepotHeader) : null;
    
    // Determine target depot: fromDepotId > depotId > visitingDepotId > userDepotId
    let targetEmetteurId = fromDepotId || depotId || visitingDepotId || userDepotId;
    let targetDestinataireId = destinationDepotId || depotId || visitingDepotId || userDepotId;
    
    // For non-admin users, validate depot access
    if (req.user?.role !== 'ADMIN') {
      if (!userDepotId) {
        return res.status(400).json({ error: 'User must be assigned to a depot to create stock documents' });
      }
      // For non-admin, ensure they can only create documents for their depot
      if (targetEmetteurId && targetEmetteurId !== userDepotId && targetEmetteurId !== visitingDepotId) {
        return res.status(403).json({ error: 'Access denied: Cannot create documents for other depots' });
      }
      if (targetDestinataireId && targetDestinataireId !== userDepotId && targetDestinataireId !== visitingDepotId) {
        return res.status(403).json({ error: 'Access denied: Cannot create documents for other depots' });
      }
    }
    
    const document = await prisma.$transaction(async (tx) => {
      // Create the document
      const doc = await tx.stockDocument.create({
        data: {
          numero: documentNumber,
          type,
          status: validatedStatus,
          emetteurId: targetEmetteurId,
          destinataireId: targetDestinataireId,
          clientId: clientId || null,
          vehicleId: vehicleId || null,
          driverId: driverId || null,
          destination: destination || null,
          validationFromDate: validationFromDate ? new Date(validationFromDate) : null,
          validationToDate: validationToDate ? new Date(validationToDate) : null,
          notes: clientId ? `Client:${clientId}${notes ? ' | ' + notes : ''}` : (notes || null),
          items: {
            create: items.map(item => ({
              productId: item.produitId || item.productId,
              famille: (typeof item.famille === 'object' ? item.famille.name : item.famille) || 'SCAN',
              quantity: parseFloat(item.quantity),
              count: item.count || 1,
              prixUnitaire: item.prixUnitaire !== undefined ? parseFloat(item.prixUnitaire) : 0,
              tva: item.tva !== undefined ? parseFloat(item.tva) : 19,
              montantHT: item.montantHT !== undefined ? parseFloat(item.montantHT) : 0,
              montantTVA: item.montantTVA !== undefined ? parseFloat(item.montantTVA) : 0,
              montantTTC: item.montantTTC !== undefined ? parseFloat(item.montantTTC) : 0,
              batch: item.batch || null,
              notes: typeof item.famille === 'object' ? item.famille.name : (item.notes || null),
              barcode: item.barcode || null,
              parentProductId: item.parentProductId || null,
              childProductName: item.childProductName || null
            }))
          },
          statusHistory: {
            create: {
              status: validatedStatus,
              userId: req.user.id,
              notes: 'Document créé par scan'
            }
          }
        },
        include: {
          emetteur: true,
          destinataire: true,
          client: true,
          items: {
            include: {
              product: true
            }
          }
        }
      });

      // Update inventory based on document type
      for (const item of items) {
        const productId = item.produitId || item.productId;
        const quantity = parseFloat(item.quantity);
        
        // Use fromDepotId as fallback if depotId is not provided
        const effectiveDepotId = depotId || fromDepotId;
        if (!effectiveDepotId) {
          throw new Error('Depot ID is required for inventory operations');
        }
        const depotIdInt = parseInt(effectiveDepotId);
        
        if (isNaN(depotIdInt)) {
          throw new Error(`Invalid depot ID: ${effectiveDepotId}`);
        }
        
        console.log('Processing inventory update:', { 
          productId, 
          quantity, 
          depotIdInt, 
          type, 
          effectiveDepotId,
          originalDepotId: depotId,
          fromDepotId 
        });

        if (type === 'BON_ENTREE_DEPOT') {
          // Add to inventory
          const inventory = await tx.inventory.findUnique({
            where: {
              depotId_productId: {
                depotId: depotIdInt,
                productId: productId
              }
            }
          });

          if (inventory) {
            await tx.inventory.update({
              where: { id: inventory.id },
              data: { quantity: { increment: quantity } }
            });
          } else {
            await tx.inventory.create({
              data: { depotId: depotIdInt, productId, quantity }
            });
          }

          // Create stock movement
          await tx.stockMovement.create({
            data: {
              productId,
              depotId: depotIdInt,
              quantity,
              type: 'IN',
              fromDepotId: null,
              toDepotId: depotIdInt,
              reason: 'ENTRY_SCAN',
              reference: documentNumber,
              userId: req.user.id
            }
          });
        } else if (type === 'BON_EXPEDITION' || type === 'BON_TRANSFERT') {
          // Remove from inventory
          const inventory = await tx.inventory.findUnique({
            where: {
              depotId_productId: {
                depotId: depotIdInt,
                productId: productId
              }
            }
          });

          if (inventory) {
            await tx.inventory.update({
              where: { id: inventory.id },
              data: { quantity: { decrement: quantity } }
            });
          } else {
            await tx.inventory.create({
              data: { depotId: depotIdInt, productId, quantity: -quantity }
            });
          }

          // Create stock movement
          await tx.stockMovement.create({
            data: {
              productId,
              depotId: depotIdInt,
              quantity: -quantity,
              type: 'OUT',
              fromDepotId: depotIdInt,
              toDepotId: destinationDepotId || depotIdInt,
              reason: type === 'BON_EXPEDITION' ? 'EXPEDITION_SCAN' : 'TRANSFERT_SCAN',
              reference: documentNumber,
              userId: req.user.id
            }
          });
        }
      }

      return doc;
    });

    await logAudit(req.user.id, 'stock_documents', document.id, 'CREATE', null, document);

    res.status(201).json(document);
  } catch (error) {
    console.error('Error creating document:', error);
    res.status(500).json({ error: 'Erreur lors de la création du document' });
  }
});

// Convert bon de sortie to bon de livraison
router.post('/:id/convert-to-delivery', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get the existing document
    const existingDocument = await prisma.stockDocument.findUnique({
      where: { id: parseInt(id) },
      include: {
        emetteur: { include: { company: true } },
        destinataire: { include: { company: true } },
        client: true,
        items: { include: { product: true } },
        statusHistory: { include: { user: true }, orderBy: { createdAt: 'desc' } }
      }
    });

    if (!existingDocument) {
      return res.status(404).json({ error: 'Document not found' });
    }

    if (existingDocument.type !== 'BON_EXPEDITION') {
      return res.status(400).json({ error: 'Only bon de sortie documents can be converted to delivery notes' });
    }

    // Generate new document number for delivery note
    const newNumber = await generateDocumentNumber('BON_ENTREE_MAGASIN');
    
    // Update the document type and number
    const updatedDocument = await prisma.stockDocument.update({
      where: { id: parseInt(id) },
      data: {
        type: 'BON_ENTREE_MAGASIN',
        numero: newNumber,
        status: 'SENT' // Mark as sent since it's being delivered
      },
      include: {
        emetteur: { include: { company: true } },
        destinataire: { include: { company: true } },
        client: true,
        items: { include: { product: true } },
        statusHistory: { include: { user: true }, orderBy: { createdAt: 'desc' } }
      }
    });

    // Add status history entry
    await prisma.documentStatusHistory.create({
      data: {
        documentId: parseInt(id),
        status: 'SENT',
        userId: req.user.id,
        notes: 'Document converti en bon de livraison'
      }
    });

    await logAudit(req.user.id, 'stock_documents', parseInt(id), 'UPDATE', existingDocument, updatedDocument);

    res.json(updatedDocument);
  } catch (error) {
    console.error('Error converting document to delivery:', error);
    res.status(500).json({ error: 'Erreur lors de la conversion du document' });
  }
});

// Stock synchronization function for document updates
async function synchronizeStockForDocumentUpdate(document, originalItems, newItems, userId) {
  try {
    console.log('Starting stock synchronization for document update:', document.id);
    
    // Create maps for easier comparison
    const originalItemsMap = new Map();
    const newItemsMap = new Map();
    
    // Map original items by productId
    originalItems.forEach(item => {
      const key = `${item.productId}_${item.parentProductId || 'null'}`;
      if (originalItemsMap.has(key)) {
        originalItemsMap.get(key).quantity += parseFloat(item.quantity);
      } else {
        originalItemsMap.set(key, {
          productId: item.productId,
          parentProductId: item.parentProductId,
          quantity: parseFloat(item.quantity),
          colisCount: parseInt(item.colisCount) || 1
        });
      }
    });
    
    // Map new items by productId
    newItems.forEach(item => {
      const key = `${item.productId}_${item.parentProductId || 'null'}`;
      if (newItemsMap.has(key)) {
        newItemsMap.get(key).quantity += parseFloat(item.quantity);
      } else {
        newItemsMap.set(key, {
          productId: item.productId,
          parentProductId: item.parentProductId,
          quantity: parseFloat(item.quantity),
          colisCount: parseInt(item.colisCount) || 1
        });
      }
    });
    
    // Determine stock changes based on document type
    const isOutgoing = ['BON_EXPEDITION', 'BON_SORTIE'].includes(document.type);
    const isIncoming = ['BON_ENTREE', 'BON_ENTREE_MAGASIN'].includes(document.type);
    const isTransfer = document.type === 'BON_TRANSFERT';
    
    if (!isOutgoing && !isIncoming && !isTransfer) {
      console.log('Document type does not require stock synchronization:', document.type);
      return;
    }
    
    // Process stock changes
    const allProductIds = new Set([...originalItemsMap.keys(), ...newItemsMap.keys()]);
    
    for (const key of allProductIds) {
      const originalItem = originalItemsMap.get(key);
      const newItem = newItemsMap.get(key);
      
      const originalQuantity = originalItem ? originalItem.quantity : 0;
      const newQuantity = newItem ? newItem.quantity : 0;
      const quantityChange = newQuantity - originalQuantity;
      
      if (Math.abs(quantityChange) < 0.001) {
        continue; // No significant change
      }
      
      const productId = (originalItem || newItem).productId;
      const parentProductId = (originalItem || newItem).parentProductId || productId;
      
      console.log(`Processing stock change for product ${productId}: ${originalQuantity} -> ${newQuantity} (change: ${quantityChange})`);
      
      // Determine which depot to update based on document type
      let depotId = null;
      let movementType = null;
      let fromDepotId = null;
      let toDepotId = null;
      
      if (isOutgoing) {
        depotId = document.emetteurId;
        movementType = 'OUT';
        fromDepotId = document.emetteurId;
        toDepotId = document.destinataireId;
      } else if (isIncoming) {
        depotId = document.destinataireId;
        movementType = 'IN';
        fromDepotId = document.emetteurId;
        toDepotId = document.destinataireId;
      } else if (isTransfer) {
        // For transfers, we need to handle both depots
        depotId = document.emetteurId;
        movementType = 'TRANSFER';
        fromDepotId = document.emetteurId;
        toDepotId = document.destinataireId;
      }
      
      if (!depotId) {
        console.log('No depot ID found for stock update');
        continue;
      }
      
      // Update inventory for the main depot
      await updateInventoryForProduct(depotId, parentProductId, quantityChange, isOutgoing);
      
      // For transfers, also update the destination depot
      if (isTransfer && toDepotId) {
        await updateInventoryForProduct(toDepotId, parentProductId, -quantityChange, false);
      }
      
      // Create stock movement record
      await prisma.stockMovement.create({
        data: {
          productId: parentProductId,
          depotId: depotId,
          quantity: quantityChange,
          type: movementType,
          fromDepotId: fromDepotId,
          toDepotId: toDepotId,
          reason: `DOCUMENT_UPDATE_${document.type}`,
          reference: document.numero,
          userId: userId
        }
      });
      
      console.log(`Stock movement created for product ${parentProductId}: ${quantityChange}kg (${movementType})`);
    }
    
    console.log('Stock synchronization completed for document update:', document.id);
  } catch (error) {
    console.error('Error during stock synchronization for document update:', error);
    throw error;
  }
}

// Helper function to update inventory for a product
async function updateInventoryForProduct(depotId, productId, quantityChange, isOutgoing) {
  try {
    // Find existing inventory record
    const inventory = await prisma.inventory.findUnique({
      where: {
        depotId_productId: {
          depotId: depotId,
          productId: productId
        }
      }
    });
    
    if (inventory) {
      // Update existing inventory
      const currentQuantity = parseFloat(inventory.quantity) || 0;
      const newQuantity = currentQuantity + quantityChange;
      
      await prisma.inventory.update({
        where: { id: inventory.id },
        data: { quantity: newQuantity }
      });
      
      console.log(`Updated inventory for depot ${depotId}, product ${productId}: ${currentQuantity} -> ${newQuantity}`);
    } else {
      // Create new inventory record
      await prisma.inventory.create({
        data: {
          depotId: depotId,
          productId: productId,
          quantity: quantityChange
        }
      });
      
      console.log(`Created new inventory for depot ${depotId}, product ${productId}: ${quantityChange}`);
    }
  } catch (error) {
    console.error(`Error updating inventory for depot ${depotId}, product ${productId}:`, error);
    throw error;
  }
}

// Create Bon de Retour (Return Document)
router.post('/return', authenticateToken, async (req, res) => {
  try {
    const { depotId, supplierId, items, notes } = req.body;
    const userId = req.user.id;

    if (!depotId || !items || items.length === 0) {
      return res.status(400).json({ error: 'Dépôt et articles requis' });
    }

    // Generate document reference
    const depot = await prisma.depot.findUnique({ where: { id: depotId } });
    if (!depot) {
      return res.status(404).json({ error: 'Dépôt non trouvé' });
    }

    const currentYear = new Date().getFullYear();
    const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0');
    
    const lastDoc = await prisma.stockDocument.findFirst({
      where: {
        type: 'BON_EXPEDITION',
        reference: { startsWith: `BR-${currentYear}${currentMonth}` }
      },
      orderBy: { createdAt: 'desc' }
    });

    let nextNumber = 1;
    if (lastDoc) {
      const lastNumber = parseInt(lastDoc.reference.split('-').pop());
      nextNumber = lastNumber + 1;
    }

    const reference = `BR-${currentYear}${currentMonth}-${String(nextNumber).padStart(4, '0')}`;

    // Create the return document
    const document = await prisma.stockDocument.create({
      data: {
        reference,
        type: 'BON_EXPEDITION',
        status: 'RECEIVED', // Auto-validate returns
        depotId: depotId,
        emetteurId: supplierId,
        destinataireId: depotId,
        notes: notes || 'Bon de retour',
        createdBy: userId,
        validatedBy: userId,
        validatedAt: new Date(),
        items: {
          create: items.map(item => ({
            productId: item.productId,
            famille: item.famille || 'Divers',
            quantity: -Math.abs(item.quantity), // Negative quantity for returns
            purchasePrice: item.purchasePrice || 0,
            batch: item.batch || null,
            notes: item.notes || null
          }))
        }
      },
      include: {
        depot: true,
        emetteur: true,
        items: {
          include: {
            product: true
          }
        }
      }
    });

    // Update inventory for each item (reduce stock)
    for (const item of items) {
      const quantity = Math.abs(item.quantity); // Use positive quantity for calculation
      await updateInventory(depotId, item.productId, -quantity); // Negative to reduce stock
    }

    // Log audit
    await logAudit(userId, 'CREATE', 'StockDocument', document.id, {
      type: 'BON_EXPEDITION',
      depotId: depotId,
      itemsCount: items.length,
      totalValue: items.reduce((sum, item) => sum + (Math.abs(item.quantity) * (item.purchasePrice || 0)), 0)
    });

    res.json(document);

  } catch (error) {
    console.error('Error creating bon de retour:', error);
    res.status(500).json({ error: 'Erreur lors de la création du bon de retour' });
  }
});

module.exports = router; 