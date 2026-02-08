const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { prisma } = require('../lib/prisma');
const ROLES_FILE = path.join(__dirname, '../../uploads/user-defined-roles.json');

function readDefinedRoles() {
  try {
    if (fs.existsSync(ROLES_FILE)) return JSON.parse(fs.readFileSync(ROLES_FILE, 'utf-8') || '[]');
  } catch {}
  return [];
}

function writeDefinedRoles(arr) {
  const dir = path.dirname(ROLES_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(ROLES_FILE, JSON.stringify(arr || [], null, 2), 'utf-8');
}

const router = express.Router();

const SETTINGS_FILE = path.join(__dirname, '../../uploads/app-settings.json');
const LOGOS_DIR = path.join(__dirname, '../../uploads/logos');

// Ensure logos directory exists
if (!fs.existsSync(LOGOS_DIR)) {
  fs.mkdirSync(LOGOS_DIR, { recursive: true });
}

// Configure multer for logo uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, LOGOS_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `logo-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

const { 
  getDepotSettings, 
  ensureDefaults, 
  readRawSettings, 
  writeDepotSettings, 
  writeAllFileSettingsRaw 
} = require('../lib/settings');

router.get('/', async (req, res) => {
  try {
    const userDepotId = req.user?.depotId;
    // Do not enforce depot scoping for roles/settings; fall back to 'default' bucket when absent
    const effectiveDepotKey = (!userDepotId || isNaN(parseInt(String(userDepotId), 10))) ? 'default' : userDepotId;
    // Scope file-based settings by depot when present, otherwise use 'default'
    const fileSettings = getDepotSettings(effectiveDepotKey);
    // Also read global defaults to merge global roleAccessConfig
    const globalDefaults = getDepotSettings('default');
    if (globalDefaults && globalDefaults.roleAccessConfig) {
      const globalCfg = globalDefaults.roleAccessConfig || {};
      const depotCfg = fileSettings.roleAccessConfig || {};
      const roleIds = new Set([...Object.keys(globalCfg), ...Object.keys(depotCfg)]);
      const deepMerged = {};
      for (const roleId of roleIds) {
        const g = globalCfg[roleId] || {};
        const d = depotCfg[roleId] || {};
        const gBlocks = g.blocks || {};
        const dBlocks = d.blocks || {};
        const blockIds = new Set([...Object.keys(gBlocks), ...Object.keys(dBlocks)]);
        const mergedBlocks = {};
        for (const bId of blockIds) {
          const gb = gBlocks[bId] || {};
          const db = dBlocks[bId] || {};
          // visible from depot overrides, else global
          const visible = (typeof db.visible === 'boolean') ? db.visible : (typeof gb.visible === 'boolean' ? gb.visible : false);
          // submodules: union with depot preference
          const gSubs = gb.submodules || {};
          const dSubs = db.submodules || {};
          const subIds = new Set([...Object.keys(gSubs), ...Object.keys(dSubs)]);
          const mergedSubs = {};
          for (const sid of subIds) {
            mergedSubs[sid] = (typeof dSubs[sid] === 'boolean') ? dSubs[sid] : (typeof gSubs[sid] === 'boolean' ? gSubs[sid] : false);
          }
          mergedBlocks[bId] = Object.keys(mergedSubs).length > 0 ? { visible, submodules: mergedSubs } : { visible };
        }
        deepMerged[roleId] = {
          blocks: mergedBlocks,
          meta: { ...(g.meta || {}), ...(d.meta || {}) }
        };
      }
      fileSettings.roleAccessConfig = deepMerged;
    }

    // Inject Company Details if available
    let companyId = req.user?.companyId;
    
    // If no direct company, try to resolve from depot
    // Check for X-Depot-Id header first (admin visiting context)
    const headerDepotIdStr = req.headers['x-depot-id'];
    const currentUserDepotId = req.user?.depotId;
    const effectiveDepotIdForCompany = headerDepotIdStr ? parseInt(headerDepotIdStr) : currentUserDepotId;

    if (!companyId && effectiveDepotIdForCompany) {
      const depot = await prisma.depot.findUnique({
        where: { id: parseInt(effectiveDepotIdForCompany) },
        select: { companyId: true }
      });
      if (depot && depot.companyId) companyId = depot.companyId;
    }

    if (companyId) {
      const company = await prisma.company.findUnique({
        where: { id: companyId }
      });
      
      if (company) {
        // Overlay company details onto settings
        fileSettings.companyName = company.raisonSociale;
        if (company.logoUrl) fileSettings.logoUrl = company.logoUrl;
        
        // Map other company fields to settings expected format
        fileSettings.companyAddress = [
          company.adresse, 
          company.codePostal, 
          company.ville
        ].filter(Boolean).join(', ');
        
        fileSettings.companyPhone = company.telephone;
        fileSettings.companyEmail = company.email;
        fileSettings.companyRC = company.registreCommerce;
        fileSettings.companyMF = company.matriculeFiscal;
      }
    }

    return res.json(fileSettings);
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/', async (req, res) => {
  try {
    const userDepotId = req.user?.depotId;
    // Do not enforce depot scoping for updates; write to 'default' if no depot
    const effectiveDepotKey = (!userDepotId || isNaN(parseInt(String(userDepotId), 10))) ? 'default' : userDepotId;
    const body = req.body || {};


    // Try to parse JSON-like strings
    let keyboardShortcuts = body.keyboardShortcuts;
    let devicesConfig = body.devicesConfig;
    try { if (typeof keyboardShortcuts === 'string') keyboardShortcuts = JSON.parse(keyboardShortcuts); } catch {}
    try { if (typeof devicesConfig === 'string') devicesConfig = JSON.parse(devicesConfig); } catch {}

    const data = ensureDefaults({
      ...body,
      keyboardShortcuts,
      devicesConfig
    });


    // Skip DB writes to avoid schema mismatches; persist via file only
    const savedDb = null;

    // If updating roleAccessConfig, persist it globally under 'default' so roles are not depot-scoped
    if (data.roleAccessConfig && typeof data.roleAccessConfig === 'object') {
      const currentGlobal = getDepotSettings('default');
      const mergedGlobal = ensureDefaults({ ...currentGlobal });
      mergedGlobal.roleAccessConfig = data.roleAccessConfig; // replace with requested config
      writeDepotSettings('default', mergedGlobal);
    }

    // Persist other settings to file (depot-scoped when present, otherwise global 'default')
    // Remove roleAccessConfig from depot-scoped write to avoid duplicating it under depot keys
    const { roleAccessConfig: _omitRoleCfg, ...depotScoped } = data;
    writeDepotSettings(effectiveDepotKey, depotScoped);

    return res.json(ensureDefaults({ ...(savedDb || {}), ...data }));
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Logo upload endpoint
router.post('/logo', upload.single('logo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const logoUrl = `/uploads/logos/${req.file.filename}`;
    
    // Update depot settings with new logo URL
    const userDepotId = req.user?.depotId || 'default';
    const currentSettings = getDepotSettings(userDepotId);
    const updatedSettings = { ...currentSettings, logoUrl };
    
    // Skip DB writes to avoid schema mismatches; persist via file only
    
    writeDepotSettings(userDepotId, updatedSettings);
    
    res.json({ logoUrl });
  } catch (error) {
    console.error('Error uploading logo:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router; 