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
  const prefix = type === 'BON_EXPEDITION' ? 'BEXP' : 
                 type === 'BON_ENTREE_DEPOT' ? 'BED' :
                 type === 'BON_TRANSFERT' ? 'BT' :
                 type === 'BON_ENTREE_MAGASIN' ? 'BEM' : 'DOC';
  
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
    const lastDocument = await prisma.stockDocument.findFirst({
      where: { type },
      orderBy: { id: 'desc' }
    });
    
    return lastDocument ? lastDocument.id + 1 : 1;
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



router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 20, type, status, depotId, clientId, dateFrom, dateTo } = req.query;
    const skip = (page - 1) * limit;
        
    const where = {};
    
    if (type) {
      where.type = type;
    }
    
    if (status) {
      where.status = status;
    }
    
    if (depotId) {
      where.OR = [
        { emetteurId: parseInt(depotId) },
        { destinataireId: parseInt(depotId) }
      ];
    }
    if (clientId) {
      where.notes = { contains: `Client:${parseInt(clientId)}` };
    }
    
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }
    
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
  const document = await prisma.stockDocument.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
      emetteur: { include: { company: true } },
      destinataire: { include: { company: true } },
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

    // Attach client by parsing notes if present
    let client = null;
    if (document.notes && document.notes.includes('Client:')) {
      const m = document.notes.match(/Client:(\d+)/);
      if (m) {
        const cid = parseInt(m[1]);
        try {
          client = await prisma.client.findUnique({ where: { id: cid } });
        } catch (e) {}
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
            famille: item.famille,
            quantity: parseFloat(item.quantity),
            count: parseInt(item.count) || 1,
            notes: item.notes || '',
            purchasePrice: item.purchasePrice || null,
            batch: item.batch || null,
            barcode: item.barcode || null
          }
        });
      }

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
          await tx.inventory.update({
            where: { id: inventory.id },
            data: {
              quantity: inventory.quantity - quantity
            }
          });
        } else {
          // Create inventory record with negative quantity
          await tx.inventory.create({
            data: {
              depotId: emetteurIdInt,
              productId: productId,
              quantity: -quantity
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
    const { depotId, supplierId, items, notes, payCash } = req.body;

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

    // If depot is a shop, check cash availability
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

      // Calculate total amount to pay supplier
      const totalAmount = items.reduce((sum, item) => {
        const quantity = parseFloat(item.quantity) || 0;
        const price = parseFloat(item.purchasePrice) || 0;
        return sum + (quantity * price);
      }, 0);

      if (totalAmount > 0) {
        // Calculate current cash in session
        const sessionSummary = await calculateSessionSummary(activeSession.id);
        const currentCash = sessionSummary.expectedCash;

        if (currentCash < totalAmount) {
          return res.status(400).json({ 
            error: `Fonds insuffisants. Montant requis: ${totalAmount.toFixed(3)} dt, Disponible: ${currentCash.toFixed(3)} dt` 
          });
        }
      }
    }

    const numero = await generateDocumentNumber('BON_ENTREE_DEPOT');

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
          type: 'BON_ENTREE_DEPOT',
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
              notes: 'Bon d\'entrée fournisseur'
            }
          }
        },
        include: {
          emetteur: true,
          destinataire: true,
          items: { include: { product: true } }
        }
      });

      // Increase inventory for each item and create IN stock movement
      for (const item of items) {
        const productId = parseInt(item.productId);
        const quantity = parseQuantity(item.quantity);
        const depotIdInt = parseInt(depotId);

        const inventory = await tx.inventory.findUnique({
          where: { depotId_productId: { depotId: depotIdInt, productId } }
        });

        if (inventory) {
          await tx.inventory.update({
            where: { id: inventory.id },
            data: { quantity: (parseFloat(inventory.quantity) + quantity) }
          });
        } else {
          await tx.inventory.create({
            data: { depotId: depotIdInt, productId, quantity }
          });
        }

        await tx.stockMovement.create({
          data: {
            productId,
            depotId: depotIdInt,
            quantity,
            type: 'IN',
            fromDepotId: null,
            toDepotId: depotIdInt,
            reason: 'ENTRY_SUPPLIER',
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
              productId: 1, // Default product, should be updated based on barcode lookup
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
          await tx.inventory.update({
            where: { id: inventory.id },
            data: {
              quantity: inventory.quantity - quantity
            }
          });
        } else {
          // Create inventory record with negative quantity
          await tx.inventory.create({
            data: {
              depotId: emetteurIdInt,
              productId: productId,
              quantity: -quantity
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
        
        const inventory = await tx.inventory.findUnique({
          where: {
            depotId_productId: {
              depotId: parseInt(depotId),
              productId: item.productId
            }
          }
        });
        
        if (inventory) {
          console.log('Updating existing inventory:', { 
            currentQuantity: inventory.quantity, 
            adding: item.quantity, 
            newQuantity: inventory.quantity + item.quantity 
          });
          await tx.inventory.update({
            where: { id: inventory.id },
            data: {
              quantity: inventory.quantity + item.quantity
            }
          });
        } else {
          console.log('Creating new inventory entry:', { 
            depotId: parseInt(depotId), 
            productId: item.productId, 
            quantity: item.quantity 
          });
          await tx.inventory.create({
            data: {
              depotId: parseInt(depotId),
              productId: item.productId,
              quantity: item.quantity
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
    const validStatuses = ['PREPARED', 'SENT', 'RECEIVED', 'CANCELLED'];
    const validatedStatus = validStatuses.includes(status) ? status : 'PREPARED';
    
    if (status && !validStatuses.includes(status)) {
      console.log(`Invalid status '${status}' received, converting to 'PREPARED'`);
    }
    
    const document = await prisma.$transaction(async (tx) => {
      // Create the document
      const doc = await tx.stockDocument.create({
        data: {
          numero: documentNumber,
          type,
          status: validatedStatus,
          emetteurId: fromDepotId || depotId,
          destinataireId: destinationDepotId || depotId,
          notes: clientId ? `Client:${clientId}${notes ? ' | ' + notes : ''}` : (notes || null),
          items: {
            create: items.map(item => ({
              productId: item.produitId || item.productId,
              famille: (typeof item.famille === 'object' ? item.famille.name : item.famille) || 'SCAN',
              quantity: parseFloat(item.quantity),
              count: item.count || 1,
              prixUnitaire: item.prixUnitaire || 0,
              tva: item.tva || 19,
              montantHT: item.montantHT || 0,
              montantTVA: item.montantTVA || 0,
              montantTTC: item.montantTTC || 0,
              batch: item.batch || null,
              notes: typeof item.famille === 'object' ? item.famille.name : (item.notes || null),
              barcode: item.barcode || null
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
        const depotIdInt = parseInt(depotId);

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

module.exports = router; 