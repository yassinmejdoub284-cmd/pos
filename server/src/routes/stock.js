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

// ETAT MVT STOCK endpoint
router.get('/etat-mvt-stock', authenticateToken, async (req, res) => {
  try {
    console.log('ETAT MVT STOCK - Request received');
    console.log('User:', req.user);
    
    const { startDate, endDate, depotId } = req.query;
    const targetDepotId = depotId ? parseInt(depotId) : (req.user?.depotId || 1);
    
    console.log('Target depot ID:', targetDepotId);

    // Build date filter
    const dateFilter = {};
    if (startDate && endDate) {
      dateFilter.date = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    }

    // Fetch stock movements with all related data
    const movements = await prisma.stockMovement.findMany({
      where: {
        depotId: targetDepotId,
        ...dateFilter
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            famille_id: true,
            designation_legale: true,
            tva: true,
            prix_achat: true,
            prix_vente_TTC: true,
            created_at: true,
            updated_at: true
          }
        },
        depot: {
          select: {
            id: true,
            name: true,
            code: true,
            type: true
          }
        },
        user: {
          select: {
            firstName: true,
            lastName: true
          }
        }
      },
      orderBy: [
        { productId: 'asc' },
        { depotId: 'asc' },
        { date: 'asc' },
        { reference: 'asc' },
        { id: 'asc' }
      ]
    });

    // Fetch stock document items for movements that have them
    const movementIds = movements.map(m => m.id);
    const documentItems = await prisma.stockDocumentItem.findMany({
      where: {
        // We need to link document items to movements somehow
        // This might need adjustment based on your actual data structure
      },
      include: {
        document: {
          select: {
            numero: true,
            type: true
          }
        }
      }
    });

    // Enrich movements with document item data
    const enrichedMovements = movements.map(movement => {
      // Find related document item (this logic might need adjustment)
      const relatedItem = documentItems.find(item => 
        item.productId === movement.productId && 
        item.document?.numero === movement.reference
      );

      return {
        id: movement.id,
        productId: movement.productId,
        depotId: movement.depotId,
        quantity: parseFloat(movement.quantity),
        type: movement.type,
        fromDepotId: movement.fromDepotId,
        toDepotId: movement.toDepotId,
        reason: movement.reason,
        reference: movement.reference,
        userId: movement.userId,
        date: movement.date.toISOString(),
        product: movement.product,
        depot: movement.depot,
        user: movement.user,
        documentItem: relatedItem ? {
          id: relatedItem.id,
          quantity: parseFloat(relatedItem.quantity),
          prixUnitaire: relatedItem.prixUnitaire ? parseFloat(relatedItem.prixUnitaire) : null,
          purchasePrice: relatedItem.purchasePrice ? parseFloat(relatedItem.purchasePrice) : null,
          montantTTC: relatedItem.montantTTC ? parseFloat(relatedItem.montantTTC) : null,
          montantHT: relatedItem.montantHT ? parseFloat(relatedItem.montantHT) : null,
          montantTVA: relatedItem.montantTVA ? parseFloat(relatedItem.montantTVA) : null,
          tva: relatedItem.tva ? parseFloat(relatedItem.tva) : null
        } : null
      };
    });

    res.json(enrichedMovements);
  } catch (error) {
    console.error('Error fetching ETAT MVT STOCK data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Test endpoint without authentication for debugging
router.get('/etat-mvt-stock-test', async (req, res) => {
  try {
    console.log('ETAT MVT STOCK TEST - Starting...');
    
    // Get all stock movements without filters
    const movements = await prisma.stockMovement.findMany({
      take: 10, // Limit to 10 for testing
      include: {
        product: {
          select: {
            id: true,
            name: true,
            prix_achat: true,
            prix_vente_TTC: true
          }
        },
        depot: {
          select: {
            id: true,
            name: true,
            code: true
          }
        }
      },
      orderBy: {
        date: 'desc'
      }
    });

    console.log('ETAT MVT STOCK TEST - Found movements:', movements.length);
    
    // Get inventory data
    const inventory = await prisma.inventory.findMany({
      take: 10,
      include: {
        product: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    console.log('ETAT MVT STOCK TEST - Found inventory:', inventory.length);

    res.json({
      movements: movements,
      inventory: inventory,
      message: 'Test data loaded successfully'
    });
  } catch (error) {
    console.error('ETAT MVT STOCK TEST - Error:', error);
    res.status(500).json({ 
      error: 'Test endpoint error', 
      details: error.message,
      stack: error.stack 
    });
  }
});

module.exports = router; 