const express = require('express');
const { prisma } = require('../lib/prisma');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { AuditLogger } = require('../lib/audit');

const router = express.Router();

// Get all credit entries
router.get('/', authenticateToken, async (req, res) => {
  try {
    const creditEntries = await prisma.creditEntry.findMany({
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

    res.json(creditEntries);
  } catch (error) {
    console.error('Error fetching credit entries:', error);
    if (error.code === 'P2021' || error.message.includes('doesn\'t exist')) {
      // Table doesn't exist yet, return empty array
      res.json([]);
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// Get credit entry by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const creditEntry = await prisma.creditEntry.findUnique({
      where: { id: parseInt(id) },
      include: {
        product: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    if (!creditEntry) {
      return res.status(404).json({ error: 'Credit entry not found' });
    }

    res.json(creditEntry);
  } catch (error) {
    console.error('Error fetching credit entry:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new credit entry
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { productId, amount, type, description, date } = req.body;

    // Validate required fields
    if (amount === undefined || !type || !description) {
      return res.status(400).json({ 
        error: 'Missing required fields: amount, type, description' 
      });
    }

    // Validate type
    const validTypes = ['SALE', 'FREE_ITEM', 'EXIT_VOUCHER', 'WHOLESALE_DIFFERENCE'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ 
        error: 'Invalid type. Must be one of: SALE, FREE_ITEM, EXIT_VOUCHER, WHOLESALE_DIFFERENCE' 
      });
    }

    // Check if product exists (allow productId = 0 or null for global entries)
    if (productId && productId !== 0) {
      const product = await prisma.product.findUnique({
        where: { id: productId }
      });

      if (!product) {
        return res.status(400).json({ error: 'Product not found' });
      }
    }

    const creditEntry = await prisma.creditEntry.create({
      data: {
        productId: productId && productId !== 0 ? parseInt(productId) : null,
        amount: parseFloat(amount),
        type,
        description,
        date: date ? new Date(date) : new Date()
      },
      include: {
        product: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    // Log audit
    try {
      await AuditLogger.log({
        userId: req.user.id,
        action: 'CREATE',
        entityType: 'CreditEntry',
        entityId: creditEntry.id,
        details: `Created credit entry: ${description} - ${amount} DT`
      });
    } catch (auditError) {
      console.error('Error logging audit:', auditError);
    }

    res.status(201).json(creditEntry);
  } catch (error) {
    console.error('Error creating credit entry:', error);
    if (error.code === 'P2021' || error.message.includes('doesn\'t exist')) {
      res.status(503).json({ error: 'Credit entries table not available. Please run database migration.' });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// Update credit entry
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { productId, amount, type, description, date } = req.body;

    // Validate required fields
    if (!productId || amount === undefined || !type || !description) {
      return res.status(400).json({ 
        error: 'Missing required fields: productId, amount, type, description' 
      });
    }

    // Validate type
    const validTypes = ['SALE', 'FREE_ITEM', 'EXIT_VOUCHER', 'WHOLESALE_DIFFERENCE'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ 
        error: 'Invalid type. Must be one of: SALE, FREE_ITEM, EXIT_VOUCHER, WHOLESALE_DIFFERENCE' 
      });
    }

    // Check if credit entry exists
    const existingEntry = await prisma.creditEntry.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existingEntry) {
      return res.status(404).json({ error: 'Credit entry not found' });
    }

    // Check if product exists
    const product = await prisma.product.findUnique({
      where: { id: productId }
    });

    if (!product) {
      return res.status(400).json({ error: 'Product not found' });
    }

    const creditEntry = await prisma.creditEntry.update({
      where: { id: parseInt(id) },
      data: {
        productId: parseInt(productId),
        amount: parseFloat(amount),
        type,
        description,
        date: date ? new Date(date) : existingEntry.date
      },
      include: {
        product: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    // Log audit
    await AuditLogger.log({
      userId: req.user.id,
      action: 'UPDATE',
      entityType: 'CreditEntry',
      entityId: creditEntry.id,
      details: `Updated credit entry: ${description} - ${amount} DT`
    });

    res.json(creditEntry);
  } catch (error) {
    console.error('Error updating credit entry:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete credit entry
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if credit entry exists
    const existingEntry = await prisma.creditEntry.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existingEntry) {
      // Return 204 (No Content) instead of 404 for cleanup operations
      return res.status(204).send();
    }

    await prisma.creditEntry.delete({
      where: { id: parseInt(id) }
    });

    // Log audit
    try {
      await AuditLogger.log({
        userId: req.user.id,
        action: 'DELETE',
        entityType: 'CreditEntry',
        entityId: parseInt(id),
        details: `Deleted credit entry: ${existingEntry.description} - ${existingEntry.amount} DT`
      });
    } catch (auditError) {
      console.error('Error logging audit:', auditError);
    }

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting credit entry:', error);
    if (error.code === 'P2021' || error.message.includes('doesn\'t exist')) {
      res.status(503).json({ error: 'Credit entries table not available. Please run database migration.' });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

module.exports = router;
