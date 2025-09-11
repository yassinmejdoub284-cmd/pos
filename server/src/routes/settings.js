const express = require('express');
const fs = require('fs');
const path = require('path');
const { prisma } = require('../lib/prisma');

const router = express.Router();

const SETTINGS_FILE = path.join(__dirname, '../../uploads/app-settings.json');

function ensureDefaults(data = {}) {
  return {
    companyName: data.companyName || '',
    logoUrl: data.logoUrl || '',
    loyaltyEnabled: typeof data.loyaltyEnabled === 'boolean' ? data.loyaltyEnabled : false,
    loyaltyRate: data.loyaltyRate !== undefined ? Number(data.loyaltyRate) : 1,
    maxDiscountPercent: data.maxDiscountPercent !== undefined ? Number(data.maxDiscountPercent) : 50,
    defaultClientMaxDebt: data.defaultClientMaxDebt !== undefined ? Number(data.defaultClientMaxDebt) : 0,
    keyboardShortcuts: typeof data.keyboardShortcuts === 'object' ? data.keyboardShortcuts : (data.keyboardShortcuts || {}),
    devicesConfig: typeof data.devicesConfig === 'object' ? data.devicesConfig : (data.devicesConfig || {}),
    auditRetentionDays: data.auditRetentionDays !== undefined ? Number(data.auditRetentionDays) : 90,
    // Clôture settings
    varianceThreshold: data.varianceThreshold !== undefined ? Number(data.varianceThreshold) : 5.0,
    defaultFonds: data.defaultFonds !== undefined ? Number(data.defaultFonds) : 50.0,
    denominations: Array.isArray(data.denominations) ? data.denominations : [50, 20, 10, 5, 2, 1, 0.5, 0.2, 0.1, 0.05],
    requireApprovalForVariance: typeof data.requireApprovalForVariance === 'boolean' ? data.requireApprovalForVariance : true,
    ticketWidth: data.ticketWidth !== undefined ? Number(data.ticketWidth) : 58,
    droitDeTimbre: typeof data.droitDeTimbre === 'boolean' ? data.droitDeTimbre : false,
    // Expenses
    autoApproveExpenseBelow: data.autoApproveExpenseBelow !== undefined ? Number(data.autoApproveExpenseBelow) : 0
  };
}

function readFileSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const raw = fs.readFileSync(SETTINGS_FILE, 'utf-8');
      const parsed = JSON.parse(raw || '{}');
      return ensureDefaults(parsed);
    }
  } catch {}
  return ensureDefaults({});
}

function writeFileSettings(data) {
  const dir = path.dirname(SETTINGS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(ensureDefaults(data), null, 2), 'utf-8');
}

router.get('/', async (req, res) => {
  try {
    if (prisma.appSettings && typeof prisma.appSettings.findFirst === 'function') {
      const settings = await prisma.appSettings.findFirst();
      // Merge DB with file to include fields not in Prisma schema (like autoApproveExpenseBelow)
      const fileSettings = readFileSettings();
      const merged = ensureDefaults({
        ...(settings || {}),
        autoApproveExpenseBelow: fileSettings.autoApproveExpenseBelow
      });
      return res.json(merged);
    }
    const settings = readFileSettings();
    return res.json(settings);
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/', async (req, res) => {
  try {
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

    if (prisma.appSettings) {
      // Use findFirst + update/create to avoid specifying auto-increment id on create
      const existing = await prisma.appSettings.findFirst();
      let saved;
      // Strip non-Prisma fields for DB write but keep full data for file
      const { autoApproveExpenseBelow, ...dbData } = data;
      if (existing) {
        saved = await prisma.appSettings.update({ where: { id: existing.id }, data: dbData });
      } else {
        saved = await prisma.appSettings.create({ data: dbData });
      }
      // Persist full settings (including threshold) to file
      try { writeFileSettings({ ...saved, autoApproveExpenseBelow }); } catch {}
      return res.json(ensureDefaults({ ...saved, autoApproveExpenseBelow }));
    }

    writeFileSettings(data);
    return res.json(data);
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router; 