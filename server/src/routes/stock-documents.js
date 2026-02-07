const express = require('express');
const { prisma } = require('../lib/prisma');
const { authenticateToken } = require('../middleware/auth');
const { logAudit } = require('../lib/audit');
const path = require('path');
const fs = require('fs');

const USER_ROLES_FILE = path.join(__dirname, '../uploads/user-roles.json');

function readUserRoles() {
  try {
    if (fs.existsSync(USER_ROLES_FILE)) {
      return JSON.parse(fs.readFileSync(USER_ROLES_FILE, 'utf8'));
    }
    return {};
  } catch (error) {
    console.error('Error reading user roles:', error);
    return {};
  }
}

function hasRoleOrRoleKey(user, allowedRoles) {
  // Check database role
  if (allowedRoles.includes(user.role)) {
    return true;
  }

  // Check roleKey from user-roles.json
  const userRoles = readUserRoles();
  const roleKey = userRoles[String(user.id)];
  if (roleKey && allowedRoles.includes(roleKey)) {
    return true;
  }

  return false;
}

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
      cashMovements: {
        where: {
          sessionId: sessionId
        }
      }
    }
  });

  if (!session) return null;

  // Additional safety: Filter cashMovements by sessionId after loading (double check)
  if (session.cashMovements) {
    const originalCount = session.cashMovements.length;
    session.cashMovements = session.cashMovements.filter(m => m.sessionId === sessionId);
    const filteredCount = session.cashMovements.length;
    if (originalCount !== filteredCount) {
      console.warn(`[calculateSessionSummary] Filtered cashMovements: ${originalCount} -> ${filteredCount} for session ${sessionId}`);
    }
  }

  // Get cancelled/refunded ticket IDs to exclude their movements
  const cancelledTicketIds = new Set(
    session.sales
      .filter(sale => ['CANCELLED', 'REFUNDED'].includes((sale.status || '').toUpperCase()))
      .map(sale => sale.id)
  );

  // Calculate cash from sales (exclude cancelled/refunded)
  const cashSales = session.sales
    .filter(sale => sale.paymentMethod?.type === 'CASH' && !['REFUNDED', 'CANCELLED'].includes((sale.status || '').toUpperCase()))
    .reduce((sum, sale) => sum + parseFloat(sale.finalTotal), 0);

  // Calculate cash movements (exclude rejected movements, deleted movements, and movements from cancelled tickets)
  const entree = session.cashMovements
    .filter(m => {
      const reason = String(m.reason || '');
      const amount = parseFloat(m.amount || 0);
      const isRejected = reason.includes('[REJETÉ]');
      const isDeleted = reason.includes('[SUPPRIMÉ]');
      const isFromCancelledTicket = m.ticketId && cancelledTicketIds.has(m.ticketId);
      return m.type === 'ENTREE' && !isRejected && !isDeleted && !isFromCancelledTicket && amount > 0;
    })
    .reduce((sum, m) => sum + parseFloat(m.amount), 0);

  const sortie = session.cashMovements
    .filter(m => {
      const reason = String(m.reason || '');
      const reasonLower = reason.toLowerCase();
      const amount = parseFloat(m.amount || 0);
      const isRejected = reason.includes('[REJETÉ]');
      const isDeleted = reason.includes('[SUPPRIMÉ]');
      const isFromCancelledTicket = m.ticketId && cancelledTicketIds.has(m.ticketId);
      const isCanceledTicketRefund = reasonLower.includes('ticket annulé') || reasonLower.includes('ticket annule');
      const isClientCreditPayment = reasonLower.includes('crédit client') || reasonLower.includes('credit client') ||
        reasonLower.includes('encaissement crédit') || reasonLower.includes('encaissement credit') ||
        reasonLower.includes('règlement crédit') || reasonLower.includes('reglement credit');
      const isBonRetour = reasonLower.includes('bon de retour') ||
        reasonLower.includes('bon retour') ||
        reasonLower.match(/dépense\s*#\d+:\s*bon\s*(de\s*)?retour/i);
      const shouldExclude = isFromCancelledTicket || isCanceledTicketRefund || isClientCreditPayment || isBonRetour;
      return ['SORTIE', 'DEPOT_COFFRE', 'RETRAIT_CENTRALE'].includes(m.type) && !isRejected && !isDeleted && !shouldExclude && amount > 0;
    })
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
  } catch (e) { }

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
  } catch (e) { }

  expectedCash = expectedCash + clientPaymentsTotal;

  // Compute cash from sales as sum of paidAmount (actual cash received) - only encaissement, not credit amounts
  // Calculate paidAmount for each sale: finalTotal - debt for that sale
  // CRITICAL: Exclude CADEAU sales - they have amount = 0 and should not be in encaissement
  let cashFromSalesNetCredit = 0;
  try {
    const saleIds = session.sales
      .filter(s => !['REFUNDED', 'CANCELLED', 'CADEAU', 'PENDING_ADMIN'].includes((s.status || '').toUpperCase()))
      .map(s => s.id);

    if (saleIds.length > 0) {
      // Get all DEBT transactions for sales in this session
      const debts = await prisma.clientDebtTransaction.findMany({
        where: {
          type: 'DEBT',
          saleId: { in: saleIds }
        },
        select: { saleId: true, amount: true }
      });

      // Group debt by saleId
      const debtBySaleId = {};
      debts.forEach(t => {
        const sid = t.saleId;
        const amt = parseFloat(t.amount || 0) || 0;
        if (sid) {
          debtBySaleId[sid] = (debtBySaleId[sid] || 0) + amt;
        }
      });

      // Calculate paidAmount for each sale and sum them up
      // Exclude CADEAU sales - they have amount = 0 and should not be in encaissement
      session.sales
        .filter(s => !['REFUNDED', 'CANCELLED', 'CADEAU', 'PENDING_ADMIN'].includes((s.status || '').toUpperCase()))
        .forEach(sale => {
          const total = parseFloat(sale.finalTotal || 0) || 0;
          const debtForSale = debtBySaleId[sale.id] || 0;
          const paidAmount = Math.max(0, total - debtForSale);
          cashFromSalesNetCredit += paidAmount;
        });
    }
  } catch (e) {
    // Fallback: if we can't calculate paidAmount, use old method
    // Exclude CADEAU sales - they have amount = 0 and should not be in encaissement
    const totalSalesAmount = session.sales
      .filter(s => !['REFUNDED', 'CANCELLED', 'CADEAU', 'PENDING_ADMIN'].includes((s.status || '').toUpperCase()))
      .reduce((sum, sale) => sum + parseFloat(sale.finalTotal), 0);
    cashFromSalesNetCredit = Math.max(0, totalSalesAmount - creditOutstanding);
  }

  expectedCash = expectedCash + cashFromSalesNetCredit + entree - sortie;

  return {
    expectedCash,
    cashSales,
    entree,
    sortie,
    totalSales: session.sales
      .filter(s => !['REFUNDED', 'CANCELLED'].includes((s.status || '').toUpperCase()))
      .reduce((sum, sale) => sum + parseFloat(sale.finalTotal), 0),
    totalTickets: session.sales.filter(s => !['REFUNDED', 'CANCELLED'].includes((s.status || '').toUpperCase())).length,
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
    const { page = 1, limit = 20, type, status, depotId, clientId, dateFrom, dateTo, fromDepotOnly, toDepotOnly, hasClient } = req.query;
    const skip = (page - 1) * limit;

    const where = {};

    if (type) {
      // Only allow valid DocumentType enum values
      const validTypes = ['BON_EXPEDITION', 'BON_ENTREE_DEPOT', 'BON_TRANSFERT', 'BON_ENTREE_MAGASIN', 'FACTURE'];

      if (!validTypes.includes(type)) {

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
      where.OR = [
        { clientId: parseInt(clientId) },
        { notes: { contains: `Client:${parseInt(clientId)}` } }
      ];
    }
    if (String(hasClient).toLowerCase() === 'true') {
      where.clientId = { not: null };
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
    const { depotId } = req.query;

    const documentId = parseInt(req.params.id);

    if (isNaN(documentId)) {
      return res.status(400).json({ error: 'ID de document invalide' });
    }

    const userDepotId = req.user?.depotId;
    const visitingDepotHeader = req.headers['x-depot-id'];
    const visitingDepotId = visitingDepotHeader ? parseInt(visitingDepotHeader) : null;
    const targetDepotId = depotId ? parseInt(depotId) : (visitingDepotId || userDepotId);
    const isAdmin = req.user?.role === 'ADMIN';

    let whereClause = {
      id: documentId
    };

    if (!isAdmin) {
      if (targetDepotId && userDepotId && targetDepotId !== userDepotId) {
        return res.status(403).json({ error: 'Access denied: Cannot access other depot documents' });
      }

      if (targetDepotId) {
        whereClause = {
          AND: [
            { id: documentId },
            {
              OR: [
                { emetteurId: targetDepotId },
                { destinataireId: targetDepotId }
              ]
            }
          ]
        };
      } else if (userDepotId) {
        whereClause = {
          AND: [
            { id: documentId },
            {
              OR: [
                { emetteurId: userDepotId },
                { destinataireId: userDepotId }
              ]
            }
          ]
        };
      }
    }

    const document = await prisma.stockDocument.findFirst({
      where: whereClause,
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
        }
      }
    });

    if (!document) {
      const documentExists = await prisma.stockDocument.findUnique({
        where: { id: documentId },
        select: { id: true, emetteurId: true, destinataireId: true, type: true }
      });

      if (!documentExists) {
        return res.status(404).json({ error: 'Document non trouvé' });
      } else if (!isAdmin) {
        return res.status(403).json({
          error: 'Accès refusé: Ce document n\'appartient pas à votre dépôt',
          documentInfo: {
            id: documentExists.id,
            type: documentExists.type,
            emetteurId: documentExists.emetteurId,
            destinataireId: documentExists.destinataireId
          }
        });
      } else {
        return res.status(404).json({ error: 'Document non trouvé' });
      }
    }

    // Debug: Log TVA values from database

    if (document.items) {
      document.items.forEach((item, index) => {

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




    let client = document.client;
    if (!client && document.notes && document.notes.includes('Client:')) {
      const m = document.notes.match(/Client:(\d+)/);
      if (m) {
        const cid = parseInt(m[1]);

        try {
          client = await prisma.client.findUnique({ where: { id: cid } });

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

      // Calculate total amount for the updated items
      const totalAmount = updateData.items.reduce((sum, item) => {
        const quantity = Math.abs(parseFloat(item.quantity) || 0);
        // Use purchasePrice for supplier documents, fallback to 0
        const price = parseFloat(item.purchasePrice || 0);
        return sum + (quantity * price);
      }, 0);

      // Handle financial updates (Expenses & Debt Transactions)
      // Check for Supplier ID in notes
      let supplierId = null;
      if (existingDocument.notes && existingDocument.notes.includes('Supplier:')) {
        const match = existingDocument.notes.match(/Supplier:(\d+)/);
        if (match) {
          supplierId = parseInt(match[1]);
        }
      }

      const depotId = existingDocument.emetteurId || existingDocument.destinataireId;

      // 1. Handle Bon de Retour (Return)
      if (existingDocument.type === 'BON_EXPEDITION' && supplierId) {
        // Update associated Expense (acting as credit)
        const associatedExpense = await prisma.expense.findFirst({
          where: {
            notes: { contains: `Bon de retour ${existingDocument.numero}` },
            depotId: depotId
          }
        });

        if (associatedExpense) {
          await prisma.expense.update({
            where: { id: associatedExpense.id },
            data: { amount: totalAmount }
          });
        }

        // Update associated SupplierDebtTransaction (if any exists for this return)
        const associatedDebtTx = await prisma.supplierDebtTransaction.findFirst({
          where: {
            supplierId: supplierId,
            notes: { contains: `Bon de retour ${existingDocument.numero}` }
          }
        });

        if (associatedDebtTx) {
          await prisma.supplierDebtTransaction.update({
            where: { id: associatedDebtTx.id },
            data: { amount: totalAmount }
          });
        }
      }

      // 2. Handle Bon d'Entrée (Entry)
      if (['BON_ENTREE_DEPOT', 'BON_ENTREE_MAGASIN'].includes(existingDocument.type) && supplierId) {
        // Update associated SupplierDebtTransaction (Main debt record)
        // Matches notes like "Bon d'entrée #BE-2023..." or just the document number
        const associatedDebtTx = await prisma.supplierDebtTransaction.findFirst({
          where: {
            supplierId: supplierId,
            notes: { contains: existingDocument.numero }
          }
        });

        if (associatedDebtTx) {
          await prisma.supplierDebtTransaction.update({
            where: { id: associatedDebtTx.id },
            data: { amount: totalAmount }
          });
        }

        // Update associated Expense (if payment was recorded as expense)
        const associatedExpense = await prisma.expense.findFirst({
          where: {
            notes: { contains: existingDocument.numero },
            depotId: depotId
          }
        });

        if (associatedExpense) {
          // Note: If expense is partial payment, we might not want to update it to full total
          // But if it represents the full "purchase" (credit), we should.
          // Assuming expense matching document number often tracks the debt amount or full payment.
          // Safest is to check if it's paid or not? 
          // For now, if an expense links directly to this document, we update it to reflect the new total
          // ONLY if it wasn't a partial payment (which usually has different notes or manual entry)
          // To be safe, we only update if the amount matches the OLD total (approx) or logic dictates.
          // Let's rely on the user's request: "make the new montant updated".
          await prisma.expense.update({
            where: { id: associatedExpense.id },
            data: { amount: totalAmount }
          });
        }
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



    if (!emetteurId || !destinataireId || !items || items.length === 0) {

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

    console.log('[stock-documents/entry] Request received:', {
      depotId,
      supplierId,
      itemsCount: items?.length,
      hasNotes: !!notes,
      payCash,
      isReturn,
      userId: req.user?.id,
      userRole: req.user?.role
    });

    // Validate required fields
    if (!depotId) {
      return res.status(400).json({ error: 'Dépôt requis' });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Au moins un article est requis' });
    }

    // Validate depotId is a valid number
    const depotIdInt = parseInt(depotId);
    if (isNaN(depotIdInt) || depotIdInt <= 0) {
      return res.status(400).json({ error: 'ID de dépôt invalide' });
    }

    // Validate each item has required fields
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.productId || parseInt(item.productId) <= 0) {
        return res.status(400).json({ error: `Article ${i + 1}: ID de produit invalide` });
      }
      if (!item.quantity || parseQuantity(item.quantity) <= 0) {
        return res.status(400).json({ error: `Article ${i + 1}: Quantité invalide` });
      }
      if (!item.famille) {
        return res.status(400).json({ error: `Article ${i + 1}: Famille requise` });
      }
    }

    // Check if depot is a shop and validate cash availability
    const depot = await prisma.depot.findUnique({
      where: { id: depotIdInt }
    });

    if (!depot) {
      return res.status(400).json({ error: 'Dépôt introuvable' });
    }

    // Note: Session check is only required when paying cash (checked later)
    // Entry documents can be created without a session since:
    // 1. The payment can be made via credit/deferred payment
    // 2. The payment is handled separately via the payment dialog
    // 3. The purchase price entered may be different from the product's selling price

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
          emetteurId: depotIdInt,
          destinataireId: depotIdInt,
          notes: supplierId ? `Supplier:${supplierId}${notes ? ' | ' + notes : ''}` : (notes || null),
          items: {
            create: items.map((item) => ({
              productId: parseInt(item.productId),
              famille: typeof item.famille === 'object' ? item.famille.name : (item.famille || 'Divers'),
              quantity: parseQuantity(item.quantity),
              purchasePrice: item.purchasePrice ? parseFloat(item.purchasePrice) : null,
              batch: item.batch || null,
              notes: item.notes || null,
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

      // NOTE: We do NOT create cash movement here even if payCash is true
      // The cash movement will be created when the supplier payment is recorded
      // This prevents double counting: one movement from bon d'entrée creation
      // and another from supplier payment creation
      // If payCash is true, the payment should be created immediately after bon d'entrée creation
      // and that payment will create the cash movement with the correct reason "Règlement fournisseur"

      return doc;
    });

    await logAudit(req.user.id, 'stock_documents', document.id, 'CREATE', null, document);

    res.status(201).json(document);
  } catch (error) {
    console.error('Error creating supplier entry:', error);
    const errorMessage = error.message || 'Erreur lors de la création du bon d\'entrée';
    const statusCode = error.message && error.message.includes('Cannot return') ? 400 : 500;
    res.status(statusCode).json({ error: errorMessage });
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

// Get inventory for a depot - calculates current stock from last POSTED inventory + entries - exits
router.get('/inventory/:depotId', authenticateToken, async (req, res) => {
  try {
    const depotId = parseInt(req.params.depotId);

    // Get depot info to determine product source
    const depot = await prisma.depot.findUnique({
      where: { id: depotId },
      select: { type: true }
    });

    if (!depot) {
      return res.status(404).json({ error: 'Depot not found' });
    }

    // Get the last POSTED inventory session for this depot
    // Order by postedAt desc to get the most recent posted inventory
    const lastPostedSession = await prisma.inventorySession.findFirst({
      where: {
        depotId: depotId,
        status: 'POSTED',
        postedAt: { not: null }
      },
      include: {
        items: true
      },
      orderBy: {
        postedAt: 'desc'
      }
    });

    const inventoryPostedAt = lastPostedSession?.postedAt || new Date(0);

    // If we have a POSTED inventory session, calculate current stock from it
    if (lastPostedSession && lastPostedSession.items && lastPostedSession.items.length > 0) {
      // Get all unique product IDs from inventory session (deduplicate in case of any duplicates)
      const inventoryProductIds = new Set(
        lastPostedSession.items
          .filter(item => item.productId != null)
          .map(item => item.productId)
      );

      // Find all products with entries (entry documents) since last inventory
      // Include all RECEIVED documents destined to this depot that represent incoming stock
      // This includes BON_ENTREE_DEPOT, BON_ENTREE_MAGASIN, and any other documents
      // that were approved as entries (they should have been converted to entry types, but
      // we also check for any RECEIVED documents to be safe)
      const entryDocuments = await prisma.stockDocument.findMany({
        where: {
          destinataireId: depotId,
          type: { in: ['BON_ENTREE_DEPOT', 'BON_ENTREE_MAGASIN'] },
          status: 'RECEIVED',
          createdAt: { gte: inventoryPostedAt }
        },
        include: {
          items: true
        }
      });

      // Also include any other RECEIVED documents that have stock movements of type 'IN'
      // This ensures we catch any documents that might have been approved but not yet converted
      // First, get all IN movements for this depot since the inventory date
      const inMovements = await prisma.stockMovement.findMany({
        where: {
          toDepotId: depotId,
          type: 'IN',
          date: { gte: inventoryPostedAt },
          reference: { not: null }
        },
        select: {
          reference: true
        }
      });

      // Get unique document numbers from movements
      const entryDocumentNumbers = new Set(inMovements.map(m => m.reference).filter(ref => ref != null));

      // Find documents that have IN movements but aren't already in entryDocuments
      // Only query if there are document numbers to search for
      let additionalEntryDocs = [];
      if (entryDocumentNumbers.size > 0) {
        // Get document numbers that are already in entryDocuments to avoid duplicates
        const existingDocumentNumbers = new Set(entryDocuments.map(doc => doc.numero));
        const numbersToSearch = Array.from(entryDocumentNumbers).filter(num => !existingDocumentNumbers.has(num));

        if (numbersToSearch.length > 0) {
          additionalEntryDocs = await prisma.stockDocument.findMany({
            where: {
              destinataireId: depotId,
              status: 'RECEIVED',
              createdAt: { gte: inventoryPostedAt },
              numero: { in: numbersToSearch },
              type: { notIn: ['BON_ENTREE_DEPOT', 'BON_ENTREE_MAGASIN', 'BON_EXPEDITION'] }
            },
            include: {
              items: true
            }
          });
        }
      }

      // Combine both sets of entry documents
      const allEntryDocuments = [...entryDocuments, ...additionalEntryDocs];

      // Find all products with exits (sales) since last inventory
      const sales = await prisma.sale.findMany({
        where: {
          depotId: depotId,
          status: { in: ['COMPLETED', 'CMD_TERMINEE'] },
          createdAt: { gte: inventoryPostedAt },
          paymentType: { in: ['COMPTANT', 'CREDIT'] }
        },
        include: {
          items: true
        }
      });

      // Find return documents (bon de retour) since last inventory
      const returnDocuments = await prisma.stockDocument.findMany({
        where: {
          emetteurId: depotId,
          type: 'BON_EXPEDITION',
          status: 'RECEIVED',
          notes: { contains: 'Supplier:' },
          createdAt: { gte: inventoryPostedAt }
        },
        include: {
          items: true
        }
      });

      // Collect all product IDs from entries, exits, and returns (only valid product IDs)
      allEntryDocuments.forEach(doc => {
        if (doc.items) {
          doc.items.forEach(item => {
            if (item.productId != null) {
              inventoryProductIds.add(item.productId);
            }
          });
        }
      });

      sales.forEach(sale => {
        if (sale.items) {
          sale.items.forEach(item => {
            if (item.productId != null) {
              inventoryProductIds.add(item.productId);
            }
          });
        }
      });

      returnDocuments.forEach(doc => {
        if (doc.items) {
          doc.items.forEach(item => {
            if (item.productId != null) {
              inventoryProductIds.add(item.productId);
            }
          });
        }
      });

      // Also include all products that have current inventory (even if not in POSTED session)
      // This ensures products added via PRODUCT_CONVERSION are included
      const currentInventoryProducts = await prisma.inventory.findMany({
        where: { depotId },
        select: { productId: true }
      });

      currentInventoryProducts.forEach(inv => {
        if (inv.productId != null) {
          inventoryProductIds.add(inv.productId);
        }
      });

      // Also include products from PRODUCT_CONVERSION movements
      const conversionMovements = await prisma.stockMovement.findMany({
        where: {
          depotId: depotId,
          reason: 'PRODUCT_CONVERSION',
          date: { gte: inventoryPostedAt }
        },
        select: { productId: true }
      });

      conversionMovements.forEach(movement => {
        if (movement.productId != null) {
          inventoryProductIds.add(movement.productId);
        }
      });

      // Load products and calculate current stock for each product
      const inventoryWithCurrentStock = await Promise.all(
        Array.from(inventoryProductIds).map(async (productId) => {
          let product = null;

          if (depot.type === 'SHOP') {
            product = await prisma.product.findUnique({
              where: { id: productId }
            });
          } else {
            product = await prisma.produitDeCaisse.findUnique({
              where: { id: productId }
            });
          }

          // Skip if product doesn't exist
          if (!product) {
            return null;
          }

          // Find base quantity from last POSTED inventory (0 if not in inventory session)
          const inventoryItem = lastPostedSession.items.find(item => item.productId === productId);
          let baseQuantity = 0;

          if (inventoryItem) {
            baseQuantity = parseFloat(inventoryItem.countedQuantity ?? inventoryItem.theoreticalQuantity ?? 0);
          } else {
            // If product is not in POSTED session, get current inventory quantity as base
            // and subtract movements since inventoryPostedAt to get base quantity
            const currentInventory = await prisma.inventory.findUnique({
              where: {
                depotId_productId: {
                  depotId: depotId,
                  productId: productId
                }
              }
            });

            if (currentInventory) {
              let qtyValue = currentInventory.quantity;
              if (qtyValue === null || qtyValue === undefined) {
                baseQuantity = 0;
              } else if (typeof qtyValue === 'object' && qtyValue !== null) {
                if ('toNumber' in qtyValue && typeof qtyValue.toNumber === 'function') {
                  baseQuantity = qtyValue.toNumber();
                } else {
                  baseQuantity = parseFloat(qtyValue.toString()) || 0;
                }
              } else {
                baseQuantity = parseFloat(qtyValue) || 0;
              }

              // Subtract movements since inventoryPostedAt to get base quantity at POSTED time
              const movementsSincePosted = await prisma.stockMovement.findMany({
                where: {
                  depotId: depotId,
                  productId: productId,
                  date: { gte: inventoryPostedAt }
                }
              });

              movementsSincePosted.forEach(movement => {
                const qty = parseFloat(movement.quantity || 0);
                if (movement.type === 'IN') {
                  baseQuantity -= qty;
                } else if (movement.type === 'OUT') {
                  baseQuantity += Math.abs(qty);
                }
              });
            }
          }

          // Calculate entries (entry documents) since last inventory POST
          let totalEntries = 0;
          allEntryDocuments.forEach(doc => {
            doc.items.forEach(docItem => {
              if (docItem.productId === productId) {
                totalEntries += parseFloat(docItem.quantity || 0);
              }
            });
          });

          // Also include stock movements of type 'IN' that are not from entry documents
          // This includes stock restorations from refunds, cancellations, client returns, etc.
          const additionalInMovements = await prisma.stockMovement.findMany({
            where: {
              toDepotId: depotId,
              productId: productId,
              type: 'IN',
              date: { gte: inventoryPostedAt },
              OR: [
                { reference: null }, // Movements without reference (like restorations)
                { reference: { not: { in: Array.from(entryDocumentNumbers) } } }, // Exclude movements already counted in entry documents
                { reason: { contains: 'Remboursement' } }, // Include all restoration movements
                { reason: 'CLIENT_RETURN' }, // Include client returns (they add stock back)
                { reason: 'RETOUR_ARTICLE' } // Include passenger returns (they add stock back)
              ]
            }
          });

          additionalInMovements.forEach(movement => {
            totalEntries += parseFloat(movement.quantity || 0);
          });

          // Calculate exits (sales) since last inventory POST
          let totalExits = 0;
          sales.forEach(sale => {
            sale.items.forEach(saleItem => {
              if (saleItem.productId === productId) {
                // Handle wholesale bundle quantities
                const actualQuantity = sale.isWholesale && saleItem.isWholesale && saleItem.bundleSize
                  ? (parseFloat(saleItem.bundleQuantity || saleItem.quantity || 0)) * parseFloat(saleItem.bundleSize || 1)
                  : parseFloat(saleItem.quantity || 0);
                totalExits += actualQuantity;
              }
            });
          });

          // Include OUT movements for PRODUCT_CONVERSION (transfer to vrac)
          const outConversionMovements = await prisma.stockMovement.findMany({
            where: {
              depotId: depotId,
              productId: productId,
              type: 'OUT',
              reason: 'PRODUCT_CONVERSION',
              date: { gte: inventoryPostedAt }
            }
          });

          outConversionMovements.forEach(movement => {
            totalExits += Math.abs(parseFloat(movement.quantity || 0));
          });

          // Include IN movements for PRODUCT_CONVERSION (transfer to vrac - target products)
          const inConversionMovements = await prisma.stockMovement.findMany({
            where: {
              depotId: depotId,
              productId: productId,
              type: 'IN',
              reason: 'PRODUCT_CONVERSION',
              date: { gte: inventoryPostedAt }
            }
          });

          inConversionMovements.forEach(movement => {
            totalEntries += parseFloat(movement.quantity || 0);
          });

          // Calculate returns (return documents) since last inventory POST
          // Use returnDocuments already fetched above
          let totalReturns = 0;
          returnDocuments.forEach(doc => {
            if (doc.items) {
              doc.items.forEach(docItem => {
                if (docItem.productId === productId) {
                  // Returns have negative quantities in the document, so we add the absolute value
                  totalReturns += Math.abs(parseFloat(docItem.quantity || 0));
                }
              });
            }
          });

          // Current stock = base quantity + entries - exits - returns
          const currentStock = baseQuantity + totalEntries - totalExits - totalReturns;

          return {
            id: inventoryItem?.id || null,
            depotId: depotId,
            productId: productId,
            quantity: currentStock,
            purchasePrice: product?.prix_achat ?? null,
            product: product
          };
        })
      );

      // Filter out null entries and ensure uniqueness by productId
      const inventoryMap = new Map();

      inventoryWithCurrentStock.forEach(item => {
        if (item === null) return;

        const existing = inventoryMap.get(item.productId);
        if (!existing) {
          // First occurrence of this product
          inventoryMap.set(item.productId, item);
        } else {
          // Product already exists - keep the one with inventory item id if available
          if (item.id && !existing.id) {
            inventoryMap.set(item.productId, item);
          }
          // Otherwise keep existing (prefer items from inventory session)
        }
      });

      // Convert map to array and sort by productId for consistent ordering
      const uniqueInventory = Array.from(inventoryMap.values())
        .sort((a, b) => a.productId - b.productId);

      return res.json(uniqueInventory);
    }

    // Otherwise, fall back to current inventory
    const inventory = await prisma.inventory.findMany({
      where: { depotId },
      include: {
        product: true
      }
    });

    // Ensure uniqueness by productId (in case of any duplicates)
    const inventoryMap = new Map();
    inventory.forEach(item => {
      if (item.productId != null && !inventoryMap.has(item.productId)) {
        let quantityValue = 0;
        const qtyValue = item.quantity;
        if (qtyValue === null || qtyValue === undefined) {
          quantityValue = 0;
        } else if (typeof qtyValue === 'object' && qtyValue !== null) {
          if ('toNumber' in qtyValue && typeof qtyValue.toNumber === 'function') {
            quantityValue = qtyValue.toNumber();
          } else {
            quantityValue = parseFloat(qtyValue.toString()) || 0;
          }
        } else {
          quantityValue = parseFloat(qtyValue) || 0;
        }

        inventoryMap.set(item.productId, {
          id: item.id,
          depotId: item.depotId,
          productId: item.productId,
          quantity: quantityValue,
          purchasePrice: item.product?.prix_achat ?? null,
          product: item.product
        });
      }
    });

    const uniqueInventoryFallback = Array.from(inventoryMap.values())
      .sort((a, b) => a.productId - b.productId);

    res.json(uniqueInventoryFallback);
  } catch (error) {
    console.error('Error fetching inventory:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      error: 'Erreur lors de la récupération de l\'inventaire',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Create transfer from BRANCH to SHOP
router.post('/transfer', authenticateToken, async (req, res) => {
  try {
    const { emetteurId, destinataireId, items, notes } = req.body;



    if (!emetteurId || !destinataireId || !items || items.length === 0) {

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

      return res.status(400).json({ error: 'Mauvais dépôt de destination' });
    }

    if (document.status !== 'PREPARED' && document.status !== 'SENT') {

      return res.status(400).json({ error: 'Document non prêt pour réception' });
    }

    await prisma.$transaction(async (tx) => {


      for (const item of document.items) {


        // Check if the product exists with this ID
        let product = await tx.product.findUnique({
          where: { id: item.productId }
        });


        // If product not found by ID, try to find by name (famille or notes)
        if (!product && (item.famille || item.notes)) {
          const searchTerm = item.famille || item.notes;


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



          // If we found the correct product, update the item's productId
          if (product) {
            await tx.stockDocumentItem.update({
              where: { id: item.id },
              data: { productId: product.id }
            });

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

    const documentId = parseInt(req.params.id);
    const { depotId, validatedItemIds } = req.body;



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

      return res.status(400).json({ error: 'Document non prêt pour approbation' });
    }

    // Allow all document types to be approved for receipt
    // Previously only BON_ENTREE_MAGASIN and FACTURE were allowed


    // Get depot info to determine the correct entry document type
    const targetDepot = await prisma.depot.findUnique({
      where: { id: parseInt(depotId) },
      select: { type: true }
    });

    if (!targetDepot) {
      return res.status(404).json({ error: 'Dépôt cible non trouvé' });
    }

    // Determine the correct entry document type based on depot type
    // SHOP depots use BON_ENTREE_MAGASIN, others use BON_ENTREE_DEPOT
    const entryDocumentType = targetDepot.type === 'SHOP' ? 'BON_ENTREE_MAGASIN' : 'BON_ENTREE_DEPOT';


    // Filter items to only include validated ones if validatedItemIds is provided
    let itemsToProcess = document.items;
    if (validatedItemIds && Array.isArray(validatedItemIds) && validatedItemIds.length > 0) {
      itemsToProcess = document.items.filter(item => validatedItemIds.includes(item.id));

    } else {

    }

    if (itemsToProcess.length === 0) {
      return res.status(400).json({ error: 'Aucun produit validé à approuver' });
    }

    await prisma.$transaction(async (tx) => {



      // Group items by parent product to consolidate quantities
      const groupedItems = new Map();

      for (const item of itemsToProcess) {

        console.log('Processing item:', {
          productId: item.productId,
          parentProductId: item.parentProductId,
          famille: item.famille,
          quantity: item.quantity
        });

        // Check for product depot link first
        let targetProductId = item.productId;


        // Use parentProductId if available, otherwise try to find parent by famille
        let parentProduct = null;

        if (item.parentProductId) {

            targetProductId = item.parentProductId;
          parentProduct = await tx.product.findUnique({
            where: { id: targetProductId }
          });

        } else if (item.famille) {

          // If no consolidation found, try exact match by product name
          if (!parentProduct) {
            parentProduct = await tx.product.findFirst({
              where: {
                name: item.famille
              }
            });
          }

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

          if (parentProduct && !targetProductId) {
            targetProductId = parentProduct.id;
          }
        }

        // If no parent found, use the original product
        if (!parentProduct) {
          parentProduct = await tx.product.findUnique({
            where: { id: item.productId }
          });

        }

        // Group by target product ID and sum quantities
        const quantity = parseFloat(item.quantity) || 0;

        if (groupedItems.has(targetProductId)) {
          groupedItems.get(targetProductId).quantity += quantity;

        } else {
          groupedItems.set(targetProductId, {
            productId: targetProductId,
            quantity: quantity,
            parentProduct: parentProduct
          });

        }
      }

      // Process grouped items
      for (const [productId, groupedItem] of groupedItems) {


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

      // Update document status and type to ensure it's counted as an entry document
      await tx.stockDocument.update({
        where: { id: documentId },
        data: {
          status: 'RECEIVED',
          type: entryDocumentType, // Change type to entry document type so it's counted in Total Entrées
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

    }




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

    // Validate that all products exist in either Product or ProduitDeCaisse tables
    for (const item of items) {
      const productId = item.produitId || item.productId;

      if (!productId) {
        return res.status(400).json({
          error: 'Un ou plusieurs produits n\'ont pas d\'ID valide.'
        });
      }

      const parsedProductId = parseInt(productId);
      if (isNaN(parsedProductId)) {
        return res.status(400).json({
          error: `ID de produit invalide: ${productId}`
        });
      }

      try {
        const productExists = await prisma.product.findUnique({
          where: { id: parsedProductId },
          select: { id: true }
        });

        const produitDeCaisseExists = await prisma.produitDeCaisse.findUnique({
          where: { id: parsedProductId },
          select: { id: true }
        });

        if (!productExists && !produitDeCaisseExists) {
          return res.status(400).json({
            error: `Le produit (ID: ${parsedProductId}) n'existe pas dans Product ni ProduitDeCaisse.`
          });
        }
      } catch (validationError) {
        console.error('Error validating product:', validationError);
        return res.status(400).json({
          error: `Erreur lors de la validation du produit (ID: ${parsedProductId}): ${validationError.message}`
        });
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
      // Note: Inventory and StockMovement only support Product table, not ProduitDeCaisse
      for (const item of items) {
        const productId = item.produitId || item.productId;
        const quantity = parseFloat(item.quantity);

        // Check if product exists in Product table (required for inventory operations)
        const productExists = await tx.product.findUnique({
          where: { id: productId },
          select: { id: true }
        });

        // Skip inventory operations if product is in ProduitDeCaisse (not supported yet)
        if (!productExists) {
          console.log(`Skipping inventory operations for product ${productId} (ProduitDeCaisse)`);
          continue;
        }

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
    console.error('Error stack:', error.stack);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      meta: error.meta
    });

    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Un document avec ce numéro existe déjà' });
    }

    if (error.code === 'P2003') {
      return res.status(400).json({
        error: 'Erreur de contrainte de clé étrangère. Vérifiez que tous les produits et dépôts existent.'
      });
    }

    res.status(500).json({
      error: 'Erreur lors de la création du document',
      details: error.message
    });
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
    const isIncoming = ['BON_ENTREE', 'BON_ENTREE_DEPOT', 'BON_ENTREE_MAGASIN'].includes(document.type);
    const isTransfer = document.type === 'BON_TRANSFERT';

    if (!isOutgoing && !isIncoming && !isTransfer) {

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


    }


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


    } else {
      // Create new inventory record
      await prisma.inventory.create({
        data: {
          depotId: depotId,
          productId: productId,
          quantity: quantityChange
        }
      });


    }
  } catch (error) {
    console.error(`Error updating inventory for depot ${depotId}, product ${productId}:`, error);
    throw error;
  }
}

// Create Bon de Retour (Return Document) - DEPRECATED (Replaced by implementation at bottom of file)
router.post('/return-deprecated', authenticateToken, async (req, res) => {
  try {
    const { depotId, supplierId, clientId, items, notes } = req.body;
    const userId = req.user.id;

    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'Articles requis' });
    }

    if (!supplierId && !clientId) {
      return res.status(400).json({ error: 'Fournisseur ou Client requis pour le bon de retour' });
    }

    // Get depotId from active session or use provided depotId
    let targetDepotId = depotId ? parseInt(depotId) : null;

    if (!targetDepotId) {
      // Try to get depotId from active session
      const activeSession = await prisma.sessionCaisse.findFirst({
        where: {
          userId: userId,
          status: 'OPEN'
        },
        orderBy: { openedAt: 'desc' }
      });

      if (activeSession && activeSession.depotId) {
        targetDepotId = parseInt(activeSession.depotId);
      } else if (req.user?.depotId) {
        targetDepotId = parseInt(req.user.depotId);
      } else {
        return res.status(400).json({ error: 'Aucune session ouverte ou dépôt assigné. Veuillez ouvrir une session ou spécifier un dépôt.' });
      }
    }

    // Validate targetDepotId
    if (!targetDepotId || isNaN(targetDepotId)) {
      return res.status(400).json({ error: 'Dépôt invalide' });
    }

    // Validate Depot, Supplier or Client
    const depot = await prisma.depot.findUnique({ where: { id: targetDepotId } });
    if (!depot) {
      return res.status(404).json({ error: 'Dépôt non trouvé' });
    }

    let partyName = '';
    if (supplierId) {
      const supplier = await prisma.supplier.findUnique({ where: { id: parseInt(supplierId) } });
      if (!supplier) {
        return res.status(404).json({ error: 'Fournisseur non trouvé' });
      }
      partyName = supplier.name;
    } else if (clientId) {
      const client = await prisma.client.findUnique({ where: { id: parseInt(clientId) } });
      if (!client) {
        return res.status(404).json({ error: 'Client non trouvé' });
      }
      partyName = `${client.firstName} ${client.lastName}`;
    }

    const currentYear = new Date().getFullYear();
    const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0');

    const lastDoc = await prisma.stockDocument.findFirst({
      where: {
        type: 'BON_EXPEDITION',
        numero: { startsWith: `BR-${currentYear}${currentMonth}` }
      },
      orderBy: { createdAt: 'desc' }
    });

    let nextNumber = 1;
    if (lastDoc) {
      const parts = lastDoc.numero.split('-');
      const lastNumber = parseInt(parts[parts.length - 1]);
      if (!isNaN(lastNumber)) {
        nextNumber = lastNumber + 1;
      }
    }

    const numero = `BR-${currentYear}${currentMonth}-${String(nextNumber).padStart(4, '0')}`;

    // Calculate total return amount
    const totalAmount = items.reduce((sum, item) => {
      const quantity = Math.abs(item.quantity || 0);
      const price = parseFloat(item.purchasePrice || 0);
      return sum + (quantity * price);
    }, 0);

    // Create the return document and update financial records in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create the return document
      const document = await tx.stockDocument.create({
        data: {
          numero,
          type: 'BON_EXPEDITION',
          status: 'RECEIVED', // Auto-validate returns
          emetteurId: targetDepotId, // Depot is the sender
          destinataireId: targetDepotId,
          clientId: clientId ? parseInt(clientId) : null,
          notes: clientId ? `Client:${clientId}${notes ? ' | ' + notes : ''}` : `Supplier:${supplierId}${notes ? ' | ' + notes : ''}`,
          items: {
            create: items.map(item => ({
              productId: parseInt(item.productId),
              famille: item.famille || 'Divers',
              quantity: -Math.abs(item.quantity), // Negative quantity for returns
              purchasePrice: item.purchasePrice ? parseFloat(item.purchasePrice) : null,
              batch: item.batch || null,
              notes: item.notes || null
            }))
          },
          statusHistory: {
            create: {
              status: 'RECEIVED',
              userId: userId,
              notes: 'Bon de retour créé'
            }
          }
        },
        include: {
          destinataire: true,
          emetteur: true,
          items: {
            include: {
              product: true
            }
          }
        }
      });

      // Update inventory for each item (reduce stock from the session's depot)
      for (const item of items) {
        const quantity = Math.abs(item.quantity);
        const productId = parseInt(item.productId);
        const sessionDepotId = targetDepotId;

        // Check current stock before reducing
        const inventory = await tx.inventory.findUnique({
          where: {
            depotId_productId: {
              depotId: sessionDepotId,
              productId: productId
            }
          }
        });

        if (!inventory || parseFloat(inventory.quantity) < quantity) {
          throw new Error(`Stock insuffisant pour le produit ${productId}. Stock disponible: ${inventory?.quantity || 0}, Quantité demandée: ${quantity}`);
        }

        await tx.inventory.update({
          where: {
            depotId_productId: {
              depotId: sessionDepotId,
              productId: productId
            }
          },
          data: {
            quantity: { decrement: quantity }
          }
        });

        // Create stock movement
        await tx.stockMovement.create({
          data: {
            productId: productId,
            depotId: sessionDepotId,
            quantity: -quantity,
            type: 'OUT',
            fromDepotId: sessionDepotId,
            toDepotId: null,
            reason: clientId ? 'RETURN_CLIENT' : 'RETURN_SUPPLIER',
            reference: numero,
            userId: userId
          }
        });
      }

      // If it's a client return, record it in their statement
      if (clientId) {
        await tx.client.update({
          where: { id: parseInt(clientId) },
          data: { currentDebt: { decrement: totalAmount } }
        });

        await tx.clientDebtTransaction.create({
          data: {
            clientId: parseInt(clientId),
            amount: totalAmount,
            type: 'PAYMENT', // Représente un crédit / réduction de dette
            notes: `Bon de retour #${numero}${notes ? ' | ' + notes : ''}`,
            userId: userId
          }
        });
      }

      return { document, expenseRecord: null };
    });

    // Log comprehensive audit trail for StockDocument
    try {
      await logAudit(userId, 'StockDocument', result.document.id, 'CREATE', null, {
        type: 'BON_EXPEDITION',
        numero: result.document.numero,
        depotId: targetDepotId,
        supplierId: supplierId ? parseInt(supplierId) : null,
        clientId: clientId ? parseInt(clientId) : null,
        partyName: partyName,
        itemsCount: items.length,
        totalValue: totalAmount,
        items: items.map(item => ({
          productId: parseInt(item.productId),
          quantity: Math.abs(item.quantity),
          purchasePrice: item.purchasePrice ? parseFloat(item.purchasePrice) : null,
          batch: item.batch || null
        })),
        notes: notes || null,
        createdAt: new Date().toISOString()
      });
    } catch (auditError) {
      console.error('Error logging audit trail for bon de retour document:', auditError);
      // Don't fail the request if audit logging fails
    }

    // Log audit trail for Expense if created
    if (result.expenseRecord) {
      try {
        await logAudit(userId, 'Expense', result.expenseRecord.id, 'CREATE', null, {
          type: 'SUPPLIER_RETURN_DEBIT',
          amount: totalAmount,
          supplierId: parseInt(supplierId),
          supplierName: supplier.name,
          depotId: targetDepotId,
          stockDocumentId: result.document.id,
          stockDocumentNumero: result.document.numero,
          notes: `Bon de retour ${result.document.numero} - Retour de produits vers ${supplier.name}`,
          createdAt: new Date().toISOString()
        });
      } catch (auditError) {
        console.error('Error logging audit trail for bon de retour expense:', auditError);
        // Don't fail the request if audit logging fails
      }
    }

    res.json(result.document);

  } catch (error) {
    console.error('Error creating bon de retour:', error);
    console.error('Error stack:', error.stack);
    console.error('Request body:', req.body);
    res.status(500).json({
      error: error.message || 'Erreur lors de la création du bon de retour',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Delete bon entree document (admin only) - reverses stock
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const documentId = parseInt(req.params.id);

    if (isNaN(documentId)) {
      return res.status(400).json({ error: 'Invalid document ID' });
    }

    // Get the document with items
    const document = await prisma.stockDocument.findUnique({
      where: { id: documentId },
      include: {
        items: true,
        emetteur: true,
        destinataire: true
      }
    });

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Only allow deletion of BON_ENTREE_DEPOT, BON_TRANSFERT, and BON_EXPEDITION documents
    if (document.type !== 'BON_ENTREE_DEPOT' && document.type !== 'BON_TRANSFERT' && document.type !== 'BON_EXPEDITION') {
      return res.status(400).json({ error: 'Only bon entree, transfer, and bon retour documents can be deleted' });
    }

    // Only allow deletion of RECEIVED documents
    if (document.status !== 'RECEIVED') {
      return res.status(400).json({ error: 'Only RECEIVED documents can be deleted' });
    }

    // Track affected sessions for summary recalculation (declared before transaction)
    const affectedSessionIdsForRecalc = new Set();

    // Delete document and reverse stock in a transaction
    await prisma.$transaction(async (tx) => {
      // Reverse stock for each item
      for (const item of document.items) {
        // Use parentProductId if available (for grouped products), otherwise use productId
        const targetProductId = item.parentProductId || item.productId;
        const quantity = Math.abs(parseFloat(item.quantity) || 0);
        const destinataireDepotId = document.destinataireId;
        const emetteurDepotId = document.emetteurId;
        const isTransfer = document.type === 'BON_TRANSFERT';
        const isBonRetour = document.type === 'BON_EXPEDITION';

        if (quantity > 0) {
          // For bon de retour: add stock back (reverse the return)
          if (isBonRetour) {
            const depotInventory = await tx.inventory.findUnique({
              where: {
                depotId_productId: {
                  depotId: destinataireDepotId,
                  productId: targetProductId
                }
              }
            });

            if (depotInventory) {
              const currentQuantity = parseFloat(depotInventory.quantity) || 0;
              const newQuantity = currentQuantity + quantity;

              await tx.inventory.update({
                where: { id: depotInventory.id },
                data: { quantity: newQuantity }
              });
            } else {
              await tx.inventory.create({
                data: {
                  depotId: destinataireDepotId,
                  productId: targetProductId,
                  quantity: quantity
                }
              });
            }

            // Create reverse stock movement
            await tx.stockMovement.create({
              data: {
                productId: targetProductId,
                depotId: destinataireDepotId,
                quantity: quantity,
                type: 'IN',
                fromDepotId: null,
                toDepotId: destinataireDepotId,
                reason: 'RETURN_DELETED_REVERSED',
                reference: document.numero,
                userId: req.user.id
              }
            });
            continue;
          }
          // For transfers: remove from destination, add back to source
          // For entries: remove from destination only

          // Step 1: Remove stock from destination depot (where it was received)
          const destinataireInventory = await tx.inventory.findUnique({
            where: {
              depotId_productId: {
                depotId: destinataireDepotId,
                productId: targetProductId
              }
            }
          });

          if (destinataireInventory) {
            const currentQuantity = parseFloat(destinataireInventory.quantity) || 0;
            const newQuantity = currentQuantity - quantity;

            // Allow deletion even if it would result in negative stock (admin operation)
            // This allows correction of incorrectly entered bon d'entrée documents
            // Negative stock can be corrected later through inventory adjustments
            if (newQuantity < 0) {
              console.warn(`[ADMIN DELETE] Allowing deletion that will result in negative stock for product ${targetProductId} in destination depot. Current: ${currentQuantity}, Removing: ${quantity}, Result: ${newQuantity}`);
            }

            if (newQuantity === 0) {
              // Delete inventory entry if quantity becomes zero
              await tx.inventory.delete({
                where: { id: destinataireInventory.id }
              });
            } else {
              // Update inventory (allow negative for admin corrections)
              await tx.inventory.update({
                where: { id: destinataireInventory.id },
                data: { quantity: newQuantity }
              });
            }
          } else {
            // If inventory doesn't exist, create it with negative quantity to track the deletion
            // This ensures the stock is properly reversed even if inventory was deleted or never existed
            await tx.inventory.create({
              data: {
                depotId: destinataireDepotId,
                productId: targetProductId,
                quantity: -quantity // Negative to reflect the removal
              }
            });
            console.warn(`[ADMIN DELETE] Created inventory entry with negative quantity for product ${targetProductId} in depot ${destinataireDepotId} (quantity: -${quantity})`);
          }

          // Step 2: For transfers, add stock back to source depot
          if (isTransfer && emetteurDepotId !== destinataireDepotId) {
            const emetteurInventory = await tx.inventory.findUnique({
              where: {
                depotId_productId: {
                  depotId: emetteurDepotId,
                  productId: targetProductId
                }
              }
            });

            if (emetteurInventory) {
              const currentEmetteurQuantity = parseFloat(emetteurInventory.quantity) || 0;
              const newEmetteurQuantity = currentEmetteurQuantity + quantity;

              await tx.inventory.update({
                where: { id: emetteurInventory.id },
                data: { quantity: newEmetteurQuantity }
              });
            } else {
              // Create inventory entry if it doesn't exist
              await tx.inventory.create({
                data: {
                  depotId: emetteurDepotId,
                  productId: targetProductId,
                  quantity: quantity
                }
              });
            }

            // Create stock movement for source depot (adding back)
            await tx.stockMovement.create({
              data: {
                productId: targetProductId,
                depotId: emetteurDepotId,
                quantity: quantity,
                type: 'IN',
                fromDepotId: destinataireDepotId,
                toDepotId: emetteurDepotId,
                reason: 'TRANSFER_DELETED_REVERSED',
                reference: document.numero,
                userId: req.user.id
              }
            });
          }

          // Create reverse stock movement for destination depot
          await tx.stockMovement.create({
            data: {
              productId: targetProductId,
              depotId: destinataireDepotId,
              quantity: -quantity, // Negative to reverse
              type: 'OUT',
              fromDepotId: destinataireDepotId,
              toDepotId: isTransfer ? emetteurDepotId : null,
              reason: isTransfer ? 'TRANSFER_DELETED' : 'ENTRY_DELETED',
              reference: document.numero,
              userId: req.user.id
            }
          });
        }
      }

      // Delete related records first (due to foreign key constraints)

      // For bon de retour: delete associated expense
      if (document.type === 'BON_EXPEDITION' && document.notes && document.notes.includes('Supplier:')) {
        const associatedExpenses = await tx.expense.findMany({
          where: {
            notes: { contains: `Bon de retour ${document.numero}` },
            depotId: document.destinataireId
          }
        });

        for (const expense of associatedExpenses) {
          await tx.expense.delete({
            where: { id: expense.id }
          });
        }
      }

      // Delete supplier payments linked to this bon d'entrée
      // Look for payments with notes containing various formats:
      // - "Bon d'entrée #<id>"
      // - "Crédit - Bon d'entrée #<id>"
      // - "Règlement bon d'entrée #<id>" (new format from cash payments)
      const supplierPaymentsToDelete = await tx.supplierPayment.findMany({
        where: {
          OR: [
            { notes: { contains: `Bon d'entrée #${documentId}` } },
            { notes: { contains: `Crédit - Bon d'entrée #${documentId}` } },
            { notes: { contains: `Crédit - Bon d'entrée${documentId}` } },
            { notes: { contains: `Bon d'entrée${documentId}` } },
            { notes: { contains: `Règlement bon d'entrée #${documentId}` } },
            { notes: { contains: `Règlement bon d'entrée${documentId}` } },
            // Also check for format with document numero if available
            ...(document.numero ? [
              { notes: { contains: `Bon d'entrée ${document.numero}` } },
              { notes: { contains: `Crédit - Bon d'entrée ${document.numero}` } },
              { notes: { contains: `Règlement bon d'entrée ${document.numero}` } }
            ] : [])
          ]
        }
      });

      // Get supplier payment IDs before deletion
      const supplierPaymentIds = supplierPaymentsToDelete.map(p => p.id);

      // Delete cash movements associated with these supplier payments and restore expectedCash
      // Cash movements have reason format: "Règlement fournisseur #<paymentId> (FOURN:...)"
      if (supplierPaymentIds.length > 0) {
        // Track sessions that need expectedCash adjustment
        const sessionAdjustments = new Map(); // sessionId -> amount to add back

        // Find and invalidate cash movements linked to these supplier payments
        for (const payment of supplierPaymentsToDelete) {
          const paymentId = payment.id;
          // Search for movements with various format variations
          const relatedMovements = await tx.cashMovement.findMany({
            where: {
              OR: [
                { reason: { contains: `Règlement fournisseur #${paymentId}` } },
                { reason: { contains: `Règlement fournisseur#${paymentId}` } },
                { reason: { contains: `Règlement fournisseur ${paymentId}` } }
              ]
            }
          });

          // Mark cash movements as invalid by updating the reason and setting amount to 0
          for (const movement of relatedMovements) {
            const movementAmount = parseFloat(movement.amount || 0);

            await tx.cashMovement.update({
              where: { id: movement.id },
              data: {
                reason: `[SUPPRIMÉ] ${movement.reason}`,
                amount: 0 // Set amount to 0 to effectively exclude it from calculations
              }
            });

            // Track affected sessions for summary recalculation
            if (movement.sessionId) {
              affectedSessionIdsForRecalc.add(movement.sessionId);
            }

            // If this was a cash payment, track the amount to restore to session
            if (payment.paymentMethod === 'CASH' && movementAmount > 0 && movement.sessionId) {
              const currentAdjustment = sessionAdjustments.get(movement.sessionId) || 0;
              sessionAdjustments.set(movement.sessionId, currentAdjustment + movementAmount);
            }
          }
        }

        // Restore expectedCash for all affected sessions
        for (const [sessionId, amountToRestore] of sessionAdjustments.entries()) {
          await tx.sessionCaisse.update({
            where: { id: sessionId },
            data: { expectedCash: { increment: amountToRestore } }
          });

        }

        // Delete supplier payments linked to this bon d'entrée
        await tx.supplierPayment.deleteMany({
          where: {
            id: { in: supplierPaymentIds }
          }
        });
      }


      // Delete status history
      await tx.documentStatusHistory.deleteMany({
        where: { documentId: documentId }
      });

      // Delete document items
      await tx.stockDocumentItem.deleteMany({
        where: { documentId: documentId }
      });

      // Finally, delete the document
      await tx.stockDocument.delete({
        where: { id: documentId }
      });
    });

    await logAudit(req.user.id, 'stock_documents', documentId, 'DELETE', document, null);

    // Recalculate session summaries for all affected sessions
    if (affectedSessionIdsForRecalc && affectedSessionIdsForRecalc.size > 0) {
      const { calculateSessionSummary } = require('./sessions');

      for (const sessionId of affectedSessionIdsForRecalc) {
        try {
          const summary = await calculateSessionSummary(sessionId);
          if (summary) {
            await prisma.sessionCaisse.update({
              where: { id: sessionId },
              data: { expectedCash: summary.expectedCash }
            });

          }
        } catch (error) {
          console.error(`Error recalculating summary for session ${sessionId}:`, error);
        }
      }
    }

    res.json({ message: 'Document deleted successfully', documentId });
  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).json({
      error: error.message || 'Erreur lors de la suppression du document'
    });
  }
});

// Create return document (Bon de Retour) - handles both client and supplier returns
router.post('/return', authenticateToken, async (req, res) => {
  try {
    const { depotId, clientId, supplierId, items, notes } = req.body;

    console.log('[stock-documents/return] Return request:', {
      depotId,
      clientId,
      supplierId,
      itemsCount: items?.length,
      userId: req.user?.id
    });

    // Validate required fields
    if (!depotId) {
      return res.status(400).json({ error: 'Dépôt requis' });
    }

    if (!clientId && !supplierId) {
      return res.status(400).json({ error: 'Client ou Fournisseur requis' });
    }

    if (clientId && supplierId) {
      return res.status(400).json({ error: 'Spécifiez soit un client, soit un fournisseur, pas les deux' });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Au moins un article est requis' });
    }

    const depotIdInt = parseInt(depotId);
    const clientIdInt = clientId ? parseInt(clientId) : null;
    const supplierIdInt = supplierId ? parseInt(supplierId) : null;

    if (isNaN(depotIdInt) || depotIdInt <= 0) {
      return res.status(400).json({ error: 'ID de dépôt invalide' });
    }

    // Validate depot exists
    const depot = await prisma.depot.findUnique({
      where: { id: depotIdInt }
    });

    if (!depot) {
      return res.status(400).json({ error: 'Dépôt introuvable' });
    }

    // Validate client or supplier exists
    if (clientIdInt) {
      if (isNaN(clientIdInt) || clientIdInt <= 0) {
        return res.status(400).json({ error: 'ID de client invalide' });
      }
      const client = await prisma.client.findUnique({
        where: { id: clientIdInt }
      });
      if (!client) {
        return res.status(400).json({ error: 'Client introuvable' });
      }
    }

    if (supplierIdInt) {
      if (isNaN(supplierIdInt) || supplierIdInt <= 0) {
        return res.status(400).json({ error: 'ID de fournisseur invalide' });
      }
      const supplier = await prisma.supplier.findUnique({
        where: { id: supplierIdInt }
      });
      if (!supplier) {
        return res.status(400).json({ error: 'Fournisseur introuvable' });
      }
    }

    // Generate document number
    const numero = await generateDocumentNumber('BON_EXPEDITION');

    // Calculate total return value
    const totalReturnValue = items.reduce((sum, item) => {
      const qty = Math.abs(parseFloat(item.quantity) || 0);
      const price = parseFloat(item.purchasePrice) || 0;
      return sum + (qty * price);
    }, 0);

    const isClientReturn = !!clientIdInt;
    const isSupplierReturn = !!supplierIdInt;

    const document = await prisma.$transaction(async (tx) => {
      // Create the return document
      const doc = await tx.stockDocument.create({
        data: {
          numero,
          type: 'BON_EXPEDITION',
          status: 'RECEIVED', // Auto-validated
          emetteurId: depotIdInt,
          destinataireId: depotIdInt,
          clientId: clientIdInt,
          notes: isClientReturn 
            ? `Client:${clientIdInt}${notes ? ' | ' + notes : ''}`
            : `Supplier:${supplierIdInt}${notes ? ' | ' + notes : ''}`,
          items: {
            create: items.map((item) => ({
              productId: parseInt(item.productId),
              famille: typeof item.famille === 'object' ? item.famille.name : (item.famille || 'Divers'),
              quantity: isSupplierReturn 
                ? -Math.abs(parseQuantity(item.quantity)) // Negative for supplier returns (products leaving)
                : Math.abs(parseQuantity(item.quantity)), // Positive for client returns (products coming back)
              purchasePrice: item.purchasePrice ? parseFloat(item.purchasePrice) : null,
              batch: item.batch || null,
              notes: item.notes || null,
              barcode: null
            }))
          },
          statusHistory: {
            create: {
              status: 'RECEIVED',
              userId: req.user.id,
              notes: isClientReturn ? 'Bon de retour client reçu' : 'Bon de retour fournisseur créé'
            }
          }
        },
        include: {
          emetteur: true,
          destinataire: true,
          client: true,
          items: { include: { product: true } }
        }
      });

      // Handle inventory and stock movements
      for (const item of items) {
        const productId = parseInt(item.productId);
        const quantity = Math.abs(parseQuantity(item.quantity));

        if (isSupplierReturn) {
          // SUPPLIER RETURN: Products going FROM depot TO supplier (REDUCE stock)
          const inventory = await tx.inventory.findUnique({
            where: { depotId_productId: { depotId: depotIdInt, productId } }
          });

          if (!inventory || parseFloat(inventory.quantity) < quantity) {
            throw new Error(`Stock insuffisant pour le produit ${productId}. Stock disponible: ${inventory?.quantity || 0}, Quantité demandée: ${quantity}`);
          }

          await tx.inventory.update({
            where: { id: inventory.id },
            data: { quantity: { decrement: quantity } }
          });

          // Create stock movement - OUT movement for supplier return
          await tx.stockMovement.create({
            data: {
              productId,
              depotId: depotIdInt,
              quantity: -quantity, // Negative for OUT movement
              type: 'OUT',
              fromDepotId: depotIdInt,
              toDepotId: null,
              reason: 'RETURN_SUPPLIER',
              reference: numero,
              userId: req.user.id
            }
          });
        } else {
          // CLIENT RETURN: Products coming FROM client TO depot (ADD to stock)
          const inventory = await tx.inventory.findUnique({
            where: { depotId_productId: { depotId: depotIdInt, productId } }
          });

          if (inventory) {
            const currentQuantity = parseFloat(inventory.quantity);
            const newQuantity = currentQuantity + quantity; // ADD to stock

            await tx.inventory.update({
              where: { id: inventory.id },
              data: { quantity: newQuantity }
            });
          } else {
            // Create new inventory record
            await tx.inventory.create({
              data: { depotId: depotIdInt, productId, quantity }
            });
          }

          // Create stock movement - IN movement for client return
          await tx.stockMovement.create({
            data: {
              productId,
              depotId: depotIdInt,
              quantity: quantity, // Positive for IN movement
              type: 'IN',
              toDepotId: depotIdInt,
              reason: 'CLIENT_RETURN',
              reference: numero,
              userId: req.user.id
            }
          });
        }
      }

      // Update client debt if it's a client return
      if (isClientReturn) {
        // Update client current debt (reduce debt)
        await tx.client.update({
          where: { id: clientIdInt },
          data: { currentDebt: { decrement: totalReturnValue } }
        });

        // Credit client account - reduce their debt
        await tx.clientDebtTransaction.create({
          data: {
            clientId: clientIdInt,
            type: 'PAYMENT', // Treated as payment/debit to reduce debt
            amount: totalReturnValue,
            notes: `Bon de retour #${numero}`,
            userId: req.user.id
          }
        });
      }

      // Update supplier debt if it's a supplier return
      if (isSupplierReturn) {
        // Update supplier current debt (reduce debt)
        await tx.supplier.update({
          where: { id: supplierIdInt },
          data: { currentDebt: { decrement: totalReturnValue } }
        });

        // Create supplier debt transaction - PAYMENT type reduces debt (debit in statement)
        await tx.supplierDebtTransaction.create({
          data: {
            supplierId: supplierIdInt,
            type: 'PAYMENT', // PAYMENT type = debit in statement (reduces debt)
            amount: totalReturnValue,
            notes: `Bon de retour #${numero}`,
            userId: req.user.id
          }
        });
      }

      console.log(`[stock-documents/return] ${isClientReturn ? 'Client' : 'Supplier'} return created:`, {
        documentId: doc.id,
        numero: doc.numero,
        clientId: clientIdInt,
        supplierId: supplierIdInt,
        totalValue: totalReturnValue,
        itemCount: items.length
      });

      return doc;
    });

    await logAudit(req.user.id, 'stock_documents', document.id, 'CREATE', null, document);

    res.status(201).json(document);
  } catch (error) {
    console.error('Error creating return document:', error);
    res.status(500).json({
      error: error.message || 'Erreur lors de la création du bon de retour'
    });
  }
});

module.exports = router; 