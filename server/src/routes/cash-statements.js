const express = require('express');
const { prisma } = require('../lib/prisma');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get cash statement (releve caisse)
router.get('/statement', authenticateToken, async (req, res) => {
  try {
    const { startDate, endDate, sessionId } = req.query;

    const whereClause = {};
    
    if (sessionId) {
      whereClause.sessionId = parseInt(sessionId);
    } else if (startDate && endDate) {
      whereClause.createdAt = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    }

    // Get cash movements
    const cashMovements = await prisma.cashMovement.findMany({
      where: whereClause,
      include: {
        session: {
          select: {
            id: true,
            openedAt: true,
            closedAt: true,
            openingFund: true,
            expectedCash: true,
            countedCash: true,
            variance: true,
            status: true
          }
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    // Get sales for the same period
    const salesWhereClause = { 
      depotId: req.user.depotId,
      status: 'COMPLETED'
    };
    
    if (sessionId) {
      salesWhereClause.sessionId = parseInt(sessionId);
    } else if (startDate && endDate) {
      salesWhereClause.createdAt = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    }

    const sales = await prisma.sale.findMany({
      where: salesWhereClause,
      include: {
        paymentMethod: { select: { name: true, type: true } },
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    // Calculate running balance
    let balance = 0;
    const statement = [];

    // Combine and sort all transactions
    const allTransactions = [
      ...cashMovements.map(movement => ({
        type: 'cash_movement',
        date: movement.createdAt,
        reference: `MOV-${movement.id}`,
        debit: movement.type === 'SORTIE' || movement.type === 'DEPOT_COFFRE' ? parseFloat(movement.amount) : 0,
        credit: movement.type === 'ENTREE' || movement.type === 'RETRAIT_CENTRALE' ? parseFloat(movement.amount) : 0,
        description: `${movement.type} - ${movement.reason}`,
        id: movement.id,
        clickable: false,
        movementType: movement.type,
        sessionId: movement.sessionId
      })),
      ...sales
        .filter(sale => sale.paymentMethod?.type === 'CASH')
        .map(sale => ({
          type: 'sale',
          date: sale.createdAt,
          reference: `TICKET-${sale.id}`,
          debit: 0,
          credit: parseFloat(sale.finalTotal),
          description: `Vente - Ticket ${sale.id}`,
          id: sale.id,
          clickable: true,
          sessionId: sale.sessionId
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

    // Calculate summary
    const summary = {
      totalEntries: allTransactions.reduce((sum, t) => sum + t.credit, 0),
      totalExits: allTransactions.reduce((sum, t) => sum + t.debit, 0),
      currentBalance: balance,
      totalCashSales: sales
        .filter(sale => sale.paymentMethod?.type === 'CASH')
        .reduce((sum, sale) => sum + parseFloat(sale.finalTotal), 0),
      totalNonCashSales: sales
        .filter(sale => sale.paymentMethod?.type !== 'CASH')
        .reduce((sum, sale) => sum + parseFloat(sale.finalTotal), 0),
      totalSales: sales.reduce((sum, sale) => sum + parseFloat(sale.finalTotal), 0)
    };

    res.json({
      statement,
      summary,
      period: {
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        sessionId: sessionId ? parseInt(sessionId) : null
      }
    });
  } catch (error) {
    console.error('Error fetching cash statement:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération du relevé caisse' });
  }
});

// Get cash movements by session
router.get('/session/:sessionId', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = await prisma.sessionCaisse.findUnique({
      where: { id: parseInt(sessionId) },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        },
        depot: {
          select: {
            id: true,
            name: true,
            code: true
          }
        }
      }
    });

    if (!session) {
      return res.status(404).json({ error: 'Session non trouvée' });
    }

    const cashMovements = await prisma.cashMovement.findMany({
      where: { sessionId: parseInt(sessionId) },
      include: {
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    const sales = await prisma.sale.findMany({
      where: { 
        sessionId: parseInt(sessionId),
        status: 'COMPLETED'
      },
      include: {
        paymentMethod: { select: { name: true, type: true } }
      },
      orderBy: { createdAt: 'asc' }
    });

    res.json({
      session,
      cashMovements,
      sales,
      summary: {
        totalCashMovements: cashMovements.reduce((sum, m) => sum + parseFloat(m.amount), 0),
        totalCashSales: sales
          .filter(sale => sale.paymentMethod?.type === 'CASH')
          .reduce((sum, sale) => sum + parseFloat(sale.finalTotal), 0),
        totalSales: sales.reduce((sum, sale) => sum + parseFloat(sale.finalTotal), 0)
      }
    });
  } catch (error) {
    console.error('Error fetching session cash movements:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des mouvements de caisse' });
  }
});

// Get cash summary by date range
router.get('/summary', authenticateToken, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Les dates de début et de fin sont obligatoires' });
    }

    const whereClause = {
      depotId: req.user.depotId,
      createdAt: {
        gte: new Date(startDate),
        lte: new Date(endDate)
      }
    };

    // Get cash movements
    const cashMovements = await prisma.cashMovement.findMany({
      where: whereClause,
      include: {
        session: {
          select: {
            id: true,
            openedAt: true,
            closedAt: true,
            status: true
          }
        }
      }
    });

    // Get sales
    const sales = await prisma.sale.findMany({
      where: {
        ...whereClause,
        status: 'COMPLETED'
      },
      include: {
        paymentMethod: { select: { name: true, type: true } }
      }
    });

    // Group by day
    const dailySummary = {};
    
    [...cashMovements, ...sales].forEach(item => {
      const date = item.createdAt.toISOString().split('T')[0];
      if (!dailySummary[date]) {
        dailySummary[date] = {
          date,
          cashEntries: 0,
          cashExits: 0,
          cashSales: 0,
          nonCashSales: 0,
          totalSales: 0,
          sessions: new Set()
        };
      }

      if (item.sessionId) {
        dailySummary[date].sessions.add(item.sessionId);
      }

      if (item.type) {
        // Cash movement
        if (item.type === 'ENTREE' || item.type === 'RETRAIT_CENTRALE') {
          dailySummary[date].cashEntries += parseFloat(item.amount);
        } else {
          dailySummary[date].cashExits += parseFloat(item.amount);
        }
      } else {
        // Sale
        dailySummary[date].totalSales += parseFloat(item.finalTotal);
        if (item.paymentMethod?.type === 'CASH') {
          dailySummary[date].cashSales += parseFloat(item.finalTotal);
        } else {
          dailySummary[date].nonCashSales += parseFloat(item.finalTotal);
        }
      }
    });

    const summary = Object.values(dailySummary).map(day => ({
      ...day,
      sessions: day.sessions.size,
      netCashFlow: day.cashEntries - day.cashExits + day.cashSales
    }));

    res.json(summary);
  } catch (error) {
    console.error('Error fetching cash summary:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération du résumé de caisse' });
  }
});

module.exports = router;
