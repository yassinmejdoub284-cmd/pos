const express = require('express');
const { PrismaClient } = require('@prisma/client');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticateToken } = require('../middleware/auth');
const { logAudit } = require('../lib/audit');

const router = express.Router();
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

router.get('/', authenticateToken, async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        famille: true,
        inventory: {
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

router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const product = await prisma.product.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        famille: true,
        inventory: {
          include: {
            depot: true
          }
        }
      }
    });
    
    if (!product) {
      return res.status(404).json({ error: 'Produit non trouvé' });
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
      description,
      familleId,
      barcode,
      unite,
      prix_vente_TTC,
      tva,
      duree_conservation,
      isVrac,
      originalProductId,
      isStockable
    } = req.body;
    
    if (!name || !prix_vente_TTC || !familleId) {
      return res.status(400).json({ error: 'Nom, prix de vente et famille sont requis' });
    }
    
    if (prix_vente_TTC < 0) {
      return res.status(400).json({ error: 'Le prix de vente doit être positif' });
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
      description,
      familleId: parseInt(familleId),
      barcode: barcode || null,
      unite: unite || 'pcs',
      prix_vente_TTC: parseFloat(prix_vente_TTC),
      tva: tva ? parseFloat(tva) : 19,
      duree_conservation: duree_conservation ? parseInt(duree_conservation) : null,
      isVrac: isVrac || false,
      originalProductId: originalProductId ? parseInt(originalProductId) : null,
      isStockable: isStockable !== undefined ? isStockable : true
    };
    
    const product = await prisma.product.create({
      data: productData
    });
    
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

router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const productId = parseInt(req.params.id);
    const oldProduct = await prisma.product.findUnique({
      where: { id: productId }
    });
    
    if (!oldProduct) {
      return res.status(404).json({ error: 'Produit non trouvé' });
    }
    
    const {
      name,
      description,
      familleId,
      barcode,
      unite,
      prix_vente_TTC,
      tva,
      duree_conservation,
      isVrac,
      originalProductId,
      isStockable
    } = req.body;
    
    if (prix_vente_TTC !== undefined && prix_vente_TTC < 0) {
      return res.status(400).json({ error: 'Le prix de vente doit être positif' });
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
    if (description !== undefined) updateData.description = description;
    if (familleId !== undefined) updateData.familleId = parseInt(familleId);
    if (barcode !== undefined) updateData.barcode = barcode;
    if (unite !== undefined) updateData.unite = unite;
    if (prix_vente_TTC !== undefined) updateData.prix_vente_TTC = parseFloat(prix_vente_TTC);
    if (tva !== undefined) updateData.tva = parseFloat(tva);
    if (duree_conservation !== undefined) updateData.duree_conservation = duree_conservation ? parseInt(duree_conservation) : null;
    if (isVrac !== undefined) updateData.isVrac = isVrac;
    if (originalProductId !== undefined) updateData.originalProductId = originalProductId ? parseInt(originalProductId) : null;
    if (isStockable !== undefined) updateData.isStockable = isStockable;
    
    const product = await prisma.product.update({
      where: { id: productId },
      data: updateData
    });
    
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
    
    if (!req.file) {
      return res.status(400).json({ error: 'Aucun fichier fourni' });
    }
    
    const product = await prisma.product.findUnique({
      where: { id: productId }
    });
    
    if (!product) {
      return res.status(404).json({ error: 'Produit non trouvé' });
    }
    
    const imageUrl = `${process.env.API_URL || 'http://localhost:3255'}/uploads/products/${req.file.filename}`;
    
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
    
    const product = await prisma.product.findUnique({
      where: { id: productId }
    });
    
    if (!product) {
      return res.status(404).json({ error: 'Produit non trouvé' });
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

module.exports = router; 