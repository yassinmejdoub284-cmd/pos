const { prisma } = require('../lib/prisma');

/**
 * Script to get daily extract (extrait journalier) data
 * Usage: node get-daily-extract.js [depotId] [date] [days]
 * Examples:
 *   node get-daily-extract.js                    - Get last 10 days for all depots
 *   node get-daily-extract.js 3                  - Get last 10 days for depot 3
 *   node get-daily-extract.js 3 2025-01-15       - Get specific date for depot 3
 *   node get-daily-extract.js 3 null 30          - Get last 30 days for depot 3
 */

async function getDailyExtract() {
  try {
    const depotIdArg = process.argv[2];
    const dateArg = process.argv[3];
    const daysArg = process.argv[4];

    const depotId = depotIdArg && depotIdArg !== 'null' ? parseInt(depotIdArg) : null;
    const days = daysArg ? parseInt(daysArg) : 10;

    console.log('\n=== Daily Extract (Extrait Journalier) ===');
    if (depotId) {
      const depot = await prisma.depot.findUnique({ where: { id: depotId } });
      if (depot) {
        console.log(`Depot: ${depot.name} (ID: ${depotId})`);
      } else {
        console.log(`Depot ID: ${depotId} (not found)`);
      }
    } else {
      console.log('Depot: All depots');
    }

    if (dateArg && dateArg !== 'null') {
      console.log(`Date: ${dateArg}`);
      await getSpecificDateExtract(depotId, dateArg);
    } else {
      console.log(`Days: Last ${days} days`);
      await getLastNDaysExtract(depotId, days);
    }

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

async function getLastNDaysExtract(depotId, days) {
  const lastNDays = [];
  const todayDate = new Date();
  todayDate.setUTCHours(0, 0, 0, 0);

  for (let i = 0; i < days; i++) {
    const date = new Date(todayDate);
    date.setDate(todayDate.getDate() - i);
    lastNDays.push(date);
  }

  console.log('\n=== Extracts ===\n');

  for (const date of lastNDays) {
    const dateString = date.toISOString().split('T')[0];
    const extract = await getExtractForDate(depotId, dateString);
    
    if (extract.hasData) {
      console.log(`📅 ${dateString}:`);
      console.log(`   Sales: ${extract.totalSales}`);
      console.log(`   Revenue: ${extract.totalRevenue.toFixed(3)} TND`);
      console.log(`   Discount: ${extract.totalDiscount.toFixed(3)} TND`);
      console.log(`   Expenses: ${extract.totalExpenses.toFixed(3)} TND`);
      console.log(`   Net: ${(extract.totalRevenue - extract.totalExpenses).toFixed(3)} TND`);
      console.log(`   Families: ${extract.families.length}`);
      console.log('');
    } else {
      console.log(`📅 ${dateString}: No data`);
    }
  }
}

async function getSpecificDateExtract(depotId, dateString) {
  const extract = await getExtractForDate(depotId, dateString);
  
  console.log('\n=== Extract Details ===\n');
  
  if (!extract.hasData) {
    console.log('No data found for this date.');
    return;
  }

  console.log(`Date: ${extract.date}`);
  console.log(`Total Sales: ${extract.totalSales}`);
  console.log(`Total Revenue: ${extract.totalRevenue.toFixed(3)} TND`);
  console.log(`Total Discount: ${extract.totalDiscount.toFixed(3)} TND`);
  console.log(`Total Expenses: ${extract.totalExpenses.toFixed(3)} TND`);
  console.log(`Net Revenue: ${(extract.totalRevenue - extract.totalExpenses).toFixed(3)} TND`);
  console.log(`\n=== Families ===\n`);

  extract.families.forEach(family => {
    console.log(`\n${family.name}:`);
    console.log(`  Revenue: ${family.totalRevenue.toFixed(3)} TND`);
    console.log(`  Discount: ${family.totalDiscount.toFixed(3)} TND`);
    console.log(`  Products: ${family.products.length}`);
    
    if (family.products.length > 0) {
      console.log(`  Top Products:`);
      family.products
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5)
        .forEach(product => {
          console.log(`    - ${product.name}: ${product.quantity} units, ${product.revenue.toFixed(3)} TND`);
        });
    }
  });
}

async function getExtractForDate(depotId, dateString) {
  const [year, month, day] = dateString.split('-').map(Number);
  const startDate = new Date(year, month - 1, day, 0, 0, 0, 0);
  const endDate = new Date(year, month - 1, day, 23, 59, 59, 999);

  // Get sessions active on this day
  const activeSessions = await prisma.sessionCaisse.findMany({
    where: {
      ...(depotId ? { depotId: depotId } : {}),
      openedAt: { lte: endDate },
      OR: [
        { closedAt: { gte: startDate } },
        { status: 'OPEN' }
      ]
    },
    select: { id: true }
  });

  const sessionIds = activeSessions.map(s => s.id);

  if (sessionIds.length === 0) {
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

  // Get sales
  const sales = await prisma.sale.findMany({
    where: {
      ...(depotId ? { depotId: depotId } : {}),
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

  // Get expenses
  const expenses = await prisma.expense.findMany({
    where: {
      ...(depotId ? { depotId: depotId } : {}),
      isApproved: true,
      date: {
        gte: startDate,
        lte: endDate
      }
    }
  });

  // Get cash movements (expenses from sessions)
  const sessions = await prisma.sessionCaisse.findMany({
    where: { id: { in: sessionIds } },
    include: { cashMovements: true }
  });

  const sessionExpenses = sessions.flatMap(s => 
    s.cashMovements.filter(m => 
      (m.type === 'SORTIE' || m.type === 'DEPOT_COFFRE') &&
      m.createdAt >= startDate &&
      m.createdAt <= endDate
    )
  );

  const totalExpenses = expenses.reduce((sum, e) => sum + parseFloat(e.amount || 0), 0) +
    sessionExpenses.reduce((sum, m) => sum + parseFloat(m.amount || 0), 0);

  // Calculate totals
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
      
      const family = familyMap.get(famId);
      family.totalRevenue += parseFloat(item.total);
      family.totalDiscount += parseFloat(item.discount);
      
      const pid = item.product.id;
      if (!family.products.has(pid)) {
        family.products.set(pid, {
          id: pid,
          name: item.product.name,
          quantity: 0,
          revenue: 0,
          discount: 0
        });
      }
      
      const product = family.products.get(pid);
      product.quantity += parseFloat(item.quantity);
      product.revenue += parseFloat(item.total);
      product.discount += parseFloat(item.discount);
    });
  });

  const families = Array.from(familyMap.values()).map(f => ({
    ...f,
    products: Array.from(f.products.values())
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
}

getDailyExtract();

