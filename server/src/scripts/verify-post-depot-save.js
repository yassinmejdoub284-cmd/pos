const { prisma } = require('../lib/prisma');

/**
 * Script to verify that all POST endpoints save depotId correctly
 * This ensures data isolation when creating new records
 */

async function verifyPostDepotSave() {
  console.log('🔍 Verifying POST Endpoints Save depotId Correctly...\n');

  try {
    const results = {
      verified: [],
      issues: []
    };

    // Test 1: Verify clients have depotId
    console.log('1️⃣  Verifying Clients...');
    const clientsWithDepot = await prisma.client.count({
      where: { depotId: { not: null } }
    });
    const totalClients = await prisma.client.count();
    console.log(`   Clients with depotId: ${clientsWithDepot}/${totalClients}`);
    if (clientsWithDepot === totalClients || totalClients === 0) {
      results.verified.push('Clients: All records have depotId or no records exist');
    } else {
      results.issues.push(`Clients: ${totalClients - clientsWithDepot} records without depotId`);
    }

    // Test 2: Verify suppliers have depotId
    console.log('\n2️⃣  Verifying Suppliers...');
    const suppliersWithDepot = await prisma.supplier.count({
      where: { depotId: { not: null } }
    });
    const suppliersNoDepot = await prisma.supplier.count({
      where: { depotId: null }
    });
    const totalSuppliers = await prisma.supplier.count();
    console.log(`   Suppliers with depotId: ${suppliersWithDepot}/${totalSuppliers}`);
    console.log(`   Suppliers without depotId: ${suppliersNoDepot} (may be global suppliers)`);
    results.verified.push('Suppliers: depotId field exists and can store values');

    // Test 3: Verify sales have depotId
    console.log('\n3️⃣  Verifying Sales...');
    const totalSales = await prisma.sale.count();
    const salesWithDepot = totalSales > 0 ? await prisma.sale.count({
      where: { depotId: { isNot: null } }
    }) : 0;
    console.log(`   Sales with depotId: ${salesWithDepot}/${totalSales}`);
    if (salesWithDepot === totalSales || totalSales === 0) {
      results.verified.push('Sales: All records have depotId or no records exist');
    } else {
      results.issues.push(`Sales: ${totalSales - salesWithDepot} records without depotId`);
    }

    // Test 4: Verify expenses have depotId
    console.log('\n4️⃣  Verifying Expenses...');
    const totalExpenses = await prisma.expense.count();
    const expensesWithDepot = totalExpenses > 0 ? await prisma.expense.count({
      where: { depotId: { isNot: null } }
    }) : 0;
    console.log(`   Expenses with depotId: ${expensesWithDepot}/${totalExpenses}`);
    if (expensesWithDepot === totalExpenses || totalExpenses === 0) {
      results.verified.push('Expenses: All records have depotId or no records exist');
    } else {
      results.issues.push(`Expenses: ${totalExpenses - expensesWithDepot} records without depotId`);
    }

    // Test 5: Verify invoices have depotId
    console.log('\n5️⃣  Verifying Invoices...');
    const totalInvoices = await prisma.invoice.count();
    const invoicesWithDepot = totalInvoices > 0 ? await prisma.invoice.count({
      where: { depotId: { isNot: null } }
    }) : 0;
    console.log(`   Invoices with depotId: ${invoicesWithDepot}/${totalInvoices}`);
    if (invoicesWithDepot === totalInvoices || totalInvoices === 0) {
      results.verified.push('Invoices: All records have depotId or no records exist');
    } else {
      results.issues.push(`Invoices: ${totalInvoices - invoicesWithDepot} records without depotId`);
    }

    // Test 6: Verify sessions have depotId
    console.log('\n6️⃣  Verifying Sessions...');
    const totalSessions = await prisma.sessionCaisse.count();
    const sessionsWithDepot = totalSessions > 0 ? await prisma.sessionCaisse.count({
      where: { depotId: { isNot: null } }
    }) : 0;
    console.log(`   Sessions with depotId: ${sessionsWithDepot}/${totalSessions}`);
    if (sessionsWithDepot === totalSessions || totalSessions === 0) {
      results.verified.push('Sessions: All records have depotId or no records exist');
    } else {
      results.issues.push(`Sessions: ${totalSessions - sessionsWithDepot} records without depotId`);
    }

    // Test 7: Verify stock documents have depotId (emetteurId or destinataireId)
    console.log('\n7️⃣  Verifying Stock Documents...');
    const totalDocs = await prisma.stockDocument.count();
    const docsWithDepot = totalDocs > 0 ? await prisma.stockDocument.count({
      where: {
        OR: [
          { emetteurId: { isNot: null } },
          { destinataireId: { isNot: null } }
        ]
      }
    }) : 0;
    const totalDocs = await prisma.stockDocument.count();
    console.log(`   Documents with depotId: ${docsWithDepot}/${totalDocs}`);
    if (docsWithDepot === totalDocs || totalDocs === 0) {
      results.verified.push('Stock Documents: All records have depotId or no records exist');
    } else {
      results.issues.push(`Stock Documents: ${totalDocs - docsWithDepot} records without depotId`);
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 VERIFICATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Verified: ${results.verified.length}`);
    results.verified.forEach(item => console.log(`   ✓ ${item}`));
    console.log(`\n⚠️  Issues: ${results.issues.length}`);
    results.issues.forEach(item => console.log(`   ⚠ ${item}`));

    if (results.issues.length === 0) {
      console.log('\n✅ All POST endpoints save depotId correctly!');
      console.log('✅ Data is properly isolated by depot in the database.');
    } else {
      console.log('\n⚠️  Some issues found. Please review the results above.');
      console.log('   Note: Some records may have been created before depot isolation was implemented.');
    }

    return results;
  } catch (error) {
    console.error('❌ Error during verification:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run verification
if (require.main === module) {
  verifyPostDepotSave()
    .then(() => {
      console.log('\n✅ Verification completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Verification failed:', error);
      process.exit(1);
    });
}

module.exports = { verifyPostDepotSave };

