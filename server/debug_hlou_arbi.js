const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('--- PRODUCTS (Hlou) ---');
  const products = await prisma.product.findMany({
    where: {
      name: { contains: 'HLOU' }
    },
    include: {
      depotAssignments: {
        include: {
          depot: true
        }
      },
      inventory: true
    }
  });
  products.forEach(p => {
    console.log(`ID: ${p.id}, Name: ${p.name}, InitialStock: ${p.initialStock}`);
  });

  console.log('\n--- PRODUITS DE CAISSE (Articles) for Depot 3 ---');
  const articles = await prisma.produitDeCaisse.findMany({
    where: {
      parentProduct: {
        depotAssignments: {
          some: {
            depotId: 3
          }
        }
      }
    },
    include: {
      parentProduct: {
        include: {
          depotAssignments: {
            include: {
              depot: true
            }
          }
        }
      }
    }
  });
  console.log(JSON.stringify(articles, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
