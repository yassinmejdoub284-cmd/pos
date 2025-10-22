const express = require('express');
const { prisma } = require('../lib/prisma');
const router = express.Router();

// Get all tables
router.get('/', async (req, res) => {
  try {
    const tables = await prisma.table.findMany({
      where: { isActive: true },
      include: {
        salon: true
      },
      orderBy: { number: 'asc' }
    });
    res.json(tables);
  } catch (error) {
    console.error('Error fetching tables:', error);
    res.status(500).json({ error: 'Failed to fetch tables' });
  }
});

// Get tables by salon
router.get('/salon/:salonId', async (req, res) => {
  try {
    const tables = await prisma.table.findMany({
      where: { 
        salonId: parseInt(req.params.salonId),
        isActive: true 
      },
      include: {
        salon: true
      },
      orderBy: { number: 'asc' }
    });
    res.json(tables);
  } catch (error) {
    console.error('Error fetching tables by salon:', error);
    res.status(500).json({ error: 'Failed to fetch tables' });
  }
});

// Get table by ID
router.get('/:id', async (req, res) => {
  try {
    const table = await prisma.table.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        salon: true
      }
    });
    
    if (!table) {
      return res.status(404).json({ error: 'Table not found' });
    }
    
    res.json(table);
  } catch (error) {
    console.error('Error fetching table:', error);
    res.status(500).json({ error: 'Failed to fetch table' });
  }
});

// Create new table
router.post('/', async (req, res) => {
  try {
    const { name, number, color, salonId, notes } = req.body;
    
    if (!name || !number || !color || !salonId) {
      return res.status(400).json({ error: 'Name, number, color and salonId are required' });
    }
    
    // Check if salon exists
    const salon = await prisma.salon.findUnique({
      where: { id: parseInt(salonId) }
    });
    
    if (!salon) {
      return res.status(404).json({ error: 'Salon not found' });
    }
    
    // Check if table number already exists in this salon
    const existingTable = await prisma.table.findFirst({
      where: {
        number,
        salonId: parseInt(salonId),
        isActive: true
      }
    });
    
    if (existingTable) {
      return res.status(400).json({ error: 'Table number already exists in this salon' });
    }
    
    const table = await prisma.table.create({
      data: {
        name,
        number,
        color,
        salonId: parseInt(salonId),
        notes: notes || null
      },
      include: {
        salon: true
      }
    });
    
    res.status(201).json(table);
  } catch (error) {
    console.error('Error creating table:', error);
    res.status(500).json({ error: 'Failed to create table' });
  }
});

// Update table
router.put('/:id', async (req, res) => {
  try {
    const { name, number, color, notes } = req.body;
    
    const table = await prisma.table.update({
      where: { id: parseInt(req.params.id) },
      data: {
        name: name || undefined,
        number: number || undefined,
        color: color || undefined,
        notes: notes !== undefined ? notes : undefined
      },
      include: {
        salon: true
      }
    });
    
    res.json(table);
  } catch (error) {
    console.error('Error updating table:', error);
    res.status(500).json({ error: 'Failed to update table' });
  }
});


// Delete table (soft delete)
router.delete('/:id', async (req, res) => {
  try {
    const table = await prisma.table.update({
      where: { id: parseInt(req.params.id) },
      data: { isActive: false }
    });
    
    res.json({ message: 'Table deleted successfully' });
  } catch (error) {
    console.error('Error deleting table:', error);
    res.status(500).json({ error: 'Failed to delete table' });
  }
});

module.exports = router;
