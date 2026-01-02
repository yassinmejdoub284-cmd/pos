const { prisma } = require('./prisma');

class AuditLogger {
  static async logAction({
    tableName,
    recordId,
    action,
    oldValues = null,
    newValues = null,
    userId,
    ipAddress = null,
    userAgent = null
  }) {
    try {
      await prisma.auditLog.create({
        data: {
          tableName,
          recordId,
          action,
          oldValues: oldValues ? JSON.stringify(oldValues) : null,
          newValues: newValues ? JSON.stringify(newValues) : null,
          userId,
          ipAddress,
          userAgent
        }
      });
    } catch (error) {
      console.error('Error logging audit trail:', error);
    }
  }

  static async logCreate(tableName, recordId, newValues, userId, req = null) {
    return this.logAction({
      tableName,
      recordId,
      action: 'CREATE',
      newValues,
      userId,
      ipAddress: req?.ip,
      userAgent: req?.get('User-Agent')
    });
  }

  static async logUpdate(tableName, recordId, oldValues, newValues, userId, req = null) {
    return this.logAction({
      tableName,
      recordId,
      action: 'UPDATE',
      oldValues,
      newValues,
      userId,
      ipAddress: req?.ip,
      userAgent: req?.get('User-Agent')
    });
  }

  static async logDelete(tableName, recordId, oldValues, userId, req = null) {
    return this.logAction({
      tableName,
      recordId,
      action: 'DELETE',
      oldValues,
      userId,
      ipAddress: req?.ip,
      userAgent: req?.get('User-Agent')
    });
  }

  static async log({
    userId,
    action,
    entityType,
    entityId = null,
    details = null,
    oldValues = null,
    newValues = null,
    req = null
  }) {
    // Convert entityType to tableName (convert PascalCase to snake_case)
    const tableName = entityType
      .replace(/([A-Z])/g, '_$1')
      .toLowerCase()
      .replace(/^_/, '');

    // If details is provided and newValues is not, store details in newValues
    const finalNewValues = newValues || (details ? { details } : null);

    return this.logAction({
      tableName,
      recordId: entityId || 0,
      action,
      oldValues,
      newValues: finalNewValues,
      userId,
      ipAddress: req?.ip,
      userAgent: req?.get('User-Agent')
    });
  }
}

const auditMiddleware = (tableName) => {
  return async (req, res, next) => {
    const originalSend = res.send;
    
    res.send = function(data) {
      const response = JSON.parse(data);
      
      if (response.id && req.method === 'POST') {
        AuditLogger.logCreate(tableName, response.id, response, req.user.id, req);
      } else if (response.id && req.method === 'PUT') {
        AuditLogger.logUpdate(tableName, response.id, req.body, response, req.user.id, req);
      } else if (req.method === 'DELETE' && res.statusCode === 200) {
        const recordId = parseInt(req.params.id);
        AuditLogger.logDelete(tableName, recordId, req.body, req.user.id, req);
      }
      
      originalSend.call(this, data);
    };
    
    next();
  };
};

function logAudit(userId, tableName, recordId, action, oldValues, newValues) {
  return AuditLogger.logAction({
    tableName,
    recordId,
    action,
    oldValues,
    newValues,
    userId
  });
}

module.exports = {
  AuditLogger,
  auditMiddleware,
  logAudit
}; 