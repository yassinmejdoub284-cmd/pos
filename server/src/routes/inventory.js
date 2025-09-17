const express = require('express');
const { prisma } = require('../lib/prisma');
const { requireRole } = require('../middleware/auth');
const { logAudit } = require('../lib/audit');

const router = express.Router();

// Generate inventory session number
function generateInventoryNumber() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const time = String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0');
  return `INV-${year}${month}${day}-${time}`;
}

// Get inventory count for a depot
router.get('/count/:depotId', requireRole(['ADMIN', 'MANAGER', 'STOCK_MANAGER']), async (req, res) => {
  try {
    const depotId = parseInt(req.params.depotId);
    
    const count = await prisma.inventory.count({
      where: {
        depotId: depotId,
        quantity: {
          gt: 0
        }
      }
    });

    res.json(count);
  } catch (error) {
    console.error('Error getting inventory count:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all inventory sessions
router.get('/sessions', requireRole(['ADMIN', 'MANAGER', 'STOCK_MANAGER']), async (req, res) => {
  try {
    const { status, depotId } = req.query;
    const targetDepotId = parseInt(depotId || req.user.depotId);

    const where = {
      depotId: targetDepotId
    };

    if (status) {
      where.status = status;
    }

    const sessions = await prisma.inventorySession.findMany({
      where,
      include: {
        depot: {
          select: {
            name: true,
            code: true
          }
        },
        starter: {
          select: {
            firstName: true,
            lastName: true,
            username: true
          }
        },
        closer: {
          select: {
            firstName: true,
            lastName: true,
            username: true
          }
        },
        poster: {
          select: {
            firstName: true,
            lastName: true,
            username: true
          }
        },
        _count: {
          select: {
            items: true
          }
        }
      },
      orderBy: {
        startedAt: 'desc'
      }
    });

    res.json(sessions);
  } catch (error) {
    console.error('Error fetching inventory sessions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single inventory session with items
router.get('/sessions/:id', requireRole(['ADMIN', 'MANAGER', 'STOCK_MANAGER']), async (req, res) => {
  try {
    const sessionId = parseInt(req.params.id);

    const session = await prisma.inventorySession.findUnique({
      where: { id: sessionId },
      include: {
        depot: {
          select: {
            name: true,
            code: true
          }
        },
        starter: {
          select: {
            firstName: true,
            lastName: true,
            username: true
          }
        },
        closer: {
          select: {
            firstName: true,
            lastName: true,
            username: true
          }
        },
        poster: {
          select: {
            firstName: true,
            lastName: true,
            username: true
          }
        },
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                barcode: true,
                unite: true,
                prix_vente_TTC: true,
                famille: {
                  select: {
                    name: true
                  }
                }
              }
            },
            counter: {
              select: {
                firstName: true,
                lastName: true,
                username: true
              }
            }
          },
          orderBy: {
            product: {
              name: 'asc'
            }
          }
        }
      }
    });

    if (!session) {
      return res.status(404).json({ error: 'Inventory session not found' });
    }

    res.json(session);
  } catch (error) {
    console.error('Error fetching inventory session:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Start new inventory session
router.post('/sessions', requireRole(['ADMIN', 'MANAGER', 'STOCK_MANAGER']), async (req, res) => {
  try {
    const { depotId, notes } = req.body;
    const targetDepotId = parseInt(depotId || req.user.depotId);

    // Check if there's already an active inventory session for this depot
    const existingSession = await prisma.inventorySession.findFirst({
      where: {
        depotId: targetDepotId,
        status: {
          in: ['DRAFT', 'IN_PROGRESS']
        }
      }
    });

    if (existingSession) {
      return res.status(400).json({ 
        error: 'There is already an active inventory session for this depot',
        existingSession: {
          id: existingSession.id,
          numero: existingSession.numero,
          status: existingSession.status
        }
      });
    }

    // Get all products with current inventory for this depot
    const inventory = await prisma.inventory.findMany({
      where: {
        depotId: targetDepotId,
        quantity: {
          gt: 0
        }
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            barcode: true,
            unite: true,
            prix_vente_TTC: true,
            famille: {
              select: {
                name: true
              }
            }
          }
        }
      }
    });

    const result = await prisma.$transaction(async (tx) => {
      // Create inventory session
      const session = await tx.inventorySession.create({
        data: {
          numero: generateInventoryNumber(),
          depotId: targetDepotId,
          status: 'DRAFT',
          startedBy: req.user.id,
          notes: notes || null
        }
      });

      // Create inventory items for all products with stock
      const inventoryItems = inventory.map(item => ({
        sessionId: session.id,
        productId: item.productId,
        theoreticalQuantity: item.quantity
      }));

      await tx.inventoryItem.createMany({
        data: inventoryItems
      });

      return session;
    });

    await logAudit(req.user.id, 'inventory_sessions', result.id, 'CREATE', null, result);

    res.status(201).json(result);
  } catch (error) {
    console.error('Error creating inventory session:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update inventory session status
router.patch('/sessions/:id/status', requireRole(['ADMIN', 'MANAGER', 'STOCK_MANAGER']), async (req, res) => {
  try {
    const sessionId = parseInt(req.params.id);
    const { status, notes } = req.body;

    const validStatuses = ['DRAFT', 'IN_PROGRESS', 'CLOSED', 'POSTED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const session = await prisma.inventorySession.findUnique({
      where: { id: sessionId },
      include: {
        items: true
      }
    });

    if (!session) {
      return res.status(404).json({ error: 'Inventory session not found' });
    }

    // Validate status transitions
    if (status === 'IN_PROGRESS' && session.status !== 'DRAFT') {
      return res.status(400).json({ error: 'Can only start from DRAFT status' });
    }

    if (status === 'CLOSED' && !['DRAFT', 'IN_PROGRESS'].includes(session.status)) {
      return res.status(400).json({ error: 'Can only close from DRAFT or IN_PROGRESS status' });
    }

    if (status === 'POSTED' && session.status !== 'CLOSED') {
      return res.status(400).json({ error: 'Can only post from CLOSED status' });
    }

    const updateData = {
      status,
      notes: notes || session.notes
    };

    // Set appropriate user and timestamp based on status
    if (status === 'IN_PROGRESS') {
      // No additional fields needed
    } else if (status === 'CLOSED') {
      updateData.closedBy = req.user.id;
      updateData.closedAt = new Date();
    } else if (status === 'POSTED') {
      updateData.postedBy = req.user.id;
      updateData.postedAt = new Date();
    }

    const updatedSession = await prisma.inventorySession.update({
      where: { id: sessionId },
      data: updateData
    });

    await logAudit(req.user.id, 'inventory_sessions', sessionId, 'UPDATE', session, updatedSession);

    res.json(updatedSession);
  } catch (error) {
    console.error('Error updating inventory session status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new inventory item for a product
router.post('/sessions/:sessionId/items', requireRole(['ADMIN', 'MANAGER', 'STOCK_MANAGER']), async (req, res) => {
  try {
    const sessionId = parseInt(req.params.sessionId);
    const { productId, theoreticalQuantity } = req.body;

    // Validate session exists and is in correct status
    const session = await prisma.inventorySession.findUnique({
      where: { id: sessionId }
    });

    if (!session) {
      return res.status(404).json({ error: 'Inventory session not found' });
    }

    if (!['DRAFT', 'IN_PROGRESS'].includes(session.status)) {
      return res.status(400).json({ error: 'Cannot add items to this session status' });
    }

    // Check if product exists
    const product = await prisma.product.findUnique({
      where: { id: productId }
    });

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Check if inventory item already exists for this product in this session
    const existingItem = await prisma.inventoryItem.findFirst({
      where: {
        sessionId: sessionId,
        productId: productId
      }
    });

    if (existingItem) {
      return res.status(400).json({ error: 'Inventory item already exists for this product' });
    }

    // Create new inventory item
    const newItem = await prisma.inventoryItem.create({
      data: {
        sessionId: sessionId,
        productId: productId,
        theoreticalQuantity: theoreticalQuantity || 0
      },
      include: {
        product: {
          include: {
            famille: true
          }
        }
      }
    });

    await logAudit(req.user.id, 'inventory_items', newItem.id, 'CREATE', null, newItem);

    res.status(201).json(newItem);
  } catch (error) {
    console.error('Error creating inventory item:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update inventory item count
router.patch('/sessions/:sessionId/items/:itemId', requireRole(['ADMIN', 'MANAGER', 'STOCK_MANAGER']), async (req, res) => {
  try {
    const sessionId = parseInt(req.params.sessionId);
    const itemId = parseInt(req.params.itemId);
    const { countedQuantity, reason, notes } = req.body;

    console.log('Updating inventory item count:', {
      sessionId,
      itemId,
      countedQuantity,
      reason,
      notes,
      userId: req.user.id
    });

    // Validate session exists and is in correct status
    const session = await prisma.inventorySession.findUnique({
      where: { id: sessionId }
    });

    if (!session) {
      console.error('Inventory session not found:', sessionId);
      return res.status(404).json({ error: 'Inventory session not found' });
    }

    if (!['DRAFT', 'IN_PROGRESS'].includes(session.status)) {
      console.error('Cannot update items in session status:', session.status);
      return res.status(400).json({ 
        error: `Cannot update items in this session status: ${session.status}. Only DRAFT and IN_PROGRESS sessions can be updated.` 
      });
    }

    // Get the inventory item
    const item = await prisma.inventoryItem.findUnique({
      where: { id: itemId },
      include: {
        product: true
      }
    });

    if (!item || item.sessionId !== sessionId) {
      console.error('Inventory item not found:', { itemId, sessionId, itemExists: !!item });
      return res.status(404).json({ error: 'Inventory item not found' });
    }

    console.log('Found inventory item:', {
      itemId: item.id,
      productId: item.productId,
      productName: item.product.name,
      theoreticalQuantity: item.theoreticalQuantity,
      currentCountedQuantity: item.countedQuantity
    });

    // Calculate écart
    const ecartQuantity = countedQuantity !== null ? countedQuantity - item.theoreticalQuantity : null;
    const ecartValue = ecartQuantity !== null ? ecartQuantity * parseFloat(item.product.prix_vente_TTC) : null;

    const updateData = {
      countedQuantity,
      ecartQuantity,
      ecartValue,
      reason: reason || 'PHYSICAL_COUNT_DIFFERENCE',
      notes: notes || null,
      countedAt: countedQuantity !== null ? new Date() : null,
      countedBy: countedQuantity !== null ? req.user.id : null
    };

    console.log('Updating with data:', updateData);

    const updatedItem = await prisma.inventoryItem.update({
      where: { id: itemId },
      data: updateData,
      include: {
        product: {
          select: {
            id: true,
            name: true,
            barcode: true,
            unite: true,
            prix_vente_TTC: true,
            famille: {
              select: {
                name: true
              }
            }
          }
        },
        counter: {
          select: {
            firstName: true,
            lastName: true,
            username: true
          }
        }
      }
    });

    console.log('Successfully updated inventory item:', {
      itemId: updatedItem.id,
      countedQuantity: updatedItem.countedQuantity,
      ecartQuantity: updatedItem.ecartQuantity,
      ecartValue: updatedItem.ecartValue
    });

    await logAudit(req.user.id, 'inventory_items', itemId, 'UPDATE', item, updatedItem);

    res.json(updatedItem);
  } catch (error) {
    console.error('Error updating inventory item:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Post inventory session (apply stock adjustments)
router.post('/sessions/:id/post', requireRole(['ADMIN', 'MANAGER', 'STOCK_MANAGER']), async (req, res) => {
  try {
    const sessionId = parseInt(req.params.id);

    const session = await prisma.inventorySession.findUnique({
      where: { id: sessionId },
      include: {
        items: {
          include: {
            product: true
          }
        }
      }
    });

    if (!session) {
      return res.status(404).json({ error: 'Inventory session not found' });
    }

    if (session.status !== 'CLOSED') {
      return res.status(400).json({ error: 'Can only post closed inventory sessions' });
    }

    // Calculate totals
    const itemsWithEcart = session.items.filter(item => item.ecartQuantity !== null && item.ecartQuantity !== 0);
    const totalEcartValue = itemsWithEcart.reduce((sum, item) => sum + parseFloat(item.ecartValue || 0), 0);
    const totalEcartQty = itemsWithEcart.reduce((sum, item) => sum + parseFloat(item.ecartQuantity || 0), 0);

    const result = await prisma.$transaction(async (tx) => {
      // Update session with totals and mark as posted
      const updatedSession = await tx.inventorySession.update({
        where: { id: sessionId },
        data: {
          status: 'POSTED',
          postedBy: req.user.id,
          postedAt: new Date(),
          totalEcartValue,
          totalEcartQty
        }
      });

      // Apply stock adjustments for items with écart
      for (const item of itemsWithEcart) {
        if (item.ecartQuantity !== 0) {
          // Update inventory
          const inventory = await tx.inventory.findUnique({
            where: {
              depotId_productId: {
                depotId: session.depotId,
                productId: item.productId
              }
            }
          });

          if (inventory) {
            const newQuantity = parseFloat(inventory.quantity) + parseFloat(item.ecartQuantity);
            await tx.inventory.update({
              where: { id: inventory.id },
              data: { quantity: newQuantity }
            });
          } else {
            // Create new inventory entry if it doesn't exist
            await tx.inventory.create({
              data: {
                depotId: session.depotId,
                productId: item.productId,
                quantity: parseFloat(item.ecartQuantity)
              }
            });
          }

          // Create stock movement record
          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              depotId: session.depotId,
              quantity: parseFloat(item.ecartQuantity),
              type: parseFloat(item.ecartQuantity) > 0 ? 'IN' : 'OUT',
              reason: 'INVENTORY_ADJUSTMENT',
              reference: session.numero,
              userId: req.user.id
            }
          });
        }
      }

      return updatedSession;
    });

    await logAudit(req.user.id, 'inventory_sessions', sessionId, 'UPDATE', session, result);

    res.json({
      message: 'Inventory session posted successfully',
      session: result,
      adjustmentsApplied: itemsWithEcart.length,
      totalEcartValue,
      totalEcartQty
    });
  } catch (error) {
    console.error('Error posting inventory session:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get inventory session summary/statistics
router.get('/sessions/:id/summary', requireRole(['ADMIN', 'MANAGER', 'STOCK_MANAGER']), async (req, res) => {
  try {
    const sessionId = parseInt(req.params.id);

    const session = await prisma.inventorySession.findUnique({
      where: { id: sessionId },
      include: {
        items: {
          include: {
            product: {
              select: {
                name: true,
                prix_vente_TTC: true
              }
            }
          }
        }
      }
    });

    if (!session) {
      return res.status(404).json({ error: 'Inventory session not found' });
    }

    const totalItems = session.items.length;
    const countedItems = session.items.filter(item => item.countedQuantity !== null).length;
    const itemsWithEcart = session.items.filter(item => item.ecartQuantity !== null && item.ecartQuantity !== 0);
    
    const summary = {
      session: {
        id: session.id,
        numero: session.numero,
        status: session.status,
        startedAt: session.startedAt,
        closedAt: session.closedAt,
        postedAt: session.postedAt
      },
      statistics: {
        totalItems,
        countedItems,
        remainingItems: totalItems - countedItems,
        itemsWithEcart: itemsWithEcart.length,
        totalEcartValue: itemsWithEcart.reduce((sum, item) => sum + parseFloat(item.ecartValue || 0), 0),
        totalEcartQty: itemsWithEcart.reduce((sum, item) => sum + parseFloat(item.ecartQuantity || 0), 0)
      },
      ecarts: itemsWithEcart.map(item => ({
        productId: item.productId,
        productName: item.product.name,
        theoreticalQuantity: item.theoreticalQuantity,
        countedQuantity: item.countedQuantity,
        ecartQuantity: item.ecartQuantity,
        ecartValue: item.ecartValue,
        reason: item.reason,
        notes: item.notes
      }))
    };

    res.json(summary);
  } catch (error) {
    console.error('Error fetching inventory session summary:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete inventory session (only if DRAFT)
router.delete('/sessions/:id', requireRole(['ADMIN', 'MANAGER', 'STOCK_MANAGER']), async (req, res) => {
  try {
    const sessionId = parseInt(req.params.id);

    const session = await prisma.inventorySession.findUnique({
      where: { id: sessionId }
    });

    if (!session) {
      return res.status(404).json({ error: 'Inventory session not found' });
    }

    if (session.status !== 'DRAFT') {
      return res.status(400).json({ error: 'Can only delete DRAFT inventory sessions' });
    }

    await prisma.inventorySession.delete({
      where: { id: sessionId }
    });

    await logAudit(req.user.id, 'inventory_sessions', sessionId, 'DELETE', session, null);

    res.json({ message: 'Inventory session deleted successfully' });
  } catch (error) {
    console.error('Error deleting inventory session:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
