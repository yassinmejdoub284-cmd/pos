const express = require('express');
const { prisma } = require('../lib/prisma');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticateToken } = require('../middleware/auth');
const { logAudit } = require('../lib/audit');
const ImageOptimizer = require('../lib/image-optimizer');

const router = express.Router();

const USER_ROLES_FILE = path.join(__dirname, '../uploads/user-roles.json');

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

// Get all product depot links (MUST be before /:id route)
router.get('/depot-links', authenticateToken, async (req, res) => {
  try {
    const productLinksRaw = await prisma.productDepotLink.findMany({
      include: {
        sourceProduct: {
          select: {
            id: true,
            name: true,
            barcode: true
          }
        },
        sourceDepot: {
          select: {
            id: true,
            name: true,
            code: true,
            city: true,
            type: true
          }
        },
        destinationProduct: {
          select: {
            id: true,
            name: true,
            barcode: true
          }
        },
        destinationDepot: {
          select: {
            id: true,
            name: true,
            code: true,
            city: true,
            type: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    const produitDeCaisseLinksRaw = await prisma.produitDeCaisseDepotLink.findMany({
      include: {
        sourceProduct: {
          select: {
            id: true,
            name: true,
            barcode: true
          }
        },
        sourceDepot: {
          select: {
            id: true,
            name: true,
            code: true,
            city: true,
            type: true
          }
        },
        destinationProduct: {
          select: {
            id: true,
            name: true,
            barcode: true
          }
        },
        destinationDepot: {
          select: {
            id: true,
            name: true,
            code: true,
            city: true,
            type: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    const allLinks = [
      ...productLinksRaw.map(link => ({
        id: link.id,
        sourceProductId: link.sourceProductId,
        sourceDepotId: link.sourceDepotId,
        destinationProductId: link.destinationProductId,
        destinationDepotId: link.destinationDepotId,
        createdAt: link.createdAt,
        updatedAt: link.updatedAt,
        linkType: 'Product',
        sourceProduct: link.sourceProduct,
        sourceDepot: link.sourceDepot,
        destinationProduct: link.destinationProduct,
        destinationDepot: link.destinationDepot
      })),
      ...produitDeCaisseLinksRaw.map(link => ({
        id: link.id,
        sourceProductId: link.sourceProductId,
        sourceDepotId: link.sourceDepotId,
        destinationProductId: link.destinationProductId,
        destinationDepotId: link.destinationDepotId,
        createdAt: link.createdAt,
        updatedAt: link.updatedAt,
        linkType: 'ProduitDeCaisse',
        sourceProduct: link.sourceProduct,
        sourceDepot: link.sourceDepot,
        destinationProduct: link.destinationProduct,
        destinationDepot: link.destinationDepot
      }))
    ];
    
    res.json(allLinks);
  } catch (error) {
    console.error('Error fetching all product depot links:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des liens' });
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

// Get similar products from source depot(s) for linking
router.get('/similar-products', authenticateToken, async (req, res) => {
  console.log('✅ Route /similar-products reached');
  try {
    const { sourceDepotIds, productName, barcode, destinationProductId } = req.query;
    
    console.log('Raw query params:', {
      sourceDepotIds,
      productName,
      barcode,
      destinationProductId,
      sourceDepotIdsType: typeof sourceDepotIds,
      isArray: Array.isArray(sourceDepotIds),
      fullQuery: req.query
    });
    
    if (!sourceDepotIds || 
        (Array.isArray(sourceDepotIds) && sourceDepotIds.length === 0) ||
        (typeof sourceDepotIds === 'string' && sourceDepotIds.trim() === '')) {
      return res.status(400).json({ 
        error: 'Source depot IDs are required',
        received: sourceDepotIds,
        type: typeof sourceDepotIds,
        isEmpty: typeof sourceDepotIds === 'string' ? sourceDepotIds.trim() === '' : false
      });
    }
    
    // Handle both array and comma-separated string formats
    let depotIds = [];
    
    try {
      if (Array.isArray(sourceDepotIds)) {
        depotIds = sourceDepotIds
          .map(id => parseInt(String(id)))
          .filter(id => !isNaN(id) && id > 0);
      } else {
        const strValue = String(sourceDepotIds).trim();
        if (strValue.includes(',')) {
          depotIds = strValue
            .split(',')
            .map(id => parseInt(id.trim()))
            .filter(id => !isNaN(id) && id > 0);
        } else {
          const parsed = parseInt(strValue);
          if (!isNaN(parsed) && parsed > 0) {
            depotIds = [parsed];
          }
        }
      }
    } catch (parseError) {
      console.error('Error parsing sourceDepotIds:', parseError);
      return res.status(400).json({ 
        error: 'Error parsing source depot IDs',
        received: sourceDepotIds,
        details: parseError.message
      });
    }
    
    if (depotIds.length === 0) {
      console.error('❌ No valid depot IDs parsed:', {
        received: sourceDepotIds,
        type: typeof sourceDepotIds,
        parsed: depotIds
      });
      return res.status(400).json({ 
        error: 'Invalid source depot IDs format - no valid IDs found',
        received: sourceDepotIds,
        type: typeof sourceDepotIds,
        parsed: depotIds
      });
    }
    
    console.log('✅ Parsed depot IDs successfully:', depotIds);
    
    console.log('Processing similar products request:', {
      sourceDepotIds: req.query.sourceDepotIds,
      depotIds,
      productName,
      barcode,
      destinationProductId
    });
    
    // Get excluded product IDs first
    let excludedProductIds = [];
    if (destinationProductId) {
      const destProductId = parseInt(destinationProductId);
      
      if (isNaN(destProductId)) {
        return res.status(400).json({ 
          error: 'Invalid destination product ID format',
          received: destinationProductId
        });
      }
      
      // Get existing links to avoid duplicates
      const existingLinks = await prisma.productDepotLink.findMany({
        where: {
          destinationProductId: destProductId
        },
        select: {
          sourceProductId: true,
          sourceDepotId: true
        }
      });
      
      excludedProductIds = existingLinks.map(link => link.sourceProductId);
      excludedProductIds.push(destProductId);
    }
    
    // First, get all ProductDepot assignments for the selected depots
    const depotAssignments = await prisma.productDepot.findMany({
      where: {
        depotId: { in: depotIds }
      },
      select: {
        productId: true,
        depotId: true
      }
    });
    
    if (depotAssignments.length === 0) {
      return res.json([]);
    }
    
    // Get unique product IDs
    const productIds = [...new Set(depotAssignments.map(da => da.productId))];
    
    // Exclude products that are already linked or are the destination product
    const filteredProductIds = excludedProductIds.length > 0
      ? productIds.filter(id => !excludedProductIds.includes(id))
      : productIds;
    
    if (filteredProductIds.length === 0) {
      return res.json([]);
    }
    
    // Build search conditions
    const whereConditions = {
      id: { in: filteredProductIds }
    };
    
    // Add name or barcode filter if provided
    if (productName) {
      whereConditions.name = { 
        contains: productName,
        mode: 'insensitive'
      };
    }
    if (barcode) {
      whereConditions.barcode = barcode;
    }
    
    const products = await prisma.product.findMany({
      where: whereConditions,
      include: {
        depotAssignments: {
          where: {
            depotId: { in: depotIds }
          },
          include: {
            depot: {
              select: {
                id: true,
                name: true,
                code: true
              }
            }
          }
        },
        famille: {
          select: {
            id: true,
            name: true
          }
        }
      },
      take: 100
    });
    
    // Transform depotAssignments to assignedDepots for frontend compatibility
    const productsWithAssignedDepots = products.map(product => ({
      ...product,
      assignedDepots: product.depotAssignments.map(da => da.depot)
    }));
    
    res.json(productsWithAssignedDepots);
  } catch (error) {
    console.error('Error fetching similar products:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      code: error.code
    });
    res.status(500).json({ 
      error: 'Erreur lors de la récupération des produits similaires',
      details: error.message 
    });
  }
});

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
    res.status(500).json({ error: 'Erreur lors de la récupération des conversions VRAC' });
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
    res.status(500).json({ error: 'Erreur lors de la suppression de la conversion VRAC' });
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
      duree_conservation,
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
      depotIds,
      depotPrices
    } = req.body;
    
    // RESPONSABLE_MAGASIN can only update depot prices, not other product fields
    if (isResponsableMagasin && !isAdmin) {
      // Check if trying to update non-depot-price fields (but allow depotPrices)
      const restrictedFields = ['name', 'designation_legale', 'description', 'familleId', 'barcode', 
        'unite', 'prix_vente_TTC', 'prix_achat', 'tva', 'duree_conservation', 'photo', 'isVrac', 
        'isVraguable', 'isStockable', 'isWholesale', 'bundleSize', 'bundlePrice', 'minMargin', 'requiresApproval'];
      
      const hasRestrictedFields = restrictedFields.some(field => req.body[field] !== undefined);
      if (hasRestrictedFields) {
        return res.status(400).json({ error: 'Vous ne pouvez modifier que les prix de dépôt pour votre dépôt' });
      }
      
      // Only allow depotIds if it's their own depot (if provided)
      if (depotIds !== undefined) {
        if (!Array.isArray(depotIds) || depotIds.length !== 1 || parseInt(depotIds[0]) !== sessionDepotId) {
          return res.status(400).json({ error: 'Vous ne pouvez modifier les prix que pour votre propre dépôt' });
        }
      }
    }
    
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
    if (depotPrices !== undefined) {
      // For RESPONSABLE_MAGASIN, only allow updating their own depot price
      if (isResponsableMagasin && !isAdmin) {
        if (!Array.isArray(depotPrices) || depotPrices.length === 0) {
          return res.status(400).json({ error: 'Les prix de dépôt sont requis' });
        }
        
        // Filter to only their depot
        const filteredDepotPrices = depotPrices.filter(({ depotId }) => {
          const parsedDepotId = typeof depotId === 'string' ? parseInt(depotId) : depotId;
          return parsedDepotId === sessionDepotId;
        });
        
        if (filteredDepotPrices.length === 0) {
          return res.status(400).json({ error: 'Vous ne pouvez modifier les prix que pour votre propre dépôt' });
        }
        
        // Update only their depot price (don't delete all, just update/create theirs)
        const depotPriceData = filteredDepotPrices[0];
        const priceValue = parseFloat(depotPriceData.prix_vente_TTC);
        
        if (isNaN(priceValue) || priceValue < 0) {
          return res.status(400).json({ error: 'Le prix doit être un nombre positif' });
        }
        
        await prisma.productDepotPrice.upsert({
          where: {
            productId_depotId: {
              productId: productId,
              depotId: sessionDepotId
            }
          },
          update: {
            prix_vente_TTC: priceValue
          },
          create: {
            productId: productId,
            depotId: sessionDepotId,
            prix_vente_TTC: priceValue
          }
        });
      } else {
        // Admin or other roles: remove all and recreate
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
    
    // Fetch the product with all relations including updated depot prices
    const productWithRelations = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        famille: true,
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
    
    res.json(productWithRelations);
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

    console.log('Received transfer-multiple request:', {
      sourceProductId,
      depotId,
      transfersCount: transfers?.length,
      transfers: transfers
    });
    
    console.log('Extracting target product IDs:', transfers.map(t => t.targetProductId));

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

    console.log('Looking for target products with IDs:', uniqueTargetIds);
    const targetProducts = await prisma.product.findMany({
      where: { id: { in: uniqueTargetIds } }
    });
    console.log('Found target products:', targetProducts.map(p => ({ id: p.id, name: p.name })));

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

    console.log('Source quantity from first transfer:', {
      firstTransfer,
      sourceQuantity,
      sourceQuantityType: typeof sourceQuantity
    });

    if (isNaN(sourceQuantity) || sourceQuantity <= 0) {
      return res.status(400).json({ 
        error: 'La quantité source doit être positive',
        received: firstTransfer.quantity,
        parsed: sourceQuantity
      });
    }

    totalSourceQuantity = sourceQuantity;
    console.log('Total source quantity set to:', totalSourceQuantity);

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
      
      console.log('Processing transfer:', {
        targetProductId,
        transferSourceQuantity,
        ratio,
        sourceQuantity,
        willUseSourceQuantity: sourceQuantity
      });

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

      console.log('Calculating target quantity:', {
        targetProductId,
        targetProductName: targetProduct.name,
        sourceQuantity,
        ratio,
        calculatedTargetQuantity: targetQuantity
      });

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
      
      console.log('Added to transferDetails:', {
        targetProductId,
        targetQuantity,
        sourceQuantity,
        ratio
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

    console.log('Source inventory check:', {
      depotId: depotIdInt,
      productId: sourceProductIdInt,
      found: !!sourceInventory,
      quantity: sourceInventory?.quantity,
      quantityType: typeof sourceInventory?.quantity,
      totalSourceQuantity,
      allInventoriesForProduct: allInventories.map(inv => ({
        depotId: inv.depotId,
        quantity: inv.quantity,
        quantityString: inv.quantity?.toString()
      }))
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
      
      console.log('Parsed quantity:', {
        raw: quantityValue,
        rawString: String(quantityValue),
        rawJSON: JSON.stringify(quantityValue),
        type: typeof quantityValue,
        constructor: quantityValue?.constructor?.name,
        parsed: currentSourceQuantity,
        isNaN: isNaN(currentSourceQuantity),
        isFinite: isFinite(currentSourceQuantity)
      });
    }

    if (!sourceInventory) {
      console.log('No inventory record found for product', sourceProductIdInt, 'in depot', depotIdInt);
      console.log('Will allow transfer and create inventory record with negative quantity');
    } else {
      console.log('Inventory found:', {
        inventoryId: sourceInventory.id,
        quantity: sourceInventory.quantity,
        currentSourceQuantity,
        totalSourceQuantity
      });
    }

    if (sourceInventory) {
      if (isNaN(currentSourceQuantity)) {
        console.error('Failed to parse quantity, using 0:', {
          raw: sourceInventory.quantity,
          type: typeof sourceInventory.quantity
        });
        currentSourceQuantity = 0;
      }
      
      console.log('Stock validation:', {
        currentSourceQuantity,
        totalSourceQuantity,
        hasEnough: currentSourceQuantity >= totalSourceQuantity,
        comparison: `${currentSourceQuantity} >= ${totalSourceQuantity} = ${currentSourceQuantity >= totalSourceQuantity}`
      });

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

        console.log('Allowing transfer with insufficient stock (will create/update negative inventory)');
      } else {
        console.log('Stock validation passed:', {
          currentSourceQuantity,
          totalSourceQuantity
        });
      }
    } else {
      console.log('No inventory record exists, allowing transfer (will create negative inventory if needed)');
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
        console.log('Updating source inventory:', {
          inventoryId: sourceInventory.id,
          currentQuantity: currentSourceQty,
          totalSourceQuantity,
          newQuantity: newSourceQuantity
        });
        const updatedSource = await tx.inventory.update({
          where: { id: sourceInventory.id },
          data: { quantity: newSourceQuantity }
        });
        console.log('Source inventory updated:', {
          id: updatedSource.id,
          quantity: updatedSource.quantity?.toString()
        });
      } else {
        console.log('Creating new source inventory with negative quantity:', {
          depotId: depotIdInt,
          productId: sourceProductIdInt,
          quantity: -totalSourceQuantity
        });
        const createdSource = await tx.inventory.create({
          data: {
            depotId: depotIdInt,
            productId: sourceProductIdInt,
            quantity: -totalSourceQuantity
          }
        });
        console.log('Source inventory created:', {
          id: createdSource.id,
          quantity: createdSource.quantity?.toString()
        });
      }

      const transferResults = [];

      for (const detail of transferDetails) {
        try {
          console.log('Processing transfer detail:', {
            targetProductId: detail.targetProductId,
            targetProductName: detail.targetProductName,
            sourceQuantity: detail.sourceQuantity,
            ratio: detail.ratio,
            targetQuantity: detail.targetQuantity,
            targetQuantityType: typeof detail.targetQuantity,
            depotId: depotIdInt
          });

          const targetInventory = await tx.inventory.findUnique({
            where: {
              depotId_productId: {
                depotId: depotIdInt,
                productId: detail.targetProductId
              }
            }
          });

          console.log('Target inventory lookup result:', {
            found: !!targetInventory,
            targetProductId: detail.targetProductId,
            depotId: depotIdInt
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
            
            console.log('Updating target inventory:', {
              targetProductId: detail.targetProductId,
              inventoryId: targetInventory.id,
              currentQuantity: currentTargetQty,
              addingQuantity: targetQtyToAdd,
              newQuantity: newTargetQuantity
            });
            
            const updatedTarget = await tx.inventory.update({
              where: { id: targetInventory.id },
              data: { quantity: newTargetQuantity }
            });
            
            console.log('Target inventory updated successfully:', {
              id: updatedTarget.id,
              quantity: updatedTarget.quantity?.toString(),
              quantityType: typeof updatedTarget.quantity
            });
          } else {
            console.log('Creating new target inventory:', {
              depotId: depotIdInt,
              targetProductId: detail.targetProductId,
              quantity: targetQtyToAdd
            });
            
            const createdTarget = await tx.inventory.create({
              data: {
                depotId: depotIdInt,
                productId: detail.targetProductId,
                quantity: parseFloat(targetQtyToAdd.toFixed(3))
              }
            });
            
            console.log('Target inventory created successfully:', {
              id: createdTarget.id,
              quantity: createdTarget.quantity?.toString(),
              quantityType: typeof createdTarget.quantity
            });
          }
        } catch (detailError) {
          console.error(`Error processing transfer detail for product ${detail.targetProductId}:`, detailError);
          throw detailError;
        }

        const referenceText = `Transfer ${sourceProduct.name} -> ${detail.targetProductName} (${detail.sourceQuantity} × ${detail.ratio} = ${detail.targetQuantity})`;
        
        await tx.stockMovement.create({
          data: {
            productId: sourceProductIdInt,
            depotId: depotIdInt,
            quantity: -detail.sourceQuantity,
            type: 'OUT',
            reason: 'PRODUCT_CONVERSION',
            reference: referenceText,
            userId: req.user.id
          }
        });

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

// Create product depot link
router.post('/depot-links', authenticateToken, async (req, res) => {
  try {
    const { sourceProductId, sourceDepotId, destinationProductId, destinationDepotId } = req.body;
    
    console.log('=== CREATE PRODUCT DEPOT LINK REQUEST ===');
    console.log('Request body:', {
      sourceProductId,
      sourceDepotId,
      destinationProductId,
      destinationDepotId,
      sourceProductIdType: typeof sourceProductId,
      destinationProductIdType: typeof destinationProductId
    });
    
    if (!sourceProductId || !sourceDepotId || !destinationProductId || !destinationDepotId) {
      return res.status(400).json({ error: 'Tous les champs sont requis' });
    }

    const parsedSourceProductId = parseInt(sourceProductId);
    const parsedSourceDepotId = parseInt(sourceDepotId);
    const parsedDestinationProductId = parseInt(destinationProductId);
    const parsedDestinationDepotId = parseInt(destinationDepotId);
    
    console.log('Parsed IDs:', {
      parsedSourceProductId,
      parsedSourceDepotId,
      parsedDestinationProductId,
      parsedDestinationDepotId
    });

    // Allow same product to be linked (sourceProductId === destinationProductId is valid)
    // This is useful when consolidating products from different depots
    
    
    // Verify products are assigned to their respective depots
    // Check both Product (for SHOP depots) and ProduitDeCaisse (for other depots)
    const sourceProductAssignment = await prisma.productDepot.findUnique({
      where: {
        productId_depotId: {
          productId: parsedSourceProductId,
          depotId: parsedSourceDepotId
        }
      }
    });
    
    const sourceProduitDeCaisseAssignment = await prisma.produitDeCaisseDepot.findFirst({
      where: {
        produitDeCaisseId: parsedSourceProductId,
        depotId: parsedSourceDepotId
      }
    });
    
    const destProductAssignment = await prisma.productDepot.findUnique({
      where: {
        productId_depotId: {
          productId: parsedDestinationProductId,
          depotId: parsedDestinationDepotId
        }
      }
    });
    
    const destProduitDeCaisseAssignment = await prisma.produitDeCaisseDepot.findFirst({
      where: {
        produitDeCaisseId: parsedDestinationProductId,
        depotId: parsedDestinationDepotId
      }
    });
    
    console.log('Checking product assignments:', {
      sourceProductId: parsedSourceProductId,
      sourceDepotId: parsedSourceDepotId,
      destinationProductId: parsedDestinationProductId,
      destinationDepotId: parsedDestinationDepotId,
      sourceProductAssignment: !!sourceProductAssignment,
      sourceProduitDeCaisseAssignment: !!sourceProduitDeCaisseAssignment,
      destProductAssignment: !!destProductAssignment,
      destProduitDeCaisseAssignment: !!destProduitDeCaisseAssignment
    });
    
    if (!sourceProductAssignment && !sourceProduitDeCaisseAssignment) {
      console.error('Source product not assigned:', {
        sourceProductId: parsedSourceProductId,
        sourceDepotId: parsedSourceDepotId
      });
      return res.status(400).json({ error: 'Le produit source n\'est pas assigné au dépôt source' });
    }
    
    if (!destProductAssignment && !destProduitDeCaisseAssignment) {
      console.error('Destination product not assigned:', {
        destinationProductId: parsedDestinationProductId,
        destinationDepotId: parsedDestinationDepotId
      });
      return res.status(400).json({ error: 'Le produit destination n\'est pas assigné au dépôt destination' });
    }
    
    // Check if products exist in Product or ProduitDeCaisse tables
    const sourceProductExists = await prisma.product.findUnique({
      where: { id: parsedSourceProductId },
      select: { id: true, name: true }
    });
    
    const sourceProduitDeCaisseExists = await prisma.produitDeCaisse.findUnique({
      where: { id: parsedSourceProductId },
      select: { id: true, name: true }
    });
    
    const destProductExists = await prisma.product.findUnique({
      where: { id: parsedDestinationProductId },
      select: { id: true, name: true }
    });
    
    const destProduitDeCaisseExists = await prisma.produitDeCaisse.findUnique({
      where: { id: parsedDestinationProductId },
      select: { id: true, name: true }
    });
    
    if (!sourceProductExists && !sourceProduitDeCaisseExists) {
      return res.status(400).json({ 
        error: `Le produit source (ID: ${parsedSourceProductId}) n'existe pas.` 
      });
    }
    
    if (!destProductExists && !destProduitDeCaisseExists) {
      return res.status(400).json({ 
        error: `Le produit destination (ID: ${parsedDestinationProductId}) n'existe pas.` 
      });
    }
    
    const sourceIsProduct = !!sourceProductAssignment;
    const sourceIsProduitDeCaisse = !!sourceProduitDeCaisseAssignment;
    const destIsProduct = !!destProductAssignment;
    const destIsProduitDeCaisse = !!destProduitDeCaisseAssignment;
    
    if (sourceIsProduct && sourceIsProduitDeCaisse) {
      console.error('ERROR: Source product has assignments in BOTH tables!', {
        sourceProductId: parsedSourceProductId,
        sourceDepotId: parsedSourceDepotId
      });
      return res.status(400).json({ 
        error: `Le produit source (ID: ${parsedSourceProductId}) a des assignments dans les deux tables. Contactez l'administrateur.` 
      });
    }
    
    if (destIsProduct && destIsProduitDeCaisse) {
      console.error('ERROR: Destination product has assignments in BOTH tables!', {
        destinationProductId: parsedDestinationProductId,
        destinationDepotId: parsedDestinationDepotId
      });
      return res.status(400).json({ 
        error: `Le produit destination (ID: ${parsedDestinationProductId}) a des assignments dans les deux tables. Contactez l'administrateur.` 
      });
    }
    
    console.log('Product type determination:', {
      sourceProductId: parsedSourceProductId,
      sourceProductName: sourceProductExists?.name || sourceProduitDeCaisseExists?.name || 'Unknown',
      sourceIsProduct,
      sourceIsProduitDeCaisse,
      destinationProductId: parsedDestinationProductId,
      destinationProductName: destProductExists?.name || destProduitDeCaisseExists?.name || 'Unknown',
      destIsProduct,
      destIsProduitDeCaisse
    });
    
    const useProductTable = sourceIsProduct && destIsProduct;
    const useProduitDeCaisseTable = sourceIsProduitDeCaisse && destIsProduitDeCaisse;
    const isMixed = (sourceIsProduct && destIsProduitDeCaisse) || (sourceIsProduitDeCaisse && destIsProduct);
    
    if (!useProductTable && !useProduitDeCaisseTable && !isMixed) {
      console.error('ERROR: Cannot determine table to use', {
        sourceIsProduct,
        sourceIsProduitDeCaisse,
        destIsProduct,
        destIsProduitDeCaisse
      });
      return res.status(400).json({ 
        error: 'Impossible de déterminer la table à utiliser pour créer le lien. Vérifiez que les produits sont correctement assignés aux dépôts.' 
      });
    }
    
    try {
      let link;
      let useProduitDeCaisseTableForLink;
      
      if (useProductTable) {
        useProduitDeCaisseTableForLink = false;
      } else if (useProduitDeCaisseTable) {
        useProduitDeCaisseTableForLink = true;
      } else if (isMixed) {
        useProduitDeCaisseTableForLink = sourceIsProduitDeCaisse;
      } else {
        return res.status(400).json({ 
          error: 'Impossible de déterminer la table à utiliser pour créer le lien' 
        });
      }
      
      console.log('Link table selection:', {
        useProductTable,
        useProduitDeCaisseTable,
        isMixed,
        useProduitDeCaisseTableForLink,
        sourceProductId: parsedSourceProductId,
        sourceProductName: sourceProductExists?.name || sourceProduitDeCaisseExists?.name || 'Unknown',
        sourceProductActualName: sourceIsProduct ? sourceProductExists?.name : sourceProduitDeCaisseExists?.name,
        destinationProductName: destProductExists?.name || destProduitDeCaisseExists?.name || 'Unknown',
        destinationProductActualName: destIsProduct ? destProductExists?.name : destProduitDeCaisseExists?.name
      });
      
      if (useProduitDeCaisseTableForLink) {
        if (!sourceProduitDeCaisseExists || !destProduitDeCaisseExists) {
          console.error('ERROR: Trying to create ProduitDeCaisseDepotLink but products do not exist in ProduitDeCaisse table', {
            sourceProductId: parsedSourceProductId,
            sourceProductExists: !!sourceProduitDeCaisseExists,
            destinationProductId: parsedDestinationProductId,
            destProductExists: !!destProduitDeCaisseExists
          });
          return res.status(400).json({ 
            error: 'Les produits doivent exister dans la table ProduitDeCaisse pour créer ce type de lien' 
          });
        }
        
        const existingLink = await prisma.produitDeCaisseDepotLink.findFirst({
          where: {
            sourceProductId: parsedSourceProductId,
            sourceDepotId: parsedSourceDepotId,
            destinationProductId: parsedDestinationProductId,
            destinationDepotId: parsedDestinationDepotId
          }
        });
        
        if (existingLink) {
          return res.status(400).json({ error: 'Ce lien existe déjà' });
        }
        
        console.log('Creating ProduitDeCaisseDepotLink with:', {
          sourceProductId: parsedSourceProductId,
          sourceProductName: sourceProduitDeCaisseExists.name,
          sourceDepotId: parsedSourceDepotId,
          destinationProductId: parsedDestinationProductId,
          destinationProductName: destProduitDeCaisseExists.name,
          destinationDepotId: parsedDestinationDepotId
        });
        
        try {
          link = await prisma.produitDeCaisseDepotLink.create({
            data: {
              sourceProductId: parsedSourceProductId,
              sourceDepotId: parsedSourceDepotId,
              destinationProductId: parsedDestinationProductId,
              destinationDepotId: parsedDestinationDepotId
            },
            include: {
              sourceProduct: {
                select: {
                  id: true,
                  name: true,
                  barcode: true
                }
              },
              sourceDepot: {
                select: {
                  id: true,
                  name: true,
                  code: true
                }
              },
              destinationProduct: {
                select: {
                  id: true,
                  name: true,
                  barcode: true
                }
              },
              destinationDepot: {
                select: {
                  id: true,
                  name: true,
                  code: true
                }
              }
            }
          });
        } catch (fkError) {
          if (isMixed && (fkError.code === 'P2003' || fkError.message?.includes('Foreign key constraint'))) {
            useProduitDeCaisseTableForLink = false;
            const existingProductLink = await prisma.productDepotLink.findFirst({
              where: {
                sourceProductId: parsedSourceProductId,
                sourceDepotId: parsedSourceDepotId,
                destinationProductId: parsedDestinationProductId,
                destinationDepotId: parsedDestinationDepotId
              }
            });
            
            if (existingProductLink) {
              return res.status(400).json({ error: 'Ce lien existe déjà' });
            }
            
            link = await prisma.productDepotLink.create({
              data: {
                sourceProductId: parsedSourceProductId,
                sourceDepotId: parsedSourceDepotId,
                destinationProductId: parsedDestinationProductId,
                destinationDepotId: parsedDestinationDepotId
              },
              include: {
                sourceProduct: {
                  select: {
                    id: true,
                    name: true,
                    barcode: true
                  }
                },
                sourceDepot: {
                  select: {
                    id: true,
                    name: true,
                    code: true
                  }
                },
                destinationProduct: {
                  select: {
                    id: true,
                    name: true,
                    barcode: true
                  }
                },
                destinationDepot: {
                  select: {
                    id: true,
                    name: true,
                    code: true
                  }
                }
              }
            });
          } else {
            throw fkError;
          }
        }
      } else {
        if (!sourceProductExists || !destProductExists) {
          console.error('ERROR: Trying to create ProductDepotLink but products do not exist in Product table', {
            sourceProductId: parsedSourceProductId,
            sourceProductExists: !!sourceProductExists,
            destinationProductId: parsedDestinationProductId,
            destProductExists: !!destProductExists
          });
          return res.status(400).json({ 
            error: 'Les produits doivent exister dans la table Product pour créer ce type de lien' 
          });
        }
        
        const existingProductLink = await prisma.productDepotLink.findFirst({
          where: {
            sourceProductId: parsedSourceProductId,
            sourceDepotId: parsedSourceDepotId,
            destinationProductId: parsedDestinationProductId,
            destinationDepotId: parsedDestinationDepotId
          }
        });
        
        if (existingProductLink) {
          return res.status(400).json({ error: 'Ce lien existe déjà' });
        }
        
        console.log('Creating ProductDepotLink with:', {
          sourceProductId: parsedSourceProductId,
          sourceProductName: sourceProductExists.name,
          sourceDepotId: parsedSourceDepotId,
          destinationProductId: parsedDestinationProductId,
          destinationProductName: destProductExists.name,
          destinationDepotId: parsedDestinationDepotId
        });
        
        try {
          link = await prisma.productDepotLink.create({
            data: {
              sourceProductId: parsedSourceProductId,
              sourceDepotId: parsedSourceDepotId,
              destinationProductId: parsedDestinationProductId,
              destinationDepotId: parsedDestinationDepotId
            },
            include: {
              sourceProduct: {
                select: {
                  id: true,
                  name: true,
                  barcode: true
                }
              },
              sourceDepot: {
                select: {
                  id: true,
                  name: true,
                  code: true
                }
              },
              destinationProduct: {
                select: {
                  id: true,
                  name: true,
                  barcode: true
                }
              },
              destinationDepot: {
                select: {
                  id: true,
                  name: true,
                  code: true
                }
              }
            }
          });
        } catch (fkError) {
          if (isMixed && (fkError.code === 'P2003' || fkError.message?.includes('Foreign key constraint'))) {
            useProduitDeCaisseTableForLink = true;
            const existingLink = await prisma.produitDeCaisseDepotLink.findFirst({
              where: {
                sourceProductId: parsedSourceProductId,
                sourceDepotId: parsedSourceDepotId,
                destinationProductId: parsedDestinationProductId,
                destinationDepotId: parsedDestinationDepotId
              }
            });
            
            if (existingLink) {
              return res.status(400).json({ error: 'Ce lien existe déjà' });
            }
            
            link = await prisma.produitDeCaisseDepotLink.create({
              data: {
                sourceProductId: parsedSourceProductId,
                sourceDepotId: parsedSourceDepotId,
                destinationProductId: parsedDestinationProductId,
                destinationDepotId: parsedDestinationDepotId
              },
              include: {
                sourceProduct: {
                  select: {
                    id: true,
                    name: true,
                    barcode: true
                  }
                },
                sourceDepot: {
                  select: {
                    id: true,
                    name: true,
                    code: true
                  }
                },
                destinationProduct: {
                  select: {
                    id: true,
                    name: true,
                    barcode: true
                  }
                },
                destinationDepot: {
                  select: {
                    id: true,
                    name: true,
                    code: true
                  }
                }
              }
            });
          } else {
            throw fkError;
          }
        }
      }
      
      const createdSourceProductId = link.sourceProductId || link.sourceProduct?.id;
      const createdSourceProductName = link.sourceProduct?.name || 'Unknown';
      const createdDestProductId = link.destinationProductId || link.destinationProduct?.id;
      const createdDestProductName = link.destinationProduct?.name || 'Unknown';
      
      if (createdSourceProductId !== parsedSourceProductId) {
        console.error('CRITICAL ERROR: Created link has wrong source product ID!', {
          requestedSourceProductId: parsedSourceProductId,
          requestedSourceProductName: sourceIsProduct ? sourceProductExists?.name : sourceProduitDeCaisseExists?.name,
          createdSourceProductId,
          createdSourceProductName
        });
        await (useProduitDeCaisseTableForLink 
          ? prisma.produitDeCaisseDepotLink.delete({ where: { id: link.id } })
          : prisma.productDepotLink.delete({ where: { id: link.id } }));
        return res.status(500).json({ 
          error: 'Erreur critique: Le lien créé a un produit source incorrect. Le lien a été supprimé.' 
        });
      }
      
      if (createdDestProductId !== parsedDestinationProductId) {
        console.error('CRITICAL ERROR: Created link has wrong destination product ID!', {
          requestedDestProductId: parsedDestinationProductId,
          requestedDestProductName: destIsProduct ? destProductExists?.name : destProduitDeCaisseExists?.name,
          createdDestProductId,
          createdDestProductName
        });
        await (useProduitDeCaisseTableForLink 
          ? prisma.produitDeCaisseDepotLink.delete({ where: { id: link.id } })
          : prisma.productDepotLink.delete({ where: { id: link.id } }));
        return res.status(500).json({ 
          error: 'Erreur critique: Le lien créé a un produit destination incorrect. Le lien a été supprimé.' 
        });
      }
      
      console.log('Link created successfully:', {
        linkId: link.id,
        linkType: useProduitDeCaisseTableForLink ? 'ProduitDeCaisseDepotLink' : 'ProductDepotLink',
        sourceProductId: createdSourceProductId,
        sourceProductName: createdSourceProductName,
        destinationProductId: createdDestProductId,
        destinationProductName: createdDestProductName,
        sourceDepotId: link.sourceDepotId || link.sourceDepot?.id,
        destinationDepotId: link.destinationDepotId || link.destinationDepot?.id,
        verification: 'PASSED - Product IDs match requested IDs'
      });
      
      try {
        await logAudit(req.user.id, useProduitDeCaisseTableForLink ? 'produit_de_caisse_depot_links' : 'products', link.id, 'CREATE', null, { linkId: link.id });
      } catch (auditError) {
        console.error('Error logging audit (non-fatal):', auditError);
      }
      
      res.status(201).json(link);
    } catch (createError) {
      console.error('Error creating product depot link:', createError);
      console.error('Error details:', {
        message: createError.message,
        code: createError.code,
        meta: createError.meta
      });
      
      if (createError.code === 'P2002') {
        return res.status(400).json({ error: 'Ce lien existe déjà' });
      }
      
      if (createError.code === 'P2003') {
        return res.status(400).json({ error: 'Produit ou dépôt introuvable' });
      }
      
      res.status(500).json({ 
        error: 'Erreur lors de la création du lien',
        details: createError.message 
      });
    }
  } catch (error) {
    console.error('Error creating product depot link:', error);
    console.error('Error stack:', error.stack);
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Ce lien existe déjà' });
    }
    res.status(500).json({ 
      error: 'Erreur lors de la création du lien',
      details: error.message 
    });
  }
});

// Get product depot links for a destination product
router.get('/:id/depot-links', authenticateToken, async (req, res) => {
  try {
    // Prevent /depot-links from being caught by this route
    if (req.params.id === 'depot-links') {
      return res.status(404).json({ error: 'Route not found' });
    }
    
    const productId = parseInt(req.params.id);
    
    if (isNaN(productId)) {
      return res.status(400).json({ error: 'Invalid product ID' });
    }
    
    const links = await prisma.productDepotLink.findMany({
      where: {
        destinationProductId: productId
      },
      include: {
        sourceProduct: {
          select: {
            id: true,
            name: true,
            barcode: true
          }
        },
        sourceDepot: {
          select: {
            id: true,
            name: true,
            code: true
          }
        },
        destinationDepot: {
          select: {
            id: true,
            name: true,
            code: true
          }
        }
      }
    });
    
    res.json(links);
  } catch (error) {
    console.error('Error fetching product depot links:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des liens' });
  }
});

// Delete product depot link
router.delete('/depot-links/:id', authenticateToken, async (req, res) => {
  try {
    const linkId = parseInt(req.params.id);
    
    if (isNaN(linkId)) {
      return res.status(400).json({ error: 'Invalid link ID' });
    }
    
    await prisma.productDepotLink.delete({
      where: { id: linkId }
    });
    
    await logAudit(req.user.id, 'products', linkId, 'DELETE', { linkId }, null);
    
    res.json({ message: 'Lien supprimé avec succès' });
  } catch (error) {
    console.error('Error deleting product depot link:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression du lien' });
  }
});

// Get destination product for a source product and depot (used in Bon d'Entrée approval)
router.get('/depot-links/destination', authenticateToken, async (req, res) => {
  try {
    const { sourceProductId, sourceDepotId, destinationDepotId } = req.query;
    
    if (!sourceProductId || !sourceDepotId || !destinationDepotId) {
      return res.status(400).json({ error: 'Tous les paramètres sont requis' });
    }
    
    const link = await prisma.productDepotLink.findFirst({
      where: {
        sourceProductId: parseInt(sourceProductId),
        sourceDepotId: parseInt(sourceDepotId),
        destinationDepotId: parseInt(destinationDepotId)
      },
      include: {
        destinationProduct: {
          select: {
            id: true,
            name: true,
            barcode: true
          }
        }
      }
    });
    
    if (!link) {
      return res.json(null); // No link found, use source product
    }
    
    res.json(link.destinationProduct);
  } catch (error) {
    console.error('Error fetching destination product:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération du produit destination' });
  }
});

// Create famille consolidation
router.post('/famille-consolidations', authenticateToken, async (req, res) => {
  try {
    const { sourceFamilleId, sourceDepotIds, destinationProductId, destinationDepotId } = req.body;
    
    if (!sourceFamilleId || !sourceDepotIds || !Array.isArray(sourceDepotIds) || sourceDepotIds.length === 0 || !destinationProductId || !destinationDepotId) {
      return res.status(400).json({ error: 'Tous les champs sont requis' });
    }
    
    const destinationProduct = await prisma.product.findUnique({
      where: { id: parseInt(destinationProductId) }
    });
    
    if (!destinationProduct) {
      return res.status(404).json({ error: 'Produit destination non trouvé' });
    }
    
    const destinationDepot = await prisma.depot.findUnique({
      where: { id: parseInt(destinationDepotId) }
    });
    
    if (!destinationDepot) {
      return res.status(404).json({ error: 'Dépôt destination non trouvé' });
    }
    
    const sourceFamille = await prisma.productFamily.findUnique({
      where: { id: parseInt(sourceFamilleId) }
    });
    
    if (!sourceFamille) {
      return res.status(404).json({ error: 'Famille source non trouvée' });
    }
    
    const createdLinks = [];
    const errors = [];
    
    for (const sourceDepotId of sourceDepotIds) {
      try {
        const sourceDepot = await prisma.depot.findUnique({
          where: { id: parseInt(sourceDepotId) }
        });
        
        if (!sourceDepot) {
          errors.push(`Dépôt source ${sourceDepotId} non trouvé`);
          continue;
        }
        
        const existingConsolidation = await prisma.productFamilleConsolidation.findUnique({
          where: {
            unique_famille_consolidation: {
              sourceFamilleId: parseInt(sourceFamilleId),
              sourceDepotId: parseInt(sourceDepotId),
              destinationDepotId: parseInt(destinationDepotId)
            }
          }
        });
        
        if (existingConsolidation) {
          errors.push(`Consolidation existe déjà pour ${sourceFamille.name} depuis ${sourceDepot.name}`);
          continue;
        }
        
        const consolidation = await prisma.productFamilleConsolidation.create({
          data: {
            sourceFamilleId: parseInt(sourceFamilleId),
            sourceDepotId: parseInt(sourceDepotId),
            destinationProductId: parseInt(destinationProductId),
            destinationDepotId: parseInt(destinationDepotId)
          },
          include: {
            sourceFamille: true,
            sourceDepot: {
              select: {
                id: true,
                name: true
              }
            },
            destinationProduct: {
              select: {
                id: true,
                name: true
              }
            },
            destinationDepot: {
              select: {
                id: true,
                name: true
              }
            }
          }
        });
        
        createdLinks.push(consolidation);
        
        await logAudit(req.user.id, 'products', 'CREATE', `Famille consolidation created: ${consolidation.id}`);
      } catch (error) {
        console.error(`Error creating consolidation for depot ${sourceDepotId}:`, error);
        errors.push(`Erreur pour dépôt ${sourceDepotId}: ${error.message}`);
      }
    }
    
    if (createdLinks.length === 0) {
      return res.status(400).json({ 
        error: 'Aucune consolidation créée',
        errors: errors
      });
    }
    
    res.status(201).json({
      success: true,
      created: createdLinks.length,
      consolidations: createdLinks,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('Error creating famille consolidation:', error);
    res.status(500).json({ error: 'Erreur lors de la création de la consolidation par famille' });
  }
});

module.exports = router; 
module.exports = router; 
module.exports = router; 
module.exports = router; 