const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Searching for inventory with quantity close to 7.37');
  const inventory = await prisma.inventory.findMany({
    where: {
      quantity: {
        gte: 7.36,
        lte: 7.38
      }
    },
    include: {
      product: true,
      depot: true
    }
  });
  console.log(JSON.stringify(inventory, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
