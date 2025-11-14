const express = require('express');
const { prisma } = require('../lib/prisma');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { logAudit } = require('../lib/audit');

const router = express.Router();

// Get active session for user (strictly filtered by depotId for isolation)
router.get('/active', authenticateToken, async (req, res) => {
  try {
    const { posId, depotId } = req.query;
    
    // Always enforce depot isolation - use user's depot or provided depot
    const userDepotId = req.user.depotId;
    const requestedDepotId = depotId ? parseInt(depotId) : userDepotId;
    
    // For non-admin users, only allow access to their own depot
    if (req.user?.role !== 'ADMIN' && requestedDepotId !== userDepotId) {
      return res.status(403).json({ error: 'Access denied: Cannot access other depot sessions' });
    }
    
    const where = {
      userId: req.user.id,
      posId: posId ? parseInt(posId) : 1,
      status: 'OPEN',
      depotId: requestedDepotId // Always filter by depot for isolation
    };

    const activeSession = await prisma.sessionCaisse.findFirst({
      where,
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

    // Update the session's expectedCash field in the database
    await prisma.sessionCaisse.update({
      where: { id: activeSession.id },
      data: { expectedCash: sessionSummary.expectedCash }
    });
    
    // Update the response object as well
    activeSession.expectedCash = sessionSummary.expectedCash;

    res.json(activeSession);
  } catch (error) {
    console.error('Error fetching active session:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get active session by depot only (no user linkage)
router.get('/active-by-depot', authenticateToken, async (req, res) => {
  try {
    const { posId, depotId } = req.query;
    
    // Always enforce depot isolation - use user's depot or provided depot
    const userDepotId = req.user.depotId;
    // Check visiting depot from header (set by admin or for cross-depot access)
    const visitingDepotHeader = req.headers['x-depot-id'];
    const visitingDepotId = visitingDepotHeader ? parseInt(visitingDepotHeader) : null;
    
    // Determine which depot to use: requested > visiting > user's depot
    let requestedDepotId = depotId ? parseInt(depotId) : (visitingDepotId || userDepotId);
    
    // For non-admin users, check depot access
    if (req.user?.role !== 'ADMIN') {
      // Allow if accessing own depot
      if (requestedDepotId && userDepotId && requestedDepotId === userDepotId) {
        // OK - accessing own depot
      }
      // Allow if accessing visiting depot (for MANAGER/CASHIER with visiting depot header)
      else if (requestedDepotId && visitingDepotId && requestedDepotId === visitingDepotId) {
        // OK - accessing visiting depot
      }
      // Allow if user has no depot assigned but valid depot is requested
      else if (!userDepotId && requestedDepotId) {
        // Check if depot exists and is active
        const depot = await prisma.depot.findFirst({
          where: { id: requestedDepotId, isActive: true }
        });
        if (!depot) {
          return res.status(403).json({ error: 'Invalid depot specified' });
        }
        // Allow access for users without assigned depot (like RESPONSABLE_MAGASIN)
      }
      // Deny if trying to access different depot
      else if (requestedDepotId && userDepotId && requestedDepotId !== userDepotId) {
      return res.status(403).json({ error: 'Access denied: Cannot access other depot sessions' });
      }
      // If no depot specified and user has no depot, return error
      else if (!requestedDepotId && !userDepotId) {
        return res.status(400).json({ error: 'No depot specified and user has no assigned depot' });
      }
    }
    
    const where = {
      posId: posId ? parseInt(posId) : 1,
      status: 'OPEN',
      depotId: requestedDepotId // Only filter by depot, no user linkage
    };

    const activeSession = await prisma.sessionCaisse.findFirst({
      where,
      include: {
        user: { select: { firstName: true, lastName: true } },
        depot: { select: { name: true, code: true } },
        cashMovements: {
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!activeSession) {
      console.log('[active-by-depot] No active session found for depot:', requestedDepotId);
      return res.json(null);
    }

    // Debug logging removed to reduce console spam

    // Calculate expected cash from sales and movements
    const sessionSummary = await calculateSessionSummary(activeSession.id);
    activeSession.summary = sessionSummary;

    // Debug logging removed to reduce console spam

    // Update the session's expectedCash field in the database
    await prisma.sessionCaisse.update({
      where: { id: activeSession.id },
      data: { expectedCash: sessionSummary.expectedCash }
    });
    
    // Update the response object as well
    activeSession.expectedCash = sessionSummary.expectedCash;

    res.json(activeSession);
  } catch (error) {
    console.error('Error fetching active session by depot:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Open new session
router.post('/open', authenticateToken, requireRole(['ADMIN', 'MANAGER', 'CASHIER']), async (req, res) => {
  try {
    const { openingFund, posId, note, depotId } = req.body;

    if (openingFund === undefined || openingFund === null || openingFund < 0) {
      return res.status(400).json({ error: 'Fonds de caisse requis et doit être positif ou zéro' });
    }

    // Enforce depot isolation first
    const userDepotId = req.user.depotId;
    let targetDepotId = userDepotId;
    
    if (req.user?.role === 'ADMIN') {
      // Admin can specify depot, but must be valid
      if (depotId) {
        const requestedDepot = await prisma.depot.findFirst({ 
          where: { id: parseInt(depotId), isActive: true, type: 'SHOP' } 
        });
        if (requestedDepot) {
          targetDepotId = requestedDepot.id;
        } else {
          return res.status(400).json({ error: 'Invalid or inactive depot specified' });
        }
      } else if (!userDepotId) {
        // Admin without depot assignment - find first active SHOP depot
        const defaultDepot = await prisma.depot.findFirst({ 
          where: { isActive: true, type: 'SHOP' }, orderBy: { id: 'asc' }
        });
        if (defaultDepot) {
          targetDepotId = defaultDepot.id;
        } else {
          return res.status(400).json({ error: 'Aucun dépôt SHOP actif disponible pour ouvrir une session.' });
        }
      }
    } else {
      // Non-admin users must use their assigned depot
      if (!userDepotId) {
        return res.status(400).json({ error: 'User is not assigned to any depot.' });
      }
      // Non-admin users cannot specify different depot
      if (depotId && parseInt(depotId) !== userDepotId) {
        return res.status(403).json({ error: 'Access denied: Cannot create session for different depot' });
      }
    }

    // Check if user already has an open session FOR THIS SPECIFIC DEPOT
    const existingSession = await prisma.sessionCaisse.findFirst({
      where: {
        userId: req.user.id,
        posId: posId ? parseInt(posId) : 1,
        depotId: targetDepotId, // CRITICAL: Filter by depot
        status: 'OPEN'
      }
    });

    if (existingSession) {
      return res.status(400).json({ error: 'Une session est déjà ouverte pour cet utilisateur dans ce dépôt' });
    }

    // Get last session's fonds as default if not provided (0 is valid)
    let defaultFonds = parseFloat(openingFund);
    if (openingFund === undefined || openingFund === null) {
      const lastSession = await prisma.sessionCaisse.findFirst({
        where: {
          userId: req.user.id,
          posId: posId ? parseInt(posId) : 1,
          depotId: targetDepotId, // CRITICAL: Filter by depot
          status: 'CLOSED'
        },
        orderBy: { closedAt: 'desc' }
      });
      
      if (lastSession) {
        // Try to extract fonds from the last session's note
        let fondsFromNote = 0;
        if (lastSession.note && lastSession.note.includes('Fonds pour prochaine session:')) {
          const match = lastSession.note.match(/Fonds pour prochaine session: ([\d.]+)/);
          if (match) {
            fondsFromNote = parseFloat(match[1]);
          }
        }
        defaultFonds = fondsFromNote || 0;
      } else {
        // No previous session, use 0 as default
        defaultFonds = 0;
      }
    }


    const session = await prisma.sessionCaisse.create({
      data: {
        posId: posId ? parseInt(posId) : 1,
        userId: req.user.id,
        depotId: targetDepotId,
        openingFund: defaultFonds,
        expectedCash: defaultFonds,
        note: note || null
      },
      include: {
        user: { select: { firstName: true, lastName: true } },
        depot: { select: { name: true, code: true } }
      }
    });

    await logAudit(req.user?.id, 'session_caisse', session.id, 'CREATE', null, {
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

// Open new session by depot only (no user linkage)
router.post('/open-by-depot', authenticateToken, requireRole(['ADMIN', 'MANAGER', 'CASHIER']), async (req, res) => {
  try {
    const { openingFund, posId, note, depotId } = req.body;

    // Default openingFund to 0 if not provided
    const fund = openingFund !== undefined && openingFund !== null ? openingFund : 0;
    if (fund < 0) {
      return res.status(400).json({ error: 'Fonds de caisse doit être positif ou zéro' });
    }

    // Enforce depot isolation first
    const userDepotId = req.user?.depotId;
    // Check visiting depot from header
    const visitingDepotHeader = req.headers['x-depot-id'];
    const visitingDepotId = visitingDepotHeader ? parseInt(visitingDepotHeader) : null;
    
    let targetDepotId = userDepotId || visitingDepotId;
    
    if (req.user?.role === 'ADMIN') {
      // Admin can specify depot, but must be valid
      if (depotId) {
        const requestedDepot = await prisma.depot.findFirst({ 
          where: { id: parseInt(depotId), isActive: true, type: 'SHOP' } 
        });
        if (requestedDepot) {
          targetDepotId = requestedDepot.id;
        } else {
          return res.status(400).json({ error: 'Invalid or inactive depot specified' });
        }
      } else if (!targetDepotId) {
        // Admin without depot assignment - find first active SHOP depot
        const defaultDepot = await prisma.depot.findFirst({ 
          where: { isActive: true, type: 'SHOP' }, orderBy: { id: 'asc' }
        });
        if (defaultDepot) {
          targetDepotId = defaultDepot.id;
        } else {
          return res.status(400).json({ error: 'Aucun dépôt SHOP actif disponible pour ouvrir une session.' });
        }
      }
    } else {
      // For MANAGER and CASHIER, check depot access
      if (depotId) {
        const requestedDepotId = parseInt(depotId);
        // Allow if accessing own depot
        if (userDepotId && requestedDepotId === userDepotId) {
          targetDepotId = requestedDepotId;
        }
        // Allow if accessing visiting depot
        else if (visitingDepotId && requestedDepotId === visitingDepotId) {
          targetDepotId = requestedDepotId;
      }
        // Allow if user has no depot assigned but valid depot is requested
        else if (!userDepotId) {
          const requestedDepot = await prisma.depot.findFirst({
            where: { id: requestedDepotId, isActive: true, type: 'SHOP' }
          });
          if (requestedDepot) {
            targetDepotId = requestedDepotId;
          } else {
            return res.status(400).json({ error: 'Invalid or inactive depot specified' });
          }
        }
        // Deny if trying to access different depot
        else {
        return res.status(403).json({ error: 'Access denied: Cannot create session for different depot' });
        }
      } else if (!targetDepotId) {
        // User without depot assignment - find first active SHOP depot
        const defaultDepot = await prisma.depot.findFirst({ 
          where: { isActive: true, type: 'SHOP' }, orderBy: { id: 'asc' }
        });
        if (defaultDepot) {
          targetDepotId = defaultDepot.id;
        } else {
          return res.status(400).json({ error: 'Aucun dépôt SHOP actif disponible pour ouvrir une session.' });
        }
      }
    }

    // Check if there's already an open session FOR THIS SPECIFIC DEPOT (no user linkage)
    const existingSession = await prisma.sessionCaisse.findFirst({
      where: {
        posId: posId ? parseInt(posId) : 1,
        depotId: targetDepotId, // CRITICAL: Filter by depot only
        status: 'OPEN'
      }
    });

    if (existingSession) {
      return res.status(400).json({ error: 'Une session est déjà ouverte pour ce dépôt' });
    }

    // Get last session's fonds as default if not provided (0 is valid)
    let defaultFonds = fund; // Use the validated fund from above
    if (openingFund === undefined || openingFund === null) {
      const lastSession = await prisma.sessionCaisse.findFirst({
        where: {
          posId: posId ? parseInt(posId) : 1,
          depotId: targetDepotId, // CRITICAL: Filter by depot only
          status: 'CLOSED'
        },
        orderBy: { closedAt: 'desc' }
      });
      
      if (lastSession) {
        // Try to extract fonds from the last session's note
        let fondsFromNote = 0;
        if (lastSession.note && lastSession.note.includes('Fonds pour prochaine session:')) {
          const match = lastSession.note.match(/Fonds pour prochaine session: ([\d.]+)/);
          if (match) {
            fondsFromNote = parseFloat(match[1]);
          }
        }
        defaultFonds = fondsFromNote || 0;
      } else {
        // No previous session, use 0 as default
        defaultFonds = 0;
      }
    }

    const session = await prisma.sessionCaisse.create({
      data: {
        posId: posId ? parseInt(posId) : 1,
        userId: req.user?.id, // Still track who opened it for audit purposes
        depotId: targetDepotId,
        openingFund: defaultFonds,
        expectedCash: defaultFonds,
        note: note || null
      },
      include: {
        user: { select: { firstName: true, lastName: true } },
        depot: { select: { name: true, code: true } }
      }
    });

    await logAudit(req.user?.id, 'session_caisse', session.id, 'CREATE', null, {
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
    console.error('Error opening session by depot:', error);
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

    // Enforce depot isolation for session movements
    const userDepotId = req.user.depotId;
    if (!userDepotId) {
      return res.status(400).json({ error: 'User must be assigned to a depot to add session movements' });
    }
    
    const session = await prisma.sessionCaisse.findFirst({
      where: {
        id: parseInt(id),
        userId: req.user.id,
        depotId: userDepotId, // Ensure depot isolation
        status: { in: ['OPEN', 'REOPENED'] }
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

    await logAudit(req.user?.id, 'cash_movements', movement.id, 'CREATE', null, {
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
    
    // Enforce depot isolation - use visiting depot or user's depot
    const userDepotId = req.user?.depotId;
    const visitingDepotHeader = req.headers['x-depot-id'];
    const visitingDepotId = visitingDepotHeader ? parseInt(visitingDepotHeader) : null;
    
    // Determine which depot to use: visiting > user's depot
    let targetDepotId = visitingDepotId || userDepotId;
    
    if (!targetDepotId) {
      return res.status(400).json({ error: 'User must be assigned to a depot or specify depotId to view session summaries' });
    }
    
    // For non-admin users, check depot access
    if (req.user?.role !== 'ADMIN') {
      // Allow if accessing own depot
      if (targetDepotId && userDepotId && targetDepotId === userDepotId) {
        // OK - accessing own depot
      }
      // Allow if accessing visiting depot
      else if (targetDepotId && visitingDepotId && targetDepotId === visitingDepotId) {
        // OK - accessing visiting depot
      }
      // Allow if user has no depot assigned but valid depot is requested
      else if (!userDepotId && targetDepotId) {
        // Check if depot exists and is active
        const depot = await prisma.depot.findFirst({
          where: { id: targetDepotId, isActive: true }
        });
        if (!depot) {
          return res.status(403).json({ error: 'Invalid depot specified' });
        }
      }
      // Deny if trying to access different depot
      else if (targetDepotId && userDepotId && targetDepotId !== userDepotId) {
        return res.status(403).json({ error: 'Access denied: Cannot access other depot sessions' });
      }
    }
    
    const session = await prisma.sessionCaisse.findFirst({
      where: {
        id: parseInt(id),
        depotId: targetDepotId // Ensure depot isolation
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
    const { countedCash, fonds, retraitCentrale, denominations, isAdminCorrection } = req.body;

    if (!countedCash || countedCash < 0) {
      return res.status(400).json({ error: 'Espèces comptées requises et doivent être positives' });
    }

    // Enforce depot isolation - use visiting depot or user's depot
    const userDepotId = req.user?.depotId;
    const visitingDepotHeader = req.headers['x-depot-id'];
    const visitingDepotId = visitingDepotHeader ? parseInt(visitingDepotHeader) : null;
    
    // Determine which depot to use: visiting > user's depot
    let targetDepotId = visitingDepotId || userDepotId;
    
    if (!targetDepotId) {
      return res.status(400).json({ error: 'User must be assigned to a depot or specify depotId to close sessions' });
    }
    
    // For non-admin users, check depot access
    if (req.user?.role !== 'ADMIN') {
      // Allow if accessing own depot
      if (targetDepotId && userDepotId && targetDepotId === userDepotId) {
        // OK - accessing own depot
      }
      // Allow if accessing visiting depot
      else if (targetDepotId && visitingDepotId && targetDepotId === visitingDepotId) {
        // OK - accessing visiting depot
      }
      // Allow if user has no depot assigned but valid depot is requested
      else if (!userDepotId && targetDepotId) {
        // Check if depot exists and is active
        const depot = await prisma.depot.findFirst({
          where: { id: targetDepotId, isActive: true }
        });
        if (!depot) {
          return res.status(403).json({ error: 'Invalid depot specified' });
        }
      }
      // Deny if trying to access different depot
      else if (targetDepotId && userDepotId && targetDepotId !== userDepotId) {
        return res.status(403).json({ error: 'Access denied: Cannot close sessions from other depot' });
      }
    }
    
    const session = await prisma.sessionCaisse.findFirst({
      where: {
        id: parseInt(id),
        depotId: targetDepotId, // Ensure depot isolation
        status: { in: ['OPEN', 'REOPENED'] }
      }
    });

    if (!session) {
      return res.status(404).json({ error: 'Session non trouvée ou déjà fermée' });
    }

    const summary = await calculateSessionSummary(parseInt(id));
    const originalVariance = parseFloat(countedCash) - parseFloat(summary.expectedCash);
    
    // For admin corrections, we want to show the actual variance from the original expected amount
    // For regular closures, we use the calculated variance
    const finalVariance = isAdminCorrection ? originalVariance : originalVariance;
    
    // Debug logging
    console.log('Session Close Debug:', {
      sessionId: parseInt(id),
      countedCash: parseFloat(countedCash),
      originalExpectedCash: parseFloat(summary.expectedCash),
      finalExpectedCash: isAdminCorrection ? parseFloat(countedCash) : parseFloat(summary.expectedCash),
      calculatedVariance: originalVariance,
      finalVariance: finalVariance,
      isAdminCorrection,
      fondsForNextSession: isAdminCorrection ? parseFloat(countedCash) : fonds,
      sessionData: {
        openingFund: session.openingFund,
        currentExpectedCash: session.expectedCash,
        currentCountedCash: session.countedCash,
        currentOriginalCountedCash: session.originalCountedCash
      },
      summaryData: {
        cashSales: summary.cashSales,
        entree: summary.entree,
        sortie: summary.sortie,
        totalSales: summary.totalSales
      }
    });
    
    // Check variance threshold (but we will still require approval for all closures)
    const settings = await getClotureSettings();
    const varianceExceedsThreshold = Math.abs(finalVariance) > settings.varianceThreshold;
    const requiresApproval = !isAdminCorrection; // Admin corrections don't require approval

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

      // For admin corrections, we need to add the adjustment to the current cash register
      // instead of setting the absolute value
      let finalCountedCash = parseFloat(countedCash);
      let missingAmount = 0;
      let expectedToReceive = 0;
      let actuallyReceived = 0;
      let originalWithdrawalAttempt = 0;
      let expectedToRemain = 0;
      let shouldActuallyRemain = 0;
      let withdrawalAttempt = 0;
      
      if (isAdminCorrection) {
        // The correctedAmount represents what the cash register should contain after correction
        // So we use it directly as the final counted cash
        
        // Calculate the missing amount that should stay in cash
        // Rule: missing amount = attempted withdrawal - actually received
        // Source of truth: latest reopen snapshot values
        let reopenSnapshot = null;
        try {
          // Find the latest reopen change request for this session
          const latestReopen = await tx.changeRequest.findFirst({
            where: {
              entityId: parseInt(id),
              entityType: 'SESSION_CAISSE',
              type: 'SESSION_REOPEN',
              status: 'APPROVED'
            },
            orderBy: { approvedAt: 'desc' }
          });
          
          if (latestReopen && latestReopen.rejectionNotes) {
            reopenSnapshot = JSON.parse(latestReopen.rejectionNotes);
          }
        } catch (e) {
          console.error('Error parsing reopen snapshot:', e);
        }
        
        if (reopenSnapshot) {
          // Use reopen snapshot values
          withdrawalAttempt = parseFloat(reopenSnapshot.attemptedWithdrawal);
          const soldeAfterCloture = parseFloat(reopenSnapshot.newExpectedCash);
          actuallyReceived = parseFloat(countedCash); // What was actually received
          // Single formula: New solde = solde (after cloture) + (cloture - correction)
          missingAmount = withdrawalAttempt - actuallyReceived; // Can be positive or negative
        } else {
          // Fallback to current calculation if no reopen snapshot found
          const originalExpectedCash = parseFloat(session.originalExpectedCash || summary.expectedCash);
          const soldeAfterCloture = parseFloat(summary.expectedCash);
          withdrawalAttempt = originalExpectedCash - soldeAfterCloture;
          actuallyReceived = parseFloat(countedCash);
          // Single formula: New solde = solde (after cloture) + (cloture - correction)
          missingAmount = withdrawalAttempt - actuallyReceived; // Can be positive or negative
        }
        
        // Debug logging
        const soldeAfterCloture = reopenSnapshot ? parseFloat(reopenSnapshot.newExpectedCash) : parseFloat(summary.expectedCash);
        console.log('Admin Correction Debug:', {
          reopenSnapshot,
          withdrawalAttempt,
          actuallyReceived,
          missingAmount,
          soldeAfterCloture,
          expectedNewBalance: soldeAfterCloture + missingAmount
        });
        
        // The missing amount will be added to the current open session below
      }

      // Update session
      const updatedSession = await tx.sessionCaisse.update({
        where: { id: parseInt(id) },
        data: {
          status: isAdminCorrection ? 'ADMIN_CORRECTED' : 'CLOSED',
          closedAt: new Date(),
          countedCash: finalCountedCash,
          originalCountedCash: isAdminCorrection ? (session.originalCountedCash || session.countedCash) : session.originalCountedCash, // Store original counted cash before admin correction
          expectedCash: isAdminCorrection ? finalCountedCash : summary.expectedCash, // For admin corrections, set expected cash to final counted cash
          variance: finalVariance, // Show the actual variance from original expected amount
          zSeq: session.zSeq + 1,
          note: isAdminCorrection ? `Fonds pour prochaine session: ${finalCountedCash} (Correction admin)` : (fonds ? `Fonds pour prochaine session: ${fonds}` : session.note)
        }
      });

      // Handle change requests based on correction type
      if (isAdminCorrection) {
        // For admin corrections, update the existing rejected change request to show it was corrected
        await tx.changeRequest.updateMany({
          where: {
            entityId: parseInt(id),
            entityType: 'SESSION_CAISSE',
            type: 'VARIANCE_APPROVAL',
            status: 'REJECTED'
          },
          data: {
            status: 'APPROVED',
            approvedBy: req.user.id,
            approvedAt: new Date(),
            reason: `Clôture corrigée par admin - ${session.reason || 'Correction effectuée'}`,
            rejectionNotes: 'Correction effectuée par administrateur'
          }
        });
      } else {
        // For regular closures, create new change request
        const cr = await tx.changeRequest.create({
          data: {
            type: 'VARIANCE_APPROVAL',
            entityId: parseInt(id),
            entityType: 'SESSION_CAISSE',
            reason: varianceExceedsThreshold
              ? `Écart de ${finalVariance.toFixed(3)} DT dépasse le seuil de ${settings.varianceThreshold} DT`
              : `Clôture à approuver (écart: ${finalVariance.toFixed(3)} DT, seuil: ${settings.varianceThreshold} DT)`,
            requestedBy: req.user.id
          }
        });
        // Fire Web Push to all admins/managers (simple broadcast)
        try {
          const { sendPushToAll } = require('../lib/push');
          await sendPushToAll({
            title: 'Clôture à valider',
            body: `Session #${id} — ${session.user?.firstName || ''} ${session.user?.lastName || ''} • ${session.depot?.name || ''}`.trim(),
            data: { type: 'CLOTURE', id: cr.id, sessionId: parseInt(id) }
          });
        } catch (e) { /* noop */ }
      }

      // For admin corrections, handle the open session update within the transaction
      let updatedOpenSession = null;
      if (isAdminCorrection) {
        // Find the existing open session for this user and POS
        const existingOpenSession = await tx.sessionCaisse.findFirst({
          where: {
            userId: session.userId,
            posId: session.posId,
            status: 'OPEN'
          }
        });

        if (existingOpenSession && missingAmount !== 0) {
          // Apply the correction to the current open session (actual cash balance)
          await tx.cashMovement.create({
            data: {
              sessionId: existingOpenSession.id,
              type: missingAmount > 0 ? 'ENTREE' : 'SORTIE', // Add if positive, remove if negative
              amount: Math.abs(missingAmount), // Always positive amount
              reason: `Correction admin ${missingAmount > 0 ? '+' : ''}${missingAmount.toFixed(3)} DT (Tentative: ${withdrawalAttempt.toFixed(3)} DT, Reçu: ${actuallyReceived.toFixed(3)} DT)`,
              ticketId: null,
              createdById: req.user.id
            }
          });
          
          // Also add to the closed session for print report (same amount, same reason)
          await tx.cashMovement.create({
            data: {
              sessionId: parseInt(id),
              type: missingAmount > 0 ? 'ENTREE' : 'SORTIE', // Add if positive, remove if negative
              amount: Math.abs(missingAmount), // Always positive amount
              reason: `Correction admin ${missingAmount > 0 ? '+' : ''}${missingAmount.toFixed(3)} DT (Tentative: ${withdrawalAttempt.toFixed(3)} DT, Reçu: ${actuallyReceived.toFixed(3)} DT)`,
              ticketId: null,
              createdById: req.user.id
            }
          });
        }
        
        if (existingOpenSession) {
          // Update the existing open session with corrected balance
          updatedOpenSession = await tx.sessionCaisse.update({
            where: { id: existingOpenSession.id },
            data: {
              note: 'Session mise à jour après correction admin'
            },
            include: {
              user: { select: { firstName: true, lastName: true } },
              depot: { select: { name: true, code: true } }
            }
          });
        }
      }

      return { session: updatedSession, updatedOpenSession };
    });

    await logAudit(req.user?.id, 'session_caisse', parseInt(id), 'UPDATE', session, {
      status: 'CLOSED',
      countedCash: parseFloat(countedCash),
      variance: finalVariance
    });

    // Calculate remaining balance after withdrawal
    const withdrawalAmount = retraitCentrale ? parseFloat(retraitCentrale) : 0;
    const remainingBalance = parseFloat(countedCash) - withdrawalAmount;

    // Generate Z report data with withdrawal information
    const zReportData = await generateZReport(parseInt(id), {
      withdrawalAmount,
      remainingBalance,
      countedCash: parseFloat(countedCash)
    });

    // Handle post-transaction admin correction tasks
    if (isAdminCorrection && result.updatedOpenSession) {
      try {
        await logAudit(req.user?.id, 'session_caisse', result.updatedOpenSession.id, 'UPDATE', null, {
          posId: result.updatedOpenSession.posId,
          openingFund: result.updatedOpenSession.openingFund,
          note: result.updatedOpenSession.note,
          reason: 'Updated after admin correction'
        });

        // Emit socket notification for updated session
        if (req.app.get('io')) {
          req.app.get('io').emit('session_updated', {
            sessionId: result.updatedOpenSession.id,
            userId: result.updatedOpenSession.userId,
            posId: result.updatedOpenSession.posId,
            openingFund: result.updatedOpenSession.openingFund,
            updatedAt: result.updatedOpenSession.updatedAt,
            reason: 'Updated after admin correction'
          });
        }
      } catch (error) {
        console.error('Error updating open session after admin correction:', error);
        // Don't fail the main operation if updating fails
      }
    }

    // Emit socket notification
    if (req.app.get('io')) {
      req.app.get('io').emit('session_closed', {
        sessionId: parseInt(id),
        userId: session.userId,
        posId: session.posId,
        variance: finalVariance,
        requiresApproval: requiresApproval,
        closedAt: result.closedAt,
        withdrawalAmount,
        remainingBalance,
        isAdminCorrection,
        updatedOpenSessionId: result.updatedOpenSession?.id,
        totals: {
          expectedCash: summary.expectedCash,
          countedCash: parseFloat(countedCash),
          totalSales: summary.totalSales,
          totalTickets: summary.totalTickets
        }
      });
    }

    res.json({
      session: result.session,
      zReport: zReportData,
      requiresApproval,
      variance: finalVariance,
      withdrawalAmount,
      remainingBalance,
      updatedOpenSession: result.updatedOpenSession
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

    console.log('Sessions GET request - User:', req.user);
    console.log('Sessions GET request - Query params:', { startDate, endDate, userId, posId, status, hasVariance, page, limit });

    // Enforce depot isolation for session history
    const userDepotId = req.user.depotId;
    if (!userDepotId) {
      return res.status(400).json({ error: 'User must be assigned to a depot to view session history' });
    }
    
    const whereClause = {
      depotId: userDepotId // Always filter by user's depot for isolation
    };
    
    // Admin can see all sessions from their depot, others only their own
    if (req.user?.role !== 'ADMIN') {
      whereClause.userId = req.user?.id;
    } else if (userId) {
      whereClause.userId = parseInt(userId);
    }

    if (startDate && endDate) {
      // Parse dates and set time to start/end of day to ensure proper filtering
      // If date is in format YYYY-MM-DD, append time to avoid timezone issues
      const startDateStr = startDate.includes('T') ? startDate : `${startDate}T00:00:00.000`;
      const endDateStr = endDate.includes('T') ? endDate : `${endDate}T23:59:59.999`;
      
      const start = new Date(startDateStr);
      const end = new Date(endDateStr);
      
      console.log('Date range filter - startDate:', startDate, 'parsed as:', start);
      console.log('Date range filter - endDate:', endDate, 'parsed as:', end);
      
      whereClause.openedAt = { 
        gte: start, 
        lte: end 
      };
    }

    if (posId) whereClause.posId = parseInt(posId);
    if (status) whereClause.status = status;
    if (hasVariance === 'true') {
      whereClause.variance = { not: 0 };
    }

    console.log('Sessions query whereClause:', whereClause);

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

    console.log('Found sessions:', sessions.length);
    if (sessions.length > 0) {
      console.log('First session:', { id: sessions[0].id, openedAt: sessions[0].openedAt, status: sessions[0].status });
    }

    res.json(sessions);
  } catch (error) {
    console.error('Error fetching sessions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get sessions with aggregated sales data for cash statements
router.get('/summaries', authenticateToken, async (req, res) => {
  try {
    const { 
      startDate, 
      endDate, 
      userId, 
      posId, 
      status,
      depotId
    } = req.query;

    // Enforce depot isolation - use visiting depot or user's depot
    const userDepotId = req.user?.depotId;
    const visitingDepotHeader = req.headers['x-depot-id'];
    const visitingDepotId = visitingDepotHeader ? parseInt(visitingDepotHeader) : null;
    
    // Determine which depot to use: requested > visiting > user's depot
    let targetDepotId = depotId ? parseInt(depotId) : (visitingDepotId || userDepotId);
    
    if (!targetDepotId) {
      return res.status(400).json({ error: 'User must be assigned to a depot or specify depotId to view session summaries' });
    }

    // For non-admin users, check depot access
    if (req.user?.role !== 'ADMIN') {
      // Allow if accessing own depot
      if (targetDepotId && userDepotId && targetDepotId === userDepotId) {
        // OK - accessing own depot
      }
      // Allow if accessing visiting depot
      else if (targetDepotId && visitingDepotId && targetDepotId === visitingDepotId) {
        // OK - accessing visiting depot
      }
      // Allow if user has no depot assigned but valid depot is requested
      else if (!userDepotId && targetDepotId) {
        // Check if depot exists and is active
        const depot = await prisma.depot.findFirst({
          where: { id: targetDepotId, isActive: true }
        });
        if (!depot) {
          return res.status(403).json({ error: 'Invalid depot specified' });
        }
      }
      // Deny if trying to access different depot
      else if (targetDepotId && userDepotId && targetDepotId !== userDepotId) {
        return res.status(403).json({ error: 'Access denied: Cannot access other depot sessions' });
      }
    }
    
    const whereClause = {
      depotId: targetDepotId
    };
    
    // Admin can see all sessions from their depot, others only their own
    if (req.user?.role !== 'ADMIN') {
      whereClause.userId = req.user?.id;
    } else if (userId) {
      whereClause.userId = parseInt(userId);
    }

    if (startDate && endDate) {
      // Parse dates and set time to start/end of day to ensure proper filtering
      // If date is in format YYYY-MM-DD, append time to avoid timezone issues
      const startDateStr = startDate.includes('T') ? startDate : `${startDate}T00:00:00.000`;
      const endDateStr = endDate.includes('T') ? endDate : `${endDate}T23:59:59.999`;
      
      const start = new Date(startDateStr);
      const end = new Date(endDateStr);
      
      console.log('Date range filter - startDate:', startDate, 'parsed as:', start);
      console.log('Date range filter - endDate:', endDate, 'parsed as:', end);
      
      whereClause.openedAt = { 
        gte: start, 
        lte: end 
      };
    }

    if (posId) whereClause.posId = parseInt(posId);
    if (status) whereClause.status = status;

    const sessions = await prisma.sessionCaisse.findMany({
      where: whereClause,
      include: {
        user: { select: { firstName: true, lastName: true } },
        depot: { select: { name: true, code: true } },
        cashMovements: {
          orderBy: { createdAt: 'desc' }
        }
      },
      orderBy: { openedAt: 'desc' }
    });

    // Get aggregated sales data for each session
    const sessionIds = sessions.map(s => s.id);
    
    if (sessionIds.length === 0) {
      return res.json([]);
    }

    // Get sales aggregated by session
    const salesAggregation = await prisma.sale.groupBy({
      by: ['sessionId', 'paymentMethodId'],
      where: {
        sessionId: { in: sessionIds },
        status: 'COMPLETED'
      },
      _sum: {
        finalTotal: true
      },
      _count: {
        id: true
      }
    });

    // Get payment methods for reference
    const paymentMethods = await prisma.paymentMethod.findMany({
      select: { id: true, name: true, type: true }
    });

    const paymentMethodMap = paymentMethods.reduce((acc, pm) => {
      acc[pm.id] = pm;
      return acc;
    }, {});

    // Group sales by session
    const salesBySession = salesAggregation.reduce((acc, sale) => {
      if (!acc[sale.sessionId]) {
        acc[sale.sessionId] = {
          totalSales: 0,
          cashSales: 0,
          cardSales: 0,
          otherSales: 0,
          salesCount: 0,
          salesByPaymentMethod: {}
        };
      }
      
      const paymentMethod = paymentMethodMap[sale.paymentMethodId];
      const amount = sale._sum.finalTotal || 0;
      
      acc[sale.sessionId].totalSales += amount;
      acc[sale.sessionId].salesCount += sale._count.id;
      
      if (paymentMethod) {
        acc[sale.sessionId].salesByPaymentMethod[paymentMethod.id] = {
          name: paymentMethod.name,
          type: paymentMethod.type,
          amount: amount,
          count: sale._count.id
        };
        
        // Categorize by payment type
        if (paymentMethod.type === 'CASH' || 
            paymentMethod.name.toLowerCase().includes('cash') ||
            paymentMethod.name.toLowerCase().includes('espèces') ||
            paymentMethod.name.toLowerCase().includes('comptant')) {
          acc[sale.sessionId].cashSales += amount;
        } else if (paymentMethod.type === 'CARD' || 
                   paymentMethod.name.toLowerCase().includes('card') ||
                   paymentMethod.name.toLowerCase().includes('carte')) {
          acc[sale.sessionId].cardSales += amount;
        } else {
          acc[sale.sessionId].otherSales += amount;
        }
      }
      
      return acc;
    }, {});

    // Get expenses for the date range and group by session based on date overlap
    const expensesBySession = {};
    
    // Initialize expenses for each session
    sessionIds.forEach(sessionId => {
      expensesBySession[sessionId] = {
        totalExpenses: 0,
        cashExpenses: 0,
        otherExpenses: 0,
        expensesCount: 0
      };
    });

    // Get all expenses in the date range for the depot
    const expenses = await prisma.expense.findMany({
      where: {
        depotId: targetDepotId,
        isPaid: true,
        date: {
          gte: startDate ? new Date(startDate) : undefined,
          lte: endDate ? new Date(endDate) : undefined
        }
      },
      select: {
        id: true,
        amount: true,
        paymentType: true,
        date: true
      }
    });

    // Group expenses by session based on date overlap
    expenses.forEach(expense => {
      const expenseDate = new Date(expense.date);
      
      // Find which session this expense belongs to based on date overlap
      sessions.forEach(session => {
        const sessionStart = new Date(session.openedAt);
        const sessionEnd = session.closedAt ? new Date(session.closedAt) : new Date();
        
        if (expenseDate >= sessionStart && expenseDate <= sessionEnd) {
          const amount = parseFloat(expense.amount) || 0;
          expensesBySession[session.id].totalExpenses += amount;
          expensesBySession[session.id].expensesCount += 1;
          
          if (expense.paymentType === 'CASH') {
            expensesBySession[session.id].cashExpenses += amount;
          } else {
            expensesBySession[session.id].otherExpenses += amount;
          }
        }
      });
    });

    // Combine session data with aggregated sales and expenses
    const sessionsWithSummaries = sessions.map(session => {
      const salesData = salesBySession[session.id] || {
        totalSales: 0,
        cashSales: 0,
        cardSales: 0,
        otherSales: 0,
        salesCount: 0,
        salesByPaymentMethod: {}
      };
      
      const expensesData = expensesBySession[session.id] || {
        totalExpenses: 0,
        cashExpenses: 0,
        otherExpenses: 0,
        expensesCount: 0
      };

      return {
        ...session,
        salesSummary: salesData,
        expensesSummary: expensesData
      };
    });

    res.json(sessionsWithSummaries);
  } catch (error) {
    console.error('Error fetching session summaries:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get session report (X or Z)
router.get('/:id/report', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { type = 'Z', format = 'html' } = req.query;

    // Enforce depot isolation - use visiting depot or user's depot
    const userDepotId = req.user?.depotId;
    const visitingDepotHeader = req.headers['x-depot-id'];
    const visitingDepotId = visitingDepotHeader ? parseInt(visitingDepotHeader) : null;
    
    // Determine which depot to use: visiting > user's depot
    let targetDepotId = visitingDepotId || userDepotId;
    
    if (!targetDepotId) {
      return res.status(400).json({ error: 'User must be assigned to a depot or specify depotId to view session reports' });
    }
    
    // For non-admin users, check depot access
    if (req.user?.role !== 'ADMIN') {
      // Allow if accessing own depot
      if (targetDepotId && userDepotId && targetDepotId === userDepotId) {
        // OK - accessing own depot
      }
      // Allow if accessing visiting depot
      else if (targetDepotId && visitingDepotId && targetDepotId === visitingDepotId) {
        // OK - accessing visiting depot
      }
      // Allow if user has no depot assigned but valid depot is requested
      else if (!userDepotId && targetDepotId) {
        // Check if depot exists and is active
        const depot = await prisma.depot.findFirst({
          where: { id: targetDepotId, isActive: true }
        });
        if (!depot) {
          return res.status(403).json({ error: 'Invalid depot specified' });
        }
      }
      // Deny if trying to access different depot
      else if (targetDepotId && userDepotId && targetDepotId !== userDepotId) {
        return res.status(403).json({ error: 'Access denied: Cannot access other depot session reports' });
      }
    }
    
    const whereClause = {
      id: parseInt(id),
      depotId: targetDepotId // Always filter by target depot for isolation
    };

    const session = await prisma.sessionCaisse.findFirst({
      where: whereClause,
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

    // Enforce depot isolation - use visiting depot or user's depot
    const userDepotId = req.user?.depotId;
    const visitingDepotHeader = req.headers['x-depot-id'];
    const visitingDepotId = visitingDepotHeader ? parseInt(visitingDepotHeader) : null;
    
    // Determine which depot to use: visiting > user's depot
    let targetDepotId = visitingDepotId || userDepotId;
    
    if (!targetDepotId) {
      return res.status(400).json({ error: 'User must be assigned to a depot or specify depotId to reopen sessions' });
    }
    
    // For non-admin users, check depot access (only admins can reopen)
    if (req.user?.role !== 'ADMIN') {
      // Allow if accessing own depot
      if (targetDepotId && userDepotId && targetDepotId === userDepotId) {
        // OK - accessing own depot
      }
      // Allow if accessing visiting depot
      else if (targetDepotId && visitingDepotId && targetDepotId === visitingDepotId) {
        // OK - accessing visiting depot
      }
      // Allow if user has no depot assigned but valid depot is requested
      else if (!userDepotId && targetDepotId) {
        // Check if depot exists and is active
        const depot = await prisma.depot.findFirst({
          where: { id: targetDepotId, isActive: true }
        });
        if (!depot) {
          return res.status(403).json({ error: 'Invalid depot specified' });
        }
      }
      // Deny if trying to access different depot
      else if (targetDepotId && userDepotId && targetDepotId !== userDepotId) {
        return res.status(403).json({ error: 'Access denied: Cannot reopen sessions from other depot' });
      }
    }
    
    const session = await prisma.sessionCaisse.findFirst({
      where: {
        id: parseInt(id),
        depotId: targetDepotId, // Ensure depot isolation
        status: 'CLOSED'
      }
    });

    if (!session) {
      return res.status(404).json({ error: 'Session non trouvée ou déjà ouverte' });
    }

    const result = await prisma.$transaction(async (tx) => {
      // Recalculate expected cash before reopening
      const summary = await calculateSessionSummary(parseInt(id));
      
      // Create change request with reopen snapshot values
      const changeRequest = await tx.changeRequest.create({
        data: {
          type: 'SESSION_REOPEN',
          entityId: parseInt(id),
          entityType: 'SESSION_CAISSE',
          reason: reason,
          requestedBy: req.user.id,
          status: 'APPROVED',
          approvedBy: req.user.id,
          approvedAt: new Date(),
          // Store reopen snapshot values for later correction calculations
          rejectionNotes: JSON.stringify({
            oldExpectedCash: session.expectedCash,
            newExpectedCash: summary.expectedCash,
            attemptedWithdrawal: session.expectedCash - summary.expectedCash
          })
        }
      });
      
      console.log('Session Reopen Debug:', {
        sessionId: parseInt(id),
        oldExpectedCash: session.expectedCash,
        newExpectedCash: summary.expectedCash,
        currentCountedCash: session.countedCash,
        currentOriginalCountedCash: session.originalCountedCash,
        summaryData: {
          cashSales: summary.cashSales,
          entree: summary.entree,
          sortie: summary.sortie,
          totalSales: summary.totalSales
        }
      });
      
      // Reopen session
      const reopenedSession = await tx.sessionCaisse.update({
        where: { id: parseInt(id) },
        data: {
          status: 'REOPENED',
          closedAt: null,
          countedCash: null,
          originalCountedCash: session.countedCash || session.originalCountedCash, // Preserve original counted cash before reopening
          variance: null,
          expectedCash: summary.expectedCash
        }
      });

      return { session: reopenedSession, changeRequest };
    });

    await logAudit(req.user?.id, 'session_caisse', parseInt(id), 'UPDATE', session, {
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
  // First get session to get depotId
  const sessionInfo = await prisma.sessionCaisse.findUnique({
    where: { id: sessionId },
    select: { depotId: true }
  });

  if (!sessionInfo) return null;

  const sessionDepotId = sessionInfo.depotId;
  
  // Load session with sales filtered by depotId
  const session = await prisma.sessionCaisse.findUnique({
    where: { id: sessionId },
    include: {
      sales: {
        where: {
          // CRITICAL: Filter sales by session's depotId to ensure depot isolation
          depotId: sessionDepotId
        },
        include: {
          paymentMethod: true
        }
      },
      cashMovements: true
    }
  });

  if (!session) return null;
  
  // Additional safety: Filter sales by session's depotId after loading (double check)
  if (sessionDepotId && session.sales) {
    const originalCount = session.sales.length;
    session.sales = session.sales.filter(sale => sale.depotId === sessionDepotId);
    const filteredCount = session.sales.length;
    if (originalCount !== filteredCount) {
      console.warn(`[calculateSessionSummary] Filtered sales: ${originalCount} -> ${filteredCount} for session ${sessionId}, depotId: ${sessionDepotId}`);
    }
  }

  // Debug logging removed to reduce console spam

  // Calculate cash from sales (exclude refunded)
  const cashSales = session.sales
    .filter(sale => sale.paymentMethod?.type === 'CASH' && !['REFUNDED','CANCELLED'].includes((sale.status || '').toUpperCase()))
    .reduce((sum, sale) => sum + parseFloat(sale.finalTotal), 0);

  // Calculate cash movements (exclude rejected movements - marked with [REJETÉ] or amount = 0)
  const entree = session.cashMovements
    .filter(m => {
      const reason = String(m.reason || '');
      const amount = parseFloat(m.amount || 0);
      return m.type === 'ENTREE' && !reason.includes('[REJETÉ]') && amount > 0;
    })
    .reduce((sum, m) => sum + parseFloat(m.amount), 0);

  const sortie = session.cashMovements
    .filter(m => {
      const reason = String(m.reason || '');
      const amount = parseFloat(m.amount || 0);
      return ['SORTIE', 'DEPOT_COFFRE', 'RETRAIT_CENTRALE'].includes(m.type) && !reason.includes('[REJETÉ]') && amount > 0;
    })
    .reduce((sum, m) => sum + parseFloat(m.amount), 0);

  // Start expected cash from opening; we'll compute cash from sales as (totalSales - creditOutstanding)
  let expectedCash = parseFloat(session.openingFund);

  // Group sales by payment method
  const salesByPayment = {};
  session.sales.forEach(sale => {
    const method = sale.paymentMethod?.name || 'Non spécifié';
    if (!salesByPayment[method]) {
      salesByPayment[method] = { amount: 0, count: 0 };
    }
    if (!['REFUNDED','CANCELLED'].includes((sale.status || '').toUpperCase())) {
      salesByPayment[method].amount += parseFloat(sale.finalTotal);
      salesByPayment[method].count += 1;
    }
  });

  // Calculate outstanding credit from client debt transactions tied to this session's sales
  let creditOutstanding = 0;
  let creditCount = 0;
  let creditAdvancePaid = 0;
  try {
    const debtTransactions = await prisma.clientDebtTransaction.findMany({
      where: {
        type: 'DEBT',
        sale: {
          sessionId: sessionId
        }
      },
      select: { amount: true, saleId: true }
    });
    creditOutstanding = debtTransactions.reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);
    creditCount = debtTransactions.length;

    // Compute advances per sale: finalTotal - DEBT sum for that sale (only for CREDIT sales)
    const debtBySaleId = debtTransactions.reduce((map, t) => {
      const sid = t.saleId;
      const amt = parseFloat(t.amount || 0) || 0;
      map[sid] = (map[sid] || 0) + amt;
      return map;
    }, {});

    session.sales.forEach(sale => {
      if ((sale.paymentType || '').toUpperCase() === 'CREDIT') {
        const total = parseFloat(sale.finalTotal || 0) || 0;
        const debtForSale = debtBySaleId[sale.id] || 0;
        const paid = Math.max(0, total - debtForSale);
        creditAdvancePaid += paid;
      }
    });
  } catch (e) {
    // Fallback: keep previous behavior if relation is not available
    session.sales.forEach(sale => {
      if ((sale.paymentType || '').toUpperCase() === 'CREDIT') {
        const total = parseFloat(sale.finalTotal || 0);
        const advance = parseFloat(sale.advancePayment || 0);
        const outstanding = Math.max(0, total - advance);
        if (outstanding > 0) {
          creditOutstanding += outstanding;
          creditCount += 1;
        }
        creditAdvancePaid += advance;
      }
    });
  }
  if (creditOutstanding > 0) {
    salesByPayment['CREDIT'] = {
      amount: creditOutstanding,
      count: creditCount
    };
  }

  // Removed subtraction of creditOutstanding to avoid double-counting since cashSales excludes credits
  // expectedCash = expectedCash - creditOutstanding;

  // Include approved CASH expenses within the session timeframe ONLY if no explicit cash movement was created (avoid double subtraction)
  let cashExpenseTotal = 0;
  let expensesDetails = [];
  let approvedCashExpenses = []; // Declare outside try block for access later
  try {
    const sessionStart = new Date(session.openedAt);
    const sessionEnd = session.closedAt ? new Date(session.closedAt) : new Date();

    // Fetch cash expenses in session window - use depot and time-based filtering
    // For open sessions, include ALL expenses created during session (approved or not)
    // For closed sessions, only include approved expenses
    // Exclude rejected expenses (isRejected: false or not set)
    // CRITICAL: Include PAID expenses (isPaid = true) AND partial payments (isAdvance = true)
    // Credit expenses (isPaid = false AND isAdvance = false) should NOT affect cash register closure
    const whereClause = {
      isRejected: false, // Exclude rejected expenses
      paymentType: 'CASH',
      depotId: session.depotId, // Filter by depot instead of user
      createdAt: { gte: sessionStart, lte: sessionEnd }, // Restrict to session window
      OR: [
        { isPaid: true }, // Fully paid expenses
        { isAdvance: true } // Partial payments (advance)
      ]
    };
    
    // For closed sessions, only include approved expenses
    // For open sessions, include all expenses (approved or not) to show complete details
    if (session.status !== 'OPEN') {
      whereClause.isApproved = true;
    }
    
    approvedCashExpenses = await prisma.expense.findMany({
      where: whereClause,
      select: { id: true, amount: true, approvedAt: true, createdAt: true, date: true, notes: true, isApproved: true, isPaid: true, isAdvance: true, category: { select: { name: true } }, supplier: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' }
    });
    
    // Debug logging removed to reduce console spam

    // Build a set of expense IDs that already created a cash movement in this session
    const expenseIdsWithMovement = new Set();
    // Match patterns like "Dépense #123" or "Dépense approuvée #123" or "Dépense #123: ..."
    // Match both "Dépense #123" and "Dépense #123:" (with or without colon)
    const expenseRegex = /Dépense(?: approuvée)?\s*#(\d+)/i;
    (session.cashMovements || []).forEach(m => {
      const reason = String(m.reason || '');
      const amount = parseFloat(m.amount || 0);
      // Skip rejected movements (marked with [REJETÉ] or amount = 0)
      if (reason.includes('[REJETÉ]') || amount === 0) return;
      
      // Try to extract expense ID from reason
      const match = reason.match(expenseRegex);
      if (match && match[1]) {
        const idParsed = parseInt(match[1]);
        if (!isNaN(idParsed)) {
          expenseIdsWithMovement.add(idParsed);
          // Debug logging removed to reduce console spam
        }
      } else {
        // Debug logging removed to reduce console spam
      }
    });
    
    // Debug logging removed to reduce console spam

    // CRITICAL: Only count expenses that DON'T have a cash movement to avoid double counting
    // Expenses with cash movements are already counted in the sortie calculation
    // For partial payments (isAdvance = true), only count the paid amount (extracted from notes)
    const expensesWithoutMovement = approvedCashExpenses.filter(e => !expenseIdsWithMovement.has(e.id));
    cashExpenseTotal = expensesWithoutMovement.reduce((sum, e) => {
      const totalAmount = parseFloat(e.amount || 0);
      
      // For partial payments (advance), extract paid amount from notes
      if (e.isAdvance && e.notes && e.notes.includes('Paiement partiel:')) {
        const match = e.notes.match(/Paiement partiel:\s*(\d+(?:\.\d+)?)dt payé/);
        if (match) {
          const paidAmount = parseFloat(match[1]);
          return sum + paidAmount; // Only count the paid portion
        }
      }
      
      // For fully paid expenses, count the full amount
      return sum + totalAmount;
    }, 0);

    // Build UI details for ALL approved cash expenses (for display purposes)
    // Show ALL expenses, even if they have cash movements, so user can see complete details
    const allExpenseDetails = approvedCashExpenses
      .map(e => {
        const categoryPart = e.category?.name ? ` · ${e.category.name}` : '';
        const supplierPart = e.supplier?.name ? ` · Fournisseur: ${e.supplier.name}` : '';
        const notesPart = e.notes ? ` · ${e.notes}` : '';
        const hasMovement = expenseIdsWithMovement.has(e.id);
        return ({
          id: e.id,
          amount: parseFloat(e.amount || 0),
          reason: `Dépense approuvée #${e.id}${categoryPart}${supplierPart}${notesPart}`,
          createdAt: (e.approvedAt || e.createdAt || e.date),
          categoryName: e.category?.name || null,
          supplierName: e.supplier?.name || null,
          notes: e.notes || null,
          hasCashMovement: hasMovement
        });
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Provide details for UI - show ALL expenses for display
    expensesDetails = allExpenseDetails;
    
    // Debug logging removed to reduce console spam

    // CRITICAL FIX: Only subtract expenses that DON'T have a cash movement
    // Expenses with cash movements are already counted in sortie (cashMovements)
    // This prevents double subtraction
    expectedCash = expectedCash - cashExpenseTotal;
    
    // Debug logging removed to reduce console spam
  } catch (e) {}

  // Supplier payments details (for UI display with supplier name)
  // Exclude CREDIT payments as they don't represent actual cash outflows
  let supplierPaymentsDetails = [];
  try {
    const sessionStart = new Date(session.openedAt);
    const sessionEnd = session.closedAt ? new Date(session.closedAt) : new Date();
    const supplierPayments = await prisma.supplierPayment.findMany({
      where: {
        userId: session.userId,
        paymentMethod: { notIn: ['CREDIT'] }, // Exclude CREDIT payments from décaissement
        OR: [
          { paymentDate: { gte: sessionStart, lte: sessionEnd } },
          { createdAt: { gte: sessionStart, lte: sessionEnd } }
        ]
      },
      include: { supplier: { select: { id: true, name: true } } },
      orderBy: { paymentDate: 'desc' }
    });
    supplierPaymentsDetails = supplierPayments.map(p => ({
      id: p.id,
      supplierId: p.supplier?.id || null,
      supplierName: p.supplier?.name || 'Fournisseur',
      amount: parseFloat(p.amount || 0),
      createdAt: p.paymentDate || p.createdAt
    }));
  } catch (e) {}

  // Compute client payments (only standalone PAYMENT debt transactions, no saleId)
  let clientPaymentsTotal = 0;
  let clientPaymentsDetails = [];
  try {
    const sessionStart = new Date(session.openedAt);
    const sessionEnd = session.closedAt ? new Date(session.closedAt) : new Date();
    const standalonePayments = await prisma.clientDebtTransaction.findMany({
      where: {
        type: 'PAYMENT',
        saleId: null, // Only standalone payments (no saleId)
        userId: session.userId,
        createdAt: {
          gte: sessionStart,
          lte: sessionEnd
        }
      },
      include: {
        client: { select: { id: true, firstName: true, lastName: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    clientPaymentsTotal = standalonePayments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
    clientPaymentsDetails = standalonePayments.map(p => ({
      id: p.id,
      amount: parseFloat(p.amount || 0),
      clientId: p.client?.id || null,
      clientName: p.client ? `${p.client.firstName} ${p.client.lastName}`.trim() : 'Client',
      createdAt: p.createdAt
    }));
  } catch (e) {}

  // Add standalone client payments (credit encashments) to expected cash
  expectedCash = expectedCash + clientPaymentsTotal;

  // Compute cash from sales as totalSales - creditOutstanding and add entries then subtract sorties
  const totalSalesAmount = session.sales
    .filter(s => !['REFUNDED','CANCELLED'].includes((s.status || '').toUpperCase()))
    .reduce((sum, sale) => sum + parseFloat(sale.finalTotal), 0);
  const cashFromSalesNetCredit = Math.max(0, totalSalesAmount - creditOutstanding);
  expectedCash = expectedCash + cashFromSalesNetCredit + entree - sortie;

  // Calculate total of ALL expenses for display (not just those without movement)
  // This is different from cashExpenseTotal which excludes expenses with movements to avoid double counting
  const allExpensesTotal = approvedCashExpenses.reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);

  return {
    expectedCash,
    cashSales,
    entree,
    sortie,
    salesByPayment,
    totalSales: session.sales
      .filter(s => !['REFUNDED','CANCELLED'].includes((s.status || '').toUpperCase()))
      .reduce((sum, sale) => sum + parseFloat(sale.finalTotal), 0),
    totalTickets: session.sales.filter(s => !['REFUNDED','CANCELLED'].includes((s.status || '').toUpperCase())).length,
    creditOutstanding,
    creditAdvancePaid,
    clientPaymentsTotal,
    clientPaymentsDetails,
    expensesTotal: allExpensesTotal, // Total of ALL expenses for display
    expensesTotalForCalculation: cashExpenseTotal, // Only expenses without movement (for cash calculation)
    expensesDetails,
    supplierPaymentsDetails
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

async function generateZReport(sessionId, closureData = {}) {
  const session = await prisma.sessionCaisse.findUnique({
    where: { id: sessionId },
    include: {
      user: { select: { firstName: true, lastName: true } },
      depot: { select: { name: true, code: true, address: true, city: true, phone: true } },
      sales: {
        include: {
          paymentMethod: true,
          user: { select: { firstName: true, lastName: true } },
          items: {
            include: {
              product: {
                include: {
                  famille: true
                }
              }
            }
          }
        }
      },
      cashMovements: true
    }
  });
  
  // CRITICAL: Filter sales by session's depotId to ensure depot isolation
  if (session && session.depotId && session.sales) {
    session.sales = session.sales.filter(sale => sale.depotId === session.depotId);
  }

  const summary = await calculateSessionSummary(sessionId);
  // Derive closure amounts from cash movements if not provided (exclude rejected movements)
  const computedWithdrawal = session.cashMovements
    .filter(m => m.type === 'RETRAIT_CENTRALE' && !m.reason?.includes('[REJETÉ]'))
    .reduce((sum, m) => sum + parseFloat(m.amount), 0);
  const finalCounted = session.countedCash != null ? parseFloat(session.countedCash) : undefined;
  const finalRemaining = finalCounted != null ? (finalCounted - computedWithdrawal) : undefined;
  
  // Group sales by families (like daily extract)
  const familyMap = new Map();
  // Exclude cancelled/refunded sales from family breakdown
  const salesForFamilies = session.sales.filter(s => {
    const st = (s.status || '').toUpperCase();
    return st !== 'CANCELLED' && st !== 'REFUNDED';
  });

  salesForFamilies.forEach(item => {
    item.items.forEach(i => {
      const familyName = i.product?.famille?.name || 'Divers';
      const family = familyMap.get(familyName) || { name: familyName, amount: 0 };
      family.amount += parseFloat(i.total || 0);
      familyMap.set(familyName, family)
    });
  });

  const families = Array.from(familyMap.values());

  // Compute per-sale paidAmount by subtracting outstanding DEBT for that sale from finalTotal
  try {
    const saleIds = session.sales.map(s => s.id);
    if (saleIds.length > 0) {
      const debts = await prisma.clientDebtTransaction.findMany({
        where: { type: 'DEBT', saleId: { in: saleIds } },
        select: { saleId: true, amount: true }
      });
      const debtBySaleId = debts.reduce((map, t) => {
        const sid = t.saleId;
        const amt = parseFloat(t.amount || 0) || 0;
        map[sid] = (map[sid] || 0) + amt;
        return map;
      }, {});

      session.sales = session.sales.map(s => {
        const total = parseFloat(s.finalTotal || 0) || 0;
        const debtForSale = debtBySaleId[s.id] || 0;
        const paidAmount = Math.max(0, total - debtForSale);
        return { ...s, paidAmount };
      });
    } else {
      session.sales = session.sales.map(s => ({ ...s, paidAmount: parseFloat(s.finalTotal || 0) || 0 }));
    }
  } catch (e) {
    // Fallback: mark cash sales as fully paid; others as zero paid
    session.sales = session.sales.map(s => ({
      ...s,
      paidAmount: (s.paymentMethod?.type || '').toUpperCase() === 'CASH' ? (parseFloat(s.finalTotal || 0) || 0) : 0
    }));
  }

  // Ensure session-local ticket number is present for client display
  session.sales = session.sales.map(s => ({
    ...s,
    dailyTicketNumber: s.dailyTicketNumber ?? s.sessionTicketNumber ?? s.ticketNumber ?? s.numero ?? s.sessionIndex ?? s.sessionSeq ?? s.id
  }));

  return {
    session: {
      id: session.id,
      openedAt: session.openedAt,
      closedAt: session.closedAt,
      user: session.user,
      depot: session.depot,
      sales: session.sales,
      cashMovements: session.cashMovements
    },
    summary: {
      ...summary,
      computedWithdrawal,
      finalRemaining,
      countedCash: closureData.countedCash ?? finalCounted ?? 0
    },
    families
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
    escpos += `${method}: ${data.amount.toFixed(3)} DT (${data.count} tickets)\n`;
  });
  escpos += `\nTotal: ${summary.totalSales.toFixed(3)} DT\n`;
  escpos += `Tickets: ${summary.totalTickets}\n\n`;
  
  escpos += 'MOUVEMENTS CAISSE\n';
  escpos += '=================\n';
  session.cashMovements
    .filter(m => !m.reason?.includes('[REJETÉ]')) // Exclude rejected movements from print
    .forEach(movement => {
      escpos += `${movement.type}: ${movement.amount.toFixed(3)} DT\n`;
      escpos += `  ${movement.reason}\n`;
    });
  escpos += '\n';
  
  escpos += 'COMPTAGE ESPÈCES\n';
  escpos += '================\n';
  escpos += `Fonds de caisse: ${session.openingFund.toFixed(3)} DT\n`;
  escpos += `Espèces attendues: ${summary.expectedCash.toFixed(3)} DT\n`;
  if (session.countedCash) {
    escpos += `Espèces comptées: ${session.countedCash.toFixed(3)} DT\n`;
    escpos += `Écart: ${session.variance.toFixed(3)} DT\n`;
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
      defaultFonds: settings?.defaultFonds || 0.0,
      denominations: settings?.denominations || [50, 20, 10, 5, 2, 1, 0.5, 0.2, 0.1, 0.05],
      requireApprovalForVariance: settings?.requireApprovalForVariance !== false,
      ticketWidth: settings?.ticketWidth || 58,
      droitDeTimbre: settings?.droitDeTimbre || false
    };
  } catch (error) {
    return {
      varianceThreshold: 5.0,
      defaultFonds: 0.0,
      denominations: [50, 20, 10, 5, 2, 1, 0.5, 0.2, 0.1, 0.05],
      requireApprovalForVariance: true,
      ticketWidth: 58,
      droitDeTimbre: false
    };
  }
}

module.exports = router;
