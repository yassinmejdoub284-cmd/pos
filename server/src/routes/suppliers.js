const express = require('express');
const { prisma } = require('../lib/prisma');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// Get all suppliers
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { depotId } = req.query;
    
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
        return res.status(403).json({ error: 'Access denied: Cannot access other depot suppliers' });
      }
      // Deny if no depot available
      else if (!targetDepotId) {
        return res.status(400).json({ error: 'User must be assigned to a depot or specify depotId to view suppliers' });
      }
    }

    // Filter suppliers by depotId or by expenses in the target depot
    const suppliersWhere = {
      isActive: true
    };
    
    // If targetDepotId is specified, filter by depotId OR by expenses in that depot
    if (targetDepotId) {
      suppliersWhere.OR = [
        { depotId: targetDepotId },
        {
          expenses: {
            some: {
              depotId: targetDepotId
            }
          }
        }
      ];
    } else if (req.user?.role !== 'ADMIN' && userDepotId) {
      // For non-admin users without specified depot, show suppliers assigned to their depot or with expenses in their depot
      suppliersWhere.OR = [
        { depotId: userDepotId },
        {
          expenses: {
            some: {
              depotId: userDepotId
            }
          }
        }
      ];
    }
    
    const suppliers = await prisma.supplier.findMany({
      where: suppliersWhere,
      include: {
        expenses: {
          where: targetDepotId ? { depotId: targetDepotId } : (req.user?.role !== 'ADMIN' ? { depotId: userDepotId } : {}),
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
        },
        _count: {
          select: {
            debtTransactions: true,
            expenses: {
              where: targetDepotId ? { depotId: targetDepotId } : (req.user?.role !== 'ADMIN' ? { depotId: userDepotId } : {})
            },
            payments: true
          }
        }
      },
      orderBy: { name: 'asc' }
    });

    // Calculate financial information for each supplier using the same logic as supplier statement
    const suppliersWithFinancials = await Promise.all(suppliers.map(async (supplier) => {
      // Get ALL expenses and payments for this supplier (not just recent ones)
      // Filter expenses by depotId for isolation
      const expenseWhere = { supplierId: supplier.id };
      if (targetDepotId) {
        expenseWhere.depotId = targetDepotId;
      } else if (req.user?.role !== 'ADMIN') {
        expenseWhere.depotId = userDepotId;
      }
      
      const allExpenses = await prisma.expense.findMany({
        where: expenseWhere,
        select: { amount: true, isPaid: true, isAdvance: true, notes: true }
      });
      
      const allPayments = await prisma.supplierPayment.findMany({
        where: { supplierId: supplier.id },
        select: { amount: true, notes: true }
      });

      // Calculate totals using the same logic as the statement
      let totalDebit = 0;
      let totalCredit = 0;
      let currentDebt = 0;
      
      // Process all expenses using the same logic as statement
      allExpenses.forEach(expense => {
        const totalAmount = parseFloat(expense.amount);
        
        if (expense.isAdvance) {
          // Advance expenses: extract paid amount from notes
          let paidAmount = 0;
          if (expense.notes && expense.notes.includes('Paiement partiel:')) {
            const match = expense.notes.match(/Paiement partiel:\s*(\d+(?:\.\d+)?)dt payé/);
            if (match) {
              paidAmount = parseFloat(match[1]);
            }
          }
          totalDebit += paidAmount; // Advance amount paid
          totalCredit += totalAmount; // Full expense amount
          currentDebt += paidAmount - totalAmount; // debit - credit
        } else if (expense.isPaid) {
          // Paid expenses: show as both debit and credit
          totalDebit += totalAmount;
          totalCredit += totalAmount;
          currentDebt += totalAmount - totalAmount; // debit - credit = 0
        } else {
          // Unpaid expenses: show as credit only
          totalCredit += totalAmount;
          currentDebt += 0 - totalAmount; // debit - credit = -amount
        }
      });
      
      // Process all payments using the same logic as statement
      allPayments.forEach(payment => {
        const amount = parseFloat(payment.amount);
        const notes = payment.notes || '';
        
        // Extract bon d'entrée details from notes (same as statement logic)
        const bonMatch = notes.match(/Bon d'entrée #(\d+)/);
        const paidMatch = notes.match(/Payé: ([\d.]+) dt/);
        const totalMatch = notes.match(/Total: ([\d.]+) dt/);
        
        if (bonMatch && paidMatch && totalMatch) {
          // Partial payment with both paid amount and total amount (like statement)
          const paidAmount = parseFloat(paidMatch[1]);
          const totalAmount = parseFloat(totalMatch[1]);
          totalDebit += paidAmount;
          totalCredit += totalAmount;
          currentDebt += paidAmount - totalAmount; // debit - credit
        } else if (amount < 0) {
          // Full credit (no payment made) - like statement
          totalCredit += Math.abs(amount);
          currentDebt += 0 - Math.abs(amount); // debit - credit
        } else {
          // Regular payment - like statement
          totalDebit += amount;
          currentDebt += amount - 0; // debit - credit
        }
      });

      return {
        ...supplier,
        totalExpenses: allExpenses.reduce((sum, expense) => sum + parseFloat(expense.amount), 0),
        totalPayments: allPayments.reduce((sum, payment) => sum + parseFloat(payment.amount), 0),
        currentDebt: parseFloat(supplier.currentDebt) || 0, // Use the actual currentDebt from database (includes initial solde)
        recentExpenses: supplier.expenses.map(expense => ({
          ...expense,
          amount: Number(expense.amount),
          isPaid: false // For now, we'll consider expenses as unpaid if they have a debt
        }))
      };
    }));

    res.json(suppliersWithFinancials);
  } catch (error) {
    console.error('Error fetching suppliers:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des fournisseurs' });
  }
});

// Get supplier by ID
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
      return res.status(403).json({ error: 'Access denied: Cannot access other depot suppliers' });
    }
    
    const supplier = await prisma.supplier.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        expenses: {
          where: targetDepotId ? { depotId: targetDepotId } : (req.user?.role !== 'ADMIN' ? { depotId: userDepotId } : {}),
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
          orderBy: { date: 'desc' }
        }
      }
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
    const { name, contactName, email, phone, address, city, postalCode, taxNumber, paymentTerms, notes, depotId, currentDebt } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Le nom du fournisseur est requis' });
    }

    // Enforce depot isolation - use provided depotId for admin, or user's depotId for non-admin
    const userDepotId = req.user?.depotId;
    let targetDepotId = null;
    
    if (req.user?.role === 'ADMIN') {
      // Admin can choose depotId from request body (-1 means null, no depot assigned)
      targetDepotId = depotId ? (parseInt(depotId) === -1 ? null : parseInt(depotId)) : null;
    } else {
      // Non-admin users must use their assigned depotId
      if (!userDepotId) {
        return res.status(400).json({ error: 'User must be assigned to a depot to create suppliers' });
      }
      targetDepotId = userDepotId;
    }

    // Validate depot exists if depotId is provided
    if (targetDepotId) {
      const depot = await prisma.depot.findUnique({
        where: { id: targetDepotId }
      });
      if (!depot) {
        return res.status(400).json({ error: 'Invalid depot specified' });
      }
    }

    // Parse and validate currentDebt
    const initialDebt = currentDebt !== undefined && currentDebt !== null ? parseFloat(currentDebt) : 0;
    if (isNaN(initialDebt)) {
      return res.status(400).json({ error: 'Solde initial invalide' });
    }

    // Create supplier with initial debt
    const supplier = await prisma.$transaction(async (tx) => {
      const newSupplier = await tx.supplier.create({
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
          depotId: targetDepotId,
          currentDebt: initialDebt
        }
      });

      // Create a debt transaction to record the initial balance if not zero
      if (initialDebt !== 0) {
        const transactionType = initialDebt > 0 ? 'DEBT' : 'PAYMENT';
        const transactionAmount = Math.abs(initialDebt);
        
        await tx.supplierDebtTransaction.create({
          data: { 
            supplierId: newSupplier.id, 
            expenseId: null, 
            amount: transactionAmount, 
            type: transactionType, 
            notes: 'Solde de départ',
            userId: req.user?.id || null
          }
        });
      }

      return newSupplier;
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
    const { name, contactName, email, phone, address, city, postalCode, taxNumber, paymentTerms, notes, isActive, depotId } = req.body;
    
    // Enforce depot isolation - use provided depotId for admin, or user's depotId for non-admin
    const userDepotId = req.user?.depotId;
    let targetDepotId = undefined;
    
    if (req.user?.role === 'ADMIN' && depotId !== undefined) {
      // Admin can choose depotId from request body (-1 means null, no depot assigned)
      targetDepotId = parseInt(depotId) === -1 ? null : parseInt(depotId);
    } else if (req.user?.role !== 'ADMIN') {
      // Non-admin users must use their assigned depotId
      if (!userDepotId) {
        return res.status(400).json({ error: 'User must be assigned to a depot to update suppliers' });
      }
      targetDepotId = userDepotId;
    }

    // Validate depot exists if depotId is provided
    if (targetDepotId !== undefined && targetDepotId !== null) {
      const depot = await prisma.depot.findUnique({
        where: { id: targetDepotId }
      });
      if (!depot) {
        return res.status(400).json({ error: 'Invalid depot specified' });
      }
    }

    const updateData = {
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
    };

    // Only update depotId if it's provided (for admin) or set it to user's depot (for non-admin)
    if (targetDepotId !== undefined) {
      updateData.depotId = targetDepotId;
      }
    
    const supplier = await prisma.supplier.update({
      where: { id: parseInt(req.params.id) },
      data: updateData
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
    const { startDate, endDate, depotId } = req.query;
    
    // Enforce depot isolation
    const userDepotId = req.user?.depotId;
    const visitingDepotHeader = req.headers['x-depot-id'];
    const visitingDepotId = visitingDepotHeader ? parseInt(visitingDepotHeader) : null;
    const targetDepotId = depotId ? parseInt(depotId) : (visitingDepotId || userDepotId);
    
    // For non-admin users, check depot access
    if (req.user?.role !== 'ADMIN' && targetDepotId && userDepotId && targetDepotId !== userDepotId) {
      return res.status(403).json({ error: 'Access denied: Cannot access other depot suppliers' });
    }
    
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();
    end.setHours(23, 59, 59, 999);

    // Filter suppliers to only show those with expenses in the target depot
    const suppliersWhere = { isActive: true };
    if (targetDepotId) {
      suppliersWhere.expenses = {
        some: {
          depotId: targetDepotId
        }
      };
    } else if (req.user?.role !== 'ADMIN') {
      suppliersWhere.expenses = {
        some: {
          depotId: userDepotId
        }
      };
    }

    const suppliers = await prisma.supplier.findMany({
      where: suppliersWhere,
      include: {
        expenses: {
          where: {
            ...(targetDepotId ? { depotId: targetDepotId } : (req.user?.role !== 'ADMIN' ? { depotId: userDepotId } : {})),
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
            expenses: true,
            debtTransactions: true,
            payments: true
          }
        }
      }
    });

    const summaries = await Promise.all(suppliers.map(async (supplier) => {
      // Get ALL expenses and payments for this supplier (not just period ones)
      // Filter expenses by depotId for isolation
      const expenseWhere = { supplierId: supplier.id };
      if (targetDepotId) {
        expenseWhere.depotId = targetDepotId;
      } else if (req.user?.role !== 'ADMIN') {
        expenseWhere.depotId = userDepotId;
      }
      
      const allExpenses = await prisma.expense.findMany({
        where: expenseWhere,
        select: { amount: true, isPaid: true, isAdvance: true, notes: true }
      });
      
      const allPayments = await prisma.supplierPayment.findMany({
        where: { supplierId: supplier.id },
        select: { amount: true, notes: true }
      });

      // Calculate totals using the same logic as the statement
      let totalDebit = 0;
      let totalCredit = 0;
      let currentDebt = 0;
      
      // Process all expenses using the same logic as statement
      allExpenses.forEach(expense => {
        const totalAmount = parseFloat(expense.amount);
        
        if (expense.isAdvance) {
          // Advance expenses: extract paid amount from notes
          let paidAmount = 0;
          if (expense.notes && expense.notes.includes('Paiement partiel:')) {
            const match = expense.notes.match(/Paiement partiel:\s*(\d+(?:\.\d+)?)dt payé/);
            if (match) {
              paidAmount = parseFloat(match[1]);
            }
          }
          totalDebit += paidAmount; // Advance amount paid
          totalCredit += totalAmount; // Full expense amount
          currentDebt += paidAmount - totalAmount; // debit - credit
        } else if (expense.isPaid) {
          // Paid expenses: show as both debit and credit
          totalDebit += totalAmount;
          totalCredit += totalAmount;
          currentDebt += totalAmount - totalAmount; // debit - credit = 0
        } else {
          // Unpaid expenses: show as credit only
          totalCredit += totalAmount;
          currentDebt += 0 - totalAmount; // debit - credit = -amount
        }
      });
      
      // Process all payments using the same logic as statement
      allPayments.forEach(payment => {
        const amount = parseFloat(payment.amount);
        const notes = payment.notes || '';
        
        // Extract bon d'entrée details from notes (same as statement logic)
        const bonMatch = notes.match(/Bon d'entrée #(\d+)/);
        const paidMatch = notes.match(/Payé: ([\d.]+) dt/);
        const totalMatch = notes.match(/Total: ([\d.]+) dt/);
        
        if (bonMatch && paidMatch && totalMatch) {
          // Partial payment with both paid amount and total amount (like statement)
          const paidAmount = parseFloat(paidMatch[1]);
          const totalAmount = parseFloat(totalMatch[1]);
          totalDebit += paidAmount;
          totalCredit += totalAmount;
          currentDebt += paidAmount - totalAmount; // debit - credit
        } else if (amount < 0) {
          // Full credit (no payment made) - like statement
          totalCredit += Math.abs(amount);
          currentDebt += 0 - Math.abs(amount); // debit - credit
        } else {
          // Regular payment - like statement
          totalDebit += amount;
          currentDebt += amount - 0; // debit - credit
        }
      });

      return {
        id: supplier.id,
        name: supplier.name,
        currentDebt: currentDebt,
        totalExpenses: allExpenses.reduce((sum, expense) => sum + parseFloat(expense.amount), 0),
        periodExpenses: totalCredit, // Use calculated total credit
        periodPayments: totalDebit,  // Use calculated total debit
        periodDebts: totalCredit - totalDebit,
        periodBalance: totalCredit - totalDebit,
        _count: supplier._count
      };
    }));

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
    const { startDate, endDate, depotId } = req.query;

    // Enforce depot isolation
    const userDepotId = req.user?.depotId;
    const visitingDepotHeader = req.headers['x-depot-id'];
    const visitingDepotId = visitingDepotHeader ? parseInt(visitingDepotHeader) : null;
    const targetDepotId = depotId ? parseInt(depotId) : (visitingDepotId || userDepotId);
    
    // For non-admin users, check depot access
    if (req.user?.role !== 'ADMIN' && targetDepotId && userDepotId && targetDepotId !== userDepotId) {
      return res.status(403).json({ error: 'Access denied: Cannot access other depot suppliers' });
    }

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

    // Get expenses - filter by depotId
    const expensesWhere = { 
        supplierId: parseInt(supplierId),
        date: { gte: start, lte: end }
    };
    if (targetDepotId) {
      expensesWhere.depotId = targetDepotId;
    } else if (req.user?.role !== 'ADMIN') {
      expensesWhere.depotId = userDepotId;
    }
    
    const expenses = await prisma.expense.findMany({
      where: expensesWhere,
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

    // Get debt transactions
    const debtTransactions = await prisma.supplierDebtTransaction.findMany({
      where: { 
        supplierId: parseInt(supplierId),
        createdAt: { gte: start, lte: end }
      },
      select: {
        id: true,
        amount: true,
        type: true,
        notes: true,
        expenseId: true,
        createdAt: true
      },
      orderBy: { createdAt: 'asc' }
    });

    // Calculate running balance
    let balance = 0;
    const statement = [];

    // Combine and sort all transactions (opposite of client statement)
    const allTransactions = [
      // Debt transactions: standalone debt/payment adjustments
      ...debtTransactions.map(transaction => {
        const amount = parseFloat(transaction.amount);
        
        return {
          type: transaction.type.toLowerCase(),
          date: transaction.createdAt,
          reference: transaction.type === 'DEBT' ? `CREDIT-${transaction.id}` : `REGLEMENT-${transaction.id}`,
          debit: transaction.type === 'PAYMENT' ? amount : 0,
          credit: transaction.type === 'DEBT' ? amount : 0,
          id: transaction.id,
          clickable: transaction.type === 'PAYMENT',
          expenseId: transaction.expenseId,
          description: transaction.notes || ''
        };
      }),
      // Expenses: what we owe the supplier (increases debt)
      ...expenses.map(expense => {
        const totalAmount = parseFloat(expense.amount);
        
        if (expense.isAdvance) {
          // Advance expenses: extract paid amount from notes
          let paidAmount = 0;
          if (expense.notes && expense.notes.includes('Paiement partiel:')) {
            const match = expense.notes.match(/Paiement partiel:\s*(\d+(?:\.\d+)?)dt payé/);
            if (match) {
              paidAmount = parseFloat(match[1]);
            }
          }
          
          return {
            type: 'advance',
            date: expense.date,
            reference: `EXPENSE-${expense.id}`,
            debit: paidAmount, // Advance amount paid (reduces debt)
            credit: totalAmount, // Full expense amount (increases debt)
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
      ...payments.map(payment => {
        const amount = parseFloat(payment.amount);
        
        // Extract bon d'entrée ID from notes
        const bonMatch = payment.notes?.match(/Bon d'entrée #(\d+)/);
        const bonId = bonMatch ? bonMatch[1] : null;
        const reference = bonId ? `Bon d'entrée #${bonId}` : `PAYMENT-${payment.id}`;
        
        // Extract payment details from notes for partial payments
        const paidMatch = payment.notes?.match(/Payé: ([\d.]+) dt/);
        const totalMatch = payment.notes?.match(/Total: ([\d.]+) dt/);
        
        if (bonId && paidMatch && totalMatch) {
          // Partial payment with both paid amount and total amount
          const paidAmount = parseFloat(paidMatch[1]);
          const totalAmount = parseFloat(totalMatch[1]);
          
          return {
            type: 'bon_entree',
            date: payment.createdAt,
            reference: reference,
            debit: paidAmount, // Amount actually paid
            credit: totalAmount, // Total purchase amount
            id: payment.id,
            clickable: true,
            bonId: bonId,
            description: payment.notes || 'Bon d\'entrée'
          };
        } else if (amount < 0) {
          // Full credit (no payment made)
          return {
            type: 'credit',
            date: payment.createdAt,
            reference: reference,
            debit: 0,
            credit: Math.abs(amount), // Credit increases what we owe
            id: payment.id,
            clickable: true,
            bonId: bonId,
            description: payment.notes || 'Crédit fournisseur'
          };
        } else {
          // Regular payment (not from bon d'entrée)
          return {
            type: 'payment',
            date: payment.createdAt,
            reference: reference,
            debit: amount, // Payment reduces what we owe
            credit: 0,
            id: payment.id,
            clickable: true,
            bonId: bonId,
            description: payment.notes || 'Règlement fournisseur'
          };
        }
      })
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

// Initialize supplier solde (set currentDebt to custom amount)
router.post('/:id/solde/init', authenticateToken, requireRole(['ADMIN', 'MANAGER']), async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, notes } = req.body;

    const supplier = await prisma.supplier.findUnique({ 
      where: { id: parseInt(id) },
      include: {
        _count: {
          select: {
            debtTransactions: true,
            expenses: true,
            payments: true
          }
        }
      }
    });
    if (!supplier) return res.status(404).json({ error: 'Fournisseur introuvable' });

    // Check if supplier already has any movements (debt transactions, expenses, or payments)
    const hasAnyMovement = supplier._count.debtTransactions > 0 || 
                          supplier._count.expenses > 0 || 
                          supplier._count.payments > 0;
    
    if (hasAnyMovement) {
      return res.status(400).json({ error: 'Ce fournisseur a déjà des mouvements. Impossible de définir un solde de départ.' });
    }

    const newAmount = parseFloat(amount);
    if (isNaN(newAmount)) {
      return res.status(400).json({ error: 'Montant invalide' });
    }

    const currentDebt = parseFloat(supplier.currentDebt || 0);
    const difference = newAmount - currentDebt;

    const updated = await prisma.$transaction(async (tx) => {
      // Set currentDebt to the new amount
      const s = await tx.supplier.update({ 
        where: { id: supplier.id }, 
        data: { currentDebt: newAmount } 
      });
      
      // Create a debt transaction to record the initial balance
      if (difference !== 0) {
        const transactionType = difference > 0 ? 'DEBT' : 'PAYMENT';
        const transactionAmount = Math.abs(difference);
        
        await tx.supplierDebtTransaction.create({
          data: { 
            supplierId: supplier.id, 
            expenseId: null, 
            amount: transactionAmount, 
            type: transactionType, 
            notes: notes || 'Solde de départ',
            userId: req.user?.id || null
          }
        });
      }
      
      return s;
    });

    res.json(updated);
  } catch (error) {
    console.error('Error initializing supplier solde:', error);
    res.status(500).json({ error: 'Erreur lors de l\'initialisation du solde' });
  }
});

module.exports = router;
