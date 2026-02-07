const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const targetDepotId = 3;
  console.log(`Checking articles for Depot ${targetDepotId} (Backend logic simulated)`);
  
  const articles = await prisma.produitDeCaisse.findMany({
    where: { isActive: true }
  });
  
  console.log(`Count: ${articles.length}`);
  const id13 = articles.find(a => a.id === 13);
  console.log(`Article 13 found: ${!!id13}`);
  if (id13) {
    console.log(`Article 13 parent ID: ${id13.parentProductId}`);
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
