const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken } = require('../middleware/auth');
const { AuditLogger } = require('../lib/audit');

const router = express.Router();
const prisma = new PrismaClient();

// Test endpoint to check database state
router.get('/test/db', async (req, res) => {
  try {
    const depots = await prisma.depot.findMany();
    const expenses = await prisma.expense.findMany({
      include: {
        depot: true,
        category: true,
        user: true
      }
    });
    const categories = await prisma.expenseCategory.findMany();

    res.json({
      depots: depots.map(d => ({ id: d.id, name: d.name, code: d.code })),
      expenses: expenses.map(e => ({
        id: e.id,
        amount: e.amount,
        depotId: e.depotId,
        depotName: e.depot.name,
        categoryId: e.categoryId,
        categoryName: e.category.name,
        description: e.description,
        userId: e.userId,
        userName: `${e.user.firstName} ${e.user.lastName}`
      })),
      categories: categories.map(c => ({ id: c.id, name: c.name })),
      totalExpenses: expenses.length
    });
  } catch (error) {
    console.error('Error in test endpoint:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all expense categories
router.get('/categories', async (req, res) => {
  try {
    const categories = await prisma.expenseCategory.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' }
    });
    res.json(categories);
  } catch (error) {
    console.error('Error fetching expense categories:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des catégories' });
  }
});

// Create new expense category
router.post('/categories', authenticateToken, async (req, res) => {
  try {
    const { name, description, color, icon } = req.body;

    if (!name) {
      return res.status(400).json({ 
        error: 'Le nom de la catégorie est requis' 
      });
    }

    const category = await prisma.expenseCategory.create({
      data: {
        name,
        description,
        color: color || '#3B82F6',
        icon: icon || '💰'
      }
    });

    await AuditLogger.logCreate('expense_categories', category.id, category, req.user.id, req);

    res.status(201).json(category);
  } catch (error) {
    console.error('Error creating expense category:', error);
    res.status(500).json({ error: 'Erreur lors de la création de la catégorie' });
  }
});

// Get all expenses with filters
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { 
      depotId, 
      categoryId, 
      startDate, 
      endDate, 
      page = 1, 
      limit = 20,
      status 
    } = req.query;

    const where = {};
    
    // Filter by user's depot if not admin/manager
    if (req.user.role !== 'ADMIN' && req.user.role !== 'MANAGER') {
      where.depotId = req.user.depotId;
    } else if (depotId) {
      where.depotId = parseInt(depotId);
    }
    
    if (categoryId) where.categoryId = parseInt(categoryId);
    if (status === 'approved') where.isApproved = true;
    if (status === 'pending') where.isApproved = false;
    
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) where.date.lte = new Date(endDate);
    }

    const skip = (page - 1) * limit;

    const [expenses, total] = await Promise.all([
      prisma.expense.findMany({
        where,
        include: {
          category: true,
          depot: true,
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              username: true
            }
          },
          approver: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              username: true
            }
          }
        },
        orderBy: { date: 'desc' },
        skip: parseInt(skip),
        take: parseInt(limit)
      }),
      prisma.expense.count({ where })
    ]);

    res.json({
      expenses,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching expenses:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des dépenses' });
  }
});

// Get expense by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const expense = await prisma.expense.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        category: true,
        depot: true,
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true
          }
        },
        approver: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true
          }
        }
      }
    });

    if (!expense) {
      return res.status(404).json({ error: 'Dépense non trouvée' });
    }

    // Check if user has access to this expense
    if (req.user.role !== 'ADMIN' && req.user.role !== 'MANAGER' && expense.depotId !== req.user.depotId) {
      return res.status(403).json({ error: 'Accès non autorisé' });
    }

    res.json(expense);
  } catch (error) {
    console.error('Error fetching expense:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération de la dépense' });
  }
});

// Create new expense
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { amount, description, categoryId, depotId, notes, receiptUrl, paymentType, date, collectionDate } = req.body;

    if (!amount || !description || !categoryId) {
      return res.status(400).json({ 
        error: 'Montant, description et catégorie sont requis' 
      });
    }

    // Use user's depot if not specified and user is not admin/manager
    const finalDepotId = depotId ? parseInt(depotId) : req.user.depotId;

    const expense = await prisma.expense.create({
      data: {
        amount: parseFloat(amount),
        description,
        categoryId: parseInt(categoryId),
        depotId: finalDepotId,
        userId: req.user.id,
        date: date ? new Date(date) : new Date(),
        paymentType: paymentType || 'CASH',
        collectionDate: collectionDate ? new Date(collectionDate) : new Date(),
        notes,
        receiptUrl,
        isApproved: false
      },
      include: {
        category: true,
        depot: true,
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true
          }
        }
      }
    });

    await AuditLogger.logCreate('expenses', expense.id, expense, req.user.id, req);

    res.status(201).json(expense);
  } catch (error) {
    console.error('Error creating expense:', error);
    res.status(500).json({ error: 'Erreur lors de la création de la dépense' });
  }
});

// Update expense
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { amount, description, categoryId, notes, receiptUrl } = req.body;
    const expenseId = parseInt(req.params.id);

    const existingExpense = await prisma.expense.findUnique({
      where: { id: expenseId },
      include: { user: true }
    });

    if (!existingExpense) {
      return res.status(404).json({ error: 'Dépense non trouvée' });
    }

    // Check if user has access to this expense
    if (req.user.role !== 'ADMIN' && req.user.role !== 'MANAGER' && existingExpense.depotId !== req.user.depotId) {
      return res.status(403).json({ error: 'Accès non autorisé' });
    }

    // Only allow updates if not approved
    if (existingExpense.isApproved) {
      return res.status(403).json({ 
        error: 'Impossible de modifier une dépense approuvée' 
      });
    }

    // Only allow user to update their own expenses unless admin/manager
    if (req.user.role !== 'ADMIN' && req.user.role !== 'MANAGER' && existingExpense.userId !== req.user.id) {
      return res.status(403).json({ 
        error: 'Vous ne pouvez modifier que vos propres dépenses' 
      });
    }

    const expense = await prisma.expense.update({
      where: { id: expenseId },
      data: {
        amount: amount ? parseFloat(amount) : undefined,
        description,
        categoryId: categoryId ? parseInt(categoryId) : undefined,
        notes,
        receiptUrl
      },
      include: {
        category: true,
        depot: true,
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true
          }
        }
      }
    });

    await AuditLogger.logUpdate('expenses', expense.id, existingExpense, expense, req.user.id, req);

    res.json(expense);
  } catch (error) {
    console.error('Error updating expense:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour de la dépense' });
  }
});

// Approve/reject expense
router.patch('/:id/approve', authenticateToken, async (req, res) => {
  try {
    const { isApproved } = req.body;
    const expenseId = parseInt(req.params.id);

    // Only admin and manager can approve expenses
    if (req.user.role !== 'ADMIN' && req.user.role !== 'MANAGER') {
      return res.status(403).json({ 
        error: 'Seuls les administrateurs et managers peuvent approuver les dépenses' 
      });
    }

    const existingExpense = await prisma.expense.findUnique({
      where: { id: expenseId }
    });

    if (!existingExpense) {
      return res.status(404).json({ error: 'Dépense non trouvée' });
    }

    // Check if user has access to this expense's depot
    if (req.user.role !== 'ADMIN' && existingExpense.depotId !== req.user.depotId) {
      return res.status(403).json({ error: 'Accès non autorisé' });
    }

    const expense = await prisma.expense.update({
      where: { id: expenseId },
      data: {
        isApproved,
        approvedBy: isApproved ? req.user.id : null,
        approvedAt: isApproved ? new Date() : null
      },
      include: {
        category: true,
        depot: true,
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true
          }
        },
        approver: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true
          }
        }
      }
    });

    await AuditLogger.logUpdate('expenses', expense.id, existingExpense, expense, req.user.id, req);

    res.json(expense);
  } catch (error) {
    console.error('Error approving expense:', error);
    res.status(500).json({ error: 'Erreur lors de l\'approbation de la dépense' });
  }
});

// Delete expense
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const expenseId = parseInt(req.params.id);

    const existingExpense = await prisma.expense.findUnique({
      where: { id: expenseId },
      include: { user: true }
    });

    if (!existingExpense) {
      return res.status(404).json({ error: 'Dépense non trouvée' });
    }

    // Check if user has access to this expense
    if (req.user.role !== 'ADMIN' && req.user.role !== 'MANAGER' && existingExpense.depotId !== req.user.depotId) {
      return res.status(403).json({ error: 'Accès non autorisé' });
    }

    // Only allow deletion if not approved
    if (existingExpense.isApproved) {
      return res.status(403).json({ 
        error: 'Impossible de supprimer une dépense approuvée' 
      });
    }

    // Only allow user to delete their own expenses unless admin/manager
    if (req.user.role !== 'ADMIN' && req.user.role !== 'MANAGER' && existingExpense.userId !== req.user.id) {
      return res.status(403).json({ 
        error: 'Vous ne pouvez supprimer que vos propres dépenses' 
      });
    }

    await prisma.expense.delete({
      where: { id: expenseId }
    });

    await AuditLogger.logDelete('expenses', expenseId, existingExpense, req.user.id, req);

    res.json({ message: 'Dépense supprimée avec succès' });
  } catch (error) {
    console.error('Error deleting expense:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression de la dépense' });
  }
});

// Get expense statistics
router.get('/stats/summary', authenticateToken, async (req, res) => {
  try {
    const { depotId, startDate, endDate } = req.query;

    const where = {};
    
    // Filter by user's depot if not admin/manager
    if (req.user.role !== 'ADMIN' && req.user.role !== 'MANAGER') {
      where.depotId = req.user.depotId;
    } else if (depotId) {
      where.depotId = parseInt(depotId);
    }
    
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) where.date.lte = new Date(endDate);
    }

    // First, let's check if there are any expenses at all
    const totalExpensesCount = await prisma.expense.count();

    // Check expenses without any filters
    const allExpenses = await prisma.expense.findMany({
      take: 5,
      include: {
        depot: true,
        category: true
      }
    });

    const [totalExpenses, approvedExpenses, pendingExpenses, categoryStats] = await Promise.all([
      prisma.expense.aggregate({
        where,
        _sum: { amount: true },
        _count: true
      }),
      prisma.expense.aggregate({
        where: { ...where, isApproved: true },
        _sum: { amount: true },
        _count: true
      }),
      prisma.expense.aggregate({
        where: { ...where, isApproved: false },
        _sum: { amount: true },
        _count: true
      }),
      prisma.expense.groupBy({
        by: ['categoryId'],
        where,
        _sum: { amount: true },
        _count: true
      })
    ]);



    // Get category details for stats
    const categoryDetails = await prisma.expenseCategory.findMany({
      where: { id: { in: categoryStats.map(stat => stat.categoryId) } }
    });

    const categoryStatsWithDetails = categoryStats.map(stat => {
      const category = categoryDetails.find(cat => cat.id === stat.categoryId);
      return {
        categoryId: stat.categoryId,
        categoryName: category?.name || 'Inconnu',
        categoryColor: category?.color,
        categoryIcon: category?.icon,
        totalAmount: stat._sum.amount || 0,
        count: stat._count
      };
    });

    res.json({
      total: {
        amount: totalExpenses._sum.amount || 0,
        count: totalExpenses._count
      },
      approved: {
        amount: approvedExpenses._sum.amount || 0,
        count: approvedExpenses._count
      },
      pending: {
        amount: pendingExpenses._sum.amount || 0,
        count: pendingExpenses._count
      },
      byCategory: categoryStatsWithDetails
    });
  } catch (error) {
    console.error('Error fetching expense statistics:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des statistiques' });
  }
});

module.exports = router; 