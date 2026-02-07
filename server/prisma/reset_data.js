const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Démarrage du nettoyage de la base de données...');

  try {
    // 1. Désactiver les contraintes de clé étrangère
    await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 0;');

    // 2. Tables à conserver (Liste blanche)
    // Note: 'acces' est interprété comme user_depots (liens utilisateurs-dépôts) + configuration de base
    const tablesToKeep = [
      'users',
      'depots',
      'user_depots',
      'companies',
      'users_enterprise',
      'payment_methods',      // Configuration
      'expense_categories',    // Configuration
      '_prisma_migrations'     // Système Prisma
    ];

    // 3. Récupérer toutes les tables
    const result = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = DATABASE()
    `;

    // 4. Filtrer et Tronquer
    for (const row of result) {
      const tableName = row.TABLE_NAME || row.table_name;
      
      if (!tablesToKeep.includes(tableName)) {
        console.log(`🗑️  Suppression des données de la table : ${tableName}`);
        await prisma.$executeRawUnsafe(`TRUNCATE TABLE \`${tableName}\`;`);
      } else {
        console.log(`🔒  Conservation de la table : ${tableName}`);
      }
    }

    console.log('✅ Nettoyage terminé avec succès.');

  } catch (error) {
    console.error('❌ Erreur lors du nettoyage :', error);
  } finally {
    // 5. Réactiver les contraintes de clé étrangère
    await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1;');
    await prisma.$disconnect();
  }
}

main();
