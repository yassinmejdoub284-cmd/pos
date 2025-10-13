const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { prisma } = require('../lib/prisma');

const router = express.Router();

router.post('/login', async (req, res) => {
  try {
    const { pin, token } = req.body;

    if (!pin && !token) {
      return res.status(400).json({ error: 'PIN or token is required' });
    }

    let user;
    if (token) {
      // Token-based authentication
      user = await prisma.user.findFirst({
        where: {
          token,
          isActive: true
        }
      });
      
      if (!user) {
        return res.status(401).json({ error: 'Invalid token' });
      }
    } else {
      // PIN-based authentication
      user = await prisma.user.findFirst({
        where: {
          pin,
          isActive: true
        }
      });
      
      if (!user) {
        return res.status(401).json({ error: 'Invalid PIN' });
      }
    }

    const jwtToken = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    const permissions = getUserPermissions(user.role);

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() }
    });

    res.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        depotId: user.depotId
      },
      token: jwtToken,
      permissions
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/register', async (req, res) => {
  try {
    const { username, email, password, firstName, lastName, role, depotId, pin } = req.body;

    if (!username || !email || !password || !firstName || !lastName || !role) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { username },
          { email }
        ]
      }
    });

    if (existingUser) {
      return res.status(400).json({ error: 'Username or email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const newUser = await prisma.user.create({
      data: {
        username,
        email,
        passwordHash: hashedPassword,
        firstName,
        lastName,
        role,
        depotId,
        pin: pin || '0000'
      }
    });

    res.status(201).json({
      message: 'User created successfully',
      userId: newUser.id
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    
    const user = await prisma.user.findFirst({
      where: {
        id: decoded.userId,
        isActive: true
      },
      select: {
        id: true,
        username: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        depotId: true,
        isActive: true
      }
    });

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    const permissions = getUserPermissions(user.role);

    res.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        depotId: user.depotId
      },
      permissions
    });

  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

function getUserPermissions(role) {
  const permissions = {
    canManageUsers: false,
    canManageProducts: false,
    canManageStock: false,
    canApproveTransfers: false,
    canViewReports: false,
    canManageSettings: false,
    canProcessSales: false,
    canViewHistory: false
  };

  switch (role) {
    case 'ADMIN':
      Object.keys(permissions).forEach(key => permissions[key] = true);
      break;
    case 'MANAGER':
      permissions.canManageProducts = true;
      permissions.canManageStock = true;
      permissions.canApproveTransfers = true;
      permissions.canViewReports = true;
      permissions.canProcessSales = true;
      permissions.canViewHistory = true;
      break;
    case 'CASHIER':
      permissions.canProcessSales = true;
      permissions.canViewHistory = true;
      break;
    case 'STOCK_MANAGER':
      permissions.canManageStock = true;
      permissions.canViewReports = true;
      permissions.canViewHistory = true;
      break;
  }

  return permissions;
}

module.exports = router; 