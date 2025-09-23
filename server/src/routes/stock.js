const express = require('express');
const { prisma } = require('../lib/prisma');
const { requireRole, authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.get('/inventory', async (req, res) => {
  try {
    const { depotId } = req.query;
    const targetDepotId = parseInt(depotId || req.user.depotId);

    const inventory = await prisma.inventory.findMany({
      where: {
        depotId: targetDepotId
      },
      include: {
        product: {
          include: {
            famille: {
              select: {
                name: true
              }
            }
          }
        }
      },
      orderBy: {
        product: {
          name: 'asc'
        }
      }
    });

    const inventoryWithDetails = inventory.map(item => ({
      ...item,
      productName: item.product.name,
      sku: item.product.sku,
      unit: item.product.unit,
      categoryName: item.product.famille?.name || 'N/A',
      product: undefined
    }));

    res.json(inventoryWithDetails);
  } catch (error) {
    console.error('Error fetching inventory:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/adjust', requireRole(['ADMIN', 'MANAGER', 'STOCK_MANAGER']), async (req, res) => {
  try {
    const { productId, quantity, reason, type } = req.body;

    if (!productId || !quantity || !reason || !type) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const result = await prisma.$transaction(async (tx) => {
      const inventory = await tx.inventory.findFirst({
        where: {
          depotId: req.user.depotId,
          productId: parseInt(productId)
        }
      });

      let newQuantity = quantity;
      if (inventory) {
        newQuantity = inventory.quantity + (type === 'IN' ? quantity : -quantity);
        await tx.inventory.update({
          where: { id: inventory.id },
          data: { quantity: newQuantity }
        });
      } else {
        await tx.inventory.create({
          data: {
            depotId: req.user.depotId,
            productId: parseInt(productId),
            quantity: quantity
          }
        });
      }

      await tx.stockMovement.create({
        data: {
          productId: parseInt(productId),
          depotId: req.user.depotId,
          quantity: quantity,
          type: type,
          reason: reason,
          userId: req.user.id
        }
      });

      return { newQuantity };
    });

    res.json({ message: 'Stock adjusted successfully', newQuantity: result.newQuantity });
  } catch (error) {
    console.error('Error adjusting stock:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/movements', authenticateToken, async (req, res) => {
  try {
    const { startDate, endDate, type, productId, depotId, page = 1, limit = 50 } = req.query;

    const whereClause = {
      depotId: depotId ? parseInt(depotId) : req.user.depotId
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

    if (productId) {
      whereClause.productId = parseInt(productId);
    }

    const movements = await prisma.stockMovement.findMany({
      where: whereClause,
      include: {
        product: {
          select: {
            name: true,
            barcode: true
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
      },
      skip: (parseInt(page) - 1) * parseInt(limit),
      take: parseInt(limit)
    });

    res.json(movements);
  } catch (error) {
    console.error('Error fetching stock movements:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/transfers', async (req, res) => {
  try {
    const { status, page = 1, limit = 50 } = req.query;

    const whereClause = {
      OR: [
        { fromDepotId: req.user.depotId },
        { toDepotId: req.user.depotId }
      ]
    };

    if (status) {
      whereClause.status = status;
    }

    const transfers = await prisma.stockTransfer.findMany({
      where: whereClause,
      include: {
        fromDepot: {
          select: { name: true }
        },
        toDepot: {
          select: { name: true }
        },
        requester: {
          select: { firstName: true, lastName: true }
        },
        approver: {
          select: { firstName: true, lastName: true }
        }
      },
      orderBy: {
        requestedAt: 'desc'
      },
      skip: (parseInt(page) - 1) * parseInt(limit),
      take: parseInt(limit)
    });

    res.json(transfers);
  } catch (error) {
    console.error('Error fetching transfers:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/transfers/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const transfer = await prisma.stockTransfer.findFirst({
      where: {
        id: parseInt(id),
        OR: [
          { fromDepotId: req.user.depotId },
          { toDepotId: req.user.depotId }
        ]
      },
      include: {
        fromDepot: {
          select: { name: true }
        },
        toDepot: {
          select: { name: true }
        },
        requester: {
          select: { firstName: true, lastName: true }
        },
        approver: {
          select: { firstName: true, lastName: true }
        },
        items: {
          include: {
            product: {
              select: {
                name: true,
                sku: true,
                unit: true
              }
            }
          }
        }
      }
    });

    if (!transfer) {
      return res.status(404).json({ error: 'Transfer not found' });
    }

    res.json(transfer);
  } catch (error) {
    console.error('Error fetching transfer:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router; 