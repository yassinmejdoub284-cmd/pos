const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Script to fix gift sales that don't have stock deducted
 * This script will:
 * 1. Find all CADEAU sales that don't have corresponding stock movements
 * 2. Deduct stock from inventory for each item
 * 3. Create stock movement records
 */

async function fixGiftStock() {
  try {
    console.log('Starting gift stock fix...\n');

    // Find all CADEAU sales
    const giftSales = await prisma.sale.findMany({
      where: {
        status: 'CADEAU'
      },
      include: {
        items: true,
        depot: {
          select: {
            id: true,
            name: true,
            code: true
          }
        }
      },
      orderBy: {
        id: 'asc'
      }
    });

    console.log(`Found ${giftSales.length} gift sales\n`);

    let fixedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const sale of giftSales) {
      if (!sale.depotId) {
        console.log(`⚠️  Sale #${sale.id}: No depotId, skipping...`);
        skippedCount++;
        continue;
      }

      const targetDepotId = sale.depotId;
      console.log(`\n📦 Processing Sale #${sale.id} (Depot: ${sale.depot?.name || targetDepotId})`);
      console.log(`   Items: ${sale.items.length}`);

      // Check if stock movements exist for this sale
      const existingMovements = await prisma.stockMovement.findMany({
        where: {
          productId: { in: sale.items.map(item => item.productId) },
          depotId: targetDepotId,
          reason: { in: ['Gift Sale', 'Gift Sale Created', 'Gift Sale Approved'] },
          date: {
            gte: new Date(sale.createdAt.getTime() - 60000), // 1 minute before
            lte: new Date(sale.createdAt.getTime() + 60000)  // 1 minute after
          }
        }
      });

      // Check if we need to process this sale
      const itemsNeedingStock = sale.items.filter(item => {
        const hasMovement = existingMovements.some(m => 
          m.productId === item.productId && 
          parseFloat(m.quantity.toString()) === parseFloat(item.quantity.toString())
        );
        return !hasMovement;
      });

      if (itemsNeedingStock.length === 0) {
        console.log(`   ✅ Stock already deducted, skipping...`);
        skippedCount++;
        continue;
      }

      console.log(`   ⚠️  ${itemsNeedingStock.length} items need stock deduction`);

      try {
        await prisma.$transaction(async (tx) => {
          for (const item of itemsNeedingStock) {
            const itemQuantity = parseFloat(item.quantity) || 0;
            const itemProductId = parseInt(item.productId);

            if (!itemProductId || itemQuantity <= 0) {
              console.log(`   ⚠️  Skipping invalid item: productId=${itemProductId}, quantity=${itemQuantity}`);
              continue;
            }

            // Get current inventory
            const currentInventory = await tx.inventory.findUnique({
              where: {
                depotId_productId: {
                  depotId: targetDepotId,
                  productId: itemProductId
                }
              }
            });

            const currentQty = currentInventory ? parseFloat(currentInventory.quantity) || 0 : 0;
            const newQuantity = currentQty - itemQuantity;

            console.log(`   📊 Product ${itemProductId}: ${currentQty} → ${newQuantity} (removing ${itemQuantity})`);

            // Update or create inventory
            await tx.inventory.upsert({
              where: {
                depotId_productId: {
                  depotId: targetDepotId,
                  productId: itemProductId
                }
              },
              update: {
                quantity: newQuantity
              },
              create: {
                depotId: targetDepotId,
                productId: itemProductId,
                quantity: -itemQuantity
              }
            });

            // Create stock movement
            await tx.stockMovement.create({
              data: {
                productId: itemProductId,
                depotId: targetDepotId,
                quantity: itemQuantity,
                type: 'OUT',
                reason: 'Gift Sale (Retroactive Fix)',
                userId: sale.userId,
                date: sale.createdAt
              }
            });

            console.log(`   ✅ Stock deducted and movement created for product ${itemProductId}`);
          }
        });

        fixedCount++;
        console.log(`   ✅ Sale #${sale.id} fixed successfully`);
      } catch (error) {
        errorCount++;
        console.error(`   ❌ Error fixing sale #${sale.id}:`, error.message);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('Summary:');
    console.log(`  Total gift sales: ${giftSales.length}`);
    console.log(`  Fixed: ${fixedCount}`);
    console.log(`  Skipped (already fixed): ${skippedCount}`);
    console.log(`  Errors: ${errorCount}`);
    console.log('='.repeat(60));

  } catch (error) {
    console.error('Fatal error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
fixGiftStock()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });

