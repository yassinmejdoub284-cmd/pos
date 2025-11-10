require('dotenv').config();
const bcrypt = require('bcryptjs');
const { prisma } = require('../lib/prisma');
const fs = require('fs');
const path = require('path');

const USER_ROLES_FILE = path.join(__dirname, '../../uploads/user-roles.json');
const SETTINGS_FILE = path.join(__dirname, '../../uploads/app-settings.json');

function readUserRoles() {
  try {
    if (fs.existsSync(USER_ROLES_FILE)) {
      return JSON.parse(fs.readFileSync(USER_ROLES_FILE, 'utf-8') || '{}');
    }
  } catch {}
  return {};
}

function writeUserRoles(obj) {
  const dir = path.dirname(USER_ROLES_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(USER_ROLES_FILE, JSON.stringify(obj || {}, null, 2), 'utf-8');
}

function readSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8') || '{}');
    }
  } catch {}
  return {};
}

function writeSettings(obj) {
  const dir = path.dirname(SETTINGS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(obj || {}, null, 2), 'utf-8');
}

async function main() {
  try {
    console.log('Granting Caisse access to users...');

    // 1. Find or create user with PIN 33000 (WAEL SFAX)
    let waelUser = await prisma.user.findFirst({
      where: { pin: '33000' }
    });

    if (!waelUser) {
      // Create user if doesn't exist
      console.log('Creating user WAEL SFAX with PIN 33000...');
      const hashedPassword = await bcrypt.hash('33000', 12);
      waelUser = await prisma.user.create({
        data: {
          username: 'wael.sfax',
          email: 'wael.sfax@company.com',
          passwordHash: hashedPassword,
          firstName: 'Wael',
          lastName: 'Sfax',
          role: 'CASHIER',
          pin: '33000',
          isActive: true
        }
      });
      console.log(`Created user with ID: ${waelUser.id}`);
    } else {
      // Update existing user to ensure CASHIER role
      console.log(`Found existing user with PIN 33000 (ID: ${waelUser.id}, Name: ${waelUser.firstName} ${waelUser.lastName})`);
      if (waelUser.role !== 'CASHIER') {
        waelUser = await prisma.user.update({
          where: { id: waelUser.id },
          data: { role: 'CASHIER' }
        });
        console.log(`Updated user role to CASHIER`);
      } else {
        console.log(`User already has CASHIER role`);
      }
    }

    // 2. Ensure RESPONSABLE_MAGASIN (user ID 9) has access to Caisse
    const userRoles = readUserRoles();
    const responsableUserId = '9';
    
    if (!userRoles[responsableUserId]) {
      userRoles[responsableUserId] = 'RESPONSABLE_MAGASIN';
      writeUserRoles(userRoles);
      console.log(`Added RESPONSABLE_MAGASIN roleKey for user ID ${responsableUserId}`);
    }

    // 4. Update roleAccessConfig to grant FULL access to RESPONSABLE_MAGASIN
    const settings = readSettings();
    if (!settings.roleAccessConfig) {
      settings.roleAccessConfig = {};
    }
    
    if (!settings.roleAccessConfig.RESPONSABLE_MAGASIN) {
      settings.roleAccessConfig.RESPONSABLE_MAGASIN = {
        blocks: {}
      };
    }

    if (!settings.roleAccessConfig.RESPONSABLE_MAGASIN.blocks) {
      settings.roleAccessConfig.RESPONSABLE_MAGASIN.blocks = {};
    }

    // Grant FULL access to all requested modules
    settings.roleAccessConfig.RESPONSABLE_MAGASIN.blocks.caisse = {
      visible: true
    };

    settings.roleAccessConfig.RESPONSABLE_MAGASIN.blocks.historique = {
      visible: true,
      submodules: {
        VENTES: true,
        POINTAGE: true
      }
    };

    settings.roleAccessConfig.RESPONSABLE_MAGASIN.blocks.cloture = {
      visible: true
    };

    settings.roleAccessConfig.RESPONSABLE_MAGASIN.blocks.stock = {
      visible: true
    };

    settings.roleAccessConfig.RESPONSABLE_MAGASIN.blocks.parametres = {
      visible: true
    };

    settings.roleAccessConfig.RESPONSABLE_MAGASIN.blocks.rapports = {
      visible: true
    };

    writeSettings(settings);
    console.log('Updated roleAccessConfig for RESPONSABLE_MAGASIN with full access');

    // Also ensure CASHIER role has access to Caisse (if not already configured)
    if (!settings.roleAccessConfig.CASHIER) {
      settings.roleAccessConfig.CASHIER = {
        blocks: {
          caisse: { visible: true },
          historique: { visible: true },
          cloture: { visible: true }
        }
      };
      writeSettings(settings);
      console.log('Updated roleAccessConfig for CASHIER role');
    }

    console.log('✅ Successfully granted Caisse access!');
    console.log(`- User WAEL SFAX (PIN: 33000) has CASHIER role`);
    console.log(`- RESPONSABLE_MAGASIN (user ID 9) has full access including Caisse`);

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

