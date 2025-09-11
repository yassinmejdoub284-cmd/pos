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
      ...sales.map(sale => ({
        type: 'sale',
        date: sale.createdAt,
        reference: `TICKET-${sale.id}`,
        debit: parseFloat(sale.finalTotal),
        credit: 0,
        description: `Vente - ${sale.paymentMethod?.name || 'Non spécifié'}`,
        id: sale.id,
        clickable: true
      })),
      ...debtTransactions.map(transaction => ({
        type: transaction.type.toLowerCase(),
        date: transaction.createdAt,
        reference: transaction.type === 'DEBT' ? `DEBT-${transaction.id}` : `PAY-${transaction.id}`,
        debit: transaction.type === 'DEBT' ? parseFloat(transaction.amount) : 0,
        credit: transaction.type === 'PAYMENT' ? parseFloat(transaction.amount) : 0,
        description: transaction.notes || (transaction.type === 'DEBT' ? 'Créance' : 'Paiement'),
        id: transaction.id,
        clickable: transaction.saleId ? true : false,
        saleId: transaction.saleId
      }))
    ].sort((a, b) => new Date(a.date) - new Date(b.date));

    // Calculate running balance
    allTransactions.forEach(transaction => {
      balance = balance + transaction.credit - transaction.debit;
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
            createdAt: true
          }
        });

        const debtTransactions = await prisma.clientDebtTransaction.findMany({
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
            amount: true,
            type: true,
            createdAt: true
          }
        });

        const totalSales = sales.reduce((sum, sale) => sum + parseFloat(sale.finalTotal), 0);
        const totalPayments = debtTransactions
          .filter(t => t.type === 'PAYMENT')
          .reduce((sum, t) => sum + parseFloat(t.amount), 0);
        const totalDebts = debtTransactions
          .filter(t => t.type === 'DEBT')
          .reduce((sum, t) => sum + parseFloat(t.amount), 0);

        return {
          ...client,
          periodSales: totalSales,
          periodPayments: totalPayments,
          periodDebts: totalDebts,
          periodBalance: totalDebts - totalPayments
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
