const express = require('express');
const { prisma } = require('../lib/prisma');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// List client payments
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { clientId, startDate, endDate, page = 1, limit = 50 } = req.query;
    const pageNum = Number(page) > 0 ? Number(page) : 1;
    const limitNum = Number(limit) > 0 && Number(limit) <= 500 ? Number(limit) : 50;

    const where = { type: 'PAYMENT' };
    if (clientId) where.clientId = Number(clientId);
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const payments = await prisma.clientDebtTransaction.findMany({
      where,
      include: {
        client: { select: { id: true, code: true, firstName: true, lastName: true } },
        user: { select: { id: true, firstName: true, lastName: true } }
      },
      orderBy: { createdAt: 'desc' },
      skip: (pageNum - 1) * limitNum,
      take: limitNum
    });

    res.json(payments);
  } catch (error) {
    console.error('Error fetching client payments:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des règlements clients' });
  }
});

// Create client payment
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { clientId, amount, notes, saleId, paymentDate } = req.body;
    if (!clientId || !amount) {
      return res.status(400).json({ error: 'Client et montant sont requis' });
    }

    const payment = await prisma.$transaction(async (tx) => {
      // Create the payment transaction (Débit entry)
      const paymentTransaction = await tx.clientDebtTransaction.create({
        data: {
          clientId: Number(clientId),
          saleId: saleId ? Number(saleId) : null,
          amount: Number(amount),
          type: 'PAYMENT',
          notes: notes?.trim() || 'Débit - Règlement client',
          userId: req.user.id,
          createdAt: paymentDate ? new Date(paymentDate) : new Date()
        }
      });

      // Update client's current debt (reduce it by the payment amount)
      const client = await tx.client.findUnique({ where: { id: Number(clientId) } });
      if (client) {
        const newDebt = Math.max(0, parseFloat(client.currentDebt || 0) - Number(amount));
        await tx.client.update({
          where: { id: Number(clientId) },
          data: { currentDebt: newDebt }
        });
      }

      return paymentTransaction;
    });

    const paymentWithDetails = await prisma.clientDebtTransaction.findUnique({
      where: { id: payment.id },
      include: {
        client: { select: { id: true, code: true, firstName: true, lastName: true } },
        user: { select: { id: true, firstName: true, lastName: true } }
      }
    });

    res.status(201).json(paymentWithDetails);
  } catch (error) {
    console.error('Error creating client payment:', error);
    res.status(500).json({ error: 'Erreur lors de la création du règlement client' });
  }
});

// Get client payment by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const payment = await prisma.clientDebtTransaction.findUnique({
      where: { 
        id,
        type: 'PAYMENT'
      },
      include: {
        client: { select: { id: true, code: true, firstName: true, lastName: true } },
        user: { select: { id: true, firstName: true, lastName: true } }
      }
    });

    if (!payment) {
      return res.status(404).json({ error: 'Règlement client non trouvé' });
    }

    res.json(payment);
  } catch (error) {
    console.error('Error fetching client payment:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération du règlement client' });
  }
});

// Delete client payment
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const existing = await prisma.clientDebtTransaction.findUnique({ where: { id } });
    if (!existing || existing.type !== 'PAYMENT') {
      return res.status(404).json({ error: 'Règlement client non trouvé' });
    }
    await prisma.clientDebtTransaction.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting client payment:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression du règlement client' });
  }
});

module.exports = router;


