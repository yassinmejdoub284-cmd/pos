const express = require('express');
const { prisma } = require('../lib/prisma');
const { authenticateToken } = require('../middleware/auth');
const { sendPushToAll } = require('../lib/push');

const router = express.Router();

// Helper function to process return (restore stock and create cash movement)
async function processReturn(tx, request, items, userId) {






  
  let returnType = null;
  let refundAmount = 0;
  
  // Check return type from notes
  if (request.notes) {
    const notesLower = request.notes.toLowerCase();
    if (notesLower.includes('type: retour simple') || 
        notesLower.includes('retour simple') ||
        notesLower.includes('retour simple (remboursement')) {
      returnType = 'RETURN';

    } else if (notesLower.includes('type: échange avec remboursement') ||
               notesLower.includes('échange avec remboursement')) {
      returnType = 'EXCHANGE_CASH';

    }
  }
  
  // If return type not detected but request status is PROCESSED and has originalSaleId, assume it's a simple return
  if (!returnType && request.status === 'PROCESSED' && request.originalSaleId) {
    returnType = 'RETURN';

  }

  // Try to extract refund amount from notes as fallback
  let refundFromNotes = 0;
  if (request.notes) {
    // Try multiple patterns to extract refund amount
    const patterns = [
      /Remboursement en espèces:\s*([\d,\.]+)\s*DT/i,
      /Remboursement.*?([\d,\.]+)\s*DT/i,
      /([\d,\.]+)\s*DT.*?Remboursement/i
    ];
    
    for (const pattern of patterns) {
      const refundMatch = request.notes.match(pattern);
      if (refundMatch) {
        const amountStr = refundMatch[1].replace(/,/g, '.');
        refundFromNotes = parseFloat(amountStr) || 0;
        if (refundFromNotes > 0) {

          break;
        }
      }
    }
  }

  // Process each item: restore stock and calculate refund
  const itemById = new Map(request.items.map(i => [i.id, i]));
  

  
  // Load original sale once if available
  let originalSale = null;
  if (request.originalSaleId) {
    originalSale = await tx.sale.findUnique({
      where: { id: request.originalSaleId },
      include: { items: true }
    });
    if (originalSale) {

    } else {
      console.warn(`[returns.process] Original sale ${request.originalSaleId} not found`);
    }
  }
  
  for (const input of items || []) {
    const original = itemById.get(parseInt(input.itemId));
    if (!original) {
      console.warn(`[returns.process] Item ${input.itemId} not found in request`);
      continue;
    }
    
    let nonRebutQty = parseFloat(input.nonRebutQty || 0) || 0;
    const requestedQty = parseFloat(original.requestedQty || 0);
    
    // Default to full requested quantity if not specified
    if (nonRebutQty === 0 && requestedQty > 0) {
      nonRebutQty = requestedQty;

    }
    
    // ALWAYS restore stock for non-rebut items (this should happen regardless of refund calculation)
    if (nonRebutQty > 0) {
      try {

        const inv = await tx.inventory.findUnique({
          where: { depotId_productId: { depotId: request.depotId, productId: original.productId } }
        });
        
        if (inv) {
          const currentQty = parseFloat(inv.quantity || 0);
          const newQty = currentQty + nonRebutQty;
          await tx.inventory.update({
            where: { id: inv.id },
            data: { quantity: newQty.toString() }
          });

        } else {
          await tx.inventory.create({
            data: { depotId: request.depotId, productId: original.productId, quantity: nonRebutQty.toString() }
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
            userId: userId
          }
        });
        

      } catch (stockError) {
        console.error(`[returns.process] ERROR restoring stock for product ${original.productId}:`, stockError);
        // Don't throw - continue processing other items and refund calculation
      }
      
      // Calculate refund amount from original sale if available
      if (returnType === 'RETURN' && originalSale) {
        try {

          
          // Try to find the sale item by productId - try multiple matching strategies
          let saleItem = originalSale.items.find((item) => {
            const itemProductId = item.productId ?? item.id;
            return itemProductId === original.productId;
          });
          
          // If not found, try matching by id
          if (!saleItem) {
            saleItem = originalSale.items.find((item) => item.id === original.productId);
          }
          
          if (saleItem) {
            const unitPrice = parseFloat(saleItem.unitPrice || 0);
            const itemRefund = nonRebutQty * unitPrice;
            refundAmount += itemRefund;


          } else {
            console.warn(`[returns.process] Sale item not found for product ${original.productId} in sale ${request.originalSaleId}`);
            console.warn(`[returns.process] Will use fallback refund calculation`);
          }
        } catch (refundCalcError) {
          console.error(`[returns.process] ERROR calculating refund for product ${original.productId}:`, refundCalcError);
          // Don't throw - continue with other items
        }
      }
    }
  }
  
  // If refund amount is 0 but we have a refund from notes, use that
  if (returnType === 'RETURN' && refundAmount === 0 && refundFromNotes > 0) {

    refundAmount = refundFromNotes;
  }
  
  // If still 0, try to calculate from originalSaleTotal if available
  if (returnType === 'RETURN' && refundAmount === 0 && request.originalSaleTotal) {
    // Calculate based on the ratio of returned items to total items
    const totalRequestedQty = request.items.reduce((sum, item) => sum + parseFloat(item.requestedQty || 0), 0);
    if (totalRequestedQty > 0 && originalSale) {
      const totalSaleQty = originalSale.items.reduce((sum, item) => sum + parseFloat(item.quantity || 0), 0);
      if (totalSaleQty > 0) {
        const ratio = totalRequestedQty / totalSaleQty;
        refundAmount = parseFloat(request.originalSaleTotal || 0) * ratio;

      } else {
        // If we can't calculate ratio, use the full originalSaleTotal if all items are being returned
        // or calculate from the sum of returned items' values
        const totalReturnedValue = request.items.reduce((sum, item) => {
          const qty = parseFloat(item.requestedQty || 0);
          // Try to find the product price from the sale
          if (originalSale) {
            const saleItem = originalSale.items.find(si => (si.productId ?? si.id) === item.productId);
            if (saleItem) {
              return sum + (qty * parseFloat(saleItem.unitPrice || 0));
            }
          }
          return sum;
        }, 0);
        if (totalReturnedValue > 0) {
          refundAmount = totalReturnedValue;

        } else {
          // Last resort: use originalSaleTotal directly if we can't calculate
          refundAmount = parseFloat(request.originalSaleTotal || 0);

        }
      }
    } else if (totalRequestedQty > 0) {
      // If we have requestedQty but no originalSale, try to use originalSaleTotal directly
      refundAmount = parseFloat(request.originalSaleTotal || 0);

    }
  }
  

  
  // Create cash movement for simple returns - ALWAYS create if returnType is RETURN, even if amount is 0 (will use originalSaleTotal)
  if (returnType === 'RETURN') {
    // If refundAmount is still 0, use originalSaleTotal as last resort
    if (refundAmount === 0 && request.originalSaleTotal) {
      refundAmount = parseFloat(request.originalSaleTotal || 0);

    }
    
    if (refundAmount > 0) {

      
      const activeSession = await tx.sessionCaisse.findFirst({
        where: {
          depotId: request.depotId,
          status: 'OPEN'
        },
        orderBy: { openedAt: 'desc' }
      });
      
      if (activeSession) {

        
        // Create cash movement with SORTIE type
        const cashMovement = await tx.cashMovement.create({
          data: {
            sessionId: activeSession.id,
            type: 'SORTIE',
            amount: refundAmount,
            reason: `Remboursement retour - Bon ${request.numero}`,
            ticketId: null, // Don't link to original sale to avoid exclusion in session calculation
            createdById: userId
          }
        });
        

        
        // Update expected cash by decrementing the refund amount
        // The session summary will recalculate automatically when fetched, including this new SORTIE movement
        const currentExpectedCash = parseFloat(activeSession.expectedCash || 0);
        const newExpectedCash = Math.max(0, currentExpectedCash - refundAmount);
        
        await tx.sessionCaisse.update({
          where: { id: activeSession.id },
          data: { expectedCash: newExpectedCash }
        });
        


      } else {
        console.warn(`[returns.process] No active session found for depot ${request.depotId} - cannot create cash movement`);
        console.warn(`[returns.process] Depot ID: ${request.depotId}, User ID: ${userId}`);
      }
    } else {
      console.warn(`[returns.process] Refund amount is 0, cannot create cash movement`);
      console.warn(`[returns.process] Request details: originalSaleId=${request.originalSaleId}, originalSaleTotal=${request.originalSaleTotal}, refundFromNotes=${refundFromNotes}`);
    }
  } else {

  }
  
  return { returnType, refundAmount };
}

// Create a return request (cashier) - processes simple returns immediately
router.post('/requests', authenticateToken, async (req, res) => {
  try {
    const { depotId, items, notes, originalSaleId, originalSaleTotal } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Aucun article sélectionné' });
    }

    // Generate numero BR-YYYYMMDD-XXXX
    const today = new Date();
    const pad = (n) => `${n}`.padStart(2, '0');
    const seq = Math.floor(Math.random() * 9000) + 1000;
    const numero = `BR-${today.getFullYear()}${pad(today.getMonth() + 1)}${pad(today.getDate())}-${seq}`;

    // Check if it's a simple return (should be processed immediately)
    // Check multiple variations of the return type text
    const isSimpleReturn = notes && (
      notes.includes('Type: Retour simple') || 
      notes.includes('Retour simple') ||
      notes.includes('Retour simple (remboursement en espèces)')
    );
    



    const created = await prisma.$transaction(async (tx) => {
      // Create request with appropriate status
      const request = await tx.returnRequest.create({
        data: {
          numero,
          depotId: parseInt(depotId),
          requestedById: req.user.id,
          notes: notes || null,
          originalSaleId: originalSaleId ? parseInt(originalSaleId) : null,
          originalSaleTotal: originalSaleTotal ? parseFloat(originalSaleTotal) : null,
          status: isSimpleReturn ? 'PROCESSED' : 'PENDING', // Process simple returns immediately
          approvedById: isSimpleReturn ? req.user.id : null,
          approvedAt: isSimpleReturn ? new Date() : null
        }
      });

      // Create return items
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
            reason: it.reason || null,
            // For simple returns, mark all as non-rebut immediately
            disposition: isSimpleReturn ? 'NON_REBUT' : null,
            nonRebutQty: isSimpleReturn ? quantity : null,
            rebutQty: null
          }
        });
      }

      // If simple return, process it immediately (restore stock and create cash movement)
      if (isSimpleReturn) {

        
        // Reload request with items for processing
        const requestWithItems = await tx.returnRequest.findUnique({
          where: { id: request.id },
          include: { items: true }
        });
        

        
        // Prepare items for processing (all as non-rebut)
        const processItems = requestWithItems.items.map(item => ({
          itemId: item.id,
          nonRebutQty: item.requestedQty,
          rebutQty: 0
        }));
        

        
        // Process the return
        const processResult = await processReturn(tx, requestWithItems, processItems, req.user.id);
        

        
        // Update original sale: mark as REFUNDED if all items returned, or update finalTotal for partial returns
        if (request.originalSaleId) {
          const originalSale = await tx.sale.findUnique({
            where: { id: request.originalSaleId },
            include: { items: true }
          });
          
          if (originalSale && originalSale.status !== 'REFUNDED') {
            // Check if all items are returned
            const returnedQuantities = new Map();
            for (const item of requestWithItems.items) {
              const current = returnedQuantities.get(item.productId) || 0;
              returnedQuantities.set(item.productId, current + parseFloat(item.requestedQty));
            }
            
            const originalQuantities = new Map();
            for (const saleItem of originalSale.items) {
              const qty = parseFloat(saleItem.quantity);
              const current = originalQuantities.get(saleItem.productId) || 0;
              originalQuantities.set(saleItem.productId, current + qty);
            }
            
            let allItemsReturned = true;
            for (const [productId, originalQty] of originalQuantities.entries()) {
              const returnedQty = returnedQuantities.get(productId) || 0;
              if (Math.abs(originalQty - returnedQty) > 0.001) {
                allItemsReturned = false;
                break;
              }
            }
            
            if (allItemsReturned) {
              // All items returned - mark as REFUNDED
              await tx.sale.update({
                where: { id: request.originalSaleId },
                data: { status: 'REFUNDED' }
              });

            } else {
              // Partial return - update finalTotal by subtracting the refund amount
              const currentTotal = parseFloat(originalSale.finalTotal || 0);
              const newTotal = Math.max(0, currentTotal - processResult.refundAmount);
              
              await tx.sale.update({
                where: { id: request.originalSaleId },
                data: { 
                  finalTotal: newTotal.toString(),
                  total: newTotal.toString() // Also update total field
                }
              });
              

              
              // Update sale items quantities for returned products
              for (const returnItem of requestWithItems.items) {
                const saleItem = originalSale.items.find(si => (si.productId ?? si.id) === returnItem.productId);
                if (saleItem) {
                  const currentQty = parseFloat(saleItem.quantity || 0);
                  const returnedQty = parseFloat(returnItem.requestedQty || 0);
                  const newQty = Math.max(0, currentQty - returnedQty);
                  
                  // Update the sale item quantity
                  await tx.saleItem.update({
                    where: { id: saleItem.id },
                    data: { 
                      quantity: newQty.toString(),
                      total: (newQty * parseFloat(saleItem.unitPrice || 0)).toString()
                    }
                  });
                  

                }
              }
            }
          }
        }
      }

      return request;
    });

    // Only send notification for returns that need approval
    if (!isSimpleReturn) {
      try {
        await sendPushToAll({
          title: 'Nouveau Bon de Retour',
          body: `Bon de retour ${created.numero} - ${items.length} articles par ${req.user.firstName} ${req.user.lastName}`,
          data: { type: 'RETURN', id: created.id, depotId: created.depotId }
        });
      } catch (e) {
        console.warn('[returns.create] Failed to send push notification:', e);
      }
    } else {

    }

    res.status(201).json(created);
  } catch (error) {
    console.error('Error creating return request:', error);
    res.status(500).json({ error: 'Erreur lors de la création du bon de retour' + (error?.message ? ' : ' + error.message : ''), code: error?.code });
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
    res.status(500).json({ error: 'Erreur serveur' + (error?.message ? ' : ' + error.message : ''), code: error?.code });
  }
});

// Approve and process a return request with dispositions
router.post('/requests/:id/approve', authenticateToken, async (req, res) => {
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
        let nonRebutQty = parseFloat(input.nonRebutQty || 0) || 0;
        let rebutQty = parseFloat(input.rebutQty || 0) || 0;
        const requestedQty = parseFloat(original.requestedQty || 0);
        
        // If neither nonRebutQty nor rebutQty is set, default to restoring all as non-rebut (for simple returns)
        if (nonRebutQty === 0 && rebutQty === 0 && requestedQty > 0) {
          nonRebutQty = requestedQty;
        }
        
        const total = nonRebutQty + rebutQty;
        if (total <= 0 || total > requestedQty) {
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
      
      // Use helper function to process return (restore stock and create cash movement)
      // This will handle stock restoration and cash movement creation
      await processReturn(tx, request, items, req.user.id);

      // Mark original sale as REFUNDED only if ALL items from the sale are being returned
      if (request.originalSaleId) {
        // Get the original sale with its items
        const originalSale = await tx.sale.findUnique({
          where: { id: request.originalSaleId },
          include: { items: true }
        });

        if (originalSale && originalSale.status !== 'REFUNDED') {
          // Get all processed return requests for this sale (excluding the current one, which we'll add separately)
          const otherReturnRequests = await tx.returnRequest.findMany({
            where: {
              originalSaleId: request.originalSaleId,
              id: { not: id }, // Exclude current request
              status: { in: ['APPROVED', 'PROCESSED'] }
            },
            include: { items: true }
          });

          // Calculate total returned quantities per product
          const returnedQuantities = new Map();
          
          // Add quantities from other return requests
          for (const rr of otherReturnRequests) {
            for (const item of rr.items) {
              const totalReturned = parseFloat(item.nonRebutQty || 0) + parseFloat(item.rebutQty || 0);
              const current = returnedQuantities.get(item.productId) || 0;
              returnedQuantities.set(item.productId, current + totalReturned);
            }
          }
          
          // Add quantities from the current request (using the updated values from the items we just processed)
          for (const input of items || []) {
            const original = itemById.get(parseInt(input.itemId));
            if (original) {
              const nonRebutQty = parseFloat(input.nonRebutQty || 0) || 0;
              const rebutQty = parseFloat(input.rebutQty || 0) || 0;
              const totalReturned = nonRebutQty + rebutQty;
              const current = returnedQuantities.get(original.productId) || 0;
              returnedQuantities.set(original.productId, current + totalReturned);
            }
          }

          // Calculate original sale quantities per product (in case same product appears multiple times)
          const originalQuantities = new Map();
          for (const saleItem of originalSale.items) {
            const qty = parseFloat(saleItem.quantity);
            const current = originalQuantities.get(saleItem.productId) || 0;
            originalQuantities.set(saleItem.productId, current + qty);
          }

          // Check if all items from the original sale are fully returned
          let allItemsReturned = true;
          for (const [productId, originalQty] of originalQuantities.entries()) {
            const returnedQty = returnedQuantities.get(productId) || 0;
            
            // Allow small floating point differences (0.001 tolerance)
            if (Math.abs(originalQty - returnedQty) > 0.001) {
              allItemsReturned = false;
              break;
            }
          }

          // Only mark as REFUNDED if all items are returned
          if (allItemsReturned) {

            const updatedSale = await tx.sale.update({
              where: { id: request.originalSaleId },
              data: { status: 'REFUNDED' }
            });

          } else {

          }
        } else if (originalSale) {

        } else {

        }
      } else {

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
    res.status(500).json({ error: 'Erreur lors du traitement du bon de retour' + (error?.message ? ' : ' + error.message : ''), code: error?.code });
  }
});

// Reject a return request
router.post('/requests/:id/reject', authenticateToken, async (req, res) => {
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
    res.status(500).json({ error: 'Erreur lors du rejet du bon de retour' + (error?.message ? ' : ' + error.message : ''), code: error?.code });
  }
});

// List rebut records for authority processing
router.get('/rebuts', authenticateToken, async (req, res) => {
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
    res.status(500).json({ error: 'Erreur serveur' + (error?.message ? ' : ' + error.message : ''), code: error?.code });
  }
});

// Archive a rebut record after authority approval
router.post('/rebuts/:id/archive', authenticateToken, async (req, res) => {
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
    res.status(500).json({ error: 'Erreur lors de l\'archivage' + (error?.message ? ' : ' + error.message : ''), code: error?.code });
  }
});

module.exports = router;
