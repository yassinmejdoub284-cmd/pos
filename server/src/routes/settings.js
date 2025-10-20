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

function ensureDefaults(data = {}) {
  return {
    companyName: data.companyName || '',
    logoUrl: data.logoUrl || '',
    // Company details
    companyAddress: data.companyAddress || '',
    companyPhone: data.companyPhone || '',
    companyEmail: data.companyEmail || '',
    companyRC: data.companyRC || '',
    companyMF: data.companyMF || '',
    loyaltyEnabled: typeof data.loyaltyEnabled === 'boolean' ? data.loyaltyEnabled : false,
    loyaltyRate: data.loyaltyRate !== undefined ? Number(data.loyaltyRate) : 1,
    maxDiscountPercent: data.maxDiscountPercent !== undefined ? Number(data.maxDiscountPercent) : 50,
    defaultClientMaxDebt: data.defaultClientMaxDebt !== undefined ? Number(data.defaultClientMaxDebt) : 0,
    keyboardShortcuts: typeof data.keyboardShortcuts === 'object' ? data.keyboardShortcuts : (data.keyboardShortcuts || {}),
    devicesConfig: typeof data.devicesConfig === 'object' ? data.devicesConfig : (data.devicesConfig || {}),
    isDesktopVersion: typeof data.isDesktopVersion === 'boolean' ? data.isDesktopVersion : true,
    auditRetentionDays: data.auditRetentionDays !== undefined ? Number(data.auditRetentionDays) : 90,
  // Historique (display-only retention window)
  historyRetentionDays: data.historyRetentionDays !== undefined ? Number(data.historyRetentionDays) : 30,
  // Role-based history limits
  roleHistoryLimits: data.roleHistoryLimits || {
    ADMIN: 9999,
    MANAGER: 30,
    CASHIER: 5,
    STOCK_MANAGER: 15
  },
    // Clôture settings
    varianceThreshold: data.varianceThreshold !== undefined ? Number(data.varianceThreshold) : 5.0,
    defaultFonds: data.defaultFonds !== undefined ? Number(data.defaultFonds) : 50.0,
    denominations: Array.isArray(data.denominations) ? data.denominations : [50, 20, 10, 5, 2, 1, 0.5, 0.2, 0.1, 0.05],
    requireApprovalForVariance: typeof data.requireApprovalForVariance === 'boolean' ? data.requireApprovalForVariance : true,
    ticketWidth: data.ticketWidth !== undefined ? Number(data.ticketWidth) : 58,
    droitDeTimbre: typeof data.droitDeTimbre === 'boolean' ? data.droitDeTimbre : false,
    // Expenses
    autoApproveExpenseBelow: data.autoApproveExpenseBelow !== undefined ? Number(data.autoApproveExpenseBelow) : 0,
    // Stock
    allowNegativeStock: typeof data.allowNegativeStock === 'boolean' ? data.allowNegativeStock : false,
    // Print settings
    printSettings: {
      showLogo: typeof data.printSettings?.showLogo === 'boolean' ? data.printSettings.showLogo : true,
      logoSize: data.printSettings?.logoSize || 'medium',
      dateFormat: data.printSettings?.dateFormat || 'dd/mm/yyyy',
      timeFormat: data.printSettings?.timeFormat || '24h',
      currencySymbol: data.printSettings?.currencySymbol || 'dt',
      currencyPosition: data.printSettings?.currencyPosition || 'after',
      customTexts: {
        thankYouMessage: data.printSettings?.customTexts?.thankYouMessage || 'Merci de votre visite!',
        receiptTitle: data.printSettings?.customTexts?.receiptTitle || 'REÇU DE VENTE',
        companySlogan: data.printSettings?.customTexts?.companySlogan || 'Votre pâtisserie de confiance',
        footerMessage: data.printSettings?.customTexts?.footerMessage || 'Merci pour votre fidélité'
      },
      showCompanyDetails: typeof data.printSettings?.showCompanyDetails === 'boolean' ? data.printSettings.showCompanyDetails : true,
      showClientInfo: typeof data.printSettings?.showClientInfo === 'boolean' ? data.printSettings.showClientInfo : true,
      showPaymentMethod: typeof data.printSettings?.showPaymentMethod === 'boolean' ? data.printSettings.showPaymentMethod : true,
      showDiscountDetails: typeof data.printSettings?.showDiscountDetails === 'boolean' ? data.printSettings.showDiscountDetails : true
    },
    // Document type defaults
    documentTypeDefaults: data.documentTypeDefaults || {
      livraison: {
        client: true,
        depot: false,
        vehicle: true,
        driver: true,
        manualDestination: false,
        autoInvoice: false,
        tvaAndPrix: true,
        validity: false
      },
      sortie: {
        client: false,
        depot: true,
        vehicle: false,
        driver: false,
        manualDestination: false,
        autoInvoice: false,
        tvaAndPrix: true,
        validity: false
      },
      transfert: {
        client: false,
        depot: true,
        vehicle: true,
        driver: true,
        manualDestination: false,
        autoInvoice: false,
        tvaAndPrix: true,
        validity: false
      },
      facture: {
        client: true,
        depot: false,
        vehicle: false,
        driver: false,
        manualDestination: false,
        autoInvoice: true,
        tvaAndPrix: true,
        validity: false
      }
    },
    // Document display settings
    documentDisplaySettings: data.documentDisplaySettings || {
      livraison: {
        showPackageCount: true
      },
      sortie: {
        showPackageCount: true
      },
      transfert: {
        showPackageCount: true
      },
      facture: {
        showPackageCount: true,
        timbrePrice: 1
      }
    },
    // Role-based home access configuration (per role, per block)
    roleAccessConfig: typeof data.roleAccessConfig === 'object' ? data.roleAccessConfig : {}
  };
}

// Read the raw JSON file (can be legacy flat object or new map keyed by depotId)
function readAllFileSettingsRaw() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const raw = fs.readFileSync(SETTINGS_FILE, 'utf-8');
      return JSON.parse(raw || '{}');
    }
  } catch {}
  return {};
}

// Persist the full raw structure (object)
function writeAllFileSettingsRaw(rawObject) {
  const dir = path.dirname(SETTINGS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(rawObject || {}, null, 2), 'utf-8');
}

// Read settings for a specific depotId, supporting legacy format
function readDepotSettings(depotId) {
  const all = readAllFileSettingsRaw();
  // Legacy flat object detection: presence of known fields like companyName
  if (all && typeof all === 'object' && !Array.isArray(all) && (all.companyName !== undefined || all.printSettings !== undefined)) {
    // Return legacy settings as defaults for all depots
    return ensureDefaults(all);
  }
  const key = String(depotId);
  const depotData = (all && typeof all === 'object') ? all[key] : undefined;
  return ensureDefaults(depotData || {});
}

// Write settings for a specific depotId, migrating legacy format to map
function writeDepotSettings(depotId, data) {
  let all = readAllFileSettingsRaw();
  if (!all || typeof all !== 'object' || Array.isArray(all)) {
    all = {};
  }
  // If legacy flat object, migrate it under an unknown key 'default' without overriding specific depots
  if (all.companyName !== undefined || all.printSettings !== undefined) {
    all = { default: ensureDefaults(all) };
  }
  all[String(depotId)] = ensureDefaults(data);
  writeAllFileSettingsRaw(all);
}

router.get('/', async (req, res) => {
  try {
    const userDepotId = req.user?.depotId;
    // Do not enforce depot scoping for roles/settings; fall back to 'default' bucket when absent
    const effectiveDepotKey = (!userDepotId || isNaN(parseInt(String(userDepotId), 10))) ? 'default' : userDepotId;
    // Scope file-based settings by depot when present, otherwise use 'default'
    const fileSettings = readDepotSettings(effectiveDepotKey);
    // Also read global defaults to merge global roleAccessConfig
    const globalDefaults = readDepotSettings('default');
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

    // If Prisma appSettings exists (global), merge non-depot fields as generic defaults if needed
    if (prisma.appSettings && typeof prisma.appSettings.findFirst === 'function') {
      const dbSettings = await prisma.appSettings.findFirst();
      const merged = ensureDefaults({
        ...(dbSettings || {}),
        ...fileSettings
      });
      return res.json(merged);
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
    console.log('[settings.update] incoming body=', body);

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
    console.log('[settings.update] normalized data=', data);

    // Skip DB writes to avoid schema mismatches; persist via file only
    const savedDb = null;

    // If updating roleAccessConfig, persist it globally under 'default' so roles are not depot-scoped
    if (data.roleAccessConfig && typeof data.roleAccessConfig === 'object') {
      const currentGlobal = readDepotSettings('default');
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
    const userDepotId = req.user?.depotId;
    const currentSettings = readDepotSettings(userDepotId);
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