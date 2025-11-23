const express = require('express');
const { prisma } = require('../lib/prisma');
const { authenticateToken } = require('../middleware/auth');
const fs = require('fs');
const path = require('path');

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
        select: { amount: true, notes: true, paymentMethod: true }
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
router.post('/', authenticateToken, async (req, res) => {
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
router.put('/:id', authenticateToken, async (req, res) => {
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
router.delete('/:id', authenticateToken, async (req, res) => {
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
router.patch('/:id/toggle-status', authenticateToken, async (req, res) => {
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

    // Filter suppliers by depotId or by expenses in the target depot (same logic as /suppliers endpoint)
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
      // Get period expenses - filter by depotId and date
      const expenseWhere = { 
        supplierId: supplier.id,
        date: { gte: start, lte: end }
      };
      if (targetDepotId) {
        expenseWhere.depotId = targetDepotId;
      } else if (req.user?.role !== 'ADMIN') {
        expenseWhere.depotId = userDepotId;
      }
      
      const periodExpenses = await prisma.expense.findMany({
        where: expenseWhere,
        include: {
          category: {
            select: {
              name: true
            }
          }
        },
        orderBy: { date: 'asc' }
      });
      
      // Get period payments
      const periodPayments = await prisma.supplierPayment.findMany({
        where: { 
          supplierId: supplier.id,
          createdAt: { gte: start, lte: end }
        },
        orderBy: { createdAt: 'asc' }
      });

      // Get bon d'entrée documents for this supplier in period
      const bonEntreeDocuments = await prisma.stockDocument.findMany({
        where: {
          type: 'BON_ENTREE_DEPOT',
          notes: { contains: `Supplier:${supplier.id}` },
          createdAt: { gte: start, lte: end }
        },
        include: {
          items: true
        },
        orderBy: { createdAt: 'asc' }
      });

      // Get bon de retour documents for this supplier in period
      const bonRetourDocuments = await prisma.stockDocument.findMany({
        where: {
          type: 'BON_EXPEDITION',
          notes: { contains: `Supplier:${supplier.id}` },
          status: 'RECEIVED',
          createdAt: { gte: start, lte: end }
        },
        include: {
          items: true
        },
        orderBy: { createdAt: 'asc' }
      });

      // Get debt transactions for this supplier in period
      const debtTransactions = await prisma.supplierDebtTransaction.findMany({
        where: { 
          supplierId: supplier.id,
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

      // Build transactions array using the same logic as statement route
      // Note: Bon d'entrée documents are NOT included here because they're already represented
      // through supplierDebtTransaction (type='DEBT') or supplier payments
      const allTransactions = [
        // 1. Bon de retour documents: calculate total from items (crédit fournisseur - réduit la dette)
        ...bonRetourDocuments.map(doc => {
          const totalAmount = doc.items.reduce((sum, item) => {
            const qty = Math.abs(parseFloat(item.quantity || 0));
            const price = item.purchasePrice ? parseFloat(item.purchasePrice) : 0;
            return sum + (qty * price);
          }, 0);
          return {
            date: doc.createdAt,
            debit: 0,
            credit: totalAmount
          };
        }),
        // 2. Debt transactions: standalone debt/payment adjustments (includes bon d'entrée debt)
        ...debtTransactions.map(transaction => {
          const amount = parseFloat(transaction.amount);
          return {
            date: transaction.createdAt,
            debit: transaction.type === 'PAYMENT' ? amount : 0,
            credit: transaction.type === 'DEBT' ? amount : 0
          };
        }),
        // 3. Expenses: what we owe the supplier (increases debt)
        // Filter out expenses that are linked to bon de retour or bon d'entrée documents (already handled above)
        ...periodExpenses
          .filter(expense => {
            // Skip expenses that are linked to bon de retour documents
            if (expense.notes && expense.notes.includes('Bon de retour')) {
              const bonRetourMatch = expense.notes.match(/Bon de retour (BR-[-\d]+)/);
              if (bonRetourMatch) {
                const bonRetourNumero = bonRetourMatch[1];
                const isDuplicate = bonRetourDocuments.some(doc => doc.numero === bonRetourNumero);
                if (isDuplicate) {
                  return false;
                }
              }
            }
            // Skip expenses that are linked to bon d'entrée documents (payment is handled separately)
            if (expense.notes) {
              // Check if expense notes contain bon d'entrée reference (BE-XXXXX or Bon d'entrée #ID)
              const bonEntreeMatch = expense.notes.match(/Bon d'entrée #(\d+)|(BE-[-\d]+)/i);
              if (bonEntreeMatch) {
                const bonEntreeId = bonEntreeMatch[1];
                const bonEntreeNumero = bonEntreeMatch[2];
                // Check if this bon d'entrée is already in our documents list
                const isDuplicate = bonEntreeDocuments.some(doc => 
                  (bonEntreeId && doc.id.toString() === bonEntreeId) || 
                  (bonEntreeNumero && doc.numero === bonEntreeNumero)
                );
                if (isDuplicate) {
                  return false; // Skip this expense, payment is handled separately
                }
              }
            }
            return true;
          })
          .map(expense => {
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
                date: expense.date,
                debit: paidAmount,
                credit: totalAmount
              };
            } else if (expense.isPaid) {
              // Paid expenses: show as both debit and credit
              return {
                date: expense.date,
                debit: totalAmount,
                credit: totalAmount
              };
            } else {
              // Unpaid expenses: show as credit only
              return {
                date: expense.date,
                debit: 0,
                credit: totalAmount
              };
            }
          }),
        // 4. Supplier payments: positifs = débit (règlements), négatifs = crédit (avoirs)
        ...periodPayments.map(payment => {
          const amount = parseFloat(payment.amount);
          const normalized = Math.abs(amount);
          const isCreditEntry = amount < 0 || payment.paymentMethod === 'CREDIT';
          return {
            date: payment.createdAt,
            debit: isCreditEntry ? 0 : normalized,
            credit: isCreditEntry ? normalized : 0
          };
        })
      ];

      // Sort transactions by date (same as statement route)
      allTransactions.sort((a, b) => {
        const dateA = a.date ? new Date(a.date) : new Date(0);
        const dateB = b.date ? new Date(b.date) : new Date(0);
        return dateA - dateB;
      });

      // Calculate totals: sum of all debit operations and sum of all credit operations
      // Use the exact same formula as statement route: statement.reduce((sum, item) => sum + item.debit, 0)
      const totalDebit = allTransactions.reduce((sum, item) => sum + (item.debit || 0), 0);
      const totalCredit = allTransactions.reduce((sum, item) => sum + (item.credit || 0), 0);

      // Calculate current debt from ALL transactions (not just period)
      const allExpenseWhere = { supplierId: supplier.id };
      if (targetDepotId) {
        allExpenseWhere.depotId = targetDepotId;
      } else if (req.user?.role !== 'ADMIN') {
        allExpenseWhere.depotId = userDepotId;
      }
      
      const allExpenses = await prisma.expense.findMany({
        where: allExpenseWhere,
        select: { amount: true, isPaid: true, isAdvance: true, notes: true }
      });
      
      const allPayments = await prisma.supplierPayment.findMany({
        where: { supplierId: supplier.id },
        select: { amount: true, notes: true }
      });

      const allBonEntreeDocs = await prisma.stockDocument.findMany({
        where: {
          type: 'BON_ENTREE_DEPOT',
          notes: { contains: `Supplier:${supplier.id}` }
        },
        include: { items: true }
      });

      const allBonRetourDocs = await prisma.stockDocument.findMany({
        where: {
          type: 'BON_EXPEDITION',
          notes: { contains: `Supplier:${supplier.id}` },
          status: 'RECEIVED'
        },
        include: { items: true }
      });

      const allDebtTransactions = await prisma.supplierDebtTransaction.findMany({
        where: { supplierId: supplier.id },
        select: {
          amount: true,
          type: true
        }
      });

      // Normalise toutes les opérations pour recalculer la dette courante
      const normalizedBonRetour = allBonRetourDocs.map(doc => {
        const totalAmount = doc.items.reduce((sum, item) => {
          const qty = Math.abs(parseFloat(item.quantity || 0));
          const price = item.purchasePrice ? parseFloat(item.purchasePrice) : 0;
          return sum + (qty * price);
        }, 0);
        return { debit: 0, credit: totalAmount };
      });

      const normalizedBonEntree = allBonEntreeDocs.map(doc => {
        const totalAmount = doc.items.reduce((sum, item) => {
          const qty = parseFloat(item.quantity || 0);
          const price = item.purchasePrice ? parseFloat(item.purchasePrice) : 0;
          return sum + (qty * price);
        }, 0);
        return { debit: 0, credit: totalAmount };
      });

      const normalizedExpenses = allExpenses
        .filter(expense => {
          if (expense.notes && expense.notes.includes('Bon de retour')) {
            const bonRetourMatch = expense.notes.match(/Bon de retour (BR-[-\d]+)/);
            if (bonRetourMatch) {
              const bonRetourNumero = bonRetourMatch[1];
              const isDuplicate = allBonRetourDocs.some(doc => doc.numero === bonRetourNumero);
              if (isDuplicate) {
                return false;
              }
            }
          }
          if (expense.notes) {
            const bonEntreeMatch = expense.notes.match(/Bon d'entrée #(\d+)|(BE-[-\d]+)/i);
            if (bonEntreeMatch) {
              const bonEntreeId = bonEntreeMatch[1];
              const bonEntreeNumero = bonEntreeMatch[2];
              const isDuplicate = allBonEntreeDocs.some(doc => 
                (bonEntreeId && doc.id.toString() === bonEntreeId) ||
                (bonEntreeNumero && doc.numero === bonEntreeNumero)
              );
              if (isDuplicate) {
                return false;
              }
            }
          }
          return true;
        })
        .map(expense => {
          const totalAmount = parseFloat(expense.amount);
          if (expense.isAdvance) {
            let paidAmount = 0;
            if (expense.notes && expense.notes.includes('Paiement partiel:')) {
              const match = expense.notes.match(/Paiement partiel:\s*(\d+(?:\.\d+)?)dt payé/);
              if (match) {
                paidAmount = parseFloat(match[1]);
              }
            }
            return { debit: paidAmount, credit: totalAmount };
          } else if (expense.isPaid) {
            return { debit: totalAmount, credit: totalAmount };
          }
          return { debit: 0, credit: totalAmount };
        });

      const normalizedPayments = allPayments.map(payment => {
        const amount = parseFloat(payment.amount);
        const normalized = Math.abs(amount);
        const isCreditEntry = amount < 0 || payment.paymentMethod === 'CREDIT';
        return {
          debit: isCreditEntry ? 0 : normalized,
          credit: isCreditEntry ? normalized : 0
        };
      });

      const normalizedDebtTransactions = allDebtTransactions.map(transaction => {
        const amount = parseFloat(transaction.amount);
        return {
          debit: transaction.type === 'PAYMENT' ? amount : 0,
          credit: transaction.type === 'DEBT' ? amount : 0
        };
      });

      // Note: normalizedBonEntree is excluded because bon d'entrée debt is already
      // represented in normalizedDebtTransactions (type='DEBT')
      const ledgerEntries = [
        ...normalizedBonRetour,
        ...normalizedExpenses,
        ...normalizedPayments,
        ...normalizedDebtTransactions
      ];

      const currentDebt = ledgerEntries.reduce((sum, entry) => sum + (entry.credit - entry.debit), 0);

      return {
        id: supplier.id,
        name: supplier.name,
        currentDebt: currentDebt,
        totalExpenses: allExpenses.reduce((sum, expense) => sum + parseFloat(expense.amount), 0),
        periodExpenses: totalCredit, // Period credit (what we owe in period)
        periodPayments: totalDebit,  // Period debit (what we paid in period)
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

    // Get payments (include paymentMethod to check if cash payment)
    const payments = await prisma.supplierPayment.findMany({
      where: { 
        supplierId: parseInt(supplierId),
        createdAt: { gte: start, lte: end }
      },
      select: {
        id: true,
        amount: true,
        paymentMethod: true,
        notes: true,
        createdAt: true
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

    // Get bon d'entrée documents for this supplier
    // Include documents created/updated in the date range OR documents that have payments in the date range
    // OR if there are any payments for this supplier, include all bon d'entrée documents (to show the debt)
    // This ensures bon d'entrée appears even if created before the date range but paid during it
    const bonEntreeIdsFromPayments = payments
      .map(p => {
        const bonMatch = p.notes?.match(/Bon d'entrée #(\d+)/);
        return bonMatch ? parseInt(bonMatch[1]) : null;
      })
      .filter(id => id !== null);
    
    // Get bon d'entrée documents for this supplier
    // Always include ALL bon d'entrée for this supplier to show complete debt picture
    // The date filter is applied at the transaction level, not at document level
    // This ensures we see the debt (DEBIT) even if bon d'entrée was created before the date range
    // Also check if payments reference bon d'entrée by ID to include them
    const bonEntreeDocuments = await prisma.stockDocument.findMany({
      where: {
        type: 'BON_ENTREE_DEPOT',
        OR: [
          { notes: { contains: `Supplier:${supplierId}` } },
          // Also include bon d'entrée referenced in payments (in case notes format is different)
          ...(bonEntreeIdsFromPayments.length > 0 ? [{ id: { in: bonEntreeIdsFromPayments } }] : [])
        ]
        // No date restriction - include all bon d'entrée for this supplier
        // The statement will show all debts (DEBIT) and payments in the period (CREDIT)
      },
      include: {
        items: true
      },
      orderBy: { createdAt: 'asc' }
    });

    // Get bon de retour documents for this supplier
    // Include documents created in the date range OR updated in the date range
    const bonRetourDocuments = await prisma.stockDocument.findMany({
      where: {
        type: 'BON_EXPEDITION',
        notes: { contains: `Supplier:${supplierId}` },
        status: 'RECEIVED',
        OR: [
          { createdAt: { gte: start, lte: end } },
          { updatedAt: { gte: start, lte: end } }
        ]
      },
      include: {
        items: true
      },
      orderBy: { createdAt: 'asc' }
    });

    const bonEntreeMap = new Map();
    bonEntreeDocuments.forEach(doc => {
      bonEntreeMap.set(doc.numero, doc.id.toString());
      bonEntreeMap.set(doc.id.toString(), doc.id.toString());
    });

    // Calculate running balance
    let balance = 0;
    const statement = [];

    // Combine and sort all transactions (opposite of client statement)
    const allTransactions = [
      // Bon de retour documents: calculate total from items (crédit fournisseur - réduit la dette)
      ...bonRetourDocuments.map(doc => {
        // Calculate total amount from items
        const totalAmount = doc.items.reduce((sum, item) => {
          const qty = Math.abs(parseFloat(item.quantity || 0)); // Returns have negative quantities
          const price = item.purchasePrice ? parseFloat(item.purchasePrice) : 0;
          return sum + (qty * price);
        }, 0);

        const reference = `Bon de retour #${doc.id}`;
        
        return {
          type: 'bon_retour',
          date: doc.createdAt,
          reference: reference,
          debit: 0,
          credit: totalAmount, // Le retour crédite notre compte fournisseur
          id: doc.id,
          clickable: true,
          bonId: doc.id.toString(),
          documentType: 'BON_EXPEDITION',
          description: `Bon de retour #${doc.id} - ${doc.numero || ''}`
        };
      }),
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
      // Filter out expenses that are linked to bon de retour or bon d'entrée documents (already handled above)
      ...expenses
        .filter(expense => {
          // Skip expenses that are linked to bon de retour documents
          // Bon de retour expenses have notes like "Bon de retour BR-XXXXX - Retour de produits vers..."
          if (expense.notes && expense.notes.includes('Bon de retour')) {
            // Try to match the bon de retour numero from the notes
            // Pattern: "Bon de retour BR-YYYYMM-XXXX" or "Bon de retour BR-YYYYMM-XXXX - ..."
            const bonRetourMatch = expense.notes.match(/Bon de retour (BR-[-\d]+)/);
            if (bonRetourMatch) {
              const bonRetourNumero = bonRetourMatch[1];
              // Check if this bon de retour is already in our documents list
              const isDuplicate = bonRetourDocuments.some(doc => doc.numero === bonRetourNumero);
              if (isDuplicate) {
                return false; // Skip this expense, it's already shown as a document
              }
            }
          }
          // Skip expenses that are linked to bon d'entrée documents (payment is handled separately)
          if (expense.notes) {
            // Check if expense notes contain bon d'entrée reference (BE-XXXXX or Bon d'entrée #ID)
            const bonEntreeMatch = expense.notes.match(/Bon d'entrée #(\d+)|(BE-[-\d]+)/i);
            if (bonEntreeMatch) {
              const bonEntreeId = bonEntreeMatch[1];
              const bonEntreeNumero = bonEntreeMatch[2];
              // Check if this bon d'entrée is already in our documents list
              const isDuplicate = bonEntreeDocuments.some(doc => 
                (bonEntreeId && doc.id.toString() === bonEntreeId) || 
                (bonEntreeNumero && doc.numero === bonEntreeNumero)
              );
              if (isDuplicate) {
                return false; // Skip this expense, payment is handled separately
              }
            }
          }
          return true; // Keep expenses not linked to bon de retour or bon d'entrée
        })
        .map(expense => {
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
      // Supplier payments: positive amounts = débit (règlement), negative amounts = crédit (crédits fournisseur)
      ...payments.map(payment => {
        const rawAmount = parseFloat(payment.amount);
        const amount = Math.abs(rawAmount);
        const notes = payment.notes || '';
        const isCreditEntry = rawAmount < 0 || payment.paymentMethod === 'CREDIT';

        let reference = `PAYMENT-${payment.id}`;
        let bonId = null;

        const bonMatchNumeric = notes.match(/Bon d'entrée #(\d+)/);
        const bonMatchNumero = notes.match(/Bon d'entrée #(BE-[-\d]+)/i);
        
        if (bonMatchNumeric) {
          const bonEntreeId = bonMatchNumeric[1];
          reference = `Bon d'entrée #${bonEntreeId}`;
          bonId = bonEntreeId;
        } else if (bonMatchNumero) {
          const bonNumero = bonMatchNumero[1];
          reference = `Bon d'entrée #${bonNumero}`;
          const docId = bonEntreeMap.get(bonNumero);
          if (docId) {
            bonId = docId;
          }
        }

        if (isCreditEntry) {
          return {
            type: 'credit',
            date: payment.createdAt,
            reference,
            debit: 0,
            credit: amount,
            id: payment.id,
            clickable: true,
            bonId: bonId,
            description: notes || 'Crédit fournisseur'
          };
        }

        return {
          type: 'payment',
          date: payment.createdAt,
          reference,
          debit: amount,
          credit: 0,
          id: payment.id,
          clickable: true,
          bonId: bonId,
          description: notes || 'Règlement fournisseur'
        };
      })
    ].sort((a, b) => new Date(a.date) - new Date(b.date));

    // Calculate running balance
    // - Crédit (bon d'entrée, crédit fournisseur, etc.) augmente la dette
    // - Débit (règlements) réduit la dette
    // Balance = credit - debit
    allTransactions.forEach(transaction => {
      balance += transaction.credit - transaction.debit;
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
router.post('/:id/solde/init', authenticateToken, async (req, res) => {
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
