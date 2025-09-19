const express = require('express');
const { prisma } = require('../lib/prisma');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

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

    // Prepare optional date filter
    const dateFilter = (startDate && endDate)
      ? { gte: new Date(startDate), lte: new Date(endDate) }
      : undefined;

    // Get client debt transactions ONLY (single source of truth)
    // Includes both DEBT (Crédit) and PAYMENT (Débit), with or without saleId
    const debtTransactions = await prisma.clientDebtTransaction.findMany({
      where: {
        clientId: parseInt(clientId),
        ...(dateFilter ? { createdAt: dateFilter } : {})
      },
      select: {
        id: true,
        amount: true,
        type: true,
        notes: true,
        saleId: true,
        createdAt: true
      },
      orderBy: { createdAt: 'asc' }
    });

    // Group transactions by saleId to merge Débit/Crédit of the same ticket
    const groupedBySale = new Map();
    const standaloneRows = [];

    for (const t of debtTransactions) {
      const amount = parseFloat(t.amount);
      if (t.saleId) {
        if (!groupedBySale.has(t.saleId)) {
          groupedBySale.set(t.saleId, {
            type: 'ticket',
            date: t.createdAt,
            reference: `TICKET-${t.saleId}`,
            debit: 0,
            credit: 0,
            id: t.saleId,
            clickable: true,
            saleId: t.saleId
          });
        }
        const row = groupedBySale.get(t.saleId);
        // Keep earliest date for the ticket row
        if (new Date(t.createdAt) < new Date(row.date)) {
          row.date = t.createdAt;
        }
        if (t.type === 'PAYMENT') row.debit += amount;
        if (t.type === 'DEBT') row.credit += amount;
      } else {
        // Standalone transactions remain separate
        standaloneRows.push({
          type: t.type.toLowerCase(),
          date: t.createdAt,
          reference: t.type === 'DEBT' ? `CREDIT-${t.id}` : `REGLEMENT-${t.id}`,
          debit: t.type === 'PAYMENT' ? amount : 0,
          credit: t.type === 'DEBT' ? amount : 0,
          id: t.id,
          clickable: t.type === 'PAYMENT',
          saleId: null,
          description: t.notes || ''
        });
      }
    }

    const rows = [...Array.from(groupedBySale.values()), ...standaloneRows];

    // Calculate running balance (Solde = Débits - Crédits)
    let balance = 0;
    const statement = rows
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .map(r => {
        balance = balance + r.debit - r.credit;
        return { ...r, balance };
      });

    res.json({
      client,
      statement,
      totalDebit: rows.reduce((sum, t) => sum + t.debit, 0),
      totalCredit: rows.reduce((sum, t) => sum + t.credit, 0),
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
          select: { 
            sales: true,
            debtTransactions: true
          }
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
