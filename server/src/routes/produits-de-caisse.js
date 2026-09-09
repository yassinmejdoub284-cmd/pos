const express = require('express');
const router = express.Router();
const { prisma } = require('../lib/prisma');
const { authenticateToken } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');


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
    const { depotId } = req.query;
    
    // Enforce depot isolation - use user's depotId or provided depotId
    const userDepotId = req.user?.depotId;
    const targetDepotId = depotId ? parseInt(depotId) : userDepotId;
    
    // For non-admin users, only allow access to their own depot
    // ADMIN users can access any depot
    if (req.user?.role !== 'ADMIN' && targetDepotId !== userDepotId) {
      return res.status(403).json({ error: 'Access denied: Cannot access other depot products' });
    }
    
    // If no depotId available, return error
    if (!targetDepotId) {
      return res.status(400).json({ error: 'depotId is required to fetch products' });
    }
    
    // Check if depot exists
    const depot = await prisma.depot.findUnique({
      where: { id: targetDepotId },
      select: { id: true, name: true, code: true, type: true }
    });

    if (!depot) {
      return res.status(404).json({ error: `Dépôt avec ID ${targetDepotId} introuvable` });
    }

    // Filter produits by depot - ALWAYS filter for isolation
    const produits = await prisma.produitDeCaisse.findMany({
      where: {
        isActive: true
      },
      include: {
        depotAssignments: {
          include: { depot: true }
        },
        famille: {
          select: {
            id: true,
            name: true
          }
        },
        parentProduct: {
          select: {
            id: true,
            name: true,
            barcode: true,
            photo: true,
            prix_vente_TTC: true,
            unite: true,
            famille: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Parse productIds from JSON string to array and add assignedDepots computed field
    const produitsWithParsedIds = produits.map(produit => ({
      ...produit,
      productIds: JSON.parse(produit.productIds || '[]'),
      assignedDepots: produit.depotAssignments?.map(assignment => assignment.depot) || [],
      familleName: produit.famille?.name || null
    }));

    res.json(produitsWithParsedIds);
  } catch (error) {
    console.error('Error fetching produits de caisse:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des produits de caisse' + (error?.message ? ' : ' + error.message : ''), code: error?.code });
  }
});

// Get active produits de caisse
router.get('/active', authenticateToken, async (req, res) => {
  try {
    const { depotId } = req.query;
    
    // Enforce depot isolation - use user's depotId or provided depotId
    const userDepotId = req.user?.depotId;
    const targetDepotId = depotId ? parseInt(depotId) : userDepotId;
    
    // For non-admin users, only allow access to their own depot
    if (req.user?.role !== 'ADMIN' && targetDepotId !== userDepotId) {
      return res.status(403).json({ error: 'Access denied: Cannot access other depot products' });
    }
    
    // If no depotId available, return error
    if (!targetDepotId) {
      return res.status(400).json({ error: 'depotId is required to fetch products' });
    }
    
    // Filter produits by depot - ALWAYS filter for isolation
    const produits = await prisma.produitDeCaisse.findMany({
      where: { 
        isActive: true
      },
      include: {
        depotAssignments: {
          include: { depot: true }
        },
        famille: true,
        parentProduct: {
          select: {
            id: true,
            name: true,
            barcode: true,
            photo: true,
            prix_vente_TTC: true,
            unite: true,
            famille: {
              select: {
                id: true,
                name: true
              }
            }
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
    res.status(500).json({ error: 'Erreur lors de la récupération des produits actifs' + (error?.message ? ' : ' + error.message : ''), code: error?.code });
  }
});

// Get single produit de caisse
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { depotId } = req.query;
    
    // Enforce depot isolation - use user's depot, visiting depot, or provided depot
    const userDepotId = req.user?.depotId;
    const visitingDepotHeader = req.headers['x-depot-id'];
    const visitingDepotId = visitingDepotHeader ? parseInt(visitingDepotHeader) : null;
    const targetDepotId = depotId ? parseInt(depotId) : (visitingDepotId || userDepotId);
    
    // For non-admin users, check depot access
    if (req.user?.role !== 'ADMIN' && targetDepotId && userDepotId && targetDepotId !== userDepotId) {
      return res.status(403).json({ error: 'Access denied: Cannot access other depot products' });
    }
    
    if (!targetDepotId && req.user?.role !== 'ADMIN') {
      return res.status(400).json({ error: 'depotId is required to fetch products' });
    }
    
    const produit = await prisma.produitDeCaisse.findFirst({
      where: {
        id: parseInt(id)
      },
      include: {
        depotAssignments: {
          include: { depot: true }
        },
        famille: true
      }
    });

    if (!produit) {
      return res.status(404).json({ error: 'Produit de caisse non trouvé ou non assigné à ce dépôt' });
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
    res.status(500).json({ error: 'Erreur lors de la récupération du produit' + (error?.message ? ' : ' + error.message : ''), code: error?.code });
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
        // Create a default family if none exists
        const newDefaultFamily = await prisma.productFamily.create({
          data: {
            name: 'Général',
            description: 'Famille par défaut'
          }
        });
        defaultFamilleId = newDefaultFamily.id;
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

    // Nom deja utilise dans l'un des depots selectionnes ?
    const existingProduits = await prisma.produitDeCaisse.findMany({
      where: {
        name,
        depotAssignments: {
          some: { depotId: { in: depotIdsInt } }
        }
      },
      select: { id: true }
    });

    if (existingProduits.length > 0) {
      return res.status(400).json({ 
        error: 'Un regroupement avec ce nom existe déjà pour un des dépôts sélectionnés' 
      });
    }

    const produit = await prisma.produitDeCaisse.create({
      data: {
        // Depots auxquels ce regroupement est rattache. Sans cette ligne les
        // depotIds recus etaient valides puis ignores, et assignedDepots
        // restait vide dans toutes les reponses.
        depotAssignments: {
          create: depotIdsInt.map(depotId => ({ depotId }))
        },
        name,
        designation_legale,
        description,
        familleId: parseInt(defaultFamilleId),
        barcode: barcode || null,
        unite,
        prix_vente_TTC,
        prix_achat,
        tva,
        photo,
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
      },
      include: {
        depotAssignments: {
          include: { depot: true }
        },
        famille: true,
        parentProduct: {
          select: {
            id: true,
            name: true,
            barcode: true,
            photo: true,
            prix_vente_TTC: true,
            unite: true,
            famille: {
              select: {
                id: true,
                name: true
              }
            }
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
    res.status(500).json({ error: 'Erreur lors de la création du produit' + (error?.message ? ' : ' + error.message : ''), code: error?.code });
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

    // Check if produit exists with depot assignments
    const existingProduit = await prisma.produitDeCaisse.findUnique({
      where: { id: parseInt(id) },
      include: {
      }
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

    // Only validate productIds if it's explicitly provided and not empty
    // For sub-products (produits de caisse), productIds can be empty
    if (productIds !== undefined && productIds !== null && !Array.isArray(productIds)) {
      return res.status(400).json({ 
        error: 'La liste des produits doit être un tableau' 
      });
    }

    // Parse productIds if provided
    let productIdsArray = [];
    if (productIds !== undefined && productIds !== null) {
      // Ensure productIds is an array of integers
      productIdsArray = Array.isArray(productIds) 
        ? productIds.map(id => parseInt(id)).filter(id => !isNaN(id))
        : [];
      
      // Only validate product existence if there are products in the array
      if (productIdsArray.length > 0) {
        const existingProducts = await prisma.product.findMany({
          where: { id: { in: productIdsArray } }
        });

        if (existingProducts.length !== productIdsArray.length) {
          return res.status(400).json({ 
            error: 'Certains produits n\'existent pas' 
          });
        }
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
    if (familleId !== undefined && familleId !== null) updateData.familleId = parseInt(familleId);
    if (barcode !== undefined) updateData.barcode = barcode || null;
    if (unite !== undefined) updateData.unite = unite;
    if (prix_vente_TTC !== undefined) updateData.prix_vente_TTC = prix_vente_TTC;
    if (prix_achat !== undefined) updateData.prix_achat = prix_achat;
    if (tva !== undefined) updateData.tva = tva;
    if (photo !== undefined) updateData.photo = photo;
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

    // Synchronisation des depots : on remplace la liste si elle est fournie.
    if (Array.isArray(depotIds)) {
      const nextDepotIds = depotIds.map(d => parseInt(d)).filter(d => !isNaN(d));
      updateData.depotAssignments = {
        deleteMany: { depotId: { notIn: nextDepotIds.length ? nextDepotIds : [-1] } },
        upsert: nextDepotIds.map(depotId => ({
          where: { produitDeCaisseId_depotId: { produitDeCaisseId: parseInt(id), depotId } },
          create: { depotId },
          update: {}
        }))
      };
    }

    // Update the product first
    await prisma.produitDeCaisse.update({
      where: { id: parseInt(id) },
      data: updateData
    });


    // Note: produits-de-caisse don't use the inventory table directly
    // They manage stock through their own initialStock, minStock, maxStock fields
    // Stock synchronization is handled through the productIds relationship if needed

    const produit = await prisma.produitDeCaisse.findUnique({
      where: { id: parseInt(id) },
      include: {
        depotAssignments: {
          include: { depot: true }
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
    res.status(500).json({ error: 'Erreur lors de la mise à jour du produit' + (error?.message ? ' : ' + error.message : ''), code: error?.code });
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
    res.status(500).json({ error: 'Erreur lors de la suppression du produit' + (error?.message ? ' : ' + error.message : ''), code: error?.code });
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
    res.status(500).json({ error: 'Erreur lors du téléchargement de l\'image' + (error?.message ? ' : ' + error.message : ''), code: error?.code });
  }
});

module.exports = router;
