const express = require('express');
const { prisma } = require('../lib/prisma');
const { authenticateToken } = require('../middleware/auth');
const { logAudit } = require('../lib/audit');

const router = express.Router();

/**
 * Commentaires de preparation ("sans sauce", "bien cuit", "a emporter"...).
 *
 * Un commentaire est soit lie a un produit (productId renseigne), soit global
 * (productId null) et propose alors pour tous les produits. La caisse affiche
 * la grille "commentaires du produit + commentaires globaux" au moment ou le
 * produit est ajoute au ticket.
 */

const clean = (v) => (v === undefined || v === null ? '' : String(v).trim());

/** GET /api/product-comments?productId=12
 *  Sans productId : tout le catalogue (module de gestion).
 *  Avec productId : les commentaires du produit + les commentaires globaux. */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { productId, all } = req.query;
    const where = {};
    if (all !== 'true') where.isActive = true;
    if (productId) {
      const id = parseInt(productId);
      if (isNaN(id)) return res.status(400).json({ error: 'productId invalide' });
      where.OR = [{ productId: id }, { productId: null }];
    }
    const comments = await prisma.productComment.findMany({
      where,
      include: { product: { select: { id: true, name: true } } },
      orderBy: [{ displayIndex: 'asc' }, { id: 'asc' }]
    });
    res.json(comments);
  } catch (error) {
    console.error('Error fetching product comments:', error);
    res.status(500).json({ error: 'Erreur lors de la recuperation des commentaires' + (error?.message ? ' : ' + error.message : ''), code: error?.code });
  }
});

/** POST /api/product-comments  { label, productId?, displayIndex? } */
router.post('/', authenticateToken, async (req, res) => {
  try {
    const label = clean(req.body.label);
    if (!label) return res.status(400).json({ error: 'Le libelle est obligatoire' });
    if (label.length > 60) return res.status(400).json({ error: 'Le libelle ne doit pas depasser 60 caracteres' });

    let productId = null;
    if (req.body.productId !== undefined && req.body.productId !== null && req.body.productId !== '') {
      productId = parseInt(req.body.productId);
      if (isNaN(productId)) return res.status(400).json({ error: 'productId invalide' });
      const product = await prisma.product.findUnique({ where: { id: productId } });
      if (!product) return res.status(400).json({ error: 'Produit introuvable' });
    }

    // Pas deux fois le meme libelle pour la meme portee.
    const existing = await prisma.productComment.findFirst({ where: { label, productId } });
    if (existing) return res.status(400).json({ error: 'Ce commentaire existe deja' });

    const comment = await prisma.productComment.create({
      data: {
        label,
        productId,
        displayIndex: req.body.displayIndex !== undefined && req.body.displayIndex !== null
          ? parseInt(req.body.displayIndex) : null
      },
      include: { product: { select: { id: true, name: true } } }
    });

    await logAudit(req.user.id, 'product_comments', comment.id, 'CREATE', null, comment);
    res.status(201).json(comment);
  } catch (error) {
    console.error('Error creating product comment:', error);
    res.status(500).json({ error: 'Erreur lors de la creation du commentaire' + (error?.message ? ' : ' + error.message : ''), code: error?.code });
  }
});

/** PUT /api/product-comments/:id */
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'Identifiant invalide' });

    const data = {};
    if (req.body.label !== undefined) {
      const label = clean(req.body.label);
      if (!label) return res.status(400).json({ error: 'Le libelle est obligatoire' });
      data.label = label;
    }
    if (req.body.isActive !== undefined) data.isActive = !!req.body.isActive;
    if (req.body.displayIndex !== undefined) {
      data.displayIndex = req.body.displayIndex === null ? null : parseInt(req.body.displayIndex);
    }
    if (req.body.productId !== undefined) {
      data.productId = (req.body.productId === null || req.body.productId === '')
        ? null : parseInt(req.body.productId);
    }

    const comment = await prisma.productComment.update({
      where: { id },
      data,
      include: { product: { select: { id: true, name: true } } }
    });

    await logAudit(req.user.id, 'product_comments', id, 'UPDATE', null, data);
    res.json(comment);
  } catch (error) {
    console.error('Error updating product comment:', error);
    if (error.code === 'P2025') return res.status(404).json({ error: 'Commentaire introuvable' });
    res.status(500).json({ error: 'Erreur lors de la modification du commentaire' + (error?.message ? ' : ' + error.message : ''), code: error?.code });
  }
});

/** DELETE /api/product-comments/:id */
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'Identifiant invalide' });
    await prisma.productComment.delete({ where: { id } });
    await logAudit(req.user.id, 'product_comments', id, 'DELETE', null, null);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting product comment:', error);
    if (error.code === 'P2025') return res.status(404).json({ error: 'Commentaire introuvable' });
    res.status(500).json({ error: 'Erreur lors de la suppression du commentaire' + (error?.message ? ' : ' + error.message : ''), code: error?.code });
  }
});

module.exports = router;
