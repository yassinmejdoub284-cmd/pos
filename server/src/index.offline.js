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

const dbTarget = String(process.env.DATABASE_URL || '').replace(/^file:/, '');
const dataDir  = dbTarget ? path.dirname(dbTarget) : exeDir;
const template = path.join(exeDir, 'pos_patisserie.template.db');

// ── Journal fichier ────────────────────────────────────────────────────────
// Le serveur est lance sans fenetre par Tauri : sans ce journal, aucune trace
// d'erreur n'est recuperable sur le poste du client.
try {
  const logDir = path.join(dataDir, 'logs');
  fs.mkdirSync(logDir, { recursive: true });
  const d = new Date();
  const day = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const logFile = path.join(logDir, `server-${day}.log`);
  const stream = fs.createWriteStream(logFile, { flags: 'a' });
  const write = (level, args) => {
    const line = args.map(a => {
      if (a instanceof Error) return a.stack || a.message;
      if (typeof a === 'object') { try { return JSON.stringify(a); } catch { return String(a); } }
      return String(a);
    }).join(' ');
    stream.write(`${new Date().toISOString()} [${level}] ${line}\n`);
  };
  for (const level of ['log', 'warn', 'error']) {
    const original = console[level].bind(console);
    console[level] = (...args) => { try { write(level.toUpperCase(), args); } catch {} original(...args); };
  }
  process.on('uncaughtException',  (e) => console.error('uncaughtException', e));
  process.on('unhandledRejection', (e) => console.error('unhandledRejection', e));
  console.log('[offline] Journal :', logFile);
} catch (e) {
  console.error('[offline] Journal indisponible :', e.message);
}

/**
 * Sous Windows, fs.copyFileSync recopie aussi l'attribut "lecture seule" du
 * fichier source. Le modele livre dans resources/ est souvent marque ainsi :
 * la base copiee devient alors non inscriptible et TOUTE ecriture echoue avec
 * SQLITE_READONLY, alors que la lecture continue de fonctionner (connexion et
 * listes OK, mais impossible de creer quoi que ce soit).
 */
function makeWritable(file) {
  try { fs.chmodSync(file, 0o666); } catch (e) {
    console.error('[offline] Impossible de rendre la base inscriptible :', e.message);
  }
}

/** Copie recursive d'un dossier (sauvegarde des uploads). */
function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to   = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(from, to);
    else fs.copyFileSync(from, to);
  }
}

/**
 * Archive la base et les parametres dans backup/backup-<horodatage>/.
 * Renvoie le chemin de la sauvegarde, ou null si rien n'a pu etre archive.
 * Aucune suppression n'est faite ailleurs tant que cette fonction n'a pas
 * renvoye un chemin valide.
 */
function createBackup(reason) {
  try {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`
                + `-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const dir = path.join(dataDir, 'backup', `backup-${stamp}`);
    fs.mkdirSync(dir, { recursive: true });

    let archived = 0;
    if (fs.existsSync(dbTarget)) {
      fs.copyFileSync(dbTarget, path.join(dir, 'pos_patisserie.db'));
      archived++;
    }
    // Parametres, logos et fichiers televerses.
    const uploads = path.join(exeDir, 'uploads');
    if (fs.existsSync(uploads)) { copyDir(uploads, path.join(dir, 'uploads')); archived++; }

    if (archived === 0) { fs.rmSync(dir, { recursive: true, force: true }); return null; }

    fs.writeFileSync(path.join(dir, 'INFOS.txt'),
      `Sauvegarde automatique\nDate   : ${now.toISOString()}\nRaison : ${reason}\n\n` +
      `Contenu :\n  pos_patisserie.db  - base de donnees (ventes, produits, clients...)\n` +
      `  uploads/           - parametres, logos, images\n\n` +
      `Pour restaurer : arreter l'application, puis recopier ces fichiers\n` +
      `a la place de ceux du dossier d'installation.\n`, 'utf-8');

    console.log('[offline] Sauvegarde creee :', dir);
    return dir;
  } catch (e) {
    console.error('[offline] ECHEC de la sauvegarde :', e.message);
    return null;
  }
}

// ── Remise a zero apres installation d'une nouvelle version ────────────────
// build-id.txt est genere a chaque build et livre dans resources/.
// installed-build.txt est ecrit a cote de la base apres chaque remise a zero.
// Quand les deux different, c'est qu'une nouvelle version vient d'etre
// installee : on archive tout, puis on repart d'une base vierge.
try {
  const shippedFile   = path.join(exeDir, 'build-id.txt');
  const installedFile = path.join(dataDir, 'installed-build.txt');
  const shipped   = fs.existsSync(shippedFile)   ? fs.readFileSync(shippedFile, 'utf-8').trim()   : '';
  const installed = fs.existsSync(installedFile) ? fs.readFileSync(installedFile, 'utf-8').trim() : '';
  const dbExists  = dbTarget && fs.existsSync(dbTarget);

  if (shipped && shipped !== installed && dbExists) {
    console.log('[offline] Nouvelle version detectee :', installed || '(aucune)', '->', shipped);
    const backup = createBackup(`Installation de la version ${shipped}`);

    if (!backup) {
      // Regle de securite : sans sauvegarde, on ne supprime RIEN.
      console.error('[offline] Sauvegarde impossible : les donnees existantes sont conservees.');
    } else {
      if (fs.existsSync(template)) {
        fs.copyFileSync(template, dbTarget);
        makeWritable(dbTarget);
        console.log('[offline] Base reinitialisee depuis le modele.');
      } else {
        console.error('[offline] Modele de base introuvable : la base actuelle est conservee.');
      }
      fs.writeFileSync(installedFile, shipped, 'utf-8');
    }
  } else if (shipped && !installed) {
    // Premiere installation : rien a archiver, on note simplement la version.
    fs.writeFileSync(installedFile, shipped, 'utf-8');
  }
} catch (e) {
  console.error('[offline] Verification de version ignoree :', e.message);
}

// ── Premier demarrage : creer la base depuis le modele ─────────────────────
if (dbTarget && !fs.existsSync(dbTarget)) {
  if (fs.existsSync(template)) {
    fs.copyFileSync(template, dbTarget);
    makeWritable(dbTarget);
    console.log('[offline] Base creee depuis le modele :', dbTarget);
  } else {
    console.error('[offline] Modele de base introuvable :', template);
  }
}

// ── Controle d'ecriture ────────────────────────────────────────────────────
// SQLite a besoin d'ecrire la base ET son journal dans le meme dossier.
if (dbTarget && fs.existsSync(dbTarget)) {
  makeWritable(dbTarget);
  try {
    fs.accessSync(dbTarget, fs.constants.W_OK);
    const probe = path.join(dataDir, '.write-probe');
    fs.writeFileSync(probe, 'ok');
    fs.unlinkSync(probe);
  } catch (e) {
    console.error('[offline] BASE NON INSCRIPTIBLE :', dbTarget, '-', e.message);
    console.error('[offline] Toute creation (produit, vente, famille) echouera.');
  }
}

require('./index');
