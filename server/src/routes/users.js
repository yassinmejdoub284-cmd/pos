const express = require('express');
const { prisma } = require('../lib/prisma');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireRole(['ADMIN']), async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        depotId: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
        pin: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', requireRole(['ADMIN']), async (req, res) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id: parseInt(id) },
      select: {
        id: true,
        username: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        depotId: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
        pin: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', requireRole(['ADMIN']), async (req, res) => {
  try {
    const { id } = req.params;
    const { firstName, lastName, role, depotId, isActive } = req.body;

    const updatedUser = await prisma.user.update({
      where: { id: parseInt(id) },
      data: {
        firstName,
        lastName,
        role,
        depotId: depotId ? parseInt(depotId) : null,
        isActive
      },
      select: {
        id: true,
        username: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        depotId: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
        pin: true
      }
    });

    res.json(updatedUser);
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id/pin', requireRole(['ADMIN']), async (req, res) => {
  try {
    const { id } = req.params;
    const { pin } = req.body;

    if (!pin || String(pin).length !== 8) {
      return res.status(400).json({ error: 'PIN invalide (8 chiffres requis)' });
    }

    const updatedUser = await prisma.user.update({
      where: { id: parseInt(id) },
      data: { pin: String(pin) },
      select: {
        id: true,
        username: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        depotId: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
        pin: true
      }
    });

    res.json(updatedUser);
  } catch (error) {
    console.error('Error updating user pin:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', requireRole(['ADMIN']), async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.user.delete({ where: { id: parseInt(id) } });
    res.json({ message: 'Utilisateur supprimé avec succès' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router; 