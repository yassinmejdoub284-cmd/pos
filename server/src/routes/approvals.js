const express = require('express');
const { prisma } = require('../lib/prisma');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// List change requests (default: variance approvals)
router.get('/change-requests', authenticateToken, async (req, res) => {
  try {
    const { type = 'VARIANCE_APPROVAL', status = 'PENDING', page = 1, limit = 50 } = req.query;

    const where = { type, status };

    const requests = await prisma.changeRequest.findMany({
      where,
      include: {
        requester: { select: { id: true, firstName: true, lastName: true } },
        approver: { select: { id: true, firstName: true, lastName: true } }
      },
      orderBy: { createdAt: 'desc' },
      skip: (parseInt(page) - 1) * parseInt(limit),
      take: parseInt(limit)
    });

    // For session variance approvals, attach session info
    const enriched = [];
    for (const cr of requests) {
      if (cr.entityType === 'SESSION_CAISSE') {
        const session = await prisma.sessionCaisse.findUnique({
          where: { id: cr.entityId },
          select: {
            id: true,
            depotId: true,
            openedAt: true,
            closedAt: true,
            variance: true,
            status: true,
            user: { select: { firstName: true, lastName: true } },
            depot: { select: { name: true, code: true } }
          }
        });
        // Only include the change request if the session exists
        // Silently skip orphaned change requests that reference deleted sessions
        if (session) {
          enriched.push({ ...cr, session });
        }
      } else {
        enriched.push(cr);
      }
    }

    res.json(enriched);
  } catch (error) {
    console.error('Error fetching change requests:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Approve a change request
router.put('/change-requests/:id/approve', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await prisma.changeRequest.findUnique({ where: { id: parseInt(id) } });
    if (!existing || existing.status !== 'PENDING') {
      return res.status(404).json({ error: 'Demande introuvable ou déjà traitée' });
    }

    // For variance approvals, we only mark the request approved. Business actions could be added here if needed.
    const updated = await prisma.changeRequest.update({
      where: { id: parseInt(id) },
      data: {
        status: 'APPROVED',
        approvedBy: req.user.id,
        approvedAt: new Date()
      }
    });

    return res.json(updated);
  } catch (error) {
    console.error('Error approving change request:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Reject a change request
router.put('/change-requests/:id/reject', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { reasonCode, notes } = req.body;

    const existing = await prisma.changeRequest.findUnique({ where: { id: parseInt(id) } });
    if (!existing || existing.status !== 'PENDING') {
      return res.status(404).json({ error: 'Demande introuvable ou déjà traitée' });
    }

    const updateData = {
      status: 'REJECTED',
      approvedBy: req.user.id,
      approvedAt: new Date()
    };

    // Add rejection details if provided
    if (reasonCode) {
      updateData.rejectionReasonCode = reasonCode;
    }
    if (notes) {
      updateData.rejectionNotes = notes;
    }

    const updated = await prisma.changeRequest.update({
      where: { id: parseInt(id) },
      data: updateData
    });

    return res.json(updated);
  } catch (error) {
    console.error('Error rejecting change request:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;


