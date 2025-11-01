const express = require('express');
const { prisma } = require('../lib/prisma');
const { requireRole, authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Test endpoint without authentication for debugging
router.get('/etat-mvt-stock-test', async (req, res) => {
  try {
    console.log('ETAT MVT STOCK TEST - Starting...');
    
    // Get all stock movements without filters
    const movements = await prisma.stockMovement.findMany({
      take: 10, // Limit to 10 for testing
      include: {
        product: {
          select: {
            id: true,
            name: true,
            prix_achat: true,
            prix_vente_TTC: true
          }
        },
        depot: {
          select: {
            id: true,
            name: true,
            code: true
          }
        }
      },
      orderBy: {
        date: 'desc'
      }
    });

    console.log('ETAT MVT STOCK TEST - Found movements:', movements.length);
    
    // Get inventory data
    const inventory = await prisma.inventory.findMany({
      take: 10,
      include: {
        product: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    console.log('ETAT MVT STOCK TEST - Found inventory:', inventory.length);

    res.json({
      movements: movements,
      inventory: inventory,
      message: 'Test data loaded successfully'
    });
  } catch (error) {
    console.error('ETAT MVT STOCK TEST - Error:', error);
    res.status(500).json({ 
      error: 'Test endpoint error', 
      details: error.message,
      stack: error.stack 
    });
  }
});

// Temporary endpoint without authentication for testing
router.get('/etat-mvt-stock', async (req, res) => {
  try {
    console.log('ETAT MVT STOCK - Request received (no auth)');
    
    const { startDate, endDate, depotId } = req.query;
    const targetDepotId = depotId ? parseInt(depotId) : 4; // Default to depot 4 for testing
    
    console.log('Target depot ID:', targetDepotId);

    // Build date filter
    const dateFilter = {};
    if (startDate && endDate) {
      dateFilter.date = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    }

    // Fetch stock movements with all related data
    const movements = await prisma.stockMovement.findMany({
      where: {
        depotId: targetDepotId,
        ...dateFilter
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            familleId: true,
            designation_legale: true,
            tva: true,
            prix_achat: true,
            prix_vente_TTC: true,
            createdAt: true,
            updatedAt: true
          }
        },
        depot: {
          select: {
            id: true,
            name: true,
            code: true,
            type: true
          }
        },
        user: {
          select: {
            firstName: true,
            lastName: true
          }
        }
      },
      orderBy: [
        { productId: 'asc' },
        { depotId: 'asc' },
        { date: 'asc' },
        { reference: 'asc' },
        { id: 'asc' }
      ]
    });

    console.log('ETAT MVT STOCK - Found movements:', movements.length);

    // Enrich movements with document item data (simplified for testing)
    const enrichedMovements = movements.map(movement => {
      return {
        id: movement.id,
        productId: movement.productId,
        depotId: movement.depotId,
        quantity: parseFloat(movement.quantity),
        type: movement.type,
        fromDepotId: movement.fromDepotId,
        toDepotId: movement.toDepotId,
        reason: movement.reason,
        reference: movement.reference,
        userId: movement.userId,
        date: movement.date.toISOString(),
        product: movement.product,
        depot: movement.depot,
        user: movement.user,
        documentItem: null // Simplified for testing
      };
    });

    console.log('ETAT MVT STOCK - Returning enriched movements:', enrichedMovements.length);
    res.json(enrichedMovements);
  } catch (error) {
    console.error('Error fetching ETAT MVT STOCK data:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

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
        discount: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    const formattedSales = sales.map(sale => ({
      date: sale.createdAt.toISOString().split('T')[0],
      sales: sale._sum.finalTotal || 0,
      totalRevenue: sale._sum.finalTotal || 0,
      totalTax: sale._sum.tax || 0,
      totalDiscount: sale._sum.discount || 0
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
        id: product.productId,
        name: details?.name || 'Unknown',
        productName: details?.name || 'Unknown',
        barcode: details?.barcode || 'Unknown',
        sales: product._sum.total || 0,
        totalRevenue: product._sum.total || 0,
        quantity: product._sum.quantity || 0,
        totalSold: product._sum.quantity || 0,
        avgPrice: product._avg.unitPrice || 0
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
            barcode: true
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

    // Group movements by date and type
    const groupedMovements = {};
    movements.forEach(movement => {
      const date = movement.date.toISOString().split('T')[0];
      if (!groupedMovements[date]) {
        groupedMovements[date] = {
          date,
          entries: 0,
          exits: 0,
          quantityIn: 0,
          quantityOut: 0
        };
      }
      
      if (movement.type === 'ENTRY') {
        groupedMovements[date].entries += parseFloat(movement.quantity || 0);
        groupedMovements[date].quantityIn += parseFloat(movement.quantity || 0);
      } else if (movement.type === 'EXIT') {
        groupedMovements[date].exits += parseFloat(movement.quantity || 0);
        groupedMovements[date].quantityOut += parseFloat(movement.quantity || 0);
      }
    });

    const formattedMovements = Object.values(groupedMovements).sort((a, b) => 
      new Date(a.date) - new Date(b.date)
    );

    res.json(formattedMovements);
  } catch (error) {
    console.error('Error generating stock movements report:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Daily Extracts endpoints
router.get('/daily-extracts', async (req, res) => {
  try {
    // Optional depot filter; if not provided, aggregate across all depots
    const depotIdParam = req.query.depotId;
    const targetDepotId = depotIdParam ? parseInt(depotIdParam) : null;
    
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
            ...(targetDepotId ? { depotId: targetDepotId } : {}),
            openedAt: { lte: endDate },
            OR: [
              { closedAt: { gte: startDate } },
              { status: 'OPEN' }
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
            ...(targetDepotId ? { depotId: targetDepotId } : {}),
            status: 'COMPLETED',
            sessionId: { in: sessionIds }
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
            ...(targetDepotId ? { depotId: targetDepotId } : {}),
            isApproved: true,
            date: { gte: startDate, lte: endDate }
          }
        });

        // Find the most recent closed session before this day (previous closure)
        const previousClosedSession = await prisma.sessionCaisse.findFirst({
          where: {
            ...(targetDepotId ? { depotId: targetDepotId } : {}),
            status: 'CLOSED',
            closedAt: { lt: startDate }
          },
          orderBy: { closedAt: 'desc' },
          include: {
            cashMovements: {
              where: { type: 'RETRAIT_CENTRALE' }
            }
          }
        });

        const previousClosure = previousClosedSession ? {
          sessionId: previousClosedSession.id,
          closedAt: previousClosedSession.closedAt,
          countedCash: previousClosedSession.countedCash ?? null,
          expectedCash: previousClosedSession.expectedCash ?? null,
          withdrawalToCentral: previousClosedSession.cashMovements?.reduce((sum, m) => sum + parseFloat(m.amount || 0), 0) || 0
        } : null;

        // Gather all closures for this day
        const closedSessions = await prisma.sessionCaisse.findMany({
          where: {
            ...(targetDepotId ? { depotId: targetDepotId } : {}),
            status: 'CLOSED',
            closedAt: { gte: startDate, lte: endDate }
          },
          include: {
            cashMovements: true
          },
          orderBy: { closedAt: 'asc' }
        });

        // Compute per-closure metrics
        const closures = await Promise.all(closedSessions.map(async (session) => {
          const sessionSales = await prisma.sale.findMany({
            where: { ...(targetDepotId ? { depotId: targetDepotId } : {}), status: 'COMPLETED', sessionId: session.id },
            select: { finalTotal: true, discount: true }
          });
          const totalRevenue = sessionSales.reduce((sum, s) => sum + parseFloat(s.finalTotal || 0), 0);
          const totalDiscount = sessionSales.reduce((sum, s) => sum + parseFloat(s.discount || 0), 0);
          const withdrawalToCentral = session.cashMovements
            .filter(m => m.type === 'RETRAIT_CENTRALE')
            .reduce((sum, m) => sum + parseFloat(m.amount || 0), 0);
          return {
            sessionId: session.id,
            openedAt: session.openedAt,
            closedAt: session.closedAt,
            countedCash: session.countedCash ?? null,
            expectedCash: session.expectedCash ?? null,
            withdrawalToCentral,
            totalRevenue,
            totalDiscount
          };
        }));

        const hasData = sales.length > 0 || expenses.length > 0 || !!previousClosure || closures.length > 0;
        
        if (!hasData) {
          return {
            date: dateString,
            hasData: false,
            totalSales: 0,
            totalRevenue: 0,
            totalDiscount: 0,
            totalExpenses: 0,
            families: [],
            previousClosure,
            closures
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
            product.quantity += parseFloat(item.quantity);
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
          families,
          previousClosure,
          closures
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

// Session-based Extracts endpoints (group by session_id)
router.get('/session-extracts', async (req, res) => {
  try {
    const depotIdParam = req.query.depotId;
    const targetDepotId = depotIdParam ? parseInt(depotIdParam) : null;
    const limitParam = req.query.limit ? parseInt(req.query.limit) : 20;

    // Fetch recent sessions (most recent closed first, then open)
    const sessions = await prisma.sessionCaisse.findMany({
      where: {
        ...(targetDepotId ? { depotId: targetDepotId } : {})
      },
      include: {
        cashMovements: true
      },
      orderBy: [
        { closedAt: 'desc' },
        { openedAt: 'desc' }
      ],
      take: limitParam
    });

    const sessionIds = sessions.map(s => s.id);

    // Fetch sales per session
    const salesBySession = await prisma.sale.findMany({
      where: {
        status: 'COMPLETED',
        sessionId: { in: sessionIds },
        ...(targetDepotId ? { depotId: targetDepotId } : {})
      },
      include: {
        items: {
          include: {
            product: { include: { famille: true } }
          }
        }
      }
    });

    const salesMap = new Map();
    salesBySession.forEach(sale => {
      const list = salesMap.get(sale.sessionId) || [];
      list.push(sale);
      salesMap.set(sale.sessionId, list);
    });

    const extracts = sessions.map(session => {
      const sales = salesMap.get(session.id) || [];

      const totalSales = sales.length;
      const totalRevenue = sales.reduce((sum, s) => sum + parseFloat(s.finalTotal || 0), 0);
      const totalDiscount = sales.reduce((sum, s) => sum + parseFloat(s.discount || 0), 0);

      // Group by families
      const familyMap = new Map();
      sales.forEach(sale => {
        sale.items.forEach(item => {
          const famId = item.product.famille.id;
          const famName = item.product.famille.name;
          if (!familyMap.has(famId)) {
            familyMap.set(famId, {
              id: famId,
              name: famName,
              totalRevenue: 0,
              totalDiscount: 0,
              products: new Map()
            });
          }
          const fam = familyMap.get(famId);
          fam.totalRevenue += parseFloat(item.total);
          fam.totalDiscount += parseFloat(item.discount);

          const pid = item.product.id;
          if (!fam.products.has(pid)) {
            fam.products.set(pid, {
              id: pid,
              name: item.product.name,
              quantity: 0,
              revenue: 0,
              discount: 0
            });
          }
          const p = fam.products.get(pid);
          p.quantity += parseFloat(item.quantity);
          p.revenue += parseFloat(item.total);
          p.discount += parseFloat(item.discount);
        });
      });

      const families = Array.from(familyMap.values()).map(f => ({
        ...f,
        products: Array.from(f.products.values())
      }));

      // Cash movements per session (entries/exits)
      const totalExpenses = 0; // keep 0 to match existing shape; expenses tracked via cash movements

      const dateStr = (session.closedAt || session.openedAt).toISOString().split('T')[0];

      return {
        // keep existing shape for frontend compatibility
        date: dateStr,
        hasData: totalSales > 0 || (session.cashMovements || []).length > 0,
        totalSales,
        totalRevenue,
        totalDiscount,
        totalExpenses,
        families,
        // Extra fields for future use (non-breaking to clients that ignore unknowns)
        sessionId: session.id,
        openedAt: session.openedAt,
        closedAt: session.closedAt,
        status: session.status,
        expectedCash: session.expectedCash,
        countedCash: session.countedCash
      };
    });

    res.json(extracts);
  } catch (error) {
    console.error('Error generating session extracts:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/session-extracts/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const session = await prisma.sessionCaisse.findUnique({
      where: { id },
      include: { cashMovements: true }
    });
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const sales = await prisma.sale.findMany({
      where: { status: 'COMPLETED', sessionId: id },
      include: {
        items: { include: { product: { include: { famille: true } } } }
      }
    });

    const totalRevenue = sales.reduce((sum, s) => sum + parseFloat(s.finalTotal || 0), 0);
    const totalDiscount = sales.reduce((sum, s) => sum + parseFloat(s.discount || 0), 0);

    const familyMap = new Map();
    sales.forEach(sale => {
      sale.items.forEach(item => {
        const famId = item.product.famille.id;
        const famName = item.product.famille.name;
        if (!familyMap.has(famId)) {
          familyMap.set(famId, {
            id: famId,
            name: famName,
            totalRevenue: 0,
            totalDiscount: 0,
            products: new Map()
          });
        }
        const fam = familyMap.get(famId);
        fam.totalRevenue += parseFloat(item.total);
        fam.totalDiscount += parseFloat(item.discount);
        const pid = item.product.id;
        if (!fam.products.has(pid)) {
          fam.products.set(pid, {
            id: pid,
            name: item.product.name,
            designation_legale: item.product.designation_legale || undefined,
            quantity: 0,
            revenue: 0,
            discount: 0
          });
        }
        const p = fam.products.get(pid);
        p.quantity += parseFloat(item.quantity);
        p.revenue += parseFloat(item.total);
        p.discount += parseFloat(item.discount);
      });
    });

    const families = Array.from(familyMap.values()).map(f => ({
      ...f,
      products: Array.from(f.products.values())
    }));

    // Map to existing DailyExtractDetail shape for compatibility
    const detail = {
      date: (session.closedAt || session.openedAt).toISOString().split('T')[0],
      families,
      totalDiscount,
      totalRevenue,
      soldeDebit: 0,
      expenses: [],
      totalExpenses: 0,
      totalCaisse: session.expectedCash || 0,
      withdrawal: (session.cashMovements || [])
        .filter(m => m.type === 'RETRAIT_CENTRALE')
        .reduce((sum, m) => sum + parseFloat(m.amount || 0), 0),
      remainingCash: (session.countedCash ?? 0)
    };

    res.json(detail);
  } catch (error) {
    console.error('Error generating session extract detail:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/daily-extracts/:date', async (req, res) => {
  try {
    const { date } = req.params;
    // Optional depot filter; if not provided, aggregate across all depots
    const depotIdParam = req.query.depotId;
    const targetDepotId = depotIdParam ? parseInt(depotIdParam) : null;
    
    // Parse date properly - handle YYYY-MM-DD format using local timezone
    const [year, month, day] = date.split('-').map(Number);
    const startDate = new Date(year, month - 1, day, 0, 0, 0, 0);
    const endDate = new Date(year, month - 1, day, 23, 59, 59, 999);
    
    console.log(`Detail endpoint - Parsed date: ${date}, Start: ${startDate.toISOString()}, End: ${endDate.toISOString()}`);

    // Get sessions that were active on this day (opened before end of day, closed after start of day)
    const activeSessions = await prisma.sessionCaisse.findMany({
      where: {
        ...(targetDepotId ? { depotId: targetDepotId } : {}),
        openedAt: { lte: endDate },
        OR: [
          { closedAt: { gte: startDate } },
          { status: 'OPEN' }
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
        ...(targetDepotId ? { depotId: targetDepotId } : {}),
        status: 'COMPLETED',
        sessionId: { in: sessionIds }
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
        ...(targetDepotId ? { depotId: targetDepotId } : {}),
        isApproved: true,
        date: { gte: startDate, lte: endDate }
      },
      include: {
        category: true
      }
    });

    // Get sessions closed on this day to get real closure data
    const closedSessions = await prisma.sessionCaisse.findMany({
      where: {
        ...(targetDepotId ? { depotId: targetDepotId } : {}),
        status: 'CLOSED',
        closedAt: { gte: startDate, lte: endDate }
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
        product.quantity += parseFloat(item.quantity);
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
    // For dev environment, use depot ID 3 (shop) as default
    const targetDepotId = parseInt(req.user?.depotId || req.query.depotId || '3');
    
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
        product.quantity += parseFloat(item.quantity);
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
        const cost = parseFloat(item.product?.prix_achat || 0) * parseFloat(item.quantity);
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

// Stock KPIs endpoint
router.get('/stock-kpis', authenticateToken, async (req, res) => {
  try {
    const { depotId, startDate, endDate } = req.query;
    const targetDepotId = parseInt(depotId || req.user.depotId);
    
    const today = new Date();
    const startOfDay = new Date(today);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);

    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - 7);
    startOfWeek.setHours(0, 0, 0, 0);

    // Get sessions for today and week
    const [todaySessions, weekSessions] = await Promise.all([
      prisma.sessionCaisse.findMany({
        where: {
          depotId: targetDepotId,
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
          depotId: targetDepotId,
          openedAt: { lte: endOfDay },
          OR: [
            { closedAt: { gte: startOfWeek } },
            { status: 'OPEN' }
          ]
        },
        select: { id: true }
      })
    ]);

    const todaySessionIds = todaySessions.map(s => s.id);
    const weekSessionIds = weekSessions.map(s => s.id);

    // Get sales data
    const [todaySales, weekSales] = await Promise.all([
      prisma.sale.findMany({
        where: {
          status: 'COMPLETED',
          depotId: targetDepotId,
          sessionId: { in: todaySessionIds }
        }
      }),
      prisma.sale.findMany({
        where: {
          status: 'COMPLETED',
          depotId: targetDepotId,
          sessionId: { in: weekSessionIds }
        }
      })
    ]);

    // Calculate sales totals
    const todaySalesTotal = todaySales.reduce((sum, sale) => sum + parseFloat(sale.finalTotal || 0), 0);
    const weekSalesTotal = weekSales.reduce((sum, sale) => sum + parseFloat(sale.finalTotal || 0), 0);

    // Get stock movements for today and week
    const [todayMovements, weekMovements] = await Promise.all([
      prisma.stockMovement.findMany({
        where: {
          depotId: targetDepotId,
          date: { gte: startOfDay, lte: endOfDay }
        }
      }),
      prisma.stockMovement.findMany({
        where: {
          depotId: targetDepotId,
          date: { gte: startOfWeek, lte: endOfDay }
        }
      })
    ]);

    // Calculate stock movement totals
    const todayEntries = todayMovements
      .filter(m => m.type === 'ENTRY')
      .reduce((sum, m) => sum + parseFloat(m.quantity || 0), 0);
    
    const todayExits = todayMovements
      .filter(m => m.type === 'EXIT')
      .reduce((sum, m) => sum + parseFloat(m.quantity || 0), 0);

    const weekEntries = weekMovements
      .filter(m => m.type === 'ENTRY')
      .reduce((sum, m) => sum + parseFloat(m.quantity || 0), 0);
    
    const weekExits = weekMovements
      .filter(m => m.type === 'EXIT')
      .reduce((sum, m) => sum + parseFloat(m.quantity || 0), 0);

    // Calculate turnover rate
    const turnoverRate = todayExits > 0 ? todayEntries / todayExits : 0;

    // Calculate percentage changes (simplified)
    const todaySalesChange = 0; // Would need previous day data
    const weekSalesChange = 0; // Would need previous week data
    const entriesChange = 0; // Would need previous period data
    const exitsChange = 0; // Would need previous period data
    const turnoverChange = 0; // Would need previous period data

    res.json({
      todaySales: todaySalesTotal,
      weekSales: weekSalesTotal,
      totalEntries: todayEntries,
      totalExits: todayExits,
      turnoverRate: turnoverRate,
      todaySalesChange: todaySalesChange,
      weekSalesChange: weekSalesChange,
      entriesChange: entriesChange,
      exitsChange: exitsChange,
      turnoverChange: turnoverChange
    });
  } catch (error) {
    console.error('Error generating stock KPIs:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Stock sales chart data endpoint
router.get('/stock-sales-chart', authenticateToken, async (req, res) => {
  try {
    const { depotId, startDate, endDate } = req.query;
    const targetDepotId = parseInt(depotId || req.user.depotId);
    
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();
    end.setHours(23, 59, 59, 999);

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

    // Get sales data grouped by date
    const sales = await prisma.sale.groupBy({
      by: ['createdAt'],
      where: {
        status: 'COMPLETED',
        depotId: targetDepotId,
        sessionId: { in: sessionIds }
      },
      _sum: {
        finalTotal: true
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    const chartData = sales.map(sale => ({
      date: sale.createdAt.toISOString().split('T')[0],
      sales: parseFloat(sale._sum.finalTotal || 0)
    }));

    res.json(chartData);
  } catch (error) {
    console.error('Error generating stock sales chart data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Stock movements chart data endpoint
router.get('/stock-movements-chart', authenticateToken, async (req, res) => {
  try {
    const { depotId, startDate, endDate } = req.query;
    const targetDepotId = parseInt(depotId || req.user.depotId);
    
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();
    end.setHours(23, 59, 59, 999);

    // Get stock movements grouped by date
    const movements = await prisma.stockMovement.groupBy({
      by: ['date'],
      where: {
        depotId: targetDepotId,
        date: { gte: start, lte: end }
      },
      _sum: {
        quantity: true
      },
      orderBy: {
        date: 'asc'
      }
    });

    const chartData = movements.map(movement => {
      const entries = movement.type === 'ENTRY' ? parseFloat(movement._sum.quantity || 0) : 0;
      const exits = movement.type === 'EXIT' ? parseFloat(movement._sum.quantity || 0) : 0;
      
      return {
        date: movement.date.toISOString().split('T')[0],
        entries: entries,
        exits: exits
      };
    });

    res.json(chartData);
  } catch (error) {
    console.error('Error generating stock movements chart data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Top products endpoint
router.get('/stock-top-products', authenticateToken, async (req, res) => {
  try {
    const { depotId, startDate, endDate, limit = 10 } = req.query;
    const targetDepotId = parseInt(depotId || req.user.depotId);
    
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();
    end.setHours(23, 59, 59, 999);

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

    // Get top products by sales
    const products = await prisma.saleItem.groupBy({
      by: ['productId'],
      where: {
        sale: {
          status: 'COMPLETED',
          depotId: targetDepotId,
          sessionId: { in: sessionIds }
        }
      },
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
      },
      take: parseInt(limit)
    });

    const productIds = products.map(p => p.productId);
    const productDetails = await prisma.product.findMany({
      where: {
        id: { in: productIds }
      },
      select: {
        id: true,
        name: true
      }
    });

    const topProducts = products.map(product => {
      const details = productDetails.find(d => d.id === product.productId);
      return {
        id: product.productId,
        name: details?.name || 'Unknown',
        sales: parseFloat(product._sum.total || 0),
        quantity: parseFloat(product._sum.quantity || 0),
        revenue: parseFloat(product._sum.total || 0)
      };
    });

    res.json(topProducts);
  } catch (error) {
    console.error('Error generating top products:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Top clients endpoint
router.get('/stock-top-clients', authenticateToken, async (req, res) => {
  try {
    const { depotId, startDate, endDate, limit = 10 } = req.query;
    const targetDepotId = parseInt(depotId || req.user.depotId);
    
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();
    end.setHours(23, 59, 59, 999);

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

    // Get top clients by sales
    const clients = await prisma.sale.groupBy({
      by: ['clientId'],
      where: {
        status: 'COMPLETED',
        depotId: targetDepotId,
        sessionId: { in: sessionIds },
        clientId: { not: null }
      },
      _sum: {
        finalTotal: true
      },
      _count: {
        id: true
      },
      orderBy: {
        _sum: {
          finalTotal: 'desc'
        }
      },
      take: parseInt(limit)
    });

    const clientIds = clients.map(c => c.clientId).filter(Boolean);
    const clientDetails = await prisma.client.findMany({
      where: {
        id: { in: clientIds }
      },
      select: {
        id: true,
        firstName: true,
        lastName: true
      }
    });

    const topClients = clients.map(client => {
      const details = clientDetails.find(d => d.id === client.clientId);
      return {
        id: client.clientId,
        name: details ? `${details.firstName} ${details.lastName}` : 'Unknown',
        total: parseFloat(client._sum.finalTotal || 0),
        orders: client._count.id
      };
    });

    res.json(topClients);
  } catch (error) {
    console.error('Error generating top clients:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Product analytics endpoint
router.get('/stock-product-analytics', authenticateToken, async (req, res) => {
  try {
    const { depotId, startDate, endDate } = req.query;
    const targetDepotId = parseInt(depotId || req.user.depotId);
    
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();
    end.setHours(23, 59, 59, 999);

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

    // Get product analytics
    const products = await prisma.saleItem.groupBy({
      by: ['productId'],
      where: {
        sale: {
          status: 'COMPLETED',
          depotId: targetDepotId,
          sessionId: { in: sessionIds }
        }
      },
      _sum: {
        quantity: true,
        total: true
      },
      _avg: {
        unitPrice: true
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
        prix_achat: true
      }
    });

    const analytics = products.map(product => {
      const details = productDetails.find(d => d.id === product.productId);
      const quantityOut = parseFloat(product._sum.quantity || 0);
      const sales = parseFloat(product._sum.total || 0);
      const avgPrice = parseFloat(product._avg.unitPrice || 0);
      const costPrice = parseFloat(details?.prix_achat || 0);
      const margin = avgPrice > 0 && costPrice > 0 ? ((avgPrice - costPrice) / avgPrice) * 100 : 0;

      return {
        id: product.productId,
        name: details?.name || 'Unknown',
        sales: sales,
        quantityOut: quantityOut,
        quantityIn: 0, // Would need stock movements data
        margin: margin,
        topClients: [], // Would need client analysis
        dailyEvolution: [], // Would need daily breakdown
        lastMovements: [] // Would need recent movements
      };
    });

    res.json(analytics);
  } catch (error) {
    console.error('Error generating product analytics:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Dashboard endpoint
router.get('/dashboard', authenticateToken, async (req, res) => {
  try {
    const { depotId, startDate, endDate } = req.query;
    const targetDepotId = parseInt(depotId || req.user.depotId);
    
    const today = new Date();
    const startOfDay = new Date(today);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);

    // Default month range OR custom date range
    const startOfMonth = startDate ? new Date(startDate) : new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = endDate ? new Date(endDate) : new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
    if (!endDate) { endOfMonth.setHours(23,59,59,999); }

    const startOfYear = new Date(today.getFullYear(), 0, 1);
    const endOfYear = new Date(today.getFullYear(), 11, 31, 23, 59, 59, 999);

    // Get sessions for each period (monthly becomes date-range aware)
    const [dailySessions, monthlySessions, yearlySessions] = await Promise.all([
      prisma.sessionCaisse.findMany({
        where: {
          depotId: targetDepotId,
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
          depotId: targetDepotId,
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
          depotId: targetDepotId,
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
          depotId: targetDepotId,
          sessionId: { in: dailySessionIds }
        },
        include: {
          items: {
            include: {
              product: true
            }
          }
        }
      }),
      prisma.sale.findMany({
        where: {
          status: 'COMPLETED',
          depotId: targetDepotId,
          sessionId: { in: monthlySessionIds }
        },
        include: {
          items: {
            include: {
              product: true
            }
          }
        }
      }),
      prisma.sale.findMany({
        where: {
          status: 'COMPLETED',
          depotId: targetDepotId,
          sessionId: { in: yearlySessionIds }
        },
        include: {
          items: {
            include: {
              product: true
            }
          }
        }
      })
    ]);

    // Calculate sales totals
    const sales = {
      daily: dailySales.reduce((sum, sale) => sum + parseFloat(sale.finalTotal || 0), 0),
      monthly: monthlySales.reduce((sum, sale) => sum + parseFloat(sale.finalTotal || 0), 0),
      yearly: yearlySales.reduce((sum, sale) => sum + parseFloat(sale.finalTotal || 0), 0)
    };

    // Calculate purchase costs (from sale items)
    const purchases = {
      daily: dailySales.reduce((sum, sale) => {
        return sum + sale.items.reduce((itemSum, item) => {
          const cost = parseFloat(item.product?.prix_achat || 0) * parseFloat(item.quantity);
          return itemSum + cost;
        }, 0);
      }, 0),
      monthly: monthlySales.reduce((sum, sale) => {
        return sum + sale.items.reduce((itemSum, item) => {
          const cost = parseFloat(item.product?.prix_achat || 0) * parseFloat(item.quantity);
          return itemSum + cost;
        }, 0);
      }, 0),
      yearly: yearlySales.reduce((sum, sale) => {
        return sum + sale.items.reduce((itemSum, item) => {
          const cost = parseFloat(item.product?.prix_achat || 0) * parseFloat(item.quantity);
          return itemSum + cost;
        }, 0);
      }, 0)
    };

    // Calculate stock value with CMUP (Coût Moyen Unitaire Pondéré)
    const stockValue = await prisma.inventory.aggregate({
      where: {
        depotId: targetDepotId
      },
      _sum: {
        quantity: true
      }
    });

    // Get all products with their purchase prices for CMUP calculation
    const inventoryItems = await prisma.inventory.findMany({
      where: {
        depotId: targetDepotId
      },
      include: {
        product: true
      }
    });

    // Calculate stock value using CMUP (average purchase price)
    const stockValueCMUP = inventoryItems.reduce((sum, item) => {
      const avgPurchasePrice = parseFloat(item.product?.prix_achat || 0);
      const quantity = parseFloat(item.quantity || 0);
      return sum + (avgPurchasePrice * quantity);
    }, 0);

    // Helper to aggregate discounts and free items
    const aggregateReductions = (salesList) => {
      let discountTotal = 0;
      let freeItemsValue = 0;
      for (const sale of salesList) {
        discountTotal += parseFloat(sale.discount || 0);
        for (const item of (sale.items || [])) {
          const itemDiscount = parseFloat(item.discount || 0);
          const unitPrice = parseFloat(item.unitPrice || 0);
          const qty = parseFloat(item.quantity || 0);
          const lineTotal = parseFloat(item.total || 0);
          discountTotal += itemDiscount;
          if (lineTotal === 0 && qty > 0) {
            // Consider fully free items as unit price * quantity
            freeItemsValue += unitPrice * qty;
          }
        }
      }
      return { discountTotal, freeItemsValue };
    };

    // Calculate reductions per period
    const dRed = aggregateReductions(dailySales);
    const mRed = aggregateReductions(monthlySales);
    const yRed = aggregateReductions(yearlySales);

    // Expenses per period (approved expenses in date range for the depot)
    const [dailyExpenses, monthlyExpenses, yearlyExpenses] = await Promise.all([
      prisma.expense.findMany({ where: { depotId: targetDepotId, isApproved: true, date: { gte: startOfDay, lte: endOfDay } } }),
      prisma.expense.findMany({ where: { depotId: targetDepotId, isApproved: true, date: { gte: startOfMonth, lte: endOfMonth } } }),
      prisma.expense.findMany({ where: { depotId: targetDepotId, isApproved: true, date: { gte: startOfYear, lte: endOfYear } } })
    ]);

    const expenses = {
      daily: dailyExpenses.reduce((s, e) => s + parseFloat(e.amount || 0), 0),
      monthly: monthlyExpenses.reduce((s, e) => s + parseFloat(e.amount || 0), 0),
      yearly: yearlyExpenses.reduce((s, e) => s + parseFloat(e.amount || 0), 0)
    };

    const discounts = {
      daily: dRed.discountTotal,
      monthly: mRed.discountTotal,
      yearly: yRed.discountTotal
    };

    const freeItems = {
      daily: dRed.freeItemsValue,
      monthly: mRed.freeItemsValue,
      yearly: yRed.freeItemsValue
    };

    // Result 1: Résultat de stock vendu = Ventes - Valeur stock CMUP
    const resultStockOnly = {
      daily: sales.daily - stockValueCMUP,
      monthly: sales.monthly - stockValueCMUP,
      yearly: sales.yearly - stockValueCMUP
    };

    // Result 2: Résultat total = Ventes - (Coût des ventes CMUP + Valeur stock CMUP)
    const resultTotal = {
      daily: sales.daily - (purchases.daily + stockValueCMUP),
      monthly: sales.monthly - (purchases.monthly + stockValueCMUP),
      yearly: sales.yearly - (purchases.yearly + stockValueCMUP)
    };

    // Final result grid: résultat 1 - (remises + gratuites + dépenses)
    const finalResult = {
      daily: resultStockOnly.daily - (discounts.daily + freeItems.daily + expenses.daily),
      monthly: resultStockOnly.monthly - (discounts.monthly + freeItems.monthly + expenses.monthly),
      yearly: resultStockOnly.yearly - (discounts.yearly + freeItems.yearly + expenses.yearly)
    };

    // Get new clients this month
    const newClientsThisMonth = await prisma.client.count({
      where: {
        depotId: targetDepotId,
        createdAt: {
          gte: startOfMonth,
          lte: endOfMonth
        }
      }
    });

    // Get payment delays (clients with debt > 0)
    const paymentDelays = await prisma.client.count({
      where: {
        depotId: targetDepotId,
        currentDebt: {
          gt: 0
        }
      }
    });

    // Get new negotiations (sales with clients this month)
    const newNegotiations = await prisma.sale.count({
      where: {
        depotId: targetDepotId,
        clientId: { not: null },
        status: 'COMPLETED',
        sessionId: { in: monthlySessionIds }
      }
    });

    const indicators = {
      newClients: newClientsThisMonth,
      newNegotiations: newNegotiations,
      paymentDelays: paymentDelays
    };

    res.json({
      sales,
      purchases,
      results: resultTotal, // keep legacy 'results' for existing UI
      resultStockOnly,
      resultTotal,
      finalResult,
      discounts,
      freeItems,
      expenses,
      indicators,
      stockValue: stockValueCMUP
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
        
        // Calculate purchase price (using prix_achat from product)
        const purchasePrice = parseFloat(item.product.prix_achat || 0) * parseFloat(item.quantity);
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

    // Format for frontend
    const formattedReports = reports.map(client => ({
      id: client.clientId,
      name: client.clientName,
      clientName: client.clientName,
      total: client.totalAmount,
      totalAmount: client.totalAmount,
      orders: client.salesCount,
      salesCount: client.salesCount
    }));

    res.json(formattedReports);
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