import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Create or update depots
  const depots = await Promise.all([
    prisma.depot.upsert({
      where: { code: 'SFX-MAIN' },
      update: {},
      create: {
        name: 'Dépôt Principal Sfax',
        code: 'SFX-MAIN',
        type: 'MAIN',
        address: '123 Rue de la Liberté',
        city: 'Sfax',
        phone: '+216 74 123 456',
        email: 'sfax@patisserie.tn'
      }
    }),
    prisma.depot.upsert({
      where: { code: 'TUN-BRANCH' },
      update: {},
      create: {
        name: 'Dépôt Tunis',
        code: 'TUN-BRANCH',
        type: 'BRANCH',
        address: '456 Avenue Habib Bourguiba',
        city: 'Tunis',
        phone: '+216 71 234 567',
        email: 'tunis@patisserie.tn'
      }
    }),
    prisma.depot.upsert({
      where: { code: 'SHOP-CV' },
      update: {},
      create: {
        name: 'Boutique Centre Ville',
        code: 'SHOP-CV',
        type: 'SHOP',
        address: '789 Place de la République',
        city: 'Sfax',
        phone: '+216 74 345 678',
        email: 'shop@patisserie.tn'
      }
    })
  ]);

  console.log('✅ Depots created');

  // Create or update product categories
  const categoryNames = [
    { name: 'Pâtisseries', description: 'Gâteaux et pâtisseries traditionnelles' },
    { name: 'Viennoiseries', description: 'Croissants, pains au chocolat, etc.' },
    { name: 'Biscuits', description: 'Biscuits et cookies' },
    { name: 'Boissons', description: 'Café, thé, jus de fruits' },
    { name: 'Glaces', description: 'Crèmes glacées et sorbets' }
  ];

  const categories = [];
  for (const catData of categoryNames) {
    let category = await prisma.productCategory.findFirst({
      where: { name: catData.name }
    });
    
    if (!category) {
      category = await prisma.productCategory.create({
        data: catData
      });
    }
    
    categories.push(category);
  }

  console.log('✅ Product categories created');

  // Create or update products
  const productData = [
    { name: 'Croissant Classique', description: 'Croissant au beurre traditionnel', price: 1.20, cost: 0.60, categoryIndex: 1, barcode: '1234567890123', sku: 'CRO-001', unit: 'pièce', minStockLevel: 50, maxStockLevel: 200 },
    { name: 'Pain au Chocolat', description: 'Pain au chocolat noir', price: 1.50, cost: 0.75, categoryIndex: 1, barcode: '1234567890124', sku: 'PAC-001', unit: 'pièce', minStockLevel: 40, maxStockLevel: 150 },
    { name: 'Éclair au Chocolat', description: 'Éclair garni de crème pâtissière et chocolat', price: 2.50, cost: 1.25, categoryIndex: 0, barcode: '1234567890125', sku: 'ECL-001', unit: 'pièce', minStockLevel: 30, maxStockLevel: 100 },
    { name: 'Mille-Feuille', description: 'Mille-feuille à la vanille', price: 3.00, cost: 1.50, categoryIndex: 0, barcode: '1234567890126', sku: 'MF-001', unit: 'pièce', minStockLevel: 20, maxStockLevel: 80 },
    { name: 'Tarte aux Pommes', description: 'Tarte aux pommes traditionnelle', price: 4.50, cost: 2.25, categoryIndex: 0, barcode: '1234567890127', sku: 'TAP-001', unit: 'pièce', minStockLevel: 15, maxStockLevel: 60 },
    { name: 'Café Expresso', description: 'Expresso italien', price: 1.80, cost: 0.90, categoryIndex: 3, barcode: '1234567890128', sku: 'CAF-001', unit: 'tasse', minStockLevel: 100, maxStockLevel: 300 },
    { name: 'Thé à la Menthe', description: 'Thé vert à la menthe fraîche', price: 2.00, cost: 1.00, categoryIndex: 3, barcode: '1234567890129', sku: 'THE-001', unit: 'tasse', minStockLevel: 80, maxStockLevel: 250 },
    { name: 'Cookie Chocolat', description: 'Cookie aux pépites de chocolat', price: 1.00, cost: 0.50, categoryIndex: 2, barcode: '1234567890130', sku: 'COO-001', unit: 'pièce', minStockLevel: 60, maxStockLevel: 200 }
  ];

  const products = [];
  for (const prodData of productData) {
    let product = await prisma.product.findFirst({
      where: { sku: prodData.sku }
    });
    
    if (!product) {
      product = await prisma.product.create({
        data: {
          name: prodData.name,
          description: prodData.description,
          price: prodData.price,
          cost: prodData.cost,
          categoryId: categories[prodData.categoryIndex].id,
          barcode: prodData.barcode,
          sku: prodData.sku,
          unit: prodData.unit,
          minStockLevel: prodData.minStockLevel,
          maxStockLevel: prodData.maxStockLevel
        }
      });
    }
    
    products.push(product);
  }

  console.log('✅ Products created');

  // Create or update payment methods
  const paymentMethodData = [
    { name: 'Espèces', type: 'CASH' },
    { name: 'Carte Bancaire', type: 'CARD' },
    { name: 'Mobile Money', type: 'MOBILE' },
    { name: 'Virement Bancaire', type: 'BANK_TRANSFER' }
  ];

  const paymentMethods = [];
  for (const methodData of paymentMethodData) {
    let method = await prisma.paymentMethod.findFirst({
      where: { name: methodData.name }
    });
    
    if (!method) {
      method = await prisma.paymentMethod.create({
        data: methodData
      });
    }
    
    paymentMethods.push(method);
  }

  console.log('✅ Payment methods created');

  // Create or update expense categories
  const expenseCategoryData = [
    { name: 'Fournitures', description: 'Fournitures de bureau et matériel', color: 'red', icon: '🏪' },
    { name: 'Électricité', description: 'Factures d\'électricité', color: 'blue', icon: '⚡' },
    { name: 'Eau', description: 'Factures d\'eau', color: 'green', icon: '💧' },
    { name: 'Loyer', description: 'Loyer des locaux', color: 'purple', icon: '🏢' },
    { name: 'Salaire', description: 'Salaires et rémunérations', color: 'orange', icon: '👥' },
    { name: 'Transport', description: 'Frais de transport et livraison', color: 'pink', icon: '🚚' },
    { name: 'Téléphone', description: 'Frais de télécommunication', color: 'teal', icon: '📱' },
    { name: 'Assurance', description: 'Assurances diverses', color: 'indigo', icon: '🛡️' },
    { name: 'Autre', description: 'Autres dépenses', color: 'yellow', icon: '➕' }
  ];

  const expenseCategories = [];
  for (const catData of expenseCategoryData) {
    let category = await prisma.expenseCategory.findFirst({
      where: { name: catData.name }
    });
    
    if (!category) {
      category = await prisma.expenseCategory.create({
        data: catData
      });
    }
    
    expenseCategories.push(category);
  }

  console.log('✅ Expense categories created');

  // Create or update users
  const hashedPassword = await bcrypt.hash('admin123', 12);
  
  const users = await Promise.all([
    prisma.user.upsert({
      where: { username: 'admin' },
      update: {},
      create: {
        username: 'admin',
        email: 'admin@patisserie.tn',
        passwordHash: hashedPassword,
        firstName: 'Admin',
        lastName: 'Principal',
        role: 'ADMIN',
        depotId: depots[0].id
      }
    }),
    prisma.user.upsert({
      where: { username: 'manager_sfax' },
      update: {},
      create: {
        username: 'manager_sfax',
        email: 'manager.sfax@patisserie.tn',
        passwordHash: hashedPassword,
        firstName: 'Ahmed',
        lastName: 'Ben Ali',
        role: 'MANAGER',
        depotId: depots[0].id
      }
    }),
    prisma.user.upsert({
      where: { username: 'cashier1' },
      update: {},
      create: {
        username: 'cashier1',
        email: 'cashier1@patisserie.tn',
        passwordHash: hashedPassword,
        firstName: 'Fatma',
        lastName: 'Trabelsi',
        role: 'CASHIER',
        depotId: depots[2].id
      }
    }),
    prisma.user.upsert({
      where: { username: 'stock_manager' },
      update: {},
      create: {
        username: 'stock_manager',
        email: 'stock@patisserie.tn',
        passwordHash: hashedPassword,
        firstName: 'Mohamed',
        lastName: 'Hassan',
        role: 'STOCK_MANAGER',
        depotId: depots[0].id
      }
    })
  ]);

  console.log('✅ Users created');

  // Create or update customers
  const customerData = [
    { name: 'Ali Ben Salem', email: 'ali.bensalem@email.tn', phone: '+216 74 111 222', address: '15 Rue de la Paix, Sfax', loyaltyPoints: 150 },
    { name: 'Amina Karray', email: 'amina.karray@email.tn', phone: '+216 74 333 444', address: '28 Avenue de l\'Indépendance, Sfax', loyaltyPoints: 75 },
    { name: 'Hassan Trabelsi', email: 'hassan.trabelsi@email.tn', phone: '+216 74 555 666', address: '7 Rue du Commerce, Sfax', loyaltyPoints: 200 }
  ];

  const customers = [];
  for (const custData of customerData) {
    let customer = await prisma.customer.findFirst({
      where: { email: custData.email }
    });
    
    if (!customer) {
      customer = await prisma.customer.create({
        data: custData
      });
    }
    
    customers.push(customer);
  }

  console.log('✅ Customers created');

  // Create or update inventory
  for (const depot of depots) {
    for (const product of products) {
      let quantity = 0;
      if (depot.code === 'SFX-MAIN') {
        quantity = Math.floor(Math.random() * 200) + 50;
      } else if (depot.code === 'TUN-BRANCH') {
        quantity = Math.floor(Math.random() * 150) + 30;
      } else {
        quantity = Math.floor(Math.random() * 100) + 20;
      }

      await prisma.inventory.upsert({
        where: {
          depotId_productId: {
            depotId: depot.id,
            productId: product.id
          }
        },
        update: {
          quantity,
          reservedQuantity: 0
        },
        create: {
          depotId: depot.id,
          productId: product.id,
          quantity,
          reservedQuantity: 0
        }
      });
    }
  }

  console.log('✅ Inventory created');

  // Create sample expenses
  const expenseData = [
    {
      amount: 150.00,
      description: 'Achat fournitures de bureau',
      categoryId: expenseCategories[0].id, // Fournitures
      depotId: depots[0].id, // SFX-MAIN
      userId: users[1].id, // manager_sfax
      date: new Date('2024-01-15'),
      notes: 'Papeterie et matériel de bureau'
    },
    {
      amount: 89.50,
      description: 'Facture électricité janvier',
      categoryId: expenseCategories[1].id, // Électricité
      depotId: depots[0].id, // SFX-MAIN
      userId: users[1].id, // manager_sfax
      date: new Date('2024-01-20'),
      notes: 'Consommation électrique du mois'
    },
    {
      amount: 45.00,
      description: 'Facture eau',
      categoryId: expenseCategories[2].id, // Eau
      depotId: depots[0].id, // SFX-MAIN
      userId: users[1].id, // manager_sfax
      date: new Date('2024-01-25'),
      notes: 'Consommation d\'eau'
    },
    {
      amount: 1200.00,
      description: 'Loyer boutique centre ville',
      categoryId: expenseCategories[3].id, // Loyer
      depotId: depots[2].id, // SHOP-CV
      userId: users[2].id, // cashier1
      date: new Date('2024-01-01'),
      notes: 'Loyer mensuel boutique',
      isApproved: true,
      approvedBy: users[0].id, // admin
      approvedAt: new Date('2024-01-02')
    },
    {
      amount: 85.00,
      description: 'Frais de transport livraison',
      categoryId: expenseCategories[5].id, // Transport
      depotId: depots[0].id, // SFX-MAIN
      userId: users[3].id, // stock_manager
      date: new Date('2024-01-18'),
      notes: 'Carburant pour livraisons'
    },
    {
      amount: 35.00,
      description: 'Facture téléphone',
      categoryId: expenseCategories[6].id, // Téléphone
      depotId: depots[0].id, // SFX-MAIN
      userId: users[1].id, // manager_sfax
      date: new Date('2024-01-22'),
      notes: 'Forfait mobile professionnel'
    },
    {
      amount: 200.00,
      description: 'Assurance responsabilité civile',
      categoryId: expenseCategories[7].id, // Assurance
      depotId: depots[0].id, // SFX-MAIN
      userId: users[1].id, // manager_sfax
      date: new Date('2024-01-10'),
      notes: 'Assurance annuelle',
      isApproved: true,
      approvedBy: users[0].id, // admin
      approvedAt: new Date('2024-01-11')
    },
    {
      amount: 75.50,
      description: 'Maintenance équipement',
      categoryId: expenseCategories[8].id, // Autre
      depotId: depots[2].id, // SHOP-CV
      userId: users[2].id, // cashier1
      date: new Date('2024-01-28'),
      notes: 'Réparation four à pâtisserie'
    }
  ];

  for (const expData of expenseData) {
    await prisma.expense.create({
      data: expData
    });
  }

  console.log('✅ Sample expenses created');

  console.log('🎉 Database seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 