const express = require('express');
const { prisma } = require('../lib/prisma');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { logAudit } = require('../lib/audit');

const router = express.Router();

// Get active session for user
router.get('/active', authenticateToken, async (req, res) => {
  try {
    const { posId } = req.query;
    
    const activeSession = await prisma.sessionCaisse.findFirst({
      where: {
        userId: req.user.id,
        posId: posId ? parseInt(posId) : 1,
        status: 'OPEN'
      },
      include: {
        user: { select: { firstName: true, lastName: true } },
        depot: { select: { name: true, code: true } },
        cashMovements: {
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!activeSession) {
      return res.json(null);
    }

    // Calculate expected cash from sales and movements
    const sessionSummary = await calculateSessionSummary(activeSession.id);
    activeSession.summary = sessionSummary;

    res.json(activeSession);
  } catch (error) {
    console.error('Error fetching active session:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Open new session
router.post('/open', authenticateToken, requireRole(['ADMIN', 'MANAGER', 'CASHIER']), async (req, res) => {
  try {
    const { openingFund, posId, note } = req.body;

    if (!openingFund || openingFund < 0) {
      return res.status(400).json({ error: 'Fonds de caisse requis et doit être positif' });
    }

    // Check if user already has an open session
    const existingSession = await prisma.sessionCaisse.findFirst({
      where: {
        userId: req.user.id,
        posId: posId ? parseInt(posId) : 1,
        status: 'OPEN'
      }
    });

    if (existingSession) {
      return res.status(400).json({ error: 'Une session est déjà ouverte pour cet utilisateur' });
    }

    // Get last session's fonds as default if not provided
    let defaultFonds = parseFloat(openingFund);
    if (!openingFund) {
      const lastSession = await prisma.sessionCaisse.findFirst({
        where: {
          userId: req.user.id,
          posId: posId ? parseInt(posId) : 1,
          status: 'CLOSED'
        },
        orderBy: { closedAt: 'desc' }
      });
      
      if (lastSession) {
        // Get fonds from settings or use last session's fonds
        const settings = await getClotureSettings();
        defaultFonds = settings.defaultFonds || 50;
      }
    }

    const session = await prisma.sessionCaisse.create({
      data: {
        posId: posId ? parseInt(posId) : 1,
        userId: req.user.id,
        depotId: req.user.depotId,
        openingFund: defaultFonds,
        expectedCash: defaultFonds,
        note: note || null
      },
      include: {
        user: { select: { firstName: true, lastName: true } },
        depot: { select: { name: true, code: true } }
      }
    });

    await logAudit(req.user.id, 'session_caisse', session.id, 'CREATE', null, {
      posId: session.posId,
      openingFund: session.openingFund,
      note: session.note
    });

    // Emit socket notification
    if (req.app.get('io')) {
      req.app.get('io').emit('session_opened', {
        sessionId: session.id,
        userId: session.userId,
        posId: session.posId,
        openingFund: session.openingFund,
        openedAt: session.openedAt
      });
    }

    res.status(201).json(session);
  } catch (error) {
    console.error('Error opening session:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add cash movement
router.post('/:id/movements', authenticateToken, requireRole(['ADMIN', 'MANAGER', 'CASHIER']), async (req, res) => {
  try {
    const { id } = req.params;
    const { type, amount, reason, ticketId } = req.body;

    if (!type || !amount || !reason) {
      return res.status(400).json({ error: 'Type, montant et motif sont requis' });
    }

    const session = await prisma.sessionCaisse.findFirst({
      where: {
        id: parseInt(id),
        userId: req.user.id,
        status: 'OPEN'
      }
    });

    if (!session) {
      return res.status(404).json({ error: 'Session non trouvée ou fermée' });
    }

    const movement = await prisma.cashMovement.create({
      data: {
        sessionId: parseInt(id),
        type: type,
        amount: parseFloat(amount),
        reason: reason,
        ticketId: ticketId ? parseInt(ticketId) : null,
        createdById: req.user.id
      }
    });

    // Update expected cash
    await updateExpectedCash(parseInt(id));

    await logAudit(req.user.id, 'cash_movements', movement.id, 'CREATE', null, {
      sessionId: movement.sessionId,
      type: movement.type,
      amount: movement.amount,
      reason: movement.reason
    });

    // Emit socket notification
    if (req.app.get('io')) {
      req.app.get('io').emit('cash_movement_added', {
        sessionId: movement.sessionId,
        movementId: movement.id,
        type: movement.type,
        amount: movement.amount,
        reason: movement.reason,
        createdAt: movement.createdAt
      });
    }

    res.status(201).json(movement);
  } catch (error) {
    console.error('Error adding cash movement:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get session summary
router.get('/:id/summary', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const session = await prisma.sessionCaisse.findFirst({
      where: {
        id: parseInt(id),
        userId: req.user.id
      }
    });

    if (!session) {
      return res.status(404).json({ error: 'Session non trouvée' });
    }

    const summary = await calculateSessionSummary(parseInt(id));
    res.json(summary);
  } catch (error) {
    console.error('Error fetching session summary:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Close session
router.post('/:id/close', authenticateToken, requireRole(['ADMIN', 'MANAGER', 'CASHIER']), async (req, res) => {
  try {
    const { id } = req.params;
    const { countedCash, fonds, retraitCentrale, denominations } = req.body;

    if (!countedCash || countedCash < 0) {
      return res.status(400).json({ error: 'Espèces comptées requises et doivent être positives' });
    }

    const session = await prisma.sessionCaisse.findFirst({
      where: {
        id: parseInt(id),
        userId: req.user.id,
        status: 'OPEN'
      }
    });

    if (!session) {
      return res.status(404).json({ error: 'Session non trouvée ou déjà fermée' });
    }

    const summary = await calculateSessionSummary(parseInt(id));
    const variance = parseFloat(countedCash) - parseFloat(summary.expectedCash);
    
    // Check variance threshold
    const settings = await getClotureSettings();
    const requiresApproval = Math.abs(variance) > settings.varianceThreshold;

    const result = await prisma.$transaction(async (tx) => {
      // Add retrait centrale if specified
      if (retraitCentrale && retraitCentrale > 0) {
        await tx.cashMovement.create({
          data: {
            sessionId: parseInt(id),
            type: 'RETRAIT_CENTRALE',
            amount: parseFloat(retraitCentrale),
            reason: 'Retrait vers Caisse Centrale',
            createdById: req.user.id
          }
        });
      }

      // Update session
      const updatedSession = await tx.sessionCaisse.update({
        where: { id: parseInt(id) },
        data: {
          status: 'CLOSED',
          closedAt: new Date(),
          countedCash: parseFloat(countedCash),
          variance: variance,
          zSeq: session.zSeq + 1
        }
      });

      // Create change request if variance exceeds threshold
      if (requiresApproval) {
        await tx.changeRequest.create({
          data: {
            type: 'VARIANCE_APPROVAL',
            entityId: parseInt(id),
            entityType: 'SESSION_CAISSE',
            reason: `Écart de ${variance.toFixed(3)} TND dépasse le seuil de ${settings.varianceThreshold} TND`,
            requestedBy: req.user.id
          }
        });
      }

      return updatedSession;
    });

    await logAudit(req.user.id, 'session_caisse', parseInt(id), 'UPDATE', session, {
      status: 'CLOSED',
      countedCash: parseFloat(countedCash),
      variance: variance
    });

    // Generate Z report data
    const zReportData = await generateZReport(parseInt(id));

    // Emit socket notification
    if (req.app.get('io')) {
      req.app.get('io').emit('session_closed', {
        sessionId: parseInt(id),
        userId: session.userId,
        posId: session.posId,
        variance: variance,
        requiresApproval: requiresApproval,
        closedAt: result.closedAt,
        totals: {
          expectedCash: summary.expectedCash,
          countedCash: parseFloat(countedCash),
          totalSales: summary.totalSales,
          totalTickets: summary.totalTickets
        }
      });
    }

    res.json({
      session: result,
      zReport: zReportData,
      requiresApproval,
      variance
    });
  } catch (error) {
    console.error('Error closing session:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get sessions history
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { 
      startDate, 
      endDate, 
      userId, 
      posId, 
      status, 
      hasVariance,
      page = 1, 
      limit = 50 
    } = req.query;

    const whereClause = {};
    
    // Admin can see all sessions, others only their own
    if (req.user.role !== 'ADMIN') {
      whereClause.userId = req.user.id;
    } else if (userId) {
      whereClause.userId = parseInt(userId);
    }

    if (startDate && endDate) {
      whereClause.openedAt = { 
        gte: new Date(startDate), 
        lte: new Date(endDate) 
      };
    }

    if (posId) whereClause.posId = parseInt(posId);
    if (status) whereClause.status = status;
    if (hasVariance === 'true') {
      whereClause.variance = { not: 0 };
    }

    const sessions = await prisma.sessionCaisse.findMany({
      where: whereClause,
      include: {
        user: { select: { firstName: true, lastName: true } },
        depot: { select: { name: true, code: true } }
      },
      orderBy: { openedAt: 'desc' },
      skip: (parseInt(page) - 1) * parseInt(limit),
      take: parseInt(limit)
    });

    res.json(sessions);
  } catch (error) {
    console.error('Error fetching sessions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get session report (X or Z)
router.get('/:id/report', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { type = 'Z', format = 'html' } = req.query;

    const session = await prisma.sessionCaisse.findFirst({
      where: {
        id: parseInt(id),
        userId: req.user.id
      },
      include: {
        user: { select: { firstName: true, lastName: true } },
        depot: { select: { name: true, code: true } },
        cashMovements: true
      }
    });

    if (!session) {
      return res.status(404).json({ error: 'Session non trouvée' });
    }

    const reportData = type === 'Z' ? 
      await generateZReport(parseInt(id)) : 
      await generateXReport(parseInt(id));

    if (format === 'escpos') {
      const escposData = generateESCReport(reportData, type);
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.send(escposData);
    } else if (format === 'pdf') {
      // PDF generation would be implemented here
      res.json({ message: 'PDF generation not implemented yet', data: reportData });
    } else {
      res.json(reportData);
    }
  } catch (error) {
    console.error('Error generating report:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin: Reopen session
router.post('/:id/reopen', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({ error: 'Raison requise pour la réouverture' });
    }

    const session = await prisma.sessionCaisse.findFirst({
      where: {
        id: parseInt(id),
        status: 'CLOSED'
      }
    });

    if (!session) {
      return res.status(404).json({ error: 'Session non trouvée ou déjà ouverte' });
    }

    const result = await prisma.$transaction(async (tx) => {
      // Create change request
      const changeRequest = await tx.changeRequest.create({
        data: {
          type: 'SESSION_REOPEN',
          entityId: parseInt(id),
          entityType: 'SESSION_CAISSE',
          reason: reason,
          requestedBy: req.user.id,
          status: 'APPROVED',
          approvedBy: req.user.id,
          approvedAt: new Date()
        }
      });

      // Reopen session
      const reopenedSession = await tx.sessionCaisse.update({
        where: { id: parseInt(id) },
        data: {
          status: 'REOPENED',
          closedAt: null,
          countedCash: null,
          variance: null
        }
      });

      return { session: reopenedSession, changeRequest };
    });

    await logAudit(req.user.id, 'session_caisse', parseInt(id), 'UPDATE', session, {
      status: 'REOPENED',
      reason: reason
    });

    // Emit socket notification
    if (req.app.get('io')) {
      req.app.get('io').emit('session_reopened', {
        sessionId: parseInt(id),
        userId: session.userId,
        posId: session.posId,
        reason: reason,
        reopenedBy: req.user.id,
        reopenedAt: new Date()
      });
    }

    res.json(result);
  } catch (error) {
    console.error('Error reopening session:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper functions
async function calculateSessionSummary(sessionId) {
  const session = await prisma.sessionCaisse.findUnique({
    where: { id: sessionId },
    include: {
      sales: {
        include: {
          paymentMethod: true
        }
      },
      cashMovements: true
    }
  });

  if (!session) return null;

  // Calculate cash from sales
  const cashSales = session.sales
    .filter(sale => sale.paymentMethod?.type === 'CASH')
    .reduce((sum, sale) => sum + parseFloat(sale.finalTotal), 0);

  // Calculate cash movements
  const entree = session.cashMovements
    .filter(m => m.type === 'ENTREE')
    .reduce((sum, m) => sum + parseFloat(m.amount), 0);

  const sortie = session.cashMovements
    .filter(m => ['SORTIE', 'DEPOT_COFFRE', 'RETRAIT_CENTRALE'].includes(m.type))
    .reduce((sum, m) => sum + parseFloat(m.amount), 0);

  const expectedCash = parseFloat(session.openingFund) + cashSales + entree - sortie;

  // Group sales by payment method
  const salesByPayment = {};
  session.sales.forEach(sale => {
    const method = sale.paymentMethod?.name || 'Non spécifié';
    if (!salesByPayment[method]) {
      salesByPayment[method] = { amount: 0, count: 0 };
    }
    salesByPayment[method].amount += parseFloat(sale.finalTotal);
    salesByPayment[method].count += 1;
  });

  return {
    expectedCash,
    cashSales,
    entree,
    sortie,
    salesByPayment,
    totalSales: session.sales.reduce((sum, sale) => sum + parseFloat(sale.finalTotal), 0),
    totalTickets: session.sales.length
  };
}

async function updateExpectedCash(sessionId) {
  const summary = await calculateSessionSummary(sessionId);
  if (summary) {
    await prisma.sessionCaisse.update({
      where: { id: sessionId },
      data: { expectedCash: summary.expectedCash }
    });
  }
}

async function generateZReport(sessionId) {
  const session = await prisma.sessionCaisse.findUnique({
    where: { id: sessionId },
    include: {
      user: { select: { firstName: true, lastName: true } },
      depot: { select: { name: true, code: true } },
      sales: {
        include: {
          paymentMethod: true,
          items: true
        }
      },
      cashMovements: true
    }
  });

  const summary = await calculateSessionSummary(sessionId);
  
  return {
    session,
    summary,
    generatedAt: new Date(),
    reportType: 'Z'
  };
}

async function generateXReport(sessionId) {
  return await generateZReport(sessionId);
}

function generateESCReport(reportData, type) {
  const { session, summary } = reportData;
  
  let escpos = '';
  escpos += '\x1B\x40'; // Initialize printer
  escpos += '\x1B\x61\x01'; // Center align
  escpos += 'RAPPORT ' + type + '\n';
  escpos += '==================\n\n';
  
  escpos += '\x1B\x61\x00'; // Left align
  escpos += `Session: ${session.id}\n`;
  escpos += `Caissier: ${session.user.firstName} ${session.user.lastName}\n`;
  escpos += `Dépôt: ${session.depot?.name || 'N/A'}\n`;
  escpos += `Ouvert: ${new Date(session.openedAt).toLocaleString('fr-FR')}\n`;
  if (session.closedAt) {
    escpos += `Fermé: ${new Date(session.closedAt).toLocaleString('fr-FR')}\n`;
  }
  escpos += '\n';
  
  escpos += 'RÉCAPITULATIF VENTES\n';
  escpos += '===================\n';
  Object.entries(summary.salesByPayment).forEach(([method, data]) => {
    escpos += `${method}: ${data.amount.toFixed(3)} TND (${data.count} tickets)\n`;
  });
  escpos += `\nTotal: ${summary.totalSales.toFixed(3)} TND\n`;
  escpos += `Tickets: ${summary.totalTickets}\n\n`;
  
  escpos += 'MOUVEMENTS CAISSE\n';
  escpos += '=================\n';
  session.cashMovements.forEach(movement => {
    escpos += `${movement.type}: ${movement.amount.toFixed(3)} TND\n`;
    escpos += `  ${movement.reason}\n`;
  });
  escpos += '\n';
  
  escpos += 'COMPTAGE ESPÈCES\n';
  escpos += '================\n';
  escpos += `Fonds de caisse: ${session.openingFund.toFixed(3)} TND\n`;
  escpos += `Espèces attendues: ${summary.expectedCash.toFixed(3)} TND\n`;
  if (session.countedCash) {
    escpos += `Espèces comptées: ${session.countedCash.toFixed(3)} TND\n`;
    escpos += `Écart: ${session.variance.toFixed(3)} TND\n`;
  }
  escpos += '\n';
  
  escpos += '\x1B\x61\x01'; // Center align
  escpos += 'Merci de votre visite!\n';
  escpos += '\n\n\n';
  escpos += '\x1D\x56\x00'; // Cut paper
  
  return escpos;
}

async function getClotureSettings() {
  try {
    const settings = await prisma.appSettings.findFirst();
    return {
      varianceThreshold: settings?.varianceThreshold || 5.0,
      defaultFonds: settings?.defaultFonds || 50.0,
      denominations: settings?.denominations || [50, 20, 10, 5, 2, 1, 0.5, 0.2, 0.1, 0.05],
      requireApprovalForVariance: settings?.requireApprovalForVariance !== false,
      ticketWidth: settings?.ticketWidth || 58,
      droitDeTimbre: settings?.droitDeTimbre || false
    };
  } catch (error) {
    return {
      varianceThreshold: 5.0,
      defaultFonds: 50.0,
      denominations: [50, 20, 10, 5, 2, 1, 0.5, 0.2, 0.1, 0.05],
      requireApprovalForVariance: true,
      ticketWidth: 58,
      droitDeTimbre: false
    };
  }
}

module.exports = router;
