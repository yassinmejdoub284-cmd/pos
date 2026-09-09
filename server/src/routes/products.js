const express = require('express');
const { prisma } = require('../lib/prisma');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticateToken } = require('../middleware/auth');
const { logAudit } = require('../lib/audit');
const ImageOptimizer = require('../lib/image-optimizer');

const router = express.Router();

const USER_ROLES_FILE = path.join((process.pkg ? path.dirname(process.execPath) : path.join(__dirname, '../..')), 'src/uploads/user-roles.json');

function readUserRoles() {
  try {
    if (fs.existsSync(USER_ROLES_FILE)) {
      return JSON.parse(fs.readFileSync(USER_ROLES_FILE, 'utf8'));
    }
    return {};
  } catch (error) {
    console.error('Error reading user roles:', error);
    return {};
  }
}

function hasRoleOrRoleKey(user, allowedRoles) {
  // Check database role
  if (allowedRoles.includes(user.role)) {
    return true;
  }
  
  // Check roleKey from user-roles.json
  const userRoles = readUserRoles();
  const roleKey = userRoles[String(user.id)];
  if (roleKey && allowedRoles.includes(roleKey)) {
    return true;
  }
  
  return false;
}

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
    const { depotId, search, all, page = 1, limit = 100, minimal } = req.query;
    
    // Enforce depot isolation - use user's depotId or provided depotId
    const userDepotId = req.user?.depotId;
    const isAdmin = req.user?.role === 'ADMIN';
    const targetDepotId = depotId ? parseInt(depotId) : userDepotId;
    
    // For non-admin users, only allow access to their own depot
    if (!isAdmin && targetDepotId !== userDepotId) {
      return res.status(403).json({ error: 'Access denied: Cannot access other depot products' });
    }
    
    // If no depotId available and not searching "all", return error
    if (!targetDepotId && !isAdmin) {
      return res.status(400).json({ error: 'depotId is required to fetch products' });
    }
    
    // Build where clause
    const whereClause = {};
    
    // Only apply depot filter if not explicitly requesting "all" as admin
    if (!(isAdmin && all === 'true')) {
      if (targetDepotId) {
        whereClause.depotAssignments = {
          some: {
            depotId: targetDepotId
          }
        };
      }
    }

    if (search) {
      whereClause.OR = [
        { name: { contains: search } },
        { barcode: { contains: search } },
        { id: isNaN(parseInt(search)) ? undefined : parseInt(search) }
      ].filter(condition => condition.id !== undefined || condition.name || condition.barcode);
    }
    
    const queryOptions = {
      where: whereClause,
      orderBy: [
        { displayIndex: 'asc' },
        { createdAt: 'desc' }
      ],
      skip: (parseInt(page) - 1) * parseInt(limit),
      take: parseInt(limit)
    };

    if (minimal === 'true') {
      queryOptions.select = {
        id: true,
        name: true,
        prix_vente_TTC: true,
        barcode: true,
        unite: true
      };
    } else {
      queryOptions.include = {
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
        depotPrices: true,
        vracConversionsAsSource: {
          select: {
            id: true,
            targetProductId: true
          }
        }
      };
    }

    const products = await prisma.product.findMany(queryOptions);
    
    res.json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des produits' + (error?.message ? ' : ' + error.message : ''), code: error?.code });
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
    res.status(500).json({ error: 'Erreur lors de la récupération des familles' + (error?.message ? ' : ' + error.message : ''), code: error?.code });
  }
});

// IMPORTANT: Specific routes must come BEFORE parameterized routes like /:id

// Get similar products from source depot(s) for linking

router.get('/vrac-conversions/:sourceProductId', authenticateToken, async (req, res) => {
  try {
    const sourceProductId = parseInt(req.params.sourceProductId);
    
    if (isNaN(sourceProductId) || sourceProductId <= 0) {
      return res.status(400).json({ error: 'ID produit source invalide' });
    }

    const conversions = await prisma.productVracConversion.findMany({
      where: { sourceProductId },
      include: {
        targetProduct: {
          select: {
            id: true,
            name: true,
            unite: true,
            prix_vente_TTC: true,
            prix_achat: true,
            isVrac: true
          }
        },
        sourceProduct: {
          select: {
            id: true,
            name: true,
            unite: true
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    res.json({
      sourceProductId,
      conversions: conversions.map(c => ({
        id: c.id,
        targetProductId: c.targetProductId,
        targetProductName: c.targetProduct.name,
        targetProductUnite: c.targetProduct.unite,
        conversionRatio: parseFloat(c.conversionRatio),
        prix_vente_vrac: c.prix_vente_vrac ? parseFloat(c.prix_vente_vrac) : null,
        prix_achat_vrac: c.prix_achat_vrac ? parseFloat(c.prix_achat_vrac) : null,
        isStockable: c.isStockable
      }))
    });
  } catch (error) {
    console.error('Error fetching vrac conversions:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des conversions VRAC' + (error?.message ? ' : ' + error.message : ''), code: error?.code });
  }
});

router.post('/vrac-conversions', authenticateToken, async (req, res) => {
  try {
    const { sourceProductId, conversions } = req.body;

    if (!sourceProductId || !conversions || !Array.isArray(conversions) || conversions.length === 0) {
      return res.status(400).json({ error: 'sourceProductId et conversions (tableau non vide) sont requis' });
    }

    const sourceProduct = await prisma.product.findUnique({
      where: { id: parseInt(sourceProductId) }
    });

    if (!sourceProduct) {
      return res.status(404).json({ error: 'Produit source non trouvé' });
    }

    const targetProductIds = conversions.map(c => parseInt(c.targetProductId));
    const targetProducts = await prisma.product.findMany({
      where: { id: { in: targetProductIds } }
    });

    if (targetProducts.length !== targetProductIds.length) {
      return res.status(404).json({ error: 'Un ou plusieurs produits destinataires non trouvés' });
    }

    const results = await prisma.$transaction(
      conversions.map(conversion => {
        const conversionRatio = parseFloat(conversion.conversionRatio);
        if (isNaN(conversionRatio) || conversionRatio <= 0) {
          throw new Error(`Ratio de conversion invalide pour le produit ${conversion.targetProductId}`);
        }

        return prisma.productVracConversion.upsert({
          where: {
            unique_vrac_conversion: {
              sourceProductId: parseInt(sourceProductId),
              targetProductId: parseInt(conversion.targetProductId)
            }
          },
          create: {
            sourceProductId: parseInt(sourceProductId),
            targetProductId: parseInt(conversion.targetProductId),
            conversionRatio: conversionRatio,
            prix_vente_vrac: conversion.prix_vente_vrac ? parseFloat(conversion.prix_vente_vrac) : null,
            prix_achat_vrac: conversion.prix_achat_vrac ? parseFloat(conversion.prix_achat_vrac) : null,
            isStockable: conversion.isStockable !== undefined ? conversion.isStockable : true
          },
          update: {
            conversionRatio: conversionRatio,
            prix_vente_vrac: conversion.prix_vente_vrac ? parseFloat(conversion.prix_vente_vrac) : null,
            prix_achat_vrac: conversion.prix_achat_vrac ? parseFloat(conversion.prix_achat_vrac) : null,
            isStockable: conversion.isStockable !== undefined ? conversion.isStockable : true
          }
        });
      })
    );

    await prisma.product.update({
      where: { id: parseInt(sourceProductId) },
      data: { isVraguable: true }
    });

    await logAudit(req.user.id, 'products', parseInt(sourceProductId), 'VRAC_CONVERSION_CREATED', null, {
      sourceProductId,
      conversionsCount: conversions.length
    });

    res.json({
      success: true,
      message: `${conversions.length} conversion(s) VRAC configurée(s)`,
      conversions: results
    });
  } catch (error) {
    console.error('Error creating vrac conversions:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la création des conversions VRAC',
      details: error.message 
    });
  }
});

router.delete('/vrac-conversions/:id', authenticateToken, async (req, res) => {
  try {
    const conversionId = parseInt(req.params.id);
    
    if (isNaN(conversionId) || conversionId <= 0) {
      return res.status(400).json({ error: 'ID conversion invalide' });
    }

    const conversion = await prisma.productVracConversion.findUnique({
      where: { id: conversionId },
      include: { sourceProduct: true }
    });

    if (!conversion) {
      return res.status(404).json({ error: 'Conversion non trouvée' });
    }

    await prisma.productVracConversion.delete({
      where: { id: conversionId }
    });

    const remainingConversions = await prisma.productVracConversion.count({
      where: { sourceProductId: conversion.sourceProductId }
    });

    if (remainingConversions === 0) {
      await prisma.product.update({
        where: { id: conversion.sourceProductId },
        data: { isVraguable: false }
      });
    }

    await logAudit(req.user.id, 'products', conversion.sourceProductId, 'VRAC_CONVERSION_DELETED', null, {
      conversionId,
      sourceProductId: conversion.sourceProductId
    });

    res.json({ success: true, message: 'Conversion VRAC supprimée' });
  } catch (error) {
    console.error('Error deleting vrac conversion:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression de la conversion VRAC' + (error?.message ? ' : ' + error.message : ''), code: error?.code });
  }
});

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
      // Parse reference to extract source product name and quantities
      const referenceMatch = inMovement.reference?.match(/Transfer (.+?) -> (.+)/);
      const sourceProductName = referenceMatch ? referenceMatch[1] : null;
      const targetProductName = referenceMatch ? referenceMatch[2] : null;
      
      // Parse source quantity from reference: format is "Transfer X -> Y (sourceQty x ratio = targetQty)"
      let sourceQuantityFromRef = 0;
      const quantityMatch = inMovement.reference?.match(/\(([\d.]+)\s*[x×]\s*[\d.]+\s*=\s*[\d.]+\)/);
      if (quantityMatch) {
        sourceQuantityFromRef = parseFloat(quantityMatch[1]) || 0;
      }

      // Find corresponding OUT movement (source product) - use date range to handle millisecond differences
      const movementDate = new Date(inMovement.date);
      const dateStart = new Date(movementDate.getTime() - 1000);
      const dateEnd = new Date(movementDate.getTime() + 1000);
      
      const outMovement = await prisma.stockMovement.findFirst({
        where: {
          reason: 'PRODUCT_CONVERSION',
          type: 'OUT',
          depotId: currentDepotId,
          date: {
            gte: dateStart,
            lte: dateEnd
          },
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

      // Calculate source quantity - prefer OUT movement, fallback to reference parsing
      const sourceQuantity = outMovement ? Math.abs(parseFloat(outMovement.quantity)) : sourceQuantityFromRef;
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
    // Prevent /similar-products and /depot-links from being caught by this route
    if (req.params.id === 'similar-products' || req.params.id === 'depot-links') {
      return res.status(404).json({ error: 'Route not found. Please restart the server.' });
    }
    
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
        depotPrices: true
      }
    });
    
    if (!product) {
      return res.status(404).json({ error: 'Produit non trouvé ou non assigné à ce dépôt' });
    }
    
    res.json(product);
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération du produit' + (error?.message ? ' : ' + error.message : ''), code: error?.code });
  }
});

router.post('/', authenticateToken, async (req, res) => {
  try {

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
      isVraguable,
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
      photo: photo || null,
      isVrac: isVrac || false,
      isVraguable: isVraguable !== undefined ? isVraguable : false,
      isStockable: isStockable !== undefined ? isStockable : true,
      // Wholesale fields
      isWholesale: isWholesale || false,
      bundleSize: bundleSize ? parseInt(bundleSize) : null,
      bundlePrice: bundlePrice ? parseFloat(bundlePrice) : null,
      minMargin: minMargin ? parseFloat(minMargin) : null,
      requiresApproval: requiresApproval || false
    };
    

    
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
    res.status(500).json({ error: 'Erreur lors de la création du produit' + (error?.message ? ' : ' + error.message : ''), code: error?.code });
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
    res.status(500).json({ error: 'Erreur lors de la mise à jour de l\'ordre des produits' + (error?.message ? ' : ' + error.message : ''), code: error?.code });
  }
});

router.put('/:id', authenticateToken, async (req, res) => {
  try {

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
    
    // Check if user is RESPONSABLE_MAGASIN
    const isResponsableMagasin = hasRoleOrRoleKey(req.user, ['RESPONSABLE_MAGASIN']);
    const isAdmin = req.user.role === 'ADMIN';
    
    // Get active session depotId for RESPONSABLE_MAGASIN
    let sessionDepotId = null;
    if (isResponsableMagasin && !isAdmin) {
      // Try to get depotId from query parameter or request body first
      const requestedDepotId = req.query.depotId || req.body.depotId;
      
      if (requestedDepotId) {
        const parsedDepotId = parseInt(requestedDepotId);
        if (!isNaN(parsedDepotId)) {
          // Use the requested depotId (from session or user)
          sessionDepotId = parsedDepotId;
        }
      }
      
      // If no depotId from request, try to find active session
      if (!sessionDepotId) {
        const whereClause = {
          status: 'OPEN'
        };
        
        // If user has depotId, filter by it
        if (req.user.depotId) {
          whereClause.depotId = req.user.depotId;
        }
        
        const activeSession = await prisma.sessionCaisse.findFirst({
          where: whereClause,
          orderBy: { createdAt: 'desc' }
        });
        
        if (activeSession && activeSession.depotId) {
          sessionDepotId = activeSession.depotId;
        }
      }
      
      // Fallback to user's depotId if no session found (allow modification even without active session)
      if (!sessionDepotId && req.user.depotId) {
        sessionDepotId = req.user.depotId;
      }
      
      // If still no depotId, return error
      if (!sessionDepotId) {
        return res.status(400).json({ error: 'Aucun dépôt trouvé. Veuillez contacter un administrateur.' });
      }
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
      photo,
      isVrac,
      isVraguable,
      isStockable,
      // Wholesale fields
      isWholesale,
      bundleSize,
      bundlePrice,
      minMargin,
      requiresApproval,
      depotIds
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
    if (photo !== undefined) updateData.photo = photo || null;
    if (isVrac !== undefined) updateData.isVrac = isVrac;
    if (isVraguable !== undefined) updateData.isVraguable = isVraguable;
    if (isStockable !== undefined) updateData.isStockable = isStockable;
    // Wholesale fields
    if (isWholesale !== undefined) updateData.isWholesale = isWholesale;
    if (bundleSize !== undefined) updateData.bundleSize = bundleSize ? parseInt(bundleSize) : null;
    if (bundlePrice !== undefined) updateData.bundlePrice = bundlePrice ? parseFloat(bundlePrice) : null;
    if (minMargin !== undefined) updateData.minMargin = minMargin ? parseFloat(minMargin) : null;
    if (requiresApproval !== undefined) updateData.requiresApproval = requiresApproval;
    

    
    // For RESPONSABLE_MAGASIN, we might only update depot prices, not the product itself
    let product;
    if (Object.keys(updateData).length > 0) {
      product = await prisma.product.update({
        where: { id: productId },
        data: updateData
      });
    } else {
      // If no product fields to update, just fetch the product
      product = await prisma.product.findUnique({
        where: { id: productId }
      });
    }
    
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
    const { depotPrices } = req.body;
    if (depotPrices && Array.isArray(depotPrices) && depotPrices.length > 0) {
      // For RESPONSABLE_MAGASIN, only allow updating their own depot's price
      if (isResponsableMagasin && !isAdmin) {
        // Filter to only their depot
        const allowedDepotPrices = depotPrices.filter(dp => dp.depotId === sessionDepotId);
        
        for (const depotPrice of allowedDepotPrices) {
          await prisma.productDepotPrice.upsert({
            where: {
              productId_depotId: {
                productId: productId,
                depotId: depotPrice.depotId
              }
            },
            create: {
              productId: productId,
              depotId: depotPrice.depotId,
              prix_vente_TTC: parseFloat(depotPrice.prix_vente_TTC)
            },
            update: {
              prix_vente_TTC: parseFloat(depotPrice.prix_vente_TTC)
            }
          });
        }
      } else if (isAdmin) {
        // Admin can update all depot prices
        for (const depotPrice of depotPrices) {
          await prisma.productDepotPrice.upsert({
            where: {
              productId_depotId: {
                productId: productId,
                depotId: depotPrice.depotId
              }
            },
            create: {
              productId: productId,
              depotId: depotPrice.depotId,
              prix_vente_TTC: parseFloat(depotPrice.prix_vente_TTC)
            },
            update: {
              prix_vente_TTC: parseFloat(depotPrice.prix_vente_TTC)
            }
          });
        }
      }
    }
    
    // Handle stock synchronization when product is modified
    // If isStockable changes, update inventory records accordingly
    if (isStockable !== undefined && oldProduct.isStockable !== isStockable) {
      if (isStockable) {
        // Product became stockable - create inventory records for all active depots
        const depots = await prisma.depot.findMany({
          where: { isActive: true }
        });
        
        for (const depot of depots) {
          // Check if inventory already exists
          const existingInventory = await prisma.inventory.findUnique({
            where: {
              depotId_productId: {
                depotId: depot.id,
                productId: productId
              }
            }
          });
          
          if (!existingInventory) {
            await prisma.inventory.create({
              data: {
                depotId: depot.id,
                productId: productId,
                quantity: 0
              }
            });
          }
        }
      } else {
        // Product became non-stockable - remove inventory records (but keep quantity 0 for safety)
        // Actually, we should keep inventory records but they won't be used
        // Or we can delete them if quantity is 0
        const inventories = await prisma.inventory.findMany({
          where: {
            productId: productId,
            quantity: { lte: 0 }
          }
        });
        
        if (inventories.length > 0) {
          await prisma.inventory.deleteMany({
            where: {
              productId: productId,
              quantity: { lte: 0 }
            }
          });
        }
      }
    }
    
    await logAudit(req.user.id, 'products', productId, 'UPDATE', oldProduct, updateData);
    
    // Fetch the product with all relations including depot prices
    const productWithRelations = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        famille: true,
        depotAssignments: {
          include: {
            depot: true
          }
        },
        depotPrices: true
      }
    });
    
    res.json(productWithRelations);
  } catch (error) {
    console.error('Error updating product:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Code-barres déjà existant' });
    }
    res.status(500).json({ error: 'Erreur lors de la mise à jour du produit' + (error?.message ? ' : ' + error.message : ''), code: error?.code });
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
    res.status(500).json({ error: 'Erreur lors de la suppression du produit' + (error?.message ? ' : ' + error.message : ''), code: error?.code });
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
    res.status(500).json({ error: 'Erreur lors du téléchargement de l\'image' + (error?.message ? ' : ' + error.message : ''), code: error?.code });
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
    res.status(500).json({ error: 'Erreur lors de l\'upload de la photo' + (error?.message ? ' : ' + error.message : ''), code: error?.code });
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
    res.status(500).json({ error: 'Erreur lors de la suppression de la photo' + (error?.message ? ' : ' + error.message : ''), code: error?.code });
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
    res.status(500).json({ error: 'Erreur lors de la récupération de l\'image' + (error?.message ? ' : ' + error.message : ''), code: error?.code });
  }
});

router.post('/generate-barcode', authenticateToken, async (req, res) => {
  try {
    const barcode = generateBarcode();
    res.json({ barcode });
  } catch (error) {
    console.error('Error generating barcode:', error);
    res.status(500).json({ error: 'Erreur lors de la génération du code-barres' + (error?.message ? ' : ' + error.message : ''), code: error?.code });
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
              tva: productData.tva ? parseFloat(productData.tva) : 19
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
    res.status(500).json({ error: 'Erreur lors de l\'import en masse' + (error?.message ? ' : ' + error.message : ''), code: error?.code });
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
    res.status(500).json({ error: 'Erreur lors de l\'export' + (error?.message ? ' : ' + error.message : ''), code: error?.code });
  }
});




// Transfer/Convert product to another product type
router.post('/transfer', authenticateToken, async (req, res) => {
  try {

    const { sourceProductId, targetProductId, quantity, conversionRatio, depotId } = req.body;

    // Validate required fields
    if (!sourceProductId || !targetProductId || quantity === undefined || quantity === null || conversionRatio === undefined || conversionRatio === null || !depotId) {
     
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

      // Continue with transfer - allow negative inventory
    }

    // Perform transfer in transaction
    await prisma.$transaction(async (tx) => {
      // Reduce source product inventory
      if (sourceInventory) {
        let currentSourceQty = 0;
        const sourceQtyValue = sourceInventory.quantity;
        if (sourceQtyValue === null || sourceQtyValue === undefined) {
          currentSourceQty = 0;
        } else if (typeof sourceQtyValue === 'object' && sourceQtyValue !== null) {
          if ('toNumber' in sourceQtyValue && typeof sourceQtyValue.toNumber === 'function') {
            currentSourceQty = sourceQtyValue.toNumber();
          } else {
            currentSourceQty = parseFloat(sourceQtyValue.toString()) || 0;
          }
        } else {
          currentSourceQty = parseFloat(sourceQtyValue) || 0;
        }
        const newSourceQuantity = currentSourceQty - sourceQuantity;
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
        let currentTargetQty = 0;
        const targetQtyValue = targetInventory.quantity;
        if (targetQtyValue === null || targetQtyValue === undefined) {
          currentTargetQty = 0;
        } else if (typeof targetQtyValue === 'object' && targetQtyValue !== null) {
          if ('toNumber' in targetQtyValue && typeof targetQtyValue.toNumber === 'function') {
            currentTargetQty = targetQtyValue.toNumber();
          } else {
            currentTargetQty = parseFloat(targetQtyValue.toString()) || 0;
          }
        } else {
          currentTargetQty = parseFloat(targetQtyValue) || 0;
        }
        const newTargetQuantity = currentTargetQty + targetQuantity;
        await tx.inventory.update({
          where: { id: targetInventory.id },
          data: { quantity: newTargetQuantity }
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
    });

    await logAudit(req.user.id, 'products', parseInt(sourceProductId), 'TRANSFER', null, {
      sourceProductId,
      targetProductId,
      quantity: sourceQuantity,
      conversionRatio: ratio,
      targetQuantity
    });

    const io = req.app.get('io');
    if (io) {
      const sourceInventoryAfter = await prisma.inventory.findUnique({
        where: {
          depotId_productId: {
            depotId: depotIdInt,
            productId: parseInt(sourceProductId)
          }
        }
      });
      
      if (sourceInventoryAfter) {
        io.to(`depot_${depotIdInt}`).emit('stock_updated', {
          productId: parseInt(sourceProductId),
          quantity: parseFloat(sourceInventoryAfter.quantity?.toString() || '0'),
          updatedBy: req.user.username,
          updatedAt: new Date()
        });
      }

      const targetInventoryAfter = await prisma.inventory.findUnique({
        where: {
          depotId_productId: {
            depotId: depotIdInt,
            productId: parseInt(targetProductId)
          }
        }
      });
      
      if (targetInventoryAfter) {
        io.to(`depot_${depotIdInt}`).emit('stock_updated', {
          productId: parseInt(targetProductId),
          quantity: parseFloat(targetInventoryAfter.quantity?.toString() || '0'),
          updatedBy: req.user.username,
          updatedAt: new Date()
        });
      }
    }

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

router.post('/transfer-multiple', authenticateToken, async (req, res) => {
  try {
    const { sourceProductId, transfers, depotId } = req.body;

    if (!sourceProductId || !transfers || !Array.isArray(transfers) || transfers.length === 0 || !depotId) {
      return res.status(400).json({ 
        error: 'Tous les champs sont requis et transfers doit être un tableau non vide',
        received: { sourceProductId, transfers, depotId, transfersLength: transfers?.length }
      });
    }

    const sourceProductIdInt = parseInt(sourceProductId);
    const depotIdInt = parseInt(depotId);

    if (isNaN(sourceProductIdInt) || sourceProductIdInt <= 0) {
      return res.status(400).json({ 
        error: 'ID produit source invalide',
        received: sourceProductId,
        parsed: sourceProductIdInt
      });
    }

    if (isNaN(depotIdInt) || depotIdInt <= 0) {
      return res.status(400).json({ 
        error: 'ID dépôt invalide (doit être supérieur à 0)',
        received: depotId,
        parsed: depotIdInt
      });
    }

    const sourceProduct = await prisma.product.findUnique({
      where: { id: sourceProductIdInt }
    });

    if (!sourceProduct) {
      return res.status(404).json({ error: 'Produit source non trouvé' });
    }

    const targetProductIds = transfers.map(t => parseInt(t.targetProductId));
    const uniqueTargetIds = [...new Set(targetProductIds)];
    
    if (uniqueTargetIds.length !== targetProductIds.length) {
      return res.status(400).json({ 
        error: 'Produits destinataires dupliqués détectés',
        targetProductIds,
        uniqueTargetIds
      });
    }

    const targetProducts = await prisma.product.findMany({
      where: { id: { in: uniqueTargetIds } }
    });

    if (targetProducts.length !== uniqueTargetIds.length) {
      const foundIds = targetProducts.map(p => p.id);
      const missingIds = uniqueTargetIds.filter(id => !foundIds.includes(id));
      console.error('Missing target products:', missingIds);
      return res.status(404).json({ 
        error: 'Un ou plusieurs produits cibles non trouvés',
        requestedIds: uniqueTargetIds,
        foundIds: foundIds,
        missingIds: missingIds
      });
    }

    const transferDetails = [];
    let totalSourceQuantity = 0;

    if (transfers.length === 0) {
      return res.status(400).json({ error: 'Aucun transfert spécifié' });
    }

    const firstTransfer = transfers[0];
    if (!firstTransfer || firstTransfer.quantity === undefined || firstTransfer.quantity === null) {
      return res.status(400).json({ 
        error: 'Le premier transfert doit contenir une quantité source valide',
        received: firstTransfer
      });
    }

    const sourceQuantity = parseFloat(firstTransfer.quantity);

    if (isNaN(sourceQuantity) || sourceQuantity <= 0) {
      return res.status(400).json({ 
        error: 'La quantité source doit être positive',
        received: firstTransfer.quantity,
        parsed: sourceQuantity
      });
    }

    totalSourceQuantity = sourceQuantity;

    for (const transfer of transfers) {
      if (!transfer || !transfer.targetProductId || transfer.quantity === undefined || transfer.quantity === null || transfer.conversionRatio === undefined || transfer.conversionRatio === null) {
        return res.status(400).json({ 
          error: 'Chaque transfert doit contenir targetProductId, quantity et conversionRatio',
          received: transfer,
          hasTargetProductId: !!transfer?.targetProductId,
          hasQuantity: transfer?.quantity !== undefined && transfer?.quantity !== null,
          hasConversionRatio: transfer?.conversionRatio !== undefined && transfer?.conversionRatio !== null
        });
      }

      const targetProductId = parseInt(transfer.targetProductId);
      const transferSourceQuantity = parseFloat(transfer.quantity);
      const ratio = parseFloat(transfer.conversionRatio);
      

      if (isNaN(targetProductId) || targetProductId <= 0) {
        return res.status(400).json({ 
          error: 'ID produit destinataire invalide',
          received: transfer.targetProductId,
          parsed: targetProductId
        });
      }

      if (isNaN(transferSourceQuantity) || transferSourceQuantity <= 0) {
        return res.status(400).json({ 
          error: 'La quantité source doit être positive',
          received: transfer.quantity,
          parsed: transferSourceQuantity
        });
      }

      if (Math.abs(transferSourceQuantity - sourceQuantity) > 0.001) {
        return res.status(400).json({ 
          error: 'Tous les transferts doivent utiliser la même quantité source',
          expected: sourceQuantity,
          received: transferSourceQuantity,
          difference: Math.abs(transferSourceQuantity - sourceQuantity),
          transfer: transfer
        });
      }

      if (isNaN(ratio) || ratio <= 0) {
        return res.status(400).json({ 
          error: 'Le ratio de conversion doit être positif',
          received: transfer.conversionRatio,
          parsed: ratio
        });
      }

      const targetProduct = targetProducts.find(p => p.id === targetProductId);
      if (!targetProduct) {
        return res.status(404).json({ error: `Produit destinataire ${targetProductId} non trouvé` });
      }

      const targetQuantity = parseFloat((sourceQuantity * ratio).toFixed(3));


      if (!isFinite(targetQuantity) || targetQuantity < 0) {
        return res.status(400).json({ error: `Quantité calculée invalide pour le produit ${targetProduct.name}` });
      }

      transferDetails.push({
        targetProductId,
        targetProductName: targetProduct.name,
        sourceQuantity,
        ratio,
        targetQuantity
      });
    }

    let sourceInventory = await prisma.inventory.findUnique({
      where: {
        depotId_productId: {
          depotId: depotIdInt,
          productId: sourceProductIdInt
        }
      }
    });

    if (!sourceInventory) {
      sourceInventory = await prisma.inventory.findFirst({
        where: {
          depotId: depotIdInt,
          productId: sourceProductIdInt
        }
      });
    }

    const allInventories = await prisma.inventory.findMany({
      where: {
        productId: sourceProductIdInt
      }
    });

    let currentSourceQuantity = 0;
    if (sourceInventory) {
      const quantityValue = sourceInventory.quantity;
      
      try {
        if (quantityValue === null || quantityValue === undefined) {
          currentSourceQuantity = 0;
        } else if (typeof quantityValue === 'object' && quantityValue !== null) {
          if ('toNumber' in quantityValue && typeof quantityValue.toNumber === 'function') {
            currentSourceQuantity = quantityValue.toNumber();
          } else if ('toString' in quantityValue && typeof quantityValue.toString === 'function') {
            const strValue = quantityValue.toString();
            currentSourceQuantity = parseFloat(strValue) || 0;
          } else if (quantityValue.constructor && quantityValue.constructor.name === 'Decimal') {
            currentSourceQuantity = parseFloat(quantityValue.toString()) || 0;
          } else {
            currentSourceQuantity = Number(quantityValue) || 0;
          }
        } else if (typeof quantityValue === 'string') {
          currentSourceQuantity = parseFloat(quantityValue) || 0;
        } else if (typeof quantityValue === 'number') {
          currentSourceQuantity = quantityValue;
        } else {
          currentSourceQuantity = Number(quantityValue) || 0;
        }
        
        if (isNaN(currentSourceQuantity) || !isFinite(currentSourceQuantity)) {
          console.error('Failed to parse quantity, raw value:', quantityValue);
          currentSourceQuantity = 0;
        }
      } catch (parseError) {
        console.error('Error parsing quantity:', parseError, 'raw value:', quantityValue);
        currentSourceQuantity = 0;
      }
    }

    if (sourceInventory) {
      if (isNaN(currentSourceQuantity)) {
        console.error('Failed to parse quantity, using 0:', {
          raw: sourceInventory.quantity,
          type: typeof sourceInventory.quantity
        });
        currentSourceQuantity = 0;
      }
      
      if (currentSourceQuantity < totalSourceQuantity) {
        const totalStockInAllDepots = allInventories.reduce((sum, inv) => {
          const qty = parseFloat(inv.quantity?.toString() || '0') || 0;
          return sum + qty;
        }, 0);

        console.warn('Stock insufficient in current depot:', {
          currentSourceQuantity,
          totalSourceQuantity,
          difference: totalSourceQuantity - currentSourceQuantity,
          totalStockInAllDepots,
          allDepots: allInventories.map(inv => ({
            depotId: inv.depotId,
            quantity: parseFloat(inv.quantity?.toString() || '0') || 0
          }))
        });

        if (totalStockInAllDepots >= totalSourceQuantity) {
          const depotsWithStock = allInventories
            .filter(inv => {
              const qty = parseFloat(inv.quantity?.toString() || '0') || 0;
              return qty > 0;
            })
            .map(inv => ({
              depotId: inv.depotId,
              quantity: parseFloat(inv.quantity?.toString() || '0') || 0
            }));

          console.warn('Stock available in other depots, but allowing transfer anyway');
        }

      }
    }

    const results = await prisma.$transaction(async (tx) => {
      if (sourceInventory) {
        let currentSourceQty = 0;
        const sourceQtyValue = sourceInventory.quantity;
        if (sourceQtyValue === null || sourceQtyValue === undefined) {
          currentSourceQty = 0;
        } else if (typeof sourceQtyValue === 'object' && sourceQtyValue !== null) {
          if ('toNumber' in sourceQtyValue && typeof sourceQtyValue.toNumber === 'function') {
            currentSourceQty = sourceQtyValue.toNumber();
          } else {
            currentSourceQty = parseFloat(sourceQtyValue.toString()) || 0;
          }
        } else {
          currentSourceQty = parseFloat(sourceQtyValue) || 0;
        }
        
        const newSourceQuantity = currentSourceQty - totalSourceQuantity;
       
        const updatedSource = await tx.inventory.update({
          where: { id: sourceInventory.id },
          data: { quantity: newSourceQuantity }
        });
       
      } else {
        
        const createdSource = await tx.inventory.create({
          data: {
            depotId: depotIdInt,
            productId: sourceProductIdInt,
            quantity: -totalSourceQuantity
          }
        });
        
      }

      const targetProductsList = transferDetails.map(d => d.targetProductName).join(', ');
      const sourceReferenceText = `Transfer ${sourceProduct.name} -> ${targetProductsList} (${totalSourceQuantity} source → ${transferDetails.length} destinations)`;
      
      await tx.stockMovement.create({
        data: {
          productId: sourceProductIdInt,
          depotId: depotIdInt,
          quantity: -totalSourceQuantity,
          type: 'OUT',
          reason: 'PRODUCT_CONVERSION',
          reference: sourceReferenceText,
          userId: req.user.id
        }
      });

      const transferResults = [];

      for (const detail of transferDetails) {
        try {

          const targetInventory = await tx.inventory.findUnique({
            where: {
              depotId_productId: {
                depotId: depotIdInt,
                productId: detail.targetProductId
              }
            }
          });

          const targetQtyToAdd = parseFloat(detail.targetQuantity);
          
          if (isNaN(targetQtyToAdd) || !isFinite(targetQtyToAdd)) {
            throw new Error(`Invalid target quantity: ${detail.targetQuantity} for product ${detail.targetProductId}`);
          }
          
          if (targetInventory) {
            let currentTargetQty = 0;
            const targetQtyValue = targetInventory.quantity;
            if (targetQtyValue === null || targetQtyValue === undefined) {
              currentTargetQty = 0;
            } else if (typeof targetQtyValue === 'object' && targetQtyValue !== null) {
              if ('toNumber' in targetQtyValue && typeof targetQtyValue.toNumber === 'function') {
                currentTargetQty = targetQtyValue.toNumber();
              } else {
                currentTargetQty = parseFloat(targetQtyValue.toString()) || 0;
              }
            } else {
              currentTargetQty = parseFloat(targetQtyValue) || 0;
            }
            
            const newTargetQuantity = parseFloat((currentTargetQty + targetQtyToAdd).toFixed(3));
          
            
            const updatedTarget = await tx.inventory.update({
              where: { id: targetInventory.id },
              data: { quantity: newTargetQuantity }
            });
            
          } else {
            
            const createdTarget = await tx.inventory.create({
              data: {
                depotId: depotIdInt,
                productId: detail.targetProductId,
                quantity: parseFloat(targetQtyToAdd.toFixed(3))
              }
            });
            
          }
        } catch (detailError) {
          console.error(`Error processing transfer detail for product ${detail.targetProductId}:`, detailError);
          throw detailError;
        }

        const referenceText = `Transfer ${sourceProduct.name} -> ${detail.targetProductName} (${detail.sourceQuantity} × ${detail.ratio} = ${detail.targetQuantity})`;
        
        await tx.stockMovement.create({
          data: {
            productId: detail.targetProductId,
            depotId: depotIdInt,
            quantity: detail.targetQuantity,
            type: 'IN',
            reason: 'PRODUCT_CONVERSION',
            reference: referenceText,
            userId: req.user.id
          }
        });

        transferResults.push({
          targetProductId: detail.targetProductId,
          targetProductName: detail.targetProductName,
          sourceQuantity: detail.sourceQuantity,
          targetQuantity: detail.targetQuantity,
          ratio: detail.ratio
        });
      }

      return transferResults;
    });

    await logAudit(req.user.id, 'products', sourceProductIdInt, 'TRANSFER_MULTIPLE', null, {
      sourceProductId: sourceProductIdInt,
      sourceProductName: sourceProduct.name,
      totalSourceQuantity,
      transfers: results,
      depotId: depotIdInt
    });

    const io = req.app.get('io');
    if (io) {
      const sourceInventoryAfter = await prisma.inventory.findUnique({
        where: {
          depotId_productId: {
            depotId: depotIdInt,
            productId: sourceProductIdInt
          }
        }
      });
      
      if (sourceInventoryAfter) {
        io.to(`depot_${depotIdInt}`).emit('stock_updated', {
          productId: sourceProductIdInt,
          quantity: parseFloat(sourceInventoryAfter.quantity?.toString() || '0'),
          updatedBy: req.user.username,
          updatedAt: new Date()
        });
      }

      for (const result of results) {
        const targetInventoryAfter = await prisma.inventory.findUnique({
          where: {
            depotId_productId: {
              depotId: depotIdInt,
              productId: result.targetProductId
            }
          }
        });
        
        if (targetInventoryAfter) {
          io.to(`depot_${depotIdInt}`).emit('stock_updated', {
            productId: result.targetProductId,
            quantity: parseFloat(targetInventoryAfter.quantity?.toString() || '0'),
            updatedBy: req.user.username,
            updatedAt: new Date()
          });
        }
      }
    }

    res.json({ 
      success: true,
      message: `Transfert réussi: ${totalSourceQuantity} ${sourceProduct.unite} de ${sourceProduct.name} transféré(s) vers ${transfers.length} produit(s) destinataire(s)`,
      summary: {
        sourceProduct: {
          id: sourceProductIdInt,
          name: sourceProduct.name,
          unite: sourceProduct.unite,
          quantity: totalSourceQuantity
        },
        transfers: results,
        totalTargetQuantity: results.reduce((sum, r) => sum + r.targetQuantity, 0)
      }
    });
  } catch (error) {
    console.error('Error transferring products:', error);
    console.error('Error stack:', error.stack);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      meta: error.meta,
      name: error.name
    });
    res.status(500).json({ 
      error: 'Erreur lors du transfert des produits',
      details: error.message,
      code: error.code
    });
  }
});

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

    const pageNum = parseInt(page.toString());
    const limitNum = parseInt(limit.toString());
    
    const allOutMovements = await prisma.stockMovement.findMany({
      where: {
        reason: 'PRODUCT_CONVERSION',
        type: 'OUT',
        depotId: currentDepotId,
        date: {
          gte: dateFilter.gte || new Date('2000-01-01'),
          lte: dateFilter.lte || new Date('2100-01-01')
        }
      },
      include: {
        product: {
          include: {
            famille: true
          }
        }
      },
      orderBy: {
        date: 'desc'
      }
    });

    const transferGroupsMap = new Map();
    
    for (const inMovement of inMovements) {
      const movementDate = new Date(inMovement.date);
      const dateStart = new Date(movementDate.getTime() - 2000);
      const dateEnd = new Date(movementDate.getTime() + 2000);
      
      let outMovement = allOutMovements.find(out => {
        const outDate = new Date(out.date);
        return out.reason === 'PRODUCT_CONVERSION' &&
               out.type === 'OUT' &&
               out.depotId === currentDepotId &&
               out.userId === inMovement.userId &&
               outDate >= dateStart &&
               outDate <= dateEnd &&
               (out.reference?.includes('source →') || out.reference?.includes('destinations') || 
                (inMovement.reference && out.reference && out.reference.includes(inMovement.reference.split(' -> ')[0]?.replace('Transfer ', '') || '')));
      });
      
      if (!outMovement && inMovement.reference) {
        const refParts = inMovement.reference.split(' -> ');
        if (refParts.length > 0) {
          const sourceName = refParts[0].replace('Transfer ', '').trim();
          outMovement = allOutMovements.find(out => {
            const outDate = new Date(out.date);
            return out.reason === 'PRODUCT_CONVERSION' &&
                   out.type === 'OUT' &&
                   out.depotId === currentDepotId &&
                   out.userId === inMovement.userId &&
                   outDate >= dateStart &&
                   outDate <= dateEnd &&
                   (out.reference?.includes(sourceName) || out.product?.name === sourceName);
          });
        }
      }

      const sourceQuantity = outMovement ? Math.abs(parseFloat(outMovement.quantity)) : 0;
      const targetQuantity = parseFloat(inMovement.quantity);
      const conversionRatio = sourceQuantity > 0 ? targetQuantity / sourceQuantity : 0;
      
      const timeKey = Math.floor(movementDate.getTime() / 1000);
      const groupKey = outMovement ? `${outMovement.id}_${inMovement.userId}_${timeKey}` : `${inMovement.userId}_${timeKey}`;
      
      if (!transferGroupsMap.has(groupKey)) {
        transferGroupsMap.set(groupKey, {
          id: outMovement?.id || inMovement.id,
          date: inMovement.date,
          sourceProduct: outMovement ? {
            id: outMovement.productId,
            name: outMovement.product.name,
            famille: outMovement.product.famille,
            quantity: sourceQuantity,
            unite: outMovement.product.unite
          } : {
            id: null,
            name: 'Produit inconnu',
            famille: null,
            quantity: sourceQuantity,
            unite: null
          },
          targetProducts: [],
          depot: inMovement.depot,
          user: inMovement.user,
          reference: outMovement?.reference || inMovement.reference
        });
      }
      
      const transferGroup = transferGroupsMap.get(groupKey);
      if (transferGroup) {
        transferGroup.targetProducts.push({
          id: inMovement.productId,
          name: inMovement.product.name,
          famille: inMovement.product.famille,
          quantity: targetQuantity,
          unite: inMovement.product.unite,
          isVrac: inMovement.product.isVrac,
          conversionRatio: conversionRatio
        });
      }
    }
    
    const transferHistory = Array.from(transferGroupsMap.values())
      .filter(item => item.targetProducts && item.targetProducts.length > 0)
      .sort((a, b) => new Date(b.date) - new Date(a.date));
    
    const totalCount = transferHistory.length;
    const startIndex = (pageNum - 1) * limitNum;
    const endIndex = startIndex + limitNum;
    const paginatedHistory = transferHistory.slice(startIndex, endIndex);

    

    res.json({
      data: paginatedHistory,
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

router.put('/transfer-history/:id', authenticateToken, async (req, res) => {
  try {
    const transferId = parseInt(req.params.id);
    const { depotId, updates } = req.body;

    if (isNaN(transferId) || transferId <= 0) {
      return res.status(400).json({ error: 'ID de transfert invalide' });
    }

    if (!updates || !Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({ error: 'Les mises à jour sont requises' });
    }

    let currentDepotId;
    if (depotId) {
      currentDepotId = Number(depotId);
      if (isNaN(currentDepotId) || currentDepotId <= 0) {
        return res.status(400).json({ error: 'Dépôt invalide dans la requête' });
      }
    } else if (req.user?.depotId) {
      currentDepotId = Number(req.user.depotId);
      if (isNaN(currentDepotId) || currentDepotId <= 0) {
        currentDepotId = 1;
      }
    } else {
      currentDepotId = 1;
    }

    const inMovement = await prisma.stockMovement.findUnique({
      where: { id: transferId },
      include: {
        product: true
      }
    });

    if (!inMovement) {
      return res.status(404).json({ error: 'Transaction de transfert non trouvée' });
    }

    if (inMovement.reason !== 'PRODUCT_CONVERSION' || inMovement.type !== 'IN') {
      return res.status(400).json({ error: 'Cette transaction n\'est pas un transfert valide' });
    }

    if (inMovement.depotId !== currentDepotId) {
      return res.status(403).json({ error: 'Vous n\'avez pas accès à ce dépôt' });
    }

    const movementDate = new Date(inMovement.date);
    const dateStart = new Date(movementDate.getTime() - 1000);
    const dateEnd = new Date(movementDate.getTime() + 1000);

    const allInMovements = await prisma.stockMovement.findMany({
      where: {
        reason: 'PRODUCT_CONVERSION',
        type: 'IN',
        depotId: currentDepotId,
        date: {
          gte: dateStart,
          lte: dateEnd
        },
        userId: inMovement.userId
      },
      include: {
        product: true
      }
    });

    const relatedInMovements = allInMovements.filter(m => {
      const mDate = new Date(m.date);
      return Math.abs(mDate.getTime() - movementDate.getTime()) < 2000;
    });

    const result = await prisma.$transaction(async (tx) => {
      for (const update of updates) {
        const relatedMovement = relatedInMovements.find(m => m.productId === update.targetProductId);
        if (!relatedMovement) {
          continue;
        }

        const oldQuantity = parseFloat(relatedMovement.quantity);
        const newQuantity = parseFloat(update.newQuantity);
        const quantityDiff = newQuantity - oldQuantity;

        if (Math.abs(quantityDiff) < 0.001) {
          continue;
        }

        const targetInventory = await tx.inventory.findUnique({
          where: {
            depotId_productId: {
              depotId: currentDepotId,
              productId: update.targetProductId
            }
          }
        });

        if (targetInventory) {
          const currentTargetQty = parseFloat(targetInventory.quantity);
          const newTargetQty = currentTargetQty + quantityDiff;

          if (newTargetQty < 0) {
            throw new Error(`La quantité ne peut pas être négative pour le produit ${relatedMovement.product.name}`);
          }

          if (newTargetQty === 0) {
            await tx.inventory.delete({
              where: { id: targetInventory.id }
            });
          } else {
            await tx.inventory.update({
              where: { id: targetInventory.id },
              data: { quantity: newTargetQty }
            });
          }
        } else if (quantityDiff > 0) {
          await tx.inventory.create({
            data: {
              depotId: currentDepotId,
              productId: update.targetProductId,
              quantity: quantityDiff
            }
          });
        }

        await tx.stockMovement.update({
          where: { id: relatedMovement.id },
          data: { quantity: newQuantity }
        });

        await tx.stockMovement.create({
          data: {
            productId: update.targetProductId,
            depotId: currentDepotId,
            quantity: quantityDiff,
            type: quantityDiff > 0 ? 'IN' : 'OUT',
            reason: 'TRANSFER_UPDATED',
            reference: `MISE À JOUR: ${relatedMovement.reference}`,
            userId: req.user.id
          }
        });
      }

      return { updated: true };
    });

    await logAudit(req.user.id, 'products', transferId, 'TRANSFER_UPDATED', null, {
      transferId,
      updates,
      depotId: currentDepotId
    });

    res.json({
      success: true,
      message: 'Transaction mise à jour avec succès',
      result
    });
  } catch (error) {
    console.error('Error updating transfer:', error);
    res.status(500).json({
      error: 'Erreur lors de la mise à jour de la transaction',
      details: error.message
    });
  }
});

router.delete('/transfer-history/:id', authenticateToken, async (req, res) => {
  try {
    const transferId = parseInt(req.params.id);
    const { depotId } = req.query;

    if (isNaN(transferId) || transferId <= 0) {
      return res.status(400).json({ error: 'ID de transfert invalide' });
    }

    let currentDepotId;
    if (depotId) {
      currentDepotId = Number(depotId);
      if (isNaN(currentDepotId) || currentDepotId <= 0) {
        return res.status(400).json({ error: 'Dépôt invalide dans la requête' });
      }
    } else if (req.user?.depotId) {
      currentDepotId = Number(req.user.depotId);
      if (isNaN(currentDepotId) || currentDepotId <= 0) {
        currentDepotId = 1;
      }
    } else {
      currentDepotId = 1;
    }

    const inMovement = await prisma.stockMovement.findUnique({
      where: { id: transferId },
      include: {
        product: true
      }
    });

    if (!inMovement) {
      return res.status(404).json({ error: 'Transaction de transfert non trouvée' });
    }

    if (inMovement.reason !== 'PRODUCT_CONVERSION' || inMovement.type !== 'IN') {
      return res.status(400).json({ error: 'Cette transaction n\'est pas un transfert valide' });
    }

    if (inMovement.depotId !== currentDepotId) {
      return res.status(403).json({ error: 'Vous n\'avez pas accès à ce dépôt' });
    }

    const movementDate = new Date(inMovement.date);
    const dateStart = new Date(movementDate.getTime() - 1000);
    const dateEnd = new Date(movementDate.getTime() + 1000);

    let outMovement = await prisma.stockMovement.findFirst({
      where: {
        reason: 'PRODUCT_CONVERSION',
        type: 'OUT',
        depotId: currentDepotId,
        date: {
          gte: dateStart,
          lte: dateEnd
        },
        userId: inMovement.userId
      },
      include: {
        product: true
      },
      orderBy: {
        date: 'desc'
      }
    });

    if (!outMovement) {
      const refParts = inMovement.reference?.split(' -> ');
      if (refParts && refParts.length > 0) {
        const sourceName = refParts[0].replace('Transfer ', '').trim();
        outMovement = await prisma.stockMovement.findFirst({
          where: {
            reason: 'PRODUCT_CONVERSION',
            type: 'OUT',
            depotId: currentDepotId,
            date: {
              gte: dateStart,
              lte: dateEnd
            },
            reference: {
              contains: sourceName
            }
          },
          include: {
            product: true
          }
        });
      }
    }

    if (!outMovement) {
      return res.status(404).json({ error: 'Mouvement source correspondant non trouvé' });
    }

    const allInMovements = await prisma.stockMovement.findMany({
      where: {
        reason: 'PRODUCT_CONVERSION',
        type: 'IN',
        depotId: currentDepotId,
        date: {
          gte: dateStart,
          lte: dateEnd
        },
        userId: inMovement.userId
      },
      include: {
        product: true
      }
    });

    const relatedInMovements = allInMovements.filter(m => {
      const mDate = new Date(m.date);
      return Math.abs(mDate.getTime() - movementDate.getTime()) < 2000;
    });

    const sourceQuantity = Math.abs(parseFloat(outMovement.quantity));

    const result = await prisma.$transaction(async (tx) => {
      const sourceInventory = await tx.inventory.findUnique({
        where: {
          depotId_productId: {
            depotId: currentDepotId,
            productId: outMovement.productId
          }
        }
      });

      if (sourceInventory) {
        const currentSourceQty = parseFloat(sourceInventory.quantity);
        const newSourceQty = currentSourceQty + sourceQuantity;
        await tx.inventory.update({
          where: { id: sourceInventory.id },
          data: { quantity: newSourceQty }
        });
      } else {
        await tx.inventory.create({
          data: {
            depotId: currentDepotId,
            productId: outMovement.productId,
            quantity: sourceQuantity
          }
        });
      }

      for (const relatedInMovement of relatedInMovements) {
        const targetQuantity = parseFloat(relatedInMovement.quantity);
        const targetInventory = await tx.inventory.findUnique({
          where: {
            depotId_productId: {
              depotId: currentDepotId,
              productId: relatedInMovement.productId
            }
          }
        });

        if (targetInventory) {
          const currentTargetQty = parseFloat(targetInventory.quantity);
          const newTargetQty = currentTargetQty - targetQuantity;

          await tx.inventory.update({
            where: { id: targetInventory.id },
            data: { quantity: newTargetQty }
          });
        } else {
          throw new Error(`L'inventaire du produit destinataire ${relatedInMovement.product.name} n'existe pas. Impossible de retirer la quantité.`);
        }

        await tx.stockMovement.create({
          data: {
            productId: relatedInMovement.productId,
            depotId: currentDepotId,
            quantity: -targetQuantity,
            type: 'OUT',
            reason: 'TRANSFER_DELETED_REVERSED',
            reference: `SUPPRESSION: ${relatedInMovement.reference}`,
            userId: req.user.id
          }
        });

        await tx.stockMovement.delete({
          where: { id: relatedInMovement.id }
        });
      }

      await tx.stockMovement.create({
        data: {
          productId: outMovement.productId,
          depotId: currentDepotId,
          quantity: sourceQuantity,
          type: 'IN',
          reason: 'TRANSFER_DELETED_REVERSED',
          reference: `SUPPRESSION: ${outMovement.reference}`,
          userId: req.user.id
        }
      });

      await tx.stockMovement.delete({
        where: { id: outMovement.id }
      });

      return {
        deleted: true,
        sourceProductId: outMovement.productId,
        targetProducts: relatedInMovements.map(m => ({
          id: m.productId,
          quantity: parseFloat(m.quantity)
        })),
        sourceQuantity,
        deletedMovementsCount: relatedInMovements.length
      };
    });

    res.json({
      message: 'Transaction de transfert supprimée avec succès',
      data: result
    });
  } catch (error) {
    console.error('Error deleting transfer transaction:', error);
    res.status(500).json({
      error: 'Erreur lors de la suppression de la transaction',
      details: error.message
    });
  }
});



module.exports = router; 
module.exports = router; 
module.exports = router; 
module.exports = router; 