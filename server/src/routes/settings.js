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
    auditRetentionDays: data.auditRetentionDays !== undefined ? Number(data.auditRetentionDays) : 90
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
      return res.json(ensureDefaults(settings || {}));
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

    if (prisma.appSettings && typeof prisma.appSettings.upsert === 'function') {
      const updated = await prisma.appSettings.upsert({
        where: { id: 1 },
        update: data,
        create: { id: 1, ...data }
      });
      return res.json(ensureDefaults(updated));
    }

    writeFileSettings(data);
    return res.json(data);
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router; 