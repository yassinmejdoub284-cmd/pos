const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { authenticateToken } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const prisma = new PrismaClient();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/products';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'produit-caisse-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Seules les images sont autorisées'), false);
    }
  }
});

// Get all produits de caisse
router.get('/', authenticateToken, async (req, res) => {
  try {
    const produits = await prisma.produitDeCaisse.findMany({
      include: {
        depotAssignments: {
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
        },
        famille: true,
        parentProduct: {
          select: {
            id: true,
            name: true,
            barcode: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    // Parse productIds from JSON string to array and add assignedDepots computed field
    const produitsWithParsedIds = produits.map(produit => ({
      ...produit,
      productIds: JSON.parse(produit.productIds || '[]'),
      assignedDepots: produit.depotAssignments?.map(assignment => assignment.depot) || []
    }));
    
    res.json(produitsWithParsedIds);
  } catch (error) {
    console.error('Error fetching produits de caisse:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des produits de caisse' });
  }
});

// Get active produits de caisse
router.get('/active', authenticateToken, async (req, res) => {
  try {
    const produits = await prisma.produitDeCaisse.findMany({
      where: { isActive: true },
      include: {
        depotAssignments: {
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
        },
        famille: true,
        parentProduct: {
          select: {
            id: true,
            name: true,
            barcode: true
          }
        }
      },
      orderBy: { name: 'asc' }
    });
    
    // Parse productIds from JSON string to array and add assignedDepots computed field
    const produitsWithParsedIds = produits.map(produit => ({
      ...produit,
      productIds: JSON.parse(produit.productIds || '[]'),
      assignedDepots: produit.depotAssignments?.map(assignment => assignment.depot) || []
    }));
    
    res.json(produitsWithParsedIds);
  } catch (error) {
    console.error('Error fetching active produits de caisse:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des produits actifs' });
  }
});

// Get single produit de caisse
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const produit = await prisma.produitDeCaisse.findUnique({
      where: { id: parseInt(id) },
      include: {
        depotAssignments: {
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
        },
        famille: true
      }
    });

    if (!produit) {
      return res.status(404).json({ error: 'Produit de caisse non trouvé' });
    }

    // Parse productIds from JSON string to array and add assignedDepots computed field
    const produitWithParsedIds = {
      ...produit,
      productIds: JSON.parse(produit.productIds || '[]'),
      assignedDepots: produit.depotAssignments?.map(assignment => assignment.depot) || []
    };

    res.json(produitWithParsedIds);
  } catch (error) {
    console.error('Error fetching produit de caisse:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération du produit' });
  }
});

// Create new produit de caisse
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { 
      name, 
      designation_legale,
      description,
      familleId,
      barcode,
      unite = 'pcs',
      prix_vente_TTC,
      prix_achat,
      tva = 19,
      photo,
      duree_conservation,
      isVrac = false,
      originalProductId,
      parentProductId,
      isStockable = true,
      isVraguable = false,
      initialStock,
      minStock,
      maxStock,
      displayIndex,
      isWholesale = false,
      bundleSize,
      bundlePrice,
      productIds, 
      depotIds, // Changed from depotId to depotIds array
      isActive = true 
    } = req.body;

    // Validation
    if (!name || !prix_vente_TTC || !depotIds || !Array.isArray(depotIds) || depotIds.length === 0) {
      return res.status(400).json({ 
        error: 'Nom, prix de vente TTC et au moins un dépôt sont requis' 
      });
    }

    if (prix_vente_TTC <= 0) {
      return res.status(400).json({ 
        error: 'Le prix de vente TTC doit être supérieur à 0' 
      });
    }

    // Check if all depots exist and are of type MAIN or BRANCH
    const depotIdsInt = depotIds.map(id => parseInt(id)).filter(id => !isNaN(id));
    const depots = await prisma.depot.findMany({
      where: { 
        id: { in: depotIdsInt },
        type: { in: ['MAIN', 'BRANCH'] } // Only allow MAIN and BRANCH type depots
      }
    });

    if (depots.length !== depotIdsInt.length) {
      return res.status(400).json({ 
        error: 'Certains dépôts n\'existent pas ou ne sont pas de type MAIN ou BRANCH' 
      });
    }

    // Get default family if none provided
    let defaultFamilleId = familleId;
    if (!defaultFamilleId) {
      const defaultFamily = await prisma.productFamily.findFirst();
      if (defaultFamily) {
        defaultFamilleId = defaultFamily.id;
      } else {
        return res.status(400).json({ 
          error: 'Aucune famille de produits trouvée. Veuillez créer une famille d\'abord.' 
        });
      }
    } else {
      // Check if provided famille exists
      const famille = await prisma.productFamily.findUnique({
        where: { id: parseInt(familleId) }
      });

      if (!famille) {
        return res.status(400).json({ 
          error: 'La famille sélectionnée n\'existe pas' 
        });
      }
    }

    // Check if parent product exists (if parentProductId is provided)
    if (parentProductId) {
      const parentProduct = await prisma.product.findUnique({
        where: { id: parseInt(parentProductId) }
      });

      if (!parentProduct) {
        return res.status(400).json({ 
          error: 'Le produit parent sélectionné n\'existe pas' 
        });
      }
    }

    // Ensure productIds is an array of integers (for backward compatibility)
    const productIdsArray = Array.isArray(productIds) 
      ? productIds.map(id => parseInt(id)).filter(id => !isNaN(id))
      : [];

    // Check if name already exists for any of the selected depots
    const existingProduits = await prisma.produitDeCaisse.findMany({
      where: { 
        name,
        depotAssignments: {
          some: {
            depotId: { in: depotIdsInt }
          }
        }
      }
    });

    if (existingProduits.length > 0) {
      return res.status(400).json({ 
        error: 'Un regroupement avec ce nom existe déjà pour un des dépôts sélectionnés' 
      });
    }

    const produit = await prisma.produitDeCaisse.create({
      data: {
        name,
        designation_legale,
        description,
        familleId: parseInt(defaultFamilleId),
        barcode,
        unite,
        prix_vente_TTC,
        prix_achat,
        tva,
        photo,
        duree_conservation,
        isVrac,
        originalProductId: originalProductId ? parseInt(originalProductId) : null,
        parentProductId: parentProductId ? parseInt(parentProductId) : null,
        isStockable,
        isVraguable,
        initialStock,
        minStock,
        maxStock,
        displayIndex,
        isWholesale,
        bundleSize,
        bundlePrice,
        productIds: JSON.stringify(productIdsArray || []),
        isActive,
        depotAssignments: {
          create: depotIdsInt.map(depotId => ({
            depotId: depotId
          }))
        }
      },
      include: {
        depotAssignments: {
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
        },
        famille: true,
        parentProduct: {
          select: {
            id: true,
            name: true,
            barcode: true
          }
        }
      }
    });

    // Parse productIds from JSON string to array and add assignedDepots computed field
    const produitWithParsedIds = {
      ...produit,
      productIds: JSON.parse(produit.productIds || '[]'),
      assignedDepots: produit.depotAssignments?.map(assignment => assignment.depot) || []
    };

    res.status(201).json(produitWithParsedIds);
  } catch (error) {
    console.error('Error creating produit de caisse:', error);
    res.status(500).json({ error: 'Erreur lors de la création du produit' });
  }
});

// Update produit de caisse
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      name, 
      designation_legale,
      description,
      familleId,
      barcode,
      unite,
      prix_vente_TTC,
      prix_achat,
      tva,
      photo,
      duree_conservation,
      isVrac,
      originalProductId,
      isStockable,
      isVraguable,
      initialStock,
      minStock,
      maxStock,
      displayIndex,
      isWholesale,
      bundleSize,
      bundlePrice,
      productIds, 
      depotIds, // Changed from depotId to depotIds array
      isActive 
    } = req.body;

    // Check if produit exists
    const existingProduit = await prisma.produitDeCaisse.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existingProduit) {
      return res.status(404).json({ error: 'Produit de caisse non trouvé' });
    }

    // Validation
    if (prix_vente_TTC !== undefined && prix_vente_TTC <= 0) {
      return res.status(400).json({ 
        error: 'Le prix de vente TTC doit être supérieur à 0' 
      });
    }

    // Validate depotIds if provided
    if (depotIds !== undefined) {
      if (!Array.isArray(depotIds) || depotIds.length === 0) {
        return res.status(400).json({ 
          error: 'Au moins un dépôt doit être sélectionné' 
        });
      }

      const depotIdsInt = depotIds.map(id => parseInt(id)).filter(id => !isNaN(id));
      const depots = await prisma.depot.findMany({
        where: { 
          id: { in: depotIdsInt },
          type: { in: ['MAIN', 'BRANCH'] } // Only allow MAIN and BRANCH type depots
        }
      });

      if (depots.length !== depotIdsInt.length) {
        return res.status(400).json({ 
          error: 'Certains dépôts n\'existent pas ou ne sont pas de type MAIN ou BRANCH' 
        });
      }
    }

    if (productIds && (!Array.isArray(productIds) || productIds.length === 0)) {
      return res.status(400).json({ 
        error: 'La liste des produits ne peut pas être vide' 
      });
    }

    // Parse productIds if provided
    let productIdsArray = [];
    if (productIds) {
      // Ensure productIds is an array of integers
      productIdsArray = Array.isArray(productIds) 
        ? productIds.map(id => parseInt(id)).filter(id => !isNaN(id))
        : [];
      
      if (productIdsArray.length === 0) {
        return res.status(400).json({ 
          error: 'Liste de produits invalide' 
        });
      }

      const existingProducts = await prisma.product.findMany({
        where: { id: { in: productIdsArray } }
      });

      if (existingProducts.length !== productIdsArray.length) {
        return res.status(400).json({ 
          error: 'Certains produits n\'existent pas' 
        });
      }
    }

    // Check if name already exists (if name provided and different)
    if (name && name !== existingProduit.name) {
      const depotIdsToCheck = depotIds !== undefined ? depotIds.map(id => parseInt(id)).filter(id => !isNaN(id)) : [];
      
      if (depotIdsToCheck.length > 0) {
        const duplicateProduit = await prisma.produitDeCaisse.findFirst({
          where: { 
            name,
            id: { not: parseInt(id) },
            depotAssignments: {
              some: {
                depotId: { in: depotIdsToCheck }
              }
            }
          }
        });

        if (duplicateProduit) {
          return res.status(400).json({ 
            error: 'Un regroupement avec ce nom existe déjà pour un des dépôts sélectionnés' 
          });
        }
      }
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (designation_legale !== undefined) updateData.designation_legale = designation_legale;
    if (description !== undefined) updateData.description = description;
    if (familleId !== undefined) updateData.familleId = parseInt(familleId);
    if (barcode !== undefined) updateData.barcode = barcode;
    if (unite !== undefined) updateData.unite = unite;
    if (prix_vente_TTC !== undefined) updateData.prix_vente_TTC = prix_vente_TTC;
    if (prix_achat !== undefined) updateData.prix_achat = prix_achat;
    if (tva !== undefined) updateData.tva = tva;
    if (photo !== undefined) updateData.photo = photo;
    if (duree_conservation !== undefined) updateData.duree_conservation = duree_conservation;
    if (isVrac !== undefined) updateData.isVrac = isVrac;
    if (originalProductId !== undefined) updateData.originalProductId = originalProductId ? parseInt(originalProductId) : null;
    if (isStockable !== undefined) updateData.isStockable = isStockable;
    if (isVraguable !== undefined) updateData.isVraguable = isVraguable;
    if (initialStock !== undefined) updateData.initialStock = initialStock;
    if (minStock !== undefined) updateData.minStock = minStock;
    if (maxStock !== undefined) updateData.maxStock = maxStock;
    if (displayIndex !== undefined) updateData.displayIndex = displayIndex;
    if (isWholesale !== undefined) updateData.isWholesale = isWholesale;
    if (bundleSize !== undefined) updateData.bundleSize = bundleSize;
    if (bundlePrice !== undefined) updateData.bundlePrice = bundlePrice;
    if (productIds !== undefined) updateData.productIds = JSON.stringify(productIdsArray);
    if (isActive !== undefined) updateData.isActive = isActive;

    // Update the product first
    await prisma.produitDeCaisse.update({
      where: { id: parseInt(id) },
      data: updateData
    });

    // Handle depot assignments separately if provided
    if (depotIds !== undefined) {
      const depotIdsInt = depotIds.map(id => parseInt(id)).filter(id => !isNaN(id));
      
      // Delete existing depot assignments
      await prisma.produitDeCaisseDepot.deleteMany({
        where: { produitDeCaisseId: parseInt(id) }
      });

      // Create new depot assignments
      await prisma.produitDeCaisseDepot.createMany({
        data: depotIdsInt.map(depotId => ({
          produitDeCaisseId: parseInt(id),
          depotId: depotId
        }))
      });
    }

    const produit = await prisma.produitDeCaisse.findUnique({
      where: { id: parseInt(id) },
      include: {
        depotAssignments: {
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
        },
        famille: true
      }
    });

    // Parse productIds from JSON string to array and add assignedDepots computed field
    const produitWithParsedIds = {
      ...produit,
      productIds: JSON.parse(produit.productIds || '[]'),
      assignedDepots: produit.depotAssignments?.map(assignment => assignment.depot) || []
    };

    res.json(produitWithParsedIds);
  } catch (error) {
    console.error('Error updating produit de caisse:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour du produit' });
  }
});

// Delete produit de caisse
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if produit exists
    const existingProduit = await prisma.produitDeCaisse.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existingProduit) {
      return res.status(404).json({ error: 'Produit de caisse non trouvé' });
    }

    await prisma.produitDeCaisse.delete({
      where: { id: parseInt(id) }
    });

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting produit de caisse:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression du produit' });
  }
});

// Upload image endpoint
router.post('/upload-image', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Aucune image fournie' });
    }
    
    const imageUrl = `${process.env.API_URL || 'http://localhost:3255'}/uploads/products/${req.file.filename}`;
    res.json({ imageUrl });
  } catch (error) {
    console.error('Error uploading image:', error);
    res.status(500).json({ error: 'Erreur lors du téléchargement de l\'image' });
  }
});

module.exports = router;
