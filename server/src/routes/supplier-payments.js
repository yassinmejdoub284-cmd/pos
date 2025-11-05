const express = require('express');
const { prisma } = require('../lib/prisma');
const { authenticateToken, requireRole } = require('../middleware/auth');

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
router.post('/', authenticateToken, requireRole(['ADMIN', 'MANAGER', 'CASHIER']), async (req, res) => {
  try {
    const { supplierId, amount, notes, paymentMethod } = req.body;
    
    if (!supplierId || !amount) {
      return res.status(400).json({ error: 'Fournisseur et montant sont requis' });
    }

    // Enforce depot isolation - verify supplier belongs to user's depot
    const userDepotId = req.user?.depotId;
    if (!userDepotId) {
      return res.status(400).json({ error: 'User must be assigned to a depot to create supplier payments' });
    }

    // Verify supplier belongs to user's depot (unless admin)
    if (req.user?.role !== 'ADMIN') {
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
          depotId: userDepotId,
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
      // We store supplier payments as NEGATIVE to indicate money going out
      const originalAmount = Number(amount);
      const isCreditOnly = originalAmount < 0;
      const normalizedApplied = appliedAmount > 0 ? appliedAmount : Math.abs(originalAmount);
      await tx.supplierPayment.update({
        where: { id: supplierPayment.id },
        data: { amount: -normalizedApplied }
      });

      // If cash payment, create cash movement sortie ONLY for positive (debit) payments
      if (method === 'CASH' && !isCreditOnly) {
        // Only withdraw the portion that actually matches unpaid supplier expenses.
        // If none matched (no pending expenses), fallback to the requested amount.
        const amt = normalizedApplied;
        if (amt > 0) {
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
router.put('/:id', authenticateToken, requireRole(['ADMIN', 'MANAGER']), async (req, res) => {
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
router.delete('/:id', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    await prisma.supplierPayment.delete({
      where: { id: parseInt(req.params.id) }
    });

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting supplier payment:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression du règlement' });
  }
});

module.exports = router;
