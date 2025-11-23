import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {


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



  // Product families (categories)
  const productFamilies = [
    'Pâtisserie',
    'Viennoiserie', 
    'Boulangerie',
    'Boissons',
    'Glaces',
    'Pâtisserie Tunisienne',
    'Jus et Smoothies'
  ];



  // Create product families first
  const familyData = [
    { name: 'Viennoiserie', description: 'Viennoiseries et croissants' },
    { name: 'Pâtisserie', description: 'Pâtisseries et gâteaux' },
    { name: 'Boissons', description: 'Cafés et boissons' },
    { name: 'Boulangerie', description: 'Pain et boulangerie' },
    { name: 'Vrac', description: 'Produits vrac - vente au poids' },
    { name: 'Pâtisserie Tunisienne', description: 'Pâtisseries traditionnelles tunisiennes' },
    { name: 'Jus et Smoothies', description: 'Jus de fruits frais et smoothies' }
  ];

  const families = [];
  for (const famData of familyData) {
    let family = await prisma.productFamily.findFirst({
      where: { name: famData.name }
    });
    
    if (!family) {
      family = await prisma.productFamily.create({
        data: famData
      });
    }
    
    families.push(family);
  }



  // Create or update products
  const productData = [
    { name: 'Croissant Classique', description: 'Croissant au beurre traditionnel', price: 1.20, familleName: 'Viennoiserie', barcode: '1234567890123' },
    { name: 'Pain au Chocolat', description: 'Pain au chocolat noir', price: 1.50, familleName: 'Viennoiserie', barcode: '1234567890124' },
    { name: 'Éclair au Chocolat', description: 'Éclair garni de crème pâtissière et chocolat', price: 2.50, familleName: 'Pâtisserie', barcode: '1234567890125' },
    { name: 'Mille-Feuille', description: 'Mille-feuille à la vanille', price: 3.00, familleName: 'Pâtisserie', barcode: '1234567890126' },
    { name: 'Tarte aux Pommes', description: 'Tarte aux pommes traditionnelle', price: 4.50, familleName: 'Pâtisserie', barcode: '1234567890127' },
    { name: 'Café Expresso', description: 'Expresso italien', price: 1.80, familleName: 'Boissons', barcode: '1234567890128' },
    { name: 'Thé à la Menthe', description: 'Thé vert à la menthe fraîche', price: 2.00, familleName: 'Boissons', barcode: '1234567890129' },
    { name: 'Cookie Chocolat', description: 'Cookie aux pépites de chocolat', price: 1.00, familleName: 'Boulangerie', barcode: '1234567890130' },
    { name: 'Gâteau au Chocolat', description: 'Gâteau moelleux au chocolat noir', price: 5.50, familleName: 'Pâtisserie', barcode: '1234567890131' },
    { name: 'Tarte Tatin', description: 'Tarte tatin aux pommes caramélisées', price: 6.00, familleName: 'Pâtisserie', barcode: '1234567890132' },
    { name: 'Profiteroles', description: 'Profiteroles à la crème chantilly et chocolat', price: 4.80, familleName: 'Pâtisserie', barcode: '1234567890133' },
    { name: 'Cheesecake', description: 'Cheesecake aux fruits rouges', price: 5.20, familleName: 'Pâtisserie', barcode: '1234567890134' },
    { name: 'Tiramisu', description: 'Tiramisu classique italien', price: 6.50, familleName: 'Pâtisserie', barcode: '1234567890135' },
    { name: 'Macarons Assortis', description: 'Macarons aux saveurs variées', price: 8.00, familleName: 'Pâtisserie', barcode: '1234567890136' },
    { name: 'Opéra', description: 'Gâteau Opéra aux amandes et café', price: 7.50, familleName: 'Pâtisserie', barcode: '1234567890137' },
    { name: 'Saint-Honoré', description: 'Saint-Honoré à la crème chiboust', price: 6.80, familleName: 'Pâtisserie', barcode: '1234567890138' },
    { name: 'Paris-Brest', description: 'Paris-Brest aux noisettes', price: 5.90, familleName: 'Pâtisserie', barcode: '1234567890139' },
    { name: 'Religieuse', description: 'Religieuse au chocolat et café', price: 4.20, familleName: 'Pâtisserie', barcode: '1234567890140' },
    
    // Tunisian Pastries
    { name: 'Baklava', description: 'Baklava aux noix et miel', price: 3.50, familleName: 'Pâtisserie Tunisienne', barcode: '1234567890141' },
    { name: 'Makroudh', description: 'Makroudh aux dattes et semoule', price: 2.80, familleName: 'Pâtisserie Tunisienne', barcode: '1234567890142' },
    { name: 'Zlabia', description: 'Zlabia frite au miel', price: 1.50, familleName: 'Pâtisserie Tunisienne', barcode: '1234567890143' },
    { name: 'Ghrayba', description: 'Ghrayba aux amandes', price: 2.20, familleName: 'Pâtisserie Tunisienne', barcode: '1234567890144' },
    { name: 'Kaak Warka', description: 'Kaak warka aux amandes', price: 3.00, familleName: 'Pâtisserie Tunisienne', barcode: '1234567890145' },
    { name: 'Samsa', description: 'Samsa aux amandes et miel', price: 2.50, familleName: 'Pâtisserie Tunisienne', barcode: '1234567890146' },
    { name: 'Cornes de Gazelle', description: 'Cornes de gazelle aux amandes', price: 4.00, familleName: 'Pâtisserie Tunisienne', barcode: '1234567890147' },
    { name: 'Mhalbiya', description: 'Mhalbiya à la rose', price: 2.80, familleName: 'Pâtisserie Tunisienne', barcode: '1234567890148' },
    { name: 'Assida', description: 'Assida au beurre et miel', price: 3.20, familleName: 'Pâtisserie Tunisienne', barcode: '1234567890149' },
    { name: 'Bambalouni', description: 'Bambalouni frit au sucre', price: 1.80, familleName: 'Pâtisserie Tunisienne', barcode: '1234567890150' },
    
    // Juices and Smoothies
    { name: 'Jus d\'Orange Frais', description: 'Jus d\'orange pressé', price: 3.50, familleName: 'Jus et Smoothies', barcode: '1234567890151' },
    { name: 'Jus de Pomme', description: 'Jus de pomme naturel', price: 3.00, familleName: 'Jus et Smoothies', barcode: '1234567890152' },
    { name: 'Jus de Grenade', description: 'Jus de grenade frais', price: 4.50, familleName: 'Jus et Smoothies', barcode: '1234567890153' },
    { name: 'Jus de Citron', description: 'Jus de citron pressé', price: 2.50, familleName: 'Jus et Smoothies', barcode: '1234567890154' },
    { name: 'Smoothie Banane', description: 'Smoothie banane et lait', price: 4.00, familleName: 'Jus et Smoothies', barcode: '1234567890155' },
    { name: 'Smoothie Fraise', description: 'Smoothie fraise et yaourt', price: 4.20, familleName: 'Jus et Smoothies', barcode: '1234567890156' },
    { name: 'Smoothie Mangue', description: 'Smoothie mangue et ananas', price: 4.80, familleName: 'Jus et Smoothies', barcode: '1234567890157' },
    { name: 'Jus de Carotte', description: 'Jus de carotte frais', price: 3.20, familleName: 'Jus et Smoothies', barcode: '1234567890158' },
    { name: 'Jus de Betterave', description: 'Jus de betterave et pomme', price: 3.80, familleName: 'Jus et Smoothies', barcode: '1234567890159' },
    { name: 'Smoothie Vert', description: 'Smoothie épinards et kiwi', price: 5.00, familleName: 'Jus et Smoothies', barcode: '1234567890160' },
    { name: 'Jus de Raisin', description: 'Jus de raisin naturel', price: 3.50, familleName: 'Jus et Smoothies', barcode: '1234567890161' },
    { name: 'Smoothie Tropical', description: 'Smoothie fruits tropicaux', price: 5.50, familleName: 'Jus et Smoothies', barcode: '1234567890162' }
  ];

  const products = [];
  for (const prodData of productData) {
    let product = await prisma.product.findFirst({
      where: { barcode: prodData.barcode }
    });
    
    if (!product) {
      // Find the family ID
      const family = families.find(f => f.name === prodData.familleName);
      if (!family) {

        continue;
      }

      product = await prisma.product.create({
        data: {
          name: prodData.name,
          description: prodData.description,
          familleId: family.id,
          prix_vente_TTC: prodData.price,
          prix_achat: prodData.price * 0.6, // Set purchase price to 60% of sale price
          barcode: prodData.barcode,
          unite: 'pcs'
        }
      });
    }
    
    products.push(product);
  }



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



  // Create or update demo users with different passwords
  const adminPassword = await bcrypt.hash('Admin2024!', 12);
  const managerPassword = await bcrypt.hash('Manager2024!', 12);
  const cashierPassword = await bcrypt.hash('Cashier2024!', 12);
  const stockPassword = await bcrypt.hash('Stock2024!', 12);
  
  const users = await Promise.all([
    prisma.user.upsert({
      where: { username: 'admin' },
      update: { passwordHash: adminPassword, pin: '00010001' },
      create: {
        username: 'admin',
        email: 'admin@patisserie.tn',
        passwordHash: adminPassword,
        pin: '00010001',
        firstName: 'Admin',
        lastName: 'Principal',
        role: 'ADMIN',
        depotId: depots[0].id
      }
    }),
    prisma.user.upsert({
      where: { username: 'manager_sfax' },
      update: { 
        username: 'manager',
        email: 'manager@patisserie.tn',
        passwordHash: managerPassword,
        pin: '00020002'
      },
      create: {
        username: 'manager',
        email: 'manager@patisserie.tn',
        passwordHash: managerPassword,
        pin: '00020002',
        firstName: 'Ahmed',
        lastName: 'Ben Ali',
        role: 'MANAGER',
        depotId: depots[0].id
      }
    }),
    prisma.user.upsert({
      where: { username: 'cashier1' },
      update: { 
        username: 'cashier',
        email: 'cashier@patisserie.tn',
        passwordHash: cashierPassword,
        pin: '00030003'
      },
      create: {
        username: 'cashier',
        email: 'cashier@patisserie.tn',
        passwordHash: cashierPassword,
        pin: '00030003',
        firstName: 'Fatma',
        lastName: 'Trabelsi',
        role: 'CASHIER',
        depotId: depots[2].id
      }
    }),
    prisma.user.upsert({
      where: { username: 'stock_manager' },
      update: { 
        username: 'stock',
        email: 'stock@patisserie.tn',
        passwordHash: stockPassword,
        pin: '00040004'
      },
      create: {
        username: 'stock',
        email: 'stock@patisserie.tn',
        passwordHash: stockPassword,
        pin: '00040004',
        firstName: 'Mohamed',
        lastName: 'Hassan',
        role: 'STOCK_MANAGER',
        depotId: depots[0].id
      }
    })
  ]);



  // Create or update clients
  const clientData = [
    { code: 'CLI001', firstName: 'Ali', lastName: 'Ben Salem', email: 'ali.bensalem@email.tn', phone: '+216 74 111 222', address: '15 Rue de la Paix, Sfax', loyaltyPoints: 150 },
    { code: 'CLI002', firstName: 'Amina', lastName: 'Karray', email: 'amina.karray@email.tn', phone: '+216 74 333 444', address: '28 Avenue de l\'Indépendance, Sfax', loyaltyPoints: 75 },
    { code: 'CLI003', firstName: 'Hassan', lastName: 'Trabelsi', email: 'hassan.trabelsi@email.tn', phone: '+216 74 555 666', address: '7 Rue du Commerce, Sfax', loyaltyPoints: 200 }
  ];

  const clients = [];
  for (const clientInfo of clientData) {
    let client = await prisma.client.findFirst({
      where: { email: clientInfo.email }
    });
    
    if (!client) {
      client = await prisma.client.create({
        data: clientInfo
      });
    }
    
    clients.push(client);
  }



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




}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 