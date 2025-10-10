const express = require('express');
const { prisma } = require('../lib/prisma');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { sendPushToAll } = require('../lib/push');

const router = express.Router();

// Create a return request (cashier)
router.post('/requests', authenticateToken, async (req, res) => {
  try {
    const { depotId, items, notes, originalSaleId, originalSaleTotal } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Aucun article sélectionné' });
    }

    // Generate numero RR-YYYYMMDD-XXXX
    const today = new Date();
    const pad = (n) => `${n}`.padStart(2, '0');
    const seq = Math.floor(Math.random() * 9000) + 1000;
    const numero = `BR-${today.getFullYear()}${pad(today.getMonth() + 1)}${pad(today.getDate())}-${seq}`;

    const created = await prisma.$transaction(async (tx) => {
      const request = await tx.returnRequest.create({
        data: {
          numero,
          depotId: parseInt(depotId),
          requestedById: req.user.id,
          notes: notes || null,
          originalSaleId: originalSaleId ? parseInt(originalSaleId) : null,
          originalSaleTotal: originalSaleTotal ? parseFloat(originalSaleTotal) : null
        }
      });

      for (const it of items) {
        const quantity = parseFloat(it.quantity);
        if (!it.productId || !quantity || quantity <= 0) {
          throw new Error('Article invalide ou quantité manquante');
        }
        await tx.returnItem.create({
          data: {
            requestId: request.id,
            productId: parseInt(it.productId),
            requestedQty: quantity,
            reason: it.reason || null
          }
        });
      }

      return request;
    });

    // Send push notification for new return request
    try {
      await sendPushToAll({
        title: 'Nouveau Bon de Retour',
        body: `Bon de retour ${created.numero} - ${items.length} articles par ${req.user.firstName} ${req.user.lastName}`,
        data: { type: 'RETURN', id: created.id, depotId: created.depotId }
      });
    } catch (e) {
      console.warn('[returns.create] Failed to send push notification:', e);
    }

    res.status(201).json(created);
  } catch (error) {
    console.error('Error creating return request:', error);
    res.status(500).json({ error: 'Erreur lors de la création du bon de retour' });
  }
});

// List return requests for approval center
router.get('/requests', authenticateToken, async (req, res) => {
  try {
    const { status = 'PENDING' } = req.query;
    const requests = await prisma.returnRequest.findMany({
      where: { status },
      include: {
        depot: true,
        requestedBy: { select: { id: true, firstName: true, lastName: true } },
        items: { 
          include: { 
            product: { 
              select: {
                id: true,
                name: true,
                prix_vente_TTC: true,
                unite: true,
                famille: { select: { id: true, name: true } }
              }
            } 
          } 
        },
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(requests);
  } catch (error) {
    console.error('Error listing return requests:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Approve and process a return request with dispositions
router.post('/requests/:id/approve', authenticateToken, requireRole(['ADMIN', 'MANAGER', 'STOCK_MANAGER']), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { items } = req.body; // [{ itemId, disposition, nonRebutQty, rebutQty }]

    const request = await prisma.returnRequest.findUnique({
      where: { id },
      include: { items: true }
    });
    if (!request || request.status !== 'PENDING') {
      return res.status(404).json({ error: 'Demande introuvable ou déjà traitée' });
    }

    const itemById = new Map(request.items.map(i => [i.id, i]));

    await prisma.$transaction(async (tx) => {
      // Update request header
      await tx.returnRequest.update({
        where: { id },
        data: { status: 'APPROVED', approvedById: req.user.id, approvedAt: new Date() }
      });

      // Process each item
      for (const input of items || []) {
        const original = itemById.get(parseInt(input.itemId));
        if (!original) {
          throw new Error(`Article de retour ${input.itemId} introuvable`);
        }
        const nonRebutQty = parseFloat(input.nonRebutQty || 0) || 0;
        const rebutQty = parseFloat(input.rebutQty || 0) || 0;
        const total = nonRebutQty + rebutQty;
        if (total <= 0 || total > parseFloat(original.requestedQty)) {
          throw new Error(`Quantités invalides pour l'article ${original.id}`);
        }

        // Persist disposition on item
        await tx.returnItem.update({
          where: { id: original.id },
          data: {
            disposition: rebutQty > 0 && nonRebutQty === 0 ? 'REBUT' : (nonRebutQty > 0 && rebutQty === 0 ? 'NON_REBUT' : 'NONE'),
            nonRebutQty: nonRebutQty > 0 ? nonRebutQty : null,
            rebutQty: rebutQty > 0 ? rebutQty : null
          }
        });

        // Non-rebut: restore stock
        if (nonRebutQty > 0) {
          const inv = await tx.inventory.findUnique({
            where: { depotId_productId: { depotId: request.depotId, productId: original.productId } }
          });
          if (inv) {
            await tx.inventory.update({
              where: { id: inv.id },
              data: { quantity: (parseFloat(inv.quantity) + nonRebutQty).toString() }
            });
          } else {
            await tx.inventory.create({
              data: { depotId: request.depotId, productId: original.productId, quantity: nonRebutQty }
            });
          }
          await tx.stockMovement.create({
            data: {
              productId: original.productId,
              depotId: request.depotId,
              quantity: nonRebutQty,
              type: 'IN',
              reason: 'RETURN_NON_REBUT',
              reference: request.numero,
              userId: req.user.id
            }
          });
        }

        // Rebut: create record awaiting authority
        if (rebutQty > 0) {
          await tx.rebutRecord.create({
            data: {
              requestId: request.id,
              itemId: original.id,
              productId: original.productId,
              depotId: request.depotId,
              quantity: rebutQty,
              status: 'PENDING_AUTHORITY'
            }
          });
        }
      }

      // Mark original sale as REFUNDED if it exists
      if (request.originalSaleId) {
        console.log(`Marking sale ${request.originalSaleId} as REFUNDED for return request ${request.numero}`);
        const updatedSale = await tx.sale.update({
          where: { id: request.originalSaleId },
          data: { status: 'REFUNDED' }
        });
        console.log(`Sale ${request.originalSaleId} updated to status: ${updatedSale.status}`);
      } else {
        console.log(`No originalSaleId found for return request ${request.numero}`);
      }

      // Handle cash adjustment for cash refunds
      console.log(`Return request data:`, {
        originalSaleTotal: request.originalSaleTotal,
        requestDepotId: request.depotId,
        userDepotId: req.user.depotId,
        numero: request.numero,
        userId: req.user.id
      });
      
      if (request.originalSaleTotal && request.originalSaleTotal > 0) {
        console.log(`Processing cash refund of ${request.originalSaleTotal} TND for return request ${request.numero}`);
        
        // Find the active session for the user's depot (not the request's depot)
        const activeSession = await tx.sessionCaisse.findFirst({
          where: {
            depotId: req.user.depotId,
            status: { in: ['OPEN', 'REOPENED'] }
          },
          orderBy: { createdAt: 'desc' }
        });

        console.log(`Active session found:`, activeSession ? `ID ${activeSession.id}` : 'None');

        if (activeSession) {
          console.log(`Creating cash movement for session ${activeSession.id} with amount ${request.originalSaleTotal}`);
          
          try {
            // Create cash movement to subtract the refund amount from register
            const reason = `Remboursement bon de retour ${request.numero}`;
            console.log(`Cash movement reason: "${reason}" (length: ${reason.length})`);
            
            const cashMovement = await tx.cashMovement.create({
              data: {
                sessionId: activeSession.id,
                type: 'SORTIE',
                amount: parseFloat(request.originalSaleTotal),
                reason: reason,
                ticketId: null,
                createdById: req.user.id
              }
            });

            console.log(`Cash movement created with ID: ${cashMovement.id}`);

            // Update expected cash in session
            await tx.sessionCaisse.update({
              where: { id: activeSession.id },
              data: { expectedCash: { decrement: parseFloat(request.originalSaleTotal) } }
            });

            console.log(`Updated expected cash for session ${activeSession.id}`);
          } catch (error) {
            console.error(`Error creating cash movement:`, error);
            throw error; // Re-throw to ensure transaction rollback
          }
        } else {
          console.log(`No active session found for user depot ${req.user.depotId}`);
        }
      } else {
        console.log(`No originalSaleTotal found for return request ${request.numero}`);
      }

      // Mark as processed after all items handled
      await tx.returnRequest.update({
        where: { id },
        data: { status: 'PROCESSED' }
      });
    });

    const updated = await prisma.returnRequest.findUnique({
      where: { id },
      include: { items: true }
    });

    // Send push notification for new rebut records
    try {
      const rebutRecords = await prisma.rebutRecord.findMany({
        where: { requestId: id, status: 'PENDING_AUTHORITY' }
      });
      if (rebutRecords.length > 0) {
        await sendPushToAll({
          title: 'Nouveaux Rebuts',
          body: `${rebutRecords.length} rebut(s) en attente d'autorité - Bon ${updated.numero}`,
          data: { type: 'REBUT', id: updated.id, depotId: updated.depotId }
        });
      }
    } catch (e) {
      console.warn('[returns.approve] Failed to send push notification:', e);
    }

    res.json(updated);
  } catch (error) {
    console.error('Error approving return request:', error);
    res.status(500).json({ error: 'Erreur lors du traitement du bon de retour' });
  }
});

// Reject a return request
router.post('/requests/:id/reject', authenticateToken, requireRole(['ADMIN', 'MANAGER', 'STOCK_MANAGER']), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { reason } = req.body;

    const request = await prisma.returnRequest.findUnique({
      where: { id }
    });
    
    if (!request || request.status !== 'PENDING') {
      return res.status(404).json({ error: 'Demande introuvable ou déjà traitée' });
    }

    const updated = await prisma.returnRequest.update({
      where: { id },
      data: { 
        status: 'REJECTED',
        approvedById: req.user.id,
        approvedAt: new Date(),
        notes: request.notes ? `${request.notes}\n\nRejeté: ${reason || 'Aucune raison fournie'}` : `Rejeté: ${reason || 'Aucune raison fournie'}`
      }
    });

    res.json(updated);
  } catch (error) {
    console.error('Error rejecting return request:', error);
    res.status(500).json({ error: 'Erreur lors du rejet du bon de retour' });
  }
});

// List rebut records for authority processing
router.get('/rebuts', authenticateToken, requireRole(['ADMIN', 'MANAGER', 'STOCK_MANAGER']), async (req, res) => {
  try {
    const { status = 'PENDING_AUTHORITY' } = req.query;
    const records = await prisma.rebutRecord.findMany({
      where: { status },
      include: { product: { include: { famille: true } }, depot: true, request: true, item: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json(records);
  } catch (error) {
    console.error('Error listing rebut records:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Archive a rebut record after authority approval
router.post('/rebuts/:id/archive', authenticateToken, requireRole(['ADMIN', 'MANAGER', 'STOCK_MANAGER']), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const record = await prisma.rebutRecord.findUnique({ where: { id } });
    if (!record || record.status !== 'PENDING_AUTHORITY') {
      return res.status(404).json({ error: 'Rebut introuvable ou déjà archivé' });
    }
    const updated = await prisma.rebutRecord.update({
      where: { id },
      data: { status: 'ARCHIVED', authorityApprovedAt: new Date() }
    });
    res.json(updated);
  } catch (error) {
    console.error('Error archiving rebut:', error);
    res.status(500).json({ error: 'Erreur lors de l\'archivage' });
  }
});

module.exports = router;
