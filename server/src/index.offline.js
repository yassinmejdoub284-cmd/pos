/**
 * Offline / Desktop entry point.
 * Loaded by pkg when building the bundled .exe sidecar.
 *
 * Differences from index.js:
 *  - Loads .env.offline (DATABASE_URL points to SQLite file)
 *  - Resolves the SQLite DB path relative to the exe directory so it
 *    survives being copied anywhere on the target machine.
 *  - Disables TLS (plain HTTP on 127.0.0.1 only — the Tauri shell handles
 *    the user-facing window, no outside access needed).
 */

const path = require('path');
const fs   = require('fs');

// ── Resolve the directory where the .exe lives (works inside pkg too) ──────
const exeDir = (() => {
  if (process.pkg) {
    // Running inside a pkg bundle — __dirname is the snapshot root
    return path.dirname(process.execPath);
  }
  return path.resolve(__dirname, '..');
})();

// ── Load the offline .env before anything else ──────────────────────────────
const envPath = path.join(exeDir, '.env.offline');
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
} else {
  // Fallback: inline defaults so the server still starts
  process.env.DATABASE_URL = `file:${path.join(exeDir, 'pos_patisserie.db')}`;
  process.env.JWT_SECRET    = process.env.JWT_SECRET || 'pos-patisserie-offline-secret';
  process.env.PORT          = process.env.PORT        || '3255';
  process.env.NODE_ENV      = 'production';
}

// Fix the SQLite path so it is always next to the .exe, not in a temp dir
if (process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('file:./')) {
  const dbFile = process.env.DATABASE_URL.replace('file:./', '');
  process.env.DATABASE_URL = `file:${path.join(exeDir, dbFile)}`;
}

// ── Now bootstrap the rest of the server (same as index.js) ─────────────────
// First run: the SQLite file does not exist yet. Copy the template database
// (schema + seed, admin PIN 1100) that ships beside the exe, otherwise every
// query fails with 'The table main.users does not exist'.
const dbTarget = String(process.env.DATABASE_URL || '').replace(/^file:/, '');
if (dbTarget && !fs.existsSync(dbTarget)) {
  const template = path.join(exeDir, 'pos_patisserie.template.db');
  if (fs.existsSync(template)) {
    fs.copyFileSync(template, dbTarget);
    console.log('[offline] Created database from template:', dbTarget);
  } else {
    console.error('[offline] Template database not found at', template);
  }
}

require('./index');
