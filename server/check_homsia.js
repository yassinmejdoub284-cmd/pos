const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('--- SEARCHING FOR HOMSIA ARTICLES ---');
  const articles = await prisma.produitDeCaisse.findMany({
    where: {
      name: { contains: 'HOMSIA' }
    },
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
  console.log(JSON.stringify(articles, null, 2));

  console.log('\n--- SEARCHING FOR ALL PARENTS OF ARTICLES IN DEPOT 3 ---');
  const cache5 = await prisma.produitDeCaisse.findMany({
    where: {
      isActive: true,
      parentProduct: {
        depotAssignments: {
          some: {
            depotId: 3
          }
        }
      }
    }
  });
  console.log(JSON.stringify(cache5.map(a => ({ id: a.id, name: a.name, parentId: a.parentProductId })), null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
