const express = require('express');
const { prisma } = require('../lib/prisma');

const router = express.Router();

// Get all active table sales
router.get('/active', async (req, res) => {
  try {
    const activeTableSales = await prisma.tableSale.findMany({
      where: {
        status: 'ACTIVE'
      },
      include: {
        table: true,
        salon: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json(activeTableSales);
  } catch (error) {
    console.error('Error fetching active table sales:', error);
    res.status(500).json({ error: 'Failed to fetch active table sales' });
  }
});

// Get table sales for a specific table
router.get('/table/:tableId', async (req, res) => {
  try {
    const { tableId } = req.params;
    
    const tableSales = await prisma.tableSale.findMany({
      where: {
        tableId: parseInt(tableId),
        status: 'ACTIVE'
      },
      include: {
        items: {
          include: {
            product: true
          }
        },
        table: true,
        salon: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json(tableSales);
  } catch (error) {
    console.error('Error fetching table sales:', error);
    res.status(500).json({ error: 'Failed to fetch table sales' });
  }
});

// Create or update table sale
router.post('/', async (req, res) => {
  try {

    const { tableId, salonId, items, totalAmount, paidAmount, remainingAmount } = req.body;

    // Check if there's an existing active sale for this table
    const existingSale = await prisma.tableSale.findFirst({
      where: {
        tableId: parseInt(tableId),
        status: 'ACTIVE'
      }
    });

    let tableSale;

    if (existingSale) {
      // Update existing sale
      tableSale = await prisma.$transaction(async (tx) => {
        // Delete existing items
        await tx.tableSaleItem.deleteMany({
          where: {
            tableSaleId: existingSale.id
          }
        });

        // Update sale
        const updatedSale = await tx.tableSale.update({
          where: { id: existingSale.id },
          data: {
            totalAmount: parseFloat(totalAmount),
            paidAmount: parseFloat(paidAmount),
            remainingAmount: parseFloat(remainingAmount),
            updatedAt: new Date()
          }
        });

        // Add new items
        for (const item of items) {
          await tx.tableSaleItem.create({
            data: {
              tableSaleId: existingSale.id,
              productId: item.productId,
              productName: item.productName,
              quantity: parseFloat(item.quantity),
              unitPrice: parseFloat(item.unitPrice),
              total: parseFloat(item.total),
              isPaid: item.isPaid || false
            }
          });
        }

        return updatedSale;
      });
    } else {
      // Create new sale
      tableSale = await prisma.$transaction(async (tx) => {
        const newSale = await tx.tableSale.create({
          data: {
            tableId: parseInt(tableId),
            salonId: parseInt(salonId),
            totalAmount: parseFloat(totalAmount),
            paidAmount: parseFloat(paidAmount),
            remainingAmount: parseFloat(remainingAmount),
            status: 'ACTIVE'
          }
        });

        // Add items
        for (const item of items) {
          await tx.tableSaleItem.create({
            data: {
              tableSaleId: newSale.id,
              productId: item.productId,
              productName: item.productName,
              quantity: parseFloat(item.quantity),
              unitPrice: parseFloat(item.unitPrice),
              total: parseFloat(item.total),
              isPaid: item.isPaid || false
            }
          });
        }

        return newSale;
      });
    }

    // Fetch the complete sale with items
    const completeSale = await prisma.tableSale.findUnique({
      where: { id: tableSale.id },
      include: {
        items: {
          include: {
            product: true
          }
        },
        table: true,
        salon: true
      }
    });

    res.json(completeSale);
  } catch (error) {
    console.error('Error saving table sale:', error);
    res.status(500).json({ error: 'Failed to save table sale' });
  }
});

// Update payment status
router.patch('/:saleId/payment', async (req, res) => {
  try {
    const { saleId } = req.params;
    const { paidAmount, remainingAmount, paidItems } = req.body;

    const updatedSale = await prisma.$transaction(async (tx) => {
      // Update sale payment info
      const sale = await tx.tableSale.update({
        where: { id: parseInt(saleId) },
        data: {
          paidAmount: parseFloat(paidAmount),
          remainingAmount: parseFloat(remainingAmount),
          updatedAt: new Date()
        }
      });

      // Update item payment status
      if (paidItems && paidItems.length > 0) {
        for (const itemId of paidItems) {
          await tx.tableSaleItem.update({
            where: { id: itemId },
            data: { isPaid: true }
          });
        }
      }

      return sale;
    });

    res.json(updatedSale);
  } catch (error) {
    console.error('Error updating payment:', error);
    res.status(500).json({ error: 'Failed to update payment' });
  }
});

// Complete table sale
router.patch('/:saleId/complete', async (req, res) => {
  try {
    const { saleId } = req.params;

    const completedSale = await prisma.tableSale.update({
      where: { id: parseInt(saleId) },
      data: {
        status: 'COMPLETED',
        updatedAt: new Date()
      },
      include: {
        items: {
          include: {
            product: true
          }
        },
        table: true,
        salon: true
      }
    });

    res.json(completedSale);
  } catch (error) {
    console.error('Error completing table sale:', error);
    res.status(500).json({ error: 'Failed to complete table sale' });
  }
});

// Cancel table sale
router.patch('/:saleId/cancel', async (req, res) => {
  try {
    const { saleId } = req.params;

    const cancelledSale = await prisma.tableSale.update({
      where: { id: parseInt(saleId) },
      data: {
        status: 'CANCELLED',
        updatedAt: new Date()
      }
    });

    res.json(cancelledSale);
  } catch (error) {
    console.error('Error cancelling table sale:', error);
    res.status(500).json({ error: 'Failed to cancel table sale' });
  }
});

module.exports = router;
