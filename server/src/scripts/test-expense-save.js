const { prisma } = require('../lib/prisma');

/**
 * Script to test if expenses are being saved correctly
 */

async function testExpenseSave() {
  console.log('🧪 Testing Expense Save and Retrieval...\n');

  try {
    // Get all expenses
    const allExpenses = await prisma.expense.findMany({
      include: {
        depot: true,
        category: true,
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            depotId: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 10
    });

    console.log(`📊 Total expenses in database: ${allExpenses.length}\n`);

    if (allExpenses.length > 0) {
      console.log('📋 Recent Expenses:');
      console.log('='.repeat(80));
      allExpenses.forEach((expense, index) => {
        console.log(`\n${index + 1}. Expense ID: ${expense.id}`);
        console.log(`   Amount: ${expense.amount} DT`);
        console.log(`   Category: ${expense.category?.name || 'N/A'}`);
        console.log(`   Depot: ${expense.depot?.name || 'N/A'} (ID: ${expense.depotId})`);
        console.log(`   User: ${expense.user?.firstName} ${expense.user?.lastName} (Depot ID: ${expense.user?.depotId})`);
        console.log(`   Date: ${expense.date}`);
        console.log(`   Created: ${expense.createdAt}`);
        console.log(`   Notes: ${expense.notes || 'N/A'}`);
        console.log(`   Is Paid: ${expense.isPaid}`);
        console.log(`   Is Advance: ${expense.isAdvance}`);
      });
    } else {
      console.log('⚠️  No expenses found in database');
    }

    // Test filtering by depot
    console.log('\n' + '='.repeat(80));
    console.log('📊 Expenses by Depot:');
    console.log('='.repeat(80));

    const depots = await prisma.depot.findMany({ where: { isActive: true } });
    
    for (const depot of depots) {
      const depotExpenses = await prisma.expense.count({
        where: { depotId: depot.id }
      });
      console.log(`\nDepot ${depot.id} (${depot.name}): ${depotExpenses} expenses`);
    }

    // Check for expenses without depotId
    const expensesWithoutDepot = await prisma.expense.count({
      where: { depotId: null }
    });
    if (expensesWithoutDepot > 0) {
      console.log(`\n⚠️  ${expensesWithoutDepot} expenses without depotId (should be fixed)`);
    }

    console.log('\n✅ Test completed');
  } catch (error) {
    console.error('❌ Error during test:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run test
if (require.main === module) {
  testExpenseSave()
    .then(() => {
      console.log('\n✅ Test completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Test failed:', error);
      process.exit(1);
    });
}

module.exports = { testExpenseSave };

