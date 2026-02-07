const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const targetDepotId = 3; // Let's assume user is in Depot 3 based on previous context
  
  console.log('--- ARTICLE 13 STATUS ---');
  const article13 = await prisma.produitDeCaisse.findUnique({
    where: { id: 13 },
    include: {
      parentProduct: {
        include: {
          depotAssignments: {
            include: { depot: true }
          }
        }
      }
    }
  });
  console.log(JSON.stringify(article13, null, 2));

  console.log('\n--- ALL ARTICLES RETURNED FOR DEPOT 3 ---');
  const articlesForDepot3 = await prisma.produitDeCaisse.findMany({
    where: {
      isActive: true,
      parentProduct: {
        depotAssignments: {
          some: {
            depotId: 3
          }
        }
      }
    },
    select: { id: true, name: true }
  });
  console.log(`Count: ${articlesForDepot3.length}`);
  console.log(JSON.stringify(articlesForDepot3, null, 2));

  console.log('\n--- ALL ARTICLES WITHOUT PARENT DEPOT ASSIGNMENT ---');
  // Finding articles whose parent has NO depot assignments at all
  const orphanArticles = await prisma.produitDeCaisse.findMany({
    where: {
      parentProduct: {
        depotAssignments: {
          none: {}
        }
      }
    },
    select: { id: true, name: true, parentProductId: true }
  });
  console.log(`Count: ${orphanArticles.length}`);
  console.log(JSON.stringify(orphanArticles, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
