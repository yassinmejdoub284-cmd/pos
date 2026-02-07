const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Searching for 7.37 in ProduitDeCaisse.initialStock');
  const articles = await prisma.produitDeCaisse.findMany({
    where: {
      initialStock: {
        gte: 7.36,
        lte: 7.38
      }
    }
  });
  console.log('Articles found:', JSON.stringify(articles, null, 2));

  console.log('\nSearching for 7.37 in StockDocumentItem');
  const items = await prisma.stockDocumentItem.findMany({
    where: {
      quantity: {
        gte: 7.36,
        lte: 7.38
      }
    },
    include: {
      document: true,
      product: true
    }
  });
  console.log('Document items found:', JSON.stringify(items, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
