const express = require('express');
const { prisma } = require('../lib/prisma');
const { requireRole, authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.get('/sales', authenticateToken, async (req, res) => {
  try {
    const { startDate, endDate, depotId } = req.query;
    const targetDepotId = parseInt(depotId || req.user.depotId);

    let sessionIds = [];

    if (startDate && endDate) {
      // Get sessions that were active during the date range
      const activeSessions = await prisma.sessionCaisse.findMany({
        where: {
          depotId: targetDepotId,
          openedAt: {
            lte: new Date(endDate)
          },
          OR: [
            {
              closedAt: {
                gte: new Date(startDate)
              }
            },
            {
              status: 'OPEN'
            }
          ]
        },
        select: {
          id: true
        }
      });

      sessionIds = activeSessions.map(s => s.id);
    }

    const whereClause = {
      depotId: targetDepotId,
      status: 'COMPLETED'
    };

    if (sessionIds.length > 0) {
      whereClause.sessionId = {
        in: sessionIds
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

router.get('/products', authenticateToken, async (req, res) => {
  try {
    const { startDate, endDate, depotId } = req.query;
    const targetDepotId = parseInt(depotId || req.user.depotId);

    let sessionIds = [];

    if (startDate && endDate) {
      // Get sessions that were active during the date range
      const activeSessions = await prisma.sessionCaisse.findMany({
        where: {
          depotId: targetDepotId,
          openedAt: {
            lte: new Date(endDate)
          },
          OR: [
            {
              closedAt: {
                gte: new Date(startDate)
              }
            },
            {
              status: 'OPEN'
            }
          ]
        },
        select: {
          id: true
        }
      });

      sessionIds = activeSessions.map(s => s.id);
    }

    const whereClause = {
      sale: {
        depotId: targetDepotId,
        status: 'COMPLETED'
      }
    };

    if (sessionIds.length > 0) {
      whereClause.sale.sessionId = {
        in: sessionIds
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
        barcode: true
      }
    });

    const productsWithDetails = products.map(product => {
      const details = productDetails.find(d => d.id === product.productId);
      return {
        productId: product.productId,
        productName: details?.name || 'Unknown',
        barcode: details?.barcode || 'Unknown',
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
    // Get depot ID from query params or user, default to 1 for consistency
    const targetDepotId = parseInt(req.query.depotId || req.user?.depotId || '1');
    
    // Get days parameter from query, default to 10 for backward compatibility
    const days = parseInt(req.query.days || '10');
    console.log(`Daily extracts requested for ${days} days`);
    const lastNDays = [];
    
    // Generate last N days (including today)
    const today = new Date();
    
    // Use current date in UTC to avoid timezone issues
    const todayDate = new Date();
    todayDate.setUTCHours(0, 0, 0, 0);
    
    // Start from today (i=0) and go back (days-1) more days
    for (let i = 0; i < days; i++) {
      const date = new Date(todayDate);
      date.setDate(todayDate.getDate() - i);
      lastNDays.push(date);
    }
    

    const extracts = await Promise.all(
      lastNDays.map(async (date, index) => {
        const dateString = date.toISOString().split('T')[0]; // Get YYYY-MM-DD format
        const startDate = new Date(date);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(date);
        endDate.setHours(23, 59, 59, 999);


        // Get sessions that were active on this day
        const activeSessions = await prisma.sessionCaisse.findMany({
          where: {
            depotId: targetDepotId,
            openedAt: {
              lte: endDate
            },
            OR: [
              {
                closedAt: {
                  gte: startDate
                }
              },
              {
                status: 'OPEN'
              }
            ]
          },
          select: {
            id: true
          }
        });

        const sessionIds = activeSessions.map(s => s.id);

        // Get sales from sessions that were active on this day
        const sales = await prisma.sale.findMany({
          where: {
            depotId: targetDepotId,
            status: 'COMPLETED',
            sessionId: {
              in: sessionIds
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
        
        // Additional debug for today's data
        if (index === 0) {
          console.log(`TODAY (${dateString}) - Found ${sales.length} sales, ${expenses.length} expenses`);
          if (sales.length > 0) {
            console.log(`Today's first sale:`, {
              id: sales[0].id,
              createdAt: sales[0].createdAt,
              finalTotal: sales[0].finalTotal
            });
          }
        }

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

    console.log('Final extracts response:', extracts.map(e => ({ date: e.date, hasData: e.hasData, totalSales: e.totalSales })));
    
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
    
    // Parse date properly - handle YYYY-MM-DD format using local timezone
    const [year, month, day] = date.split('-').map(Number);
    const startDate = new Date(year, month - 1, day, 0, 0, 0, 0);
    const endDate = new Date(year, month - 1, day, 23, 59, 59, 999);
    
    console.log(`Detail endpoint - Parsed date: ${date}, Start: ${startDate.toISOString()}, End: ${endDate.toISOString()}`);

    // Get sessions that were active on this day (opened before end of day, closed after start of day)
    const activeSessions = await prisma.sessionCaisse.findMany({
      where: {
        depotId: targetDepotId,
        openedAt: {
          lte: endDate
        },
        OR: [
          {
            closedAt: {
              gte: startDate
            }
          },
          {
            status: 'OPEN'
          }
        ]
      },
      select: {
        id: true
      }
    });

    const sessionIds = activeSessions.map(s => s.id);

    // Get sales from sessions that were active on this day
    const sales = await prisma.sale.findMany({
      where: {
        depotId: targetDepotId,
        status: 'COMPLETED',
        sessionId: {
          in: sessionIds
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

    // Get sessions closed on this day to get real closure data
    const closedSessions = await prisma.sessionCaisse.findMany({
      where: {
        depotId: targetDepotId,
        status: 'CLOSED',
        closedAt: {
          gte: startDate,
          lte: endDate
        }
      },
      include: {
        cashMovements: {
          where: {
            type: 'RETRAIT_CENTRALE'
          }
        }
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

    // Calculate cash totals from actual closure data
    const soldeDebit = totalRevenue; // Total sales revenue
    
    // Get actual withdrawal amounts from closed sessions
    const withdrawal = closedSessions.reduce((sum, session) => {
      const retraitCentrale = session.cashMovements
        .filter(m => m.type === 'RETRAIT_CENTRALE')
        .reduce((sessionSum, m) => sessionSum + parseFloat(m.amount), 0);
      return sum + retraitCentrale;
    }, 0);
    
    // Total Caisse = Total Revenue (from sales)
    const totalCaisse = totalRevenue;
    
    // Remaining Cash = Total Caisse - Withdrawals
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

    // Get sessions that were active during the date range
    const activeSessions = await prisma.sessionCaisse.findMany({
      where: {
        depotId: targetDepotId,
        openedAt: {
          lte: end
        },
        OR: [
          {
            closedAt: {
              gte: start
            }
          },
          {
            status: 'OPEN'
          }
        ]
      },
      select: {
        id: true
      }
    });

    const sessionIds = activeSessions.map(s => s.id);

    // Get sales from sessions that were active during the date range
    const sales = await prisma.sale.findMany({
      where: {
        depotId: targetDepotId,
        status: 'COMPLETED',
        sessionId: {
          in: sessionIds
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

// Daily/Monthly Report endpoint
router.get('/daily-monthly', authenticateToken, async (req, res) => {
  try {
    const { startDate, endDate, depotId, reportType = 'daily' } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Start date and end date are required' });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const targetDepotId = depotId && depotId !== 'all' ? parseInt(depotId) : req.user.depotId;

    // Get sessions that were active during the date range
    const activeSessions = await prisma.sessionCaisse.findMany({
      where: {
        depotId: targetDepotId,
        openedAt: {
          lte: end
        },
        OR: [
          {
            closedAt: {
              gte: start
            }
          },
          {
            status: 'OPEN'
          }
        ]
      },
      select: {
        id: true
      }
    });

    const sessionIds = activeSessions.map(s => s.id);

    // Get sales data from sessions
    const salesWhere = {
      status: 'COMPLETED',
      depotId: targetDepotId,
      sessionId: {
        in: sessionIds
      }
    };

    const sales = await prisma.sale.findMany({
      where: salesWhere,
      include: {
        items: {
          include: {
            product: true
          }
        },
        depot: true
      }
    });

    // Group by date and depot
    const groupedData = {};
    
    sales.forEach(sale => {
      const saleDate = new Date(sale.createdAt);
      const dateKey = reportType === 'monthly' 
        ? `${saleDate.getFullYear()}-${String(saleDate.getMonth() + 1).padStart(2, '0')}`
        : saleDate.toISOString().split('T')[0];
      
      const depotKey = sale.depot?.name || 'Inconnu';
      const key = `${dateKey}_${depotKey}`;
      
      if (!groupedData[key]) {
        groupedData[key] = {
          date: dateKey,
          depotName: depotKey,
          caVente: 0,
          prixAchat: 0,
          resultat: 0
        };
      }
      
      // Calculate CA Vente (final total)
      groupedData[key].caVente += parseFloat(sale.finalTotal || 0);
      
      // Calculate Prix Achat (sum of product costs)
      sale.items.forEach(item => {
        const cost = parseFloat(item.product?.prix_achat_HT || 0) * item.quantity;
        groupedData[key].prixAchat += cost;
      });
    });

    // Calculate resultat and convert to array
    const reports = Object.values(groupedData).map(report => ({
      ...report,
      resultat: report.caVente - report.prixAchat
    }));

    // Sort by date
    reports.sort((a, b) => new Date(a.date) - new Date(b.date));

    res.json(reports);
  } catch (error) {
    console.error('Error generating daily-monthly report:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Dashboard endpoint
router.get('/dashboard', authenticateToken, async (req, res) => {
  try {
    const today = new Date();
    const startOfDay = new Date(today);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);

    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);

    const startOfYear = new Date(today.getFullYear(), 0, 1);
    const endOfYear = new Date(today.getFullYear(), 11, 31, 23, 59, 59, 999);

    // Get sessions for each period
    const [dailySessions, monthlySessions, yearlySessions] = await Promise.all([
      prisma.sessionCaisse.findMany({
        where: {
          depotId: req.user.depotId,
          openedAt: { lte: endOfDay },
          OR: [
            { closedAt: { gte: startOfDay } },
            { status: 'OPEN' }
          ]
        },
        select: { id: true }
      }),
      prisma.sessionCaisse.findMany({
        where: {
          depotId: req.user.depotId,
          openedAt: { lte: endOfMonth },
          OR: [
            { closedAt: { gte: startOfMonth } },
            { status: 'OPEN' }
          ]
        },
        select: { id: true }
      }),
      prisma.sessionCaisse.findMany({
        where: {
          depotId: req.user.depotId,
          openedAt: { lte: endOfYear },
          OR: [
            { closedAt: { gte: startOfYear } },
            { status: 'OPEN' }
          ]
        },
        select: { id: true }
      })
    ]);

    const dailySessionIds = dailySessions.map(s => s.id);
    const monthlySessionIds = monthlySessions.map(s => s.id);
    const yearlySessionIds = yearlySessions.map(s => s.id);

    // Get sales data from sessions
    const [dailySales, monthlySales, yearlySales] = await Promise.all([
      prisma.sale.findMany({
        where: {
          status: 'COMPLETED',
          depotId: req.user.depotId,
          sessionId: { in: dailySessionIds }
        }
      }),
      prisma.sale.findMany({
        where: {
          status: 'COMPLETED',
          depotId: req.user.depotId,
          sessionId: { in: monthlySessionIds }
        }
      }),
      prisma.sale.findMany({
        where: {
          status: 'COMPLETED',
          depotId: req.user.depotId,
          sessionId: { in: yearlySessionIds }
        }
      })
    ]);

    // Calculate sales totals
    const sales = {
      daily: dailySales.reduce((sum, sale) => sum + parseFloat(sale.finalTotal || 0), 0),
      monthly: monthlySales.reduce((sum, sale) => sum + parseFloat(sale.finalTotal || 0), 0),
      yearly: yearlySales.reduce((sum, sale) => sum + parseFloat(sale.finalTotal || 0), 0)
    };

    // Get purchase data (from expenses)
    const [dailyExpenses, monthlyExpenses, yearlyExpenses] = await Promise.all([
      prisma.expense.findMany({
        where: {
          createdAt: { gte: startOfDay, lte: endOfDay }
        }
      }),
      prisma.expense.findMany({
        where: {
          createdAt: { gte: startOfMonth, lte: endOfMonth }
        }
      }),
      prisma.expense.findMany({
        where: {
          createdAt: { gte: startOfYear, lte: endOfYear }
        }
      })
    ]);

    // Calculate purchase totals
    const purchases = {
      daily: dailyExpenses.reduce((sum, expense) => sum + parseFloat(expense.amount || 0), 0),
      monthly: monthlyExpenses.reduce((sum, expense) => sum + parseFloat(expense.amount || 0), 0),
      yearly: yearlyExpenses.reduce((sum, expense) => sum + parseFloat(expense.amount || 0), 0)
    };

    // Get indicators
    const [newClients, paymentDelays] = await Promise.all([
      prisma.client.count({
        where: {
          createdAt: { gte: startOfMonth }
        }
      }),
      prisma.expense.count({
        where: {
          isPaid: false,
          dueDate: { lt: today }
        }
      })
    ]);

    const indicators = {
      newClients,
      newNegotiations: 0, // Placeholder - would need negotiation tracking
      paymentDelays
    };

    // Calculate results
    const results = {
      daily: sales.daily - purchases.daily,
      monthly: sales.monthly - purchases.monthly,
      yearly: sales.yearly - purchases.yearly
    };

    res.json({
      sales,
      purchases,
      indicators,
      results
    });
  } catch (error) {
    console.error('Error generating dashboard data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Sales by Category/Product Report endpoint
router.get('/sales-by-category', authenticateToken, async (req, res) => {
  try {
    const { startDate, endDate, filterType = 'family', depotId } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Start date and end date are required' });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const targetDepotId = parseInt(depotId || req.user.depotId);

    // Get sessions that were active during the date range
    const activeSessions = await prisma.sessionCaisse.findMany({
      where: {
        depotId: targetDepotId,
        openedAt: {
          lte: end
        },
        OR: [
          {
            closedAt: {
              gte: start
            }
          },
          {
            status: 'OPEN'
          }
        ]
      },
      select: {
        id: true
      }
    });

    const sessionIds = activeSessions.map(s => s.id);

    const salesWhere = {
      status: 'COMPLETED',
      depotId: targetDepotId,
      sessionId: {
        in: sessionIds
      }
    };

    const sales = await prisma.sale.findMany({
      where: salesWhere,
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

    // Group by family or product based on filterType
    const groupedData = {};
    
    sales.forEach(sale => {
      sale.items.forEach(item => {
        const key = filterType === 'family' 
          ? `family_${item.product.famille.id}`
          : `product_${item.product.id}`;
        
        if (!groupedData[key]) {
          groupedData[key] = {
            id: filterType === 'family' ? item.product.famille.id : item.product.id,
            name: filterType === 'family' ? item.product.famille.name : item.product.name,
            type: filterType === 'family' ? 'family' : 'product',
            quantity: 0,
            totalTTC: 0,
            prixAchat: 0,
            resultat: 0
          };
        }
        
        const group = groupedData[key];
        group.quantity += parseFloat(item.quantity);
        group.totalTTC += parseFloat(item.total);
        
        // Calculate purchase price (assuming we have prix_achat_HT in product)
        const purchasePrice = parseFloat(item.product.prix_achat_HT || 0) * item.quantity;
        group.prixAchat += purchasePrice;
      });
    });

    // Calculate resultat for each group
    Object.values(groupedData).forEach(group => {
      group.resultat = group.totalTTC - group.prixAchat;
    });

    // Convert to array and sort by totalTTC descending
    const reports = Object.values(groupedData).sort((a, b) => b.totalTTC - a.totalTTC);

    res.json(reports);
  } catch (error) {
    console.error('Error generating sales by category report:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Purchase by Category/Product Report endpoint
router.get('/purchases-by-category', authenticateToken, async (req, res) => {
  try {
    const { startDate, endDate, filterType = 'category', depotId } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Start date and end date are required' });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const expensesWhere = {
      isApproved: true,
      date: {
        gte: start,
        lte: end
      }
    };

    if (depotId && depotId !== 'all') {
      expensesWhere.depotId = parseInt(depotId);
    }

    const expenses = await prisma.expense.findMany({
      where: expensesWhere,
      include: {
        category: true,
        supplier: true
      }
    });

    // Group by category
    const groupedData = {};
    
    expenses.forEach(expense => {
      const key = `category_${expense.category.id}`;
      
      if (!groupedData[key]) {
        groupedData[key] = {
          id: expense.category.id,
          name: expense.category.name,
          type: 'category',
          quantity: 1, // Count of expenses
          totalTTC: 0,
          prixAchat: 0,
          resultat: 0,
          supplierCount: new Set()
        };
      }
      
      const group = groupedData[key];
      group.totalTTC += parseFloat(expense.amount);
      group.prixAchat += parseFloat(expense.amount); // For expenses, prixAchat = totalTTC
      group.supplierCount.add(expense.supplierId);
    });

    // Calculate resultat and supplier count
    Object.values(groupedData).forEach(group => {
      group.resultat = group.totalTTC - group.prixAchat; // Should be 0 for expenses
      group.supplierCount = group.supplierCount.size;
    });

    // Convert to array and sort by totalTTC descending
    const reports = Object.values(groupedData).sort((a, b) => b.totalTTC - a.totalTTC);

    res.json(reports);
  } catch (error) {
    console.error('Error generating purchases by category report:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Credit Sales Report endpoint
router.get('/credit-sales', authenticateToken, async (req, res) => {
  try {
    const { startDate, endDate, depotId, status = 'all' } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Start date and end date are required' });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const targetDepotId = depotId && depotId !== 'all' ? parseInt(depotId) : req.user.depotId;

    // Get sessions that were active during the date range
    const activeSessions = await prisma.sessionCaisse.findMany({
      where: {
        depotId: targetDepotId,
        openedAt: { lte: end },
        OR: [
          { closedAt: { gte: start } },
          { status: 'OPEN' }
        ]
      },
      select: { id: true }
    });

    const sessionIds = activeSessions.map(s => s.id);

    const salesWhere = {
      status: 'COMPLETED',
      depotId: targetDepotId,
      sessionId: { in: sessionIds },
      clientId: { not: null } // Only sales with clients
    };

    const sales = await prisma.sale.findMany({
      where: salesWhere,
      include: {
        client: true,
        items: {
          include: {
            product: true
          }
        },
        depot: true
      }
    });

    // Group by client and calculate totals
    const clientMap = new Map();
    
    sales.forEach(sale => {
      const clientId = sale.client.id;
      
      if (!clientMap.has(clientId)) {
        clientMap.set(clientId, {
          clientId: clientId,
          clientName: `${sale.client.firstName} ${sale.client.lastName}`,
          clientCode: sale.client.code,
          clientPhone: sale.client.phone,
          clientEmail: sale.client.email,
          totalAmount: 0,
          totalPaid: 0,
          totalDue: 0,
          salesCount: 0,
          lastSaleDate: null,
          sales: []
        });
      }
      
      const client = clientMap.get(clientId);
      client.totalAmount += parseFloat(sale.finalTotal);
      client.salesCount++;
      client.lastSaleDate = sale.createdAt;
      client.sales.push({
        id: sale.id,
        date: sale.createdAt,
        amount: parseFloat(sale.finalTotal),
        depotName: sale.depot.name
      });
    });

    // Get debt transactions for each client
    const clientIds = Array.from(clientMap.keys());
    const debtTransactions = await prisma.clientDebtTransaction.findMany({
      where: {
        clientId: { in: clientIds },
        createdAt: {
          gte: start,
          lte: end
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Calculate paid amounts and due amounts
    debtTransactions.forEach(transaction => {
      const client = clientMap.get(transaction.clientId);
      if (client) {
        if (transaction.type === 'PAYMENT') {
          client.totalPaid += parseFloat(transaction.amount);
        } else if (transaction.type === 'DEBT') {
          client.totalDue += parseFloat(transaction.amount);
        }
      }
    });

    // Calculate final due amounts
    clientMap.forEach(client => {
      client.totalDue = client.totalAmount - client.totalPaid;
      client.isOverdue = client.totalDue > 0 && client.lastSaleDate < new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
    });

    // Filter by status
    let reports = Array.from(clientMap.values());
    
    if (status === 'overdue') {
      reports = reports.filter(r => r.isOverdue);
    } else if (status === 'paid') {
      reports = reports.filter(r => r.totalDue <= 0);
    } else if (status === 'pending') {
      reports = reports.filter(r => r.totalDue > 0 && !r.isOverdue);
    }

    // Sort by total due amount descending
    reports.sort((a, b) => b.totalDue - a.totalDue);

    res.json(reports);
  } catch (error) {
    console.error('Error generating credit sales report:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Client Statement Report endpoint
router.get('/client-statement', authenticateToken, async (req, res) => {
  try {
    const { clientId, startDate, endDate, depotId } = req.query;
    
    if (!clientId) {
      return res.status(400).json({ error: 'Client ID is required' });
    }

    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Default to 30 days ago
    const end = endDate ? new Date(endDate) : new Date();
    end.setHours(23, 59, 59, 999);

    const targetDepotId = depotId && depotId !== 'all' ? parseInt(depotId) : req.user.depotId;

    // Get sessions that were active during the date range
    const activeSessions = await prisma.sessionCaisse.findMany({
      where: {
        depotId: targetDepotId,
        openedAt: { lte: end },
        OR: [
          { closedAt: { gte: start } },
          { status: 'OPEN' }
        ]
      },
      select: { id: true }
    });

    const sessionIds = activeSessions.map(s => s.id);

    const salesWhere = {
      clientId: parseInt(clientId),
      status: 'COMPLETED',
      depotId: targetDepotId,
      sessionId: { in: sessionIds }
    };

    // Get client info
    const client = await prisma.client.findUnique({
      where: { id: parseInt(clientId) }
    });

    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    // Get sales
    const sales = await prisma.sale.findMany({
      where: salesWhere,
      include: {
        items: {
          include: {
            product: true
          }
        },
        depot: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Get debt transactions
    const debtTransactions = await prisma.clientDebtTransaction.findMany({
      where: {
        clientId: parseInt(clientId),
        createdAt: {
          gte: start,
          lte: end
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Calculate totals
    const totalSales = sales.reduce((sum, sale) => sum + parseFloat(sale.finalTotal), 0);
    const totalPaid = debtTransactions
      .filter(t => t.type === 'PAYMENT')
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);
    const totalDebt = debtTransactions
      .filter(t => t.type === 'DEBT')
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);

    const statement = {
      client: {
        id: client.id,
        code: client.code,
        name: `${client.firstName} ${client.lastName}`,
        phone: client.phone,
        email: client.email,
        address: client.address,
        currentDebt: parseFloat(client.currentDebt)
      },
      period: {
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0]
      },
      summary: {
        totalSales,
        totalPaid,
        totalDebt,
        balance: totalSales - totalPaid + totalDebt
      },
      transactions: [
        ...sales.map(sale => ({
          id: sale.id,
          type: 'SALE',
          date: sale.createdAt,
          description: `Vente #${sale.id}`,
          amount: parseFloat(sale.finalTotal),
          depot: sale.depot.name,
          balance: 0 // Will be calculated
        })),
        ...debtTransactions.map(transaction => ({
          id: transaction.id,
          type: transaction.type,
          date: transaction.createdAt,
          description: transaction.notes || (transaction.type === 'PAYMENT' ? 'Paiement' : 'Dette'),
          amount: parseFloat(transaction.amount),
          depot: null,
          balance: 0 // Will be calculated
        }))
      ].sort((a, b) => new Date(b.date) - new Date(a.date))
    };

    // Calculate running balance
    let runningBalance = parseFloat(client.currentDebt);
    statement.transactions.forEach(transaction => {
      if (transaction.type === 'SALE' || transaction.type === 'DEBT') {
        runningBalance += transaction.amount;
      } else if (transaction.type === 'PAYMENT') {
        runningBalance -= transaction.amount;
      }
      transaction.balance = runningBalance;
    });

    res.json(statement);
  } catch (error) {
    console.error('Error generating client statement:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Supplier Statement Report endpoint
router.get('/supplier-statement', authenticateToken, async (req, res) => {
  try {
    const { supplierId, startDate, endDate, depotId } = req.query;
    
    if (!supplierId) {
      return res.status(400).json({ error: 'Supplier ID is required' });
    }

    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Default to 30 days ago
    const end = endDate ? new Date(endDate) : new Date();
    end.setHours(23, 59, 59, 999);

    const expensesWhere = {
      supplierId: parseInt(supplierId),
      isApproved: true,
      date: {
        gte: start,
        lte: end
      }
    };

    if (depotId && depotId !== 'all') {
      expensesWhere.depotId = parseInt(depotId);
    }

    // Get supplier info
    const supplier = await prisma.supplier.findUnique({
      where: { id: parseInt(supplierId) }
    });

    if (!supplier) {
      return res.status(404).json({ error: 'Supplier not found' });
    }

    // Get expenses
    const expenses = await prisma.expense.findMany({
      where: expensesWhere,
      include: {
        category: true,
        depot: true
      },
      orderBy: {
        date: 'desc'
      }
    });

    // Calculate totals
    const totalExpenses = expenses.reduce((sum, expense) => sum + parseFloat(expense.amount), 0);
    const totalPaid = expenses
      .filter(e => e.isPaid)
      .reduce((sum, e) => sum + parseFloat(e.amount), 0);
    const totalUnpaid = expenses
      .filter(e => !e.isPaid)
      .reduce((sum, e) => sum + parseFloat(e.amount), 0);

    const statement = {
      supplier: {
        id: supplier.id,
        name: supplier.name,
        contactName: supplier.contactName,
        phone: supplier.phone,
        email: supplier.email,
        address: supplier.address,
        taxNumber: supplier.taxNumber
      },
      period: {
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0]
      },
      summary: {
        totalExpenses,
        totalPaid,
        totalUnpaid,
        balance: totalUnpaid
      },
      transactions: expenses.map(expense => ({
        id: expense.id,
        type: 'EXPENSE',
        date: expense.date,
        description: expense.description,
        amount: parseFloat(expense.amount),
        category: expense.category.name,
        depot: expense.depot.name,
        isPaid: expense.isPaid,
        paidAt: expense.paidAt,
        dueDate: expense.dueDate
      }))
    };

    res.json(statement);
  } catch (error) {
    console.error('Error generating supplier statement:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get clients list for statement
router.get('/clients', authenticateToken, async (req, res) => {
  try {
    const clients = await prisma.client.findMany({
      where: { isActive: true },
      select: {
        id: true,
        code: true,
        firstName: true,
        lastName: true,
        phone: true,
        email: true,
        currentDebt: true
      },
      orderBy: {
        firstName: 'asc'
      }
    });

    const formattedClients = clients.map(client => ({
      id: client.id,
      code: client.code,
      name: `${client.firstName} ${client.lastName}`,
      phone: client.phone,
      email: client.email,
      currentDebt: parseFloat(client.currentDebt)
    }));

    res.json(formattedClients);
  } catch (error) {
    console.error('Error fetching clients:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get suppliers list for statement
router.get('/suppliers', authenticateToken, async (req, res) => {
  try {
    const suppliers = await prisma.supplier.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        contactName: true,
        phone: true,
        email: true,
        taxNumber: true
      },
      orderBy: {
        name: 'asc'
      }
    });

    res.json(suppliers);
  } catch (error) {
    console.error('Error fetching suppliers:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router; 