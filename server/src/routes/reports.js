const express = require('express');
const { prisma } = require('../lib/prisma');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/sales', requireRole(['ADMIN', 'MANAGER']), async (req, res) => {
  try {
    const { startDate, endDate, depotId } = req.query;
    const targetDepotId = parseInt(depotId || req.user.depotId);

    const whereClause = {
      depotId: targetDepotId,
      status: 'COMPLETED'
    };

    if (startDate && endDate) {
      whereClause.createdAt = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    }

    const sales = await prisma.sale.groupBy({
      by: ['createdAt'],
      where: whereClause,
      _count: {
        id: true
      },
      _sum: {
        finalTotal: true,
        tax: true,
        discount: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    const formattedSales = sales.map(sale => ({
      date: sale.createdAt,
      totalSales: sale._count.id,
      totalRevenue: sale._sum.finalTotal,
      totalTax: sale._sum.tax,
      totalDiscount: sale._sum.discount
    }));

    res.json(formattedSales);
  } catch (error) {
    console.error('Error generating sales report:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/products', requireRole(['ADMIN', 'MANAGER']), async (req, res) => {
  try {
    const { startDate, endDate, depotId } = req.query;
    const targetDepotId = parseInt(depotId || req.user.depotId);

    const whereClause = {
      sale: {
        depotId: targetDepotId,
        status: 'COMPLETED'
      }
    };

    if (startDate && endDate) {
      whereClause.sale.createdAt = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    }

    const products = await prisma.saleItem.groupBy({
      by: ['productId'],
      where: whereClause,
      _sum: {
        quantity: true,
        total: true
      },
      _avg: {
        unitPrice: true
      },
      orderBy: {
        _sum: {
          quantity: 'desc'
        }
      }
    });

    const productIds = products.map(p => p.productId);
    const productDetails = await prisma.product.findMany({
      where: {
        id: { in: productIds }
      },
      select: {
        id: true,
        name: true,
        sku: true
      }
    });

    const productsWithDetails = products.map(product => {
      const details = productDetails.find(d => d.id === product.productId);
      return {
        productId: product.productId,
        productName: details?.name || 'Unknown',
        sku: details?.sku || 'Unknown',
        totalSold: product._sum.quantity,
        totalRevenue: product._sum.total,
        avgPrice: product._avg.unitPrice
      };
    });

    res.json(productsWithDetails);
  } catch (error) {
    console.error('Error generating products report:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/inventory', requireRole(['ADMIN', 'MANAGER', 'STOCK_MANAGER']), async (req, res) => {
  try {
    const { depotId } = req.query;
    const targetDepotId = parseInt(depotId || req.user.depotId);

    const inventory = await prisma.inventory.findMany({
      where: {
        depotId: targetDepotId
      },
      include: {
        product: {
          select: {
            name: true,
            sku: true,
            minStockLevel: true,
            maxStockLevel: true
          }
        }
      },
      orderBy: {
        quantity: 'asc'
      }
    });

    const inventoryWithDetails = inventory.map(item => ({
      productName: item.product.name,
      sku: item.product.sku,
      minStockLevel: item.product.minStockLevel,
      maxStockLevel: item.product.maxStockLevel,
      currentStock: item.quantity,
      reservedStock: item.reservedQuantity,
      availableStock: item.quantity - item.reservedQuantity
    }));

    res.json(inventoryWithDetails);
  } catch (error) {
    console.error('Error generating inventory report:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/stock-movements', requireRole(['ADMIN', 'MANAGER', 'STOCK_MANAGER']), async (req, res) => {
  try {
    const { startDate, endDate, type, depotId } = req.query;
    const targetDepotId = parseInt(depotId || req.user.depotId);

    const whereClause = {
      depotId: targetDepotId
    };

    if (startDate && endDate) {
      whereClause.date = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    }

    if (type) {
      whereClause.type = type;
    }

    const movements = await prisma.stockMovement.findMany({
      where: whereClause,
      include: {
        product: {
          select: {
            name: true,
            sku: true
          }
        },
        user: {
          select: {
            firstName: true,
            lastName: true
          }
        }
      },
      orderBy: {
        date: 'desc'
      }
    });

    res.json(movements);
  } catch (error) {
    console.error('Error generating stock movements report:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Daily Extracts endpoints
router.get('/daily-extracts', async (req, res) => {
  try {
    // For dev environment, use depot ID 1 as default
    const targetDepotId = parseInt(req.user?.depotId || req.query.depotId || '1');
    const last10Days = [];
    
    // Generate last 10 days
    for (let i = 0; i < 10; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      last10Days.push(date);
    }

    const extracts = await Promise.all(
      last10Days.map(async (date) => {
        const dateString = date.toISOString().split('T')[0]; // Get YYYY-MM-DD format
        const startDate = new Date(dateString + 'T00:00:00.000Z');
        const endDate = new Date(dateString + 'T23:59:59.999Z');

        console.log(`Summary - Date: ${dateString}, Start: ${startDate.toISOString()}, End: ${endDate.toISOString()}`);

        // Get sales for the day - use exact same logic as detail endpoint
        const sales = await prisma.sale.findMany({
          where: {
            depotId: targetDepotId,
            status: 'COMPLETED',
            createdAt: {
              gte: startDate,
              lte: endDate
            }
          },
          include: {
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

        // Get expenses for the day
        const expenses = await prisma.expense.findMany({
          where: {
            depotId: targetDepotId,
            isApproved: true,
            date: {
              gte: startDate,
              lte: endDate
            }
          }
        });

        const hasData = sales.length > 0 || expenses.length > 0;
        
        if (!hasData) {
          return {
            date: dateString,
            hasData: false,
            totalSales: 0,
            totalRevenue: 0,
            totalDiscount: 0,
            totalExpenses: 0,
            families: []
          };
        }

        // Calculate totals
        const totalSales = sales.length;
        const totalRevenue = sales.reduce((sum, sale) => sum + parseFloat(sale.finalTotal || 0), 0);
        const totalDiscount = sales.reduce((sum, sale) => sum + parseFloat(sale.discount || 0), 0);
        const totalExpenses = expenses.reduce((sum, expense) => sum + parseFloat(expense.amount || 0), 0);

        console.log(`Date: ${dateString}, Sales: ${totalSales}, Revenue: ${totalRevenue}, Discount: ${totalDiscount}, Expenses: ${totalExpenses}`);

        // Group by families
        const familyMap = new Map();
        
        sales.forEach(sale => {
          sale.items.forEach(item => {
            const familyId = item.product.famille.id;
            const familyName = item.product.famille.name;
            
            if (!familyMap.has(familyId)) {
              familyMap.set(familyId, {
                id: familyId,
                name: familyName,
                totalRevenue: 0,
                totalDiscount: 0,
                products: new Map()
              });
            }
            
            const family = familyMap.get(familyId);
            family.totalRevenue += parseFloat(item.total);
            family.totalDiscount += parseFloat(item.discount);
            
            const productId = item.product.id;
            if (!family.products.has(productId)) {
              family.products.set(productId, {
                id: productId,
                name: item.product.name,
                quantity: 0,
                revenue: 0,
                discount: 0
              });
            }
            
            const product = family.products.get(productId);
            product.quantity += item.quantity;
            product.revenue += parseFloat(item.total);
            product.discount += parseFloat(item.discount);
          });
        });

        // Convert maps to arrays
        const families = Array.from(familyMap.values()).map(family => ({
          ...family,
          products: Array.from(family.products.values())
        }));

        return {
          date: dateString,
          hasData: true,
          totalSales,
          totalRevenue,
          totalDiscount,
          totalExpenses,
          families
        };
      })
    );

    res.json(extracts);
  } catch (error) {
    console.error('Error generating daily extracts:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/daily-extracts/:date', async (req, res) => {
  try {
    const { date } = req.params;
    // For dev environment, use depot ID 1 as default
    const targetDepotId = parseInt(req.user?.depotId || req.query.depotId || '1');
    
    // Parse date properly - handle YYYY-MM-DD format
    const [year, month, day] = date.split('-').map(Number);
    const startDate = new Date(year, month - 1, day, 0, 0, 0, 0);
    const endDate = new Date(year, month - 1, day, 23, 59, 59, 999);
    
    console.log(`Detail endpoint - Parsed date: ${date}, Start: ${startDate.toISOString()}, End: ${endDate.toISOString()}`);
    
    // Also try the same date logic as the summary endpoint
    const summaryStartDate = new Date(date + 'T00:00:00.000Z');
    const summaryEndDate = new Date(date + 'T23:59:59.999Z');
    console.log(`Summary-style dates - Start: ${summaryStartDate.toISOString()}, End: ${summaryEndDate.toISOString()}`);

    // Get sales for the day - use exact same logic as summary endpoint
    const sales = await prisma.sale.findMany({
      where: {
        depotId: targetDepotId,
        status: 'COMPLETED',
        createdAt: {
          gte: summaryStartDate,
          lte: summaryEndDate
        }
      },
      include: {
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

    console.log(`Found ${sales.length} sales for date ${date}`);
    if (sales.length > 0) {
      console.log(`First sale: ${sales[0].createdAt}, Amount: ${sales[0].finalTotal}`);
    } else {
      // Debug: Get all sales to see what dates exist
      const allSales = await prisma.sale.findMany({
        where: { depotId: targetDepotId, status: 'COMPLETED' },
        select: { id: true, createdAt: true, finalTotal: true },
        orderBy: { createdAt: 'desc' },
        take: 5
      });
      console.log(`Recent sales in depot ${targetDepotId}:`, allSales.map(s => ({ 
        id: s.id, 
        date: s.createdAt.toISOString().split('T')[0], 
        amount: s.finalTotal 
      })));
    }

    // Get expenses for the day
    const expenses = await prisma.expense.findMany({
      where: {
        depotId: targetDepotId,
        isApproved: true,
        date: {
          gte: startDate,
          lte: endDate
        }
      },
      include: {
        category: true
      }
    });

    // Get cash movements for the day
    const cashMovements = await prisma.cashMovement.findMany({
      where: {
        session: {
          depotId: targetDepotId
        },
        createdAt: {
          gte: startDate,
          lte: endDate
        }
      }
    });

    // Calculate totals
    const totalRevenue = sales.reduce((sum, sale) => sum + parseFloat(sale.finalTotal || 0), 0);
    const totalDiscount = sales.reduce((sum, sale) => sum + parseFloat(sale.discount || 0), 0);
    const totalExpenses = expenses.reduce((sum, expense) => sum + parseFloat(expense.amount || 0), 0);

    console.log(`Detail - Date: ${date}, Sales: ${sales.length}, Revenue: ${totalRevenue}, Discount: ${totalDiscount}, Expenses: ${totalExpenses}`);

    // Calculate cash totals
    const soldeDebit = cashMovements
      .filter(m => m.type === 'ENTREE')
      .reduce((sum, m) => sum + parseFloat(m.amount), 0);
    
    const withdrawal = cashMovements
      .filter(m => m.type === 'SORTIE')
      .reduce((sum, m) => sum + parseFloat(m.amount), 0);
    
    // Total Caisse = Solde Débit + Total Recette
    const totalCaisse = soldeDebit + totalRevenue;
    
    // Reste Caisse = Total Caisse - Retraits
    const remainingCash = totalCaisse - withdrawal;

    // Group by families
    const familyMap = new Map();
    
    sales.forEach(sale => {
      sale.items.forEach(item => {
        const familyId = item.product.famille.id;
        const familyName = item.product.famille.name;
        
        if (!familyMap.has(familyId)) {
          familyMap.set(familyId, {
            id: familyId,
            name: familyName,
            totalRevenue: 0,
            totalDiscount: 0,
            products: new Map()
          });
        }
        
        const family = familyMap.get(familyId);
        family.totalRevenue += parseFloat(item.total);
        family.totalDiscount += parseFloat(item.discount);
        
        const productId = item.product.id;
        if (!family.products.has(productId)) {
          family.products.set(productId, {
            id: productId,
            name: item.product.name,
            quantity: 0,
            revenue: 0,
            discount: 0
          });
        }
        
        const product = family.products.get(productId);
        product.quantity += item.quantity;
        product.revenue += parseFloat(item.total);
        product.discount += parseFloat(item.discount);
      });
    });

    // Convert maps to arrays
    const families = Array.from(familyMap.values()).map(family => ({
      ...family,
      products: Array.from(family.products.values())
    }));

    const expenseSummaries = expenses.map(expense => ({
      id: expense.id,
      description: expense.description,
      amount: parseFloat(expense.amount),
      category: expense.category.name
    }));

    const extractDetail = {
      date,
      families,
      totalDiscount,
      totalRevenue,
      soldeDebit,
      expenses: expenseSummaries,
      totalExpenses,
      totalCaisse,
      withdrawal,
      remainingCash
    };

    res.json(extractDetail);
  } catch (error) {
    console.error('Error generating daily extract detail:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/daily-extracts/archives', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    // For dev environment, use depot ID 1 as default
    const targetDepotId = parseInt(req.user?.depotId || req.query.depotId || '1');
    
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Start date and end date are required' });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    // Get sales in date range
    const sales = await prisma.sale.findMany({
      where: {
        depotId: targetDepotId,
        status: 'COMPLETED',
        createdAt: {
          gte: start,
          lte: end
        }
      },
      include: {
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

    // Get expenses in date range
    const expenses = await prisma.expense.findMany({
      where: {
        depotId: targetDepotId,
        isApproved: true,
        date: {
          gte: start,
          lte: end
        }
      }
    });

    // Group by date
    const dateMap = new Map();
    
    sales.forEach(sale => {
      const saleDate = sale.createdAt.toISOString().split('T')[0];
      
      if (!dateMap.has(saleDate)) {
        dateMap.set(saleDate, {
          date: saleDate,
          hasData: true,
          totalSales: 0,
          totalRevenue: 0,
          totalDiscount: 0,
          totalExpenses: 0,
          families: new Map()
        });
      }
      
      const dayData = dateMap.get(saleDate);
      dayData.totalSales++;
      dayData.totalRevenue += parseFloat(sale.finalTotal);
      dayData.totalDiscount += parseFloat(sale.discount);
      
      // Process family data
      sale.items.forEach(item => {
        const familyId = item.product.famille.id;
        const familyName = item.product.famille.name;
        
        if (!dayData.families.has(familyId)) {
          dayData.families.set(familyId, {
            id: familyId,
            name: familyName,
            totalRevenue: 0,
            totalDiscount: 0,
            products: new Map()
          });
        }
        
        const family = dayData.families.get(familyId);
        family.totalRevenue += parseFloat(item.total);
        family.totalDiscount += parseFloat(item.discount);
        
        const productId = item.product.id;
        if (!family.products.has(productId)) {
          family.products.set(productId, {
            id: productId,
            name: item.product.name,
            quantity: 0,
            revenue: 0,
            discount: 0
          });
        }
        
        const product = family.products.get(productId);
        product.quantity += item.quantity;
        product.revenue += parseFloat(item.total);
        product.discount += parseFloat(item.discount);
      });
    });

    // Add expenses to each day
    expenses.forEach(expense => {
      const expenseDate = expense.date.toISOString().split('T')[0];
      
      if (dateMap.has(expenseDate)) {
        dateMap.get(expenseDate).totalExpenses += parseFloat(expense.amount);
      }
    });

    // Convert to array and format
    const extracts = Array.from(dateMap.values()).map(dayData => ({
      ...dayData,
      families: Array.from(dayData.families.values()).map(family => ({
        ...family,
        products: Array.from(family.products.values())
      }))
    }));

    res.json(extracts);
  } catch (error) {
    console.error('Error generating archive extracts:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router; 