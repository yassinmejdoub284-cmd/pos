const { prisma } = require('../lib/prisma');

async function migrateVracConversions() {
  console.log('Début de la migration des conversions VRAC...');

  try {
    const productsWithVrac = await prisma.product.findMany({
      where: {
        originalProductId: { not: null },
        conversionRatio: { not: null }
      },
      include: {
        originalProduct: true
      }
    });

    console.log(`Trouvé ${productsWithVrac.length} produits VRAC à migrer`);

    let migrated = 0;
    let errors = 0;

    for (const vracProduct of productsWithVrac) {
      if (!vracProduct.originalProductId || !vracProduct.conversionRatio) {
        console.warn(`Produit ${vracProduct.id} ignoré: données incomplètes`);
        continue;
      }

      try {
        await prisma.productVracConversion.upsert({
          where: {
            unique_vrac_conversion: {
              sourceProductId: vracProduct.originalProductId,
              targetProductId: vracProduct.id
            }
          },
          create: {
            sourceProductId: vracProduct.originalProductId,
            targetProductId: vracProduct.id,
            conversionRatio: parseFloat(vracProduct.conversionRatio),
            prix_vente_vrac: vracProduct.prix_vente_vrac ? parseFloat(vracProduct.prix_vente_vrac) : null,
            prix_achat_vrac: vracProduct.prix_achat_vrac ? parseFloat(vracProduct.prix_achat_vrac) : null,
            isStockable: vracProduct.isStockable !== undefined ? vracProduct.isStockable : true
          },
          update: {
            conversionRatio: parseFloat(vracProduct.conversionRatio),
            prix_vente_vrac: vracProduct.prix_vente_vrac ? parseFloat(vracProduct.prix_vente_vrac) : null,
            prix_achat_vrac: vracProduct.prix_achat_vrac ? parseFloat(vracProduct.prix_achat_vrac) : null,
            isStockable: vracProduct.isStockable !== undefined ? vracProduct.isStockable : true
          }
        });

        const sourceProduct = await prisma.product.findUnique({
          where: { id: vracProduct.originalProductId }
        });

        if (sourceProduct && !sourceProduct.isVraguable) {
          await prisma.product.update({
            where: { id: vracProduct.originalProductId },
            data: { isVraguable: true }
          });
        }

        migrated++;
        console.log(`✓ Migré: ${vracProduct.originalProduct?.name || 'N/A'} -> ${vracProduct.name}`);
      } catch (error) {
        errors++;
        console.error(`✗ Erreur pour produit ${vracProduct.id}:`, error.message);
      }
    }

    console.log(`\nMigration terminée:`);
    console.log(`  - ${migrated} conversions migrées`);
    console.log(`  - ${errors} erreurs`);

    const sourceProducts = await prisma.product.findMany({
      where: {
        isVraguable: true
      },
      include: {
        vracProducts: {
          where: {
            originalProductId: { not: null }
          }
        }
      }
    });

    for (const sourceProduct of sourceProducts) {
      const hasNewConversions = await prisma.productVracConversion.count({
        where: { sourceProductId: sourceProduct.id }
      });

      if (hasNewConversions === 0 && sourceProduct.vracProducts.length === 0) {
        await prisma.product.update({
          where: { id: sourceProduct.id },
          data: { isVraguable: false }
        });
        console.log(`  - Produit source ${sourceProduct.id} marqué comme non-vraguable (aucune conversion)`);
      }
    }

  } catch (error) {
    console.error('Erreur lors de la migration:', error);
    throw error;
  }
}

if (require.main === module) {
  migrateVracConversions()
    .then(() => {
      console.log('Migration réussie');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration échouée:', error);
      process.exit(1);
    });
}

module.exports = { migrateVracConversions };

