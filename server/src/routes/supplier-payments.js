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
    const { supplierId, amount, notes } = req.body;
    
    if (!supplierId || !amount) {
      return res.status(400).json({ error: 'Fournisseur et montant sont requis' });
    }

    const payment = await prisma.$transaction(async (tx) => {
      // Create the payment
      const supplierPayment = await tx.supplierPayment.create({
        data: {
          supplierId: Number(supplierId),
          amount: Number(amount),
          notes: notes?.trim() || 'Règlement fournisseur',
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

      if (supplier) {
        let remainingPayment = Number(amount);
        
        for (const expense of supplier.expenses) {
          if (remainingPayment <= 0) break;
          
          const expenseAmount = parseFloat(expense.amount);
          const paymentForThisExpense = Math.min(remainingPayment, expenseAmount);
          
          await tx.expense.update({
            where: { id: expense.id },
            data: {
              isPaid: paymentForThisExpense >= expenseAmount,
              paidAt: paymentForThisExpense >= expenseAmount ? new Date() : null,
              paidBy: req.user.id
            }
          });
          
          remainingPayment -= paymentForThisExpense;
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
