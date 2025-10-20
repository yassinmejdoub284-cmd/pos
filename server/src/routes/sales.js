const express = require('express');
const { prisma } = require('../lib/prisma');
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
        const userDepotId = req.user.depotId;
        
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
            userId: req.user.id,
            clientId: clientId ? parseInt(clientId) : null,
            depotId: userDepotId, // Use user's depot for caisse operations
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
            depotId: userDepotId,
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
              depotId: userDepotId,
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
            reason: isWholesale && item.isWholesale ? 'Wholesale Sale' : 'Sale',
            userId: req.user.id
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
                  userId: req.user.id,
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
                  userId: req.user.id,
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
        depotId: userDepotId,
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
    const userDepotId = req.user.depotId;

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
          depotId: userDepotId,
          status: 'OPEN'
        }
      });

      const newSale = await tx.sale.create({
        data: {
          total: parseFloat(total),
          discount: parseFloat(discount || 0),
          finalTotal: finalTotalAmount,
          paymentMethodId: null,
          userId: req.user.id,
          clientId: clientId ? parseInt(clientId) : null,
          depotId: userDepotId, // Use shop depot for caisse operations
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
            createdById: req.user.id
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
    const userDepotId = req.user.depotId;

    const temporarySale = await prisma.sale.findFirst({
      where: { id: parseInt(id), status: 'TEMPORARY', depotId: req.user.depotId },
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
            depotId: userDepotId,
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
              depotId: userDepotId,
              productId: item.productId,
              quantity: -item.quantity
            }
          });
        }

        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            depotId: userDepotId, // Use shop depot for caisse operations
            quantity: item.quantity,
            type: 'OUT',
            reason: 'Temporary Sale Completed',
            userId: req.user.id
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
            createdById: req.user.id
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
              userId: req.user.id, 
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

    const temporarySale = await prisma.sale.findFirst({
      where: { id: parseInt(id), status: 'TEMPORARY', depotId: req.user.depotId }
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
        const activeSession = await tx.sessionCaisse.findFirst({ where: { depotId: req.user.depotId, status: 'OPEN' } });
        if (activeSession) {
          await tx.cashMovement.create({
            data: {
              sessionId: activeSession.id,
              type: 'ENTREE',
              amount: advanceAmount,
              reason: `Acompte commande #${updated.id}`,
              ticketId: null,
              createdById: req.user.id
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

router.post('/gift', async (req, res) => {
  try {
    const { items, total, discount, finalTotal, reason, recipient, status, clientId } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'Gift sale must have at least one item' });
    }

    // Use user's assigned depot for stock operations
    const userDepotId = req.user.depotId;

    if (!reason || reason.trim() === '') {
      return res.status(400).json({ error: 'Gift reason is required' });
    }

    const sale = await prisma.$transaction(async (tx) => {
      const newSale = await tx.sale.create({
        data: {
          total: parseFloat(total),
          discount: parseFloat(discount || 0),
          finalTotal: 0,
          paymentMethodId: null,
          userId: req.user.id,
          clientId: clientId ? parseInt(clientId) : null,
          depotId: userDepotId, // Use shop depot for caisse operations
          status: 'PENDING_ADMIN',
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
      }

      return newSale;
    });

    const saleWithDetails = await prisma.sale.findUnique({
      where: { id: sale.id },
      include: { items: true, client: { select: { firstName: true, lastName: true, code: true } } }
    });

    // Send push notification for new gift
    try {
      await sendPushToAll({
        title: 'Nouveau Cadeau',
        body: `Cadeau de ${finalTotal} DT - ${items.length} articles par ${req.user.firstName} ${req.user.lastName}`,
        data: { type: 'GIFT', id: saleWithDetails.id, depotId: saleWithDetails.depotId }
      });
    } catch (e) {
      console.warn('[sales.gift] Failed to send push notification:', e);
    }

    res.status(201).json(saleWithDetails);
  } catch (error) {
    console.error('Error creating gift sale:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/gift/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    const userDepotId = req.user.depotId;

    const giftSale = await prisma.sale.findFirst({
      where: { id: parseInt(id), status: 'PENDING_ADMIN', depotId: req.user.depotId },
      include: { items: true }
    });

    if (!giftSale) {
      return res.status(404).json({ error: 'Gift sale not found or already processed' });
    }

    const sale = await prisma.$transaction(async (tx) => {
      const updatedSale = await tx.sale.update({
        where: { id: parseInt(id) },
        data: { status: 'CADEAU', updatedAt: new Date() }
      });

      for (const item of giftSale.items) {
        // Get current inventory quantity first
        const currentInventory = await tx.inventory.findFirst({
          where: {
            depotId: userDepotId,
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
              depotId: userDepotId,
              productId: item.productId,
              quantity: -item.quantity
            }
          });
        }

        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            depotId: userDepotId, // Use shop depot for caisse operations
            quantity: item.quantity,
            type: 'OUT',
            reason: 'Gift Sale Approved',
            userId: req.user.id
          }
        });
      }

      return updatedSale;
    });

    const saleWithDetails = await prisma.sale.findUnique({ where: { id: sale.id }, include: { items: true, client: { select: { firstName: true, lastName: true, code: true } } } });

    res.json(saleWithDetails);
  } catch (error) {
    console.error('Error approving gift sale:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/gift/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;

    const giftSale = await prisma.sale.findFirst({ where: { id: parseInt(id), status: 'PENDING_ADMIN', depotId: req.user.depotId } });

    if (!giftSale) {
      return res.status(404).json({ error: 'Gift sale not found or already processed' });
    }

    const updatedSale = await prisma.sale.update({ where: { id: parseInt(id) }, data: { status: 'CANCELLED', updatedAt: new Date() } });

    res.json(updatedSale);
  } catch (error) {
    console.error('Error rejecting gift sale:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/', async (req, res) => {
  try {
    const { startDate, endDate, status, paymentMethod, page = 1, limit = 1000, sessionIds } = req.query;

    // Enforce depot isolation - only show sales from user's depot
    const userDepotId = req.user.depotId;
    if (!userDepotId) {
      return res.status(400).json({ error: 'User must be assigned to a depot to view sales' });
    }
    
    const whereClause = { depotId: userDepotId };

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
        client: { select: { firstName: true, lastName: true, code: true } },
        user: { select: { firstName: true, lastName: true } },
        items: true,
        session: { select: { id: true } }
      },
      orderBy: { createdAt: 'desc' },
      skip: (parseInt(page) - 1) * parseInt(limit),
      take: parseInt(limit)
    });

    // Get table sales and convert them to sale format for historique
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
      depotId: userDepotId,
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
    const allSales = [...sales, ...convertedTableSales].sort((a, b) => 
      new Date(b.createdAt) - new Date(a.createdAt)
    );

    res.json(allSales);
  } catch (error) {
    console.error('Error fetching sales:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Mark sale as printed
router.post('/:id/printed', async (req, res) => {
  try {
    const { id } = req.params;
    // Enforce depot isolation
    const userDepotId = req.user.depotId;
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
    const userDepotId = req.user.depotId;
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
        client: { select: { firstName: true, lastName: true, code: true, address: true, matriculeFiscal: true } },
        user: { select: { firstName: true, lastName: true } },
        items: true
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(tickets);
  } catch (error) {
    console.error('Error fetching current session tickets:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Enforce depot isolation for individual sale access
    const userDepotId = req.user.depotId;
    if (!userDepotId) {
      return res.status(400).json({ error: 'User must be assigned to a depot to view sales' });
    }
    
    const sale = await prisma.sale.findFirst({
      where: { id: parseInt(id), depotId: userDepotId },
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

    res.json(sale);
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

  const userDepotId = req.user.depotId;
  const updated = await prisma.$transaction(async (tx) => {
      // Load sale first to validate depot and current status
      const existing = await tx.sale.findFirst({ where: { id: parseInt(id), depotId: userDepotId } });
      if (!existing) {
        throw new Error('Sale not found');
      }

      // If status is unchanged, no-op
      if ((existing.status || '').toUpperCase() === (status || '').toUpperCase()) {
        return existing;
      }

      const sale = await tx.sale.update({ where: { id: parseInt(id), depotId: userDepotId }, data: { status } });

      // Do not create cash movements on CANCELLED; sales summary excludes CANCELLED to avoid double subtraction
      // Also revert any legacy cancellation movements by marking them as rejected and restoring expected cash
      if (status === 'CANCELLED') {
        // Find any previous cancellation movements tied to this sale and mark them rejected
        const movements = await tx.cashMovement.findMany({
          where: {
            ticketId: sale.id,
            type: 'SORTIE'
          }
        });
        for (const m of movements) {
          const alreadyRejected = String(m.reason || '').includes('[REJETÉ]');
          if (!alreadyRejected) {
            await tx.cashMovement.update({
              where: { id: m.id },
              data: { reason: `${m.reason || ''} [REJETÉ]` }
            });
            // Restore expected cash on the movement's session
            await tx.sessionCaisse.update({
              where: { id: m.sessionId },
              data: { expectedCash: { increment: parseFloat(m.amount || 0) } }
            });
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

// Wholesale sales endpoint
router.post('/wholesale', async (req, res) => {
  try {
    const { items, total, discount, finalTotal, paymentMethodId, clientId, amountPaid, paymentType } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'Wholesale sale must have at least one item' });
    }

    // Use user's assigned depot for stock operations
    const userDepotId = req.user.depotId;

    // Validate that all items are wholesale items
    for (const item of items) {
      if (!item.isWholesale) {
        return res.status(400).json({ error: 'All items must be wholesale items for wholesale sales' });
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

      const newSale = await tx.sale.create({
        data: {
          total: parseFloat(total),
          discount: parseFloat(discount || 0),
          finalTotal: parseFloat(finalTotal),
          paymentMethodId: paymentMethodId ? parseInt(paymentMethodId) : null,
          userId: req.user.id,
          clientId: clientId ? parseInt(clientId) : null,
          depotId: userDepotId, // Use shop depot for caisse operations
          sessionId: activeSession ? activeSession.id : null,
          status: 'COMPLETED',
          paymentType: paymentType || 'COMPTANT',
          isWholesale: true
        }
      });

      for (const item of items) {
        // Calculate margin for wholesale items
        let marginPercent = null;
        let requiresApproval = false;
        let isApproved = false;

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
        const actualQuantityToDeduct = item.bundleSize ? (item.bundleQuantity || item.quantity) * item.bundleSize : item.quantity;

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
          // Record payment part if any
          const paidPart = Math.max(0, paid);
          if (paidPart > 0) {
            await tx.clientDebtTransaction.create({
              data: {
                clientId: client.id,
                saleId: newSale.id,
                amount: paidPart,
                type: 'PAYMENT',
                userId: req.user.id,
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
                userId: req.user.id,
                notes: 'Debt from wholesale sale'
              }
            });
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

    res.status(201).json({ ...saleWithDetails, loyaltyPointsEarned: sale.loyaltyPointsEarned });
  } catch (error) {
    console.error('Error creating wholesale sale:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

module.exports = router; 