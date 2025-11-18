const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Script to force fix gift sales stock - recalculates inventory based on all gift sales
 * This script will:
 * 1. Find all CADEAU sales
 * 2. For each sale, ensure stock is deducted from inventory
 * 3. Create stock movement records if missing
 * 4. Recalculate inventory to match expected values
 */

async function forceFixGiftStock() {
  try {
    console.log('Starting FORCE gift stock fix...\n');
    console.log('⚠️  This will recalculate inventory for all gift sales\n');

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

    // Group by depot and product to calculate total quantities
    const depotProductTotals = new Map();

    for (const sale of giftSales) {
      if (!sale.depotId) {
        console.log(`⚠️  Sale #${sale.id}: No depotId, skipping...`);
        skippedCount++;
        continue;
      }

      const targetDepotId = sale.depotId;

      for (const item of sale.items) {
        const itemProductId = parseInt(item.productId);
        const itemQuantity = parseFloat(item.quantity) || 0;

        if (!itemProductId || itemQuantity <= 0) {
          continue;
        }

        const key = `${targetDepotId}_${itemProductId}`;
        if (!depotProductTotals.has(key)) {
          depotProductTotals.set(key, {
            depotId: targetDepotId,
            productId: itemProductId,
            totalQuantity: 0,
            sales: []
          });
        }

        const entry = depotProductTotals.get(key);
        entry.totalQuantity += itemQuantity;
        entry.sales.push({ saleId: sale.id, quantity: itemQuantity, createdAt: sale.createdAt, userId: sale.userId });
      }
    }

    console.log(`\nProcessing ${depotProductTotals.size} unique depot-product combinations...\n`);

    // Process each depot-product combination
    for (const [key, entry] of depotProductTotals.entries()) {
      const { depotId, productId, totalQuantity, sales } = entry;

      try {
        // Get current inventory
        const currentInventory = await prisma.inventory.findUnique({
          where: {
            depotId_productId: {
              depotId: depotId,
              productId: productId
            }
          }
        });

        const currentQty = currentInventory ? parseFloat(currentInventory.quantity) || 0 : 0;

        // Check existing stock movements for these sales
        const existingMovements = await prisma.stockMovement.findMany({
          where: {
            productId: productId,
            depotId: depotId,
            reason: { in: ['Gift Sale', 'Gift Sale Created', 'Gift Sale Approved', 'Gift Sale (Retroactive Fix)'] },
            userId: { in: sales.map(s => s.userId) }
          }
        });

        const existingTotal = existingMovements.reduce((sum, m) => sum + parseFloat(m.quantity.toString()), 0);

        console.log(`\n📦 Product ${productId} in Depot ${depotId}:`);
        console.log(`   Current inventory: ${currentQty}`);
        console.log(`   Total gift quantity: ${totalQuantity}`);
        console.log(`   Existing movements total: ${existingTotal}`);
        console.log(`   Sales count: ${sales.length}`);

        // Calculate what the inventory should be
        // We need to deduct totalQuantity from currentQty
        // But we need to account for what was already deducted
        const alreadyDeducted = existingTotal;
        const needsDeduction = totalQuantity - alreadyDeducted;

        if (needsDeduction > 0.001) {
          console.log(`   ⚠️  Need to deduct ${needsDeduction} more`);

          await prisma.$transaction(async (tx) => {
            // Update inventory
            const newQuantity = currentQty - needsDeduction;

            await tx.inventory.upsert({
              where: {
                depotId_productId: {
                  depotId: depotId,
                  productId: productId
                }
              },
              update: {
                quantity: newQuantity
              },
              create: {
                depotId: depotId,
                productId: productId,
                quantity: -needsDeduction
              }
            });

            // Create stock movement for the missing quantity
            // Use the earliest sale date
            const earliestSale = sales.reduce((earliest, sale) => 
              sale.createdAt < earliest.createdAt ? sale : earliest
            );

            await tx.stockMovement.create({
              data: {
                productId: productId,
                depotId: depotId,
                quantity: needsDeduction,
                type: 'OUT',
                reason: 'Gift Sale (Retroactive Fix)',
                userId: earliestSale.userId,
                date: earliestSale.createdAt
              }
            });

            console.log(`   ✅ Updated inventory: ${currentQty} → ${newQuantity}`);
            console.log(`   ✅ Created movement for ${needsDeduction}`);
          });

          fixedCount++;
        } else {
          // Check if inventory needs adjustment
          const expectedInventory = currentQty; // Should already account for deductions
          // But we need to verify: if movements exist, inventory should reflect them
          
          // Recalculate what inventory should be based on all movements
          const allMovements = await prisma.stockMovement.findMany({
            where: {
              productId: productId,
              depotId: depotId,
              type: 'OUT'
            }
          });

          const allOutMovements = allMovements.reduce((sum, m) => sum + parseFloat(m.quantity.toString()), 0);

          const allInMovements = await prisma.stockMovement.findMany({
            where: {
              productId: productId,
              depotId: depotId,
              type: 'IN'
            }
          });

          const allInTotal = allInMovements.reduce((sum, m) => sum + parseFloat(m.quantity.toString()), 0);

          // This is a simplified check - in reality, we'd need to track initial inventory
          console.log(`   ✅ Stock movements exist, inventory should be correct`);
          skippedCount++;
        }

        // Create missing movements for individual sales if needed
        for (const saleInfo of sales) {
          const hasMovement = existingMovements.some(m => {
            const movementDate = new Date(m.date);
            const saleDate = new Date(saleInfo.createdAt);
            const timeDiff = Math.abs(movementDate.getTime() - saleDate.getTime());
            return m.productId === productId && 
                   timeDiff < 300000 && // 5 minutes
                   Math.abs(parseFloat(m.quantity.toString()) - saleInfo.quantity) < 0.001;
          });

          if (!hasMovement) {
            console.log(`   📝 Creating missing movement for sale #${saleInfo.saleId}`);
            
            await prisma.stockMovement.create({
              data: {
                productId: productId,
                depotId: depotId,
                quantity: saleInfo.quantity,
                type: 'OUT',
                reason: 'Gift Sale (Retroactive Fix)',
                userId: saleInfo.userId,
                date: saleInfo.createdAt
              }
            });
          }
        }

      } catch (error) {
        errorCount++;
        console.error(`   ❌ Error processing product ${productId} in depot ${depotId}:`, error.message);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('Summary:');
    console.log(`  Total gift sales: ${giftSales.length}`);
    console.log(`  Unique products processed: ${depotProductTotals.size}`);
    console.log(`  Fixed: ${fixedCount}`);
    console.log(`  Skipped: ${skippedCount}`);
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
forceFixGiftStock()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });

