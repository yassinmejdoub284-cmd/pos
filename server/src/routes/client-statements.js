const express = require('express');
const { prisma } = require('../lib/prisma');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get client statement (releve client)
router.get('/:clientId/statement', authenticateToken, async (req, res) => {
  try {
    const { clientId } = req.params;
    const { startDate, endDate } = req.query;

    // Get client info - no depot filtering, get client regardless of depot
    const client = await prisma.client.findUnique({
      where: { id: parseInt(clientId) },
      select: {
        id: true,
        code: true,
        firstName: true,
        lastName: true,
        currentDebt: true,
        depotId: true
      }
    });

    if (!client) {
      return res.status(404).json({ error: 'Client non trouvé' });
    }

    // Prepare optional date filter
    const dateFilter = (startDate && endDate)
      ? { gte: new Date(startDate), lte: new Date(endDate) }
      : undefined;

    // Get all client debt transactions from ALL depots (no depot filtering)
    // Includes both DEBT (Débit - client owes) and PAYMENT (Crédit - reduces debt), with or without saleId
    // This ensures we get all transactions regardless of which depot the sale was made at
    const debtTransactions = await prisma.clientDebtTransaction.findMany({
      where: {
        clientId: parseInt(clientId),
        ...(dateFilter ? { createdAt: dateFilter } : {})
        // No depot filtering - get all transactions from all depots for this client
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
        if (t.type === 'DEBT') row.debit += amount;
        if (t.type === 'PAYMENT') row.credit += amount;
      } else {
        // Standalone transactions remain separate
        standaloneRows.push({
          type: t.type.toLowerCase(),
          date: t.createdAt,
          reference: t.type === 'DEBT' ? `CREDIT-${t.id}` : `REGLEMENT-${t.id}`,
          debit: t.type === 'DEBT' ? amount : 0,
          credit: t.type === 'PAYMENT' ? amount : 0,
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
    const { startDate, endDate, page = 1, limit = 5000 } = req.query;

    const whereClause = {};
    
    if (startDate && endDate) {
      whereClause.createdAt = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    }

    // Fetch all active clients without depot filtering - get all clients regardless of depot
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
        depotId: true,
        _count: {
          select: { 
            sales: true,
            debtTransactions: true
          }
        }
      },
      orderBy: { code: 'asc' }, // Sort by code to ensure CLI0001 appears first
      skip: (parseInt(page) - 1) * parseInt(limit),
      take: parseInt(limit)
    });

    // Get summary for each client using the same logic as individual statement
    const clientSummaries = await Promise.all(
      clients.map(async (client) => {
        // Use the same date filter logic as individual statement
        const dateFilter = (startDate && endDate)
          ? { gte: new Date(startDate), lte: new Date(endDate) }
          : undefined;

        // Get all debt transactions for this client from ALL depots (no depot filtering)
        // This ensures we get all transactions regardless of which depot the sale was made at
        const debtTransactions = await prisma.clientDebtTransaction.findMany({
          where: {
            clientId: client.id,
            ...(dateFilter ? { createdAt: dateFilter } : {})
            // No depot filtering - get all transactions from all depots
          },
          select: {
            id: true,
            amount: true,
            type: true,
            saleId: true,
            createdAt: true
          },
          orderBy: { createdAt: 'asc' }
        });

        // Group transactions by saleId (same logic as individual statement)
        const groupedBySale = new Map();
        const standaloneRows = [];

        for (const t of debtTransactions) {
          const amount = parseFloat(t.amount);
          if (t.saleId) {
            if (!groupedBySale.has(t.saleId)) {
              groupedBySale.set(t.saleId, {
                type: 'ticket',
                date: t.createdAt,
                debit: 0,
                credit: 0
              });
            }
            const row = groupedBySale.get(t.saleId);
            // Keep earliest date for the ticket row
            if (new Date(t.createdAt) < new Date(row.date)) {
              row.date = t.createdAt;
            }
            if (t.type === 'DEBT') row.debit += amount;
            if (t.type === 'PAYMENT') row.credit += amount;
          } else {
            standaloneRows.push({
              type: t.type.toLowerCase(),
              date: t.createdAt,
              debit: t.type === 'DEBT' ? amount : 0,
              credit: t.type === 'PAYMENT' ? amount : 0
            });
          }
        }

        // Calculate totals and running balance (same as individual statement)
        const rows = [...Array.from(groupedBySale.values()), ...standaloneRows]
          .sort((a, b) => new Date(a.date) - new Date(b.date));
        
        const totalDebit = rows.reduce((sum, t) => sum + t.debit, 0);
        const totalCredit = rows.reduce((sum, t) => sum + t.credit, 0);
        
        // Calculate running balance (same formula as individual statement)
        let balance = 0;
        rows.forEach(r => {
          balance = balance + r.debit - r.credit;
        });
        const currentBalance = balance;

        return {
          ...client,
          totalDebit: totalDebit,
          totalCredit: totalCredit,
          currentBalance: currentBalance,
          operationCount: rows.length
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
