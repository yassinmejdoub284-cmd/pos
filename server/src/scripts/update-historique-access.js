require('dotenv').config();
const fs = require('fs');
const path = require('path');

const SETTINGS_FILE = path.join(__dirname, '../../uploads/app-settings.json');

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
    console.log('Updating Historique module access for RESPONSABLE_MAGASIN...');

    const settings = readSettings();
    
    // Update root roleAccessConfig (most important - used by default)
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

    // Ensure Historique has FULL access with ALL submodules
    settings.roleAccessConfig.RESPONSABLE_MAGASIN.blocks.historique = {
      visible: true,
      submodules: {
        VENTES: true,
        POINTAGE: true
      }
    };

    // Also update in default section if it exists
    if (settings.default && settings.default.roleAccessConfig) {
      if (!settings.default.roleAccessConfig.RESPONSABLE_MAGASIN) {
        settings.default.roleAccessConfig.RESPONSABLE_MAGASIN = {
          blocks: {}
        };
      }

      if (!settings.default.roleAccessConfig.RESPONSABLE_MAGASIN.blocks) {
        settings.default.roleAccessConfig.RESPONSABLE_MAGASIN.blocks = {};
      }

      // Update historique in default section too
      settings.default.roleAccessConfig.RESPONSABLE_MAGASIN.blocks.historique = {
        visible: true,
        submodules: {
          VENTES: true,
          POINTAGE: true
        }
      };
      
      console.log('✅ Updated Historique access in default section');
    }

    writeSettings(settings);
    console.log('✅ Updated roleAccessConfig for RESPONSABLE_MAGASIN with FULL Historique access');
    console.log('   - Module: Historique (visible: true)');
    console.log('   - Submodules: VENTES (true), POINTAGE (true)');

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();

