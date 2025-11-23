const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { prisma } = require('../lib/prisma');
const fs = require('fs');
const path = require('path');
const USER_ROLES_FILE = path.join(__dirname, '../uploads/user-roles.json');

function readUserRoles() {
  try {
    if (fs.existsSync(USER_ROLES_FILE)) {
      return JSON.parse(fs.readFileSync(USER_ROLES_FILE, 'utf-8') || '{}');
    }
  } catch {}
  return {};
}

function writeUserRoles(obj) {
  const dir = path.dirname(USER_ROLES_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(USER_ROLES_FILE, JSON.stringify(obj || {}, null, 2), 'utf-8');
}

// Enterprise login handler
async function handleEnterpriseLogin(req, res, username, password) {
  try {
    // Find enterprise user
    const enterpriseUser = await prisma.userEnterprise.findFirst({
      where: {
        name: username
      },
      include: {
        company: true
      }
    });

    if (!enterpriseUser) {
      return res.status(401).json({ error: 'Nom d\'utilisateur ou mot de passe invalide' });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, enterpriseUser.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Nom d\'utilisateur ou mot de passe invalide' });
    }

    // Generate JWT token
    const jwtToken = jwt.sign(
      { 
        userId: enterpriseUser.id, 
        role: 'ENTERPRISE_USER',
        companyId: enterpriseUser.companyId,
        userType: 'enterprise'
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    // Enterprise user permissions (full access for billing software)
    const permissions = {
      canManageUsers: true,
      canManageProducts: true,
      canManageStock: true,
      canApproveTransfers: true,
      canViewReports: true,
      canManageSettings: true,
      canProcessSales: true,
      canViewHistory: true
    };

    res.json({
      user: {
        id: enterpriseUser.id,
        username: enterpriseUser.name,
        email: null,
        firstName: enterpriseUser.name,
        lastName: '',
        role: 'ENTERPRISE_USER',
        depotId: null,
        roleKey: null,
        companyId: enterpriseUser.companyId,
        companyName: enterpriseUser.company?.raisonSociale || 'Entreprise',
        userType: 'enterprise'
      },
      token: jwtToken,
      permissions
    });

  } catch (error) {
    console.error('Enterprise login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

const router = express.Router();

router.post('/login', async (req, res) => {
  try {
    const { pin, token, username, password, depotId } = req.body;

    // Check if this is enterprise login (username/password)
    if (username && password) {
      return handleEnterpriseLogin(req, res, username, password);
    }

    if (!pin && !token) {
      return res.status(400).json({ error: 'PIN or token is required' });
    }

    let user;
    if (token) {
      // Token-based authentication (filter by depotId if provided)
      const whereClause = {
        token,
        isActive: true
      };
      
      // If depotId is provided, filter by it to ensure depot isolation
      if (depotId) {
        whereClause.depotId = parseInt(depotId);
      }
      
      user = await prisma.user.findFirst({
        where: whereClause
      });
      
      if (!user) {
        return res.status(401).json({ error: 'Invalid token' });
      }
    } else {
      // PIN-based authentication - filter by depotId if provided, otherwise find unique user
      const pinStr = String(pin).trim();
      

      
      if (depotId) {
        // If depotId is provided, filter by it for isolation
        const targetDepotId = parseInt(depotId);
        
        user = await prisma.user.findFirst({
          where: {
            pin: pinStr,
            depotId: targetDepotId,
            isActive: true
          }
        });
        
        if (!user) {

          // Check if user exists but is inactive or in different depot
          const inactiveUser = await prisma.user.findFirst({
            where: { pin: pinStr, depotId: targetDepotId }
          });
          if (inactiveUser && !inactiveUser.isActive) {
            return res.status(401).json({ error: 'Compte utilisateur désactivé' });
          }
          return res.status(401).json({ error: 'PIN invalide pour ce dépôt' });
        }
      } else {
        // If no depotId provided, try to find user by PIN
        // If multiple users exist with same PIN in different depots, return error requiring depotId
        const users = await prisma.user.findMany({
          where: {
            pin: pinStr,
            isActive: true
          }
        });
        

        
        if (users.length === 0) {
          // Check if user exists but is inactive
          const inactiveUser = await prisma.user.findFirst({
            where: { pin: pinStr }
          });
          if (inactiveUser && !inactiveUser.isActive) {
            return res.status(401).json({ error: 'Compte utilisateur désactivé' });
          }
          return res.status(401).json({ error: 'PIN invalide' });
        }
        
        if (users.length > 1) {
          // Multiple users with same PIN exist in different depots - require depotId

          return res.status(400).json({ 
            error: 'Plusieurs utilisateurs trouvés avec ce PIN. Veuillez spécifier le dépôt',
            requiresDepotId: true
          });
        }
        
        // Single user found - use it
        user = users[0];

      }
    }

    const jwtToken = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    const mapping = readUserRoles();
    const roleKey = mapping[String(user.id)] || null;
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
        depotId: user.depotId,
        roleKey
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
    const { username, email, password, firstName, lastName, role, roleKey, depotId, depotIds, pin } = req.body;

    if (!username || !email || !password || !firstName || !lastName || !role) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Handle multiple depot IDs - use first one for depotId field (backward compatibility)
    let targetDepotId = null;
    if (depotIds && Array.isArray(depotIds) && depotIds.length > 0) {
      targetDepotId = parseInt(depotIds[0]);
    } else if (depotId) {
      targetDepotId = parseInt(depotId);
    }

    // depotId is required for PIN-based users (isolation by depot)
    if (!targetDepotId) {
      return res.status(400).json({ error: 'depotId or depotIds is required for user registration' });
    }
    const pinStr = pin ? String(pin).trim() : '0000';

    // Check for existing username or email (globally unique)
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

    // Check for existing PIN in the same depot (unique per depot)
    const existingPinUser = await prisma.user.findFirst({
      where: {
        pin: pinStr,
        depotId: targetDepotId
      }
    });

    if (existingPinUser) {
      return res.status(400).json({ error: `PIN ${pinStr} already exists in this depot` });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    // Prepare depotIds array
    let depotIdsArray = [];
    if (depotIds && Array.isArray(depotIds) && depotIds.length > 0) {
      depotIdsArray = depotIds.map(id => parseInt(id)).filter(id => !isNaN(id));
    } else if (targetDepotId) {
      depotIdsArray = [targetDepotId];
    }

    const newUser = await prisma.user.create({
      data: {
        username,
        email,
        passwordHash: hashedPassword,
        firstName,
        lastName,
        role,
        depotId: targetDepotId,
        pin: pinStr
      }
    });

    // Create UserDepot relationships if table exists
    try {
      if (depotIdsArray.length > 0) {
        await prisma.userDepot.createMany({
          data: depotIdsArray.map(depotId => ({
            userId: newUser.id,
            depotId: depotId
          })),
          skipDuplicates: true
        });
      }
    } catch (error) {
      // If UserDepot table doesn't exist yet, log warning but continue
      console.warn('UserDepot table not available yet. Please run migration:', error.message);
      // Continue without failing - the single depotId is already saved
    }

    if (roleKey && typeof roleKey === 'string') {
      const mapping = readUserRoles();
      mapping[String(newUser.id)] = roleKey;
      writeUserRoles(mapping);
    }

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

    const mapping = readUserRoles();
    const roleKey = mapping[String(user.id)] || null;
    const permissions = getUserPermissions(user.role);

    res.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        depotId: user.depotId,
        roleKey
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