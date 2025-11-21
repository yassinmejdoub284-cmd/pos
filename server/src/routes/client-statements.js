const express = require('express');
const { prisma } = require('../lib/prisma');
const { authenticateToken, requireRole } = require('../middleware/auth');

// Import session helper functions
async function updateExpectedCash(sessionId) {
  const session = await prisma.sessionCaisse.findUnique({
    where: { id: sessionId },
    include: {
      sales: {
        where: {
          status: { notIn: ['REFUNDED', 'CANCELLED'] }
        }
      },
      movements: {
        where: {
          amount: { gt: 0 } // Only count non-zero amounts (not invalidated)
        }
      }
    }
  });

  if (!session) return;

  // Calculate expected cash from movements
  let expectedCash = 0;
  session.movements.forEach(m => {
    if (m.type === 'ENTREE') {
      expectedCash += parseFloat(m.amount || 0);
    } else if (m.type === 'SORTIE') {
      expectedCash -= parseFloat(m.amount || 0);
    }
  });

  // Add cash from sales
  const cashSales = session.sales
    .filter(s => s.paymentType === 'COMPTANT' || s.paymentType === 'ESP')
    .reduce((sum, s) => sum + parseFloat(s.finalTotal || 0), 0);
  expectedCash += cashSales;

  // Update session
  await prisma.sessionCaisse.update({
    where: { id: sessionId },
    data: { expectedCash }
  });
}

const router = express.Router();

// Get client statement (releve client)
router.get('/:clientId/statement', authenticateToken, async (req, res) => {
  try {
    const { clientId } = req.params;
    const { startDate, endDate } = req.query;

    // Get client info - no depot filtering, get client regardless of depot
    const client = await prisma.client.findUnique({
      where: { id: parseInt(clientId) },
      select: {
        id: true,
        code: true,
        firstName: true,
        lastName: true,
        currentDebt: true,
        depotId: true
      }
    });

    if (!client) {
      return res.status(404).json({ error: 'Client non trouvé' });
    }

    // Prepare optional date filter
    const dateFilter = (startDate && endDate)
      ? { gte: new Date(startDate), lte: new Date(endDate) }
      : undefined;

    // Get all client debt transactions from ALL depots (no depot filtering)
    // Includes both DEBT (Débit - client owes) and PAYMENT (Crédit - reduces debt), with or without saleId
    // This ensures we get all transactions regardless of which depot the sale was made at
    // Exclude transactions from cancelled or refunded sales
    const debtTransactions = await prisma.clientDebtTransaction.findMany({
      where: {
        clientId: parseInt(clientId),
        ...(dateFilter ? { createdAt: dateFilter } : {}),
        // Exclude transactions from cancelled or refunded sales
        OR: [
          { saleId: null }, // Standalone payments (no saleId)
          {
            sale: {
              status: { notIn: ['CANCELLED', 'REFUNDED'] }
            }
          }
        ]
      },
      select: {
        id: true,
        amount: true,
        type: true,
        notes: true,
        saleId: true,
        createdAt: true
      },
      orderBy: { createdAt: 'asc' }
    });

    // Group transactions by saleId to create separate rows for total sale (debit) and payments (credit)
    const salePaymentMap = new Map(); // Map to track payments per sale with transaction IDs
    const saleDebtMap = new Map(); // Map to track debt transactions per sale
    const saleDates = new Map(); // Map to track earliest date per sale
    const standaloneRows = [];
    const saleIds = new Set(); // Track all saleIds to fetch sale details

    // First pass: collect payment amounts and dates for each sale
    for (const t of debtTransactions) {
      const amount = parseFloat(t.amount);
      if (t.saleId) {
        saleIds.add(t.saleId);
        if (!salePaymentMap.has(t.saleId)) {
          salePaymentMap.set(t.saleId, { totalPayment: 0, transactionIds: [] });
          saleDebtMap.set(t.saleId, { transactionIds: [] });
          saleDates.set(t.saleId, t.createdAt);
        }
        // Keep earliest date for the sale
        if (new Date(t.createdAt) < new Date(saleDates.get(t.saleId))) {
          saleDates.set(t.saleId, t.createdAt);
        }
        // Sum up all PAYMENT transactions for this sale and track IDs
        if (t.type === 'PAYMENT') {
          salePaymentMap.get(t.saleId).totalPayment += amount;
          salePaymentMap.get(t.saleId).transactionIds.push(t.id);
        }
        // Track DEBT transaction IDs
        if (t.type === 'DEBT') {
          saleDebtMap.get(t.saleId).transactionIds.push(t.id);
        }
      } else {
        // Standalone transactions remain separate
        standaloneRows.push({
          type: t.type.toLowerCase(),
          date: t.createdAt,
          reference: t.type === 'DEBT' ? `CREDIT-${t.id}` : `REGLEMENT-${t.id}`,
          debit: t.type === 'DEBT' ? amount : 0,
          credit: t.type === 'PAYMENT' ? amount : 0,
          id: t.id,
          transactionId: t.id, // Include transaction ID for deletion
          clickable: t.type === 'PAYMENT',
          saleId: null,
          description: t.notes || ''
        });
      }
    }

    // Fetch sale details for all saleIds to get finalTotal
    const saleRows = [];
    if (saleIds.size > 0) {
      const sales = await prisma.sale.findMany({
        where: {
          id: { in: Array.from(saleIds) }
        },
        select: {
          id: true,
          finalTotal: true,
          createdAt: true
        }
      });

      // Create rows: one for total sale (debit) and one for payment (credit) per sale
      for (const sale of sales) {
        const saleId = sale.id;
        const finalTotal = parseFloat(sale.finalTotal);
        const totalPayment = salePaymentMap.get(saleId)?.totalPayment || 0;
        const saleDate = saleDates.get(saleId) || sale.createdAt;

        // Row 1: Total sale amount in debit
        const debtTransactionIds = saleDebtMap.get(saleId)?.transactionIds || [];
        saleRows.push({
          type: 'ticket',
          date: saleDate,
          reference: `TICKET-${saleId}`,
          debit: finalTotal,
          credit: 0,
          id: saleId,
          transactionIds: debtTransactionIds, // Include transaction IDs for deletion
          clickable: true,
          saleId: saleId,
          description: 'ticket'
        });

        // Row 2: Payment amount in credit (only if there's a payment)
        if (totalPayment > 0) {
          const paymentTransactionIds = salePaymentMap.get(saleId)?.transactionIds || [];
          saleRows.push({
            type: 'ticket',
            date: saleDate,
            reference: `TICKET-${saleId}`,
            debit: 0,
            credit: totalPayment,
            id: saleId,
            transactionIds: paymentTransactionIds, // Include transaction IDs for deletion
            clickable: true,
            saleId: saleId,
            description: 'ticket'
          });
        }
      }
    }

    const rows = [...saleRows, ...standaloneRows];

    // Calculate running balance (Solde = Débits - Crédits)
    let balance = 0;
    const statement = rows
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .map(r => {
        balance = balance + r.debit - r.credit;
        return { ...r, balance };
      });

    res.json({
      client,
      statement,
      totalDebit: rows.reduce((sum, t) => sum + t.debit, 0),
      totalCredit: rows.reduce((sum, t) => sum + t.credit, 0),
      currentBalance: balance
    });
  } catch (error) {
    console.error('Error fetching client statement:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération du relevé client' });
  }
});

// Get all client statements summary
router.get('/statements/summary', authenticateToken, async (req, res) => {
  try {
    const { startDate, endDate, page = 1, limit = 5000 } = req.query;

    const whereClause = {};
    
    if (startDate && endDate) {
      whereClause.createdAt = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    }

    // Fetch all active clients without depot filtering - get all clients regardless of depot
    const clients = await prisma.client.findMany({
      where: { isActive: true },
      select: {
        id: true,
        code: true,
        firstName: true,
        lastName: true,
        currentDebt: true,
        maxDebt: true,
        totalSpent: true,
        depotId: true,
        _count: {
          select: { 
            sales: true,
            debtTransactions: true
          }
        }
      },
      orderBy: { code: 'asc' }, // Sort by code to ensure CLI0001 appears first
      skip: (parseInt(page) - 1) * parseInt(limit),
      take: parseInt(limit)
    });

    // Get summary for each client using the same logic as individual statement
    const clientSummaries = await Promise.all(
      clients.map(async (client) => {
        // Use the same date filter logic as individual statement
        const dateFilter = (startDate && endDate)
          ? { gte: new Date(startDate), lte: new Date(endDate) }
          : undefined;

        // Get all debt transactions for this client from ALL depots (no depot filtering)
        // This ensures we get all transactions regardless of which depot the sale was made at
        // Exclude transactions from cancelled or refunded sales (same as individual statement)
        const debtTransactions = await prisma.clientDebtTransaction.findMany({
          where: {
            clientId: client.id,
            ...(dateFilter ? { createdAt: dateFilter } : {}),
            // Exclude transactions from cancelled or refunded sales (same as individual statement)
            OR: [
              { saleId: null }, // Standalone payments (no saleId)
              {
                sale: {
                  status: { notIn: ['CANCELLED', 'REFUNDED'] }
                }
              }
            ]
            // No depot filtering - get all transactions from all depots
          },
          select: {
            id: true,
            amount: true,
            type: true,
            saleId: true,
            createdAt: true
          },
          orderBy: { createdAt: 'asc' }
        });

        // Group transactions by saleId (same logic as individual statement)
        const salePaymentMap = new Map(); // Map to track payments per sale
        const saleDates = new Map(); // Map to track earliest date per sale
        const standaloneRows = [];
        const saleIds = new Set(); // Track all saleIds to fetch sale details

        // First pass: collect payment amounts and dates for each sale
        for (const t of debtTransactions) {
          const amount = parseFloat(t.amount);
          if (t.saleId) {
            saleIds.add(t.saleId);
            if (!salePaymentMap.has(t.saleId)) {
              salePaymentMap.set(t.saleId, { totalPayment: 0 });
              saleDates.set(t.saleId, t.createdAt);
            }
            // Keep earliest date for the sale
            if (new Date(t.createdAt) < new Date(saleDates.get(t.saleId))) {
              saleDates.set(t.saleId, t.createdAt);
            }
            // Sum up all PAYMENT transactions for this sale
            if (t.type === 'PAYMENT') {
              salePaymentMap.get(t.saleId).totalPayment += amount;
            }
          } else {
            // Standalone transactions remain separate
            standaloneRows.push({
              type: t.type.toLowerCase(),
              date: t.createdAt,
              debit: t.type === 'DEBT' ? amount : 0,
              credit: t.type === 'PAYMENT' ? amount : 0
            });
          }
        }

        // Fetch sale details for all saleIds to get finalTotal
        // Exclude cancelled/refunded sales (same as individual statement)
        const saleRows = [];
        if (saleIds.size > 0) {
          const sales = await prisma.sale.findMany({
            where: {
              id: { in: Array.from(saleIds) },
              status: { notIn: ['CANCELLED', 'REFUNDED'] }
            },
            select: {
              id: true,
              finalTotal: true,
              createdAt: true
            }
          });

          // Create rows: one for total sale (debit) and one for payment (credit) per sale
          for (const sale of sales) {
            const saleId = sale.id;
            const finalTotal = parseFloat(sale.finalTotal);
            const totalPayment = salePaymentMap.get(saleId)?.totalPayment || 0;
            const saleDate = saleDates.get(saleId) || sale.createdAt;

            // Row 1: Total sale amount in debit
            saleRows.push({
              type: 'ticket',
              date: saleDate,
              debit: finalTotal,
              credit: 0
            });

            // Row 2: Payment amount in credit (only if there's a payment)
            if (totalPayment > 0) {
              saleRows.push({
                type: 'ticket',
                date: saleDate,
                debit: 0,
                credit: totalPayment
              });
            }
          }
        }

        // Calculate totals and running balance (same as individual statement)
        const rows = [...saleRows, ...standaloneRows]
          .sort((a, b) => new Date(a.date) - new Date(b.date));
        
        const totalDebit = rows.reduce((sum, t) => sum + t.debit, 0);
        const totalCredit = rows.reduce((sum, t) => sum + t.credit, 0);
        
        // Calculate running balance (same formula as individual statement)
        let balance = 0;
        rows.forEach(r => {
          balance = balance + r.debit - r.credit;
        });
        const currentBalance = balance;

        return {
          ...client,
          totalDebit: totalDebit,
          totalCredit: totalCredit,
          currentBalance: currentBalance,
          operationCount: rows.length
        };
      })
    );

    res.json(clientSummaries);
  } catch (error) {
    console.error('Error fetching client statements summary:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération du résumé des relevés clients' });
  }
});

// Delete statement transaction (admin only)
router.delete('/statement/transaction', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { transactionIds, saleId, isCredit, clientId } = req.body;

    if (!transactionIds || !Array.isArray(transactionIds) || transactionIds.length === 0) {
      return res.status(400).json({ error: 'Transaction IDs are required' });
    }

    if (!clientId) {
      return res.status(400).json({ error: 'Client ID is required' });
    }

    // Get the transactions to delete
    const transactions = await prisma.clientDebtTransaction.findMany({
      where: {
        id: { in: transactionIds.map(id => parseInt(id)) },
        clientId: parseInt(clientId)
      },
      include: {
        client: {
          select: { id: true, currentDebt: true }
        }
      }
    });

    if (transactions.length === 0) {
      return res.status(404).json({ error: 'Transactions not found' });
    }

    // Verify all transactions belong to the same client
    const clientIds = new Set(transactions.map(t => t.clientId));
    if (clientIds.size > 1) {
      return res.status(400).json({ error: 'Transactions belong to different clients' });
    }

    const client = transactions[0].client;
    let sale = null;
    let stockRestored = false;

    // If this is related to a sale, get sale details for stock restoration
    if (saleId) {
      sale = await prisma.sale.findUnique({
        where: { id: parseInt(saleId) },
        include: {
          items: {
            include: {
              product: true
            }
          },
          depot: true
        }
      });

      if (!sale) {
        return res.status(404).json({ error: 'Sale not found' });
      }
    }

    // Process deletion in a transaction
    await prisma.$transaction(async (tx) => {
      // Calculate total amount to adjust client debt
      let totalDebtAdjustment = 0;
      let totalPaymentAdjustment = 0;

      for (const transaction of transactions) {
        const amount = parseFloat(transaction.amount);
        if (transaction.type === 'DEBT') {
          totalDebtAdjustment += amount;
        } else if (transaction.type === 'PAYMENT') {
          totalPaymentAdjustment += amount;
        }
      }

      // Delete the transactions
      await tx.clientDebtTransaction.deleteMany({
        where: {
          id: { in: transactions.map(t => t.id) }
        }
      });

      // If deleting DEBT transactions, check if the sale should be cancelled
      // A sale should be cancelled if all its DEBT transactions are deleted
      if (totalDebtAdjustment > 0 && saleId) {
        // Check if there are any remaining DEBT transactions for this sale
        const remainingDebtTransactions = await tx.clientDebtTransaction.findMany({
          where: {
            saleId: parseInt(saleId),
            type: 'DEBT'
          }
        });

        // If no DEBT transactions remain, mark the sale as CANCELLED
        // This ensures it's excluded from cash closure calculations
        if (remainingDebtTransactions.length === 0) {
          await tx.sale.update({
            where: { id: parseInt(saleId) },
            data: { status: 'CANCELLED' }
          });
        }
      }

      // Update client debt
      // If deleting DEBT: reduce debt (add it back)
      // If deleting PAYMENT: increase debt (remove the payment)
      const currentDebt = parseFloat(client.currentDebt || 0);
      const newDebt = currentDebt - totalDebtAdjustment + totalPaymentAdjustment;
      await tx.client.update({
        where: { id: client.id },
        data: { currentDebt: Math.max(0, newDebt) }
      });

      // If deleting a credit (payment) from a ticket, restore stock and handle cash movements
      // Restore stock regardless of sale status, as stock might have been deducted
      if (isCredit && sale) {
        // Restore stock for all items in the sale
        for (const item of sale.items) {
          // Calculate actual quantity to restore (handle wholesale bundle quantities)
          const actualQuantityToRestore = (sale.isWholesale && item.isWholesale && item.bundleSize)
            ? (parseFloat(item.bundleQuantity || item.quantity)) * parseFloat(item.bundleSize || 1)
            : parseFloat(item.quantity);

          // Get current inventory
          const currentInventory = await tx.inventory.findFirst({
            where: {
              depotId: sale.depotId,
              productId: item.productId
            }
          });

          if (currentInventory) {
            // Restore quantity by adding it back
            const newQuantity = parseFloat(currentInventory.quantity) + actualQuantityToRestore;
            await tx.inventory.updateMany({
              where: {
                depotId: sale.depotId,
                productId: item.productId
              },
              data: {
                quantity: newQuantity
              }
            });
          } else {
            // If no inventory record exists, create one with the restored quantity
            await tx.inventory.create({
              data: {
                depotId: sale.depotId,
                productId: item.productId,
                quantity: actualQuantityToRestore
              }
            });
          }

          // Create stock movement to record the restoration
          // Use toDepotId to ensure it appears in shop-transfer entries
          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              depotId: sale.depotId,
              toDepotId: sale.depotId, // Set toDepotId so it's counted as an entry
              quantity: actualQuantityToRestore,
              type: 'IN',
              reason: `Remboursement - Paiement supprimé du ticket #${sale.id}`,
              reference: `REMBOURSEMENT-${sale.id}`, // Add reference so it can be tracked
              userId: req.user?.id
            }
          });
        }
        stockRestored = true;
      }

      // If deleting a debit (sale) from a ticket, also restore stock
      // Restore stock regardless of sale status, as stock might have been deducted
      if (!isCredit && sale) {
        // Restore stock for all items in the sale
        for (const item of sale.items) {
          const actualQuantityToRestore = (sale.isWholesale && item.isWholesale && item.bundleSize)
            ? (parseFloat(item.bundleQuantity || item.quantity)) * parseFloat(item.bundleSize || 1)
            : parseFloat(item.quantity);

          const currentInventory = await tx.inventory.findFirst({
            where: {
              depotId: sale.depotId,
              productId: item.productId
            }
          });

          if (currentInventory) {
            const newQuantity = parseFloat(currentInventory.quantity) + actualQuantityToRestore;
            await tx.inventory.updateMany({
              where: {
                depotId: sale.depotId,
                productId: item.productId
              },
              data: {
                quantity: newQuantity
              }
            });
          } else {
            await tx.inventory.create({
              data: {
                depotId: sale.depotId,
                productId: item.productId,
                quantity: actualQuantityToRestore
              }
            });
          }

          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              depotId: sale.depotId,
              toDepotId: sale.depotId, // Set toDepotId so it's counted as an entry
              quantity: actualQuantityToRestore,
              type: 'IN',
              reason: `Remboursement - Vente supprimée du ticket #${sale.id}`,
              reference: `REMBOURSEMENT-${sale.id}`, // Add reference so it can be tracked
              userId: req.user?.id
            }
          });
        }
        stockRestored = true;
      }

      // Handle cash movements for DEBT deletions (sales cancellations)
      // If we deleted DEBT transactions and marked the sale as CANCELLED, invalidate related cash movements
      if (totalDebtAdjustment > 0 && saleId) {
        // Check if sale was cancelled (no remaining DEBT transactions)
        const remainingDebtTransactions = await tx.clientDebtTransaction.findMany({
          where: {
            saleId: parseInt(saleId),
            type: 'DEBT'
          }
        });

        // If sale was cancelled, invalidate all cash movements related to this sale
        if (remainingDebtTransactions.length === 0) {
          const cashMovementReasons = [
            `Vente gros #${saleId}`,
            `Acompte commande #${saleId}`,
            `Règlement commande #${saleId}`,
            `Vente gros public #${saleId}`,
            `Payment at wholesale sale`,
            `Advance payment at sale`
          ];

          const relatedMovements = await tx.cashMovement.findMany({
            where: {
              OR: [
                { ticketId: parseInt(saleId) },
                ...cashMovementReasons.map(reason => ({ reason: { contains: reason } }))
              ],
              amount: { gt: 0 } // Only get non-zero amounts (not already invalidated)
            }
          });

          const invalidatedSessionIds = new Set();
          for (const movement of relatedMovements) {
            await tx.cashMovement.update({
              where: { id: movement.id },
              data: {
                reason: `[SUPPRIMÉ] ${movement.reason}`,
                amount: 0 // Set amount to 0 to effectively exclude it from calculations
              }
            });
            
            // Track session IDs that need expected cash recalculation
            if (movement.sessionId) {
              invalidatedSessionIds.add(movement.sessionId);
            }
          }

          // Recalculate expected cash for affected sessions
          for (const sessionId of invalidatedSessionIds) {
            const session = await tx.sessionCaisse.findUnique({
              where: { id: sessionId }
            });
            
            if (session && (session.status === 'OPEN' || session.status === 'REOPENED' || session.status === 'CLOSED')) {
              // Use same recalculation logic as below (will be defined in the payment section)
              const movements = await tx.cashMovement.findMany({
                where: {
                  sessionId: sessionId,
                  amount: { gt: 0 } // Only count non-zero amounts (exclude invalidated)
                }
              });
              
              // Get all sales (including cancelled) to identify cancelled ticket IDs
              const allSales = await tx.sale.findMany({
                where: {
                  sessionId: sessionId
                },
                include: {
                  paymentMethod: true
                }
              });
              
              // Get cancelled/refunded ticket IDs to exclude their movements
              const cancelledTicketIds = new Set(
                allSales
                  .filter(sale => ['CANCELLED', 'REFUNDED'].includes((sale.status || '').toUpperCase()))
                  .map(sale => sale.id)
              );
              
              // Filter sales for calculations (exclude cancelled/refunded)
              const sales = allSales.filter(sale => !['REFUNDED', 'CANCELLED'].includes((sale.status || '').toUpperCase()));
              
              let newExpectedCash = parseFloat(session.openingFund || 0);
              
              // Calculate cash movements (exclude rejected movements and movements from cancelled tickets)
              const entree = movements
                .filter(m => {
                  const reason = String(m.reason || '');
                  const amount = parseFloat(m.amount || 0);
                  const isRejected = reason.includes('[REJETÉ]');
                  const isFromCancelledTicket = m.ticketId && cancelledTicketIds.has(m.ticketId);
                  return m.type === 'ENTREE' && !isRejected && !isFromCancelledTicket && amount > 0;
                })
                .reduce((sum, m) => sum + parseFloat(m.amount || 0), 0);
              
              const sortie = movements
                .filter(m => {
                  const reason = String(m.reason || '');
                  const reasonLower = reason.toLowerCase();
                  const amount = parseFloat(m.amount || 0);
                  const isRejected = reason.includes('[REJETÉ]');
                  const isFromCancelledTicket = m.ticketId && cancelledTicketIds.has(m.ticketId);
                  // CRITICAL: Exclude canceled ticket refunds - check both ticketId link and reason text
                  const isCanceledTicketRefund = reasonLower.includes('ticket annulé') || reasonLower.includes('ticket annule');
                  // CRITICAL: Exclude client credit payments from decaissement
                  const isClientCreditPayment = reasonLower.includes('crédit client') || reasonLower.includes('credit client') || 
                                                 reasonLower.includes('encaissement crédit') || reasonLower.includes('encaissement credit') ||
                                                 reasonLower.includes('règlement crédit') || reasonLower.includes('reglement credit');
                  // Exclude canceled ticket refunds and client credit payments
                  const shouldExclude = isFromCancelledTicket || isCanceledTicketRefund || isClientCreditPayment;
                  return ['SORTIE', 'DEPOT_COFFRE', 'RETRAIT_CENTRALE'].includes(m.type) && !isRejected && !shouldExclude && amount > 0;
                })
                .reduce((sum, m) => sum + parseFloat(m.amount || 0), 0);
              
              let creditOutstanding = 0;
              try {
                const debtTransactions = await tx.clientDebtTransaction.findMany({
                  where: {
                    type: 'DEBT',
                    saleId: { in: sales.map(s => s.id) }
                  }
                });
                creditOutstanding = debtTransactions.reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);
              } catch (e) {}
              
              // Compute cash from sales as sum of paidAmount (actual cash received) - only encaissement, not credit amounts
              let cashFromSalesNetCredit = 0;
              try {
                const saleIds = sales.map(s => s.id);
                if (saleIds.length > 0) {
                  const debts = await tx.clientDebtTransaction.findMany({
                    where: { 
                      type: 'DEBT', 
                      saleId: { in: saleIds } 
                    },
                    select: { saleId: true, amount: true }
                  });
                  const debtBySaleId = {};
                  debts.forEach(t => {
                    const sid = t.saleId;
                    const amt = parseFloat(t.amount || 0) || 0;
                    if (sid) {
                      debtBySaleId[sid] = (debtBySaleId[sid] || 0) + amt;
                    }
                  });
                  sales.forEach(sale => {
                    // Exclude CADEAU sales - they have amount = 0 and should not be in encaissement
                    const status = (sale.status || '').toUpperCase();
                    if (['CADEAU','PENDING_ADMIN'].includes(status)) return;
                    
                    const total = parseFloat(sale.finalTotal || 0) || 0;
                    const debtForSale = debtBySaleId[sale.id] || 0;
                    const paidAmount = Math.max(0, total - debtForSale);
                    cashFromSalesNetCredit += paidAmount;
                  });
                }
              } catch (e) {
                // Fallback: if we can't calculate paidAmount, use old method
                // Exclude CADEAU sales - they have amount = 0 and should not be in encaissement
                const totalSalesAmount = sales
                  .filter(s => !['CADEAU','PENDING_ADMIN'].includes((s.status || '').toUpperCase()))
                  .reduce((sum, sale) => sum + parseFloat(sale.finalTotal || 0), 0);
                cashFromSalesNetCredit = Math.max(0, totalSalesAmount - creditOutstanding);
              }
              
              const sessionStart = session.openedAt;
              const sessionEnd = session.closedAt || new Date();
              const standalonePayments = await tx.clientDebtTransaction.findMany({
                where: {
                  type: 'PAYMENT',
                  saleId: null,
                  userId: session.userId,
                  createdAt: {
                    gte: sessionStart,
                    lte: sessionEnd
                  }
                }
              });
              const clientPaymentsTotal = standalonePayments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
              
              let cashExpenseTotal = 0;
              try {
                const expenses = await tx.expense.findMany({
                  where: {
                    userId: session.userId,
                    paymentType: 'CASH',
                    isPaid: true,
                    OR: [
                      { date: { gte: sessionStart, lte: sessionEnd } },
                      { createdAt: { gte: sessionStart, lte: sessionEnd } }
                    ]
                  }
                });
                for (const expense of expenses) {
                  const hasMovement = movements.some(m =>
                    m.reason && m.reason.includes(`Dépense #${expense.id}`)
                  );
                  if (!hasMovement) {
                    cashExpenseTotal += parseFloat(expense.amount || 0);
                  }
                }
              } catch (e) {}
              
              let supplierPaymentsTotal = 0;
              try {
                const supplierPayments = await tx.supplierPayment.findMany({
                  where: {
                    userId: session.userId,
                    paymentMethod: { notIn: ['CREDIT'] },
                    OR: [
                      { paymentDate: { gte: sessionStart, lte: sessionEnd } },
                      { createdAt: { gte: sessionStart, lte: sessionEnd } }
                    ]
                  }
                });
                supplierPaymentsTotal = supplierPayments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
              } catch (e) {}
              
              newExpectedCash = newExpectedCash + cashFromSalesNetCredit + clientPaymentsTotal + entree - sortie - cashExpenseTotal - supplierPaymentsTotal;
              
              await tx.sessionCaisse.update({
                where: { id: sessionId },
                data: { expectedCash: newExpectedCash }
              });
            }
          }
        }
      }

      // Handle cash movements for payments
      // Also handle cash movements for DEBT deletions that have related cash movements
      const invalidatedSessionIds = new Set();
      
      if (totalPaymentAdjustment > 0 || (totalDebtAdjustment > 0 && saleId)) {
        // Get transaction dates to search in a time range
        const transactionDates = transactions.map(t => t.createdAt).sort();
        const minDate = transactionDates[0] ? new Date(transactionDates[0]) : null;
        const maxDate = transactionDates[transactionDates.length - 1] ? new Date(transactionDates[transactionDates.length - 1]) : null;
        
        // Build comprehensive search conditions
        const orConditions = [];
        const amountToMatch = totalPaymentAdjustment > 0 ? totalPaymentAdjustment : totalDebtAdjustment;
        
        if (saleId) {
          // For operations related to a sale, look for cash movements by ticketId or reason
          const cashMovementReasons = [
            `Vente gros #${saleId}`,
            `Acompte commande #${saleId}`,
            `Règlement commande #${saleId}`,
            `Vente gros public #${saleId}`,
            `Payment at wholesale sale`,
            `Advance payment at sale`
          ];

          orConditions.push(
            { ticketId: parseInt(saleId) },
            ...cashMovementReasons.map(reason => ({ reason: { contains: reason } }))
          );
        }
        
        // Also search by amount and date range (more aggressive search)
        if (minDate && maxDate && amountToMatch > 0) {
          // Search for movements in the same time range (within 2 hours of transaction)
          const searchStart = new Date(minDate);
          searchStart.setHours(searchStart.getHours() - 2);
          const searchEnd = new Date(maxDate);
          searchEnd.setHours(searchEnd.getHours() + 2);
          
          // Add amount-based search (with tolerance)
          orConditions.push({
            AND: [
              { type: 'ENTREE' },
              { amount: { gte: amountToMatch * 0.95, lte: amountToMatch * 1.05 } }, // 5% tolerance
              { createdAt: { gte: searchStart, lte: searchEnd } },
              { amount: { gt: 0 } } // Only non-zero amounts
            ]
          });
        }
        
        // For standalone payments, also search by reason patterns
        if (!saleId && totalPaymentAdjustment > 0) {
          const paymentReasons = [
            'Règlement client',
            'Débit - Règlement client',
            'Payment',
            'Encaissement automatique',
            'Encaissement',
            'Paiement client',
            'Règlement'
          ];
          
          orConditions.push(
            ...paymentReasons.map(reason => ({ reason: { contains: reason } }))
          );
        }

        if (orConditions.length > 0) {
          const relatedMovements = await tx.cashMovement.findMany({
            where: {
              OR: orConditions,
              amount: { gt: 0 } // Only get non-zero amounts (not already invalidated)
            }
          });

          console.log(`[client-statements] Found ${relatedMovements.length} potential cash movements to invalidate for ${saleId ? `sale #${saleId}` : 'standalone payment'}, amount: ${amountToMatch}`);

          // Invalidate cash movements that match
          for (const movement of relatedMovements) {
            const movementAmount = parseFloat(movement.amount);
            const shouldInvalidate = 
              // Exact match by ticketId
              (saleId && movement.ticketId === parseInt(saleId)) ||
              // Amount match (with tolerance)
              (Math.abs(movementAmount - amountToMatch) < (amountToMatch * 0.05 + 0.01)) ||
              // Reason contains saleId
              (saleId && movement.reason && movement.reason.includes(`#${saleId}`));
            
            if (shouldInvalidate) {
              console.log(`[client-statements] Invalidating cash movement #${movement.id}: ${movement.reason}, amount: ${movementAmount}, session: ${movement.sessionId}`);
              
              await tx.cashMovement.update({
                where: { id: movement.id },
                data: {
                  reason: `[SUPPRIMÉ] ${movement.reason}`,
                  amount: 0 // Set amount to 0 to effectively exclude it from calculations
                }
              });
              
              // Track session IDs that need expected cash recalculation
              if (movement.sessionId) {
                invalidatedSessionIds.add(movement.sessionId);
              }
            } else {
              console.log(`[client-statements] Skipping cash movement #${movement.id}: ${movement.reason}, amount: ${movementAmount} (doesn't match)`);
            }
          }
        } else {
          console.log(`[client-statements] No search conditions for cash movements (saleId: ${saleId}, amountToMatch: ${amountToMatch})`);
        }
      }
      
      // Recalculate expected cash for all affected sessions (both from DEBT and PAYMENT deletions)
      if (invalidatedSessionIds.size > 0) {
          
          // Recalculate expected cash for affected sessions
          for (const sessionId of invalidatedSessionIds) {
            // Check if session exists and is not closed (or can be updated)
            const session = await tx.sessionCaisse.findUnique({
              where: { id: sessionId }
            });
            
            if (session && (session.status === 'OPEN' || session.status === 'REOPENED')) {
              // Recalculate expected cash for open sessions using same logic as calculateSessionSummary
              const movements = await tx.cashMovement.findMany({
                where: {
                  sessionId: sessionId,
                  amount: { gt: 0 } // Only count non-zero amounts (exclude invalidated)
                }
              });
              
              // Get all sales (including cancelled) to identify cancelled ticket IDs
              const allSales = await tx.sale.findMany({
                where: {
                  sessionId: sessionId
                },
                include: {
                  paymentMethod: true
                }
              });
              
              // Get cancelled/refunded ticket IDs to exclude their movements
              const cancelledTicketIds = new Set(
                allSales
                  .filter(sale => ['CANCELLED', 'REFUNDED'].includes((sale.status || '').toUpperCase()))
                  .map(sale => sale.id)
              );
              
              // Filter sales for calculations (exclude cancelled/refunded)
              const sales = allSales.filter(sale => !['REFUNDED', 'CANCELLED'].includes((sale.status || '').toUpperCase()));
              
              // Start with opening fund
              let newExpectedCash = parseFloat(session.openingFund || 0);
              
              // Calculate cash movements (exclude rejected movements and movements from cancelled tickets)
              const entree = movements
                .filter(m => {
                  const reason = String(m.reason || '');
                  const amount = parseFloat(m.amount || 0);
                  const isRejected = reason.includes('[REJETÉ]');
                  const isFromCancelledTicket = m.ticketId && cancelledTicketIds.has(m.ticketId);
                  return m.type === 'ENTREE' && !isRejected && !isFromCancelledTicket && amount > 0;
                })
                .reduce((sum, m) => sum + parseFloat(m.amount || 0), 0);
              
              const sortie = movements
                .filter(m => {
                  const reason = String(m.reason || '');
                  const reasonLower = reason.toLowerCase();
                  const amount = parseFloat(m.amount || 0);
                  const isRejected = reason.includes('[REJETÉ]');
                  const isFromCancelledTicket = m.ticketId && cancelledTicketIds.has(m.ticketId);
                  // CRITICAL: Exclude canceled ticket refunds - check both ticketId link and reason text
                  const isCanceledTicketRefund = reasonLower.includes('ticket annulé') || reasonLower.includes('ticket annule');
                  // CRITICAL: Exclude client credit payments from decaissement
                  const isClientCreditPayment = reasonLower.includes('crédit client') || reasonLower.includes('credit client') || 
                                                 reasonLower.includes('encaissement crédit') || reasonLower.includes('encaissement credit') ||
                                                 reasonLower.includes('règlement crédit') || reasonLower.includes('reglement credit');
                  // Exclude canceled ticket refunds and client credit payments
                  const shouldExclude = isFromCancelledTicket || isCanceledTicketRefund || isClientCreditPayment;
                  return ['SORTIE', 'DEPOT_COFFRE', 'RETRAIT_CENTRALE'].includes(m.type) && !isRejected && !shouldExclude && amount > 0;
                })
                .reduce((sum, m) => sum + parseFloat(m.amount || 0), 0);
              
              // Calculate credit outstanding from DEBT transactions
              let creditOutstanding = 0;
              try {
                const debtTransactions = await tx.clientDebtTransaction.findMany({
                  where: {
                    type: 'DEBT',
                    saleId: { in: sales.map(s => s.id) }
                  }
                });
                creditOutstanding = debtTransactions.reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);
              } catch (e) {}
              
              // Compute cash from sales as sum of paidAmount (actual cash received) - only encaissement, not credit amounts
              let cashFromSalesNetCredit = 0;
              try {
                const saleIds = sales.map(s => s.id);
                if (saleIds.length > 0) {
                  const debts = await tx.clientDebtTransaction.findMany({
                    where: { 
                      type: 'DEBT', 
                      saleId: { in: saleIds } 
                    },
                    select: { saleId: true, amount: true }
                  });
                  const debtBySaleId = {};
                  debts.forEach(t => {
                    const sid = t.saleId;
                    const amt = parseFloat(t.amount || 0) || 0;
                    if (sid) {
                      debtBySaleId[sid] = (debtBySaleId[sid] || 0) + amt;
                    }
                  });
                  sales.forEach(sale => {
                    // Exclude CADEAU sales - they have amount = 0 and should not be in encaissement
                    const status = (sale.status || '').toUpperCase();
                    if (['CADEAU','PENDING_ADMIN'].includes(status)) return;
                    
                    const total = parseFloat(sale.finalTotal || 0) || 0;
                    const debtForSale = debtBySaleId[sale.id] || 0;
                    const paidAmount = Math.max(0, total - debtForSale);
                    cashFromSalesNetCredit += paidAmount;
                  });
                }
              } catch (e) {
                // Fallback: if we can't calculate paidAmount, use old method
                // Exclude CADEAU sales - they have amount = 0 and should not be in encaissement
                const totalSalesAmount = sales
                  .filter(s => !['CADEAU','PENDING_ADMIN'].includes((s.status || '').toUpperCase()))
                  .reduce((sum, sale) => sum + parseFloat(sale.finalTotal || 0), 0);
                cashFromSalesNetCredit = Math.max(0, totalSalesAmount - creditOutstanding);
              }
              
              // Add standalone client payments (only those that still exist, i.e., not deleted)
              const sessionStart = session.openedAt;
              const sessionEnd = session.closedAt || new Date();
              const standalonePayments = await tx.clientDebtTransaction.findMany({
                where: {
                  type: 'PAYMENT',
                  saleId: null, // Only standalone payments
                  userId: session.userId,
                  createdAt: {
                    gte: sessionStart,
                    lte: sessionEnd
                  }
                }
              });
              const clientPaymentsTotal = standalonePayments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
              
              // Calculate expenses (only those without cash movements to avoid double counting)
              let cashExpenseTotal = 0;
              try {
                const sessionStart = session.openedAt;
                const sessionEnd = session.closedAt || new Date();
                const expenses = await tx.expense.findMany({
                  where: {
                    userId: session.userId,
                    paymentType: 'CASH',
                    isPaid: true,
                    OR: [
                      { date: { gte: sessionStart, lte: sessionEnd } },
                      { createdAt: { gte: sessionStart, lte: sessionEnd } }
                    ]
                  }
                });
                
                // Only count expenses that don't have a cash movement (to avoid double counting)
                for (const expense of expenses) {
                  const hasMovement = movements.some(m => 
                    m.reason && m.reason.includes(`Dépense #${expense.id}`)
                  );
                  if (!hasMovement) {
                    cashExpenseTotal += parseFloat(expense.amount || 0);
                  }
                }
              } catch (e) {}
              
              // Calculate supplier payments (CASH only, exclude CREDIT)
              let supplierPaymentsTotal = 0;
              try {
                const sessionStart = session.openedAt;
                const sessionEnd = session.closedAt || new Date();
                const supplierPayments = await tx.supplierPayment.findMany({
                  where: {
                    userId: session.userId,
                    paymentMethod: { notIn: ['CREDIT'] },
                    OR: [
                      { paymentDate: { gte: sessionStart, lte: sessionEnd } },
                      { createdAt: { gte: sessionStart, lte: sessionEnd } }
                    ]
                  }
                });
                supplierPaymentsTotal = supplierPayments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
              } catch (e) {}
              
              // Calculate expected cash: opening + cashFromSales + clientPayments + entree - sortie - expenses - supplierPayments
              newExpectedCash = newExpectedCash + cashFromSalesNetCredit + clientPaymentsTotal + entree - sortie - cashExpenseTotal - supplierPaymentsTotal;
              
              // Update session expected cash
              await tx.sessionCaisse.update({
                where: { id: sessionId },
                data: { expectedCash: newExpectedCash }
              });
            } else if (session && session.status === 'CLOSED') {
              // For closed sessions, we still need to update expectedCash
              // This will affect the Z report and historical data
              // Use same logic as calculateSessionSummary
              const movements = await tx.cashMovement.findMany({
                where: {
                  sessionId: sessionId,
                  amount: { gt: 0 } // Only count non-zero amounts (exclude invalidated)
                }
              });
              
              const sales = await tx.sale.findMany({
                where: {
                  sessionId: sessionId,
                  status: { notIn: ['REFUNDED', 'CANCELLED'] }
                },
                include: {
                  paymentMethod: true
                }
              });
              
              // Start with opening fund
              let newExpectedCash = parseFloat(session.openingFund || 0);
              
              // Get cancelled/refunded ticket IDs to exclude their movements
              const cancelledTicketIds = new Set(
                sales
                  .filter(sale => ['CANCELLED', 'REFUNDED'].includes((sale.status || '').toUpperCase()))
                  .map(sale => sale.id)
              );
              
              // Calculate cash movements
              const entree = movements
                .filter(m => m.type === 'ENTREE')
                .reduce((sum, m) => sum + parseFloat(m.amount || 0), 0);
              
              const sortie = movements
                .filter(m => {
                  const reason = String(m.reason || '');
                  const reasonLower = reason.toLowerCase();
                  const amount = parseFloat(m.amount || 0);
                  const isFromCancelledTicket = m.ticketId && cancelledTicketIds.has(m.ticketId);
                  // CRITICAL: Exclude canceled ticket refunds - check both ticketId link and reason text
                  const isCanceledTicketRefund = reasonLower.includes('ticket annulé') || reasonLower.includes('ticket annule');
                  // CRITICAL: Exclude client credit payments from decaissement
                  const isClientCreditPayment = reasonLower.includes('crédit client') || reasonLower.includes('credit client') || 
                                                 reasonLower.includes('encaissement crédit') || reasonLower.includes('encaissement credit') ||
                                                 reasonLower.includes('règlement crédit') || reasonLower.includes('reglement credit');
                  // Exclude canceled ticket refunds and client credit payments
                  const shouldExclude = isFromCancelledTicket || isCanceledTicketRefund || isClientCreditPayment;
                  return ['SORTIE', 'DEPOT_COFFRE', 'RETRAIT_CENTRALE'].includes(m.type) && !shouldExclude && amount > 0;
                })
                .reduce((sum, m) => sum + parseFloat(m.amount || 0), 0);
              
              // Calculate credit outstanding from DEBT transactions
              let creditOutstanding = 0;
              try {
                const debtTransactions = await tx.clientDebtTransaction.findMany({
                  where: {
                    type: 'DEBT',
                    saleId: { in: sales.map(s => s.id) }
                  }
                });
                creditOutstanding = debtTransactions.reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);
              } catch (e) {}
              
              // Compute cash from sales as sum of paidAmount (actual cash received) - only encaissement, not credit amounts
              let cashFromSalesNetCredit = 0;
              try {
                const saleIds = sales.map(s => s.id);
                if (saleIds.length > 0) {
                  const debts = await tx.clientDebtTransaction.findMany({
                    where: { 
                      type: 'DEBT', 
                      saleId: { in: saleIds } 
                    },
                    select: { saleId: true, amount: true }
                  });
                  const debtBySaleId = {};
                  debts.forEach(t => {
                    const sid = t.saleId;
                    const amt = parseFloat(t.amount || 0) || 0;
                    if (sid) {
                      debtBySaleId[sid] = (debtBySaleId[sid] || 0) + amt;
                    }
                  });
                  sales.forEach(sale => {
                    // Exclude CADEAU sales - they have amount = 0 and should not be in encaissement
                    const status = (sale.status || '').toUpperCase();
                    if (['CADEAU','PENDING_ADMIN'].includes(status)) return;
                    
                    const total = parseFloat(sale.finalTotal || 0) || 0;
                    const debtForSale = debtBySaleId[sale.id] || 0;
                    const paidAmount = Math.max(0, total - debtForSale);
                    cashFromSalesNetCredit += paidAmount;
                  });
                }
              } catch (e) {
                // Fallback: if we can't calculate paidAmount, use old method
                // Exclude CADEAU sales - they have amount = 0 and should not be in encaissement
                const totalSalesAmount = sales
                  .filter(s => !['CADEAU','PENDING_ADMIN'].includes((s.status || '').toUpperCase()))
                  .reduce((sum, sale) => sum + parseFloat(sale.finalTotal || 0), 0);
                cashFromSalesNetCredit = Math.max(0, totalSalesAmount - creditOutstanding);
              }
              
              // Add standalone client payments (only those that still exist, i.e., not deleted)
              const sessionStart = session.openedAt;
              const sessionEnd = session.closedAt || new Date();
              const standalonePayments = await tx.clientDebtTransaction.findMany({
                where: {
                  type: 'PAYMENT',
                  saleId: null, // Only standalone payments
                  userId: session.userId,
                  createdAt: {
                    gte: sessionStart,
                    lte: sessionEnd
                  }
                }
              });
              const clientPaymentsTotal = standalonePayments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
              
              // Calculate expenses (only those without cash movements to avoid double counting)
              let cashExpenseTotal = 0;
              try {
                const sessionStart = session.openedAt;
                const sessionEnd = session.closedAt || new Date();
                const expenses = await tx.expense.findMany({
                  where: {
                    userId: session.userId,
                    paymentType: 'CASH',
                    isPaid: true,
                    OR: [
                      { date: { gte: sessionStart, lte: sessionEnd } },
                      { createdAt: { gte: sessionStart, lte: sessionEnd } }
                    ]
                  }
                });
                
                // Only count expenses that don't have a cash movement (to avoid double counting)
                for (const expense of expenses) {
                  const hasMovement = movements.some(m => 
                    m.reason && m.reason.includes(`Dépense #${expense.id}`)
                  );
                  if (!hasMovement) {
                    cashExpenseTotal += parseFloat(expense.amount || 0);
                  }
                }
              } catch (e) {}
              
              // Calculate supplier payments (CASH only, exclude CREDIT)
              let supplierPaymentsTotal = 0;
              try {
                const sessionStart = session.openedAt;
                const sessionEnd = session.closedAt || new Date();
                const supplierPayments = await tx.supplierPayment.findMany({
                  where: {
                    userId: session.userId,
                    paymentMethod: { notIn: ['CREDIT'] },
                    OR: [
                      { paymentDate: { gte: sessionStart, lte: sessionEnd } },
                      { createdAt: { gte: sessionStart, lte: sessionEnd } }
                    ]
                  }
                });
                supplierPaymentsTotal = supplierPayments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
              } catch (e) {}
              
              // Calculate expected cash: opening + cashFromSales + clientPayments + entree - sortie - expenses - supplierPayments
              newExpectedCash = newExpectedCash + cashFromSalesNetCredit + clientPaymentsTotal + entree - sortie - cashExpenseTotal - supplierPaymentsTotal;
              
              // Update closed session expected cash
              await tx.sessionCaisse.update({
                where: { id: sessionId },
                data: { expectedCash: newExpectedCash }
              });
            }
          }
        }
    });

    res.json({
      success: true,
      message: `Transaction${transactions.length > 1 ? 's' : ''} supprimée${transactions.length > 1 ? 's' : ''} avec succès`,
      stockRestored: stockRestored,
      transactionsDeleted: transactions.length
    });
  } catch (error) {
    console.error('Error deleting statement transaction:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression de la transaction' });
  }
});

module.exports = router;
