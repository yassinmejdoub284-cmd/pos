const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken } = require('../middleware/auth');
const { AuditLogger } = require('../lib/audit');

const router = express.Router();
const prisma = new PrismaClient();

// Create releve inventaire entries
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { depotId, entries, date } = req.body;

    // Validate required fields
    if (!depotId || !entries || !Array.isArray(entries)) {
      return res.status(400).json({ 
        error: 'Missing required fields: depotId, entries' 
      });
    }

    // Create releve inventaire entries
    const createdEntries = await prisma.releveInventaire.createMany({
      data: entries.map(entry => ({
        depotId: parseInt(depotId),
        productId: entry.productId,
        designation: entry.designation,
        debut: parseFloat(entry.debut) || 0,
        credit: parseFloat(entry.credit) || 0,
        solde: parseFloat(entry.solde) || 0,
        type: entry.type || 'INVENTORY',
        details: entry.details || '',
        date: new Date(entry.date || date),
        createdAt: new Date()
      }))
    });

    // Log audit
    try {
      await AuditLogger.log({
        userId: req.user.id,
        action: 'CREATE',
        entityType: 'ReleveInventaire',
        entityId: null,
        details: `Created ${entries.length} releve inventaire entries for depot ${depotId}`
      });
    } catch (auditError) {
      console.error('Error logging audit:', auditError);
    }

    res.status(201).json({ 
      message: 'Releve inventaire entries created successfully',
      count: createdEntries.count 
    });
  } catch (error) {
    console.error('Error creating releve inventaire entries:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get releve inventaire entries for a depot
router.get('/depot/:depotId', authenticateToken, async (req, res) => {
  try {
    const { depotId } = req.params;
    const { date } = req.query;

    const whereClause = {
      depotId: parseInt(depotId)
    };

    if (date) {
      const startDate = new Date(date);
      const endDate = new Date(date);
      endDate.setDate(endDate.getDate() + 1);
      
      whereClause.date = {
        gte: startDate,
        lt: endDate
      };
    }

    const entries = await prisma.releveInventaire.findMany({
      where: whereClause,
      include: {
        product: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json(entries);
  } catch (error) {
    console.error('Error fetching releve inventaire entries:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

// Create a single inventory line from an inventory session
router.post('/from-session/:sessionId', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { depotId } = req.body;

    if (!depotId) {
      return res.status(400).json({ error: 'Missing required field: depotId' });
    }

    // Load session with items
    const session = await prisma.inventorySession.findUnique({
      where: { id: Number(sessionId) },
      include: {
        items: true
      }
    });

    if (!session) {
      return res.status(404).json({ error: 'Inventory session not found' });
    }

    // Load products needed for pricing
    const productIds = [...new Set(session.items.map(i => i.productId))];
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, prix_vente_TTC: true, name: true }
    });
    const productMap = new Map(products.map(p => [p.id, p]));

    // Compute total inventory value at PV based on counted quantities
    let totalInventoryValue = 0;
    for (const item of session.items) {
      const product = productMap.get(item.productId);
      if (!product) continue;
      const qty = Number(item.countedQuantity ?? 0);
      const unit = Number(product.prix_vente_TTC ?? 0);
      totalInventoryValue += qty * unit;
    }

    // Create inventory line in releve
    await prisma.releveInventaire.create({
      data: {
        depotId: Number(depotId),
        productId: null,
        designation: `INVENTAIRE | Session #${session.id}`,
        debut: 0,
        credit: 0,
        solde: totalInventoryValue,
        type: 'INVENTORY',
        details: `Inventaire posté - ${session.items.length} articles`,
        date: new Date(session.postedAt || session.closedAt || session.createdAt)
      }
    });

    try {
      await AuditLogger.log({
        userId: req.user.id,
        action: 'CREATE',
        entityType: 'ReleveInventaire',
        entityId: null,
        details: `Inventory line created from session ${session.id} for depot ${depotId}`
      });
    } catch (auditError) {
      console.error('Error logging audit:', auditError);
    }

    res.status(201).json({ message: 'Inventory line saved to releve inventaire', solde: totalInventoryValue });
  } catch (error) {
    console.error('Error creating inventory line from session:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
