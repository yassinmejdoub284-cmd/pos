const express = require('express');
const { prisma } = require('../lib/prisma');
const { authenticateToken } = require('../middleware/auth');
const { AuditLogger } = require('../lib/audit');

const router = express.Router();

// Get all manual entries filtered by date range
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { dateFrom, dateTo } = req.query;
    
    let where = {};
    if (dateFrom && dateTo) {
      where = {
        dateFrom: dateFrom,
        dateTo: dateTo
      };
    }
    
    const manualEntries = await prisma.manualEntry.findMany({
      where,
      orderBy: [
        { dateFrom: 'asc' },
        { dateTo: 'asc' },
        { positionIndex: 'asc' }
      ]
    });

    res.json(manualEntries);
  } catch (error) {
    console.error('Error fetching manual entries:', error);
    if (error.code === 'P2021' || error.message.includes('doesn\'t exist')) {
      // Table doesn't exist yet, return empty array
      res.json([]);
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// Get manual entry by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const manualEntry = await prisma.manualEntry.findUnique({
      where: { id: parseInt(id) }
    });

    if (!manualEntry) {
      return res.status(404).json({ error: 'Manual entry not found' });
    }

    res.json(manualEntry);
  } catch (error) {
    console.error('Error fetching manual entry:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new manual entry
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { entryType, amount, description, date, positionIndex, referenceRowId, dateFrom, dateTo } = req.body;

    // Validate required fields
    if (!entryType || amount === undefined || !description || !date || positionIndex === undefined || !dateFrom || !dateTo) {
      return res.status(400).json({ 
        error: 'Missing required fields: entryType, amount, description, date, positionIndex, dateFrom, dateTo' 
      });
    }

    // Validate entryType
    const validTypes = ['DEBIT', 'CREDIT'];
    if (!validTypes.includes(entryType)) {
      return res.status(400).json({ 
        error: 'Invalid entryType. Must be one of: DEBIT, CREDIT' 
      });
    }

    // Validate amount
    if (parseFloat(amount) <= 0) {
      return res.status(400).json({ 
        error: 'Amount must be greater than 0' 
      });
    }

    // Validate positionIndex
    if (positionIndex < 0) {
      return res.status(400).json({ 
        error: 'positionIndex must be greater than or equal to 0' 
      });
    }

    const manualEntry = await prisma.manualEntry.create({
      data: {
        entryType,
        amount: parseFloat(amount),
        description,
        date: date ? new Date(date) : new Date(),
        positionIndex: parseInt(positionIndex),
        referenceRowId: referenceRowId || null,
        dateFrom,
        dateTo
      }
    });

    // Log audit
    try {
      await AuditLogger.log({
        userId: req.user.id,
        action: 'CREATE',
        entityType: 'ManualEntry',
        entityId: manualEntry.id,
        details: `Created manual entry: ${description} - ${entryType} ${amount} DT at position ${positionIndex}`
      });
    } catch (auditError) {
      console.error('Error logging audit:', auditError);
    }

    res.status(201).json(manualEntry);
  } catch (error) {
    console.error('Error creating manual entry:', error);
    if (error.code === 'P2021' || error.message.includes('doesn\'t exist')) {
      res.status(503).json({ error: 'Manual entries table not available. Please run database migration.' });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// Update manual entry
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { entryType, amount, description, date, positionIndex, referenceRowId, dateFrom, dateTo } = req.body;

    // Check if manual entry exists
    const existingEntry = await prisma.manualEntry.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existingEntry) {
      return res.status(404).json({ error: 'Manual entry not found' });
    }

    // Validate entryType if provided
    if (entryType) {
      const validTypes = ['DEBIT', 'CREDIT'];
      if (!validTypes.includes(entryType)) {
        return res.status(400).json({ 
          error: 'Invalid entryType. Must be one of: DEBIT, CREDIT' 
        });
      }
    }

    // Validate amount if provided
    if (amount !== undefined && parseFloat(amount) <= 0) {
      return res.status(400).json({ 
        error: 'Amount must be greater than 0' 
      });
    }

    const manualEntry = await prisma.manualEntry.update({
      where: { id: parseInt(id) },
      data: {
        ...(entryType && { entryType }),
        ...(amount !== undefined && { amount: parseFloat(amount) }),
        ...(description && { description }),
        ...(date && { date: new Date(date) }),
        ...(positionIndex !== undefined && { positionIndex: parseInt(positionIndex) }),
        ...(referenceRowId !== undefined && { referenceRowId }),
        ...(dateFrom && { dateFrom }),
        ...(dateTo && { dateTo })
      }
    });

    // Log audit
    try {
      await AuditLogger.log({
        userId: req.user.id,
        action: 'UPDATE',
        entityType: 'ManualEntry',
        entityId: manualEntry.id,
        details: `Updated manual entry: ${description || existingEntry.description} - ${entryType || existingEntry.entryType} ${amount || existingEntry.amount} DT`
      });
    } catch (auditError) {
      console.error('Error logging audit:', auditError);
    }

    res.json(manualEntry);
  } catch (error) {
    console.error('Error updating manual entry:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete manual entry
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if manual entry exists
    const existingEntry = await prisma.manualEntry.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existingEntry) {
      // Return 204 (No Content) instead of 404 for cleanup operations
      return res.status(204).send();
    }

    await prisma.manualEntry.delete({
      where: { id: parseInt(id) }
    });

    // Log audit
    try {
      await AuditLogger.log({
        userId: req.user.id,
        action: 'DELETE',
        entityType: 'ManualEntry',
        entityId: parseInt(id),
        details: `Deleted manual entry: ${existingEntry.description} - ${existingEntry.entryType} ${existingEntry.amount} DT`
      });
    } catch (auditError) {
      console.error('Error logging audit:', auditError);
    }

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting manual entry:', error);
    if (error.code === 'P2021' || error.message.includes('doesn\'t exist')) {
      res.status(503).json({ error: 'Manual entries table not available. Please run database migration.' });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

module.exports = router;











