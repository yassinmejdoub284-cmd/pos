const express = require('express');
const { prisma } = require('../lib/prisma');
const fs = require('fs');
const path = require('path');
const { authenticateToken } = require('../middleware/auth');
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

        return isNaN(n) ? 0 : n;
      }
    }
  } catch {}
  // Fallback to file settings
  const fileSettings = readFileSettings();
  const n = Number(fileSettings.autoApproveExpenseBelow);

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

    await AuditLogger.logCreate('expense_categories', category.id, category, req.user?.id, req);

    res.status(201).json(category);
  } catch (error) {
    console.error('Error creating expense category:', error);
    res.status(500).json({ error: 'Erreur lors de la création de la catégorie' });
  }
});

// Update expense category
router.put('/categories/:id', authenticateToken, async (req, res) => {
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

    await AuditLogger.logUpdate('expense_categories', category.id, category, req.user?.id, req);

    res.json(category);
  } catch (error) {
    console.error('Error updating expense category:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour de la catégorie' });
  }
});

// Delete expense category
router.delete('/categories/:id', authenticateToken, async (req, res) => {
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

    await AuditLogger.logDelete('expense_categories', parseInt(id), req.user?.id, req);

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
    
    // Enforce depot isolation - use user's depot, visiting depot, or provided depot
    const userDepotId = req.user?.depotId;
    const visitingDepotHeader = req.headers['x-depot-id'];
    const visitingDepotId = visitingDepotHeader ? parseInt(visitingDepotHeader) : null;
    
    // Determine which depot to use: requested > visiting > user's depot
    let targetDepotId = depotId ? parseInt(depotId) : (visitingDepotId || userDepotId);
    
    // For non-admin users, check depot access
    if (req.user?.role !== 'ADMIN') {
      // Allow if accessing own depot
      if (targetDepotId && userDepotId && targetDepotId === userDepotId) {
        // OK - accessing own depot
      }
      // Allow if accessing visiting depot (for MANAGER/CASHIER with visiting depot header)
      else if (targetDepotId && visitingDepotId && targetDepotId === visitingDepotId) {
        // OK - accessing visiting depot
      }
      // Allow if user has no depot assigned but valid depot is requested
      else if (!userDepotId && targetDepotId) {
        // Check if depot exists and is active
        const depot = await prisma.depot.findFirst({
          where: { id: targetDepotId, isActive: true }
        });
        if (!depot) {
          return res.status(403).json({ error: 'Invalid depot specified' });
      }
        // Allow access for users without assigned depot (like RESPONSABLE_MAGASIN)
      }
      // Deny if trying to access different depot
      else if (targetDepotId && userDepotId && targetDepotId !== userDepotId) {
        return res.status(403).json({ error: 'Access denied: Cannot access other depot expenses' });
      }
      // Deny if no depot available
      else if (!targetDepotId) {
        return res.status(400).json({ error: 'User must be assigned to a depot or specify depotId to view expenses' });
      }
    }
    
    if (targetDepotId) {
      where.depotId = targetDepotId;
    } else if (req.user?.role !== 'ADMIN') {
      // Non-admin users without depot assigned cannot view expenses
      return res.status(400).json({ error: 'User must be assigned to a depot to view expenses' });
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
          },
          rejecter: {
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

    // Convert Decimal amounts to numbers for proper serialization
    const expensesWithNumbers = expenses.map(expense => ({
      ...expense,
      amount: expense.amount ? parseFloat(expense.amount.toString()) : 0
    }));

    res.json({
      expenses: expensesWithNumbers,
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
    const { depotId } = req.query;
    
    // Enforce depot isolation
    const userDepotId = req.user?.depotId;
    const visitingDepotHeader = req.headers['x-depot-id'];
    const visitingDepotId = visitingDepotHeader ? parseInt(visitingDepotHeader) : null;
    const targetDepotId = depotId ? parseInt(depotId) : (visitingDepotId || userDepotId);
    
    // For non-admin users, check depot access
    if (req.user?.role !== 'ADMIN' && targetDepotId && userDepotId && targetDepotId !== userDepotId) {
      return res.status(403).json({ error: 'Access denied: Cannot access other depot expenses' });
    }
    
    const expense = await prisma.expense.findFirst({
      where: { 
        id: parseInt(req.params.id),
        ...(targetDepotId ? { depotId: targetDepotId } : (req.user?.role === 'ADMIN' ? {} : { depotId: userDepotId }))
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
        },
        rejecter: {
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
    if (req.user?.role !== 'ADMIN' && req.user?.role !== 'MANAGER' && expense.depotId !== req.user?.depotId) {
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
    const { amount, categoryId, depotId, notes, receiptUrl, paymentType, date, collectionDate, supplierId, isPaid, isAdvance, paidAmount } = req.body;

    if (!amount || !categoryId) {
      return res.status(400).json({ 
        error: 'Montant et catégorie sont requis' 
      });
    }

    // Enforce depot isolation - use provided depotId for admin, or user's depotId for non-admin
    const userDepotId = req.user?.depotId;
    let finalDepotId;
    
    if (req.user?.role === 'ADMIN') {
      // Admin can choose depotId from request body
    if (depotId) {
      finalDepotId = parseInt(depotId);
      if (isNaN(finalDepotId)) {
        return res.status(400).json({ error: 'ID de dépôt invalide' });
      }
        // Validate depot exists
        const depot = await prisma.depot.findUnique({
          where: { id: finalDepotId }
        });
        if (!depot) {
          return res.status(400).json({ error: 'Dépôt spécifié n\'existe pas' });
        }
    } else {
        // Admin without depotId specified uses their assigned depot or returns error
        if (!userDepotId) {
          return res.status(400).json({ error: 'Veuillez spécifier un dépôt ou assigner un dépôt à l\'utilisateur' });
        }
        finalDepotId = userDepotId;
      }
    } else {
      // Non-admin users must use their assigned depotId
      if (!userDepotId) {
        return res.status(400).json({ error: 'Utilisateur non assigné à un dépôt' });
      }
      // Non-admin users cannot override depotId - always use their assigned depot
      finalDepotId = userDepotId;
    }

    // Fetch approval threshold from settings (DB then file fallback)
    const autoApproveThreshold = await getAutoApproveThreshold();

    const numericAmount = Number(amount);
    const isAutoApproved = !isNaN(numericAmount) && numericAmount <= autoApproveThreshold;


    const expense = await prisma.$transaction(async (tx) => {
      // Create the expense
      const newExpense = await tx.expense.create({
        data: {
          amount: isNaN(numericAmount) ? 0 : numericAmount,
          categoryId: parseInt(categoryId),
          depotId: finalDepotId,
          userId: req.user?.id,
          date: date ? new Date(date) : new Date(),
          paymentType: paymentType || 'CASH',
          collectionDate: collectionDate ? new Date(collectionDate) : new Date(),
          notes,
          receiptUrl,
          isApproved: isAutoApproved,
          approvedBy: isAutoApproved ? req.user?.id : null,
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

      // Note: Advance payments are now handled directly in the expense statement logic
      // No need to create separate supplier payment entries for advances

      // Create cash movement immediately if payment is made now (payNow = true) and payment type is CASH
      try {
        const shouldCreateCashMovement = (paymentType || 'CASH').toUpperCase() === 'CASH' && 
                                       (req.body.payNow !== false); // Default to true if not specified
        
        if (shouldCreateCashMovement) {
          // Find active session for the depot (not just user)
          const activeSession = await tx.sessionCaisse.findFirst({
            where: { 
              depotId: finalDepotId,
              status: 'OPEN' 
            },
            orderBy: { openedAt: 'desc' }
          });
          if (activeSession) {
            // For partial payments (advance), we need to calculate the actual amount to deduct
            // If it's an advance payment, we'll use the paidAmount from the request
            // Otherwise, use the full amount
            let cashMovementAmount = isNaN(numericAmount) ? 0 : numericAmount;
            
            // If it's an advance payment and we have a paidAmount, use that instead
            if (isAdvance && paidAmount) {
              cashMovementAmount = parseFloat(paidAmount);
            }
            
            if (cashMovementAmount > 0) {
              await tx.cashMovement.create({
                data: {
                  sessionId: activeSession.id,
                  type: 'SORTIE',
                  amount: cashMovementAmount,
                  reason: `Dépense #${newExpense.id}: ${newExpense.category?.name || 'Divers'}${isAdvance && paidAmount ? ` (Acompte: ${paidAmount}dt)` : ''}`,
                  createdById: req.user?.id
                }
              });

            }
          } else {
            console.warn('[expenses.create] No active session found for cash movement');
          }
        }
      } catch (e) {
        console.warn('[expenses.create] Failed to create cash movement for expense', e);
      }

      return newExpense;
    });

    await AuditLogger.logCreate('expenses', expense.id, expense, req.user?.id, req);

    // Send push notification for all expenses
    try {
      await sendPushToAll({
        title: 'Nouvelle Dépense',
        body: `Dépense de ${expense.amount} DT - ${expense.category?.name || 'Divers'} par ${req.user.firstName} ${req.user.lastName}`,
        data: { type: 'EXPENSE', id: expense.id, depotId: expense.depotId }
      });

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
    if (req.user?.role !== 'ADMIN' && req.user?.role !== 'MANAGER' && existingExpense.depotId !== req.user?.depotId) {
      return res.status(403).json({ error: 'Accès non autorisé' });
    }

    // Only allow updates if not approved
    if (existingExpense.isApproved) {
      return res.status(403).json({ 
        error: 'Impossible de modifier une dépense approuvée' 
      });
    }

    // Only allow user to update their own expenses unless admin/manager
    if (req.user?.role !== 'ADMIN' && req.user?.role !== 'MANAGER' && existingExpense.userId !== req.user?.id) {
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

    await AuditLogger.logUpdate('expenses', expense.id, existingExpense, expense, req.user?.id, req);

    res.json(expense);
  } catch (error) {
    console.error('Error updating expense:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour de la dépense' });
  }
});

// Approve/reject expense
router.patch('/:id/approve', authenticateToken, async (req, res) => {
  try {
    const { isApproved, rejectionNotes } = req.body;
    const expenseId = parseInt(req.params.id);

    // Only admin and manager can approve expenses
    if (req.user?.role !== 'ADMIN' && req.user?.role !== 'MANAGER') {
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
    if (req.user?.role !== 'ADMIN' && existingExpense.depotId !== req.user?.depotId) {
      return res.status(403).json({ error: 'Accès non autorisé' });
    }

    // Prepare update data
    const updateData = {
      isApproved,
      approvedBy: isApproved ? req.user?.id : null,
      approvedAt: isApproved ? new Date() : null
    };

    // If rejecting, set rejection fields
    if (!isApproved) {
      updateData.isRejected = true;
      updateData.rejectedAt = new Date();
      updateData.rejectedBy = req.user?.id;
      updateData.rejectionNotes = rejectionNotes || null;
      // Clear approval fields if rejecting
      updateData.approvedBy = null;
      updateData.approvedAt = null;
    } else {
      // If approving, clear rejection fields
      updateData.isRejected = false;
      updateData.rejectedAt = null;
      updateData.rejectedBy = null;
      updateData.rejectionNotes = null;
    }

    const expense = await prisma.expense.update({
      where: { id: expenseId },
      data: updateData,
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
        },
        rejecter: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true
          }
        }
      }
    });

    await AuditLogger.logUpdate('expenses', expense.id, existingExpense, expense, req.user?.id, req);

    // Handle cash movements for rejected expenses
    if (!isApproved && (existingExpense.paymentType || 'CASH').toUpperCase() === 'CASH') {
      try {
        // Find and mark cash movements from this expense as invalid
        const expenseRegex = new RegExp(`Dépense(?: approuvée)? #${existingExpense.id}(?::|$)`, 'i');
        const cashMovements = await prisma.cashMovement.findMany({
          where: {
            reason: {
              contains: `Dépense #${existingExpense.id}`
            }
          }
        });

        // Mark cash movements as invalid by updating the reason
        for (const movement of cashMovements) {
          await prisma.cashMovement.update({
            where: { id: movement.id },
            data: {
              reason: `[REJETÉ] ${movement.reason}`,
              // Add a flag to indicate this movement should be excluded from calculations
              amount: 0 // Set amount to 0 to effectively exclude it from calculations
            }
          });
        }

      } catch (e) {
        console.warn('[expenses.reject] Failed to handle cash movements for rejected expense', e);
      }
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
      include: { 
        user: true,
        category: true
      }
    });

    if (!existingExpense) {
      return res.status(404).json({ error: 'Dépense non trouvée' });
    }

    // Check if user has access to this expense
    if (req.user?.role !== 'ADMIN' && req.user?.role !== 'MANAGER' && existingExpense.depotId !== req.user?.depotId) {
      return res.status(403).json({ error: 'Accès non autorisé' });
    }

    // Only admin can delete approved expenses
    if (existingExpense.isApproved && req.user?.role !== 'ADMIN') {
      return res.status(403).json({ 
        error: 'Seuls les administrateurs peuvent supprimer une dépense approuvée' 
      });
    }

    // Only allow user to delete their own expenses unless admin/manager
    if (req.user?.role !== 'ADMIN' && req.user?.role !== 'MANAGER' && existingExpense.userId !== req.user?.id) {
      return res.status(403).json({ 
        error: 'Vous ne pouvez supprimer que vos propres dépenses' 
      });
    }

    // Check if this is a cash expense that needs refund
    const isCashExpense = (existingExpense.paymentType || 'CASH').toUpperCase() === 'CASH';
    const wasPaid = existingExpense.isPaid || existingExpense.isAdvance;
    const expenseAmount = parseFloat(existingExpense.amount || 0);
    
    // Find the session where this expense was created (if any)
    let refundSessionId = null;
    if (isCashExpense && wasPaid && expenseAmount > 0) {
      // Find cash movements related to this expense
      const relatedMovements = await prisma.cashMovement.findMany({
        where: {
          reason: {
            contains: `Dépense #${expenseId}`
          },
          type: 'SORTIE'
        },
        include: {
          session: true
        },
        orderBy: { createdAt: 'desc' }
      });

      // Find the most recent closed session that contains this expense
      if (relatedMovements.length > 0) {
        // Get the session from the movement
        const movement = relatedMovements[0];
        if (movement.session) {
          refundSessionId = movement.session.id;
        }
      }
      
      // If no movement found, try to find the session by date range
      if (!refundSessionId) {
        const expenseDate = new Date(existingExpense.createdAt);
        const session = await prisma.sessionCaisse.findFirst({
          where: {
            depotId: existingExpense.depotId,
            openedAt: { lte: expenseDate },
            OR: [
              { closedAt: { gte: expenseDate } },
              { status: 'CLOSED', closedAt: { gte: expenseDate } }
            ]
          },
          orderBy: { closedAt: 'desc' }
        });
        if (session) {
          refundSessionId = session.id;
        }
      }
    }

    // Delete the expense and handle refund in a transaction
    await prisma.$transaction(async (tx) => {
      // Create refund cash movement if needed
      if (isCashExpense && wasPaid && expenseAmount > 0 && refundSessionId) {
        // Check if session is closed
        const session = await tx.sessionCaisse.findUnique({
          where: { id: refundSessionId }
        });

        if (session && session.status === 'CLOSED') {
          // Create ENTREE (refund) cash movement
          const refundAmount = existingExpense.isAdvance && existingExpense.paidAmount 
            ? parseFloat(existingExpense.paidAmount) 
            : expenseAmount;

          await tx.cashMovement.create({
            data: {
              sessionId: refundSessionId,
              type: 'ENTREE',
              amount: refundAmount,
              reason: `Remboursement - Dépense supprimée #${expenseId}: ${existingExpense.category?.name || 'Divers'}`,
              createdById: req.user?.id
            }
          });

        }
      }

      // Delete related cash movements (mark as invalid)
      const expenseRegex = new RegExp(`Dépense(?: approuvée)? #${expenseId}(?::|$)`, 'i');
      const relatedMovements = await tx.cashMovement.findMany({
        where: {
          reason: {
            contains: `Dépense #${expenseId}`
          }
        }
      });

      // Mark cash movements as invalid by updating the reason
      for (const movement of relatedMovements) {
        await tx.cashMovement.update({
          where: { id: movement.id },
          data: {
            reason: `[SUPPRIMÉ] ${movement.reason}`,
            amount: 0 // Set amount to 0 to effectively exclude it from calculations
          }
        });
      }

      // Delete the expense
      await tx.expense.delete({
        where: { id: expenseId }
      });
    });

    await AuditLogger.logDelete('expenses', expenseId, existingExpense, req.user?.id, req);

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
    
    // Enforce depot isolation - use user's depot, visiting depot, or provided depot
    const userDepotId = req.user?.depotId;
    const visitingDepotHeader = req.headers['x-depot-id'];
    const visitingDepotId = visitingDepotHeader ? parseInt(visitingDepotHeader) : null;
    
    // Determine which depot to use: requested > visiting > user's depot
    let targetDepotId = depotId ? parseInt(depotId) : (visitingDepotId || userDepotId);
    
    // For non-admin users, check depot access
    if (req.user?.role !== 'ADMIN') {
      // Allow if accessing own depot
      if (targetDepotId && userDepotId && targetDepotId === userDepotId) {
        // OK - accessing own depot
      }
      // Allow if accessing visiting depot (for MANAGER/CASHIER with visiting depot header)
      else if (targetDepotId && visitingDepotId && targetDepotId === visitingDepotId) {
        // OK - accessing visiting depot
      }
      // Allow if user has no depot assigned but valid depot is requested
      else if (!userDepotId && targetDepotId) {
        // Check if depot exists and is active
        const depot = await prisma.depot.findFirst({
          where: { id: targetDepotId, isActive: true }
        });
        if (!depot) {
          return res.status(403).json({ error: 'Invalid depot specified' });
      }
        // Allow access for users without assigned depot (like RESPONSABLE_MAGASIN)
      }
      // Deny if trying to access different depot
      else if (targetDepotId && userDepotId && targetDepotId !== userDepotId) {
        return res.status(403).json({ error: 'Access denied: Cannot access other depot expenses' });
      }
      // Deny if no depot available
      else if (!targetDepotId) {
        return res.status(400).json({ error: 'User must be assigned to a depot or specify depotId to view expenses' });
      }
    }
    
    if (targetDepotId) {
      where.depotId = targetDepotId;
    } else if (req.user?.role !== 'ADMIN') {
      // Non-admin users without depot assigned cannot view expenses
      return res.status(400).json({ error: 'User must be assigned to a depot to view expenses' });
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