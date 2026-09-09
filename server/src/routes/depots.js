const express = require('express');
const { prisma } = require('../lib/prisma');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { types } = req.query;
    
    let whereClause = { 
      isActive: true,
      id: { not: -1 } // Exclude the special "Tout" depot from regular depot lists
    };
    
    if (types) {
      const typeArray = types.split(',');
      whereClause.type = { in: typeArray };
    }
    
    const depots = await prisma.depot.findMany({
      where: whereClause,
      include: { company: true },
      orderBy: { name: 'asc' }
    });
    res.json(depots);
  } catch (error) {
    console.error('Error fetching depots:', error);
    res.status(500).json({ error: 'Internal server error' + (error?.message ? ' : ' + error.message : ''), code: error?.code });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const depot = await prisma.depot.findFirst({
      where: {
        id: parseInt(id),
        isActive: true
      }
    });

    if (!depot) {
      return res.status(404).json({ error: 'Depot not found' });
    }

    res.json(depot);
  } catch (error) {
    console.error('Error fetching depot:', error);
    res.status(500).json({ error: 'Internal server error' + (error?.message ? ' : ' + error.message : ''), code: error?.code });
  }
});

router.post('/', authenticateToken, async (req, res) => {
  try {
    const { name, code, type, address, city, phone, email, managerId, companyId } = req.body;

    if (!name || !code || !type || !address || !city) {
      return res.status(400).json({ error: 'Required fields missing' });
    }

    const newDepot = await prisma.depot.create({
      data: {
        name,
        code,
        type,
        address,
        city,
        phone,
        email,
        managerId: managerId ? parseInt(managerId) : null,
        companyId: companyId ? parseInt(companyId) : null
      }
    });

    res.status(201).json(newDepot);
  } catch (error) {
    console.error('Error creating depot:', error);
    res.status(500).json({ error: 'Internal server error' + (error?.message ? ' : ' + error.message : ''), code: error?.code });
  }
});

router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, code, type, address, city, phone, email, managerId, isActive, companyId } = req.body;

    const updatedDepot = await prisma.depot.update({
      where: { id: parseInt(id) },
      data: {
        name,
        code,
        type,
        address,
        city,
        phone,
        email,
        managerId: managerId ? parseInt(managerId) : null,
        isActive,
        companyId: typeof companyId === 'undefined' ? undefined : (companyId === null ? null : parseInt(companyId))
      }
    });

    res.json(updatedDepot);
  } catch (error) {
    console.error('Error updating depot:', error);
    res.status(500).json({ error: 'Internal server error' + (error?.message ? ' : ' + error.message : ''), code: error?.code });
  }
});

router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const depotId = parseInt(req.params.id);
    const depot = await prisma.depot.findUnique({ where: { id: depotId } });
    if (!depot) return res.status(404).json({ error: 'Depot introuvable' });

    // Un depot porte des ventes, des sessions de caisse, du stock... Les
    // supprimer effacerait l'historique comptable. On ne supprime donc
    // definitivement qu'un depot vierge ; sinon on le desactive (il disparait
    // des listes mais toutes les donnees restent consultables).
    const [sales, sessions, inventory, movements, users, clients] = await Promise.all([
      prisma.sale.count({ where: { depotId } }),
      prisma.sessionCaisse.count({ where: { depotId } }),
      prisma.inventory.count({ where: { depotId } }),
      prisma.stockMovement.count({ where: { depotId } }),
      prisma.userDepot.count({ where: { depotId } }),
      prisma.client.count({ where: { depotId } })
    ]);
    const used = sales + sessions + inventory + movements + users + clients;

    if (used > 0) {
      const updated = await prisma.depot.update({
        where: { id: depotId },
        data: { isActive: false }
      });
      return res.json({
        success: true,
        deactivated: true,
        depot: updated,
        counts: { sales, sessions, inventory, movements, users, clients },
        message: `Depot desactive : il contient ${sales} vente(s), ${sessions} session(s) et ${inventory} ligne(s) de stock. Les donnees sont conservees.`
      });
    }

    await prisma.depot.delete({ where: { id: depotId } });
    res.json({ success: true, deactivated: false, message: 'Depot supprime definitivement.' });
  } catch (error) {
    console.error('Error deleting depot:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression du depot' + (error?.message ? ' : ' + error.message : ''), code: error?.code });
  }
});

// Reactive un depot desactive.
router.post('/:id/reactivate', authenticateToken, async (req, res) => {
  try {
    const depot = await prisma.depot.update({
      where: { id: parseInt(req.params.id) },
      data: { isActive: true }
    });
    res.json({ success: true, depot });
  } catch (error) {
    console.error('Error reactivating depot:', error);
    res.status(500).json({ error: 'Erreur lors de la reactivation du depot' + (error?.message ? ' : ' + error.message : ''), code: error?.code });
  }
});

module.exports = router; 