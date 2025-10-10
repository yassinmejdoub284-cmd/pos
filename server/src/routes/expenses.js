const express = require('express');
const { prisma } = require('../lib/prisma');
const fs = require('fs');
const path = require('path');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { AuditLogger } = require('../lib/audit');
const { sendPushToAll } = require('../lib/push');

const router = express.Router();

// Settings fallback (file) - mirror settings route behavior
const SETTINGS_FILE = path.join(__dirname, '../../uploads/app-settings.json');
function readFileSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const raw = fs.readFileSync(SETTINGS_FILE, 'utf-8');
      const parsed = JSON.parse(raw || '{}');
      // Normalize number field possibly stored as string
      if (parsed && typeof parsed.autoApproveExpenseBelow !== 'undefined') {
        const n = Number(parsed.autoApproveExpenseBelow);
        parsed.autoApproveExpenseBelow = isNaN(n) ? 0 : n;
      }
      return parsed;
    }
  } catch {}
  return {};
}

async function getAutoApproveThreshold() {
  // Try DB first
  try {
    if (prisma.appSettings && typeof prisma.appSettings.findFirst === 'function') {
      const settings = await prisma.appSettings.findFirst();
      if (settings && typeof settings.autoApproveExpenseBelow !== 'undefined') {
        const n = Number(settings.autoApproveExpenseBelow);
        console.log('[settings] source=database autoApproveExpenseBelow=', n);
        return isNaN(n) ? 0 : n;
      }
    }
  } catch {}
  // Fallback to file settings
  const fileSettings = readFileSettings();
  const n = Number(fileSettings.autoApproveExpenseBelow);
  console.log('[settings] source=file autoApproveExpenseBelow=', n);
  return isNaN(n) ? 0 : n;
}

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

// Update expense category
router.put('/categories/:id', authenticateToken, requireRole(['ADMIN', 'MANAGER']), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, color, icon, isActive } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Le nom de la catégorie est requis' });
    }

    const category = await prisma.expenseCategory.update({
      where: { id: parseInt(id) },
      data: {
        name,
        description,
        color,
        icon,
        isActive: isActive !== undefined ? isActive : true
      }
    });

    await AuditLogger.logUpdate('expense_categories', category.id, category, req.user.id, req);

    res.json(category);
  } catch (error) {
    console.error('Error updating expense category:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour de la catégorie' });
  }
});

// Delete expense category
router.delete('/categories/:id', authenticateToken, requireRole(['ADMIN', 'MANAGER']), async (req, res) => {
  try {
    const { id } = req.params;

    // Check if category has expenses
    const expenseCount = await prisma.expense.count({
      where: { categoryId: parseInt(id) }
    });

    if (expenseCount > 0) {
      return res.status(400).json({ 
        error: 'Impossible de supprimer une catégorie qui contient des dépenses' 
      });
    }

    await prisma.expenseCategory.delete({
      where: { id: parseInt(id) }
    });

    await AuditLogger.logDelete('expense_categories', parseInt(id), req.user.id, req);

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting expense category:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression de la catégorie' });
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
    const { amount, categoryId, depotId, notes, receiptUrl, paymentType, date, collectionDate, supplierId, isPaid, isAdvance } = req.body;

    if (!amount || !categoryId) {
      return res.status(400).json({ 
        error: 'Montant et catégorie sont requis' 
      });
    }

    // Use user's depot if not specified and user is not admin/manager
    const finalDepotId = depotId ? parseInt(depotId) : req.user.depotId;

    // Fetch approval threshold from settings (DB then file fallback)
    const autoApproveThreshold = await getAutoApproveThreshold();

    const numericAmount = Number(amount);
    const isAutoApproved = !isNaN(numericAmount) && numericAmount <= autoApproveThreshold;
    console.log('[expenses.create] amount=', numericAmount, 'threshold=', autoApproveThreshold, 'isAutoApproved=', isAutoApproved);

    const expense = await prisma.$transaction(async (tx) => {
      // Create the expense
      const newExpense = await tx.expense.create({
        data: {
          amount: isNaN(numericAmount) ? 0 : numericAmount,
          categoryId: parseInt(categoryId),
          depotId: finalDepotId,
          userId: req.user.id,
          date: date ? new Date(date) : new Date(),
          paymentType: paymentType || 'CASH',
          collectionDate: collectionDate ? new Date(collectionDate) : new Date(),
          notes,
          receiptUrl,
          isApproved: isAutoApproved,
          approvedBy: isAutoApproved ? req.user.id : null,
          approvedAt: isAutoApproved ? new Date() : null,
          // Temporary fallback for legacy schema requiring description
          description: '',
          // Optional supplier linkage
          supplierId: supplierId ? parseInt(supplierId) : null,
          // New payment status fields
          isPaid: isPaid || false,
          isAdvance: isAdvance || false
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

      // If expense is marked as advance and linked to a supplier, automatically create a supplier payment
      if (isAdvance && supplierId && parseInt(supplierId)) {
        const supplierPayment = await tx.supplierPayment.create({
          data: {
            supplierId: parseInt(supplierId),
            amount: isNaN(numericAmount) ? 0 : numericAmount,
            notes: `Acompte automatique - Dépense: ${newExpense.category?.name || 'N/A'}${notes ? ` - ${notes}` : ''}`,
            userId: req.user.id,
            paymentDate: new Date()
          }
        });
        console.log('[expenses.create] Auto-created supplier payment for advance:', supplierPayment.id, 'for supplier:', supplierId, 'amount:', numericAmount);
      }

      // If CASH expense is auto-approved, create a linked cash movement in the creator's active session
      try {
        if (isAutoApproved && (paymentType || 'CASH').toUpperCase() === 'CASH') {
          const activeSession = await tx.sessionCaisse.findFirst({
            where: { userId: req.user.id, status: 'OPEN' },
            orderBy: { openedAt: 'desc' }
          });
          if (activeSession) {
            await tx.cashMovement.create({
              data: {
                sessionId: activeSession.id,
                type: 'SORTIE',
                amount: isNaN(numericAmount) ? 0 : numericAmount,
                reason: `Dépense #${newExpense.id} (auto): ${newExpense.category?.name || 'Divers'}`,
                createdById: req.user.id
              }
            });
          }
        }
      } catch (e) {
        console.warn('[expenses.create] Failed to create cash movement for expense', e);
      }

      return newExpense;
    });

    await AuditLogger.logCreate('expenses', expense.id, expense, req.user.id, req);

    // Send push notification for all expenses
    try {
      await sendPushToAll({
        title: 'Nouvelle Dépense',
        body: `Dépense de ${expense.amount} TND - ${expense.category?.name || 'Divers'} par ${req.user.firstName} ${req.user.lastName}`,
        data: { type: 'EXPENSE', id: expense.id, depotId: expense.depotId }
      });
      console.log('[expenses.create] Push notification sent for expense:', expense.id);
    } catch (e) {
      console.warn('[expenses.create] Failed to send push notification:', e);
    }

    res.status(201).json(expense);
  } catch (error) {
    console.error('Error creating expense:', error);
    res.status(500).json({ error: 'Erreur lors de la création de la dépense' });
  }
});

// Update expense
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { amount, categoryId, notes, receiptUrl, supplierId, description } = req.body;
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
        categoryId: categoryId ? parseInt(categoryId) : undefined,
        notes,
        receiptUrl,
        // Optional supplier linkage update
        supplierId: supplierId !== undefined ? (supplierId ? parseInt(supplierId) : null) : undefined,
        description: description !== undefined ? description : undefined
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

    // If approving a CASH expense, create a cash movement in the creator's active session
    try {
      if (isApproved && (existingExpense.paymentType || 'CASH').toUpperCase() === 'CASH') {
        const activeSession = await prisma.sessionCaisse.findFirst({
          where: { userId: existingExpense.userId, status: 'OPEN' },
          orderBy: { openedAt: 'desc' }
        });
        if (activeSession) {
          await prisma.cashMovement.create({
            data: {
              sessionId: activeSession.id,
              type: 'SORTIE',
              amount: parseFloat(existingExpense.amount),
              reason: `Dépense approuvée #${existingExpense.id}: ${expense.category?.name || 'Divers'}`,
              createdById: req.user.id
            }
          });
        }
      }
    } catch (e) {
      console.warn('[expenses.approve] Failed to create cash movement for approved expense', e);
    }

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