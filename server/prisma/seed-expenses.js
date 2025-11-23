const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function seedExpenseCategories() {
  try {


    const categories = [
      {
        name: 'Fournitures',
        description: 'Fournitures de bureau et matériel',
        color: 'red',
        icon: '🏪'
      },
      {
        name: 'Électricité',
        description: 'Factures d\'électricité',
        color: 'blue',
        icon: '⚡'
      },
      {
        name: 'Eau',
        description: 'Factures d\'eau',
        color: 'green',
        icon: '💧'
      },
      {
        name: 'Loyer',
        description: 'Loyer des locaux',
        color: 'purple',
        icon: '🏢'
      },
      {
        name: 'Salaire',
        description: 'Salaires et rémunérations',
        color: 'orange',
        icon: '👥'
      },
      {
        name: 'Transport',
        description: 'Frais de transport et livraison',
        color: 'pink',
        icon: '🚚'
      },
      {
        name: 'Téléphone',
        description: 'Frais de télécommunication',
        color: 'teal',
        icon: '📱'
      },
      {
        name: 'Assurance',
        description: 'Assurances diverses',
        color: 'indigo',
        icon: '🛡️'
      },
      {
        name: 'Autre',
        description: 'Autres dépenses',
        color: 'yellow',
        icon: '➕'
      }
    ];

    for (const category of categories) {
      await prisma.expenseCategory.upsert({
        where: { name: category.name },
        update: category,
        create: category
      });
    }


  } catch (error) {
    console.error('❌ Error seeding expense categories:', error);
    throw error;
  }
}

async function main() {
  await seedExpenseCategories();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 