require('dotenv').config();
const { prisma } = require('../lib/prisma');

async function createUserDepotsTable() {
  try {
    console.log('Creating user_depots table...');
    
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS \`user_depots\` (
        \`id\` INT NOT NULL AUTO_INCREMENT,
        \`user_id\` INT NOT NULL,
        \`depot_id\` INT NOT NULL,
        \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        \`updated_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`user_depots_user_id_depot_id_key\` (\`user_id\`, \`depot_id\`),
        INDEX \`user_depots_user_id_fkey\` (\`user_id\`),
        INDEX \`user_depots_depot_id_fkey\` (\`depot_id\`),
        CONSTRAINT \`user_depots_user_id_fkey\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT \`user_depots_depot_id_fkey\` FOREIGN KEY (\`depot_id\`) REFERENCES \`depots\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    
    console.log('✅ user_depots table created successfully!');
    
    // Verify table exists
    const tableExists = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = DATABASE() 
      AND table_name = 'user_depots'
    `);
    
    console.log('Table verification:', tableExists);
    console.log('\n✅ Migration completed successfully!');
    console.log('You can now use multiple depot assignments for users.');
    
  } catch (error) {
    console.error('❌ Error creating user_depots table:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the migration
createUserDepotsTable()
  .then(() => {
    console.log('\n✅ Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });

