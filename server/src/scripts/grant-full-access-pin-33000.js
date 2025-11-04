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
    console.log('Granting FULL access to user with PIN 33000...');

    // 1. Find user with PIN 33000
    let user = await prisma.user.findFirst({
      where: { pin: '33000' }
    });

    if (!user) {
      console.error('User with PIN 33000 not found!');
      process.exit(1);
    }

    console.log(`Found user: ${user.firstName} ${user.lastName} (ID: ${user.id}, Role: ${user.role})`);

    // 2. Ensure user has RESPONSABLE_MAGASIN roleKey in user-roles.json
    const userRoles = readUserRoles();
    const userId = String(user.id);
    
    if (!userRoles[userId]) {
      userRoles[userId] = 'RESPONSABLE_MAGASIN';
      writeUserRoles(userRoles);
      console.log(`✅ Added RESPONSABLE_MAGASIN roleKey for user ID ${userId}`);
    } else {
      // Update to ensure it's RESPONSABLE_MAGASIN
      if (userRoles[userId] !== 'RESPONSABLE_MAGASIN') {
        userRoles[userId] = 'RESPONSABLE_MAGASIN';
        writeUserRoles(userRoles);
        console.log(`✅ Updated roleKey to RESPONSABLE_MAGASIN for user ID ${userId}`);
      } else {
        console.log(`✓ User ID ${userId} already has RESPONSABLE_MAGASIN roleKey`);
      }
    }

    // 3. Update app-settings.json to grant FULL access to RESPONSABLE_MAGASIN
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

    // Grant FULL access to ALL modules
    settings.roleAccessConfig.RESPONSABLE_MAGASIN.blocks.caisse = {
      visible: true
    };

    // Grant FULL access to Historique module with ALL submodules
    settings.roleAccessConfig.RESPONSABLE_MAGASIN.blocks.historique = {
      visible: true,
      submodules: {
        VENTES: true,
        POINTAGE: true
      }
    };
    
    console.log('✅ Configured Historique module with VENTES and POINTAGE submodules');

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

    // Also grant access to any other modules that might exist
    settings.roleAccessConfig.RESPONSABLE_MAGASIN.blocks.home = {
      visible: true
    };

    writeSettings(settings);
    console.log('✅ Updated roleAccessConfig for RESPONSABLE_MAGASIN with FULL access to all modules');

    console.log('\n✅ Successfully granted FULL access!');
    console.log(`- User: ${user.firstName} ${user.lastName} (PIN: 33000, ID: ${user.id})`);
    console.log(`- RoleKey: RESPONSABLE_MAGASIN`);
    console.log(`- Access granted to: Caisse, Historique (VENTES, POINTAGE), Clôture, Stock, Paramètres, Rapports`);

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

