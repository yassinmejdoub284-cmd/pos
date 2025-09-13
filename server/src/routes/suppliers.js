const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Get all suppliers
router.get('/', authenticateToken, async (req, res) => {
  try {
    const suppliers = await prisma.supplier.findMany({
      where: { isActive: true },
      include: {
        expenses: {
          select: {
            id: true,
            amount: true,
            date: true,
            notes: true,
            category: {
              select: {
                id: true,
                name: true
              }
            }
          },
          orderBy: { date: 'desc' },
          take: 5 // Recent expenses only
        },
        payments: {
          select: {
            amount: true
          }
        }
      },
      orderBy: { name: 'asc' }
    });

    // Calculate financial information for each supplier
    const suppliersWithFinancials = suppliers.map(supplier => {
      const totalExpenses = supplier.expenses.reduce((sum, expense) => sum + Number(expense.amount), 0);
      const totalPayments = supplier.payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
      const currentDebt = totalExpenses - totalPayments;

      return {
        ...supplier,
        totalExpenses,
        totalPayments,
        currentDebt,
        recentExpenses: supplier.expenses.map(expense => ({
          ...expense,
          amount: Number(expense.amount),
          isPaid: false // For now, we'll consider expenses as unpaid if they have a debt
        }))
      };
    });

    res.json(suppliersWithFinancials);
  } catch (error) {
    console.error('Error fetching suppliers:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des fournisseurs' });
  }
});

// Get supplier by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const supplier = await prisma.supplier.findUnique({
      where: { id: parseInt(req.params.id) }
    });
    
    if (!supplier) {
      return res.status(404).json({ error: 'Fournisseur non trouvé' });
    }
    
    res.json(supplier);
  } catch (error) {
    console.error('Error fetching supplier:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération du fournisseur' });
  }
});

// Create new supplier
router.post('/', authenticateToken, requireRole(['ADMIN', 'MANAGER']), async (req, res) => {
  try {
    const { name, contactName, email, phone, address, city, postalCode, taxNumber, paymentTerms, notes } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Le nom du fournisseur est requis' });
    }

    const supplier = await prisma.supplier.create({
      data: {
        name,
        contactName,
        email,
        phone,
        address,
        city,
        postalCode,
        taxNumber,
        paymentTerms,
        notes
      }
    });

    res.status(201).json(supplier);
  } catch (error) {
    console.error('Error creating supplier:', error);
    res.status(500).json({ error: 'Erreur lors de la création du fournisseur' });
  }
});

// Update supplier
router.put('/:id', authenticateToken, requireRole(['ADMIN', 'MANAGER']), async (req, res) => {
  try {
    const { name, contactName, email, phone, address, city, postalCode, taxNumber, paymentTerms, notes, isActive } = req.body;
    
    const supplier = await prisma.supplier.update({
      where: { id: parseInt(req.params.id) },
      data: {
        name,
        contactName,
        email,
        phone,
        address,
        city,
        postalCode,
        taxNumber,
        paymentTerms,
        notes,
        isActive
      }
    });

    res.json(supplier);
  } catch (error) {
    console.error('Error updating supplier:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour du fournisseur' });
  }
});

// Delete supplier
router.delete('/:id', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    await prisma.supplier.delete({
      where: { id: parseInt(req.params.id) }
    });

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting supplier:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression du fournisseur' });
  }
});

// Toggle supplier status
router.patch('/:id/toggle-status', authenticateToken, requireRole(['ADMIN', 'MANAGER']), async (req, res) => {
  try {
    const supplier = await prisma.supplier.findUnique({
      where: { id: parseInt(req.params.id) }
    });

    if (!supplier) {
      return res.status(404).json({ error: 'Fournisseur non trouvé' });
    }

    const updatedSupplier = await prisma.supplier.update({
      where: { id: parseInt(req.params.id) },
      data: { isActive: !supplier.isActive }
    });

    res.json(updatedSupplier);
  } catch (error) {
    console.error('Error toggling supplier status:', error);
    res.status(500).json({ error: 'Erreur lors de la modification du statut du fournisseur' });
  }
});

// Get supplier summaries for statement
router.get('/statements/summary', authenticateToken, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();
    end.setHours(23, 59, 59, 999);

    const suppliers = await prisma.supplier.findMany({
      where: { isActive: true },
      include: {
        expenses: {
          where: {
            date: {
              gte: start,
              lte: end
            }
          }
        },
        payments: {
          where: {
            createdAt: {
              gte: start,
              lte: end
            }
          }
        },
        _count: {
          select: {
            expenses: true
          }
        }
      }
    });

    const summaries = suppliers.map(supplier => {
      const periodExpenses = supplier.expenses.reduce((sum, expense) => sum + parseFloat(expense.amount), 0);
      const periodPayments = supplier.payments.reduce((sum, payment) => sum + parseFloat(payment.amount), 0);
      const periodDebts = periodExpenses - periodPayments;
      const periodBalance = periodDebts; // Positive means we owe money
      
      // Calculate current debt (all unpaid expenses minus all payments)
      const currentDebt = supplier.expenses
        .filter(expense => !expense.isPaid)
        .reduce((sum, expense) => sum + parseFloat(expense.amount), 0) - 
        supplier.payments.reduce((sum, payment) => sum + parseFloat(payment.amount), 0);

      return {
        id: supplier.id,
        name: supplier.name,
        currentDebt: Math.max(0, currentDebt),
        totalExpenses: supplier.expenses.reduce((sum, expense) => sum + parseFloat(expense.amount), 0),
        periodExpenses,
        periodPayments,
        periodDebts,
        periodBalance,
        _count: supplier._count
      };
    });

    res.json(summaries);
  } catch (error) {
    console.error('Error fetching supplier summaries:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des résumés fournisseurs' });
  }
});

// Get supplier statement
router.get('/:supplierId/statement', authenticateToken, async (req, res) => {
  try {
    const { supplierId } = req.params;
    const { startDate, endDate } = req.query;

    // Get supplier info
    const supplier = await prisma.supplier.findUnique({
      where: { id: parseInt(supplierId) }
    });

    if (!supplier) {
      return res.status(404).json({ error: 'Fournisseur non trouvé' });
    }

    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();
    end.setHours(23, 59, 59, 999);

    // Get expenses
    const expenses = await prisma.expense.findMany({
      where: { 
        supplierId: parseInt(supplierId),
        date: { gte: start, lte: end }
      },
      include: {
        category: {
          select: {
            name: true
          }
        }
      },
      orderBy: { date: 'asc' }
    });

    // Get payments
    const payments = await prisma.supplierPayment.findMany({
      where: { 
        supplierId: parseInt(supplierId),
        createdAt: { gte: start, lte: end }
      },
      orderBy: { createdAt: 'asc' }
    });

    // Calculate running balance
    let balance = 0;
    const statement = [];

    // Combine and sort all transactions (opposite of client statement)
    const allTransactions = [
      // Expenses: what we owe the supplier (increases debt)
      ...expenses.map(expense => {
        const totalAmount = parseFloat(expense.amount);
        
        if (expense.isAdvance) {
          // Advance expenses: show as both debit and credit (like cash sales in client)
          return {
            type: 'advance',
            date: expense.date,
            reference: `EXPENSE-${expense.id}`,
            debit: totalAmount, // Full amount as debit (what we owe)
            credit: totalAmount, // Full amount as credit (advance payment)
            id: expense.id,
            clickable: true,
            expenseId: expense.id,
            description: expense.description || expense.category?.name || 'Dépense'
          };
        } else if (expense.isPaid) {
          // Paid expenses: show as both debit and credit (like cash sales in client)
          return {
            type: 'paid',
            date: expense.date,
            reference: `EXPENSE-${expense.id}`,
            debit: totalAmount, // Full amount as debit (what we owe)
            credit: totalAmount, // Full amount as credit (payment made)
            id: expense.id,
            clickable: true,
            expenseId: expense.id,
            description: expense.description || expense.category?.name || 'Dépense'
          };
        } else {
          // Unpaid expenses: show as credit only (like credit sales in client)
          return {
            type: 'unpaid',
            date: expense.date,
            reference: `EXPENSE-${expense.id}`,
            debit: 0,
            credit: totalAmount, // Unpaid amount as credit (what we owe)
            id: expense.id,
            clickable: true,
            expenseId: expense.id,
            description: expense.description || expense.category?.name || 'Dépense'
          };
        }
      }),
      // Supplier payments: reduce what we owe (like client payments)
      ...payments.map(payment => ({
        type: 'payment',
        date: payment.createdAt,
        reference: `PAYMENT-${payment.id}`,
        debit: parseFloat(payment.amount), // Payment reduces what we owe
        credit: 0,
        id: payment.id,
        clickable: true,
        description: payment.notes || 'Règlement fournisseur'
      }))
    ].sort((a, b) => new Date(a.date) - new Date(b.date));

    // Calculate running balance
    allTransactions.forEach(transaction => {
      balance += transaction.debit - transaction.credit;
      statement.push({
        ...transaction,
        balance: balance
      });
    });

    const totalDebit = statement.reduce((sum, item) => sum + item.debit, 0);
    const totalCredit = statement.reduce((sum, item) => sum + item.credit, 0);
    const currentBalance = balance;

    res.json({
      supplier,
      statement,
      totalDebit,
      totalCredit,
      currentBalance
    });
  } catch (error) {
    console.error('Error fetching supplier statement:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération du relevé fournisseur' });
  }
});

module.exports = router;
