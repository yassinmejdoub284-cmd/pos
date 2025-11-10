const express = require('express');
const { prisma } = require('../lib/prisma');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticateToken } = require('../middleware/auth');
const { logAudit } = require('../lib/audit');
const ImageOptimizer = require('../lib/image-optimizer');

const router = express.Router();

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
    cb(null, 'product-' + uniqueSuffix + path.extname(file.originalname));
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

function generateBarcode() {
  const prefix = '200';
  const random = Math.floor(Math.random() * 10000000).toString().padStart(7, '0');
  const barcode = prefix + random;
  
  const sum = barcode.split('').reduce((acc, digit, index) => {
    return acc + parseInt(digit) * (index % 2 === 0 ? 1 : 3);
  }, 0);
  
  const checkDigit = (10 - (sum % 10)) % 10;
  return barcode + checkDigit;
}

function checkBarcodeExists(barcode) {
  return prisma.product.findFirst({
    where: { barcode: barcode }
  });
}

function isValidImageUrl(url) {
  try {
    const urlObj = new URL(url);
    const validProtocols = ['http:', 'https:'];
    const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
    
    if (!validProtocols.includes(urlObj.protocol)) {
      return false;
    }
    
    const pathname = urlObj.pathname.toLowerCase();
    return validExtensions.some(ext => pathname.endsWith(ext)) || 
           pathname.includes('image') || 
           url.includes('placeholder');
  } catch {
    return false;
  }
}

router.get('/', authenticateToken, async (req, res) => {
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
    
    // Build where clause for depot filtering - ALWAYS filter by depot for isolation
    const whereClause = {
        depotAssignments: {
          some: {
          depotId: targetDepotId
          }
        }
      };
    
    const products = await prisma.product.findMany({
      where: whereClause,
      orderBy: [
        { displayIndex: 'asc' },
        { createdAt: 'desc' }
      ],
      include: {
        famille: true,
        inventory: {
          include: {
            depot: true
          }
        },
        depotAssignments: {
          include: {
            depot: true
          }
        },
        depotPrices: {
          include: {
            depot: true
          }
        }
      }
    });
    
    res.json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des produits' });
  }
});

router.get('/familles', authenticateToken, async (req, res) => {
  try {
    const familles = await prisma.productFamily.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' }
    });
    
    res.json(familles);
  } catch (error) {
    console.error('Error fetching familles:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des familles' });
  }
});

// IMPORTANT: Specific routes must come BEFORE parameterized routes like /:id
// Get transfer history to vrac
router.get('/transfer-history', authenticateToken, async (req, res) => {
  try {
    const { depotId, startDate, endDate, page = 1, limit = 50 } = req.query;
    
    // Get depotId - use query param if provided, otherwise use user's depot
    let currentDepotId;
    if (depotId) {
      currentDepotId = Number(depotId);
      if (isNaN(currentDepotId) || currentDepotId <= 0) {
        return res.status(400).json({ error: 'Dépôt invalide dans la requête' });
      }
    } else if (req.user?.depotId) {
      currentDepotId = Number(req.user.depotId);
      if (isNaN(currentDepotId) || currentDepotId <= 0) {
        currentDepotId = 1; // Fallback to default
      }
    } else {
      currentDepotId = 1; // Default depot
    }

    // Build date filter
    const dateFilter = {};
    if (startDate) {
      const start = new Date(startDate);
      if (!isNaN(start.getTime())) {
        dateFilter.gte = start;
      }
    }
    if (endDate) {
      const end = new Date(endDate);
      if (!isNaN(end.getTime())) {
        end.setHours(23, 59, 59, 999);
        dateFilter.lte = end;
      }
    }

    // Build where clause
    const whereClause = {
      reason: 'PRODUCT_CONVERSION',
      type: 'IN',
      depotId: currentDepotId
    };

    if (Object.keys(dateFilter).length > 0) {
      whereClause.date = dateFilter;
    }

    // Get IN movements (target products) with product info
    let inMovements;
    try {
      inMovements = await prisma.stockMovement.findMany({
        where: whereClause,
        include: {
          product: {
            include: {
              famille: true
            }
          },
          user: {
            select: {
              firstName: true,
              lastName: true,
              username: true
            }
          },
          depot: {
            select: {
              name: true,
              code: true
            }
          }
        },
        orderBy: {
          date: 'desc'
        }
      });
    } catch (prismaError) {
      console.error('Prisma query error:', prismaError);
      return res.status(500).json({ 
        error: 'Erreur lors de la requête à la base de données',
        details: prismaError.message 
      });
    }

    // Show all transfers - don't filter by isVrac since transfers can be to any product type
    // The history should show all product conversions, not just to vrac
    inMovements = inMovements.filter(movement => {
      return movement.product !== null; // Only filter out movements without products
    });

    // Apply pagination after filtering
    const pageNum = parseInt(page.toString());
    const limitNum = parseInt(limit.toString());
    const totalCount = inMovements.length;
    const startIndex = (pageNum - 1) * limitNum;
    const endIndex = startIndex + limitNum;
    inMovements = inMovements.slice(startIndex, endIndex);

    // Get corresponding OUT movements (source products) to get full transfer details
    const transferHistory = await Promise.all(inMovements.map(async (inMovement) => {
      // Parse reference to extract source product name
      const referenceMatch = inMovement.reference?.match(/Transfer (.+?) -> (.+)/);
      const sourceProductName = referenceMatch ? referenceMatch[1] : null;
      const targetProductName = referenceMatch ? referenceMatch[2] : null;

      // Find corresponding OUT movement (source product)
      const outMovement = await prisma.stockMovement.findFirst({
        where: {
          reason: 'PRODUCT_CONVERSION',
          type: 'OUT',
          depotId: currentDepotId,
          date: inMovement.date,
          reference: inMovement.reference
        },
        include: {
          product: {
            include: {
              famille: true
            }
          }
        }
      });

      // Calculate conversion ratio
      const sourceQuantity = outMovement ? Math.abs(parseFloat(outMovement.quantity)) : 0;
      const targetQuantity = parseFloat(inMovement.quantity);
      const conversionRatio = sourceQuantity > 0 ? targetQuantity / sourceQuantity : 0;

      return {
        id: inMovement.id,
        date: inMovement.date,
        sourceProduct: outMovement ? {
          id: outMovement.productId,
          name: outMovement.product.name,
          famille: outMovement.product.famille,
          quantity: sourceQuantity,
          unite: outMovement.product.unite
        } : {
          id: null,
          name: sourceProductName || 'Produit inconnu',
          famille: null,
          quantity: sourceQuantity,
          unite: null
        },
        targetProduct: {
          id: inMovement.productId,
          name: inMovement.product.name,
          famille: inMovement.product.famille,
          quantity: targetQuantity,
          unite: inMovement.product.unite,
          isVrac: inMovement.product.isVrac
        },
        conversionRatio: conversionRatio,
        depot: inMovement.depot,
        user: inMovement.user,
        reference: inMovement.reference
      };
    }));

    res.json({
      data: transferHistory,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limitNum)
      }
    });
  } catch (error) {
    console.error('Error fetching transfer history:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la récupération de l\'historique des transferts',
      details: error.message 
    });
  }
});

router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const productId = parseInt(req.params.id);
    const { depotId } = req.query;
    
    if (isNaN(productId)) {
      return res.status(400).json({ error: 'Invalid product ID' });
    }
    
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
    
    const product = await prisma.product.findFirst({
      where: {
        id: productId,
        ...(targetDepotId ? {
          depotAssignments: {
            some: {
              depotId: targetDepotId
            }
          }
        } : {})
      },
      include: {
        famille: true,
        inventory: {
          where: targetDepotId ? { depotId: targetDepotId } : {},
          include: {
            depot: true
          }
        },
        depotAssignments: {
          include: {
            depot: true
          }
        },
        depotPrices: {
          include: {
            depot: true
          }
        }
      }
    });
    
    if (!product) {
      return res.status(404).json({ error: 'Produit non trouvé ou non assigné à ce dépôt' });
    }
    
    res.json(product);
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération du produit' });
  }
});

router.post('/', authenticateToken, async (req, res) => {
  try {
    console.log('Received product data:', req.body);
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
      duree_conservation,
      photo,
      isVrac,
      isVraguable,
      conversionRatio,
      prix_vente_vrac,
      prix_achat_vrac,
      originalProductId,
      isStockable,
      // Wholesale fields
      isWholesale,
      bundleSize,
      bundlePrice,
      minMargin,
      requiresApproval,
      depotIds
    } = req.body;
    
    if (!name || !prix_vente_TTC || !familleId) {
      return res.status(400).json({ error: 'Nom, prix de vente et famille sont requis' });
    }
    
    if (prix_vente_TTC < 0) {
      return res.status(400).json({ error: 'Le prix de vente doit être positif' });
    }

    // Validate photo URL if provided
    if (photo && !isValidImageUrl(photo)) {
      return res.status(400).json({ error: 'URL d\'image invalide' });
    }

    // Validate wholesale fields
    if (isWholesale) {
      if (!bundleSize || bundleSize <= 0) {
        return res.status(400).json({ error: 'La taille du fardeau doit être positive pour les produits de gros' });
      }
      if (!bundlePrice || bundlePrice <= 0) {
        return res.status(400).json({ error: 'Le prix du fardeau doit être positif pour les produits de gros' });
      }
      if (minMargin && (minMargin < 0 || minMargin > 100)) {
        return res.status(400).json({ error: 'La marge minimale doit être entre 0 et 100%' });
      }
    }

    // Check if family exists
    const family = await prisma.productFamily.findUnique({
      where: { id: parseInt(familleId) }
    });
    
    if (!family) {
      return res.status(400).json({ error: 'Famille non trouvée' });
    }

    // Check if barcode already exists
    if (barcode) {
      const existingProduct = await checkBarcodeExists(barcode);
      if (existingProduct) {
        return res.status(400).json({ error: 'Ce code-barres existe déjà' });
      }
    }
    
    const productData = {
      name,
      designation_legale: designation_legale || null,
      description,
      familleId: parseInt(familleId),
      barcode: barcode || null,
      unite: unite || 'pcs',
      prix_vente_TTC: parseFloat(prix_vente_TTC),
      prix_achat: prix_achat ? parseFloat(prix_achat) : null,
      tva: tva ? parseFloat(tva) : 19,
      duree_conservation: duree_conservation ? parseInt(duree_conservation) : null,
      photo: photo || null,
      isVrac: isVrac || false,
      isVraguable: isVraguable !== undefined ? isVraguable : false,
      conversionRatio: conversionRatio ? parseFloat(conversionRatio) : null,
      prix_vente_vrac: prix_vente_vrac !== undefined ? parseFloat(prix_vente_vrac) : 0,
      prix_achat_vrac: prix_achat_vrac !== undefined ? parseFloat(prix_achat_vrac) : 0,
      originalProductId: originalProductId ? parseInt(originalProductId) : null,
      isStockable: isStockable !== undefined ? isStockable : true,
      // Wholesale fields
      isWholesale: isWholesale || false,
      bundleSize: bundleSize ? parseInt(bundleSize) : null,
      bundlePrice: bundlePrice ? parseFloat(bundlePrice) : null,
      minMargin: minMargin ? parseFloat(minMargin) : null,
      requiresApproval: requiresApproval || false
    };
    
    console.log('Product data to be saved:', productData);
    
    const product = await prisma.product.create({
      data: productData
    });
    
    // Handle depot assignments if depotIds are provided
    if (depotIds && depotIds.length > 0) {
      await prisma.productDepot.createMany({
        data: depotIds.map(depotId => ({
          productId: product.id,
          depotId: parseInt(depotId)
        }))
      });
    }
    
    // Handle depot prices if provided
    if (depotPrices && Array.isArray(depotPrices) && depotPrices.length > 0) {
      await prisma.productDepotPrice.createMany({
        data: depotPrices.map(({ depotId, prix_vente_TTC }) => ({
          productId: product.id,
          depotId: parseInt(depotId),
          prix_vente_TTC: parseFloat(prix_vente_TTC)
        }))
      });
    }
    
    // Only create inventory for stockable products
    if (productData.isStockable) {
      const depots = await prisma.depot.findMany({
        where: { isActive: true }
      });
      
      const inventoryPromises = depots.map(depot =>
        prisma.inventory.create({
          data: {
            depotId: depot.id,
            productId: product.id,
            quantity: 0
          }
        })
      );
      
      await Promise.all(inventoryPromises);
    }
    
    await logAudit(req.user.id, 'products', product.id, 'CREATE', null, productData);
    
    res.status(201).json(product);
  } catch (error) {
    console.error('Error creating product:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Code-barres déjà existant' });
    }
    res.status(500).json({ error: 'Erreur lors de la création du produit' });
  }
});

// Update product order - MUST be before /:id route
router.put('/order', authenticateToken, async (req, res) => {
  try {
    const { updates } = req.body;
    
    if (!Array.isArray(updates)) {
      return res.status(400).json({ error: 'Updates must be an array' });
    }

    // Update each product's displayIndex
    const updatePromises = updates.map(async (update) => {
      // Ensure id is a valid integer
      const productId = parseInt(update.id);
      if (isNaN(productId)) {
        throw new Error(`Invalid product ID: ${update.id}`);
      }
      
      return await prisma.product.update({
        where: { id: productId },
        data: { displayIndex: update.displayIndex }
      });
    });

    await Promise.all(updatePromises);
    
    res.json({ success: true, message: 'Product order updated successfully' });
  } catch (error) {
    console.error('Error updating product order:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour de l\'ordre des produits' });
  }
});

router.put('/:id', authenticateToken, async (req, res) => {
  try {
    console.log('Received product update data:', req.body);
    const productId = parseInt(req.params.id);
    
    if (isNaN(productId)) {
      return res.status(400).json({ error: 'Invalid product ID' });
    }
    
    const oldProduct = await prisma.product.findUnique({
      where: { id: productId }
    });
    
    if (!oldProduct) {
      return res.status(404).json({ error: 'Produit non trouvé' });
    }
    
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
      duree_conservation,
      photo,
      isVrac,
      isVraguable,
      conversionRatio,
      prix_vente_vrac,
      prix_achat_vrac,
      originalProductId,
      isStockable,
      // Wholesale fields
      isWholesale,
      bundleSize,
      bundlePrice,
      minMargin,
      requiresApproval,
      depotIds,
      depotPrices
    } = req.body;
    
    if (prix_vente_TTC !== undefined && prix_vente_TTC < 0) {
      return res.status(400).json({ error: 'Le prix de vente doit être positif' });
    }

    // Validate photo URL if provided
    if (photo !== undefined && photo && !isValidImageUrl(photo)) {
      return res.status(400).json({ error: 'URL d\'image invalide' });
    }

    // Validate wholesale fields
    if (isWholesale !== undefined && isWholesale) {
      if (bundleSize !== undefined && (!bundleSize || bundleSize <= 0)) {
        return res.status(400).json({ error: 'La taille du fardeau doit être positive pour les produits de gros' });
      }
      if (bundlePrice !== undefined && (!bundlePrice || bundlePrice <= 0)) {
        return res.status(400).json({ error: 'Le prix du fardeau doit être positif pour les produits de gros' });
      }
      if (minMargin !== undefined && minMargin !== null && (minMargin < 0 || minMargin > 100)) {
        return res.status(400).json({ error: 'La marge minimale doit être entre 0 et 100%' });
      }
    }
    
    // Check if family exists if familleId is provided
    if (familleId !== undefined) {
      const family = await prisma.productFamily.findUnique({
        where: { id: parseInt(familleId) }
      });
      
      if (!family) {
        return res.status(400).json({ error: 'Famille non trouvée' });
      }
    }
    
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (designation_legale !== undefined) updateData.designation_legale = designation_legale || null;
    if (description !== undefined) updateData.description = description;
    if (familleId !== undefined) updateData.familleId = parseInt(familleId);
    if (barcode !== undefined) updateData.barcode = barcode;
    if (unite !== undefined) updateData.unite = unite;
    if (prix_vente_TTC !== undefined) updateData.prix_vente_TTC = parseFloat(prix_vente_TTC);
    if (prix_achat !== undefined) updateData.prix_achat = prix_achat ? parseFloat(prix_achat) : null;
    if (tva !== undefined) updateData.tva = parseFloat(tva);
    if (duree_conservation !== undefined) updateData.duree_conservation = duree_conservation ? parseInt(duree_conservation) : null;
    if (photo !== undefined) updateData.photo = photo || null;
    if (isVrac !== undefined) updateData.isVrac = isVrac;
    if (isVraguable !== undefined) updateData.isVraguable = isVraguable;
    if (conversionRatio !== undefined) updateData.conversionRatio = conversionRatio ? parseFloat(conversionRatio) : null;
    if (prix_vente_vrac !== undefined) updateData.prix_vente_vrac = prix_vente_vrac !== undefined ? parseFloat(prix_vente_vrac) : 0;
    if (prix_achat_vrac !== undefined) updateData.prix_achat_vrac = prix_achat_vrac !== undefined ? parseFloat(prix_achat_vrac) : 0;
    if (originalProductId !== undefined) updateData.originalProductId = originalProductId ? parseInt(originalProductId) : null;
    if (isStockable !== undefined) updateData.isStockable = isStockable;
    // Wholesale fields
    if (isWholesale !== undefined) updateData.isWholesale = isWholesale;
    if (bundleSize !== undefined) updateData.bundleSize = bundleSize ? parseInt(bundleSize) : null;
    if (bundlePrice !== undefined) updateData.bundlePrice = bundlePrice ? parseFloat(bundlePrice) : null;
    if (minMargin !== undefined) updateData.minMargin = minMargin ? parseFloat(minMargin) : null;
    if (requiresApproval !== undefined) updateData.requiresApproval = requiresApproval;
    
    console.log('Update data to be saved:', updateData);
    
    const product = await prisma.product.update({
      where: { id: productId },
      data: updateData
    });
    
    // Handle depot assignments if depotIds are provided
    if (depotIds !== undefined) {
      // Remove existing depot assignments
      await prisma.productDepot.deleteMany({
        where: { productId: productId }
      });
      
      // Add new depot assignments
      if (depotIds && depotIds.length > 0) {
        await prisma.productDepot.createMany({
          data: depotIds.map(depotId => ({
            productId: productId,
            depotId: parseInt(depotId)
          }))
        });
      }
    }
    
    // Handle depot prices if provided
    if (depotPrices !== undefined) {
      // Remove existing depot prices
      await prisma.productDepotPrice.deleteMany({
        where: { productId: productId }
      });
      
      // Add new depot prices
      if (depotPrices && Array.isArray(depotPrices) && depotPrices.length > 0) {
        await prisma.productDepotPrice.createMany({
          data: depotPrices.map(({ depotId, prix_vente_TTC }) => ({
            productId: productId,
            depotId: parseInt(depotId),
            prix_vente_TTC: parseFloat(prix_vente_TTC)
          }))
        });
      }
    }
    
    await logAudit(req.user.id, 'products', productId, 'UPDATE', oldProduct, updateData);
    
    res.json(product);
  } catch (error) {
    console.error('Error updating product:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Code-barres déjà existant' });
    }
    res.status(500).json({ error: 'Erreur lors de la mise à jour du produit' });
  }
});

router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const productId = parseInt(req.params.id);
    
    if (isNaN(productId)) {
      return res.status(400).json({ error: 'Invalid product ID' });
    }
    
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        saleItems: true,
        stockMovements: true,
        stockTransferItems: true
      }
    });
    
    if (!product) {
      return res.status(404).json({ error: 'Produit non trouvé' });
    }
    
    if (product.saleItems.length > 0 || product.stockMovements.length > 0 || product.stockTransferItems.length > 0) {
      return res.status(400).json({ error: 'Impossible de supprimer un produit référencé dans des transactions' });
    }
    
    await prisma.inventory.deleteMany({
      where: { productId }
    });
    
    await prisma.product.delete({
      where: { id: productId }
    });
    
    await logAudit(req.user.id, 'products', productId, 'DELETE', product, null);
    
    res.json({ message: 'Produit supprimé avec succès' });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression du produit' });
  }
});

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

// Dedicated endpoint for uploading and saving product photo
router.post('/:id/photo', authenticateToken, upload.single('photo'), async (req, res) => {
  try {
    const productId = parseInt(req.params.id);
    
    if (isNaN(productId)) {
      return res.status(400).json({ error: 'Invalid product ID' });
    }
    
    if (!req.file) {
      return res.status(400).json({ error: 'Aucun fichier fourni' });
    }
    
    const product = await prisma.product.findUnique({
      where: { id: productId }
    });
    
    if (!product) {
      return res.status(404).json({ error: 'Produit non trouvé' });
    }
    
    // Clean up old images if they exist
    if (product.photo) {
      await ImageOptimizer.cleanupOldImages(product.photo);
    }
    
    // Create optimized versions of the image
    const inputPath = req.file.path;
    const baseOutputPath = path.join('uploads/products', path.parse(req.file.filename).name + '.webp');
    
    const optimizedVersions = await ImageOptimizer.createOptimizedVersions(inputPath, baseOutputPath);
    
    // Use the medium version as the default photo URL
    const imageUrl = `${process.env.API_URL || 'http://localhost:3255'}/${optimizedVersions.medium}`;
    
    // Clean up the original uploaded file
    fs.unlinkSync(inputPath);
    
    const updatedProduct = await prisma.product.update({
      where: { id: productId },
      data: { photo: imageUrl }
    });
    
    await logAudit(req.user.id, 'products', productId, 'UPDATE', product, { photo: imageUrl });
    
    res.json({ 
      message: 'Photo mise à jour avec succès',
      imageUrl: imageUrl,
      product: updatedProduct
    });
  } catch (error) {
    console.error('Error uploading product photo:', error);
    res.status(500).json({ error: 'Erreur lors de l\'upload de la photo' });
  }
});

// Delete product photo
router.delete('/:id/photo', authenticateToken, async (req, res) => {
  try {
    const productId = parseInt(req.params.id);
    
    if (isNaN(productId)) {
      return res.status(400).json({ error: 'Invalid product ID' });
    }
    
    const product = await prisma.product.findUnique({
      where: { id: productId }
    });
    
    if (!product) {
      return res.status(404).json({ error: 'Produit non trouvé' });
    }
    
    // Clean up optimized image versions
    if (product.photo) {
      await ImageOptimizer.cleanupOldImages(product.photo);
    }
    
    const updatedProduct = await prisma.product.update({
      where: { id: productId },
      data: { photo: null }
    });
    
    await logAudit(req.user.id, 'products', productId, 'UPDATE', product, { photo: null });
    
    res.json({ 
      message: 'Photo supprimée avec succès',
      product: updatedProduct
    });
  } catch (error) {
    console.error('Error deleting product photo:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression de la photo' });
  }
});

// Get optimized image URL for a product
router.get('/:id/image/:context?', async (req, res) => {
  try {
    const productId = parseInt(req.params.id);
    const context = req.params.context || 'medium'; // thumbnail, small, medium, original
    
    if (isNaN(productId)) {
      return res.status(400).json({ error: 'Invalid product ID' });
    }
    
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { photo: true }
    });
    
    if (!product || !product.photo) {
      return res.status(404).json({ error: 'Image non trouvée' });
    }
    
    const optimizedUrl = ImageOptimizer.getOptimizedImageUrl(product.photo, context);
    
    if (!optimizedUrl) {
      return res.status(404).json({ error: 'Image optimisée non trouvée' });
    }
    
    res.json({ 
      imageUrl: `${process.env.API_URL || 'http://localhost:3255'}/${optimizedUrl}`,
      context,
      originalUrl: product.photo
    });
  } catch (error) {
    console.error('Error getting optimized image:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération de l\'image' });
  }
});

router.post('/generate-barcode', authenticateToken, async (req, res) => {
  try {
    const barcode = generateBarcode();
    res.json({ barcode });
  } catch (error) {
    console.error('Error generating barcode:', error);
    res.status(500).json({ error: 'Erreur lors de la génération du code-barres' });
  }
});

router.post('/bulk-import', authenticateToken, async (req, res) => {
  try {
    const { products, dryRun = false } = req.body;
    
    if (!Array.isArray(products)) {
      return res.status(400).json({ error: 'Format de données invalide' });
    }
    
    const results = [];
    const errors = [];
    
    for (let i = 0; i < products.length; i++) {
      const productData = products[i];
      
      try {
        if (!productData.name || !productData.prix_vente_TTC) {
          errors.push({
            row: i + 1,
            error: 'Nom et prix de vente sont requis'
          });
          continue;
        }
        
        if (productData.prix_vente_TTC < 0) {
          errors.push({
            row: i + 1,
            error: 'Le prix de vente doit être positif'
          });
          continue;
        }
        
        if (!dryRun) {
          const product = await prisma.product.create({
            data: {
              name: productData.name,
              designation_legale: productData.designation_legale || null,
              description: productData.description,
              famille: productData.famille || 'Général',
              barcode: productData.barcode || null,
              unite: productData.unite || 'pcs',
              prix_vente_TTC: parseFloat(productData.prix_vente_TTC),
              tva: productData.tva ? parseFloat(productData.tva) : 19,
              duree_conservation: productData.duree_conservation ? parseInt(productData.duree_conservation) : null
            }
          });
          
          const depots = await prisma.depot.findMany({
            where: { isActive: true }
          });
          
          const inventoryPromises = depots.map(depot =>
            prisma.inventory.create({
              data: {
                depotId: depot.id,
                productId: product.id,
                quantity: 0
              }
            })
          );
          
          await Promise.all(inventoryPromises);
          
          await logAudit(req.user.id, 'products', product.id, 'CREATE', null, product);
          
          results.push({
            row: i + 1,
            success: true,
            product
          });
        } else {
          results.push({
            row: i + 1,
            success: true,
            preview: productData
          });
        }
      } catch (error) {
        if (error.code === 'P2002') {
          errors.push({
            row: i + 1,
            error: 'Code-barres déjà existant'
          });
        } else {
          errors.push({
            row: i + 1,
            error: error.message
          });
        }
      }
    }
    
    res.json({
      results,
      errors,
      summary: {
        total: products.length,
        success: results.length,
        errors: errors.length
      }
    });
  } catch (error) {
    console.error('Error bulk importing products:', error);
    res.status(500).json({ error: 'Erreur lors de l\'import en masse' });
  }
});

router.get('/export/csv', authenticateToken, async (req, res) => {
  try {
    const { columns = 'name,famille,prix_vente_TTC,barcode' } = req.query;
    const selectedColumns = columns.split(',');
    
    const products = await prisma.product.findMany({
      orderBy: { createdAt: 'desc' }
    });
    
    const csvHeader = selectedColumns.join(',');
    const csvRows = products.map(product => 
      selectedColumns.map(col => {
        const value = product[col];
        return typeof value === 'string' && value.includes(',') ? `"${value}"` : value;
      }).join(',')
    );
    
    const csv = [csvHeader, ...csvRows].join('\n');
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=produits.csv');
    res.send(csv);
  } catch (error) {
    console.error('Error exporting products:', error);
    res.status(500).json({ error: 'Erreur lors de l\'export' });
  }
});

// Conservation management endpoints
router.post('/:id/conservation', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { depotId, batchQuantity, productionDate } = req.body;
    
    const product = await prisma.product.findUnique({
      where: { id: parseInt(id) }
    });
    
    if (!product) {
      return res.status(404).json({ error: 'Produit non trouvé' });
    }
    
    if (!product.duree_conservation) {
      return res.status(400).json({ error: 'Ce produit n\'a pas de durée de conservation définie' });
    }
    
    const expirationDate = new Date(productionDate);
    expirationDate.setDate(expirationDate.getDate() + product.duree_conservation);
    
    const conservation = await prisma.productConservation.create({
      data: {
        productId: parseInt(id),
        depotId: parseInt(depotId),
        batchQuantity: parseFloat(batchQuantity),
        remainingQuantity: parseFloat(batchQuantity),
        productionDate: new Date(productionDate),
        expirationDate: expirationDate
      },
      include: {
        product: true,
        depot: true
      }
    });
    
    res.status(201).json(conservation);
  } catch (error) {
    console.error('Error creating conservation batch:', error);
    res.status(500).json({ error: 'Erreur lors de la création du lot de conservation' });
  }
});

router.get('/conservation/warnings', authenticateToken, async (req, res) => {
  try {
    const today = new Date();
    const warningDate = new Date();
    warningDate.setDate(today.getDate() + 7); // Warning 7 days before expiration
    
    const warnings = await prisma.productConservation.findMany({
      where: {
        OR: [
          {
            expirationDate: {
              lte: today,
              gt: new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000) // Expired but not older than 30 days
            },
            isExpired: false,
            remainingQuantity: { gt: 0 }
          },
          {
            expirationDate: {
              lte: warningDate,
              gt: today
            },
            isWarningShown: false,
            remainingQuantity: { gt: 0 }
          }
        ]
      },
      include: {
        product: true,
        depot: true
      },
      orderBy: { expirationDate: 'asc' }
    });
    
    res.json(warnings);
  } catch (error) {
    console.error('Error fetching conservation warnings:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des avertissements' });
  }
});

router.put('/conservation/:id/dismiss', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const conservation = await prisma.productConservation.update({
      where: { id: parseInt(id) },
      data: { isWarningShown: true }
    });
    
    res.json(conservation);
  } catch (error) {
    console.error('Error dismissing conservation warning:', error);
    res.status(500).json({ error: 'Erreur lors de la fermeture de l\'avertissement' });
  }
});

// Vrac price management endpoints
router.post('/:id/vrac-prices', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { price, startDate, endDate } = req.body;
    
    const product = await prisma.product.findUnique({
      where: { id: parseInt(id) }
    });
    
    if (!product) {
      return res.status(404).json({ error: 'Produit non trouvé' });
    }
    
    if (!product.isVrac) {
      return res.status(400).json({ error: 'Ce produit n\'est pas un produit vrac' });
    }
    
    // Deactivate current active price if exists
    await prisma.vracPrice.updateMany({
      where: {
        productId: parseInt(id),
        isActive: true
      },
      data: {
        isActive: false,
        endDate: new Date()
      }
    });
    
    const vracPrice = await prisma.vracPrice.create({
      data: {
        productId: parseInt(id),
        price: parseFloat(price),
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        isActive: true
      }
    });
    
    await logAudit(req.user.id, 'vrac_prices', vracPrice.id, 'CREATE', null, vracPrice);
    
    res.status(201).json(vracPrice);
  } catch (error) {
    console.error('Error creating vrac price:', error);
    res.status(500).json({ error: 'Erreur lors de la création du prix vrac' });
  }
});

router.get('/:id/vrac-prices', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { startDate, endDate } = req.query;
    
    const product = await prisma.product.findUnique({
      where: { id: parseInt(id) }
    });
    
    if (!product) {
      return res.status(404).json({ error: 'Produit non trouvé' });
    }
    
    const whereClause = {
      productId: parseInt(id)
    };
    
    if (startDate && endDate) {
      whereClause.OR = [
        {
          startDate: { lte: new Date(endDate) },
          endDate: { gte: new Date(startDate) }
        },
        {
          startDate: { lte: new Date(endDate) },
          endDate: null
        }
      ];
    }
    
    const vracPrices = await prisma.vracPrice.findMany({
      where: whereClause,
      orderBy: { startDate: 'desc' }
    });
    
    res.json(vracPrices);
  } catch (error) {
    console.error('Error fetching vrac prices:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des prix vrac' });
  }
});

router.get('/vrac/statistics', authenticateToken, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Dates de début et de fin sont requises' });
    }
    
    const vracProducts = await prisma.product.findMany({
      where: {
        isVrac: true,
        vracPrices: {
          some: {
            startDate: { lte: new Date(endDate) },
            OR: [
              { endDate: { gte: new Date(startDate) } },
              { endDate: null }
            ]
          }
        }
      },
      include: {
        famille: true,
        vracPrices: {
          where: {
            startDate: { lte: new Date(endDate) },
            OR: [
              { endDate: { gte: new Date(startDate) } },
              { endDate: null }
            ]
          },
          orderBy: { startDate: 'desc' }
        },
        originalProduct: true
      }
    });
    
    const statistics = vracProducts.map(product => ({
      id: product.id,
      name: product.name,
      originalProductName: product.originalProduct?.name,
      famille: product.famille.name,
      isStockable: product.isStockable,
      prices: product.vracPrices,
      averagePrice: product.vracPrices.length > 0 
        ? product.vracPrices.reduce((sum, price) => sum + parseFloat(price.price), 0) / product.vracPrices.length
        : 0
    }));
    
    res.json(statistics);
  } catch (error) {
    console.error('Error fetching vrac statistics:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des statistiques vrac' });
  }
});

// Transfer/Convert product to another product type
router.post('/transfer', authenticateToken, async (req, res) => {
  try {
    console.log('Transfer request body:', req.body);
    const { sourceProductId, targetProductId, quantity, conversionRatio, depotId } = req.body;

    // Validate required fields
    if (!sourceProductId || !targetProductId || quantity === undefined || quantity === null || conversionRatio === undefined || conversionRatio === null || !depotId) {
      console.log('Missing fields:', {
        sourceProductId,
        targetProductId,
        quantity,
        conversionRatio,
        depotId
      });
      return res.status(400).json({ 
        error: 'Tous les champs sont requis',
        received: {
          sourceProductId: !!sourceProductId,
          targetProductId: !!targetProductId,
          quantity: quantity !== undefined && quantity !== null,
          conversionRatio: conversionRatio !== undefined && conversionRatio !== null,
          depotId: !!depotId
        }
      });
    }

    // Validate quantity and conversion ratio are positive
    if (parseFloat(quantity) <= 0) {
      return res.status(400).json({ error: 'La quantité doit être positive' });
    }
    if (parseFloat(conversionRatio) <= 0) {
      return res.status(400).json({ error: 'Le ratio de conversion doit être positif' });
    }

    const sourceProduct = await prisma.product.findUnique({
      where: { id: parseInt(sourceProductId) }
    });

    const targetProduct = await prisma.product.findUnique({
      where: { id: parseInt(targetProductId) }
    });

    if (!sourceProduct || !targetProduct) {
      return res.status(404).json({ error: 'Produit non trouvé' });
    }

    // Validate that target product is vrac (for transfer to vrac)
    if (!targetProduct.isVrac) {
      console.log('Warning: Target product is not vrac:', targetProduct.name, 'isVrac:', targetProduct.isVrac);
      // Allow transfer but log warning
    }

    const depotIdInt = parseInt(depotId);
    const sourceQuantity = parseFloat(quantity);
    const ratio = parseFloat(conversionRatio);
    const targetQuantity = sourceQuantity * ratio;

    // Validate calculated quantities
    if (isNaN(sourceQuantity) || isNaN(targetQuantity) || isNaN(ratio)) {
      return res.status(400).json({ error: 'Quantités ou ratio invalides' });
    }

    // Check if source product has enough inventory
    const sourceInventory = await prisma.inventory.findUnique({
      where: {
        depotId_productId: {
          depotId: depotIdInt,
          productId: parseInt(sourceProductId)
        }
      }
    });

    const currentSourceQuantity = sourceInventory ? parseFloat(sourceInventory.quantity) : 0;
    
    // Allow transfer even if inventory doesn't exist or is insufficient (can go negative)
    // This allows flexibility for product conversions
    if (currentSourceQuantity < sourceQuantity && sourceInventory) {
      console.log(`Warning: Insufficient stock. Available: ${currentSourceQuantity}, Requested: ${sourceQuantity}`);
      // Continue with transfer - allow negative inventory
    }

    // Perform transfer in transaction
    await prisma.$transaction(async (tx) => {
      // Reduce source product inventory
      if (sourceInventory) {
        const newSourceQuantity = currentSourceQuantity - sourceQuantity;
        await tx.inventory.update({
          where: { id: sourceInventory.id },
          data: { quantity: newSourceQuantity }
        });
      } else {
        // Create inventory record with negative quantity if it doesn't exist
        await tx.inventory.create({
          data: {
            depotId: depotIdInt,
            productId: parseInt(sourceProductId),
            quantity: -sourceQuantity
          }
        });
      }

      // Add target product inventory
      const targetInventory = await tx.inventory.findUnique({
        where: {
          depotId_productId: {
            depotId: depotIdInt,
            productId: parseInt(targetProductId)
          }
        }
      });

      if (targetInventory) {
        const currentTargetQuantity = parseFloat(targetInventory.quantity) || 0;
        await tx.inventory.update({
          where: { id: targetInventory.id },
          data: { quantity: currentTargetQuantity + targetQuantity }
        });
      } else {
        await tx.inventory.create({
          data: {
            depotId: depotIdInt,
            productId: parseInt(targetProductId),
            quantity: targetQuantity
          }
        });
      }

      // Create stock movement records with detailed reference
      const referenceText = `Transfer ${sourceProduct.name} -> ${targetProduct.name} (${sourceQuantity} x ${ratio} = ${targetQuantity})`;
      
      const outMovement = await tx.stockMovement.create({
        data: {
          productId: parseInt(sourceProductId),
          depotId: depotIdInt,
          quantity: -sourceQuantity,
          type: 'OUT',
          reason: 'PRODUCT_CONVERSION',
          reference: referenceText,
          userId: req.user.id
        }
      });

      const inMovement = await tx.stockMovement.create({
        data: {
          productId: parseInt(targetProductId),
          depotId: depotIdInt,
          quantity: targetQuantity,
          type: 'IN',
          reason: 'PRODUCT_CONVERSION',
          reference: referenceText,
          userId: req.user.id
        }
      });

      console.log('Transfer saved:', {
        outMovementId: outMovement.id,
        inMovementId: inMovement.id,
        sourceProduct: sourceProduct.name,
        targetProduct: targetProduct.name,
        sourceQuantity,
        targetQuantity,
        ratio,
        depotId: depotIdInt,
        userId: req.user.id
      });
    });

    await logAudit(req.user.id, 'products', parseInt(sourceProductId), 'TRANSFER', null, {
      sourceProductId,
      targetProductId,
      quantity: sourceQuantity,
      conversionRatio: ratio,
      targetQuantity
    });

    res.json({ 
      success: true,
      message: `Transfert réussi: ${sourceQuantity} ${sourceProduct.name} -> ${targetQuantity} ${targetProduct.name}`
    });
  } catch (error) {
    console.error('Error transferring product:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      meta: error.meta
    });
    res.status(500).json({ 
      error: 'Erreur lors du transfert du produit',
      details: error.message 
    });
  }
});

// IMPORTANT: This route must come BEFORE router.get('/:id') to avoid route conflicts
// Get transfer history to vrac
router.get('/transfer-history', authenticateToken, async (req, res) => {
  try {
    const { depotId, startDate, endDate, page = 1, limit = 50 } = req.query;
    
    // Get depotId - use query param if provided, otherwise use user's depot
    let currentDepotId;
    if (depotId) {
      currentDepotId = Number(depotId);
      if (isNaN(currentDepotId) || currentDepotId <= 0) {
        return res.status(400).json({ error: 'Dépôt invalide dans la requête' });
      }
    } else if (req.user?.depotId) {
      currentDepotId = Number(req.user.depotId);
      if (isNaN(currentDepotId) || currentDepotId <= 0) {
        currentDepotId = 1; // Fallback to default
      }
    } else {
      currentDepotId = 1; // Default depot
    }

    // Build date filter
    const dateFilter = {};
    if (startDate) {
      const start = new Date(startDate);
      if (!isNaN(start.getTime())) {
        dateFilter.gte = start;
      }
    }
    if (endDate) {
      const end = new Date(endDate);
      if (!isNaN(end.getTime())) {
        end.setHours(23, 59, 59, 999);
        dateFilter.lte = end;
      }
    }

    // Build where clause
    const whereClause = {
      reason: 'PRODUCT_CONVERSION',
      type: 'IN',
      depotId: currentDepotId
    };

    if (Object.keys(dateFilter).length > 0) {
      whereClause.date = dateFilter;
    }

    // Get IN movements (target products) with product info
    // First, get all movements matching the criteria
    let inMovements;
    try {
      inMovements = await prisma.stockMovement.findMany({
        where: whereClause,
        include: {
          product: {
            include: {
              famille: true
            }
          },
          user: {
            select: {
              firstName: true,
              lastName: true,
              username: true
            }
          },
          depot: {
            select: {
              name: true,
              code: true
            }
          }
        },
        orderBy: {
          date: 'desc'
        }
      });
    } catch (prismaError) {
      console.error('Prisma query error:', prismaError);
      return res.status(500).json({ 
        error: 'Erreur lors de la requête à la base de données',
        details: prismaError.message 
      });
    }

    // Show all transfers - don't filter by isVrac since transfers can be to any product type
    // The history should show all product conversions, not just to vrac
    inMovements = inMovements.filter(movement => {
      return movement.product !== null; // Only filter out movements without products
    });

    // Apply pagination after filtering
    const pageNum = parseInt(page.toString());
    const limitNum = parseInt(limit.toString());
    const totalCount = inMovements.length;
    const startIndex = (pageNum - 1) * limitNum;
    const endIndex = startIndex + limitNum;
    inMovements = inMovements.slice(startIndex, endIndex);

    // Get corresponding OUT movements (source products) to get full transfer details
    const transferHistory = await Promise.all(inMovements.map(async (inMovement) => {
      // Parse reference to extract source product name
      const referenceMatch = inMovement.reference?.match(/Transfer (.+?) -> (.+)/);
      const sourceProductName = referenceMatch ? referenceMatch[1] : null;
      const targetProductName = referenceMatch ? referenceMatch[2] : null;

      // Find corresponding OUT movement (source product)
      const outMovement = await prisma.stockMovement.findFirst({
        where: {
          reason: 'PRODUCT_CONVERSION',
          type: 'OUT',
          depotId: currentDepotId,
          date: inMovement.date,
          reference: inMovement.reference
        },
        include: {
          product: {
            include: {
              famille: true
            }
          }
        }
      });

      // Calculate conversion ratio
      const sourceQuantity = outMovement ? Math.abs(parseFloat(outMovement.quantity)) : 0;
      const targetQuantity = parseFloat(inMovement.quantity);
      const conversionRatio = sourceQuantity > 0 ? targetQuantity / sourceQuantity : 0;

      return {
        id: inMovement.id,
        date: inMovement.date,
        sourceProduct: outMovement ? {
          id: outMovement.productId,
          name: outMovement.product.name,
          famille: outMovement.product.famille,
          quantity: sourceQuantity,
          unite: outMovement.product.unite
        } : {
          id: null,
          name: sourceProductName || 'Produit inconnu',
          famille: null,
          quantity: sourceQuantity,
          unite: null
        },
        targetProduct: {
          id: inMovement.productId,
          name: inMovement.product.name,
          famille: inMovement.product.famille,
          quantity: targetQuantity,
          unite: inMovement.product.unite,
          isVrac: inMovement.product.isVrac
        },
        conversionRatio: conversionRatio,
        depot: inMovement.depot,
        user: inMovement.user,
        reference: inMovement.reference
      };
    }));

    res.json({
      data: transferHistory,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limitNum)
      }
    });
  } catch (error) {
    console.error('Error fetching transfer history:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      meta: error.meta,
      stack: error.stack
    });
    res.status(500).json({ 
      error: 'Erreur lors de la récupération de l\'historique des transferts',
      details: error.message 
    });
  }
});

module.exports = router; 