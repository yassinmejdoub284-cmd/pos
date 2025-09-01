const express = require('express');
const { prisma } = require('../lib/prisma');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/sales', requireRole(['ADMIN', 'MANAGER']), async (req, res) => {
  try {
    const { startDate, endDate, depotId } = req.query;
    const targetDepotId = parseInt(depotId || req.user.depotId);

    const whereClause = {
      depotId: targetDepotId,
      status: 'COMPLETED'
    };

    if (startDate && endDate) {
      whereClause.createdAt = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    }

    const sales = await prisma.sale.groupBy({
      by: ['createdAt'],
      where: whereClause,
      _count: {
        id: true
      },
      _sum: {
        finalTotal: true,
        tax: true,
        discount: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    const formattedSales = sales.map(sale => ({
      date: sale.createdAt,
      totalSales: sale._count.id,
      totalRevenue: sale._sum.finalTotal,
      totalTax: sale._sum.tax,
      totalDiscount: sale._sum.discount
    }));

    res.json(formattedSales);
  } catch (error) {
    console.error('Error generating sales report:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/products', requireRole(['ADMIN', 'MANAGER']), async (req, res) => {
  try {
    const { startDate, endDate, depotId } = req.query;
    const targetDepotId = parseInt(depotId || req.user.depotId);

    const whereClause = {
      sale: {
        depotId: targetDepotId,
        status: 'COMPLETED'
      }
    };

    if (startDate && endDate) {
      whereClause.sale.createdAt = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    }

    const products = await prisma.saleItem.groupBy({
      by: ['productId'],
      where: whereClause,
      _sum: {
        quantity: true,
        total: true
      },
      _avg: {
        unitPrice: true
      },
      orderBy: {
        _sum: {
          quantity: 'desc'
        }
      }
    });

    const productIds = products.map(p => p.productId);
    const productDetails = await prisma.product.findMany({
      where: {
        id: { in: productIds }
      },
      select: {
        id: true,
        name: true,
        sku: true
      }
    });

    const productsWithDetails = products.map(product => {
      const details = productDetails.find(d => d.id === product.productId);
      return {
        productId: product.productId,
        productName: details?.name || 'Unknown',
        sku: details?.sku || 'Unknown',
        totalSold: product._sum.quantity,
        totalRevenue: product._sum.total,
        avgPrice: product._avg.unitPrice
      };
    });

    res.json(productsWithDetails);
  } catch (error) {
    console.error('Error generating products report:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/inventory', requireRole(['ADMIN', 'MANAGER', 'STOCK_MANAGER']), async (req, res) => {
  try {
    const { depotId } = req.query;
    const targetDepotId = parseInt(depotId || req.user.depotId);

    const inventory = await prisma.inventory.findMany({
      where: {
        depotId: targetDepotId
      },
      include: {
        product: {
          select: {
            name: true,
            sku: true,
            minStockLevel: true,
            maxStockLevel: true
          }
        }
      },
      orderBy: {
        quantity: 'asc'
      }
    });

    const inventoryWithDetails = inventory.map(item => ({
      productName: item.product.name,
      sku: item.product.sku,
      minStockLevel: item.product.minStockLevel,
      maxStockLevel: item.product.maxStockLevel,
      currentStock: item.quantity,
      reservedStock: item.reservedQuantity,
      availableStock: item.quantity - item.reservedQuantity
    }));

    res.json(inventoryWithDetails);
  } catch (error) {
    console.error('Error generating inventory report:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/stock-movements', requireRole(['ADMIN', 'MANAGER', 'STOCK_MANAGER']), async (req, res) => {
  try {
    const { startDate, endDate, type, depotId } = req.query;
    const targetDepotId = parseInt(depotId || req.user.depotId);

    const whereClause = {
      depotId: targetDepotId
    };

    if (startDate && endDate) {
      whereClause.date = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    }

    if (type) {
      whereClause.type = type;
    }

    const movements = await prisma.stockMovement.findMany({
      where: whereClause,
      include: {
        product: {
          select: {
            name: true,
            sku: true
          }
        },
        user: {
          select: {
            firstName: true,
            lastName: true
          }
        }
      },
      orderBy: {
        date: 'desc'
      }
    });

    res.json(movements);
  } catch (error) {
    console.error('Error generating stock movements report:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router; 