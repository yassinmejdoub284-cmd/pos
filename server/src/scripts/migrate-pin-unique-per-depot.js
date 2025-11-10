const { prisma } = require('../lib/prisma');

async function migratePinUniquePerDepot() {
  try {
    console.log('Starting migration: Make PIN unique per depot...');
    
    // Step 1: Check for users with NULL depotId
    const usersWithoutDepot = await prisma.user.findMany({
      where: { depotId: null },
      select: { id: true, pin: true, firstName: true, lastName: true }
    });
    
    if (usersWithoutDepot.length > 0) {
      console.log(`Found ${usersWithoutDepot.length} users without depotId:`);
      usersWithoutDepot.forEach(u => {
        console.log(`  - User ID ${u.id}: ${u.firstName} ${u.lastName} (PIN: ${u.pin})`);
      });
      
      // Get the first active depot
      const firstDepot = await prisma.depot.findFirst({
        where: { isActive: true },
        orderBy: { id: 'asc' }
      });
      
      if (!firstDepot) {
        throw new Error('No active depot found. Cannot assign users to a depot.');
      }
      
      console.log(`\nAssigning users to depot ID ${firstDepot.id} (${firstDepot.name})...`);
      
      // Assign all users without depot to the first depot
      await prisma.user.updateMany({
        where: { depotId: null },
        data: { depotId: firstDepot.id }
      });
      
      console.log(`Successfully assigned ${usersWithoutDepot.length} users to depot ${firstDepot.id}`);
    }
    
    // Step 2: Check for duplicate PINs in the same depot
    const duplicatePins = await prisma.$queryRaw`
      SELECT pin, depot_id, COUNT(*) as count
      FROM users
      WHERE depot_id IS NOT NULL
      GROUP BY pin, depot_id
      HAVING COUNT(*) > 1
    `;
    
    if (duplicatePins && duplicatePins.length > 0) {
      console.log(`\nWARNING: Found duplicate PINs in the same depot:`);
      duplicatePins.forEach(dp => {
        console.log(`  - PIN ${dp.pin} in depot ${dp.depot_id}: ${dp.count} users`);
      });
      throw new Error('Cannot create unique index: duplicate PINs exist in the same depot. Please resolve duplicates first.');
    }
    
    // Step 3: Apply the migration using raw SQL
    console.log('\nApplying database migration...');
    
    // Drop existing unique index on pin
    try {
      await prisma.$executeRaw`ALTER TABLE users DROP INDEX users_pin_key`;
      console.log('Dropped existing unique index on pin');
    } catch (error) {
      if (error.message.includes("doesn't exist")) {
        console.log('Index users_pin_key does not exist, skipping...');
      } else {
        throw error;
      }
    }
    
    // Create composite unique index on (pin, depot_id)
    await prisma.$executeRaw`
      ALTER TABLE users 
      ADD UNIQUE INDEX users_pin_depot_id_key (pin, depot_id)
    `;
    
    console.log('Successfully created composite unique index on (pin, depot_id)');
    console.log('\nMigration completed successfully!');
    
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run migration
migratePinUniquePerDepot()
  .then(() => {
    console.log('Migration script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration script failed:', error);
    process.exit(1);
  });

