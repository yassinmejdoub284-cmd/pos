const express = require('express');
const { prisma } = require('../lib/prisma');
const { requireRole, authenticateToken } = require('../middleware/auth');

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
        pin: true,
        token: true
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

router.get('/roles', authenticateToken, async (req, res) => {
  try {
    const roles = await prisma.user.findMany({
      select: {
        role: true
      },
      distinct: ['role'],
      where: {
        isActive: true
      },
      orderBy: {
        role: 'asc'
      }
    });
    const roleList = roles.map(r => r.role);
    res.json(roleList);
  } catch (error) {
    console.error('Error fetching roles:', error);
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
        pin: true,
        token: true
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
        pin: true,
        token: true
      }
    });

    res.json(updatedUser);
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id/pin', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { pin } = req.body;

    // Check if user is trying to change their own PIN or if they're admin
    if (parseInt(id) !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Vous ne pouvez modifier que votre propre PIN' });
    }

    if (!pin || String(pin).length < 4 || String(pin).length > 8) {
      return res.status(400).json({ error: 'PIN invalide (4-8 chiffres requis)' });
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
        pin: true,
        token: true
      }
    });

    res.json(updatedUser);
  } catch (error) {
    console.error('Error updating user pin:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id/token', requireRole(['ADMIN']), async (req, res) => {
  try {
    const { id } = req.params;
    const { token } = req.body;

    if (!token || String(token).length < 10) {
      return res.status(400).json({ error: 'Token invalide (minimum 10 caractères requis)' });
    }

    const updatedUser = await prisma.user.update({
      where: { id: parseInt(id) },
      data: { token: String(token) },
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
        pin: true,
        token: true
      }
    });

    res.json(updatedUser);
  } catch (error) {
    console.error('Error updating user token:', error);
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