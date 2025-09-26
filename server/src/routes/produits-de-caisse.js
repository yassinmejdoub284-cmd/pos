const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { authenticateToken } = require('../middleware/auth');

const prisma = new PrismaClient();

// Get all produits de caisse
router.get('/', authenticateToken, async (req, res) => {
  try {
    const produits = await prisma.produitDeCaisse.findMany({
      include: {
        depot: {
          select: {
            id: true,
            name: true,
            code: true,
            type: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(produits);
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
        depot: {
          select: {
            id: true,
            name: true,
            code: true,
            type: true
          }
        }
      },
      orderBy: { name: 'asc' }
    });
    res.json(produits);
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

    if (!produit) {
      return res.status(404).json({ error: 'Produit de caisse non trouvé' });
    }

    res.json(produit);
  } catch (error) {
    console.error('Error fetching produit de caisse:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération du produit' });
  }
});

// Create new produit de caisse
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { name, price, productIds, depotId, isActive = true } = req.body;

    // Validation
    if (!name || !price || !productIds || !Array.isArray(productIds) || productIds.length === 0 || !depotId) {
      return res.status(400).json({ 
        error: 'Nom, prix, liste des produits et dépôt sont requis' 
      });
    }

    if (price <= 0) {
      return res.status(400).json({ 
        error: 'Le prix doit être supérieur à 0' 
      });
    }

    // Check if depot exists
    const depot = await prisma.depot.findUnique({
      where: { id: parseInt(depotId) }
    });

    if (!depot) {
      return res.status(400).json({ 
        error: 'Le dépôt sélectionné n\'existe pas' 
      });
    }

    // Check if products exist
    const existingProducts = await prisma.product.findMany({
      where: { id: { in: productIds } }
    });

    if (existingProducts.length !== productIds.length) {
      return res.status(400).json({ 
        error: 'Certains produits n\'existent pas' 
      });
    }

    // Check if name already exists for this depot
    const existingProduit = await prisma.produitDeCaisse.findFirst({
      where: { 
        name,
        depotId: parseInt(depotId)
      }
    });

    if (existingProduit) {
      return res.status(400).json({ 
        error: 'Un regroupement avec ce nom existe déjà pour ce dépôt' 
      });
    }

    const produit = await prisma.produitDeCaisse.create({
      data: {
        name,
        price,
        productIds,
        depotId: parseInt(depotId),
        isActive
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

    res.status(201).json(produit);
  } catch (error) {
    console.error('Error creating produit de caisse:', error);
    res.status(500).json({ error: 'Erreur lors de la création du produit' });
  }
});

// Update produit de caisse
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, price, productIds, isActive } = req.body;

    // Check if produit exists
    const existingProduit = await prisma.produitDeCaisse.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existingProduit) {
      return res.status(404).json({ error: 'Produit de caisse non trouvé' });
    }

    // Validation
    if (price !== undefined && price <= 0) {
      return res.status(400).json({ 
        error: 'Le prix doit être supérieur à 0' 
      });
    }

    if (productIds && (!Array.isArray(productIds) || productIds.length === 0)) {
      return res.status(400).json({ 
        error: 'La liste des produits ne peut pas être vide' 
      });
    }

    // Check if products exist (if productIds provided)
    if (productIds) {
      const existingProducts = await prisma.product.findMany({
        where: { id: { in: productIds } }
      });

      if (existingProducts.length !== productIds.length) {
        return res.status(400).json({ 
          error: 'Certains produits n\'existent pas' 
        });
      }
    }

    // Check if name already exists (if name provided and different)
    if (name && name !== existingProduit.name) {
      const duplicateProduit = await prisma.produitDeCaisse.findFirst({
        where: { 
          name,
          id: { not: parseInt(id) }
        }
      });

      if (duplicateProduit) {
        return res.status(400).json({ 
          error: 'Un regroupement avec ce nom existe déjà' 
        });
      }
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (price !== undefined) updateData.price = price;
    if (productIds !== undefined) updateData.productIds = productIds;
    if (depotId !== undefined) updateData.depotId = parseInt(depotId);
    if (isActive !== undefined) updateData.isActive = isActive;

    const produit = await prisma.produitDeCaisse.update({
      where: { id: parseInt(id) },
      data: updateData,
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

    res.json(produit);
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

module.exports = router;
