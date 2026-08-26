const express = require('express');
const { prisma } = require('../lib/prisma');
const { authenticateToken } = require('../middleware/auth');
const fs = require('fs');
const path = require('path');

const USER_ROLES_FILE = path.join((process.pkg ? path.dirname(process.execPath) : path.join(__dirname, '../..')), 'src/uploads/user-roles.json');

function readUserRoles() {
  try {
    if (fs.existsSync(USER_ROLES_FILE)) {
      return JSON.parse(fs.readFileSync(USER_ROLES_FILE, 'utf-8') || '{}');
    }
  } catch {}
  return {};
}

function isSuperAdmin(userId) {
  const mapping = readUserRoles();
  return mapping[String(userId)] === '9' || mapping[String(userId)] === 'SUPER_ADMIN';
}

const router = express.Router();

router.get('/', authenticateToken, async (req, res) => {
  try {
    const { depotIds } = req.query;
    
    // Check if current user is super admin
    const isUserSuperAdmin = isSuperAdmin(req.user.id);
    
    // Build where clause
    const where = {};
    
    // If super admin and depotIds provided, filter by selected depots
    if (isUserSuperAdmin && depotIds) {
      let depotIdArray = [];
      
      // Handle different query parameter formats
      if (Array.isArray(depotIds)) {
        // Multiple parameters: ?depotIds=1&depotIds=2&depotIds=3
        depotIdArray = depotIds.map(id => parseInt(String(id))).filter(id => !isNaN(id));
      } else if (typeof depotIds === 'string') {
        // Single parameter: ?depotIds=1,2,3 or ?depotIds=1
        if (depotIds.includes(',')) {
          depotIdArray = depotIds.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
        } else {
          const singleId = parseInt(depotIds);
          if (!isNaN(singleId)) {
            depotIdArray = [singleId];
          }
        }
      }
      
      // Apply filter if we have valid depot IDs
      // For now, filter by depotId (primary depot). 
      // After migration, this can be enhanced to filter by userDepots relation
      if (depotIdArray.length > 0) {
        where.depotId = { in: depotIdArray };
      }
    }
    
    const users = await prisma.user.findMany({
      where,
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
    
    // Fetch userDepots separately to handle cases where table might not exist yet
    let usersWithDepotIds = users.map(user => ({
      ...user,
      depotIds: user.depotId ? [user.depotId] : []
    }));
    
    try {
      // Try to fetch UserDepot relationships if table exists
      const userDepotMap = new Map();
      const userIds = users.map(u => u.id);
      
      if (userIds.length > 0) {
        const userDepots = await prisma.userDepot.findMany({
          where: { userId: { in: userIds } },
          select: {
            userId: true,
            depotId: true
          }
        });
        
        // Group by userId
        userDepots.forEach(ud => {
          if (!userDepotMap.has(ud.userId)) {
            userDepotMap.set(ud.userId, []);
          }
          userDepotMap.get(ud.userId).push(ud.depotId);
        });
      }
      
      // Update users with their depot IDs
      usersWithDepotIds = users.map(user => {
        const depotIds = userDepotMap.get(user.id) || (user.depotId ? [user.depotId] : []);
        return {
          ...user,
          depotIds: depotIds
        };
      });
    } catch (error) {
      // If UserDepot table doesn't exist yet, fall back to single depotId
      console.warn('UserDepot table not available yet, using depotId:', error.message);
      usersWithDepotIds = users.map(user => ({
        ...user,
        depotIds: user.depotId ? [user.depotId] : []
      }));
    }
    
    res.json(usersWithDepotIds);
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

router.get('/:id', authenticateToken, async (req, res) => {
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

    // Fetch UserDepot relationships if table exists
    let depotIds = user.depotId ? [user.depotId] : [];
    try {
      const userDepots = await prisma.userDepot.findMany({
        where: { userId: parseInt(id) },
        select: { depotId: true }
      });
      if (userDepots.length > 0) {
        depotIds = userDepots.map(ud => ud.depotId);
      }
    } catch (error) {
      // If UserDepot table doesn't exist yet, use single depotId
      console.warn('UserDepot table not available yet, using depotId:', error.message);
    }

    // Add depotIds array for client compatibility
    const userWithDepotIds = {
      ...user,
      depotIds: depotIds
    };

    res.json(userWithDepotIds);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { firstName, lastName, role, depotId, depotIds, isActive } = req.body;

    // Handle multiple depot IDs - use first one for depotId field (backward compatibility)
    let finalDepotId = depotId ? parseInt(depotId) : null;
    let depotIdsArray = [];
    
    if (depotIds && Array.isArray(depotIds) && depotIds.length > 0) {
      depotIdsArray = depotIds.map(id => parseInt(id)).filter(id => !isNaN(id));
      finalDepotId = depotIdsArray[0];
    } else if (depotId) {
      finalDepotId = parseInt(depotId);
      depotIdsArray = [finalDepotId];
    }

    // Update user basic info
    const updatedUser = await prisma.user.update({
      where: { id: parseInt(id) },
      data: {
        firstName,
        lastName,
        role,
        depotId: finalDepotId,
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

    // Update UserDepot relationships if depotIds provided
    try {
      if (depotIdsArray.length > 0) {
        // Delete existing UserDepot relationships
        await prisma.userDepot.deleteMany({
          where: { userId: parseInt(id) }
        });

        // Create new UserDepot relationships
        await prisma.userDepot.createMany({
          data: depotIdsArray.map(depotId => ({
            userId: parseInt(id),
            depotId: depotId
          })),
          skipDuplicates: true
        });
      } else {
        // If no depots provided, clear all relationships
        await prisma.userDepot.deleteMany({
          where: { userId: parseInt(id) }
        });
      }
    } catch (error) {
      // If UserDepot table doesn't exist yet, log warning but continue
      console.warn('UserDepot table not available yet. Please run migration:', error.message);
      // Continue without failing - the single depotId is already saved
    }

    // Fetch updated user
    const userWithDepots = await prisma.user.findUnique({
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

    // Fetch UserDepot relationships
    let userDepotIds = [];
    try {
      const userDepots = await prisma.userDepot.findMany({
        where: { userId: parseInt(id) },
        select: { depotId: true }
      });
      userDepotIds = userDepots.map(ud => ud.depotId);
    } catch (error) {
      // If UserDepot table doesn't exist yet, use single depotId
      console.warn('UserDepot table not available yet, using depotId:', error.message);
      userDepotIds = userWithDepots.depotId ? [userWithDepots.depotId] : [];
    }

    // Add depotIds array for client compatibility
    const userWithDepotIds = {
      ...userWithDepots,
      depotIds: userDepotIds
    };

    res.json(userWithDepotIds);
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

    // Get current user to check depotId (PIN must be unique per depot)
    const currentUser = await prisma.user.findUnique({
      where: { id: parseInt(id) },
      select: { depotId: true }
    });

    if (!currentUser || !currentUser.depotId) {
      return res.status(400).json({ error: 'User must have a depotId to set PIN' });
    }

    const pinStr = String(pin).trim();

    // Check if PIN already exists in the same depot (for another user)
    const existingPinUser = await prisma.user.findFirst({
      where: {
        pin: pinStr,
        depotId: currentUser.depotId,
        id: { not: parseInt(id) }
      }
    });

    if (existingPinUser) {
      return res.status(400).json({ error: `PIN ${pinStr} already exists in this depot` });
    }

    const updatedUser = await prisma.user.update({
      where: { id: parseInt(id) },
      data: { pin: pinStr },
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

router.put('/:id/token', authenticateToken, async (req, res) => {
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

router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = parseInt(id);

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    // Check for related records that would prevent deletion
    const [
      hasSales,
      hasDebtTransactions,
      hasAttendanceDays,
      hasPunches,
      hasAuditLogs,
      hasCashMovements,
      hasExpenses,
      hasAttendanceCorrections,
      hasChangeRequests,
      hasDocumentStatusHistory,
      hasInventoryItems,
      isDepotManager
    ] = await Promise.all([
      prisma.sale.findFirst({ where: { userId } }),
      prisma.clientDebtTransaction.findFirst({ where: { userId } }),
      prisma.attendanceDay.findFirst({ where: { userId } }),
      prisma.attendancePunch.findFirst({ where: { userId } }),
      prisma.auditLog.findFirst({ where: { userId } }),
      prisma.cashMovement.findFirst({ where: { createdById: userId } }),
      prisma.expense.findFirst({ 
        where: { 
          OR: [
            { userId: userId },
            { approvedBy: userId },
            { paidBy: userId },
            { rejectedBy: userId }
          ]
        }
      }),
      prisma.attendanceCorrection.findFirst({
        where: {
          OR: [
            { requestedById: userId },
            { reviewedById: userId }
          ]
        }
      }),
      prisma.changeRequest.findFirst({
        where: {
          OR: [
            { requestedBy: userId },
            { approvedBy: userId }
          ]
        }
      }),
      prisma.documentStatusHistory.findFirst({ where: { userId } }),
      prisma.inventoryItem.findFirst({ where: { countedBy: userId } }),
      prisma.depot.findFirst({ where: { managerId: userId } })
    ]);

    // If user has related records, use soft delete instead
    if (hasSales || hasDebtTransactions || hasAttendanceDays || hasPunches || 
        hasAuditLogs || hasCashMovements || hasExpenses || hasAttendanceCorrections || 
        hasChangeRequests || hasDocumentStatusHistory || hasInventoryItems || isDepotManager) {
      // Soft delete: set isActive to false
      await prisma.user.update({
        where: { id: userId },
        data: { isActive: false }
      });
      return res.json({ 
        message: 'Utilisateur désactivé avec succès (l\'utilisateur a des enregistrements associés)' 
      });
    }

    // If no related records, perform hard delete
    await prisma.user.delete({ where: { id: userId } });
    res.json({ message: 'Utilisateur supprimé avec succès' });
  } catch (error) {
    console.error('Error deleting user:', error);
    
    // Handle specific Prisma foreign key constraint error
    if (error.code === 'P2003') {
      // Try soft delete as fallback
      try {
        const userId = parseInt(req.params.id);
        await prisma.user.update({
          where: { id: userId },
          data: { isActive: false }
        });
        return res.json({ 
          message: 'Utilisateur désactivé avec succès (l\'utilisateur a des enregistrements associés)' 
        });
      } catch (softDeleteError) {
        return res.status(500).json({ 
          error: 'Impossible de supprimer l\'utilisateur car il a des enregistrements associés. Veuillez désactiver l\'utilisateur à la place.' 
        });
      }
    }
    
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router; 