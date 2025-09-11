const express = require('express');
const { prisma } = require('../lib/prisma');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get all supplier payments
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { supplierId, startDate, endDate, page = 1, limit = 50 } = req.query;

    // Coerce and sanitize pagination params
    const pageNum = Number(page) > 0 ? Number(page) : 1;
    const limitNum = Number(limit) > 0 && Number(limit) <= 500 ? Number(limit) : 50;

    const whereClause = {};

    if (supplierId !== undefined && supplierId !== null && supplierId !== '') {
      const parsedSupplierId = Number(supplierId);
      if (!Number.isNaN(parsedSupplierId)) {
        whereClause.supplierId = parsedSupplierId;
      }
    }

    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
        whereClause.paymentDate = { gte: start, lte: end };
      }
    }

    let payments;
    const hasSupplierPaymentModel = prisma.supplierPayment && typeof prisma.supplierPayment.findMany === 'function';

    if (hasSupplierPaymentModel) {
      payments = await prisma.supplierPayment.findMany({
        where: whereClause,
        include: {
          supplier: { select: { id: true, name: true, contactName: true } },
          user: { select: { id: true, firstName: true, lastName: true } }
        },
        orderBy: { paymentDate: 'desc' },
        skip: (pageNum - 1) * limitNum,
        take: limitNum
      });
    } else {
      // Fallback to raw SQL if Prisma client is out-of-date and model isn't generated yet
      const conditions = [];
      const params = [];
      if (whereClause.supplierId) {
        params.push(whereClause.supplierId);
        conditions.push(`sp.supplier_id = ?`);
      }
      if (whereClause.paymentDate && whereClause.paymentDate.gte && whereClause.paymentDate.lte) {
        params.push(whereClause.paymentDate.gte, whereClause.paymentDate.lte);
        conditions.push(`sp.payment_date BETWEEN ? AND ?`);
      }
      const whereSql = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      params.push(limitNum, (pageNum - 1) * limitNum);
      const sql = `
        SELECT 
          sp.id, sp.supplier_id AS supplierId, sp.amount, sp.payment_date AS paymentDate,
          sp.payment_method AS paymentMethod, sp.reference, sp.notes, sp.user_id AS userId,
          s.id AS s_id, s.name AS s_name, s.contact_name AS s_contactName,
          u.id AS u_id, u.first_name AS u_firstName, u.last_name AS u_lastName
        FROM supplier_payments sp
        LEFT JOIN suppliers s ON s.id = sp.supplier_id
        LEFT JOIN users u ON u.id = sp.user_id
        ${whereSql}
        ORDER BY sp.payment_date DESC
        LIMIT ? OFFSET ?`;
      const rows = await prisma.$queryRawUnsafe(sql, ...params);
      payments = rows.map(r => ({
        id: r.id,
        supplierId: r.supplierId,
        amount: r.amount,
        paymentDate: r.paymentDate,
        paymentMethod: r.paymentMethod,
        reference: r.reference,
        notes: r.notes,
        userId: r.userId,
        supplier: { id: r.s_id, name: r.s_name, contactName: r.s_contactName },
        user: { id: r.u_id, firstName: r.u_firstName, lastName: r.u_lastName }
      }));
    }

    res.json(payments);
  } catch (error) {
    console.error('Error fetching supplier payments:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des paiements fournisseurs' });
  }
});

// Get supplier payment by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const payment = await prisma.supplierPayment.findUnique({
      where: { id: parseInt(id) },
      include: {
        supplier: true,
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });

    if (!payment) {
      return res.status(404).json({ error: 'Paiement fournisseur non trouvé' });
    }

    res.json(payment);
  } catch (error) {
    console.error('Error fetching supplier payment:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération du paiement fournisseur' });
  }
});

// Create new supplier payment
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      supplierId,
      amount,
      paymentDate,
      paymentMethod,
      reference,
      notes,
      expenseIds
    } = req.body;

    if (!supplierId || !amount || !paymentDate) {
      return res.status(400).json({ 
        error: 'Le fournisseur, le montant et la date de paiement sont obligatoires' 
      });
    }

    const payment = await prisma.$transaction(async (tx) => {
      // Create the payment
      const newPayment = await tx.supplierPayment.create({
        data: {
          supplierId: parseInt(supplierId),
          amount: parseFloat(amount),
          paymentDate: new Date(paymentDate),
          paymentMethod: paymentMethod || 'CASH',
          reference: reference?.trim() || null,
          notes: notes?.trim() || null,
          userId: req.user.id
        }
      });

      // If expense IDs are provided, mark them as paid
      if (expenseIds && expenseIds.length > 0) {
        await tx.expense.updateMany({
          where: {
            id: { in: expenseIds.map(id => parseInt(id)) },
            supplierId: parseInt(supplierId)
          },
          data: {
            isPaid: true,
            paidAt: new Date(paymentDate),
            paidBy: req.user.id
          }
        });
      }

      return newPayment;
    });

    const paymentWithDetails = await prisma.supplierPayment.findUnique({
      where: { id: payment.id },
      include: {
        supplier: {
          select: {
            id: true,
            name: true,
            contactName: true
          }
        },
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });

    res.status(201).json(paymentWithDetails);
  } catch (error) {
    console.error('Error creating supplier payment:', error);
    res.status(500).json({ error: 'Erreur lors de la création du paiement fournisseur' });
  }
});

// Update supplier payment
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      amount,
      paymentDate,
      paymentMethod,
      reference,
      notes
    } = req.body;

    const existingPayment = await prisma.supplierPayment.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existingPayment) {
      return res.status(404).json({ error: 'Paiement fournisseur non trouvé' });
    }

    const payment = await prisma.supplierPayment.update({
      where: { id: parseInt(id) },
      data: {
        amount: amount !== undefined ? parseFloat(amount) : existingPayment.amount,
        paymentDate: paymentDate ? new Date(paymentDate) : existingPayment.paymentDate,
        paymentMethod: paymentMethod || existingPayment.paymentMethod,
        reference: reference?.trim() || existingPayment.reference,
        notes: notes?.trim() || existingPayment.notes
      }
    });

    res.json(payment);
  } catch (error) {
    console.error('Error updating supplier payment:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour du paiement fournisseur' });
  }
});

// Delete supplier payment
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const existingPayment = await prisma.supplierPayment.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existingPayment) {
      return res.status(404).json({ error: 'Paiement fournisseur non trouvé' });
    }

    await prisma.supplierPayment.delete({
      where: { id: parseInt(id) }
    });

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting supplier payment:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression du paiement fournisseur' });
  }
});

// Get supplier statement (releve fournisseur)
router.get('/supplier/:supplierId/statement', authenticateToken, async (req, res) => {
  try {
    const { supplierId } = req.params;
    const { startDate, endDate } = req.query;

    const whereClause = { supplierId: parseInt(supplierId) };
    
    if (startDate && endDate) {
      whereClause.OR = [
        { paymentDate: { gte: new Date(startDate), lte: new Date(endDate) } },
        { createdAt: { gte: new Date(startDate), lte: new Date(endDate) } }
      ];
    }

    // Get payments
    const payments = await prisma.supplierPayment.findMany({
      where: { supplierId: parseInt(supplierId) },
      orderBy: { paymentDate: 'asc' }
    });

    // Get expenses
    const expenses = await prisma.expense.findMany({
      where: { supplierId: parseInt(supplierId) },
      orderBy: { date: 'asc' }
    });

    // Calculate running balance
    let balance = 0;
    const statement = [];

    // Combine and sort all transactions
    const allTransactions = [
      ...expenses.map(expense => ({
        type: 'expense',
        date: expense.date,
        reference: `EXP-${expense.id}`,
        debit: parseFloat(expense.amount),
        credit: 0,
        description: expense.description,
        id: expense.id
      })),
      ...payments.map(payment => ({
        type: 'payment',
        date: payment.paymentDate,
        reference: payment.reference || `PAY-${payment.id}`,
        debit: 0,
        credit: parseFloat(payment.amount),
        description: `Paiement - ${payment.notes || 'Sans description'}`,
        id: payment.id
      }))
    ].sort((a, b) => new Date(a.date) - new Date(b.date));

    // Calculate running balance
    allTransactions.forEach(transaction => {
      balance = balance + transaction.credit - transaction.debit;
      statement.push({
        ...transaction,
        balance: balance
      });
    });

    res.json({
      supplierId: parseInt(supplierId),
      statement,
      totalDebit: allTransactions.reduce((sum, t) => sum + t.debit, 0),
      totalCredit: allTransactions.reduce((sum, t) => sum + t.credit, 0),
      currentBalance: balance
    });
  } catch (error) {
    console.error('Error fetching supplier statement:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération du relevé fournisseur' });
  }
});

module.exports = router;
