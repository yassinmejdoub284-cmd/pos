const express = require('express');
const { prisma } = require('../lib/prisma');
const { authenticateToken } = require('../middleware/auth');
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
router.get('/count/:depotId', authenticateToken, async (req, res) => {
  try {
    const depotId = parseInt(req.params.depotId);
    
    // Get depot information to determine product source
    const depot = await prisma.depot.findUnique({
      where: { id: depotId }
    });

    if (!depot) {
      return res.status(404).json({ error: 'Depot not found' });
    }

    let count = 0;

    // IMPORTANT: Product source depends on depot type
    // - SHOP depots: Use general 'inventory' table (linked to 'produits')
    // - Other depot types (MAIN, BRANCH, WAREHOUSE): Use 'produits-de-caisse' table
    if (depot.type === 'SHOP') {
      // For SHOP depots, count from general inventory table
      count = await prisma.inventory.count({
        where: {
          depotId: depotId,
          quantity: {
            gt: 0
          }
        }
      });
    } else {
      // For NOT SHOP depots (MAIN, BRANCH, WAREHOUSE), count from produits-de-caisse
      count = await prisma.produitDeCaisse.count({
        where: {
          isActive: true,
          depotAssignments: {
            some: {
              depotId: depotId
            }
          }
        }
      });
    }

    res.json(count);
  } catch (error) {
    console.error('Error getting inventory count:', error);
    res.status(500).json({ error: 'Internal server error' + (error?.message ? ' : ' + error.message : ''), code: error?.code });
  }
});

// Get all inventory sessions
router.get('/sessions', authenticateToken, async (req, res) => {
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
            code: true,
            type: true
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
    res.status(500).json({ error: 'Internal server error' + (error?.message ? ' : ' + error.message : ''), code: error?.code });
  }
});

// Get single inventory session with items
router.get('/sessions/:id', authenticateToken, async (req, res) => {
  try {
    const sessionId = parseInt(req.params.id);

    const session = await prisma.inventorySession.findUnique({
      where: { id: sessionId },
      include: {
        depot: {
          select: {
            name: true,
            code: true,
            type: true
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
            counter: {
              select: {
                firstName: true,
                lastName: true,
                username: true
              }
            }
          },
          orderBy: {
            id: 'asc'
          }
        }
      }
    });

    if (!session) {
      return res.status(404).json({ error: 'Inventory session not found' });
    }

    // IMPORTANT: Product source depends on depot type
    // - SHOP depots: Use general 'product' table
    // - Other depot types (MAIN, BRANCH, WAREHOUSE): Use 'produitDeCaisse' table
    if (session.depot.type === 'SHOP') {
      // For SHOP depots, get product details from general product table
      const itemsWithProducts = await Promise.all(
        session.items.map(async (item) => {
          const product = await prisma.product.findUnique({
            where: { id: item.productId },
            select: {
              id: true,
              name: true,
              barcode: true,
              unite: true,
              prix_vente_TTC: true,
              prix_achat: true,
              tva: true,
              famille: {
                select: {
                  id: true,
                  name: true
                }
              }
            }
          });
          
          if (!product) {
            console.warn(`Product not found for productId: ${item.productId} in SHOP depot`);
          }
          
          return { ...item, product };
        })
      );
      session.items = itemsWithProducts;
    } else {
      // For NOT SHOP depots, get product details from produitDeCaisse table
      const itemsWithProducts = await Promise.all(
        session.items.map(async (item) => {
          const product = await prisma.produitDeCaisse.findUnique({
            where: { id: item.productId },
            select: {
              id: true,
              name: true,
              barcode: true,
              unite: true,
              prix_vente_TTC: true,
              prix_achat: true,
              famille: {
                select: {
                  name: true
                }
              }
            }
          });
          
          if (!product) {
            console.warn(`ProduitDeCaisse not found for productId: ${item.productId} in NOT SHOP depot`);
          }
          
          return { ...item, product };
        })
      );
      session.items = itemsWithProducts;
    }

    res.json(session);
  } catch (error) {
    console.error('Error fetching inventory session:', error);
    res.status(500).json({ error: 'Internal server error' + (error?.message ? ' : ' + error.message : ''), code: error?.code });
  }
});

// Start new inventory session
router.post('/sessions', authenticateToken, async (req, res) => {
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

    // Get depot information to determine product source
    const depot = await prisma.depot.findUnique({
      where: { id: targetDepotId }
    });

    if (!depot) {
      return res.status(404).json({ error: 'Depot not found' });
    }

    let inventory = [];

    // IMPORTANT: Product source depends on depot type
    // - SHOP depots: Use general 'inventory' table (linked to 'produits')
    // - Other depot types (MAIN, BRANCH, WAREHOUSE): Use 'produits-de-caisse' table
    if (depot.type === 'SHOP') {
      // For SHOP depots, get from general inventory table
      inventory = await prisma.inventory.findMany({
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
    } else {
      // For NOT SHOP depots (MAIN, BRANCH, WAREHOUSE), get from produits-de-caisse
      const produitsDeCaisse = await prisma.produitDeCaisse.findMany({
        where: {
          isActive: true,
          depotAssignments: {
            some: {
              depotId: targetDepotId
            }
          }
        },
        include: {
          famille: {
            select: {
              name: true
            }
          }
        }
      });

      // Get actual inventory quantities for these products
      const inventoryRecords = await prisma.inventory.findMany({
        where: {
          depotId: targetDepotId,
          productId: {
            in: produitsDeCaisse.map(p => p.id)
          }
        }
      });

      // Create a map of productId -> quantity for quick lookup
      const inventoryMap = new Map();
      inventoryRecords.forEach(record => {
        inventoryMap.set(record.productId, parseFloat(record.quantity) || 0);
      });

      // Convert produits-de-caisse to inventory format with actual quantities
      inventory = produitsDeCaisse.map(produit => ({
        productId: produit.id,
        quantity: inventoryMap.get(produit.id) || 0, // Use actual inventory quantity
        product: {
          id: produit.id,
          name: produit.name,
          barcode: produit.barcode,
          unite: produit.unite,
          prix_vente_TTC: produit.prix_vente_TTC,
          famille: produit.famille
        }
      }));
    }

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
    res.status(500).json({ error: 'Internal server error' + (error?.message ? ' : ' + error.message : ''), code: error?.code });
  }
});

// Update inventory session status
router.patch('/sessions/:id/status', authenticateToken, async (req, res) => {
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
    res.status(500).json({ error: 'Internal server error' + (error?.message ? ' : ' + error.message : ''), code: error?.code });
  }
});

// Create new inventory item for a product
router.post('/sessions/:sessionId/items', authenticateToken, async (req, res) => {
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
      // Allow ADMIN to add items regardless of status
      if (req.user?.role !== 'ADMIN') {
        return res.status(400).json({ error: 'Cannot add items to this session status' });
      }
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
    res.status(500).json({ error: 'Internal server error' + (error?.message ? ' : ' + error.message : ''), code: error?.code });
  }
});

// Update inventory item count
router.patch('/sessions/:sessionId/items/:itemId', authenticateToken, async (req, res) => {
  try {
    const sessionId = parseInt(req.params.sessionId);
    const itemId = parseInt(req.params.itemId);
    const { countedQuantity, reason, notes } = req.body;


    // Validate session exists and is in correct status
    const session = await prisma.inventorySession.findUnique({
      where: { id: sessionId }
    });

    if (!session) {
      console.error('Inventory session not found:', sessionId);
      return res.status(404).json({ error: 'Inventory session not found' });
    }

    if (!['DRAFT', 'IN_PROGRESS'].includes(session.status)) {
      // Allow ADMIN to update items regardless of status
      if (req.user?.role !== 'ADMIN') {
        console.error('Cannot update items in session status:', session.status);
        return res.status(400).json({ 
          error: `Cannot update items in this session status: ${session.status}. Only DRAFT and IN_PROGRESS sessions can be updated.` 
        });
      }
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

    // Calculate écart
    const oldEcartQuantity = item.ecartQuantity ? parseFloat(item.ecartQuantity) : 0;
    const newEcartQuantity = countedQuantity !== null ? parseFloat(countedQuantity) - parseFloat(item.theoreticalQuantity) : null;
    const ecartValue = newEcartQuantity !== null ? newEcartQuantity * parseFloat(item.product.prix_vente_TTC) : null;

    // Calculate the difference in écart to apply to stock
    const ecartDifference = newEcartQuantity !== null ? newEcartQuantity - oldEcartQuantity : -oldEcartQuantity;

    const updateData = {
      countedQuantity,
      ecartQuantity: newEcartQuantity,
      ecartValue,
      reason: reason || 'PHYSICAL_COUNT_DIFFERENCE',
      notes: notes || null,
      countedAt: countedQuantity !== null ? new Date() : null,
      countedBy: countedQuantity !== null ? req.user.id : null
    };




    // Update inventory item and stock in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Update inventory item
      const updatedItem = await tx.inventoryItem.update({
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

      // Update stock immediately if there's a change in écart
      if (Math.abs(ecartDifference) > 0.001) {
        // Get session depot
        const sessionDepot = await tx.depot.findUnique({
          where: { id: session.depotId }
        });

        if (sessionDepot) {
          // Update inventory for the session depot
          const inventory = await tx.inventory.findUnique({
            where: {
              depotId_productId: {
                depotId: session.depotId,
                productId: item.productId
              }
            }
          });

          if (inventory) {
            const currentQuantity = parseFloat(inventory.quantity);
            const newQuantity = currentQuantity + ecartDifference;
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
                quantity: ecartDifference
              }
            });

          }

          // Create stock movement record
          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              depotId: session.depotId,
              quantity: ecartDifference,
              type: ecartDifference > 0 ? 'IN' : 'OUT',
              reason: 'INVENTORY_ADJUSTMENT',
              reference: session.numero,
              userId: req.user.id
            }
          });
        }
      }

      return updatedItem;
    });

    await logAudit(req.user.id, 'inventory_items', itemId, 'UPDATE', item, result);

    res.json(result);
  } catch (error) {
    console.error('Error updating inventory item:', error);
    res.status(500).json({ error: 'Internal server error' + (error?.message ? ' : ' + error.message : ''), code: error?.code });
  }
});

// Delete inventory item
router.delete('/sessions/:sessionId/items/:itemId', authenticateToken, async (req, res) => {
  try {
    const sessionId = parseInt(req.params.sessionId);
    const itemId = parseInt(req.params.itemId);


    // Validate session exists and is in correct status
    const session = await prisma.inventorySession.findUnique({
      where: { id: sessionId }
    });

    if (!session) {
      console.error('Inventory session not found:', sessionId);
      return res.status(404).json({ error: 'Inventory session not found' });
    }

    if (!['DRAFT', 'IN_PROGRESS'].includes(session.status)) {
      // Allow ADMIN to delete items regardless of status
      if (req.user?.role !== 'ADMIN') {
        console.error('Cannot delete items in session status:', session.status);
        return res.status(400).json({ 
          error: `Cannot delete items in this session status: ${session.status}. Only DRAFT and IN_PROGRESS sessions can be modified.` 
        });
      }
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

    // If item has a counted quantity that affected stock, we need to revert the stock change
    // The stock was updated when the item was counted, so we need to reverse that change
    const ecartQuantity = item.ecartQuantity ? parseFloat(item.ecartQuantity) : 0;

    // Delete inventory item and revert stock in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Revert stock change if there was an écart
      if (Math.abs(ecartQuantity) > 0.001) {
        // Get session depot
        const sessionDepot = await tx.depot.findUnique({
          where: { id: session.depotId }
        });

        if (sessionDepot) {
          // Revert the inventory change (opposite of what was applied)
          const inventory = await tx.inventory.findUnique({
            where: {
              depotId_productId: {
                depotId: session.depotId,
                productId: item.productId
              }
            }
          });

          if (inventory) {
            const currentQuantity = parseFloat(inventory.quantity);
            const newQuantity = currentQuantity - ecartQuantity; // Revert the change
            await tx.inventory.update({
              where: { id: inventory.id },
              data: { quantity: newQuantity }
            });

          }

          // Create stock movement record for the reversal
          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              depotId: session.depotId,
              quantity: Math.abs(ecartQuantity),
              type: ecartQuantity > 0 ? 'OUT' : 'IN', // Opposite of original
              reason: 'INVENTORY_ITEM_DELETED',
              reference: session.numero,
              userId: req.user.id
            }
          });
        }
      }

      // Delete the inventory item
      const deletedItem = await tx.inventoryItem.delete({
        where: { id: itemId }
      });

      return deletedItem;
    });

    await logAudit(req.user.id, 'inventory_items', itemId, 'DELETE', item, null);


    res.json({ message: 'Inventory item deleted successfully', item: result });
  } catch (error) {
    console.error('Error deleting inventory item:', error);
    res.status(500).json({ error: 'Internal server error' + (error?.message ? ' : ' + error.message : ''), code: error?.code });
  }
});

// Post inventory session (apply stock adjustments)
router.post('/sessions/:id/post', authenticateToken, async (req, res) => {
  try {
    const sessionId = parseInt(req.params.id);
    
    if (isNaN(sessionId)) {
      return res.status(400).json({ error: 'Invalid session ID' });
    }

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

    // Allow posting from any status - auto-close if not already closed or posted
    if (session.status === 'POSTED') {
      return res.status(400).json({ 
        error: 'Inventory session has already been posted',
        currentStatus: session.status,
        sessionId: sessionId
      });
    }

    if (!session.items || session.items.length === 0) {
      return res.status(400).json({ 
        error: 'Cannot post inventory session with no items',
        sessionId: sessionId
      });
    }

    // Auto-close session if it's not already closed
    let sessionToPost = session;

    // Calculate totals - calculate ecart for all items if not already calculated
    let totalEcartValue = 0;
    let totalEcartQty = 0;
    
    for (const item of sessionToPost.items) {
      let ecartQty = item.ecartQuantity;
      
      // Calculate ecart if not already set
      if (ecartQty === null || ecartQty === undefined) {
        const counted = item.countedQuantity !== null && item.countedQuantity !== undefined
          ? parseFloat(item.countedQuantity)
          : null;
        const theoretical = item.theoreticalQuantity !== null && item.theoreticalQuantity !== undefined
          ? parseFloat(item.theoreticalQuantity)
          : 0;
        
        if (counted !== null) {
          ecartQty = counted - theoretical;
        }
      }
      
      if (ecartQty !== null && ecartQty !== undefined && Math.abs(parseFloat(ecartQty)) > 0.001) {
        totalEcartQty += parseFloat(ecartQty);
        
        // Calculate ecart value if not set
        let ecartVal = item.ecartValue;
        if ((ecartVal === null || ecartVal === undefined) && item.product && item.product.prix_vente_TTC) {
          ecartVal = parseFloat(ecartQty) * parseFloat(item.product.prix_vente_TTC || 0);
        }
        
        if (ecartVal !== null && ecartVal !== undefined) {
          totalEcartValue += parseFloat(ecartVal);
        }
      }
    }

    // Get session depot info to find related depots
    const sessionDepot = await prisma.depot.findUnique({
      where: { id: sessionToPost.depotId }
    });

    // Find primary SHOP depot (caisse) - get the first active SHOP depot
    const shopDepot = await prisma.depot.findFirst({
      where: {
        type: 'SHOP',
        isActive: true
      },
      orderBy: { id: 'asc' }
    });

    // Find primary MAIN/WAREHOUSE depot (general stock) - prefer MAIN, then WAREHOUSE
    const mainDepot = await prisma.depot.findFirst({
      where: {
        type: 'MAIN',
        isActive: true
      },
      orderBy: { id: 'asc' }
    }) || await prisma.depot.findFirst({
      where: {
        type: 'WAREHOUSE',
        isActive: true
      },
      orderBy: { id: 'asc' }
    });

    // Fetch all entry documents and sales once (outside the loop) to optimize performance
    const allEntryDocuments = await prisma.stockDocument.findMany({
      where: {
        destinataireId: sessionToPost.depotId,
        type: { in: ['BON_ENTREE_DEPOT', 'BON_ENTREE_MAGASIN'] },
        status: 'RECEIVED'
      },
      include: {
        items: true
      }
    });

    const allSales = await prisma.sale.findMany({
      where: {
        depotId: sessionToPost.depotId,
        status: { in: ['COMPLETED', 'CMD_TERMINEE'] },
        paymentType: { in: ['COMPTANT', 'CREDIT'] }
      },
      include: {
        items: true
      }
    });

    // Pre-calculate theoretical stock per product in memory
    const theoreticalStockMap = new Map();
    const productIds = sessionToPost.items.map(item => item.productId);
    
    productIds.forEach(productId => {
      let totalEntries = 0;
      allEntryDocuments.forEach(doc => {
        doc.items.forEach(docItem => {
          if (docItem.productId === productId) {
            totalEntries += parseFloat(docItem.quantity || 0);
          }
        });
      });

      let totalExits = 0;
      allSales.forEach(sale => {
        sale.items.forEach(saleItem => {
          if (saleItem.productId === productId) {
            const actualQuantity = sale.isWholesale && saleItem.isWholesale && saleItem.bundleSize
              ? (parseFloat(saleItem.bundleQuantity || saleItem.quantity || 0)) * parseFloat(saleItem.bundleSize || 1)
              : parseFloat(saleItem.quantity || 0);
            totalExits += actualQuantity;
          }
        });
      });

      theoreticalStockMap.set(productId, totalEntries - totalExits);
    });

    // Get all existing inventory entries in one query
    const existingInventories = await prisma.inventory.findMany({
      where: {
        depotId: sessionToPost.depotId,
        productId: { in: productIds }
      }
    });
    const inventoryMap = new Map();
    existingInventories.forEach(inv => {
      inventoryMap.set(inv.productId, inv);
    });

    // Prepare batch operations
    const inventoryUpdates = [];
    const inventoryCreates = [];
    const stockMovements = [];

    // Process all items and prepare batch operations
    for (const item of sessionToPost.items) {
      const productId = item.productId;
      
      // Handle Prisma Decimal types - convert to number
      const countedQty = item.countedQuantity !== null && item.countedQuantity !== undefined
        ? (typeof item.countedQuantity === 'object' && item.countedQuantity.toNumber 
            ? item.countedQuantity.toNumber() 
            : parseFloat(item.countedQuantity))
        : null;
      
      const theoreticalQty = item.theoreticalQuantity !== null && item.theoreticalQuantity !== undefined
        ? (typeof item.theoreticalQuantity === 'object' && item.theoreticalQuantity.toNumber
            ? item.theoreticalQuantity.toNumber()
            : parseFloat(item.theoreticalQuantity))
        : 0;
      
      // Use counted quantity if available, otherwise use theoretical quantity, default to 0
      const countedQuantity = countedQty !== null ? countedQty : theoreticalQty;
      
      // Ensure countedQuantity is a valid number
      const newStockQuantity = isNaN(countedQuantity) ? 0 : Math.max(0, countedQuantity);
      
      // Prepare inventory update/create
      const existingInventory = inventoryMap.get(productId);
      if (existingInventory) {
        inventoryUpdates.push({
          where: { id: existingInventory.id },
          data: { quantity: newStockQuantity }
        });
      } else {
        inventoryCreates.push({
          depotId: sessionToPost.depotId,
          productId: productId,
          quantity: newStockQuantity
        });
      }

      // Calculate theoretical stock and difference
      const theoreticalStock = theoreticalStockMap.get(productId) || 0;
      const ecartQuantity = newStockQuantity - theoreticalStock;
      
      // Prepare stock movement if there's a difference
      if (Math.abs(ecartQuantity) > 0.001) {
        const movementType = ecartQuantity > 0 ? 'IN' : 'OUT';
        stockMovements.push({
          productId: productId,
          depotId: sessionToPost.depotId,
          quantity: Math.abs(ecartQuantity),
          type: movementType,
          toDepotId: movementType === 'IN' ? sessionToPost.depotId : null,
          reason: 'INVENTORY_ADJUSTMENT',
          reference: sessionToPost.numero,
          userId: req.user.id
        });
      }
    }

    // Execute all operations in a single transaction with increased timeout
    const result = await prisma.$transaction(async (tx) => {
      // Update session with totals and mark as posted
      const updateData = {
        status: 'POSTED',
        postedBy: req.user.id,
        postedAt: new Date()
      };
      
      // Only set totals if they are meaningful (not zero or null)
      if (totalEcartValue !== null && totalEcartValue !== undefined && totalEcartValue !== 0) {
        updateData.totalEcartValue = totalEcartValue;
      }
      if (totalEcartQty !== null && totalEcartQty !== undefined && totalEcartQty !== 0) {
        updateData.totalEcartQty = totalEcartQty;
      }
      
      const updatedSession = await tx.inventorySession.update({
        where: { id: sessionId },
        data: updateData
      });

      // Batch update existing inventory entries
      await Promise.all(
        inventoryUpdates.map(update => 
          tx.inventory.update(update)
        )
      );

      // Batch create new inventory entries
      if (inventoryCreates.length > 0) {
        await tx.inventory.createMany({
          data: inventoryCreates
        });
      }

      // Batch create stock movements
      if (stockMovements.length > 0) {
        await tx.stockMovement.createMany({
          data: stockMovements
        });
      }

      return updatedSession;
    }, {
      maxWait: 10000, // Maximum time to wait for a transaction slot
      timeout: 30000  // Maximum time the transaction can run (30 seconds)
    });

    await logAudit(req.user.id, 'inventory_sessions', sessionId, 'UPDATE', sessionToPost, result);

    // Count items with adjustments
    const adjustmentsCount = sessionToPost.items.filter(item => {
      const ecartQty = item.ecartQuantity !== null && item.ecartQuantity !== undefined
        ? parseFloat(item.ecartQuantity)
        : null;
      return ecartQty !== null && Math.abs(ecartQty) > 0.001;
    }).length;

    res.json({
      message: 'Inventory session posted successfully',
      session: result,
      adjustmentsApplied: adjustmentsCount,
      totalEcartValue: totalEcartValue || 0,
      totalEcartQty: totalEcartQty || 0
    });
  } catch (error) {
    console.error('Error posting inventory session:', error);
    console.error('Error stack:', error.stack);
    console.error('Error details:', JSON.stringify(error, null, 2));
    
    // Return more detailed error information
    if (error.code === 'P2002') {
      return res.status(400).json({ 
        error: 'Validation error',
        details: error.meta?.target || 'Unique constraint violation',
        message: error.message
      });
    }
    if (error.code === 'P2003') {
      return res.status(400).json({ 
        error: 'Foreign key constraint violation',
        details: error.meta?.field_name || 'Invalid reference',
        message: error.message
      });
    }
    if (error.code && error.code.startsWith('P')) {
      return res.status(400).json({ 
        error: 'Database error',
        code: error.code,
        message: error.message,
        meta: error.meta
      });
    }
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message || 'An unexpected error occurred',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Get inventory session summary/statistics
router.get('/sessions/:id/summary', authenticateToken, async (req, res) => {
  try {
    const sessionId = parseInt(req.params.id);

    const session = await prisma.inventorySession.findUnique({
      where: { id: sessionId },
      include: {
        depot: {
          select: {
            type: true
          }
        },
        items: true
      }
    });

    if (!session) {
      return res.status(404).json({ error: 'Inventory session not found' });
    }

    // IMPORTANT: Product source depends on depot type
    // - SHOP depots: Use general 'product' table
    // - Other depot types (MAIN, BRANCH, WAREHOUSE): Use 'produitDeCaisse' table
    let itemsWithProducts = [];
    
    if (session.depot.type === 'SHOP') {
      // For SHOP depots, get product details from general product table
      itemsWithProducts = await Promise.all(
        session.items.map(async (item) => {
          const product = await prisma.product.findUnique({
            where: { id: item.productId },
            select: {
              name: true,
              prix_vente_TTC: true,
              prix_achat: true
            }
          });
          
          if (!product) {
            console.warn(`Product not found for productId: ${item.productId} in SHOP depot (summary)`);
          }
          
          return { ...item, product };
        })
      );
    } else {
      // For NOT SHOP depots, get product details from produitDeCaisse table
      itemsWithProducts = await Promise.all(
        session.items.map(async (item) => {
          const product = await prisma.produitDeCaisse.findUnique({
            where: { id: item.productId },
            select: {
              name: true,
              prix_vente_TTC: true
            }
          });
          
          if (!product) {
            console.warn(`ProduitDeCaisse not found for productId: ${item.productId} in NOT SHOP depot (summary)`);
          }
          
          return { ...item, product };
        })
      );
    }

    const totalItems = itemsWithProducts.length;
    const countedItems = itemsWithProducts.filter(item => item.countedQuantity !== null).length;
    const itemsWithEcart = itemsWithProducts.filter(item => item.ecartQuantity !== null && item.ecartQuantity !== 0);
    
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
        productName: item.product?.name || 'Produit inconnu',
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
    res.status(500).json({ error: 'Internal server error' + (error?.message ? ' : ' + error.message : ''), code: error?.code });
  }
});

// Delete inventory session (only if DRAFT, or POSTED for ADMIN)
router.delete('/sessions/:id', authenticateToken, async (req, res) => {
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

    if (session.status !== 'DRAFT' && req.user?.role !== 'ADMIN') {
      return res.status(400).json({ error: 'Can only delete DRAFT inventory sessions. Only ADMIN can delete POSTED sessions.' });
    }

    // If session is POSTED, we need to revert stock changes
    if (session.status === 'POSTED') {
      const postedAt = session.postedAt || session.closedAt || session.createdAt;
      
      await prisma.$transaction(async (tx) => {
        // For each item in the inventory session, revert stock to original state
        for (const item of session.items) {
          const productId = item.productId;
          const theoreticalQuantity = parseFloat(item.theoreticalQuantity || 0);
          const countedQuantity = parseFloat(item.countedQuantity || item.theoreticalQuantity || 0);
          
          // Get all sales (exits) that happened AFTER the inventory was posted
          const salesAfterInventory = await tx.sale.findMany({
            where: {
              depotId: session.depotId,
              status: { in: ['COMPLETED', 'CMD_TERMINEE'] },
              paymentType: { in: ['COMPTANT', 'CREDIT'] },
              createdAt: { gte: postedAt }
            },
            include: {
              items: {
                where: {
                  productId: productId
                }
              }
            }
          });
          
          let totalExitsAfter = 0;
          salesAfterInventory.forEach(sale => {
            sale.items.forEach(saleItem => {
              const actualQuantity = sale.isWholesale && saleItem.isWholesale && saleItem.bundleSize
                ? (parseFloat(saleItem.bundleQuantity || saleItem.quantity || 0)) * parseFloat(saleItem.bundleSize || 1)
                : parseFloat(saleItem.quantity || 0);
              totalExitsAfter += actualQuantity;
            });
          });
          
          // Get all entries that happened AFTER the inventory was posted
          const entryDocumentsAfter = await tx.stockDocument.findMany({
            where: {
              destinataireId: session.depotId,
              type: { in: ['BON_ENTREE_DEPOT', 'BON_ENTREE_MAGASIN'] },
              status: 'RECEIVED',
              createdAt: { gte: postedAt }
            },
            include: {
              items: {
                where: {
                  productId: productId
                }
              }
            }
          });
          
          let totalEntriesAfter = 0;
          entryDocumentsAfter.forEach(doc => {
            doc.items.forEach(docItem => {
              totalEntriesAfter += parseFloat(docItem.quantity || 0);
            });
          });
          
          // Calculate original stock before inventory
          // Original stock = theoretical quantity (what was in stock before inventory)
          // Current stock after inventory = counted quantity
          // Stock after sales/entries = counted quantity - exits + entries
          // We want to revert to: original stock - exits after + entries after
          const originalStock = theoreticalQuantity;
          const revertedStock = originalStock - totalExitsAfter + totalEntriesAfter;
          
          // Update inventory to reverted stock
          const inventory = await tx.inventory.findUnique({
            where: {
              depotId_productId: {
                depotId: session.depotId,
                productId: productId
              }
            }
          });

          if (inventory) {
            await tx.inventory.update({
              where: { id: inventory.id },
              data: { quantity: revertedStock }
            });

          } else {
            // Create inventory entry if it doesn't exist
            await tx.inventory.create({
              data: {
                depotId: session.depotId,
                productId: productId,
                quantity: revertedStock
              }
            });

          }
          
          // Create stock movement record for the reversion
          const stockChange = revertedStock - countedQuantity;
          if (Math.abs(stockChange) > 0.001) {
            await tx.stockMovement.create({
              data: {
                productId: productId,
                depotId: session.depotId,
                quantity: Math.abs(stockChange),
                type: stockChange > 0 ? 'IN' : 'OUT',
                reason: 'INVENTORY_DELETED',
                reference: `DELETED: ${session.numero}`,
                userId: req.user.id
              }
            });
          }
        }
        
        // Delete the inventory session
        await tx.inventorySession.delete({
          where: { id: sessionId }
        });
      });
    } else {
      // For DRAFT sessions, just delete without reverting stock
      await prisma.inventorySession.delete({
        where: { id: sessionId }
      });
    }

    await logAudit(req.user.id, 'inventory_sessions', sessionId, 'DELETE', session, null);

    res.json({ message: 'Inventory session deleted successfully' });
  } catch (error) {
    console.error('Error deleting inventory session:', error);
    res.status(500).json({ error: 'Internal server error' + (error?.message ? ' : ' + error.message : ''), code: error?.code });
  }
});

module.exports = router;
