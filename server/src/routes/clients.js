const express = require('express');
const { prisma } = require('../lib/prisma');
const router = express.Router();

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
        { firstName: { contains: term } },
        { lastName: { contains: term } },
        { phone: { contains: term } },
        { code: { contains: term } }
      ];
    }

    // Optional type filter
    if (type && ['INDIVIDUAL', 'BUSINESS', 'WHOLESALE'].includes(type)) {
      where.clientType = type;
    }

    const clients = await prisma.client.findMany({
      where,
      include: {
        depot: {
          select: {
            id: true,
            name: true,
            code: true,
            type: true
          }
        },
        _count: {
          select: {
            debtTransactions: true
          }
        }
      },
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
        clientType: true,
        depotId: true,
        depot: {
          select: {
            id: true,
            name: true,
            code: true,
            type: true
          }
        }
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
        depot: {
          select: {
            id: true,
            name: true,
            code: true
          }
        },
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
    const { firstName, lastName, phone, city, address, clientType, depotId, notes, maxDebt, allowDebt } = req.body;

    let defaultMax = null;
    try {
      if (prisma.appSettings && typeof prisma.appSettings.findFirst === 'function') {
        const settings = await prisma.appSettings.findFirst();
        defaultMax = settings?.defaultClientMaxDebt ?? null;
      }
    } catch {}

    // Use transaction to ensure atomicity
    const client = await prisma.$transaction(async (tx) => {
      const code = await generateClientCode(tx);
      
      return await tx.client.create({
        data: {
          code,
          firstName,
          lastName,
          phone,
          city,
          address,
          clientType: clientType || 'INDIVIDUAL',
          depotId: depotId ? (parseInt(depotId) === -1 ? null : parseInt(depotId)) : null,
          notes,
          maxDebt: maxDebt !== undefined ? parseFloat(maxDebt) : defaultMax,
          allowDebt: allowDebt !== undefined ? !!allowDebt : true
        }
      });
    });

    res.status(201).json(client);
  } catch (error) {
    console.error('Error creating client:', error);
    if (error.code === 'P2002') {
      if (error.meta?.target?.includes('code')) {
        return res.status(400).json({ error: 'Code client déjà utilisé. Veuillez réessayer.' });
      }
      return res.status(400).json({ error: 'Champ unique dupliqué' });
    }
    if (error.code === 'P2003') {
      return res.status(400).json({ error: 'Point de vente invalide' });
    }
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// Update client
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { firstName, lastName, phone, city, address, clientType, depotId, loyaltyPoints, totalSpent, favoriteProducts, notes, isActive, currentDebt, maxDebt, allowDebt } = req.body;

    const client = await prisma.client.update({
      where: { id: parseInt(id) },
      data: {
        firstName,
        lastName,
        phone,
        city,
        address,
        clientType,
        depotId: depotId ? (parseInt(depotId) === -1 ? null : parseInt(depotId)) : null,
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
    
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({ error: 'Invalid client ID' });
    }

    const client = await prisma.client.findUnique({
      where: { id: parseInt(id) }
    });

    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    // Check if client has any sales
    const clientSales = await prisma.sale.count({
      where: { clientId: parseInt(id) }
    });

    if (clientSales > 0) {
      return res.status(400).json({ 
        error: 'Impossible de supprimer : ce client a des ventes associées',
        constraint: 'sales_client_fkey',
        dependents: [{
          table: 'sales',
          count: clientSales
        }]
      });
    }

    // Check if client has any invoices
    const clientInvoices = await prisma.invoice.count({
      where: { clientId: parseInt(id) }
    });

    if (clientInvoices > 0) {
      return res.status(400).json({ 
        error: 'Impossible de supprimer : ce client a des factures associées',
        constraint: 'invoices_client_fkey',
        dependents: [{
          table: 'invoices',
          count: clientInvoices
        }]
      });
    }

    await prisma.client.delete({
      where: { id: parseInt(id) }
    });

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting client:', error);
    if (error.code === 'P2003') {
      return res.status(400).json({ 
        error: 'Impossible de supprimer : des éléments sont liés à ce client',
        constraint: error.meta?.field_name || 'foreign_key_constraint'
      });
    }
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

// Generate unique client code
async function generateClientCode(prismaClient = prisma) {
  const prefix = 'CLI';
  const maxRetries = 5;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const lastClient = await prismaClient.client.findFirst({
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
    if (lastClient && lastClient.code) {
      const lastNumber = parseInt(lastClient.code.replace(prefix, ''));
      if (!isNaN(lastNumber) && lastNumber >= 0) {
        nextNumber = lastNumber + 1;
      }
    }

    // Ensure we never generate CLI0000
    if (nextNumber === 0) {
      nextNumber = 1;
    }

    const code = `${prefix}${nextNumber.toString().padStart(4, '0')}`;
    
    // Check if this code already exists
    const existingClient = await prismaClient.client.findUnique({
      where: { code }
    });
    
    if (!existingClient) {
      return code;
    }
    
    // If code exists, wait a bit and try again
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  // Fallback: use timestamp-based code
  const timestamp = Date.now().toString().slice(-6);
  return `${prefix}${timestamp}`;
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

// Initialize client solde (set currentDebt to custom amount)
router.post('/:id/solde/init', async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, notes } = req.body;

    const client = await prisma.client.findUnique({ 
      where: { id: parseInt(id) },
      include: {
        _count: {
          select: {
            debtTransactions: true
          }
        }
      }
    });
    if (!client) return res.status(404).json({ error: 'Client introuvable' });

    // Check if client already has any debt transactions
    if (client._count.debtTransactions > 0) {
      return res.status(400).json({ error: 'Ce client a déjà des mouvements. Impossible de définir un solde de départ.' });
    }

    const newAmount = parseFloat(amount);
    if (isNaN(newAmount)) {
      return res.status(400).json({ error: 'Montant invalide' });
    }

    const currentDebt = parseFloat(client.currentDebt || 0);
    const difference = newAmount - currentDebt;

    const updated = await prisma.$transaction(async (tx) => {
      // Set currentDebt to the new amount
      const c = await tx.client.update({ 
        where: { id: client.id }, 
        data: { currentDebt: newAmount } 
      });
      
      // Create a debt transaction to record the initial balance
      if (difference !== 0) {
        const transactionType = difference > 0 ? 'DEBT' : 'PAYMENT';
        const transactionAmount = Math.abs(difference);
        
        await tx.clientDebtTransaction.create({
          data: { 
            clientId: client.id, 
            saleId: null, 
            amount: transactionAmount, 
            type: transactionType, 
            notes: notes || `Solde de départ`,
            userId: req.user?.id || null
          }
        });
      }
      
      return c;
    });

    res.json(updated);
  } catch (error) {
    console.error('Error initializing client solde:', error);
    res.status(500).json({ error: 'Erreur lors de l\'initialisation du solde' });
  }
});

module.exports = router; 