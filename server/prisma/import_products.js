const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
    console.log('📦 Démarrage de l\'importation des produits...');

    try {
        // 1. Lire le fichier JSON source
        // Note: Chemin en dur basé sur la demande utilisateur
        const jsonPath = path.resolve('C:/Users/USER/Downloads/PoS_Patisserie-1/products_202601251718.json');
        if (!fs.existsSync(jsonPath)) {
            throw new Error(`Fichier introuvable : ${jsonPath}`);
        }

        const rawData = fs.readFileSync(jsonPath, 'utf-8');
        const data = JSON.parse(rawData);

        // Le JSON semble avoir une structure { "products": [...] } ou être un tableau direct.
        // D'après l'aperçu, c'est { "products": [...] }
        const productsToImport = data.products || data;

        if (!Array.isArray(productsToImport)) {
            throw new Error('Format JSON invalide : La racine doit être un objet { "products": [] } ou un tableau.');
        }

        // 2. Initialisation des caches (pour éviter les requêtes répétitives)
        const familiesCache = new Map();

        // Récupérer un dépôt par défaut pour l'assignation (Optionnel mais recommandé)
        let defaultDepot = await prisma.depot.findFirst({ where: { isActive: true } });
        if (!defaultDepot) {
            console.warn('⚠️ Aucun dépôt actif trouvé. Les produits ne seront assignés à aucun dépôt par défaut.');
        }

        let successCount = 0;
        let errorCount = 0;

        for (const item of productsToImport) {
            try {
                // --- Gestion de la Famille (Catégorie) ---
                let familyId = null;
                if (item.category) {
                    const categoryName = item.category.trim();

                    if (!familiesCache.has(categoryName)) {
                        // Chercher ou créer la famille
                        let family = await prisma.productFamily.findUnique({
                            where: { name: categoryName }
                        });

                        if (!family) {
                            family = await prisma.productFamily.create({
                                data: { name: categoryName }
                            });
                        }
                        familiesCache.set(categoryName, family.id);
                    }
                    familyId = familiesCache.get(categoryName);
                }

                // Si pas de famille, on peut en créer une "Divers" ou laisser null si le schéma l'autorise (mais schéma dit Int non nullable pour familleId généralement, à vérifier)
                // Vérif schéma: familleId Int @map("famille_id") -> Non nullable.
                if (!familyId) {
                    let defaultFamily = await prisma.productFamily.findUnique({ where: { name: 'Divers' } });
                    if (!defaultFamily) {
                        defaultFamily = await prisma.productFamily.create({ data: { name: 'Divers' } });
                    }
                    familyId = defaultFamily.id;
                }


                // --- Préparation des Données du Produit ---
                // Nettoyage et conversion
                const purchasePrice = parseFloat(item.purchasePrice) || 0;
                const sellingPrice = parseFloat(item.sellingPrice) || 0;

                // --- Vérifier si le produit existe déjà (par code-barre) ---
                let existingProduct = null;
                if (item.barcode) {
                    existingProduct = await prisma.product.findUnique({
                        where: { barcode: item.barcode }
                    });
                }

                const productData = {
                    name: item.productName || 'Sans nom',
                    description: item.description,
                    designation_legale: item.description, // Mapping description -> designation_legale aussi pour l'instant
                    barcode: item.barcode || null,
                    photo: item.img,
                    prix_achat: purchasePrice,
                    prix_vente_TTC: sellingPrice,
                    familleId: familyId,
                    tva: 19.0, // Valeur par défaut
                    unite: 'pcs',
                    isStockable: true
                };

                if (existingProduct) {
                    // Update (Optionnel, ici on écrase ou on ignore ? L'utilisateur a dit "ajouter tous les produit", souvent ça implique Update si existe)
                    // Je vais faire un update pour être sûr que les prix sont à jour
                    // console.log(`🔄 Mise à jour produit : ${item.productName} (${item.barcode})`);
                    await prisma.product.update({
                        where: { id: existingProduct.id },
                        data: productData
                    });
                    // TODO: Gérer l'inventaire si quantité fournie ?
                    // item.quantity est présent.
                } else {
                    // Create
                    // console.log(`✨ Création produit : ${item.productName}`);
                    const newProduct = await prisma.product.create({
                        data: productData
                    });

                    // --- Gestion Inventaire / Dépôt ---
                    // Si on a un dépôt par défaut, on initialise l'inventaire
                    if (defaultDepot) {
                        // Lier le produit au dépôt (ProductDepot / Accessibilité)
                        /*
                        Le schéma a:
                         model ProductDepot { productId, depotId ... }
                         model Inventory { depotId, productId, quantity ... }
                        */

                        // 1. Assigner le produit au dépôt
                        await prisma.productDepot.upsert({
                            where: { productId_depotId: { productId: newProduct.id, depotId: defaultDepot.id } },
                            create: { productId: newProduct.id, depotId: defaultDepot.id },
                            update: {}
                        });

                        // 2. Mettre à jour le stock si quantité > 0
                        const qty = parseFloat(item.quantity) || 0;
                        if (qty > 0) {
                            await prisma.inventory.upsert({
                                where: { depotId_productId: { productId: newProduct.id, depotId: defaultDepot.id } },
                                create: { productId: newProduct.id, depotId: defaultDepot.id, quantity: qty },
                                update: { quantity: qty }
                            });
                        }

                        // 3. Créer le prix par dépôt (ProductDepotPrice)
                        await prisma.productDepotPrice.upsert({
                            where: { productId_depotId: { productId: newProduct.id, depotId: defaultDepot.id } },
                            create: { productId: newProduct.id, depotId: defaultDepot.id, prix_vente_TTC: sellingPrice },
                            update: { prix_vente_TTC: sellingPrice }
                        });
                    }
                }

                successCount++;
                if (successCount % 50 === 0) process.stdout.write('.');

            } catch (err) {
                console.error(`\n❌ Erreur sur le produit ${item.productName} :`, err.message);
                errorCount++;
            }
        }

        console.log(`\n\n✅ Importation terminée.`);
        console.log(`Succès : ${successCount}`);
        console.log(`Erreurs : ${errorCount}`);

    } catch (error) {
        console.error('❌ Erreur globale :', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
