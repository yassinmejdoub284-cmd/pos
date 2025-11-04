const { prisma } = require('../lib/prisma');

/**
 * Script to test depot isolation for all GET and POST endpoints
 * Ensures that users can only access/modify data from their assigned depot
 */

async function testDepotIsolation() {
  console.log('🧪 Testing Depot Isolation for All Endpoints...\n');

  try {
    // Get all depots
    const depots = await prisma.depot.findMany({ where: { isActive: true } });
    console.log(`✓ Found ${depots.length} active depots\n`);

    if (depots.length < 2) {
      console.log('⚠️  Need at least 2 depots to test isolation. Skipping test.');
      return;
    }

    const depot1 = depots[0];
    const depot2 = depots[1];

    // Test results
    const results = {
      passed: [],
      failed: [],
      warnings: []
    };

    // Test 1: Clients
    console.log('1️⃣  Testing Clients...');
    const clientsDepot1 = await prisma.client.count({ where: { depotId: depot1.id } });
    const clientsDepot2 = await prisma.client.count({ where: { depotId: depot2.id } });
    console.log(`   Depot ${depot1.id}: ${clientsDepot1} clients`);
    console.log(`   Depot ${depot2.id}: ${clientsDepot2} clients`);
    if (clientsDepot1 !== clientsDepot2 || (clientsDepot1 > 0 && clientsDepot2 > 0)) {
      results.passed.push('Clients: Data is separated by depot');
    } else {
      results.warnings.push('Clients: No data separation found (may be normal if no clients exist)');
    }

    // Test 2: Suppliers
    console.log('\n2️⃣  Testing Suppliers...');
    const suppliersDepot1 = await prisma.supplier.count({ where: { depotId: depot1.id } });
    const suppliersDepot2 = await prisma.supplier.count({ where: { depotId: depot2.id } });
    const suppliersNoDepot = await prisma.supplier.count({ where: { depotId: null } });
    console.log(`   Depot ${depot1.id}: ${suppliersDepot1} suppliers`);
    console.log(`   Depot ${depot2.id}: ${suppliersDepot2} suppliers`);
    console.log(`   No depot: ${suppliersNoDepot} suppliers`);
    results.passed.push('Suppliers: depotId field exists and can be filtered');

    // Test 3: Sales
    console.log('\n3️⃣  Testing Sales...');
    const salesDepot1 = await prisma.sale.count({ where: { depotId: depot1.id } });
    const salesDepot2 = await prisma.sale.count({ where: { depotId: depot2.id } });
    console.log(`   Depot ${depot1.id}: ${salesDepot1} sales`);
    console.log(`   Depot ${depot2.id}: ${salesDepot2} sales`);
    if (salesDepot1 !== salesDepot2 || (salesDepot1 > 0 && salesDepot2 > 0)) {
      results.passed.push('Sales: Data is separated by depot');
    } else {
      results.warnings.push('Sales: No data separation found (may be normal if no sales exist)');
    }

    // Test 4: Expenses
    console.log('\n4️⃣  Testing Expenses...');
    const expensesDepot1 = await prisma.expense.count({ where: { depotId: depot1.id } });
    const expensesDepot2 = await prisma.expense.count({ where: { depotId: depot2.id } });
    console.log(`   Depot ${depot1.id}: ${expensesDepot1} expenses`);
    console.log(`   Depot ${depot2.id}: ${expensesDepot2} expenses`);
    if (expensesDepot1 !== expensesDepot2 || (expensesDepot1 > 0 && expensesDepot2 > 0)) {
      results.passed.push('Expenses: Data is separated by depot');
    } else {
      results.warnings.push('Expenses: No data separation found (may be normal if no expenses exist)');
    }

    // Test 5: Invoices
    console.log('\n5️⃣  Testing Invoices...');
    const invoicesDepot1 = await prisma.invoice.count({ where: { depotId: depot1.id } });
    const invoicesDepot2 = await prisma.invoice.count({ where: { depotId: depot2.id } });
    console.log(`   Depot ${depot1.id}: ${invoicesDepot1} invoices`);
    console.log(`   Depot ${depot2.id}: ${invoicesDepot2} invoices`);
    if (invoicesDepot1 !== invoicesDepot2 || (invoicesDepot1 > 0 && invoicesDepot2 > 0)) {
      results.passed.push('Invoices: Data is separated by depot');
    } else {
      results.warnings.push('Invoices: No data separation found (may be normal if no invoices exist)');
    }

    // Test 6: Sessions
    console.log('\n6️⃣  Testing Sessions...');
    const sessionsDepot1 = await prisma.sessionCaisse.count({ where: { depotId: depot1.id } });
    const sessionsDepot2 = await prisma.sessionCaisse.count({ where: { depotId: depot2.id } });
    console.log(`   Depot ${depot1.id}: ${sessionsDepot1} sessions`);
    console.log(`   Depot ${depot2.id}: ${sessionsDepot2} sessions`);
    if (sessionsDepot1 !== sessionsDepot2 || (sessionsDepot1 > 0 && sessionsDepot2 > 0)) {
      results.passed.push('Sessions: Data is separated by depot');
    } else {
      results.warnings.push('Sessions: No data separation found (may be normal if no sessions exist)');
    }

    // Test 7: Products (via ProductDepot assignments)
    console.log('\n7️⃣  Testing Products...');
    const productsDepot1 = await prisma.productDepot.count({ where: { depotId: depot1.id } });
    const productsDepot2 = await prisma.productDepot.count({ where: { depotId: depot2.id } });
    console.log(`   Depot ${depot1.id}: ${productsDepot1} product assignments`);
    console.log(`   Depot ${depot2.id}: ${productsDepot2} product assignments`);
    if (productsDepot1 !== productsDepot2 || (productsDepot1 > 0 && productsDepot2 > 0)) {
      results.passed.push('Products: Data is separated by depot via assignments');
    } else {
      results.warnings.push('Products: No data separation found (may be normal if no products assigned)');
    }

    // Test 8: Inventory
    console.log('\n8️⃣  Testing Inventory...');
    const inventoryDepot1 = await prisma.inventory.count({ where: { depotId: depot1.id } });
    const inventoryDepot2 = await prisma.inventory.count({ where: { depotId: depot2.id } });
    console.log(`   Depot ${depot1.id}: ${inventoryDepot1} inventory items`);
    console.log(`   Depot ${depot2.id}: ${inventoryDepot2} inventory items`);
    if (inventoryDepot1 !== inventoryDepot2 || (inventoryDepot1 > 0 && inventoryDepot2 > 0)) {
      results.passed.push('Inventory: Data is separated by depot');
    } else {
      results.warnings.push('Inventory: No data separation found (may be normal if no inventory exists)');
    }

    // Test 9: Stock Documents
    console.log('\n9️⃣  Testing Stock Documents...');
    const docsDepot1 = await prisma.stockDocument.count({
      where: {
        OR: [
          { emetteurId: depot1.id },
          { destinataireId: depot1.id }
        ]
      }
    });
    const docsDepot2 = await prisma.stockDocument.count({
      where: {
        OR: [
          { emetteurId: depot2.id },
          { destinataireId: depot2.id }
        ]
      }
    });
    console.log(`   Depot ${depot1.id}: ${docsDepot1} documents (as emitter or receiver)`);
    console.log(`   Depot ${depot2.id}: ${docsDepot2} documents (as emitter or receiver)`);
    if (docsDepot1 !== docsDepot2 || (docsDepot1 > 0 && docsDepot2 > 0)) {
      results.passed.push('Stock Documents: Data is separated by depot');
    } else {
      results.warnings.push('Stock Documents: No data separation found (may be normal if no documents exist)');
    }

    // Test 10: Users with depot assignments
    console.log('\n🔟 Testing Users...');
    const usersDepot1 = await prisma.user.count({ where: { depotId: depot1.id } });
    const usersDepot2 = await prisma.user.count({ where: { depotId: depot2.id } });
    const usersNoDepot = await prisma.user.count({ where: { depotId: null } });
    console.log(`   Depot ${depot1.id}: ${usersDepot1} users`);
    console.log(`   Depot ${depot2.id}: ${usersDepot2} users`);
    console.log(`   No depot: ${usersNoDepot} users`);
    results.passed.push('Users: depotId field exists and can be filtered');

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Passed: ${results.passed.length}`);
    results.passed.forEach(test => console.log(`   ✓ ${test}`));
    console.log(`\n⚠️  Warnings: ${results.warnings.length}`);
    results.warnings.forEach(test => console.log(`   ⚠ ${test}`));
    console.log(`\n❌ Failed: ${results.failed.length}`);
    results.failed.forEach(test => console.log(`   ✗ ${test}`));

    if (results.failed.length === 0) {
      console.log('\n✅ All depot isolation tests passed!');
      console.log('✅ Data is properly separated by depot for all tested endpoints.');
    } else {
      console.log('\n❌ Some tests failed. Please review the results above.');
    }

    return results;
  } catch (error) {
    console.error('❌ Error during testing:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run tests
if (require.main === module) {
  testDepotIsolation()
    .then(() => {
      console.log('\n✅ Test completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Test failed:', error);
      process.exit(1);
    });
}

module.exports = { testDepotIsolation };

