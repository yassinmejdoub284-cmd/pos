const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Get all suppliers
router.get('/', authenticateToken, async (req, res) => {
  try {
    const suppliers = await prisma.supplier.findMany({
      orderBy: { name: 'asc' }
    });
    res.json(suppliers);
  } catch (error) {
    console.error('Error fetching suppliers:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des fournisseurs' });
  }
});

// Get supplier by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const supplier = await prisma.supplier.findUnique({
      where: { id: parseInt(id) }
    });

    if (!supplier) {
      return res.status(404).json({ error: 'Fournisseur non trouvé' });
    }

    res.json(supplier);
  } catch (error) {
    console.error('Error fetching supplier:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération du fournisseur' });
  }
});

// Create new supplier
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      name,
      phone,
      address,
      city,
      postalCode,
      taxNumber,
      paymentTerms,
      notes
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Le nom du fournisseur est obligatoire' });
    }

    const supplier = await prisma.supplier.create({
      data: {
        name: name.trim(),
        phone: phone?.trim() || null,
        address: address?.trim() || null,
        city: city?.trim() || null,
        postalCode: postalCode?.trim() || null,
        taxNumber: taxNumber?.trim() || null,
        paymentTerms: paymentTerms?.trim() || null,
        notes: notes?.trim() || null
      }
    });

    res.status(201).json(supplier);
  } catch (error) {
    console.error('Error creating supplier:', error);
    res.status(500).json({ error: 'Erreur lors de la création du fournisseur' });
  }
});

// Update supplier
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      phone,
      address,
      city,
      postalCode,
      taxNumber,
      paymentTerms,
      notes,
      isActive
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Le nom du fournisseur est obligatoire' });
    }

    const existingSupplier = await prisma.supplier.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existingSupplier) {
      return res.status(404).json({ error: 'Fournisseur non trouvé' });
    }

    const supplier = await prisma.supplier.update({
      where: { id: parseInt(id) },
      data: {
        name: name.trim(),
        phone: phone?.trim() || null,
        address: address?.trim() || null,
        city: city?.trim() || null,
        postalCode: postalCode?.trim() || null,
        taxNumber: taxNumber?.trim() || null,
        paymentTerms: paymentTerms?.trim() || null,
        notes: notes?.trim() || null,
        isActive: isActive !== undefined ? isActive : existingSupplier.isActive
      }
    });

    res.json(supplier);
  } catch (error) {
    console.error('Error updating supplier:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour du fournisseur' });
  }
});

// Delete supplier
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const existingSupplier = await prisma.supplier.findUnique({
      where: { id: parseInt(id) },
      include: {
        expenses: true
      }
    });

    if (!existingSupplier) {
      return res.status(404).json({ error: 'Fournisseur non trouvé' });
    }

    // Check if supplier has associated expenses
    if (existingSupplier.expenses.length > 0) {
      return res.status(400).json({ 
        error: 'Impossible de supprimer ce fournisseur car il est associé à des dépenses' 
      });
    }

    await prisma.supplier.delete({
      where: { id: parseInt(id) }
    });

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting supplier:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression du fournisseur' });
  }
});

// Toggle supplier status
router.patch('/:id/toggle-status', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const existingSupplier = await prisma.supplier.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existingSupplier) {
      return res.status(404).json({ error: 'Fournisseur non trouvé' });
    }

    const supplier = await prisma.supplier.update({
      where: { id: parseInt(id) },
      data: {
        isActive: !existingSupplier.isActive
      }
    });

    res.json(supplier);
  } catch (error) {
    console.error('Error toggling supplier status:', error);
    res.status(500).json({ error: 'Erreur lors du changement de statut du fournisseur' });
  }
});

module.exports = router;
