const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const DEPOT_ID = 3; // Boutique Centre Ville

async function main() {
    console.log(`🚀 Assignation de tous les produits au dépôt ID ${DEPOT_ID}...`);

    try {
        const products = await prisma.product.findMany();
        console.log(`📦 Trouvé ${products.length} produits.`);

        let count = 0;
        for (const product of products) {
            // 1. Link Product to Depot
            await prisma.productDepot.upsert({
                where: { productId_depotId: { productId: product.id, depotId: DEPOT_ID } },
                create: { productId: product.id, depotId: DEPOT_ID },
                update: {}
            });

            // 2. Initialize Inventory (Optional, but good to have entry)
            // On ne remplace pas la quantité si elle existe déjà
            await prisma.inventory.upsert({
                where: { depotId_productId: { productId: product.id, depotId: DEPOT_ID } },
                create: { productId: product.id, depotId: DEPOT_ID, quantity: 0 },
                update: {} // No update of quantity if exists
            });

            // 3. Set Price for Depot
            // On met à jour le prix si nécessaire pour qu'il corresponde au prix catalogue par défaut
            await prisma.productDepotPrice.upsert({
                where: { productId_depotId: { productId: product.id, depotId: DEPOT_ID } },
                create: {
                    productId: product.id,
                    depotId: DEPOT_ID,
                    prix_vente_TTC: product.prix_vente_TTC
                },
                update: {
                    prix_vente_TTC: product.prix_vente_TTC
                }
            });

            count++;
            if (count % 50 === 0) process.stdout.write('.');
        }

        console.log(`\n✅ ${count} produits assignés au dépôt ${DEPOT_ID}.`);

    } catch (error) {
        console.error('❌ Erreur :', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
