const express = require('express');
const { prisma } = require('../lib/prisma');
const router = express.Router();

// Get all salons
router.get('/', async (req, res) => {
  try {
    const salons = await prisma.salon.findMany({
      where: { isActive: true },
      include: {
        tables: {
          where: { isActive: true }
        }
      },
      orderBy: { name: 'asc' }
    });
    res.json(salons);
  } catch (error) {
    console.error('Error fetching salons:', error);
    res.status(500).json({ error: 'Failed to fetch salons' });
  }
});

// Get salon by ID
router.get('/:id', async (req, res) => {
  try {
    const salon = await prisma.salon.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        tables: {
          where: { isActive: true }
        }
      }
    });
    
    if (!salon) {
      return res.status(404).json({ error: 'Salon not found' });
    }
    
    res.json(salon);
  } catch (error) {
    console.error('Error fetching salon:', error);
    res.status(500).json({ error: 'Failed to fetch salon' });
  }
});

// Create new salon
router.post('/', async (req, res) => {
  try {
    const { name, maxTables, location, description } = req.body;
    
    if (!name || !maxTables) {
      return res.status(400).json({ error: 'Name and maxTables are required' });
    }
    
    const salon = await prisma.salon.create({
      data: {
        name,
        maxTables: parseInt(maxTables),
        location: location || null,
        description: description || null
      }
    });
    
    res.status(201).json(salon);
  } catch (error) {
    console.error('Error creating salon:', error);
    res.status(500).json({ error: 'Failed to create salon' });
  }
});

// Update salon
router.put('/:id', async (req, res) => {
  try {
    const { name, maxTables, location, description } = req.body;
    
    const salon = await prisma.salon.update({
      where: { id: parseInt(req.params.id) },
      data: {
        name: name || undefined,
        maxTables: maxTables ? parseInt(maxTables) : undefined,
        location: location !== undefined ? location : undefined,
        description: description !== undefined ? description : undefined
      }
    });
    
    res.json(salon);
  } catch (error) {
    console.error('Error updating salon:', error);
    res.status(500).json({ error: 'Failed to update salon' });
  }
});

// Delete salon (soft delete)
router.delete('/:id', async (req, res) => {
  try {
    const salon = await prisma.salon.update({
      where: { id: parseInt(req.params.id) },
      data: { isActive: false }
    });
    
    res.json({ message: 'Salon deleted successfully' });
  } catch (error) {
    console.error('Error deleting salon:', error);
    res.status(500).json({ error: 'Failed to delete salon' });
  }
});

module.exports = router;
