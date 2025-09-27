const express = require('express');
const { PrismaClient } = require('@prisma/client');
const router = express.Router();
const prisma = new PrismaClient();

// Get all drivers with pagination and search
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 50, search } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    let whereClause = {};
    if (search) {
      whereClause = {
        OR: [
          { nom: { contains: search, mode: 'insensitive' } },
          { prenom: { contains: search, mode: 'insensitive' } },
          { cin: { contains: search } },
          { phone: { contains: search } },
          { email: { contains: search, mode: 'insensitive' } }
        ]
      };
    }

    const [drivers, total] = await Promise.all([
      prisma.driver.findMany({
        where: whereClause,
        skip: skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          depot: {
            select: {
              id: true,
              name: true,
              code: true,
              type: true
            }
          }
        }
      }),
      prisma.driver.count({ where: whereClause })
    ]);

    res.json({
      drivers,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching drivers:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get active drivers only
router.get('/active', async (req, res) => {
  try {
    const drivers = await prisma.driver.findMany({
      where: { isActive: true },
      orderBy: { nom: 'asc' },
      include: {
        depot: {
          select: {
            id: true,
            name: true,
            code: true,
            type: true
          }
        }
      }
    });
    res.json(drivers);
  } catch (error) {
    console.error('Error fetching active drivers:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get driver by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const driver = await prisma.driver.findUnique({
      where: { id: parseInt(id) },
      include: {
        depot: {
          select: {
            id: true,
            name: true,
            code: true,
            type: true
          }
        }
      }
    });

    if (!driver) {
      return res.status(404).json({ error: 'Driver not found' });
    }

    res.json(driver);
  } catch (error) {
    console.error('Error fetching driver:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new driver
router.post('/', async (req, res) => {
  try {
    const { nom, prenom, cin, phone, email, address, licenseNumber, licenseExpiry } = req.body;

    // Validate required fields
    if (!nom || !prenom || !cin) {
      return res.status(400).json({ error: 'Nom, prénom et CIN sont requis' });
    }

    // Check if CIN already exists
    const existingDriver = await prisma.driver.findFirst({
      where: { cin: cin }
    });

    if (existingDriver) {
      return res.status(400).json({ error: 'Un chauffeur avec ce CIN existe déjà' });
    }

    const driver = await prisma.driver.create({
      data: {
        nom,
        prenom,
        cin,
        phone: phone || null,
        email: email || null,
        address: address || null,
        licenseNumber: licenseNumber || null,
        licenseExpiry: licenseExpiry ? new Date(licenseExpiry) : null,
        depotId: req.body.depotId || null,
        isActive: true
      },
      include: {
        depot: {
          select: {
            id: true,
            name: true,
            code: true,
            type: true
          }
        }
      }
    });

    res.status(201).json(driver);
  } catch (error) {
    console.error('Error creating driver:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update driver
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nom, prenom, cin, phone, email, address, licenseNumber, licenseExpiry, isActive } = req.body;

    // Check if driver exists
    const existingDriver = await prisma.driver.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existingDriver) {
      return res.status(404).json({ error: 'Driver not found' });
    }

    // Check if CIN is being changed and if it already exists
    if (cin && cin !== existingDriver.cin) {
      const cinExists = await prisma.driver.findFirst({
        where: { 
          cin: cin,
          id: { not: parseInt(id) }
        }
      });

      if (cinExists) {
        return res.status(400).json({ error: 'Un chauffeur avec ce CIN existe déjà' });
      }
    }

    const driver = await prisma.driver.update({
      where: { id: parseInt(id) },
      data: {
        nom: nom || existingDriver.nom,
        prenom: prenom || existingDriver.prenom,
        cin: cin || existingDriver.cin,
        phone: phone !== undefined ? phone : existingDriver.phone,
        email: email !== undefined ? email : existingDriver.email,
        address: address !== undefined ? address : existingDriver.address,
        licenseNumber: licenseNumber !== undefined ? licenseNumber : existingDriver.licenseNumber,
        licenseExpiry: licenseExpiry ? new Date(licenseExpiry) : existingDriver.licenseExpiry,
        isActive: isActive !== undefined ? isActive : existingDriver.isActive
      }
    });

    res.json(driver);
  } catch (error) {
    console.error('Error updating driver:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete driver
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Check if driver exists
    const existingDriver = await prisma.driver.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existingDriver) {
      return res.status(404).json({ error: 'Driver not found' });
    }

    await prisma.driver.delete({
      where: { id: parseInt(id) }
    });

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting driver:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
