const express = require('express');
const { PrismaClient } = require('@prisma/client');
const router = express.Router();
const prisma = new PrismaClient();

// Get all clients with optional search and filters
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 50, active, q, search, type } = req.query;

    const where = {};
    if (active !== undefined && active !== '') where.isActive = active === 'true';

    // Support both q and search as the search term
    const term = (q ?? search)?.toString().trim();
    if (term && term.length >= 2) {
      where.OR = [
        { firstName: { contains: term, mode: 'insensitive' } },
        { lastName: { contains: term, mode: 'insensitive' } },
        { phone: { contains: term, mode: 'insensitive' } },
        { code: { contains: term, mode: 'insensitive' } }
      ];
    }

    // Optional type filter
    if (type && ['INDIVIDUAL', 'BUSINESS', 'WHOLESALE'].includes(type)) {
      where.clientType = type;
    }

    const clients = await prisma.client.findMany({
      where,
      orderBy: { totalSpent: 'desc' },
      skip: (parseInt(page) - 1) * parseInt(limit),
      take: parseInt(limit)
    });

    res.json({ clients, pagination: { page: parseInt(page), limit: parseInt(limit) } });
  } catch (error) {
    console.error('Error fetching clients:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Search clients for POS (put before :id)
router.get('/search/pos', async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q || q.length < 2) {
      return res.json({ clients: [] });
    }

    const clients = await prisma.client.findMany({
      where: {
        isActive: true,
        OR: [
          { firstName: { contains: q } },
          { lastName: { contains: q } },
          { phone: { contains: q } },
          { code: { contains: q } }
        ]
      },
      select: {
        id: true,
        code: true,
        firstName: true,
        lastName: true,
        phone: true,
        loyaltyPoints: true,
        totalSpent: true,
        clientType: true
      },
      take: 10,
      orderBy: { totalSpent: 'desc' }
    });

    res.json({ clients });
  } catch (error) {
    console.error('Error searching clients:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get client by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const client = await prisma.client.findUnique({
      where: { id: parseInt(id) },
      include: {
        sales: {
          include: {
            items: {
              include: {
                product: true
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          take: 10
        },
        _count: {
          select: { sales: true }
        }
      }
    });

    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    res.json(client);
  } catch (error) {
    console.error('Error fetching client:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new client
router.post('/', async (req, res) => {
  try {
    const { firstName, lastName, phone, city, address, clientType, notes, maxDebt, allowDebt } = req.body;

    const code = await generateClientCode();

    let defaultMax = null;
    try {
      if (prisma.appSettings && typeof prisma.appSettings.findFirst === 'function') {
        const settings = await prisma.appSettings.findFirst();
        defaultMax = settings?.defaultClientMaxDebt ?? null;
      }
    } catch {}

    const client = await prisma.client.create({
      data: {
        code,
        firstName,
        lastName,
        phone,
        city,
        address,
        clientType: clientType || 'INDIVIDUAL',
        notes,
        maxDebt: maxDebt !== undefined ? parseFloat(maxDebt) : defaultMax,
        allowDebt: allowDebt !== undefined ? !!allowDebt : true
      }
    });

    res.status(201).json(client);
  } catch (error) {
    console.error('Error creating client:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Duplicate unique field' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update client
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { firstName, lastName, phone, city, address, clientType, loyaltyPoints, totalSpent, favoriteProducts, notes, isActive, currentDebt, maxDebt, allowDebt } = req.body;

    const client = await prisma.client.update({
      where: { id: parseInt(id) },
      data: {
        firstName,
        lastName,
        phone,
        city,
        address,
        clientType,
        loyaltyPoints: loyaltyPoints !== undefined ? parseInt(loyaltyPoints) : undefined,
        totalSpent: totalSpent !== undefined ? parseFloat(totalSpent) : undefined,
        favoriteProducts,
        notes,
        isActive: isActive !== undefined ? isActive : undefined,
        currentDebt: currentDebt !== undefined ? parseFloat(currentDebt) : undefined,
        maxDebt: maxDebt !== undefined ? parseFloat(maxDebt) : undefined,
        allowDebt: allowDebt !== undefined ? !!allowDebt : undefined
      }
    });

    res.json(client);
  } catch (error) {
    console.error('Error updating client:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Duplicate unique field' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete client (soft delete)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const client = await prisma.client.update({
      where: { id: parseInt(id) },
      data: { isActive: false }
    });

    res.json({ message: 'Client deactivated successfully' });
  } catch (error) {
    console.error('Error deactivating client:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Search clients for POS
router.get('/search/pos', async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q || q.length < 2) {
      return res.json({ clients: [] });
    }

    const clients = await prisma.client.findMany({
      where: {
        isActive: true,
        OR: [
          { firstName: { contains: q, mode: 'insensitive' } },
          { lastName: { contains: q, mode: 'insensitive' } },
          { phone: { contains: q, mode: 'insensitive' } },
          { code: { contains: q, mode: 'insensitive' } }
        ]
      },
      select: {
        id: true,
        code: true,
        firstName: true,
        lastName: true,
        phone: true,
        loyaltyPoints: true,
        totalSpent: true,
        clientType: true
      },
      take: 10,
      orderBy: { totalSpent: 'desc' }
    });

    res.json({ clients });
  } catch (error) {
    console.error('Error searching clients:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Generate unique client code
async function generateClientCode() {
  const prefix = 'CLI';
  const lastClient = await prisma.client.findFirst({
    where: {
      code: {
        startsWith: prefix
      }
    },
    orderBy: {
      code: 'desc'
    }
  });

  let nextNumber = 1;
  if (lastClient) {
    const lastNumber = parseInt(lastClient.code.replace(prefix, ''));
    nextNumber = lastNumber + 1;
  }

  return `${prefix}${nextNumber.toString().padStart(4, '0')}`;
}

router.put('/:id/max-debt/init', async (req, res) => {
  try {
    const { id } = req.params;
    const settings = await prisma.appSettings.findFirst();
    const defaultMax = settings?.defaultClientMaxDebt || 0;
    const client = await prisma.client.update({ where: { id: parseInt(id) }, data: { maxDebt: defaultMax } });
    res.json(client);
  } catch (error) {
    console.error('Error initializing client max debt:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/debt/payments', async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, notes } = req.body;
    const payment = parseFloat(amount);
    if (!payment || payment <= 0) {
      return res.status(400).json({ error: 'Montant invalide' });
    }

    const client = await prisma.client.findUnique({ where: { id: parseInt(id) } });
    if (!client) return res.status(404).json({ error: 'Client introuvable' });

    const newDebt = Math.max(0, parseFloat(client.currentDebt || 0) - payment);
    const updated = await prisma.$transaction(async (tx) => {
      const c = await tx.client.update({ where: { id: client.id }, data: { currentDebt: newDebt } });
      await tx.clientDebtTransaction.create({
        data: { clientId: client.id, saleId: null, amount: payment, type: 'PAYMENT', notes: notes || null, userId: req.user.id }
      });
      return c;
    });

    res.json(updated);
  } catch (error) {
    console.error('Error recording debt payment:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router; 