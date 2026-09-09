const express = require('express');
const { prisma } = require('../lib/prisma');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get all wholesale rules
router.get('/', authenticateToken, async (req, res) => {
  try {
    const rules = await prisma.wholesaleRule.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.json(rules);
  } catch (error) {
    console.error('Error fetching wholesale rules:', error);
    res.status(500).json({ error: 'Internal server error' + (error?.message ? ' : ' + error.message : ''), code: error?.code });
  }
});

// Get a specific wholesale rule
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const rule = await prisma.wholesaleRule.findUnique({
      where: { id }
    });

    if (!rule) {
      return res.status(404).json({ error: 'Wholesale rule not found' });
    }

    res.json(rule);
  } catch (error) {
    console.error('Error fetching wholesale rule:', error);
    res.status(500).json({ error: 'Internal server error' + (error?.message ? ' : ' + error.message : ''), code: error?.code });
  }
});

// Create a new wholesale rule (allow any authenticated user)
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { ruleType, value, description } = req.body;

    // Validate required fields
    if (!ruleType || value === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Validate rule type
    const validRuleTypes = ['percentage', 'fixed', 'discount', 'manual'];
    if (!validRuleTypes.includes(ruleType)) {
      return res.status(400).json({ error: 'Invalid rule type' });
    }

    // Validate value
    if (typeof value !== 'number' || Number.isNaN(value) || value < 0) {
      return res.status(400).json({ error: 'Value must be positive' });
    }

    if (ruleType === 'percentage' && value > 100) {
      return res.status(400).json({ error: 'Percentage cannot exceed 100%' });
    }

    const rule = await prisma.wholesaleRule.create({
      data: {
        ruleType,
        value,
        // DB requires non-null; use empty string when omitted
        description: description ?? '',
        isArchived: false
      }
    });

    res.status(201).json(rule);
  } catch (error) {
    console.error('Error creating wholesale rule:', error);
    res.status(500).json({ error: 'Internal server error' + (error?.message ? ' : ' + error.message : ''), code: error?.code });
  }
});

// Update a wholesale rule (allow any authenticated user)
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { ruleType, value, description, isArchived } = req.body;

    // Check if rule exists
    const existingRule = await prisma.wholesaleRule.findUnique({
      where: { id }
    });

    if (!existingRule) {
      return res.status(404).json({ error: 'Wholesale rule not found' });
    }

    // Validate rule type if provided
    if (ruleType) {
      const validRuleTypes = ['percentage', 'fixed', 'discount', 'manual'];
      if (!validRuleTypes.includes(ruleType)) {
        return res.status(400).json({ error: 'Invalid rule type' });
      }
    }

    // Validate value if provided
    if (value !== undefined) {
      if (value < 0) {
        return res.status(400).json({ error: 'Value must be positive' });
      }

      if ((ruleType || existingRule.ruleType) === 'percentage' && value > 100) {
        return res.status(400).json({ error: 'Percentage cannot exceed 100%' });
      }
    }

    const updateData = {};
    if (ruleType !== undefined) updateData.ruleType = ruleType;
    if (value !== undefined) updateData.value = value;
    if (description !== undefined) updateData.description = description;
    if (isArchived !== undefined) updateData.isArchived = isArchived;

    const rule = await prisma.wholesaleRule.update({
      where: { id },
      data: updateData
    });

    res.json(rule);
  } catch (error) {
    console.error('Error updating wholesale rule:', error);
    res.status(500).json({ error: 'Internal server error' + (error?.message ? ' : ' + error.message : ''), code: error?.code });
  }
});

// Delete a wholesale rule (allow any authenticated user)
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if rule exists
    const existingRule = await prisma.wholesaleRule.findUnique({
      where: { id }
    });

    if (!existingRule) {
      return res.status(404).json({ error: 'Wholesale rule not found' });
    }

    await prisma.wholesaleRule.delete({
      where: { id }
    });

    res.json({ message: 'Wholesale rule deleted successfully' });
  } catch (error) {
    console.error('Error deleting wholesale rule:', error);
    res.status(500).json({ error: 'Internal server error' + (error?.message ? ' : ' + error.message : ''), code: error?.code });
  }
});

// Archive a wholesale rule (allow any authenticated user)
router.put('/:id/archive', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const rule = await prisma.wholesaleRule.update({
      where: { id },
      data: { isArchived: true }
    });

    res.json(rule);
  } catch (error) {
    console.error('Error archiving wholesale rule:', error);
    res.status(500).json({ error: 'Internal server error' + (error?.message ? ' : ' + error.message : ''), code: error?.code });
  }
});

// Unarchive a wholesale rule (allow any authenticated user)
router.put('/:id/unarchive', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const rule = await prisma.wholesaleRule.update({
      where: { id },
      data: { isArchived: false }
    });

    res.json(rule);
  } catch (error) {
    console.error('Error unarchiving wholesale rule:', error);
    res.status(500).json({ error: 'Internal server error' + (error?.message ? ' : ' + error.message : ''), code: error?.code });
  }
});

module.exports = router;
