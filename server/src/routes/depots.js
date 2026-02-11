const express = require('express');
const { prisma } = require('../lib/prisma');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { types } = req.query;
    
    let whereClause = { 
      isActive: true,
      id: { not: -1 } // Exclude the special "Tout" depot from regular depot lists
    };
    
    if (types) {
      const typeArray = types.split(',');
      whereClause.type = { in: typeArray };
    }
    
    const depots = await prisma.depot.findMany({
      where: whereClause,
      include: { company: true },
      orderBy: { name: 'asc' }
    });
    res.json(depots);
  } catch (error) {
    console.error('Error fetching depots:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const depot = await prisma.depot.findFirst({
      where: {
        id: parseInt(id),
        isActive: true
      }
    });

    if (!depot) {
      return res.status(404).json({ error: 'Depot not found' });
    }

    res.json(depot);
  } catch (error) {
    console.error('Error fetching depot:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', authenticateToken, async (req, res) => {
  try {
    const { name, code, type, address, city, phone, email, managerId, companyId } = req.body;

    if (!name || !code || !type || !address || !city) {
      return res.status(400).json({ error: 'Required fields missing' });
    }

    const newDepot = await prisma.depot.create({
      data: {
        name,
        code,
        type,
        address,
        city,
        phone,
        email,
        managerId: managerId ? parseInt(managerId) : null,
        companyId: companyId ? parseInt(companyId) : null
      }
    });

    res.status(201).json(newDepot);
  } catch (error) {
    console.error('Error creating depot:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, code, type, address, city, phone, email, managerId, isActive, companyId } = req.body;

    const updatedDepot = await prisma.depot.update({
      where: { id: parseInt(id) },
      data: {
        name,
        code,
        type,
        address,
        city,
        phone,
        email,
        managerId: managerId ? parseInt(managerId) : null,
        isActive,
        companyId: typeof companyId === 'undefined' ? undefined : (companyId === null ? null : parseInt(companyId))
      }
    });

    res.json(updatedDepot);
  } catch (error) {
    console.error('Error updating depot:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.depot.delete({ where: { id: parseInt(id) } });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting depot:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router; 