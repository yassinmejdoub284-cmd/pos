const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Get client statement (releve client)
router.get('/:clientId/statement', authenticateToken, async (req, res) => {
  try {
    const { clientId } = req.params;
    const { startDate, endDate } = req.query;

    // Get client info
    const client = await prisma.client.findUnique({
      where: { id: parseInt(clientId) },
      select: {
        id: true,
        code: true,
        firstName: true,
        lastName: true,
        currentDebt: true
      }
    });

    if (!client) {
      return res.status(404).json({ error: 'Client non trouvé' });
    }

    const whereClause = { clientId: parseInt(clientId) };
    
    if (startDate && endDate) {
      whereClause.OR = [
        { createdAt: { gte: new Date(startDate), lte: new Date(endDate) } },
        { createdAt: { gte: new Date(startDate), lte: new Date(endDate) } }
      ];
    }

    // Get sales
    const sales = await prisma.sale.findMany({
      where: { clientId: parseInt(clientId) },
      include: {
        paymentMethod: { select: { name: true } }
      },
      orderBy: { createdAt: 'asc' }
    });

    // Get debt transactions
    const debtTransactions = await prisma.clientDebtTransaction.findMany({
      where: { clientId: parseInt(clientId) },
      orderBy: { createdAt: 'asc' }
    });

    // Calculate running balance
    let balance = 0;
    const statement = [];

    // Combine and sort all transactions
    const allTransactions = [
      // Include ALL sales (both CREDIT and COMPTANT)
      ...sales.map(sale => {
        const totalAmount = parseFloat(sale.finalTotal);
        
        if (sale.paymentType === 'CREDIT') {
          // Credit sales: show advance payment as debit, total as credit
          const advanceAmount = parseFloat(sale.advancePayment || 0);
          const remainingAmount = totalAmount - advanceAmount;
          
          return {
            type: 'credit',
            date: sale.createdAt,
            reference: `TICKET-${sale.id}`,
            debit: advanceAmount, // Show advance payment as debit
            credit: totalAmount, // Show total as credit
            id: sale.id,
            clickable: true,
            saleId: sale.id,
            remaining: remainingAmount
          };
        } else {
          // Cash sales: show full payment as both debit and credit (débit = crédit)
          return {
            type: 'cash',
            date: sale.createdAt,
            reference: `TICKET-${sale.id}`,
            debit: totalAmount, // Full payment as debit
            credit: totalAmount, // Full amount as credit
            id: sale.id,
            clickable: true,
            saleId: sale.id,
            remaining: 0
          };
        }
      }),
      // Only include standalone debt transactions (not related to sales)
      ...debtTransactions.filter(transaction => !transaction.saleId).map(transaction => ({
        type: transaction.type.toLowerCase(),
        date: transaction.createdAt,
        reference: transaction.type === 'DEBT' ? `CREDIT-${transaction.id}` : `REGLEMENT-${transaction.id}`,
        debit: transaction.type === 'PAYMENT' ? parseFloat(transaction.amount) : 0,
        credit: transaction.type === 'DEBT' ? parseFloat(transaction.amount) : 0,
        id: transaction.id,
        clickable: transaction.type === 'PAYMENT', // Make payments clickable
        saleId: transaction.saleId
      }))
    ].sort((a, b) => new Date(a.date) - new Date(b.date));

    // Calculate running balance (Solde = Somme(Débits) - Somme(Crédits))
    // Débit = argent reçu du client (paiement) - reduces debt
    // Crédit = montant facturé au client à crédit (dette) - increases debt
    allTransactions.forEach(transaction => {
      balance = balance + transaction.debit - transaction.credit;
      statement.push({
        ...transaction,
        balance: balance
      });
    });

    res.json({
      client,
      statement,
      totalDebit: allTransactions.reduce((sum, t) => sum + t.debit, 0),
      totalCredit: allTransactions.reduce((sum, t) => sum + t.credit, 0),
      currentBalance: balance
    });
  } catch (error) {
    console.error('Error fetching client statement:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération du relevé client' });
  }
});

// Get all client statements summary
router.get('/statements/summary', authenticateToken, async (req, res) => {
  try {
    const { startDate, endDate, page = 1, limit = 50 } = req.query;

    const whereClause = {};
    
    if (startDate && endDate) {
      whereClause.createdAt = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    }

    const clients = await prisma.client.findMany({
      where: { isActive: true },
      select: {
        id: true,
        code: true,
        firstName: true,
        lastName: true,
        currentDebt: true,
        maxDebt: true,
        totalSpent: true,
        _count: {
          select: { sales: true }
        }
      },
      orderBy: { totalSpent: 'desc' },
      skip: (parseInt(page) - 1) * parseInt(limit),
      take: parseInt(limit)
    });

    // Get summary for each client
    const clientSummaries = await Promise.all(
      clients.map(async (client) => {
        const sales = await prisma.sale.findMany({
          where: { 
            clientId: client.id,
            ...(startDate && endDate ? {
              createdAt: {
                gte: new Date(startDate),
                lte: new Date(endDate)
              }
            } : {})
          },
          select: {
            id: true,
            finalTotal: true,
            advancePayment: true,
            paymentType: true,
            createdAt: true
          }
        });

        const debtTransactions = await prisma.clientDebtTransaction.findMany({
          where: { 
            clientId: client.id,
            saleId: null, // Only standalone transactions
            ...(startDate && endDate ? {
              createdAt: {
                gte: new Date(startDate),
                lte: new Date(endDate)
              }
            } : {})
          },
          select: {
            amount: true,
            type: true,
            createdAt: true
          }
        });

        // Calculate totals using the same logic as individual client statement
        let totalDebit = 0;
        let totalCredit = 0;
        let operationCount = 0;

        // Process sales
        sales.forEach(sale => {
          const totalAmount = parseFloat(sale.finalTotal);
          operationCount++;
          
          if (sale.paymentType === 'CREDIT') {
            const advanceAmount = parseFloat(sale.advancePayment || 0);
            totalDebit += advanceAmount;
            totalCredit += totalAmount;
          } else {
            // Cash sales: débit = crédit
            totalDebit += totalAmount;
            totalCredit += totalAmount;
          }
        });

        // Process standalone debt transactions
        debtTransactions.forEach(transaction => {
          operationCount++;
          if (transaction.type === 'PAYMENT') {
            totalDebit += parseFloat(transaction.amount);
          } else if (transaction.type === 'DEBT') {
            totalCredit += parseFloat(transaction.amount);
          }
        });

        const currentBalance = totalDebit - totalCredit;

        // Calculate remaining allowed debts
        const maxDebt = parseFloat(client.maxDebt || 0);
        const currentDebtAmount = parseFloat(client.currentDebt || 0);
        const remainingAllowedDebts = Math.max(0, maxDebt - currentDebtAmount);

        return {
          ...client,
          periodSales: totalCredit, // Ventes Période = Total Crédit (366,900)
          periodPayments: totalDebit, // Paiements = Total Débit (271,900)
          periodDebts: totalCredit - totalDebit, // Créances = Remaining debt (95,000)
          periodBalance: remainingAllowedDebts, // Remaining Allowed Debts = maxDebt - currentDebt
          currentDebt: -Math.abs(parseFloat(client.currentDebt || 0)), // Solde Actuel = -95,000 (negative)
          operationCount: operationCount
        };
      })
    );

    res.json(clientSummaries);
  } catch (error) {
    console.error('Error fetching client statements summary:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération du résumé des relevés clients' });
  }
});

module.exports = router;
