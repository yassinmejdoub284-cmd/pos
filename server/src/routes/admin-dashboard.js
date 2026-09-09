const express = require('express');
const { prisma } = require('../lib/prisma');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.get('/stats', authenticateToken, async (req, res) => {
  try {
    if (req.user?.role !== 'ADMIN' && req.user?.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Access denied: Admin only' });
    }

    const depots = await prisma.depot.findMany({
      where: {
        isActive: true,
        type: { in: ['SHOP', 'BRANCH'] },
        NOT: {
          OR: [
            { name: { contains: 'Tunis' } },
            { name: { contains: 'tunis' } },
            { code: { contains: 'TUNIS' } },
            { code: { contains: 'tunis' } }
          ]
        }
      },
      orderBy: { name: 'asc' }
    });

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const depotStats = await Promise.all(depots.map(async (depot) => {
      const activeSession = await prisma.sessionCaisse.findFirst({
        where: {
          depotId: depot.id,
          status: 'OPEN'
        },
        select: {
          id: true,
          openingFund: true,
          expectedCash: true,
          sales: {
            where: { status: 'COMPLETED' },
            select: { finalTotal: true, paymentType: true }
          },
          cashMovements: {
            select: { type: true, amount: true }
          }
        }
      });

      let soldeCaisse = 0;
      if (activeSession) {
        if (activeSession.expectedCash !== null && activeSession.expectedCash !== undefined) {
          soldeCaisse = parseFloat(activeSession.expectedCash || 0);
        } else {
          const cashSales = activeSession.sales
            .filter(sale => {
              const paymentType = (sale.paymentType || '').toUpperCase();
              return paymentType === 'COMPTANT' && sale.status === 'COMPLETED';
            })
            .reduce((sum, sale) => sum + parseFloat(sale.finalTotal || 0), 0);

          const cashMovements = activeSession.cashMovements.reduce((sum, mv) => {
            const amount = parseFloat(mv.amount || 0);
            if (mv.type === 'ENTREE' || mv.type === 'RETRAIT_CENTRALE') {
              return sum + amount;
            } else if (mv.type === 'SORTIE' || mv.type === 'DEPOT_COFFRE') {
              return sum - amount;
            }
            return sum;
          }, 0);

          soldeCaisse = parseFloat(activeSession.openingFund || 0) + cashSales + cashMovements;
        }
      }

      const expensesToday = await prisma.expense.aggregate({
        where: {
          depotId: depot.id,
          isApproved: true,
          date: { gte: startOfDay, lte: endOfDay }
        },
        _sum: { amount: true }
      });

      const expensesMonth = await prisma.expense.aggregate({
        where: {
          depotId: depot.id,
          isApproved: true,
          date: { gte: startOfMonth }
        },
        _sum: { amount: true }
      });

      const expensesYear = await prisma.expense.aggregate({
        where: {
          depotId: depot.id,
          isApproved: true,
          date: { gte: startOfYear }
        },
        _sum: { amount: true }
      });

      return {
        id: depot.id,
        name: depot.name,
        code: depot.code,
        soldeCaisse: soldeCaisse,
        expenses: {
          today: parseFloat(expensesToday._sum.amount || 0),
          month: parseFloat(expensesMonth._sum.amount || 0),
          year: parseFloat(expensesYear._sum.amount || 0)
        }
      };
    }));

    const totalClients = await prisma.client.count({
      where: { isActive: true }
    });

    const totalClientCredit = await prisma.client.aggregate({
      where: { isActive: true },
      _sum: { currentDebt: true }
    });

    const totalSupplierCredit = await prisma.supplier.aggregate({
      where: { isActive: true },
      _sum: { currentDebt: true }
    });

    const topClients = await prisma.sale.groupBy({
      by: ['clientId'],
      where: {
        status: 'COMPLETED',
        clientId: { not: null }
      },
      _sum: { finalTotal: true },
      _count: { id: true },
      orderBy: {
        _sum: { finalTotal: 'desc' }
      },
      take: 5
    });

    const clientIds = topClients.map(c => c.clientId).filter(Boolean);
    const clientDetails = await prisma.client.findMany({
      where: { id: { in: clientIds } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        code: true
      }
    });

    const bestClients = topClients.map(client => {
      const details = clientDetails.find(d => d.id === client.clientId);
      return {
        id: client.clientId,
        name: details ? `${details.firstName} ${details.lastName}` : 'Inconnu',
        code: details?.code || '',
        totalSpent: parseFloat(client._sum.finalTotal || 0),
        orderCount: client._count.id
      };
    });

    const topProducts = await prisma.saleItem.groupBy({
      by: ['productId'],
      where: {
        sale: {
          status: 'COMPLETED'
        }
      },
      _sum: {
        quantity: true,
        total: true
      },
      _count: {
        id: true
      },
      orderBy: {
        _sum: { quantity: 'desc' }
      },
      take: 10
    });

    const productIds = topProducts.map(p => p.productId).filter(Boolean);
    const productDetails = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: {
        id: true,
        name: true,
        photo: true
      }
    });

    const bestProducts = topProducts.map(product => {
      const details = productDetails.find(d => d.id === product.productId);
      return {
        id: product.productId,
        name: details?.name || 'Produit inconnu',
        photo: details?.photo || null,
        quantitySold: parseFloat(product._sum.quantity || 0),
        totalRevenue: parseFloat(product._sum.total || 0),
        saleCount: product._count.id
      };
    });

    const totalSalesToday = await prisma.sale.aggregate({
      where: {
        status: 'COMPLETED',
        createdAt: { gte: startOfDay, lte: endOfDay }
      },
      _sum: { finalTotal: true },
      _count: { id: true }
    });

    const totalSalesMonth = await prisma.sale.aggregate({
      where: {
        status: 'COMPLETED',
        createdAt: { gte: startOfMonth }
      },
      _sum: { finalTotal: true },
      _count: { id: true }
    });

    const totalSalesYear = await prisma.sale.aggregate({
      where: {
        status: 'COMPLETED',
        createdAt: { gte: startOfYear }
      },
      _sum: { finalTotal: true },
      _count: { id: true }
    });

    const totalExpensesToday = await prisma.expense.aggregate({
      where: {
        isApproved: true,
        date: { gte: startOfDay, lte: endOfDay }
      },
      _sum: { amount: true }
    });

    const totalExpensesMonth = await prisma.expense.aggregate({
      where: {
        isApproved: true,
        date: { gte: startOfMonth }
      },
      _sum: { amount: true }
    });

    const totalExpensesYear = await prisma.expense.aggregate({
      where: {
        isApproved: true,
        date: { gte: startOfYear }
      },
      _sum: { amount: true }
    });

    const totalSuppliers = await prisma.supplier.count({
      where: { isActive: true }
    });

    res.json({
      depots: depotStats,
      statistics: {
        totalClients,
        totalSuppliers,
        totalClientCredit: parseFloat(totalClientCredit._sum.currentDebt || 0),
        totalSupplierCredit: parseFloat(totalSupplierCredit._sum.currentDebt || 0),
        bestClients,
        bestProducts,
        sales: {
          today: {
            revenue: parseFloat(totalSalesToday._sum.finalTotal || 0),
            transactions: totalSalesToday._count.id || 0
          },
          month: {
            revenue: parseFloat(totalSalesMonth._sum.finalTotal || 0),
            transactions: totalSalesMonth._count.id || 0
          },
          year: {
            revenue: parseFloat(totalSalesYear._sum.finalTotal || 0),
            transactions: totalSalesYear._count.id || 0
          }
        },
        expenses: {
          today: parseFloat(totalExpensesToday._sum.amount || 0),
          month: parseFloat(totalExpensesMonth._sum.amount || 0),
          year: parseFloat(totalExpensesYear._sum.amount || 0)
        }
      }
    });
  } catch (error) {
    console.error('Error fetching admin dashboard stats:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des statistiques' + (error?.message ? ' : ' + error.message : ''), code: error?.code });
  }
});

// New endpoint to get real cash outflow (Sortie Caisse) by depot
router.get('/cash-flow-stats', authenticateToken, async (req, res) => {
  try {
    if (req.user?.role !== 'ADMIN' && req.user?.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Access denied: Admin only' });
    }

    const { startDate, endDate } = req.query;
    const start = startDate ? new Date(startDate) : new Date(new Date().setHours(0, 0, 0, 0));
    const end = endDate ? new Date(endDate) : new Date(new Date().setHours(23, 59, 59, 999));

    // Fetch all cash movements of type SORTIE within range
    const cashMovements = await prisma.cashMovement.findMany({
      where: {
        type: 'SORTIE',
        createdAt: {
          gte: start,
          lte: end
        }
      },
      include: {
        session: {
          select: { depotId: true }
        }
      }
    });

    // Aggregate by depot
    const movementsByDepot = {};
    cashMovements.forEach(cm => {
      const depotId = cm.session?.depotId || 'unknown';
      if (!movementsByDepot[depotId]) {
        movementsByDepot[depotId] = 0;
      }
      movementsByDepot[depotId] += parseFloat(cm.amount || 0);
    });

    const result = Object.entries(movementsByDepot).map(([depotId, total]) => ({
      depotId: depotId === 'unknown' ? null : parseInt(depotId),
      totalOutflow: total
    }));

    res.json(result);

  } catch (error) {
    console.error('Error fetching cash flow stats:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des flux de trésorerie' + (error?.message ? ' : ' + error.message : ''), code: error?.code });
  }
});

module.exports = router;

