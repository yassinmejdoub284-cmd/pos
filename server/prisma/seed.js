import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

/**
 * Seed "vierge" — Samurai Food.
 *
 * Ne cree QUE le strict minimum pour que le logiciel demarre :
 *   - 2 depots : Depot Principal Sfax et Boutique Sfax
 *   - 1 compte administrateur, PIN 1100
 *   - 1 famille de produits generique (le champ familleId est obligatoire)
 *   - les moyens de paiement et les categories de depenses
 *
 * AUCUN produit, AUCUN client, AUCUNE depense, AUCUN stock de demonstration.
 * Le client saisit ses propres donnees.
 */
async function main() {

  // ---------------------------------------------------------------- depots
  const depots = await Promise.all([
    prisma.depot.upsert({
      where: { code: 'SFX-MAIN' },
      update: { name: 'Depot Principal Sfax', isActive: true },
      create: {
        name: 'Depot Principal Sfax',
        code: 'SFX-MAIN',
        type: 'MAIN',
        address: '',
        city: 'Sfax',
        phone: null,
        email: null
      }
    }),
    prisma.depot.upsert({
      where: { code: 'SHOP-SFX' },
      update: { name: 'Boutique Sfax', isActive: true },
      create: {
        name: 'Boutique Sfax',
        code: 'SHOP-SFX',
        type: 'SHOP',
        address: '',
        city: 'Sfax',
        phone: null,
        email: null
      }
    })
  ]);

  // ------------------------------------------------------- famille par defaut
  // familleId est obligatoire cote schema : sans au moins une famille, il est
  // impossible de creer un produit depuis l'interface.
  let defaultFamily = await prisma.productFamily.findFirst({
    where: { name: 'General' }
  });
  if (!defaultFamily) {
    defaultFamily = await prisma.productFamily.create({
      data: { name: 'General', description: 'Famille par defaut' }
    });
  }

  // ------------------------------------------------------ moyens de paiement
  const paymentMethodData = [
    { name: 'Especes', type: 'CASH' },
    { name: 'Carte Bancaire', type: 'CARD' },
    { name: 'Virement Bancaire', type: 'BANK_TRANSFER' }
  ];
  for (const methodData of paymentMethodData) {
    const existing = await prisma.paymentMethod.findFirst({ where: { name: methodData.name } });
    if (!existing) {
      await prisma.paymentMethod.create({ data: methodData });
    }
  }

  // --------------------------------------------------- categories de depenses
  const expenseCategoryData = [
    { name: 'Fournitures',   description: 'Fournitures et materiel',      color: 'red',    icon: '🏪' },
    { name: 'Electricite',   description: 'Factures d\'electricite',       color: 'blue',   icon: '⚡' },
    { name: 'Eau',           description: 'Factures d\'eau',               color: 'green',  icon: '💧' },
    { name: 'Loyer',         description: 'Loyer des locaux',              color: 'purple', icon: '🏢' },
    { name: 'Salaire',       description: 'Salaires et remunerations',     color: 'orange', icon: '👥' },
    { name: 'Transport',     description: 'Frais de transport',            color: 'pink',   icon: '🚚' },
    { name: 'Telephone',     description: 'Frais de telecommunication',    color: 'teal',   icon: '📱' },
    { name: 'Assurance',     description: 'Assurances diverses',           color: 'indigo', icon: '🛡️' },
    { name: 'Autre',         description: 'Autres depenses',               color: 'yellow', icon: '➕' }
  ];
  for (const catData of expenseCategoryData) {
    const existing = await prisma.expenseCategory.findFirst({ where: { name: catData.name } });
    if (!existing) {
      await prisma.expenseCategory.create({ data: catData });
    }
  }

  // -------------------------------------------------- compte administrateur
  // Seul acces livre avec le logiciel. PIN 1100.
  const adminPassword = await bcrypt.hash('Admin2024!', 12);
  await prisma.user.upsert({
    where: { username: 'admin' },
    update: { passwordHash: adminPassword, pin: '1100', isActive: true },
    create: {
      username: 'admin',
      email: 'admin@samuraifood.tn',
      passwordHash: adminPassword,
      pin: '1100',
      firstName: 'Admin',
      lastName: 'Samurai Food',
      role: 'ADMIN',
      depotId: depots[0].id
    }
  });
}

main()
  .catch((e) => {
    console.error('Erreur pendant le seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
