const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('--- PRODUCT 78 (Counterpart for Centre Ville) ---');
  const product = await prisma.product.findUnique({
    where: { id: 78 },
    include: {
      depotAssignments: {
        include: {
          depot: true
        }
      }
    }
  });
  console.log(JSON.stringify(product, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
