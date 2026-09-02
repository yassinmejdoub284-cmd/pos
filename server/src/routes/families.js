const express = require('express');
const { prisma } = require('../lib/prisma');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticateToken } = require('../middleware/auth');
const { logAudit } = require('../lib/audit');

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/families';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'family-' + uniqueSuffix + path.extname(file.originalname));
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

router.get('/', authenticateToken, async (req, res) => {
  try {
    const families = await prisma.productFamily.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { products: true }
        }
      }
    });
    res.json(families);
  } catch (error) {
    console.error('Error fetching families:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des familles' });
  }
});

router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const family = await prisma.productFamily.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        products: {
          select: {
            id: true,
            name: true,
            prix_vente_TTC: true,
            photo: true
          }
        }
      }
    });
    
    if (!family) {
      return res.status(404).json({ error: 'Famille non trouvée' });
    }
    
    res.json(family);
  } catch (error) {
    console.error('Error fetching family:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération de la famille' });
  }
});

router.post('/', authenticateToken, async (req, res) => {
  try {
    const { name, description } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Le nom de la famille est requis' });
    }
    
    const existingFamily = await prisma.productFamily.findUnique({
      where: { name: name }
    });
    
    if (existingFamily) {
      return res.status(400).json({ error: 'Une famille avec ce nom existe déjà' });
    }
    
    const family = await prisma.productFamily.create({
      data: {
        name,
        description: description || null
      }
    });
    
    await logAudit(req.user.id, 'product_families', family.id, 'CREATE', null, { name, description });
    
    res.status(201).json(family);
  } catch (error) {
    console.error('Error creating family:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Une famille avec ce nom existe déjà' });
    }
    res.status(500).json({ error: 'Erreur lors de la création de la famille' });
  }
});

router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { name, description, isActive } = req.body;
    const familyId = parseInt(req.params.id);
    
    if (!name) {
      return res.status(400).json({ error: 'Le nom de la famille est requis' });
    }
    
    const existingFamily = await prisma.productFamily.findUnique({
      where: { id: familyId }
    });
    
    if (!existingFamily) {
      return res.status(404).json({ error: 'Famille non trouvée' });
    }
    
    const updatedFamily = await prisma.productFamily.update({
      where: { id: familyId },
      data: {
        name,
        description: description || null,
        isActive: isActive !== undefined ? isActive : true
      }
    });
    
    await logAudit(req.user.id, 'product_families', familyId, 'UPDATE', existingFamily, { name, description, isActive });
    
    res.json(updatedFamily);
  } catch (error) {
    console.error('Error updating family:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Une famille avec ce nom existe déjà' });
    }
    res.status(500).json({ error: 'Erreur lors de la mise à jour de la famille' });
  }
});

router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const familyId = parseInt(req.params.id);
    
    const family = await prisma.productFamily.findUnique({
      where: { id: familyId },
      include: {
        _count: {
          select: { products: true }
        }
      }
    });
    
    if (!family) {
      return res.status(404).json({ error: 'Famille non trouvée' });
    }
    
    // familleId est obligatoire sur Product : on ne peut pas "detacher" un
    // produit. Pour supprimer une famille non vide il faut donc indiquer la
    // famille de destination via ?moveTo=<id>. Les produits sont deplaces,
    // jamais supprimes.
    const moveTo = req.query.moveTo ? parseInt(req.query.moveTo) : null;

    if (family._count.products > 0) {
      if (!moveTo) {
        return res.status(400).json({
          error: `Cette famille contient ${family._count.products} produit(s). Indiquez la famille de destination.`,
          productCount: family._count.products,
          needsMoveTo: true
        });
      }
      if (moveTo === familyId) {
        return res.status(400).json({ error: 'La famille de destination doit etre differente.' });
      }
      const target = await prisma.productFamily.findUnique({ where: { id: moveTo } });
      if (!target) {
        return res.status(400).json({ error: 'Famille de destination introuvable.' });
      }
      await prisma.product.updateMany({
        where: { familleId: familyId },
        data: { familleId: moveTo }
      });
    }

    await prisma.productFamily.delete({
      where: { id: familyId }
    });
    
    await logAudit(req.user.id, 'product_families', familyId, 'DELETE', family, null);
    
    res.json({ message: 'Famille supprimée avec succès' });
  } catch (error) {
    console.error('Error deleting family:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression de la famille' });
  }
});

router.post('/:id/photo', authenticateToken, upload.single('photo'), async (req, res) => {
  try {
    const familyId = parseInt(req.params.id);
    
    if (!req.file) {
      return res.status(400).json({ error: 'Aucun fichier fourni' });
    }
    
    const family = await prisma.productFamily.findUnique({
      where: { id: familyId }
    });
    
    if (!family) {
      return res.status(404).json({ error: 'Famille non trouvée' });
    }
    
    const imageUrl = `${process.env.API_URL || 'http://localhost:3255'}/uploads/families/${req.file.filename}`;
    
    const updatedFamily = await prisma.productFamily.update({
      where: { id: familyId },
      data: { photo: imageUrl }
    });
    
    await logAudit(req.user.id, 'product_families', familyId, 'UPDATE', family, { photo: imageUrl });
    
    res.json({ 
      message: 'Photo mise à jour avec succès',
      imageUrl: imageUrl,
      family: updatedFamily
    });
  } catch (error) {
    console.error('Error uploading family photo:', error);
    res.status(500).json({ error: 'Erreur lors de l\'upload de la photo' });
  }
});

router.delete('/:id/photo', authenticateToken, async (req, res) => {
  try {
    const familyId = parseInt(req.params.id);
    
    const family = await prisma.productFamily.findUnique({
      where: { id: familyId }
    });
    
    if (!family) {
      return res.status(404).json({ error: 'Famille non trouvée' });
    }
    
    if (family.photo) {
      const photoPath = path.join(__dirname, '..', family.photo);
      if (fs.existsSync(photoPath)) {
        fs.unlinkSync(photoPath);
      }
    }
    
    const updatedFamily = await prisma.productFamily.update({
      where: { id: familyId },
      data: { photo: null }
    });
    
    await logAudit(req.user.id, 'product_families', familyId, 'UPDATE', family, { photo: null });
    
    res.json({ 
      message: 'Photo supprimée avec succès',
      family: updatedFamily
    });
  } catch (error) {
    console.error('Error deleting family photo:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression de la photo' });
  }
});

module.exports = router;
