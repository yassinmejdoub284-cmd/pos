const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const targetDepotId = 3;
  console.log(`Searching for products in Depot ID: ${targetDepotId}`);

  const products = await prisma.product.findMany({
    where: {
      depotAssignments: {
        some: {
          depotId: targetDepotId
        }
      }
    },
    select: {
      id: true,
      name: true,
      depotAssignments: {
        select: {
          depotId: true
        }
      }
    }
  });

  console.log('Results:');
  products.forEach(p => {
    console.log(`ID: ${p.id}, Name: ${p.name}, Depots: ${p.depotAssignments.map(a => a.depotId).join(',')}`);
  });
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
