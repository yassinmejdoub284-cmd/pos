const express = require('express');
const { prisma } = require('../lib/prisma');
const { authenticateToken } = require('../middleware/auth');
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

const router = express.Router();

// Get supplier payments
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { supplierId, startDate, endDate } = req.query;
    
    const whereClause = {};
    
    if (supplierId) {
      whereClause.supplierId = parseInt(supplierId);
    }
    
    if (startDate && endDate) {
      whereClause.createdAt = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    }

    const payments = await prisma.supplierPayment.findMany({
      where: whereClause,
      include: {
        supplier: {
          select: { id: true, name: true }
        },
        user: {
          select: { id: true, firstName: true, lastName: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(payments);
  } catch (error) {
    console.error('Error fetching supplier payments:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des règlements fournisseurs' });
  }
});

// Create supplier payment
router.post('/', authenticateToken, (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  const allowedRoles = ['ADMIN', 'MANAGER', 'CASHIER', 'RESPONSABLE_MAGASIN'];
  if (!hasRoleOrRoleKey(req.user, allowedRoles)) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }
  
  next();
}, async (req, res) => {
  try {
    const { supplierId, amount, notes, paymentMethod } = req.body;
    
    if (!supplierId || !amount) {
      return res.status(400).json({ error: 'Fournisseur et montant sont requis' });
    }

    // Enforce depot isolation - verify supplier belongs to user's depot
    const userDepotId = req.user?.depotId;
    
    // For RESPONSABLE_MAGASIN without depotId, get depotId from supplier or allow if supplier has expenses in any depot
    const userRoles = readUserRoles();
    const userRoleKey = userRoles[String(req.user.id)];
    const isResponsableMagasin = req.user?.role === 'RESPONSABLE_MAGASIN' || userRoleKey === 'RESPONSABLE_MAGASIN';
    
    let targetDepotId = userDepotId;
    if (!targetDepotId && isResponsableMagasin) {
      const supplier = await prisma.supplier.findUnique({
        where: { id: Number(supplierId) },
        select: { depotId: true }
      });
      
      if (supplier?.depotId) {
        targetDepotId = supplier.depotId;
      } else {
        // If supplier has no depot, check if they have expenses in any depot
        const expenseWithDepot = await prisma.expense.findFirst({
          where: { supplierId: Number(supplierId) },
          select: { depotId: true }
        });
        
        if (expenseWithDepot?.depotId) {
          targetDepotId = expenseWithDepot.depotId;
        } else {
          return res.status(400).json({ error: 'Impossible de déterminer le dépôt pour ce fournisseur' });
        }
      }
    }
    
    if (!targetDepotId && req.user?.role !== 'ADMIN' && !isResponsableMagasin) {
      return res.status(400).json({ error: 'User must be assigned to a depot to create supplier payments' });
    }

    // Verify supplier belongs to user's depot (unless admin or RESPONSABLE_MAGASIN)
    if (req.user?.role !== 'ADMIN' && !isResponsableMagasin) {
      const supplier = await prisma.supplier.findUnique({
        where: { id: Number(supplierId) },
        select: { depotId: true }
      });
      
      if (!supplier) {
        return res.status(404).json({ error: 'Supplier not found' });
      }
      
      // Allow if supplier has no depot assigned, or if supplier's depot matches user's depot
      // Also check if supplier has expenses in user's depot
      if (supplier.depotId !== null && supplier.depotId !== userDepotId) {
        // Check if supplier has expenses in user's depot
        const hasExpensesInDepot = await prisma.expense.count({
          where: {
            supplierId: Number(supplierId),
            depotId: userDepotId
          }
        });
        
        if (hasExpensesInDepot === 0) {
          return res.status(403).json({ error: 'Access denied: Supplier does not belong to your depot' });
        }
      }
    }

    // If paying in CASH, ensure open session to register cash sortie
    let activeSession = null;
    const method = (paymentMethod || 'CASH').toUpperCase();
    if (method === 'CASH') {
      activeSession = await prisma.sessionCaisse.findFirst({
        where: { 
          depotId: targetDepotId,
          status: 'OPEN' 
        }
      });
      if (!activeSession) {
        return res.status(400).json({ error: 'Aucune session de caisse ouverte pour le règlement en espèces' });
      }
    }

    const payment = await prisma.$transaction(async (tx) => {
      // Create the payment with a provisional amount; we'll correct it after computing appliedAmount
      const supplierPayment = await tx.supplierPayment.create({
        data: {
          supplierId: Number(supplierId),
          amount: Number(amount),
          notes: notes?.trim() || 'Règlement fournisseur',
          paymentMethod: method,
          userId: req.user.id,
          paymentDate: new Date()
        }
      });

      // Mark related expenses as paid if the payment covers them
      const supplier = await tx.supplier.findUnique({
        where: { id: Number(supplierId) },
        include: {
          expenses: {
            where: { isPaid: false },
            orderBy: { date: 'asc' }
          }
        }
      });

      let appliedAmount = 0;
      if (supplier) {
        let remainingPayment = Math.abs(Number(amount));
        
        for (const expense of supplier.expenses) {
          if (remainingPayment <= 0) break;
          
          const expenseAmount = Math.abs(parseFloat(expense.amount));
          const paymentForThisExpense = Math.min(remainingPayment, expenseAmount);
          
          await tx.expense.update({
            where: { id: expense.id },
            data: {
              isPaid: paymentForThisExpense >= expenseAmount,
              paidAt: paymentForThisExpense >= expenseAmount ? new Date() : null,
              paidBy: req.user.id
            }
          });
          
          appliedAmount += paymentForThisExpense;
          remainingPayment -= paymentForThisExpense;
        }
      }

      // After computing how much was actually applied, normalize the stored supplier payment amount
      // We store supplier payments as POSITIVE to indicate debit (money going out)
      // For CREDIT payments (negative amounts), preserve the negative sign to indicate credit/debt
      const originalAmount = Number(amount);
      let normalizedApplied;
      if (method === 'CREDIT' && originalAmount < 0) {
        // For credit entries, preserve negative amount to indicate debt
        normalizedApplied = originalAmount;
      } else {
        // For regular payments, use positive amount
        normalizedApplied = appliedAmount > 0 ? appliedAmount : Math.abs(originalAmount);
      }
      await tx.supplierPayment.update({
        where: { id: supplierPayment.id },
        data: { amount: normalizedApplied }
      });

      // If cash payment, create cash movement sortie for debit payments only
      // Credit payments should NOT create cash movements
      if (method === 'CASH' && normalizedApplied > 0) {
        // Only withdraw the portion that actually matches unpaid supplier expenses.
        // If none matched (no pending expenses), fallback to the requested amount.
        const amt = normalizedApplied;
        if (amt > 0) {
          // Check if a cash movement already exists for this supplier payment to prevent duplicates
          const existingMovement = await tx.cashMovement.findFirst({
            where: {
              sessionId: activeSession.id,
              reason: { contains: `Règlement fournisseur #${supplierPayment.id}` }
            }
          });

          // Only create cash movement if one doesn't already exist
          if (!existingMovement) {
            await tx.cashMovement.create({
              data: {
                sessionId: activeSession.id,
                type: 'SORTIE',
                amount: amt,
                reason: `Règlement fournisseur #${supplierPayment.id} (FOURN:${supplierId})`,
                ticketId: null,
                createdById: req.user.id
              }
            });

            // Keep session expected cash in sync immediately
            await tx.sessionCaisse.update({
              where: { id: activeSession.id },
              data: { expectedCash: { decrement: amt } }
            });
          }
        }
      }

      return supplierPayment;
    });

    const paymentWithDetails = await prisma.supplierPayment.findUnique({
      where: { id: payment.id },
      include: {
        supplier: {
          select: { id: true, name: true }
        },
        user: {
          select: { id: true, firstName: true, lastName: true }
        }
      }
    });

    res.status(201).json(paymentWithDetails);
  } catch (error) {
    console.error('Error creating supplier payment:', error);
    res.status(500).json({ error: 'Erreur lors de la création du règlement fournisseur' });
  }
});

// Get supplier payment by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const payment = await prisma.supplierPayment.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        supplier: {
          select: { id: true, name: true }
        },
        user: {
          select: { id: true, firstName: true, lastName: true }
        }
      }
    });

    if (!payment) {
      return res.status(404).json({ error: 'Règlement non trouvé' });
    }

    res.json(payment);
  } catch (error) {
    console.error('Error fetching supplier payment:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération du règlement' });
  }
});

// Update supplier payment
router.put('/:id', authenticateToken, (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  const allowedRoles = ['ADMIN', 'MANAGER', 'RESPONSABLE_MAGASIN'];
  if (!hasRoleOrRoleKey(req.user, allowedRoles)) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }
  
  next();
}, async (req, res) => {
  try {
    const { amount, notes } = req.body;
    
    const payment = await prisma.supplierPayment.update({
      where: { id: parseInt(req.params.id) },
      data: {
        amount: amount ? Number(amount) : undefined,
        notes: notes?.trim()
      },
      include: {
        supplier: {
          select: { id: true, name: true }
        },
        user: {
          select: { id: true, firstName: true, lastName: true }
        }
      }
    });

    res.json(payment);
  } catch (error) {
    console.error('Error updating supplier payment:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour du règlement' });
  }
});

// Delete supplier payment
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const paymentId = parseInt(req.params.id);
    
    // Get the payment first to check if it's a cash payment
    const payment = await prisma.supplierPayment.findUnique({
      where: { id: paymentId }
    });

    if (!payment) {
      return res.status(404).json({ error: 'Règlement non trouvé' });
    }

    // Track affected sessions for summary recalculation
    const affectedSessionIds = new Set();

    // Delete payment and invalidate related cash movements in a transaction
    await prisma.$transaction(async (tx) => {
      // Find and invalidate cash movements linked to this supplier payment
      // Cash movements have reason format: "Règlement fournisseur #<paymentId> (FOURN:...)"
      // Also search for variations without space or with different formats
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

        // Track affected sessions
        if (movement.sessionId) {
          affectedSessionIds.add(movement.sessionId);
        }
      }

      // If it was a cash payment, we need to adjust the session's expected cash
      // by adding back the amount that was deducted
      if (payment.paymentMethod === 'CASH' && parseFloat(payment.amount) > 0) {
        // Find the session that has the cash movement
        if (relatedMovements.length > 0) {
          const sessionId = relatedMovements[0].sessionId;
          if (sessionId) {
            const amountToRestore = parseFloat(payment.amount);
            await tx.sessionCaisse.update({
              where: { id: sessionId },
              data: { expectedCash: { increment: amountToRestore } }
            });
          }
        }
      }

      // Delete the supplier payment
      await tx.supplierPayment.delete({
        where: { id: paymentId }
      });
    });

    // Recalculate session summaries for all affected sessions
    // Import the function from sessions route
    const { calculateSessionSummary } = require('./sessions');
    for (const sessionId of affectedSessionIds) {
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

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting supplier payment:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression du règlement' });
  }
});

module.exports = router;
