const jwt = require('jsonwebtoken');
const { prisma } = require('../lib/prisma');

async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  // Check if it's a mock token for development
  if (token.startsWith('mock-jwt-token-')) {
    const mockUser = await getMockUserFromToken(token);
    if (mockUser) {
      req.user = mockUser;
      return next();
    }
  }

  try {
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
      return res.status(401).json({ error: 'User not found or inactive' });
    }

    // Allow admin to override visiting depot via header for per-request scoping
    const visitingDepotHeader = req.headers['x-depot-id'];
    let visitingDepotId = user.depotId;
    if (user.role === 'ADMIN' && visitingDepotHeader) {
      const parsed = parseInt(Array.isArray(visitingDepotHeader) ? visitingDepotHeader[0] : String(visitingDepotHeader), 10);
      if (!isNaN(parsed)) {
        visitingDepotId = parsed;
      }
    }
    req.user = { ...user, depotId: visitingDepotId };
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(403).json({ error: 'Invalid token' });
  }
}

async function getMockUserFromToken(token) {
  // Handle persistent development token
  if (token === 'mock-jwt-token-ADMIN-DEV-PERSISTENT') {
    return getDefaultMockUser();
  }
  
  // Extract role from mock token format: mock-jwt-token-{ROLE}-{YYYYMMDDHHMMSSmmm}
  const tokenParts = token.split('-');
  
  if (tokenParts.length >= 4) {
    const role = tokenParts[3]; // Get the role part
    const timestamp = tokenParts.slice(4).join('-'); // Get the timestamp part
    
    // Validate that the role is actually a valid role
    const validRoles = ['ADMIN', 'MANAGER', 'CASHIER', 'STOCK_MANAGER'];
    if (!validRoles.includes(role)) {
      // If the role part is not valid, it might be a timestamp, use ADMIN
      return getDefaultMockUser();
    }
    
    // Get the first depot from the database for mock users
    const depot = await prisma.depot.findFirst({
      where: { isActive: true },
      orderBy: { id: 'asc' }
    });
    
    const mockUser = {
      id: 1,
      username: role.toLowerCase(),
      email: `${role.toLowerCase()}@patisserie.com`,
      firstName: role.charAt(0) + role.slice(1).toLowerCase(),
      lastName: 'User',
      role: role,
      depotId: depot ? depot.id : 1,
      isActive: true
    };

    return mockUser;
  }

  // Fallback for simple mock tokens
  return getDefaultMockUser();
}

async function getDefaultMockUser() {
  const depot = await prisma.depot.findFirst({
    where: { isActive: true },
    orderBy: { id: 'asc' }
  });

  return {
    id: 1,
    username: 'admin',
    email: 'admin@patisserie.com',
    firstName: 'Admin',
    lastName: 'User',
    role: 'ADMIN',
    depotId: depot ? depot.id : 1,
    isActive: true
  };
}

function requireRole(roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
}

function requireDepotAccess() {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const depotId = req.params.depotId || req.body.depotId;
    
    if (!depotId) {
      return res.status(400).json({ error: 'Depot ID required' });
    }

    try {
      const depot = await prisma.depot.findFirst({
        where: {
          id: parseInt(depotId),
          isActive: true
        }
      });

      if (!depot) {
        return res.status(404).json({ error: 'Depot not found' });
      }

      if (req.user.role !== 'ADMIN' && req.user.depotId !== parseInt(depotId)) {
        return res.status(403).json({ error: 'Access denied to this depot' });
      }

      next();
    } catch (error) {
      console.error('Error checking depot access:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  };
}

module.exports = {
  authenticateToken,
  requireRole,
  requireDepotAccess
}; 