const express = require('express');
const { prisma } = require('../lib/prisma');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

router.post('/', requireRole(['ADMIN', 'MANAGER', 'CASHIER']), async (req, res) => {
  try {
    const { items, total, discount, finalTotal, paymentMethodId, clientId, amountPaid, isWholesale, paymentType, advancePayment, advancePaymentMethod } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'Sale must have at least one item' });
    }

    const sale = await prisma.$transaction(async (tx) => {
      // Check stock availability before creating the sale
      for (const item of items) {
        const inventory = await tx.inventory.findUnique({
          where: {
            depotId_productId: {
              depotId: req.user.depotId,
              productId: item.productId
            }
          }
        });

        if (!inventory || inventory.quantity < item.quantity) {
          throw new Error(`Stock insuffisant pour le produit "${item.productName}". Disponible: ${inventory?.quantity || 0}, Demandé: ${item.quantity}`);
        }
      }

      // Get the current active session for the user
      const activeSession = await tx.sessionCaisse.findFirst({
        where: {
          userId: req.user.id,
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
          depotId: req.user.depotId,
          sessionId: activeSession ? activeSession.id : null,
          status: 'COMPLETED',
          paymentType: paymentType || 'COMPTANT',
          // Persist advance payment fields when provided (particularly for CREDIT)
          advancePayment: advanceAmount > 0 ? advanceAmount : 0,
          advancePaymentMethodId: advanceAmount > 0 ? advanceMethodId : null,
          advancePaymentDate: advanceAmount > 0 ? new Date() : null,
          advancePaymentNotes: null
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

        await tx.inventory.updateMany({
          where: {
            depotId: req.user.depotId,
            productId: item.productId
          },
          data: {
            quantity: {
              decrement: item.quantity
            }
          }
        });

        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            depotId: req.user.depotId,
            quantity: item.quantity,
            type: 'OUT',
            reason: 'Sale',
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

            // NO separate transactions - the sale record itself will show everything
            // The client statement will calculate debit/credit from the sale record
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

    res.status(201).json({ ...saleWithDetails, loyaltyPointsEarned: sale.loyaltyPointsEarned });
  } catch (error) {
    console.error('Error creating sale:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

router.post('/temporary', requireRole(['ADMIN', 'MANAGER', 'CASHIER']), async (req, res) => {
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
      const newSale = await tx.sale.create({
        data: {
          total: parseFloat(total),
          discount: parseFloat(discount || 0),
          finalTotal: finalTotalAmount,
          paymentMethodId: null,
          userId: req.user.id,
          clientId: clientId ? parseInt(clientId) : null,
          depotId: req.user.depotId,
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

router.put('/temporary/:id/complete', requireRole(['ADMIN', 'MANAGER', 'CASHIER']), async (req, res) => {
  try {
    const { id } = req.params;
    const { paymentType, amountPaid, chequeId, encaissementDate, virementNumber } = req.body;

    const temporarySale = await prisma.sale.findFirst({
      where: { id: parseInt(id), status: 'TEMPORARY', depotId: req.user.depotId },
      include: { items: true }
    });

    if (!temporarySale) {
      return res.status(404).json({ error: 'Temporary sale not found' });
    }

    const paymentMethodMap = { cash: 1, card: 2, check: 3, virement: 4 };

    const result = await prisma.$transaction(async (tx) => {
      // Check stock availability before completing the temporary sale
      for (const item of temporarySale.items) {
        const inventory = await tx.inventory.findUnique({
          where: {
            depotId_productId: {
              depotId: req.user.depotId,
              productId: item.productId
            }
          }
        });

        if (!inventory || inventory.quantity < item.quantity) {
          throw new Error(`Stock insuffisant pour le produit "${item.productName}". Disponible: ${inventory?.quantity || 0}, Demandé: ${item.quantity}`);
        }
      }

      const updatedSale = await tx.sale.update({
        where: { id: parseInt(id) },
        data: {
          status: 'CMD_TERMINEE',
          paymentMethodId: paymentMethodMap[paymentType] || null,
          expectedDate: null,
          notes: null,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });

      for (const item of temporarySale.items) {
        await tx.inventory.updateMany({
          where: { depotId: req.user.depotId, productId: item.productId },
          data: { quantity: { decrement: item.quantity } }
        });

        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            depotId: req.user.depotId,
            quantity: item.quantity,
            type: 'OUT',
            reason: 'Temporary Sale Completed',
            userId: req.user.id
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

router.post('/gift', requireRole(['ADMIN', 'MANAGER', 'CASHIER']), async (req, res) => {
  try {
    const { items, total, discount, finalTotal, reason, recipient, status, clientId } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'Gift sale must have at least one item' });
    }

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
          depotId: req.user.depotId,
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

    res.status(201).json(saleWithDetails);
  } catch (error) {
    console.error('Error creating gift sale:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/gift/:id/approve', requireRole(['ADMIN', 'MANAGER']), async (req, res) => {
  try {
    const { id } = req.params;

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
        await tx.inventory.updateMany({
          where: { depotId: req.user.depotId, productId: item.productId },
          data: { quantity: { decrement: item.quantity } }
        });

        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            depotId: req.user.depotId,
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

router.put('/gift/:id/reject', requireRole(['ADMIN', 'MANAGER']), async (req, res) => {
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

router.get('/', requireRole(['ADMIN', 'MANAGER', 'CASHIER']), async (req, res) => {
  try {
    const { startDate, endDate, status, paymentMethod, page = 1, limit = 50 } = req.query;

    const whereClause = { depotId: req.user.depotId };

    if (startDate && endDate) {
      whereClause.createdAt = { gte: new Date(startDate), lte: new Date(endDate) };
    }

    if (status) whereClause.status = status;

    if (paymentMethod) whereClause.paymentMethodId = parseInt(paymentMethod);

    const sales = await prisma.sale.findMany({
      where: whereClause,
      include: {
        paymentMethod: { select: { name: true } },
        client: { select: { firstName: true, lastName: true, code: true } },
        user: { select: { firstName: true, lastName: true } },
        items: true
      },
      orderBy: { createdAt: 'desc' },
      skip: (parseInt(page) - 1) * parseInt(limit),
      take: parseInt(limit)
    });

    res.json(sales);
  } catch (error) {
    console.error('Error fetching sales:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const sale = await prisma.sale.findFirst({
      where: { id: parseInt(id), depotId: req.user.depotId },
      include: {
        paymentMethod: { select: { name: true } },
        advancePaymentMethod: { select: { name: true } },
        client: { select: { firstName: true, lastName: true, code: true } },
        user: { select: { firstName: true, lastName: true } },
        items: true
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

router.put('/:id/status', requireRole(['ADMIN', 'MANAGER']), async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['PENDING', 'COMPLETED', 'CANCELLED', 'REFUNDED'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    await prisma.sale.update({ where: { id: parseInt(id), depotId: req.user.depotId }, data: { status } });

    res.json({ message: 'Sale status updated successfully' });
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
router.post('/wholesale', requireRole(['ADMIN', 'MANAGER', 'CASHIER']), async (req, res) => {
  try {
    const { items, total, discount, finalTotal, paymentMethodId, clientId, amountPaid, paymentType } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'Wholesale sale must have at least one item' });
    }

    // Validate that all items are wholesale items
    for (const item of items) {
      if (!item.isWholesale) {
        return res.status(400).json({ error: 'All items must be wholesale items for wholesale sales' });
      }
    }

    const sale = await prisma.$transaction(async (tx) => {
      // Check stock availability before creating the sale
      for (const item of items) {
        const inventory = await tx.inventory.findUnique({
          where: {
            depotId_productId: {
              depotId: req.user.depotId,
              productId: item.productId
            }
          }
        });

        if (!inventory || inventory.quantity < item.quantity) {
          throw new Error(`Stock insuffisant pour le produit "${item.productName}". Disponible: ${inventory?.quantity || 0}, Demandé: ${item.quantity}`);
        }
      }

      // Get the current active session for the user
      const activeSession = await tx.sessionCaisse.findFirst({
        where: {
          userId: req.user.id,
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
          depotId: req.user.depotId,
          sessionId: activeSession ? activeSession.id : null,
          status: 'COMPLETED',
          paymentType: paymentType || 'COMPTANT'
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

        await tx.inventory.updateMany({
          where: {
            depotId: req.user.depotId,
            productId: item.productId
          },
          data: {
            quantity: {
              decrement: item.quantity
            }
          }
        });

        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            depotId: req.user.depotId,
            quantity: item.quantity,
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

        if (outstanding > 0 && client) {
          // Trust frontend validation; record debt without server-side limit checks
          const newDebt = parseFloat(client.currentDebt || 0) + outstanding;
          await tx.client.update({
            where: { id: client.id },
            data: { currentDebt: newDebt }
          });

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