const express = require('express');
const { PrismaClient } = require('@prisma/client');
const router = express.Router();
const prisma = new PrismaClient();

// Vehicle CRUD operations
router.get('/', async (req, res) => {
  try {
    const vehicles = await prisma.vehicle.findMany({
      include: {
        brand: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    res.json(vehicles);
  } catch (error) {
    console.error('Error fetching vehicles:', error);
    res.status(500).json({ error: 'Failed to fetch vehicles' });
  }
});

router.get('/active', async (req, res) => {
  try {
    const vehicles = await prisma.vehicle.findMany({
      where: {
        isActive: true
      },
      include: {
        brand: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    res.json(vehicles);
  } catch (error) {
    console.error('Error fetching active vehicles:', error);
    res.status(500).json({ error: 'Failed to fetch active vehicles' });
  }
});

router.get('/search', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) {
      return res.json([]);
    }

    const vehicles = await prisma.vehicle.findMany({
      where: {
        OR: [
          { matricule: { contains: q, mode: 'insensitive' } },
          { model: { contains: q, mode: 'insensitive' } },
          { brand: { name: { contains: q, mode: 'insensitive' } } }
        ]
      },
      include: {
        brand: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    res.json(vehicles);
  } catch (error) {
    console.error('Error searching vehicles:', error);
    res.status(500).json({ error: 'Failed to search vehicles' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { matricule, model, brand } = req.body;

    // Validate required fields
    if (!matricule || !model || !brand) {
      return res.status(400).json({ error: 'Matricule, model, and brand are required' });
    }

    // Check if matricule already exists
    const existingVehicle = await prisma.vehicle.findUnique({
      where: { matricule }
    });

    if (existingVehicle) {
      return res.status(400).json({ error: 'Vehicle with this matricule already exists' });
    }

    // Find or create brand
    let vehicleBrand = await prisma.vehicleBrand.findFirst({
      where: { name: brand }
    });

    if (!vehicleBrand) {
      vehicleBrand = await prisma.vehicleBrand.create({
        data: {
          name: brand,
          models: [model]
        }
      });
    } else {
      // Add model to existing brand if not already present
      const currentModels = vehicleBrand.models || [];
      if (!currentModels.includes(model)) {
        await prisma.vehicleBrand.update({
          where: { id: vehicleBrand.id },
          data: {
            models: [...currentModels, model]
          }
        });
      }
    }

    const vehicle = await prisma.vehicle.create({
      data: {
        matricule,
        model,
        brandId: vehicleBrand.id
      },
      include: {
        brand: true
      }
    });

    res.status(201).json(vehicle);
  } catch (error) {
    console.error('Error creating vehicle:', error);
    res.status(500).json({ error: 'Failed to create vehicle' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({ error: 'Invalid vehicle ID' });
    }
    
    const { matricule, model, brand, isActive } = req.body;

    // Check if vehicle exists
    const existingVehicle = await prisma.vehicle.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existingVehicle) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }

    // Check if matricule is being changed and if it already exists
    if (matricule && matricule !== existingVehicle.matricule) {
      const duplicateVehicle = await prisma.vehicle.findUnique({
        where: { matricule }
      });

      if (duplicateVehicle) {
        return res.status(400).json({ error: 'Vehicle with this matricule already exists' });
      }
    }

    let updateData = {};
    if (matricule !== undefined) updateData.matricule = matricule;
    if (model !== undefined) updateData.model = model;
    if (isActive !== undefined) updateData.isActive = isActive;

    // Handle brand update
    if (brand) {
      let vehicleBrand = await prisma.vehicleBrand.findFirst({
        where: { name: brand }
      });

      if (!vehicleBrand) {
        vehicleBrand = await prisma.vehicleBrand.create({
          data: {
            name: brand,
            models: model ? [model] : []
          }
        });
      } else if (model) {
        // Add model to existing brand if not already present
        const currentModels = vehicleBrand.models || [];
        if (!currentModels.includes(model)) {
          await prisma.vehicleBrand.update({
            where: { id: vehicleBrand.id },
            data: {
              models: [...currentModels, model]
            }
          });
        }
      }

      updateData.brandId = vehicleBrand.id;
    }

    const vehicle = await prisma.vehicle.update({
      where: { id: parseInt(id) },
      data: updateData,
      include: {
        brand: true
      }
    });

    res.json(vehicle);
  } catch (error) {
    console.error('Error updating vehicle:', error);
    res.status(500).json({ error: 'Failed to update vehicle' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({ error: 'Invalid vehicle ID' });
    }

    const vehicle = await prisma.vehicle.findUnique({
      where: { id: parseInt(id) }
    });

    if (!vehicle) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }

    await prisma.vehicle.delete({
      where: { id: parseInt(id) }
    });

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting vehicle:', error);
    res.status(500).json({ error: 'Failed to delete vehicle' });
  }
});

// Vehicle Brand CRUD operations
router.get('/brands', async (req, res) => {
  try {
    const brands = await prisma.vehicleBrand.findMany({
      orderBy: {
        name: 'asc'
      }
    });
    res.json(brands);
  } catch (error) {
    console.error('Error fetching vehicle brands:', error);
    res.status(500).json({ error: 'Failed to fetch vehicle brands' });
  }
});

router.get('/brands/active', async (req, res) => {
  try {
    const brands = await prisma.vehicleBrand.findMany({
      where: {
        isActive: true
      },
      orderBy: {
        name: 'asc'
      }
    });
    res.json(brands);
  } catch (error) {
    console.error('Error fetching active vehicle brands:', error);
    res.status(500).json({ error: 'Failed to fetch active vehicle brands' });
  }
});

router.get('/brands/search', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) {
      return res.json([]);
    }

    const brands = await prisma.vehicleBrand.findMany({
      where: {
        name: { contains: q, mode: 'insensitive' }
      },
      orderBy: {
        name: 'asc'
      }
    });
    res.json(brands);
  } catch (error) {
    console.error('Error searching vehicle brands:', error);
    res.status(500).json({ error: 'Failed to search vehicle brands' });
  }
});

router.get('/brands/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({ error: 'Invalid brand ID' });
    }
    
    const brand = await prisma.vehicleBrand.findUnique({
      where: { id: parseInt(id) }
    });

    if (!brand) {
      return res.status(404).json({ error: 'Vehicle brand not found' });
    }

    res.json(brand);
  } catch (error) {
    console.error('Error fetching vehicle brand:', error);
    res.status(500).json({ error: 'Failed to fetch vehicle brand' });
  }
});

router.post('/brands', async (req, res) => {
  try {
    const { name, models, logoUrl } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Brand name is required' });
    }

    // Check if brand already exists
    const existingBrand = await prisma.vehicleBrand.findFirst({
      where: { name }
    });

    if (existingBrand) {
      return res.status(400).json({ error: 'Brand with this name already exists' });
    }

    const brand = await prisma.vehicleBrand.create({
      data: {
        name,
        models: models || [],
        logoUrl: logoUrl || null
      }
    });

    res.status(201).json(brand);
  } catch (error) {
    console.error('Error creating vehicle brand:', error);
    res.status(500).json({ error: 'Failed to create vehicle brand' });
  }
});

router.put('/brands/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({ error: 'Invalid brand ID' });
    }
    
    const { name, models, logoUrl, isActive } = req.body;

    const brand = await prisma.vehicleBrand.findUnique({
      where: { id: parseInt(id) }
    });

    if (!brand) {
      return res.status(404).json({ error: 'Vehicle brand not found' });
    }

    // Check if name is being changed and if it already exists
    if (name && name !== brand.name) {
      const duplicateBrand = await prisma.vehicleBrand.findFirst({
        where: { name }
      });

      if (duplicateBrand) {
        return res.status(400).json({ error: 'Brand with this name already exists' });
      }
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (models !== undefined) updateData.models = models;
    if (logoUrl !== undefined) updateData.logoUrl = logoUrl;
    if (isActive !== undefined) updateData.isActive = isActive;

    const updatedBrand = await prisma.vehicleBrand.update({
      where: { id: parseInt(id) },
      data: updateData
    });

    res.json(updatedBrand);
  } catch (error) {
    console.error('Error updating vehicle brand:', error);
    res.status(500).json({ error: 'Failed to update vehicle brand' });
  }
});

router.delete('/brands/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({ error: 'Invalid brand ID' });
    }

    const brand = await prisma.vehicleBrand.findUnique({
      where: { id: parseInt(id) }
    });

    if (!brand) {
      return res.status(404).json({ error: 'Vehicle brand not found' });
    }

    // Check if brand is being used by any vehicles
    const vehiclesUsingBrand = await prisma.vehicle.count({
      where: { brandId: parseInt(id) }
    });

    if (vehiclesUsingBrand > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete brand that is being used by vehicles' 
      });
    }

    await prisma.vehicleBrand.delete({
      where: { id: parseInt(id) }
    });

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting vehicle brand:', error);
    res.status(500).json({ error: 'Failed to delete vehicle brand' });
  }
});

// Get vehicle by ID (must be after all specific routes)
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({ error: 'Invalid vehicle ID' });
    }
    
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: parseInt(id) },
      include: {
        brand: true
      }
    });

    if (!vehicle) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }

    res.json(vehicle);
  } catch (error) {
    console.error('Error fetching vehicle:', error);
    res.status(500).json({ error: 'Failed to fetch vehicle' });
  }
});

module.exports = router;
