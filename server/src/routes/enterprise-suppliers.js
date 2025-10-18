const express = require('express');
const { prisma } = require('../lib/prisma');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// Get all suppliers for a specific enterprise
router.get('/:enterpriseId', authenticateToken, async (req, res) => {
  try {
    const { enterpriseId } = req.params;
    
    const suppliers = await prisma.supplier.findMany({
      where: { 
        isActive: true,
        enterpriseId: parseInt(enterpriseId)
      },
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
    console.error('Error fetching enterprise suppliers:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des fournisseurs de l\'entreprise' });
  }
});

// Get supplier by ID for a specific enterprise
router.get('/:enterpriseId/:id', authenticateToken, async (req, res) => {
  try {
    const { enterpriseId, id } = req.params;
    
    const supplier = await prisma.supplier.findFirst({
      where: { 
        id: parseInt(id),
        enterpriseId: parseInt(enterpriseId)
      }
    });
    
    if (!supplier) {
      return res.status(404).json({ error: 'Fournisseur non trouvé' });
    }
    
    res.json(supplier);
  } catch (error) {
    console.error('Error fetching enterprise supplier:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération du fournisseur' });
  }
});

// Create new supplier for a specific enterprise
router.post('/:enterpriseId', authenticateToken, requireRole(['ADMIN', 'MANAGER']), async (req, res) => {
  try {
    const { enterpriseId } = req.params;
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
        notes,
        enterpriseId: parseInt(enterpriseId)
      }
    });

    res.status(201).json(supplier);
  } catch (error) {
    console.error('Error creating enterprise supplier:', error);
    res.status(500).json({ error: 'Erreur lors de la création du fournisseur' });
  }
});

// Update supplier for a specific enterprise
router.put('/:enterpriseId/:id', authenticateToken, requireRole(['ADMIN', 'MANAGER']), async (req, res) => {
  try {
    const { enterpriseId, id } = req.params;
    const { name, contactName, email, phone, address, city, postalCode, taxNumber, paymentTerms, notes, isActive } = req.body;
    
    // Verify supplier belongs to the enterprise
    const existingSupplier = await prisma.supplier.findFirst({
      where: { 
        id: parseInt(id),
        enterpriseId: parseInt(enterpriseId)
      }
    });

    if (!existingSupplier) {
      return res.status(404).json({ error: 'Fournisseur non trouvé' });
    }
    
    const supplier = await prisma.supplier.update({
      where: { id: parseInt(id) },
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
    console.error('Error updating enterprise supplier:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour du fournisseur' });
  }
});

// Delete supplier for a specific enterprise
router.delete('/:enterpriseId/:id', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { enterpriseId, id } = req.params;
    
    // Verify supplier belongs to the enterprise
    const existingSupplier = await prisma.supplier.findFirst({
      where: { 
        id: parseInt(id),
        enterpriseId: parseInt(enterpriseId)
      }
    });

    if (!existingSupplier) {
      return res.status(404).json({ error: 'Fournisseur non trouvé' });
    }

    await prisma.supplier.delete({
      where: { id: parseInt(id) }
    });

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting enterprise supplier:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression du fournisseur' });
  }
});

// Toggle supplier status for a specific enterprise
router.patch('/:enterpriseId/:id/toggle-status', authenticateToken, requireRole(['ADMIN', 'MANAGER']), async (req, res) => {
  try {
    const { enterpriseId, id } = req.params;
    
    const supplier = await prisma.supplier.findFirst({
      where: { 
        id: parseInt(id),
        enterpriseId: parseInt(enterpriseId)
      }
    });

    if (!supplier) {
      return res.status(404).json({ error: 'Fournisseur non trouvé' });
    }

    const updatedSupplier = await prisma.supplier.update({
      where: { id: parseInt(id) },
      data: { isActive: !supplier.isActive }
    });

    res.json(updatedSupplier);
  } catch (error) {
    console.error('Error toggling enterprise supplier status:', error);
    res.status(500).json({ error: 'Erreur lors de la modification du statut du fournisseur' });
  }
});

// Initialize supplier solde for a specific enterprise
router.post('/:enterpriseId/:id/solde/init', authenticateToken, requireRole(['ADMIN', 'MANAGER']), async (req, res) => {
  try {
    const { enterpriseId, id } = req.params;
    const { amount, notes } = req.body;

    const supplier = await prisma.supplier.findFirst({ 
      where: { 
        id: parseInt(id),
        enterpriseId: parseInt(enterpriseId)
      },
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
    console.error('Error initializing enterprise supplier solde:', error);
    res.status(500).json({ error: 'Erreur lors de l\'initialisation du solde' });
  }
});

module.exports = router;
