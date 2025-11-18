const express = require('express');
const { prisma } = require('../lib/prisma');
const { authenticateToken } = require('../middleware/auth');
const { sendPushToAll } = require('../lib/push');
// Role checks removed - frontend handles access control

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { items, total, discount, finalTotal, paymentMethodId, clientId, amountPaid, isWholesale, paymentType, advancePayment, advancePaymentMethod } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'Sale must have at least one item' });
    }

        // Use user's assigned depot for stock operations
        const userDepotId = req.user?.depotId;
        if (!userDepotId) {
          return res.status(400).json({ error: 'User must be assigned to a depot to create sales' });
        }
        
        const targetDepotId = userDepotId; // Use user's depot for sales
        
        const sale = await prisma.$transaction(async (tx) => {
      
      // Stock validation removed - frontend handles warnings, backend allows all sales

      // Get the current active session for the depot (no user linkage)
      const activeSession = await tx.sessionCaisse.findFirst({
        where: {
          depotId: targetDepotId,
          status: 'OPEN'
        }
      });

      // Map payment method strings to IDs when needed
      const paymentMethodMap = { cash: 1, card: 2, check: 3, virement: 4 };
      const advanceAmount = advancePayment !== undefined ? parseFloat(advancePayment) : (amountPaid !== undefined ? parseFloat(amountPaid) : 0);
      const advanceMethodId = advancePaymentMethod ? paymentMethodMap[advancePaymentMethod] : (paymentMethodId ? parseInt(paymentMethodId) : null);

      // Compute session-based ticket number
      let sessionTicketNumber = null;
      if (activeSession && activeSession.id) {
        const recent = await tx.sale.findMany({
          where: { sessionId: activeSession.id },
          orderBy: { createdAt: 'desc' },
          select: { dailyTicketNumber: true },
          take: 500
        });
        const parseNum = (raw) => {
          if (!raw) return 0;
          const s = String(raw);
          if (s.includes('/')) {
            const part = s.split('/')[1];
            const n = parseInt(part, 10);
            return isNaN(n) ? 0 : n;
          }
          const n = parseInt(s, 10);
          return isNaN(n) ? 0 : n;
        };
        const maxNum = recent.reduce((mx, r) => Math.max(mx, parseNum(r.dailyTicketNumber)), 0);
        sessionTicketNumber = (maxNum || 0) + 1;
      }

        const newSale = await tx.sale.create({
          data: {
            total: parseFloat(total),
            discount: parseFloat(discount || 0),
            finalTotal: parseFloat(finalTotal),
            paymentMethodId: paymentMethodId ? parseInt(paymentMethodId) : null,
            userId: req.user?.id,
            clientId: clientId ? parseInt(clientId) : null,
            depotId: targetDepotId, // Use user's depot for caisse operations
            sessionId: activeSession ? activeSession.id : null,
            status: 'COMPLETED',
            paymentType: paymentType || 'COMPTANT',
            isWholesale: isWholesale || false,
            // Persist advance payment fields when provided (particularly for CREDIT)
            advancePayment: advanceAmount > 0 ? advanceAmount : 0,
            advancePaymentMethodId: advanceAmount > 0 ? advanceMethodId : null,
            advancePaymentDate: advanceAmount > 0 ? new Date() : null,
            advancePaymentNotes: null,
            // Store session-based ticket number in existing field (string)
            dailyTicketNumber: sessionTicketNumber ? String(sessionTicketNumber).padStart(4, '0') : null
          }
        });

      for (const item of items) {
        // Calculate margin for wholesale items
        let marginPercent = null;
        let requiresApproval = false;
        let isApproved = false;

        if (isWholesale && item.isWholesale) {
          const product = await tx.product.findUnique({
            where: { id: item.productId }
          });

          if (product && product.bundlePrice && product.minMargin) {
            const expectedBundleTotal = item.bundleQuantity * product.bundlePrice;
            const actualTotal = parseFloat(item.total);
            const discountAmount = expectedBundleTotal - actualTotal;
            marginPercent = (discountAmount / expectedBundleTotal) * 100;
            
            if (marginPercent > product.minMargin) {
              requiresApproval = true;
              // For now, auto-approve if user has manager/admin role
              isApproved = req.user.role === 'ADMIN' || req.user.role === 'MANAGER';
            }
          }
        }

        await tx.saleItem.create({
          data: {
            saleId: newSale.id,
            productId: item.productId,
            productName: item.productName,
            quantity: item.quantity,
            unitPrice: parseFloat(item.unitPrice),
            total: parseFloat(item.total),
            discount: parseFloat(item.discount || 0),
            // Wholesale fields
            isWholesale: isWholesale && item.isWholesale || false,
            bundleQuantity: item.bundleQuantity || null,
            bundleSize: item.bundleSize || null,
            bundlePrice: item.bundlePrice || null,
            marginPercent: marginPercent,
            requiresApproval: requiresApproval,
            isApproved: isApproved
          }
        });

        // For wholesale items, calculate the actual quantity to deduct (bundleQuantity * bundle size)
        const actualQuantityToDeduct = isWholesale && item.isWholesale && item.bundleSize 
          ? (item.bundleQuantity || item.quantity) * item.bundleSize 
          : item.quantity;

        console.log('Deducting inventory for sale:', {
          productId: item.productId,
          productName: item.productName,
          userDepotId: userDepotId,
          isWholesale: isWholesale && item.isWholesale,
          bundleQuantity: item.bundleQuantity,
          bundleSize: item.bundleSize,
          actualQuantityToDeduct: actualQuantityToDeduct
        });

        // Get current inventory quantity first
        const currentInventory = await tx.inventory.findFirst({
          where: {
            depotId: targetDepotId,
            productId: item.productId
          }
        });

        if (currentInventory) {
          // Calculate new quantity (can be negative)
          const newQuantity = parseFloat(currentInventory.quantity) - actualQuantityToDeduct;
          
          console.log('Updating inventory:', {
            productId: item.productId,
            currentQuantity: parseFloat(currentInventory.quantity),
            quantityToDeduct: actualQuantityToDeduct,
            newQuantity: newQuantity
          });
          
          await tx.inventory.updateMany({
            where: {
              depotId: targetDepotId,
              productId: item.productId
            },
            data: {
              quantity: newQuantity
            }
          });
        } else {
          // If no inventory record exists, create one with negative quantity
          console.log('Creating new inventory record with negative quantity:', {
            productId: item.productId,
            depotId: targetDepotId,
            quantity: -actualQuantityToDeduct
          });
          
          await tx.inventory.create({
            data: {
              depotId: targetDepotId,
              productId: item.productId,
              quantity: -actualQuantityToDeduct
            }
          });
        }

        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            depotId: targetDepotId, // Use user's depot for stock movement
            quantity: actualQuantityToDeduct,
            type: 'OUT',
            reason: isWholesale && item.isWholesale ? 'Wholesale Sale' : 'Sale',
            userId: req.user?.id
          }
        });
      }

      let loyaltyPointsEarned = 0;

      if (clientId) {
        let settings = null;
        if (tx.appSettings && typeof tx.appSettings.findFirst === 'function') {
          settings = await tx.appSettings.findFirst();
        }
        const client = await tx.client.findUnique({ where: { id: parseInt(clientId) } });

        // Handle different payment types
        const salePaymentType = paymentType || 'COMPTANT';

        if (salePaymentType === 'CREDIT') {
          if (client) {
            const totalAmount = parseFloat(finalTotal);
            const paidNow = advanceAmount > 0 ? advanceAmount : 0;
            const remaining = Math.max(0, totalAmount - paidNow);

            // Update client debt by remaining amount only
            const newDebt = parseFloat(client.currentDebt || 0) + remaining;
            await tx.client.update({ where: { id: client.id }, data: { currentDebt: newDebt } });

            // Record client debt transactions
            if (paidNow > 0) {
              await tx.clientDebtTransaction.create({
                data: {
                  clientId: client.id,
                  saleId: newSale.id,
                  amount: paidNow,
                  type: 'PAYMENT',
                  userId: req.user?.id,
                  notes: 'Advance payment at sale'
                }
              });
            }
            if (remaining > 0) {
              await tx.clientDebtTransaction.create({
                data: {
                  clientId: client.id,
                  saleId: newSale.id,
                  amount: remaining,
                  type: 'DEBT',
                  userId: req.user?.id,
                  notes: 'Debt from credit sale'
                }
              });
            }
          }
        } else {
          // COMPTANT sales: instant payment, only go to caisse, no client statement entry
          // The payment is handled by the paymentMethodId and goes directly to caisse
        }

        if (settings?.loyaltyEnabled) {
          const rate = parseFloat(settings.loyaltyRate || 0);
          loyaltyPointsEarned = Math.floor(parseFloat(finalTotal) * rate);
          if (loyaltyPointsEarned > 0) {
            await tx.client.update({
              where: { id: parseInt(clientId) },
              data: {
                loyaltyPoints: { increment: loyaltyPointsEarned },
                totalSpent: { increment: parseFloat(finalTotal) }
              }
            });
          } else {
            await tx.client.update({
              where: { id: parseInt(clientId) },
              data: { totalSpent: { increment: parseFloat(finalTotal) } }
            });
          }
        } else {
          await tx.client.update({
            where: { id: parseInt(clientId) },
            data: { totalSpent: { increment: parseFloat(finalTotal) } }
          });
        }
      }

      return { newSale, loyaltyPointsEarned };
    });

    const saleWithDetails = await prisma.sale.findUnique({
      where: { id: sale.newSale.id },
      include: {
        paymentMethod: { select: { name: true } },
        client: { select: { firstName: true, lastName: true, code: true } }
      }
    });

    // Emit socket notification for real-time ticket synchronization
    if (req.app.get('io')) {
      req.app.get('io').to(`depot_${userDepotId}`).emit('ticket_created', {
        depotId: targetDepotId,
        ticketNumber: sale.newSale.dailyTicketNumber,
        sessionId: sale.newSale.sessionId,
        saleId: sale.newSale.id,
        createdBy: req.user.username
      });
    }

    res.status(201).json({ ...saleWithDetails, loyaltyPointsEarned: sale.loyaltyPointsEarned });
  } catch (error) {
    console.error('Error creating sale:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

router.post('/temporary', async (req, res) => {
  try {
    const { 
      items, 
      total, 
      discount, 
      finalTotal, 
      expectedDate, 
      expectedTime, 
      notes, 
      status, 
      clientId,
      // Advance payment fields
      advancePayment,
      advancePaymentMethod,
      advancePaymentNotes
    } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'Temporary sale must have at least one item' });
    }

    // Use user's assigned depot for stock operations
    const userDepotId = req.user?.depotId;
    if (!userDepotId) {
      return res.status(400).json({ error: 'User must be assigned to a depot to create temporary sales' });
    }

    if (!expectedDate || !expectedTime) {
      return res.status(400).json({ error: 'Expected date and time are required' });
    }

    // Validate advance payment
    const advanceAmount = advancePayment ? parseFloat(advancePayment) : 0;
    const finalTotalAmount = parseFloat(finalTotal);
    
    if (advanceAmount > finalTotalAmount) {
      return res.status(400).json({ error: 'Advance payment cannot exceed final total' });
    }

    if (advanceAmount > 0 && !advancePaymentMethod) {
      return res.status(400).json({ error: 'Payment method is required when advance payment is provided' });
    }

    // Map payment method string to ID
    const paymentMethodMap = { 
      cash: 1, 
      card: 2, 
      check: 3, 
      virement: 4 
    };
    const advancePaymentMethodId = advancePaymentMethod ? paymentMethodMap[advancePaymentMethod] : null;

    const sale = await prisma.$transaction(async (tx) => {
      // Find active caisse session for cash movements
      const activeSession = await tx.sessionCaisse.findFirst({
        where: {
          depotId: targetDepotId,
          status: 'OPEN'
        }
      });

      const newSale = await tx.sale.create({
        data: {
          total: parseFloat(total),
          discount: parseFloat(discount || 0),
          finalTotal: finalTotalAmount,
          paymentMethodId: null,
          userId: req.user?.id,
          clientId: clientId ? parseInt(clientId) : null,
          depotId: targetDepotId, // Use shop depot for caisse operations
          status: 'TEMPORARY',
          expectedDate: new Date(`${expectedDate}T${expectedTime}`),
          notes: notes || '',
          // Advance payment fields
          advancePayment: advanceAmount,
          advancePaymentMethodId: advancePaymentMethodId,
          advancePaymentDate: advanceAmount > 0 ? new Date() : null,
          advancePaymentNotes: advancePaymentNotes || null
        }
      });

      for (const item of items) {
        await tx.saleItem.create({
          data: {
            saleId: newSale.id,
            productId: item.productId,
            productName: item.productName,
            quantity: item.quantity,
            unitPrice: parseFloat(item.unitPrice),
            total: parseFloat(item.total),
            discount: 0
          }
        });
      }

      // If advance payment is cash, record caisse entrée immediately
      if (advanceAmount > 0 && activeSession && (advancePaymentMethod === 'cash')) {
        await tx.cashMovement.create({
          data: {
            sessionId: activeSession.id,
            type: 'ENTREE',
            amount: advanceAmount,
            reason: `Acompte commande #${newSale.id}`,
            ticketId: null,
            createdById: req.user?.id
          }
        });
      }

      return newSale;
    });

    const saleWithDetails = await prisma.sale.findUnique({
      where: { id: sale.id },
      include: { 
        items: true, 
        client: { select: { firstName: true, lastName: true, code: true } },
        advancePaymentMethod: { select: { id: true, name: true, type: true } }
      }
    });

    res.status(201).json(saleWithDetails);
  } catch (error) {
    console.error('Error creating temporary sale:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/temporary/:id/complete', async (req, res) => {
  try {
    const { id } = req.params;
    const { paymentType, amountPaid, chequeId, encaissementDate, virementNumber } = req.body;
    const userDepotId = req.user?.depotId;
    if (!userDepotId) {
      return res.status(400).json({ error: 'User must be assigned to a depot to complete temporary sales' });
    }

    const temporarySale = await prisma.sale.findFirst({
      where: { id: parseInt(id), status: 'TEMPORARY', depotId: userDepotId },
      include: { items: true }
    });

    if (!temporarySale) {
      return res.status(404).json({ error: 'Temporary sale not found' });
    }

    const paymentMethodMap = { cash: 1, card: 2, check: 3, virement: 4 };

    const result = await prisma.$transaction(async (tx) => {
      // Stock validation removed - frontend handles warnings, backend allows all sales

      // Attach sale to current open session for cloture accounting
      const activeSession = await tx.sessionCaisse.findFirst({
        where: { depotId: userDepotId, status: 'OPEN' }
      });

      // Calculate session-based ticket number for completion
      let sessionTicketNumber = null;
      if (activeSession && activeSession.id) {
        const recent = await tx.sale.findMany({
          where: { sessionId: activeSession.id },
          orderBy: { createdAt: 'desc' },
          select: { dailyTicketNumber: true },
          take: 500
        });
        const parseNum = (raw) => {
          if (!raw) return 0;
          const s = String(raw);
          if (s.includes('/')) {
            const part = s.split('/')[1];
            const n = parseInt(part, 10);
            return isNaN(n) ? 0 : n;
          }
          const n = parseInt(s, 10);
          return isNaN(n) ? 0 : n;
        };
        const maxNum = recent.reduce((mx, r) => Math.max(mx, parseNum(r.dailyTicketNumber)), 0);
        sessionTicketNumber = (maxNum || 0) + 1;
      }

      const updatedSale = await tx.sale.update({
        where: { id: parseInt(id) },
        data: {
          status: 'CMD_TERMINEE',
          paymentMethodId: paymentMethodMap[paymentType] || null,
          expectedDate: null,
          notes: null,
          sessionId: activeSession ? activeSession.id : null,
          dailyTicketNumber: sessionTicketNumber ? String(sessionTicketNumber).padStart(4, '0') : null,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });

      for (const item of temporarySale.items) {
        // Get current inventory quantity first
        const currentInventory = await tx.inventory.findFirst({
          where: {
            depotId: targetDepotId,
            productId: item.productId
          }
        });

        if (currentInventory) {
          // Calculate new quantity (can be negative)
          const newQuantity = parseFloat(currentInventory.quantity) - item.quantity;
          
          await tx.inventory.updateMany({
            where: { depotId: userDepotId, productId: item.productId },
            data: { quantity: newQuantity }
          });
        } else {
          // If no inventory record exists, create one with negative quantity
          await tx.inventory.create({
            data: {
              depotId: targetDepotId,
              productId: item.productId,
              quantity: -item.quantity
            }
          });
        }

        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            depotId: targetDepotId, // Use shop depot for caisse operations
            quantity: item.quantity,
            type: 'OUT',
            reason: 'Temporary Sale Completed',
            userId: req.user?.id
          }
        });
      }

      // Record cash movement for completion payment in cash
      const paidNow = amountPaid !== undefined && amountPaid !== null ? parseFloat(amountPaid) : 0;
      if (paidNow > 0 && String(paymentType).toLowerCase() === 'cash' && activeSession) {
        await tx.cashMovement.create({
          data: {
            sessionId: activeSession.id,
            type: 'ENTREE',
            amount: paidNow,
            reason: `Règlement commande #${updatedSale.id}`,
            ticketId: null,
            createdById: req.user?.id
          }
        });
      }

      let loyaltyPointsEarned = 0;

      if (temporarySale.clientId) {
        let settings = null;
        if (tx.appSettings && typeof tx.appSettings.findFirst === 'function') {
          settings = await tx.appSettings.findFirst();
        }
        const client = await tx.client.findUnique({ where: { id: temporarySale.clientId } });
        
        // Calculate total paid amount (advance payment + completion payment)
        const advancePaid = parseFloat(temporarySale.advancePayment || 0);
        const completionPaid = amountPaid !== undefined && amountPaid !== null ? parseFloat(amountPaid) : 0;
        const totalPaid = advancePaid + completionPaid;
        
        const outstanding = Math.max(0, parseFloat(temporarySale.finalTotal) - totalPaid);
        if (outstanding > 0 && client) {
          // Trust frontend validation; record debt without server-side limit checks
          const newDebt = parseFloat(client.currentDebt || 0) + outstanding;
          await tx.client.update({ where: { id: client.id }, data: { currentDebt: newDebt } });
          await tx.clientDebtTransaction.create({
            data: { 
              clientId: client.id, 
              saleId: updatedSale.id, 
              amount: outstanding, 
              type: 'DEBT', 
              userId: req.user?.id, 
              notes: `Debt from temporary sale completion (Advance: ${advancePaid.toFixed(3)}dt, Paid: ${completionPaid.toFixed(3)}dt, Outstanding: ${outstanding.toFixed(3)}dt)` 
            }
          });
        }
        if (settings?.loyaltyEnabled) {
          const rate = parseFloat(settings.loyaltyRate || 0);
          loyaltyPointsEarned = Math.floor(parseFloat(temporarySale.finalTotal) * rate);
          if (loyaltyPointsEarned > 0) {
            await tx.client.update({
              where: { id: temporarySale.clientId },
              data: { loyaltyPoints: { increment: loyaltyPointsEarned }, totalSpent: { increment: parseFloat(temporarySale.finalTotal) } }
            });
          } else {
            await tx.client.update({ where: { id: temporarySale.clientId }, data: { totalSpent: { increment: parseFloat(temporarySale.finalTotal) } } });
          }
        } else {
          await tx.client.update({ where: { id: temporarySale.clientId }, data: { totalSpent: { increment: parseFloat(temporarySale.finalTotal) } } });
        }
      }

      return { updatedSale, loyaltyPointsEarned };
    });

    const saleWithDetails = await prisma.sale.findUnique({
      where: { id: result.updatedSale.id },
      include: { 
        paymentMethod: { select: { name: true } }, 
        advancePaymentMethod: { select: { name: true, type: true } },
        items: true, 
        client: { select: { firstName: true, lastName: true, code: true } } 
      }
    });

    res.json({ ...saleWithDetails, loyaltyPointsEarned: result.loyaltyPointsEarned });
  } catch (error) {
    console.error('Error completing temporary sale:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Add or increase advance payment for an existing temporary sale
router.put('/temporary/:id/advance', async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, method, notes } = req.body;
    const advanceAmount = amount ? parseFloat(amount) : 0;
    if (advanceAmount <= 0) {
      return res.status(400).json({ error: 'Advance amount must be greater than 0' });
    }

    const userDepotId = req.user?.depotId;
    if (!userDepotId) {
      return res.status(400).json({ error: 'User must be assigned to a depot to add advance payment' });
    }

    const temporarySale = await prisma.sale.findFirst({
      where: { id: parseInt(id), status: 'TEMPORARY', depotId: userDepotId }
    });
    if (!temporarySale) {
      return res.status(404).json({ error: 'Temporary sale not found' });
    }

    const paymentMethodMap = { cash: 1, card: 2, check: 3, virement: 4 };
    const methodId = method ? paymentMethodMap[String(method).toLowerCase()] : null;

    const result = await prisma.$transaction(async (tx) => {
      // Update advance fields (accumulate)
      const newAdvance = (parseFloat(temporarySale.advancePayment || 0) || 0) + advanceAmount;
      const updated = await tx.sale.update({
        where: { id: parseInt(id) },
        data: {
          advancePayment: newAdvance,
          advancePaymentMethodId: methodId,
          advancePaymentDate: new Date(),
          advancePaymentNotes: notes || null
        }
      });

      // Record cash movement for cash advances in open session
      if (methodId === 1) {
        const activeSession = await tx.sessionCaisse.findFirst({ where: { depotId: userDepotId, status: 'OPEN' } });
        if (activeSession) {
          await tx.cashMovement.create({
            data: {
              sessionId: activeSession.id,
              type: 'ENTREE',
              amount: advanceAmount,
              reason: `Acompte commande #${updated.id}`,
              ticketId: null,
              createdById: req.user?.id
            }
          });
        }
      }

      return updated;
    });

    res.json(result);
  } catch (error) {
    console.error('Error adding advance to temporary sale:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/gift', authenticateToken, async (req, res) => {
  try {
    const { items, total, discount, finalTotal, reason, recipient, status, clientId, depotId } = req.body;

    console.log(`[Gift Sale] Creating gift sale - Request depotId: ${depotId}, User depotId: ${req.user?.depotId}, User role: ${req.user?.role}`);

    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'Gift sale must have at least one item' });
    }

    // Use provided depotId or fallback to user's assigned depot for stock operations
    const userDepotId = req.user?.depotId;
    let targetDepotId = depotId ? parseInt(depotId) : userDepotId;
    
    console.log(`[Gift Sale] Initial targetDepotId: ${targetDepotId} (from request: ${depotId}, user: ${userDepotId})`);
    
    // For admins, allow specifying any depot
    // For non-admins, validate depot access
    if (req.user?.role !== 'ADMIN') {
      if (!targetDepotId) {
        return res.status(400).json({ error: 'User must be assigned to a depot or specify depotId to create gift sales' });
      }
      // Non-admins can only create gifts for their own depot
      if (depotId && parseInt(depotId) !== userDepotId) {
        return res.status(403).json({ error: 'Access denied: Cannot create gift sales for different depot' });
      }
    } else {
      // Admins can specify depot, but must be valid
      if (depotId) {
        const requestedDepot = await prisma.depot.findFirst({
          where: { id: parseInt(depotId), isActive: true }
        });
        if (!requestedDepot) {
          return res.status(400).json({ error: 'Invalid or inactive depot specified' });
        }
        targetDepotId = requestedDepot.id;
      } else if (!userDepotId) {
        return res.status(400).json({ error: 'DepotId must be specified for admin users without assigned depot' });
      }
    }
    
    if (!targetDepotId) {
      return res.status(400).json({ error: 'DepotId is required to create gift sales' });
    }

    console.log(`[Gift Sale] Final targetDepotId: ${targetDepotId}, processing ${items.length} items`);

    // Validate depotId is a valid number
    if (!targetDepotId || isNaN(targetDepotId) || targetDepotId <= 0) {
      console.error(`[Gift Sale] Invalid targetDepotId: ${targetDepotId}`);
      return res.status(400).json({ error: 'Invalid depotId specified' });
    }

    if (!reason || reason.trim() === '') {
      return res.status(400).json({ error: 'Gift reason is required' });
    }

    // Determine sale status - use provided status or default to PENDING_ADMIN
    const saleStatus = status && (status === 'CADEAU' || status === 'PENDING_ADMIN') ? status : 'PENDING_ADMIN';
    // Stock will be removed only when the cadeau is approved, not at creation

    const sale = await prisma.$transaction(async (tx) => {
      // Get the current active session for the depot (same logic as regular sales)
      const activeSession = await tx.sessionCaisse.findFirst({
        where: {
          depotId: targetDepotId,
          status: 'OPEN'
        }
      });

      // Compute session-based ticket number (same logic as regular sales)
      let sessionTicketNumber = null;
      if (activeSession && activeSession.id) {
        const recent = await tx.sale.findMany({
          where: { sessionId: activeSession.id },
          orderBy: { createdAt: 'desc' },
          select: { dailyTicketNumber: true },
          take: 500
        });
        const parseNum = (raw) => {
          if (!raw) return 0;
          const s = String(raw);
          if (s.includes('/')) {
            const part = s.split('/')[1];
            const n = parseInt(part, 10);
            return isNaN(n) ? 0 : n;
          }
          const n = parseInt(s, 10);
          return isNaN(n) ? 0 : n;
        };
        const maxNum = recent.reduce((mx, r) => Math.max(mx, parseNum(r.dailyTicketNumber)), 0);
        sessionTicketNumber = (maxNum || 0) + 1;
      }

      // Calculate actual final total (total - discount), but payment is 0 for gifts
      const calculatedFinalTotal = parseFloat(total) - parseFloat(discount || 0);

      // Create gift sale with provided status (PENDING_ADMIN for approval, CADEAU for auto-approved)
      const newSale = await tx.sale.create({
        data: {
          total: parseFloat(total),
          discount: parseFloat(discount || 0),
          finalTotal: calculatedFinalTotal, // Preserve actual value (even though payment is 0)
          paymentMethodId: null,
          userId: req.user?.id,
          clientId: clientId ? parseInt(clientId) : null,
          depotId: targetDepotId, // Use shop depot for caisse operations
          sessionId: activeSession ? activeSession.id : null, // Link to active session
          status: saleStatus,
          // Store session-based ticket number (same as regular sales)
          dailyTicketNumber: sessionTicketNumber ? String(sessionTicketNumber).padStart(4, '0') : null,
          notes: `Cadeau - Raison: ${reason}${recipient ? ` - Destinataire: ${recipient}` : ''}`
        }
      });

      for (const item of items) {
        await tx.saleItem.create({
          data: {
            saleId: newSale.id,
            productId: item.productId,
            productName: item.productName,
            quantity: item.quantity,
            unitPrice: parseFloat(item.unitPrice),
            total: parseFloat(item.total),
            discount: 0
          }
        });

        // If cadeau is auto-approved (status = 'CADEAU'), remove stock immediately
        // Otherwise, stock will be removed when approved
        if (saleStatus === 'CADEAU') {
          const itemQuantity = parseFloat(item.quantity) || 0;
          const itemProductId = parseInt(item.productId);
          
          if (itemProductId && itemQuantity > 0) {
            // Get current inventory
            const currentInventory = await tx.inventory.findFirst({
              where: {
                depotId: targetDepotId,
                productId: itemProductId
              }
            });

            if (currentInventory) {
              // Calculate new quantity (can be negative)
              const newQuantity = parseFloat(currentInventory.quantity) - itemQuantity;
              
              console.log(`[Gift Sale] Auto-approved cadeau - Removing stock for productId=${itemProductId}: current=${currentInventory.quantity}, removing=${itemQuantity}, new=${newQuantity}`);
              
              // Update inventory
              await tx.inventory.updateMany({
                where: {
                  depotId: targetDepotId,
                  productId: itemProductId
                },
                data: {
                  quantity: newQuantity
                }
              });
            } else {
              // If no inventory record exists, create one with negative quantity
              console.log(`[Gift Sale] Auto-approved cadeau - Creating inventory record with negative quantity for productId=${itemProductId}: -${itemQuantity}`);
              
              await tx.inventory.create({
                data: {
                  depotId: targetDepotId,
                  productId: itemProductId,
                  quantity: -itemQuantity
                }
              });
            }
            
            // Create stock movement record
            await tx.stockMovement.create({
              data: {
                productId: itemProductId,
                depotId: targetDepotId,
                quantity: itemQuantity,
                type: 'OUT',
                reason: 'Gift Sale',
                userId: req.user?.id
              }
            });
          }
        }
        // If status is PENDING_ADMIN, stock will be removed when approved
      }

      return newSale;
    });

    // Stock removal: 
    // - If status is CADEAU (auto-approved), stock was removed during creation
    // - If status is PENDING_ADMIN, stock will be removed upon approval
    console.log(`[Gift Sale] Transaction completed. Status: ${saleStatus}, stock ${saleStatus === 'CADEAU' ? 'removed' : 'will be removed upon approval'}.`);

    const saleWithDetails = await prisma.sale.findUnique({
      where: { id: sale.id },
      include: { items: true, client: { select: { firstName: true, lastName: true, code: true } } }
    });

    // Emit socket notification for real-time ticket synchronization (same as regular sales)
    if (req.app.get('io')) {
      req.app.get('io').to(`depot_${targetDepotId}`).emit('ticket_created', {
        depotId: targetDepotId,
        ticketNumber: sale.dailyTicketNumber,
        sessionId: sale.sessionId,
        saleId: sale.id,
        createdBy: req.user.username,
        isGift: true
      });
    }

    // Send push notification if status is PENDING_ADMIN (needs approval)
    if (saleStatus === 'PENDING_ADMIN') {
      try {
        const { sendPushToAll } = require('../lib/push');
        await sendPushToAll({
          title: 'Nouvelle demande de cadeau',
          body: `Demande de cadeau en attente d'approbation - ${reason}`,
          data: { type: 'GIFT_APPROVAL', id: sale.id }
        });
      } catch (e) {
        console.error('[Gift Sale] Error sending push notification:', e);
      }
    }

    res.status(201).json(saleWithDetails);
  } catch (error) {
    console.error('[Gift Sale] Error creating gift sale:', error);
    console.error('[Gift Sale] Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      body: req.body
    });
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message || 'Failed to create gift sale',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

router.put('/gift/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    const userDepotId = req.user?.depotId;
    if (!userDepotId) {
      return res.status(400).json({ error: 'User must be assigned to a depot to approve gift sales' });
    }

    // Allow approving both PENDING_ADMIN and already approved CADEAU (to fix stock if needed)
    const giftSale = await prisma.sale.findFirst({
      where: { 
        id: parseInt(id), 
        status: { in: ['PENDING_ADMIN', 'CADEAU'] },
        depotId: userDepotId 
      },
      include: { items: true }
    });

    if (!giftSale) {
      return res.status(404).json({ error: 'Gift sale not found or cannot be processed' });
    }

    // Use the gift sale's depotId (should be same as userDepotId, but use sale's to be sure)
    const targetDepotId = giftSale.depotId || userDepotId;
    
    console.log(`[gift approve] Starting approval for sale ${id}, depotId=${targetDepotId}, items count=${giftSale.items.length}`);

    const sale = await prisma.$transaction(async (tx) => {
      // Update status to CADEAU if it was PENDING_ADMIN
      const updatedSale = await tx.sale.update({
        where: { id: parseInt(id) },
        data: { 
          status: 'CADEAU', 
          updatedAt: new Date() 
        }
      });

      // Always remove stock when approving a cadeau
      // Check if stock was already removed by looking for existing stock movements
      // This ensures stock is removed even if the cadeau was already CADEAU but stock wasn't removed
      console.log(`[gift approve] Processing stock removal for sale ${id} (status was ${giftSale.status}).`);
      
      // Get existing stock movements for this sale to check if stock was already removed
      const saleItemIds = giftSale.items.map(item => item.productId);
      const timeWindowStart = new Date(giftSale.createdAt.getTime() - 5 * 60 * 1000); // 5 minutes before
      const timeWindowEnd = new Date(giftSale.createdAt.getTime() + 5 * 60 * 1000); // 5 minutes after
      
      const existingMovements = await tx.stockMovement.findMany({
        where: {
          productId: { in: saleItemIds },
          depotId: targetDepotId,
          reason: { in: ['Gift Sale', 'Gift Sale Created', 'Gift Sale Approved'] },
          date: {
            gte: timeWindowStart,
            lte: timeWindowEnd
          }
        }
      });
      
      // Remove stock for each item
      for (const item of giftSale.items) {
        try {
          const itemProductId = parseInt(item.productId);
          const itemQuantity = parseFloat(item.quantity) || 0;
          
          if (itemProductId && itemQuantity > 0) {
            // Check if stock movement already exists for this item
            const hasMovement = existingMovements.some(m => 
              m.productId === itemProductId && 
              Math.abs(parseFloat(m.quantity.toString()) - itemQuantity) < 0.001
            );
            
            if (hasMovement) {
              console.log(`[gift approve] Stock movement already exists for productId=${itemProductId}, skipping.`);
              continue;
            }
            
            // Get current inventory
            const currentInventory = await tx.inventory.findFirst({
              where: {
                depotId: targetDepotId,
                productId: itemProductId
              }
            });

            if (currentInventory) {
              // Calculate new quantity (can be negative)
              const newQuantity = parseFloat(currentInventory.quantity) - itemQuantity;
              
              console.log(`[gift approve] Removing stock for productId=${itemProductId}: current=${currentInventory.quantity}, removing=${itemQuantity}, new=${newQuantity}`);
              
              // Update inventory
              await tx.inventory.updateMany({
                where: {
                  depotId: targetDepotId,
                  productId: itemProductId
                },
                data: {
                  quantity: newQuantity
                }
              });
            } else {
              // If no inventory record exists, create one with negative quantity
              console.log(`[gift approve] Creating inventory record with negative quantity for productId=${itemProductId}: -${itemQuantity}`);
              
              await tx.inventory.create({
                data: {
                  depotId: targetDepotId,
                  productId: itemProductId,
                  quantity: -itemQuantity
                }
              });
            }
            
            // Create stock movement record
            await tx.stockMovement.create({
              data: {
                productId: itemProductId,
                depotId: targetDepotId,
                quantity: itemQuantity,
                type: 'OUT',
                reason: 'Gift Sale Approved',
                userId: req.user?.id
              }
            });
            
            console.log(`[gift approve] Stock removed and movement recorded for productId=${itemProductId}`);
          }
        } catch (itemError) {
          console.error(`[gift approve] Error processing productId=${item.productId}:`, itemError);
          // Continue with other items even if one fails
        }
      }
      
      console.log(`[gift approve] Transaction completed successfully`);

      return updatedSale;
    });

    const saleWithDetails = await prisma.sale.findUnique({ where: { id: sale.id }, include: { items: true, client: { select: { firstName: true, lastName: true, code: true } } } });

    // Verify inventory was updated correctly
    for (const item of giftSale.items) {
      const itemProductId = parseInt(item.productId);
      if (itemProductId) {
        const verifyInventory = await prisma.inventory.findFirst({
          where: {
            depotId: targetDepotId,
            productId: itemProductId
          }
        });
        if (verifyInventory) {
          console.log(`[gift approve] Verification: productId=${itemProductId}, final quantity=${verifyInventory.quantity}`);
        } else {
          console.warn(`[gift approve] Verification failed: productId=${itemProductId} not found in inventory`);
        }
      }
    }

    res.json(saleWithDetails);
  } catch (error) {
    console.error('Error approving gift sale:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/gift/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;
    const userDepotId = req.user?.depotId;
    const where = { id: parseInt(id), status: 'PENDING_ADMIN' };
    // Restrict by depot for non-admins; allow admins to reject across depots
    if (req.user && req.user.role !== 'ADMIN' && userDepotId) {
      where.depotId = userDepotId;
    }

    const giftSale = await prisma.sale.findFirst({ 
      where,
      include: { items: true }
    });

    if (!giftSale) {
      return res.status(404).json({ error: 'Gift sale not found or already processed' });
    }

    const targetDepotId = giftSale.depotId || userDepotId;

    // Stock was not removed at creation, so no need to restore it when rejecting
    // Only update the sale status to CANCELLED
    await prisma.$transaction(async (tx) => {
      // Update sale status
      await tx.sale.update({ 
        where: { id: parseInt(id) }, 
        data: { status: 'CANCELLED', updatedAt: new Date() } 
      });

      console.log(`[gift reject] Rejecting sale ${id} (status was ${giftSale.status}). No stock to restore since it was never removed.`);
    });

    const saleWithDetails = await prisma.sale.findUnique({ 
      where: { id: parseInt(id) }, 
      include: { items: true, client: { select: { firstName: true, lastName: true, code: true } } } 
    });

    res.json(saleWithDetails);
  } catch (error) {
    console.error('Error rejecting gift sale:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Fix gift sales that don't have stock deducted (retroactive fix)
// Supports force mode: if ?force=true, will process all items regardless of existing movements
router.post('/gift/fix-stock', authenticateToken, async (req, res) => {
  try {
    // Only allow ADMIN and MANAGER roles
    if (req.user?.role !== 'ADMIN' && req.user?.role !== 'MANAGER') {
      return res.status(403).json({ error: 'Access denied. Only admins and managers can fix gift stock.' });
    }

    const forceMode = req.query.force === 'true' || req.body.force === true;
    console.log(`[Gift Stock Fix] Starting retroactive stock fix... (force mode: ${forceMode})`);

    // Find all CADEAU sales
    const giftSales = await prisma.sale.findMany({
      where: {
        status: 'CADEAU'
      },
      include: {
        items: true,
        depot: {
          select: {
            id: true,
            name: true,
            code: true
          }
        }
      },
      orderBy: {
        id: 'asc'
      }
    });

    console.log(`[Gift Stock Fix] Found ${giftSales.length} gift sales`);

    let fixedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    const errors = [];
    let totalItemsProcessed = 0;
    let totalStockRemoved = 0;

    for (const sale of giftSales) {
      if (!sale.depotId) {
        console.log(`[Gift Stock Fix] Sale #${sale.id}: No depotId, skipping...`);
        skippedCount++;
        continue;
      }

      const targetDepotId = sale.depotId;

      let itemsNeedingStock = [];

      if (forceMode) {
        // Force mode: process all items regardless of existing movements
        itemsNeedingStock = sale.items.filter(item => {
          const itemProductId = parseInt(item.productId);
          const itemQuantity = parseFloat(item.quantity) || 0;
          return itemProductId && itemQuantity > 0;
        });
        console.log(`[Gift Stock Fix] Force mode: Processing ALL ${itemsNeedingStock.length} items for sale #${sale.id}`);
      } else {
        // Normal mode: check for existing movements
        // Use a wider time window (30 minutes) to catch movements
        const timeWindowStart = new Date(sale.createdAt.getTime() - 30 * 60 * 1000); // 30 minutes before
        const timeWindowEnd = new Date(sale.createdAt.getTime() + 30 * 60 * 1000); // 30 minutes after
        
        const existingMovements = await prisma.stockMovement.findMany({
          where: {
            productId: { in: sale.items.map(item => item.productId) },
            depotId: targetDepotId,
            reason: { in: ['Gift Sale', 'Gift Sale Created', 'Gift Sale Approved', 'Gift Sale (Retroactive Fix)'] },
            date: {
              gte: timeWindowStart,
              lte: timeWindowEnd
            }
          }
        });

        console.log(`[Gift Stock Fix] Sale #${sale.id}: Found ${existingMovements.length} existing movements in time window`);

        // Check if we need to process this sale
        itemsNeedingStock = sale.items.filter(item => {
          const itemProductId = parseInt(item.productId);
          const itemQuantity = parseFloat(item.quantity) || 0;
          
          if (!itemProductId || itemQuantity <= 0) {
            return false; // Skip invalid items
          }
          
          // Check if there's a movement for this exact product and quantity
          const hasMovement = existingMovements.some(m => {
            const movementProductId = parseInt(m.productId);
            const movementQuantity = parseFloat(m.quantity.toString()) || 0;
            
            // Match product ID and quantity (with small tolerance for floating point)
            return movementProductId === itemProductId && 
                   Math.abs(movementQuantity - itemQuantity) < 0.001;
          });
          
          return !hasMovement;
        });
      }

      if (itemsNeedingStock.length === 0) {
        console.log(`[Gift Stock Fix] Sale #${sale.id}: All items already have stock movements, skipping...`);
        skippedCount++;
        continue;
      }

      console.log(`[Gift Stock Fix] Sale #${sale.id}: Processing ${itemsNeedingStock.length} items that need stock deduction`);

      try {
        await prisma.$transaction(async (tx) => {
          for (const item of itemsNeedingStock) {
            const itemQuantity = parseFloat(item.quantity) || 0;
            const itemProductId = parseInt(item.productId);

            if (!itemProductId || itemQuantity <= 0) {
              console.log(`[Gift Stock Fix] Sale #${sale.id}: Skipping invalid item - productId=${itemProductId}, quantity=${itemQuantity}`);
              continue;
            }

            // Get current inventory
            const currentInventory = await tx.inventory.findUnique({
              where: {
                depotId_productId: {
                  depotId: targetDepotId,
                  productId: itemProductId
                }
              }
            });

            const currentQty = currentInventory ? parseFloat(currentInventory.quantity) || 0 : 0;
            const newQuantity = currentQty - itemQuantity;

            console.log(`[Gift Stock Fix] Sale #${sale.id}, Product #${itemProductId}: ${currentQty} → ${newQuantity} (removing ${itemQuantity})`);

            // Update or create inventory
            await tx.inventory.upsert({
              where: {
                depotId_productId: {
                  depotId: targetDepotId,
                  productId: itemProductId
                }
              },
              update: {
                quantity: newQuantity
              },
              create: {
                depotId: targetDepotId,
                productId: itemProductId,
                quantity: -itemQuantity
              }
            });

            // Create stock movement (always create, even in force mode, for audit trail)
            await tx.stockMovement.create({
              data: {
                productId: itemProductId,
                depotId: targetDepotId,
                quantity: itemQuantity,
                type: 'OUT',
                reason: forceMode ? 'Gift Sale (Force Fix)' : 'Gift Sale (Retroactive Fix)',
                userId: sale.userId,
                date: sale.createdAt
              }
            });

            totalItemsProcessed++;
            totalStockRemoved += itemQuantity;
            console.log(`[Gift Stock Fix] Sale #${sale.id}, Product #${itemProductId}: Stock removed and movement created`);
          }
        });

        fixedCount++;
        console.log(`[Gift Stock Fix] ✅ Fixed sale #${sale.id} (${itemsNeedingStock.length} items)`);
      } catch (error) {
        errorCount++;
        errors.push({ saleId: sale.id, error: error.message });
        console.error(`[Gift Stock Fix] Error fixing sale #${sale.id}:`, error);
        console.error(`[Gift Stock Fix] Error stack:`, error.stack);
      }
    }

    console.log(`[Gift Stock Fix] Completed: Fixed=${fixedCount}, Skipped=${skippedCount}, Errors=${errorCount}`);
    console.log(`[Gift Stock Fix] Total items processed: ${totalItemsProcessed}, Total stock removed: ${totalStockRemoved}`);

    res.json({
      success: true,
      forceMode: forceMode,
      summary: {
        total: giftSales.length,
        fixed: fixedCount,
        skipped: skippedCount,
        errors: errorCount,
        totalItemsProcessed: totalItemsProcessed,
        totalStockRemoved: totalStockRemoved
      },
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('[Gift Stock Fix] Fatal error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

router.get('/', authenticateToken, async (req, res) => {
  try {
    const { startDate, endDate, status, paymentMethod, page = 1, limit = 1000, sessionIds, depotId } = req.query;

    // Enforce depot isolation - use user's depot, visiting depot, or provided depot
    const userDepotId = req.user?.depotId;
    const visitingDepotHeader = req.headers['x-depot-id'];
    const visitingDepotId = visitingDepotHeader ? parseInt(visitingDepotHeader) : null;
    
    // Determine which depot to use: requested > visiting > user's depot
    let targetDepotId = depotId ? parseInt(depotId) : (visitingDepotId || userDepotId);
    
    // For non-admin users, check depot access
    if (req.user?.role !== 'ADMIN') {
      // Allow if accessing own depot
      if (targetDepotId && userDepotId && targetDepotId === userDepotId) {
        // OK - accessing own depot
      }
      // Allow if accessing visiting depot (for MANAGER/CASHIER with visiting depot header)
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
        // Allow access for users without assigned depot (like RESPONSABLE_MAGASIN)
      }
      // Deny if trying to access different depot
      else if (targetDepotId && userDepotId && targetDepotId !== userDepotId) {
        return res.status(403).json({ error: 'Access denied: Cannot access other depot sales' });
      }
      // Deny if no depot available
      else if (!targetDepotId) {
        return res.status(400).json({ error: 'User must be assigned to a depot or specify depotId to view sales' });
      }
    }
    
    if (!targetDepotId) {
      return res.status(400).json({ error: 'depotId is required to view sales' });
    }
    
    const whereClause = { depotId: targetDepotId };

    // Handle session-based filtering (priority over date filtering)
    if (sessionIds) {
      const sessionIdArray = sessionIds.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
      if (sessionIdArray.length > 0) {
        whereClause.sessionId = { in: sessionIdArray };
      }
    } else if (startDate && endDate) {
      // Fallback to date filtering if no sessionIds provided
      whereClause.createdAt = { gte: new Date(startDate), lte: new Date(endDate) };
    }

    if (status) whereClause.status = status;

    if (paymentMethod) whereClause.paymentMethodId = parseInt(paymentMethod);

    // Get regular sales
    const sales = await prisma.sale.findMany({
      where: whereClause,
      include: {
        paymentMethod: { select: { name: true } },
        advancePaymentMethod: { select: { name: true } },
        client: { select: { firstName: true, lastName: true, code: true } },
        user: { select: { firstName: true, lastName: true } },
        items: true,
        session: { select: { id: true } }
      },
      orderBy: { createdAt: 'desc' },
      skip: (parseInt(page) - 1) * parseInt(limit),
      take: parseInt(limit)
    });

    // Convert Decimal fields to numbers for proper serialization
    const salesWithNumbers = sales.map(sale => ({
      ...sale,
      total: sale.total ? parseFloat(sale.total.toString()) : 0,
      discount: sale.discount ? parseFloat(sale.discount.toString()) : 0,
      finalTotal: sale.finalTotal ? parseFloat(sale.finalTotal.toString()) : 0,
      advancePayment: sale.advancePayment ? parseFloat(sale.advancePayment.toString()) : 0,
      items: sale.items.map(item => ({
        ...item,
        quantity: item.quantity ? parseFloat(item.quantity.toString()) : 0,
        unitPrice: item.unitPrice ? parseFloat(item.unitPrice.toString()) : 0,
        total: item.total ? parseFloat(item.total.toString()) : 0,
        discount: item.discount ? parseFloat(item.discount.toString()) : 0,
        bundlePrice: item.bundlePrice ? parseFloat(item.bundlePrice.toString()) : null,
        bundleQuantity: item.bundleQuantity ? parseFloat(item.bundleQuantity.toString()) : null,
        marginPercent: item.marginPercent ? parseFloat(item.marginPercent.toString()) : null
      }))
    }));

    // Get table sales and convert them to sale format for historique
    // Note: TableSale doesn't have depotId field, so we'll fetch all table sales
    // and filter them manually if needed, or skip if depot isolation is critical
    // For now, we'll fetch all table sales (they may not have depot isolation)
    const tableSalesWhereClause = {};
    
    // Apply same date filtering to table sales
    if (startDate && endDate) {
      tableSalesWhereClause.createdAt = { gte: new Date(startDate), lte: new Date(endDate) };
      console.log('Date filter applied:', { startDate, endDate });
    } else {
      console.log('No date filter - will get all table sales');
    }

    if (status) {
      // Map sale status to table sale status
      if (status === 'COMPLETED') {
        tableSalesWhereClause.status = 'COMPLETED';
      } else if (status === 'CANCELLED') {
        tableSalesWhereClause.status = 'CANCELLED';
      } else if (status === 'PENDING' || status === 'TEMPORARY') {
        tableSalesWhereClause.status = 'ACTIVE';
      }
    } else {
      // If no status filter, include all table sales (ACTIVE, COMPLETED, CANCELLED)
      // Temporarily remove status filter to see all table sales
      // tableSalesWhereClause.status = { in: ['ACTIVE', 'COMPLETED', 'CANCELLED'] };
    }

    console.log('Table sales where clause:', tableSalesWhereClause);
    const tableSales = await prisma.tableSale.findMany({
      where: tableSalesWhereClause,
      include: {
        items: {
          include: {
            product: true
          }
        },
        table: true,
        salon: true
      },
      orderBy: { createdAt: 'desc' },
      skip: (parseInt(page) - 1) * parseInt(limit),
      take: parseInt(limit)
    });
    console.log('Found table sales:', tableSales.length);

    // Convert table sales to sale format for historique compatibility
    const convertedTableSales = tableSales.map(tableSale => ({
      id: 9000000 + tableSale.id, // Use high number range to avoid conflicts with regular sales
      total: parseFloat(tableSale.totalAmount),
      discount: 0,
      finalTotal: parseFloat(tableSale.totalAmount),
      paymentMethodId: null,
      paymentMethod: { name: 'Table Service' },
      clientId: null,
      client: null,
      userId: null,
      user: { firstName: 'Table', lastName: 'Service' },
      depotId: targetDepotId,
      sessionId: null,
      session: null,
      status: tableSale.status === 'ACTIVE' ? 'PENDING' : tableSale.status,
      paymentType: 'COMPTANT',
      isWholesale: false,
      advancePayment: 0,
      advancePaymentMethodId: null,
      advancePaymentDate: null,
      advancePaymentNotes: null,
      dailyTicketNumber: `T${tableSale.table.number}`,
      createdAt: tableSale.createdAt,
      updatedAt: tableSale.updatedAt,
      items: tableSale.items.map(item => ({
        id: `table_item_${item.id}`,
        productId: item.productId,
        productName: item.productName,
        quantity: parseFloat(item.quantity),
        unitPrice: parseFloat(item.unitPrice),
        total: parseFloat(item.total),
        discount: 0,
        isWholesale: false,
        product: item.product,
        isPaid: item.isPaid
      })),
      // Add table-specific info
      tableInfo: {
        tableId: tableSale.table.id,
        tableNumber: tableSale.table.number,
        salonId: tableSale.salon.id,
        salonName: tableSale.salon.name,
        paidAmount: parseFloat(tableSale.paidAmount),
        remainingAmount: parseFloat(tableSale.remainingAmount)
      }
    }));

    // Combine and sort all sales by creation date
    const allSales = [...salesWithNumbers, ...convertedTableSales].sort((a, b) => 
      new Date(b.createdAt) - new Date(a.createdAt)
    );

    res.json(allSales);
  } catch (error) {
    console.error('Error fetching sales:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message || 'Unknown error',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Mark sale as printed
router.post('/:id/printed', async (req, res) => {
  try {
    const { id } = req.params;
    // Enforce depot isolation
    const userDepotId = req.user?.depotId;
    if (!userDepotId) {
      return res.status(400).json({ error: 'User must be assigned to a depot to mark printed' });
    }

    const updated = await prisma.sale.update({
      where: { id: parseInt(id) },
      data: { isPrinted: true }
    });
    res.json({ success: true, isPrinted: updated.isPrinted });
  } catch (error) {
    console.error('Error marking sale as printed:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Fetch current session's tickets (sales) ordered by creation time desc
router.get('/current-session/tickets', async (req, res) => {
  try {
    // Enforce depot isolation
    const userDepotId = req.user?.depotId;
    if (!userDepotId) {
      return res.status(400).json({ error: 'User must be assigned to a depot' });
    }

    // Find current OPEN session for this depot (no user linkage)
    const activeSession = await prisma.sessionCaisse.findFirst({
      where: { 
        status: 'OPEN',
        depotId: userDepotId // Filter by depot only, not user
      },
      select: { id: true }
    });

    if (!activeSession) {
      return res.json([]);
    }

    const tickets = await prisma.sale.findMany({
      where: { sessionId: activeSession.id, depotId: userDepotId },
      include: {
        paymentMethod: { select: { name: true } },
        advancePaymentMethod: { select: { name: true } },
        client: { select: { firstName: true, lastName: true, code: true, address: true, matriculeFiscal: true } },
        user: { select: { firstName: true, lastName: true } },
        items: true
      },
      orderBy: { createdAt: 'desc' }
    });

    // Convert Decimal fields to numbers for proper serialization
    const ticketsWithNumbers = tickets.map(ticket => ({
      ...ticket,
      total: ticket.total ? parseFloat(ticket.total.toString()) : 0,
      discount: ticket.discount ? parseFloat(ticket.discount.toString()) : 0,
      finalTotal: ticket.finalTotal ? parseFloat(ticket.finalTotal.toString()) : 0,
      advancePayment: ticket.advancePayment ? parseFloat(ticket.advancePayment.toString()) : 0,
      items: ticket.items.map(item => ({
        ...item,
        quantity: item.quantity ? parseFloat(item.quantity.toString()) : 0,
        unitPrice: item.unitPrice ? parseFloat(item.unitPrice.toString()) : 0,
        total: item.total ? parseFloat(item.total.toString()) : 0,
        discount: item.discount ? parseFloat(item.discount.toString()) : 0,
        bundlePrice: item.bundlePrice ? parseFloat(item.bundlePrice.toString()) : null,
        bundleQuantity: item.bundleQuantity ? parseFloat(item.bundleQuantity.toString()) : null,
        marginPercent: item.marginPercent ? parseFloat(item.marginPercent.toString()) : null
      }))
    }));

    res.json(ticketsWithNumbers);
  } catch (error) {
    console.error('Error fetching current session tickets:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { depotId } = req.query;

    // Enforce depot isolation - use user's depot, visiting depot, or provided depot
    const userDepotId = req.user?.depotId;
    const visitingDepotHeader = req.headers['x-depot-id'];
    const visitingDepotId = visitingDepotHeader ? parseInt(visitingDepotHeader) : null;
    
    // Determine which depot to use: requested > visiting > user's depot
    let targetDepotId = depotId ? parseInt(depotId) : (visitingDepotId || userDepotId);
    
    // For non-admin users, check depot access
    if (req.user?.role !== 'ADMIN') {
      // Allow if accessing own depot
      if (targetDepotId && userDepotId && targetDepotId === userDepotId) {
        // OK - accessing own depot
      }
      // Allow if accessing visiting depot (for MANAGER/CASHIER with visiting depot header)
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
        // Allow access for users without assigned depot (like RESPONSABLE_MAGASIN)
      }
      // Deny if trying to access different depot
      else if (targetDepotId && userDepotId && targetDepotId !== userDepotId) {
        return res.status(403).json({ error: 'Access denied: Cannot access other depot sales' });
      }
      // Deny if no depot available
      else if (!targetDepotId) {
        return res.status(400).json({ error: 'User must be assigned to a depot or specify depotId to view sales' });
      }
    }
    
    if (!targetDepotId) {
      return res.status(400).json({ error: 'depotId is required to view sales' });
    }
    
    const sale = await prisma.sale.findFirst({
      where: { id: parseInt(id), depotId: targetDepotId },
      include: {
        paymentMethod: { select: { name: true } },
        advancePaymentMethod: { select: { name: true } },
        client: { select: { firstName: true, lastName: true, code: true } },
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
    });

    if (!sale) {
      return res.status(404).json({ error: 'Sale not found' });
    }

    // Convert Decimal fields to numbers for proper serialization
    const saleWithNumbers = {
      ...sale,
      total: sale.total ? parseFloat(sale.total.toString()) : 0,
      discount: sale.discount ? parseFloat(sale.discount.toString()) : 0,
      finalTotal: sale.finalTotal ? parseFloat(sale.finalTotal.toString()) : 0,
      advancePayment: sale.advancePayment ? parseFloat(sale.advancePayment.toString()) : 0,
      items: sale.items.map(item => ({
        ...item,
        quantity: item.quantity ? parseFloat(item.quantity.toString()) : 0,
        unitPrice: item.unitPrice ? parseFloat(item.unitPrice.toString()) : 0,
        total: item.total ? parseFloat(item.total.toString()) : 0,
        discount: item.discount ? parseFloat(item.discount.toString()) : 0,
        bundlePrice: item.bundlePrice ? parseFloat(item.bundlePrice.toString()) : null,
        bundleQuantity: item.bundleQuantity ? parseFloat(item.bundleQuantity.toString()) : null,
        marginPercent: item.marginPercent ? parseFloat(item.marginPercent.toString()) : null
      }))
    };

    res.json(saleWithNumbers);
  } catch (error) {
    console.error('Error fetching sale:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id/status', async (req, res) => {
  try {
  const { id } = req.params;
  const { status } = req.body;

    if (!['PENDING', 'COMPLETED', 'CANCELLED', 'REFUNDED'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

  const userDepotId = req.user?.depotId;
  if (!userDepotId) {
    return res.status(400).json({ error: 'User must be assigned to a depot to update sale status' });
  }
  const updated = await prisma.$transaction(async (tx) => {
      // Load sale first to validate depot and current status, include items for stock restoration and client info
      const existing = await tx.sale.findFirst({ 
        where: { id: parseInt(id), depotId: userDepotId },
        include: { items: true, paymentMethod: true, session: true, client: true }
      });
      if (!existing) {
        throw new Error('Sale not found');
      }

      // If status is unchanged, no-op
      if ((existing.status || '').toUpperCase() === (status || '').toUpperCase()) {
        return existing;
      }

      const previousStatus = (existing.status || '').toUpperCase();
      const sale = await tx.sale.update({ where: { id: parseInt(id), depotId: userDepotId }, data: { status } });

      // When canceling a sale, restore stock (for any status that had stock deducted)
      // and handle client debt transactions and cash movements
      if (status === 'CANCELLED') {
        // Restore stock if the sale was completed or had stock deducted
        const shouldRestoreStock = previousStatus === 'COMPLETED' || previousStatus === 'CMD_TERMINEE';
        
        if (shouldRestoreStock && existing.items && existing.items.length > 0) {
          // Restore stock for all items
        for (const item of existing.items) {
          // Calculate actual quantity to restore (handle wholesale bundle quantities)
          const actualQuantityToRestore = (existing.isWholesale && item.isWholesale && item.bundleSize)
            ? (item.bundleQuantity || item.quantity) * item.bundleSize
            : item.quantity;

          // Get current inventory
          const currentInventory = await tx.inventory.findFirst({
            where: {
              depotId: userDepotId,
              productId: item.productId
            }
          });

          if (currentInventory) {
            // Restore quantity by adding it back
            const newQuantity = parseFloat(currentInventory.quantity) + actualQuantityToRestore;
            await tx.inventory.updateMany({
              where: {
                depotId: userDepotId,
                productId: item.productId
              },
              data: {
                quantity: newQuantity
              }
            });
          } else {
            // If no inventory record exists, create one with the restored quantity
            await tx.inventory.create({
              data: {
                depotId: userDepotId,
                productId: item.productId,
                quantity: actualQuantityToRestore
              }
            });
          }

          // Create stock movement to record the restoration
          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              depotId: userDepotId,
              quantity: actualQuantityToRestore,
              type: 'IN',
              reason: `Remboursement - Ticket annulé #${sale.id}`,
              userId: req.user?.id
            }
          });
        }
        }

        // Create cash refund movement if it was a cash sale
        const paymentMethodType = existing.paymentMethod?.type || '';
        const isCashSale = paymentMethodType.toUpperCase() === 'CASH' || 
                          (existing.paymentType || '').toUpperCase() === 'COMPTANT' ||
                          (existing.paymentType || '').toUpperCase() === 'CASH';
        
        if (isCashSale && existing.finalTotal > 0 && existing.session) {
          // Check if a refund movement already exists
          const existingRefunds = await tx.cashMovement.findMany({
            where: {
              ticketId: sale.id,
              type: 'SORTIE'
            }
          });
          const hasRefund = existingRefunds.some(m => 
            String(m.reason || '').includes('Remboursement')
          );

          if (!hasRefund) {
            await tx.cashMovement.create({
              data: {
                sessionId: existing.session.id,
                type: 'SORTIE',
                amount: parseFloat(existing.finalTotal),
                reason: `Remboursement - Ticket annulé #${sale.id}`,
                ticketId: sale.id,
                createdById: req.user?.id
              }
            });
          }
        }

        // Handle client debt transactions - delete or mark them to remove from client statement
        if (existing.clientId) {
          const clientDebtTransactions = await tx.clientDebtTransaction.findMany({
            where: {
              saleId: sale.id
            }
          });

          if (clientDebtTransactions.length > 0) {
            const client = await tx.client.findUnique({ where: { id: existing.clientId } });
            
            if (client) {
              // Calculate total debt and payment amounts to reverse
              let totalDebtToReverse = 0;
              let totalPaymentToReverse = 0;
              
              for (const transaction of clientDebtTransactions) {
                if (transaction.type === 'DEBT') {
                  totalDebtToReverse += parseFloat(transaction.amount || 0);
                } else if (transaction.type === 'PAYMENT') {
                  totalPaymentToReverse += parseFloat(transaction.amount || 0);
                }
              }

              // Reverse the debt: subtract debt, add back payments
              const currentDebt = parseFloat(client.currentDebt || 0);
              const newDebt = Math.max(0, currentDebt - totalDebtToReverse + totalPaymentToReverse);
              
              await tx.client.update({
                where: { id: client.id },
                data: { currentDebt: newDebt }
              });

              // Delete all client debt transactions for this sale
              await tx.clientDebtTransaction.deleteMany({
                where: {
                  saleId: sale.id
                }
              });
            }
          }
        }
      }

      // Revert any legacy cancellation movements by marking them as rejected
      // Mark ALL cash movements related to this ticket (not just SORTIE) as rejected
      if (status === 'CANCELLED') {
        const movements = await tx.cashMovement.findMany({
          where: {
            ticketId: sale.id
          }
        });
        for (const m of movements) {
          const reason = String(m.reason || '');
          const alreadyRejected = reason.includes('[REJETÉ]');
          const isRefund = reason.includes('Remboursement');
          
          // Only mark legacy movements as rejected, not the new refund movements
          // For SORTIE movements, restore expected cash on the movement's session
          if (!alreadyRejected && !isRefund) {
            await tx.cashMovement.update({
              where: { id: m.id },
              data: { reason: `${reason} [REJETÉ]` }
            });
            // Restore expected cash for SORTIE movements (they were subtracted from cash)
            if (['SORTIE', 'DEPOT_COFFRE', 'RETRAIT_CENTRALE'].includes(m.type)) {
              await tx.sessionCaisse.update({
                where: { id: m.sessionId },
                data: { expectedCash: { increment: parseFloat(m.amount || 0) } }
              });
            }
          }
        }
      }

      return sale;
    });

    res.json({ message: 'Sale status updated successfully', sale: updated });
  } catch (error) {
    console.error('Error updating sale status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/payment-methods/all', async (req, res) => {
  try {
    const methods = await prisma.paymentMethod.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
    res.json(methods);
  } catch (error) {
    console.error('Error fetching payment methods:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Wholesale sales endpoint (authenticated)
router.post('/wholesale', authenticateToken, async (req, res) => {
  try {
    const { items, total, discount, finalTotal, paymentMethodId, clientId, amountPaid, paymentType, advancePayment, advancePaymentMethod } = req.body;
    
    // Debug log for wholesale sales
    console.log('Wholesale sale received:', {
      paymentType,
      paymentMethodId,
      amountPaid,
      clientId,
      advancePayment,
      advancePaymentMethod
    });

    // Validate required fields
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Wholesale sale must have at least one item' });
    }

    // Validate numeric values
    const numericTotal = parseFloat(total);
    const numericDiscount = parseFloat(discount || 0);
    const numericFinalTotal = parseFloat(finalTotal);
    
    if (isNaN(numericTotal) || isNaN(numericDiscount) || isNaN(numericFinalTotal)) {
      return res.status(400).json({ error: 'Invalid numeric values for total, discount, or finalTotal' });
    }

    // Use user's assigned depot for stock operations
    const userDepotId = req.user?.depotId;
    if (!userDepotId) {
      return res.status(400).json({ error: 'User must be assigned to a depot to create wholesale sales' });
    }

    // Validate items
    for (const item of items) {
      if (!item.isWholesale) {
        return res.status(400).json({ error: 'All items must be wholesale items for wholesale sales' });
      }
      if (!item.productId || !item.productName) {
        return res.status(400).json({ error: 'Each item must have productId and productName' });
      }
      const itemQuantity = parseFloat(item.quantity || item.bundleQuantity || 0);
      const itemUnitPrice = parseFloat(item.unitPrice || item.bundlePrice || 0);
      if (isNaN(itemQuantity) || isNaN(itemUnitPrice) || itemQuantity <= 0 || itemUnitPrice < 0) {
        return res.status(400).json({ error: 'Invalid quantity or unitPrice for item' });
      }
    }

    const sale = await prisma.$transaction(async (tx) => {
      // Stock validation removed - frontend handles warnings, backend allows all sales

      // Get the current active session for the depot (no user linkage)
      const activeSession = await tx.sessionCaisse.findFirst({
        where: {
          depotId: userDepotId,
          status: 'OPEN'
        }
      });

      // Map payment method strings to IDs when needed
      const paymentMethodMap = { cash: 1, card: 2, check: 3, virement: 4 };
      const advanceAmount = advancePayment !== undefined ? parseFloat(advancePayment) : (amountPaid !== undefined ? parseFloat(amountPaid) : 0);
      const advanceMethodId = advancePaymentMethod ? paymentMethodMap[advancePaymentMethod] : (paymentMethodId ? parseInt(paymentMethodId) : null);

      const newSale = await tx.sale.create({
        data: {
          total: parseFloat(total),
          discount: parseFloat(discount || 0),
          finalTotal: parseFloat(finalTotal),
          paymentMethodId: paymentMethodId ? parseInt(paymentMethodId) : null,
          userId: req.user.id,
          clientId: clientId ? parseInt(clientId) : null,
          depotId: userDepotId, // Use user's depot for wholesale operations
          sessionId: activeSession ? activeSession.id : null,
          status: 'COMPLETED',
          paymentType: paymentType || 'COMPTANT',
          isWholesale: true,
          // Persist advance payment fields when provided (particularly for CREDIT)
          advancePayment: advanceAmount > 0 ? advanceAmount : 0,
          advancePaymentMethodId: advanceAmount > 0 ? advanceMethodId : null,
          advancePaymentDate: advanceAmount > 0 ? new Date() : null,
          advancePaymentNotes: null
        }
      });

      // Debug log for created sale
      console.log('Wholesale sale created:', {
        id: newSale.id,
        paymentType: newSale.paymentType,
        paymentMethodId: newSale.paymentMethodId,
        amountPaid,
        clientId: newSale.clientId
      });

      for (const item of items) {
        // Calculate margin for wholesale items
        let marginPercent = null;
        let requiresApproval = false;
        let isApproved = false;

        const product = await tx.product.findUnique({
          where: { id: item.productId }
        });

        if (!product) {
          throw new Error(`Product with id ${item.productId} not found`);
        }

        if (product.bundlePrice && product.minMargin) {
          const expectedBundleTotal = item.bundleQuantity * product.bundlePrice;
          const actualTotal = parseFloat(item.total);
          const discountAmount = expectedBundleTotal - actualTotal;
          marginPercent = (discountAmount / expectedBundleTotal) * 100;
          
          if (marginPercent > product.minMargin) {
            requiresApproval = true;
            // For now, auto-approve if user has manager/admin role
            isApproved = req.user.role === 'ADMIN' || req.user.role === 'MANAGER';
          }
        }

        await tx.saleItem.create({
          data: {
            saleId: newSale.id,
            productId: item.productId,
            productName: item.productName,
            quantity: item.quantity,
            unitPrice: parseFloat(item.unitPrice),
            total: parseFloat(item.total),
            discount: parseFloat(item.discount || 0),
            // Wholesale fields
            isWholesale: true,
            bundleQuantity: item.bundleQuantity || null,
            bundleSize: item.bundleSize || null,
            bundlePrice: item.bundlePrice || null,
            marginPercent: marginPercent,
            requiresApproval: requiresApproval,
            isApproved: isApproved
          }
        });

        // For wholesale items, calculate the actual quantity to deduct (bundleQuantity * bundle size)
        const bundleSize = parseFloat(item.bundleSize || product.bundleSize || 1);
        if (isNaN(bundleSize) || bundleSize <= 0) {
          throw new Error(`Invalid bundleSize for product ${item.productId}`);
        }
        const bundleQuantity = parseFloat(item.bundleQuantity || item.quantity || 0);
        if (isNaN(bundleQuantity) || bundleQuantity <= 0) {
          throw new Error(`Invalid bundleQuantity for product ${item.productId}`);
        }
        const actualQuantityToDeduct = bundleQuantity * bundleSize;

        console.log('Deducting inventory for wholesale sale:', {
          productId: item.productId,
          productName: item.productName,
          userDepotId: userDepotId,
          bundleQuantity: item.bundleQuantity,
          bundleSize: item.bundleSize,
          actualQuantityToDeduct: actualQuantityToDeduct
        });

        // Get current inventory quantity first
        const currentInventory = await tx.inventory.findFirst({
          where: {
            depotId: userDepotId,
            productId: item.productId
          }
        });

        if (currentInventory) {
          // Calculate new quantity (can be negative)
          const newQuantity = parseFloat(currentInventory.quantity) - actualQuantityToDeduct;
          
          console.log('Updating wholesale inventory:', {
            productId: item.productId,
            currentQuantity: parseFloat(currentInventory.quantity),
            quantityToDeduct: actualQuantityToDeduct,
            newQuantity: newQuantity
          });
          
          await tx.inventory.updateMany({
            where: {
              depotId: userDepotId,
              productId: item.productId
            },
            data: {
              quantity: newQuantity
            }
          });
        } else {
          // If no inventory record exists, create one with negative quantity
          console.log('Creating new wholesale inventory record with negative quantity:', {
            productId: item.productId,
            depotId: userDepotId,
            quantity: -actualQuantityToDeduct
          });
          
          await tx.inventory.create({
            data: {
              depotId: userDepotId,
              productId: item.productId,
              quantity: -actualQuantityToDeduct
            }
          });
        }

        await tx.stockMovement.create({
            data: {
              productId: item.productId,
              depotId: userDepotId, // Use user's depot for stock movement
              quantity: actualQuantityToDeduct,
              type: 'OUT',
              reason: 'Wholesale Sale',
              userId: req.user.id
            }
          });
      }

      // Record cash movement for cash payments in wholesale sales
      const paidAmount = amountPaid !== undefined && amountPaid !== null ? parseFloat(amountPaid) : parseFloat(finalTotal);
      if (paidAmount > 0 && String(paymentType).toLowerCase() === 'cash' && activeSession) {
          await tx.cashMovement.create({
            data: {
              sessionId: activeSession.id,
              type: 'ENTREE',
              amount: paidAmount,
              reason: `Vente gros #${newSale.id}`,
              ticketId: newSale.id,
              createdById: req.user?.id
            }
          });
        }

      let loyaltyPointsEarned = 0;

      if (clientId) {
        let settings = null;
        if (tx.appSettings && typeof tx.appSettings.findFirst === 'function') {
          settings = await tx.appSettings.findFirst();
        }
        const client = await tx.client.findUnique({ where: { id: parseInt(clientId) } });

        const paid = amountPaid !== undefined && amountPaid !== null ? parseFloat(amountPaid) : parseFloat(finalTotal);
        const outstanding = Math.max(0, parseFloat(finalTotal) - paid);

        if (client) {
          // For ESP (instant pay) sales: create only PAYMENT transaction (no debt)
          // For credit sales: create both PAYMENT (if partial payment) and DEBT (if outstanding)
          if (paymentType === 'COMPTANT' || paymentType === 'ESP') {
            // ESP/Instant pay: create only payment transaction (no debt for cash sales)
            if (paid > 0) {
              // Create payment transaction (debit)
              await tx.clientDebtTransaction.create({
                data: {
                  clientId: client.id,
                  saleId: newSale.id,
                  amount: paid,
                  type: 'PAYMENT',
                  userId: req.user?.id,
                  notes: 'Payment at wholesale sale (ESP)'
                }
              });
            }
          } else {
            // Credit sales: handle partial payments and debt
            const paidPart = Math.max(0, paid);
            if (paidPart > 0) {
              await tx.clientDebtTransaction.create({
                data: {
                  clientId: client.id,
                  saleId: newSale.id,
                  amount: paidPart,
                  type: 'PAYMENT',
                  userId: req.user?.id,
                  notes: 'Payment at wholesale sale'
                }
              });
            }
            if (outstanding > 0) {
              // Trust frontend validation; record debt without server-side limit checks
              const newDebt = parseFloat(client.currentDebt || 0) + outstanding;
              await tx.client.update({ where: { id: client.id }, data: { currentDebt: newDebt } });
              await tx.clientDebtTransaction.create({
                data: {
                  clientId: client.id,
                  saleId: newSale.id,
                  amount: outstanding,
                  type: 'DEBT',
                  userId: req.user?.id,
                  notes: 'Debt from wholesale sale'
                }
              });
            }
          }
        }

        if (settings?.loyaltyEnabled) {
          const rate = parseFloat(settings.loyaltyRate || 0);
          loyaltyPointsEarned = Math.floor(parseFloat(finalTotal) * rate);
          if (loyaltyPointsEarned > 0) {
            await tx.client.update({
              where: { id: parseInt(clientId) },
              data: {
                loyaltyPoints: { increment: loyaltyPointsEarned },
                totalSpent: { increment: parseFloat(finalTotal) }
              }
            });
          } else {
            await tx.client.update({
              where: { id: parseInt(clientId) },
              data: { totalSpent: { increment: parseFloat(finalTotal) } }
            });
          }
        } else {
          await tx.client.update({
            where: { id: parseInt(clientId) },
            data: { totalSpent: { increment: parseFloat(finalTotal) } }
          });
        }
      }

      return { newSale, loyaltyPointsEarned };
    });

    const saleWithDetails = await prisma.sale.findUnique({
      where: { id: sale.newSale.id },
      include: {
        paymentMethod: { select: { name: true } },
        client: { select: { firstName: true, lastName: true, code: true } },
        items: true
      }
    });

    if (!saleWithDetails) {
      return res.status(500).json({ error: 'Sale created but could not be retrieved' });
    }

    res.status(201).json({ ...saleWithDetails, loyaltyPointsEarned: sale.loyaltyPointsEarned });
  } catch (error) {
    console.error('Error creating wholesale sale:', error);
    const errorMessage = error.message || 'Internal server error';
    console.error('Error details:', {
      message: errorMessage,
      stack: error.stack,
      body: req.body
    });
    res.status(500).json({ error: errorMessage });
  }
});

// Public wholesale sales endpoint (no authentication required)
router.post('/wholesale', async (req, res) => {
  try {
    const { items, total, discount, finalTotal, paymentMethodId, clientId, amountPaid, paymentType } = req.body;

    // Validate required fields
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Wholesale sale must have at least one item' });
    }

    // Validate numeric values
    const numericTotal = parseFloat(total);
    const numericDiscount = parseFloat(discount || 0);
    const numericFinalTotal = parseFloat(finalTotal);
    
    if (isNaN(numericTotal) || isNaN(numericDiscount) || isNaN(numericFinalTotal)) {
      return res.status(400).json({ error: 'Invalid numeric values for total, discount, or finalTotal' });
    }

    // Validate items
    for (const item of items) {
      if (!item.isWholesale) {
        return res.status(400).json({ error: 'All items must be wholesale items for wholesale sales' });
      }
      if (!item.productId || !item.productName) {
        return res.status(400).json({ error: 'Each item must have productId and productName' });
      }
      const itemQuantity = parseFloat(item.quantity);
      const itemUnitPrice = parseFloat(item.unitPrice);
      if (isNaN(itemQuantity) || isNaN(itemUnitPrice) || itemQuantity <= 0 || itemUnitPrice < 0) {
        return res.status(400).json({ error: 'Invalid quantity or unitPrice for item' });
      }
    }

    // For unauthenticated requests, use a default depot or the first available depot
    let userDepotId;
    try {
      const defaultDepot = await prisma.depot.findFirst({
        where: { isActive: true },
        orderBy: { id: 'asc' }
      });
      if (!defaultDepot) {
        return res.status(500).json({ error: 'No active depot found. Please contact administrator.' });
      }
      userDepotId = defaultDepot.id;
    } catch (error) {
      console.error('Error finding default depot:', error);
      return res.status(500).json({ error: 'Error finding default depot: ' + error.message });
    }

    const sale = await prisma.$transaction(async (tx) => {
      // Stock validation removed - frontend handles warnings, backend allows all sales

      // Get the current active session for the depot (no user linkage)
      const activeSession = await tx.sessionCaisse.findFirst({
        where: {
          depotId: userDepotId,
          status: 'OPEN'
        }
      });

      const newSale = await tx.sale.create({
        data: {
          total: parseFloat(total),
          discount: parseFloat(discount || 0),
          finalTotal: parseFloat(finalTotal),
          paymentMethodId: paymentMethodId ? parseInt(paymentMethodId) : null,
          userId: null, // No user for unauthenticated sales
          clientId: clientId ? parseInt(clientId) : null,
          depotId: userDepotId,
          sessionId: activeSession ? activeSession.id : null,
          status: 'COMPLETED',
          paymentType: paymentType || 'COMPTANT',
          isWholesale: true
        }
      });

      // Create sale items
      const saleItems = [];
      for (const item of items) {
        const saleItem = await tx.saleItem.create({
          data: {
            saleId: newSale.id,
            productId: item.productId,
            productName: item.productName,
            quantity: parseFloat(item.quantity),
            unitPrice: parseFloat(item.unitPrice),
            total: parseFloat(item.total),
            isWholesale: true
          }
        });
        saleItems.push(saleItem);

        // Calculate margin for wholesale items
        const product = await tx.product.findUnique({
          where: { id: item.productId }
        });

        if (!product) {
          throw new Error(`Product with id ${item.productId} not found`);
        }

        const costPrice = parseFloat(product.prix_achat_HT || 0);
        const sellingPrice = parseFloat(item.unitPrice);
        const margin = sellingPrice - costPrice;
        const marginPercentage = costPrice > 0 ? (margin / costPrice) * 100 : 0;

        await tx.saleItem.update({
          where: { id: saleItem.id },
          data: {
            costPrice: costPrice,
            margin: margin,
            marginPercentage: marginPercentage
          }
        });

        // For wholesale items, calculate the actual quantity to deduct (bundleQuantity * bundle size)
        const bundleQuantity = parseFloat(item.quantity);
        const bundleSize = parseFloat(product.bundleSize || 1);
        if (isNaN(bundleSize) || bundleSize <= 0) {
          throw new Error(`Invalid bundleSize for product ${item.productId}`);
        }
        const actualQuantityToDeduct = bundleQuantity * bundleSize;

        // Check if inventory exists for this product in this depot
        const existingInventory = await tx.inventory.findFirst({
          where: {
            productId: item.productId,
            depotId: userDepotId
          }
        });

        if (existingInventory) {
          const newQuantity = existingInventory.quantity - actualQuantityToDeduct;
          console.log('Updating wholesale inventory:', {
            productId: item.productId,
            depotId: userDepotId,
            oldQuantity: existingInventory.quantity,
            quantityToDeduct: actualQuantityToDeduct,
            newQuantity: newQuantity
          });

          await tx.inventory.update({
            where: { id: existingInventory.id },
            data: { quantity: newQuantity }
          });
        } else {
          // Create new inventory record with negative quantity
          console.log('Creating new wholesale inventory record with negative quantity:', {
            productId: item.productId,
            depotId: userDepotId,
            quantity: -actualQuantityToDeduct
          });

          await tx.inventory.create({
            data: {
              productId: item.productId,
              depotId: userDepotId,
              quantity: -actualQuantityToDeduct
            }
          });
        }
      }

      // Record cash movement for cash payments in public wholesale sales
      const paidAmount = amountPaid !== undefined && amountPaid !== null ? parseFloat(amountPaid) : parseFloat(finalTotal);
      if (paidAmount > 0 && String(paymentType).toLowerCase() === 'cash' && activeSession) {
        await tx.cashMovement.create({
          data: {
            sessionId: activeSession.id,
            type: 'ENTREE',
            amount: paidAmount,
            reason: `Vente gros public #${newSale.id}`,
            ticketId: newSale.id,
            createdById: null // No user for public sales
          }
        });
      }

      // Payment is already recorded in the Sale model via paymentMethodId
      // No need to create a separate Payment record

      // Handle debt if amount paid is less than final total
      const remainingAmount = parseFloat(finalTotal) - parseFloat(amountPaid || 0);
      if (remainingAmount > 0 && clientId) {
        // Get client to update currentDebt
        const client = await tx.client.findUnique({ where: { id: parseInt(clientId) } });
        if (client) {
          const newDebt = parseFloat(client.currentDebt || 0) + remainingAmount;
          await tx.client.update({
            where: { id: client.id },
            data: { currentDebt: newDebt }
          });
          
          // Create debt transaction (userId is required, use null or find a system user)
          // For public sales, we'll use null userId if allowed, otherwise find a system user
          let systemUserId = null;
          try {
            const systemUser = await tx.user.findFirst({
              where: { role: 'ADMIN' },
              orderBy: { id: 'asc' }
            });
            systemUserId = systemUser ? systemUser.id : null;
          } catch (e) {
            console.warn('Could not find system user for debt transaction:', e);
          }
          
          if (systemUserId) {
            await tx.clientDebtTransaction.create({
              data: {
                clientId: parseInt(clientId),
                saleId: newSale.id,
                amount: remainingAmount,
                type: 'DEBT',
                userId: systemUserId,
                notes: 'Debt from public wholesale sale'
              }
            });
          }
        }
      }

      return newSale;
    });

    // Get the complete sale with all details for response
    const saleWithDetails = await prisma.sale.findUnique({
      where: { id: sale.id },
      include: {
        items: true,
        client: true,
        payments: true,
        debts: true
      }
    });

    if (!saleWithDetails) {
      return res.status(500).json({ error: 'Sale created but could not be retrieved' });
    }

    res.status(201).json(saleWithDetails);
  } catch (error) {
    console.error('Error creating public wholesale sale:', error);
    const errorMessage = error.message || 'Internal server error';
    console.error('Error details:', {
      message: errorMessage,
      stack: error.stack,
      body: req.body
    });
    res.status(500).json({ error: errorMessage });
  }
});

module.exports = router; 