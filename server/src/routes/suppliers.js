const express = require('express');
const { prisma } = require('../lib/prisma');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

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
        },
        _count: {
          select: {
            debtTransactions: true,
            expenses: true,
            payments: true
          }
        }
      },
      orderBy: { name: 'asc' }
    });

    // Calculate financial information for each supplier using the same logic as supplier statement
    const suppliersWithFinancials = await Promise.all(suppliers.map(async (supplier) => {
      // Get ALL expenses and payments for this supplier (not just recent ones)
      const allExpenses = await prisma.expense.findMany({
        where: { supplierId: supplier.id },
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
        currentDebt: currentDebt, // Use the calculated balance from statement logic
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
            expenses: true,
            debtTransactions: true,
            payments: true
          }
        }
      }
    });

    const summaries = await Promise.all(suppliers.map(async (supplier) => {
      // Get ALL expenses and payments for this supplier (not just period ones)
      const allExpenses = await prisma.expense.findMany({
        where: { supplierId: supplier.id },
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
