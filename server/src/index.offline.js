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
  process.env.DATABASE_URL = `file:${path.join(exeDir, 'samurai_food.db')}`;
  process.env.JWT_SECRET    = process.env.JWT_SECRET || 'samurai-food-offline-secret';
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
const template = path.join(exeDir, 'samurai_food.template.db');

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

/**
 * Remet les parametres applicatifs a zero apres l'installation d'une nouvelle
 * version. Le fichier est simplement supprime : le serveur le regenere avec
 * les valeurs par defaut au premier acces. Les logos televerses sont vides
 * aussi, sinon l'ancienne enseigne reste affichee.
 */
function resetSettingsFile() {
  const uploads = path.join(exeDir, 'uploads');
  const settingsFile = path.join(uploads, 'app-settings.json');
  try {
    if (fs.existsSync(settingsFile)) {
      fs.rmSync(settingsFile, { force: true });
      console.log('[offline] Parametres remis a zero :', settingsFile);
    }
    const logos = path.join(uploads, 'logos');
    if (fs.existsSync(logos)) {
      fs.rmSync(logos, { recursive: true, force: true });
      console.log('[offline] Logos televerses supprimes :', logos);
    }
  } catch (e) {
    console.error('[offline] Remise a zero des parametres impossible :', e.message);
  }
}

/**
 * SQLite en mode WAL ecrit les changements recents dans <base>-wal (et un
 * index dans <base>-shm) avant de les fusionner dans le fichier principal.
 * Deplacer ou copier UNIQUEMENT le fichier .db sans ces deux fichiers revient
 * a couper la base en deux : les dernieres ventes/produits restent dans le
 * -wal abandonne, et le .db qui a voyage seul peut se retrouver incoherent
 * ("database disk image is malformed"). Toute copie/renommage de base doit
 * donc toujours emporter -wal et -shm avec elle.
 */
function sidecarFiles(dbPath) {
  return [`${dbPath}-wal`, `${dbPath}-shm`];
}

function renameDbWithSidecars(from, to) {
  fs.renameSync(from, to);
  for (const suffix of ['-wal', '-shm']) {
    const src = `${from}${suffix}`;
    const dest = `${to}${suffix}`;
    if (fs.existsSync(src)) {
      try { fs.renameSync(src, dest); } catch (e) {
        console.error(`[offline] Renommage du fichier ${suffix} echoue :`, e.message);
      }
    }
  }
}

function copyDbWithSidecars(from, to) {
  fs.copyFileSync(from, to);
  for (const suffix of ['-wal', '-shm']) {
    const src = `${from}${suffix}`;
    const dest = `${to}${suffix}`;
    // On repart d'une copie propre : si la destination porte un ancien -wal/-shm
    // qui ne correspond plus au fichier qu'on vient d'ecrire, SQLite peut tenter
    // de le rejouer par-dessus et corrompre la base. On l'enleve d'abord.
    try { fs.rmSync(dest, { force: true }); } catch (e) { /* rien a enlever */ }
    if (fs.existsSync(src)) {
      try { fs.copyFileSync(src, dest); makeWritable(dest); } catch (e) {
        console.error(`[offline] Copie du fichier ${suffix} echouee :`, e.message);
      }
    }
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
      copyDbWithSidecars(dbTarget, path.join(dir, path.basename(dbTarget)));
      archived++;
    }
    // Parametres, logos et fichiers televerses.
    const uploads = path.join(exeDir, 'uploads');
    if (fs.existsSync(uploads)) { copyDir(uploads, path.join(dir, 'uploads')); archived++; }

    if (archived === 0) { fs.rmSync(dir, { recursive: true, force: true }); return null; }

    fs.writeFileSync(path.join(dir, 'INFOS.txt'),
      `Sauvegarde automatique\nDate   : ${now.toISOString()}\nRaison : ${reason}\n\n` +
      `Contenu :\n  ${path.basename(dbTarget)}  - base de donnees (ventes, produits, clients...)\n` +
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

// ── Migration du nom de la base ────────────────────────────────────────────
// La base s'appelait pos_patisserie.db avant le changement de marque. Sans ce
// renommage, une installation existante repartirait d'une base vide et le
// client perdrait ses ventes.
try {
  const legacyDb = path.join(dataDir, 'pos_patisserie.db');
  if (dbTarget && !fs.existsSync(dbTarget) && fs.existsSync(legacyDb)) {
    renameDbWithSidecars(legacyDb, dbTarget);
    console.log('[offline] Base existante reprise (avec -wal/-shm) :', legacyDb, '->', dbTarget);
  }
} catch (e) {
  console.error('[offline] Reprise de la base precedente impossible :', e.message);
}

// ── Mise a jour de version : les donnees sont CONSERVEES ───────────────────
// build-id.txt est genere a chaque build et livre dans resources/.
// installed-build.txt est ecrit a cote de la base.
//
// Regle : installer une nouvelle version NE SUPPRIME RIEN. Un poste en
// service garde ses ventes, ses produits, ses clients, son logo et ses
// reglages. Une sauvegarde est tout de meme creee avant, par securite.
//
// Pour repartir d'une base vierge (preparer un poste destine a un nouveau
// client), deposer un fichier nomme RESET.txt a cote de pos-server.exe.
// Il est consomme au demarrage suivant : la remise a zero n'a lieu qu'une
// fois, puis le fichier est efface.
try {
  const shippedFile   = path.join(exeDir, 'build-id.txt');
  const installedFile = path.join(dataDir, 'installed-build.txt');
  const resetMarker   = path.join(exeDir, 'RESET.txt');
  const shipped   = fs.existsSync(shippedFile)   ? fs.readFileSync(shippedFile, 'utf-8').trim()   : '';
  const installed = fs.existsSync(installedFile) ? fs.readFileSync(installedFile, 'utf-8').trim() : '';
  const dbExists  = dbTarget && fs.existsSync(dbTarget);
  const resetDemande = fs.existsSync(resetMarker);

  if (resetDemande && dbExists) {
    // Remise a zero explicite, demandee par le fichier RESET.txt.
    console.log('[offline] RESET.txt detecte : remise a zero demandee.');
    const backup = createBackup('Remise a zero demandee (RESET.txt)');

    if (!backup) {
      // Regle de securite : sans sauvegarde, on ne supprime RIEN.
      console.error('[offline] Sauvegarde impossible : les donnees existantes sont conservees.');
    } else {
      if (fs.existsSync(template)) {
        copyDbWithSidecars(template, dbTarget);
        makeWritable(dbTarget);
        console.log('[offline] Base reinitialisee depuis le modele.');
      } else {
        console.error('[offline] Modele de base introuvable : la base actuelle est conservee.');
      }
      // Les parametres vivent dans uploads/app-settings.json, pas dans la base :
      // sans cette ligne l'ancienne enseigne et l'ancien logo survivraient.
      resetSettingsFile();
      try { fs.rmSync(resetMarker, { force: true }); } catch (e) { /* marqueur laisse en place */ }
      console.log('[offline] Remise a zero terminee. Sauvegarde :', backup);
    }
    if (shipped) fs.writeFileSync(installedFile, shipped, 'utf-8');

  } else if (shipped && shipped !== installed && dbExists) {
    // Mise a jour ordinaire : sauvegarde, puis on garde tout.
    console.log('[offline] Mise a jour :', installed || '(aucune)', '->', shipped);
    const backup = createBackup(`Mise a jour vers la version ${shipped}`);
    console.log('[offline] Donnees conservees.', backup ? `Sauvegarde : ${backup}` : 'Sauvegarde impossible.');
    fs.writeFileSync(installedFile, shipped, 'utf-8');

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
    copyDbWithSidecars(template, dbTarget);
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
  for (const sidecar of sidecarFiles(dbTarget)) {
    if (fs.existsSync(sidecar)) makeWritable(sidecar);
  }
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

// ── Mise a niveau du schema de la base ─────────────────────────────────────
// Depuis que la mise a jour conserve les donnees, la base du client garde le
// schema de la version qu'il avait installee. Toute nouvelle fonctionnalite
// touchant au schema (une table, une colonne) echouerait alors chez lui :
// c'est ce qui donnait "erreur de chargement des commentaires" sur un poste
// mis a jour, dont la base n'avait pas la table product_comments.
//
// Le modele livre (samurai_food.template.db) porte toujours le schema a jour.
// On l'attache, on compare, et on cree ce qui manque. Aucune donnee n'est
// touchee : uniquement des CREATE TABLE, CREATE INDEX et ADD COLUMN.
function migrerSchema() {
  if (!dbTarget || !fs.existsSync(dbTarget) || !fs.existsSync(template)) return;

  let DatabaseSync;
  try {
    ({ DatabaseSync } = require('node:sqlite'));
  } catch (e) {
    console.error('[offline] Mise a niveau du schema indisponible :', e.message);
    return;
  }

  let db;
  try {
    db = new DatabaseSync(dbTarget);
    db.exec(`ATTACH DATABASE '${template.replace(/'/g, "''")}' AS modele`);

    const objets = (source, type) => db
      .prepare(`SELECT name, sql, tbl_name FROM ${source}.sqlite_master WHERE type = ? AND name NOT LIKE 'sqlite_%'`)
      .all(type);

    const tablesLocales  = new Set(objets('main', 'table').map(o => o.name));
    const tablesModele   = objets('modele', 'table');
    const indexLocaux    = new Set(objets('main', 'index').map(o => o.name));
    const indexModele    = objets('modele', 'index');

    let ajouts = 0;

    // 1. Tables absentes
    for (const table of tablesModele) {
      if (tablesLocales.has(table.name) || !table.sql) continue;
      db.exec(table.sql);
      console.log('[offline] Schema : table creee ->', table.name);
      tablesLocales.add(table.name);
      ajouts++;
    }

    // 2. Colonnes absentes dans les tables existantes
    // Attention : pragma_table_info ignore le prefixe de schema. Seule la
    // forme a deux arguments cible reellement la base attachee.
    for (const table of tablesModele) {
      const colonnesLocales = new Set(
        db.prepare(`SELECT name FROM pragma_table_info('${table.name}')`).all().map(c => c.name)
      );
      if (colonnesLocales.size === 0) continue;
      const colonnesRef = db
        .prepare(`SELECT name, type, [notnull], dflt_value FROM pragma_table_info('${table.name}', 'modele')`)
        .all();
      for (const col of colonnesRef) {
        if (colonnesLocales.has(col.name)) continue;
        // Une colonne NOT NULL sans valeur par defaut ne peut pas etre ajoutee
        // a une table qui contient deja des lignes : on la signale sans casser.
        if (col.notnull && (col.dflt_value === null || col.dflt_value === undefined)) {
          console.error(`[offline] Schema : colonne ${table.name}.${col.name} NOT NULL sans defaut, ajout impossible`);
          continue;
        }
        const defaut = (col.dflt_value === null || col.dflt_value === undefined) ? '' : ` DEFAULT ${col.dflt_value}`;
        db.exec(`ALTER TABLE "${table.name}" ADD COLUMN "${col.name}" ${col.type || 'TEXT'}${defaut}`);
        console.log(`[offline] Schema : colonne ajoutee -> ${table.name}.${col.name}`);
        ajouts++;
      }
    }

    // 3. Index absents
    for (const idx of indexModele) {
      if (indexLocaux.has(idx.name) || !idx.sql) continue;
      if (!tablesLocales.has(idx.tbl_name)) continue;
      try { db.exec(idx.sql); ajouts++; } catch (e) { /* index deja couvert */ }
    }

    db.exec('DETACH DATABASE modele');
    console.log(ajouts > 0
      ? `[offline] Schema mis a niveau (${ajouts} modification(s)).`
      : '[offline] Schema deja a jour.');
  } catch (e) {
    console.error('[offline] Mise a niveau du schema echouee :', e.message);
    console.error('[offline] La base reste utilisable, mais une fonctionnalite recente peut manquer.');
  } finally {
    try { if (db) db.close(); } catch (e) { /* deja fermee */ }
  }
}

migrerSchema();

// ── Commentaires par defaut ("sans sauce", etc.) ────────────────────────────
// Ajoute une seule fois les commentaires globaux demandes, disponibles pour
// TOUS les produits en caisse. N'ecrase et ne duplique jamais rien : chaque
// libelle n'est insere que s'il est absent.
function seedCommentairesGlobaux() {
  if (!dbTarget || !fs.existsSync(dbTarget)) return;
  let DatabaseSync;
  try { ({ DatabaseSync } = require('node:sqlite')); } catch (e) { return; }

  const libelles = [
    'Sans bssal', 'Sans mayonnaise', 'Sans hrissa', 'Sans mechwiya', 'Sans mel7',
    'Sans sauce barbecue', 'Sans sauce samurai', 'Sans sauce algerien', 'Sans ketchup',
    'Kol chy'
  ];

  let db;
  try {
    db = new DatabaseSync(dbTarget);
    const existe = db.prepare(
      `SELECT 1 FROM product_comments WHERE label = ? AND product_id IS NULL LIMIT 1`
    );
    const inserer = db.prepare(
      `INSERT INTO product_comments (label, product_id, display_index, is_active, created_at, updated_at)
       VALUES (?, NULL, NULL, 1, ?, ?)`
    );
    const maintenant = new Date().toISOString();
    let ajouts = 0;
    for (const label of libelles) {
      if (existe.get(label)) continue;
      inserer.run(label, maintenant, maintenant);
      ajouts++;
    }
    console.log(ajouts > 0
      ? `[offline] Commentaires globaux ajoutes : ${ajouts}`
      : '[offline] Commentaires globaux deja presents.');
  } catch (e) {
    // La table peut ne pas exister encore si migrerSchema a echoue avant :
    // ce n'est pas bloquant, elle sera cree au prochain demarrage reussi.
    console.error('[offline] Ajout des commentaires globaux ignore :', e.message);
  } finally {
    try { if (db) db.close(); } catch (e) { /* deja fermee */ }
  }
}

seedCommentairesGlobaux();

// ── Nettoyage d'une erreur de version precedente ────────────────────────────
// Les tout premiers essais de ce menu automatique l'avaient cree dans la
// table produits_de_caisse (articles composes), alors que l'ecran de caisse
// n'affiche que la table products (Gestion des produits) : les articles
// etaient bien crees en base mais invisibles en caisse. On les retire d'ici
// une seule fois, uniquement s'ils correspondent exactement aux noms connus
// de ce menu — jamais un article que le client aurait lui-meme nomme pareil
// et modifie depuis (on ne touche que ceux encore a l'etat "par defaut").
function nettoyerAncienEmplacementMenu() {
  if (!dbTarget || !fs.existsSync(dbTarget)) return;
  let DatabaseSync;
  try { ({ DatabaseSync } = require('node:sqlite')); } catch (e) { return; }
  const NOMS = MENU_DE_BASE_NOMS();
  let db;
  try {
    db = new DatabaseSync(dbTarget);
    const colonnes = db.prepare(`SELECT name FROM pragma_table_info('produits_de_caisse')`).all().map(c => c.name);
    if (colonnes.length === 0) return;
    const placeholders = NOMS.map(() => '?').join(',');
    const rows = db.prepare(`SELECT id FROM produits_de_caisse WHERE name IN (${placeholders})`).all(...NOMS);
    if (rows.length === 0) return;
    const ids = rows.map(r => r.id);
    const idPlaceholders = ids.map(() => '?').join(',');
    db.prepare(`DELETE FROM produit_de_caisse_depots WHERE produit_de_caisse_id IN (${idPlaceholders})`).run(...ids);
    db.prepare(`DELETE FROM produits_de_caisse WHERE id IN (${idPlaceholders})`).run(...ids);
    console.log(`[offline] Nettoyage : ${ids.length} article(s) retires du mauvais emplacement (produits_de_caisse).`);
  } catch (e) {
    console.error('[offline] Nettoyage ignore :', e.message);
  } finally {
    try { if (db) db.close(); } catch (e) { /* deja fermee */ }
  }
}

// [nom, prix TTC en dinars] — partage entre le nettoyage et la creation.
function MENU_DE_BASE() {
  return [
    ['MLEWI OMELETTE', 3.5], ['MLEWI OMELETTE SALAMI', 4.0], ['MLEWI OMELETTE KWIKA', 4.0],
    ['MLEWI OMELETTE JAMBON', 5.0], ['MLEWI OMELETTE THON', 5.5], ['MLEWI OMELETTE COR-BLEU', 6.5],
    ['MLEWI OMELETTE ESCALOPE', 6.5], ['MLEWI OMELETTE CHAWERMA', 6.5], ['MLEWI OMELETTE KABEB', 6.5],
    ['MLEWI SAMURAI MIXTE', 8.5], ['MLEWI SAMURAI MEXICAN', 9.0], ['MLEWI SAMURAI DUO', 10.0],
    ['MLEWI SAMURAI TUNA', 10.0], ['MLEWI SAMURAI KING', 11.0], ['MLEWI SAMURAI PRO MAX', 12.0],
    ['CHAPATI OMELETTE', 3.5], ['CHAPATI OMELETTE SALAMI', 4.0], ['CHAPATI OMELETTE KWIKA', 4.0],
    ['CHAPATI OMELETTE JAMBON', 5.0], ['CHAPATI OMELETTE THON', 5.5], ['CHAPATI OMELETTE COR-BLEU', 6.5],
    ['CHAPATI OMELETTE ESCALOPE', 6.5], ['CHAPATI OMELETTE CHAWERMA', 6.5], ['CHAPATI OMELETTE KABEB', 6.5],
    ['CHAPATI SAMURAI MIXTE', 8.5], ['CHAPATI SAMURAI MEXICAN', 9.0], ['CHAPATI SAMURAI DUO', 10.0],
    ['CHAPATI SAMURAI TUNA', 10.0], ['CHAPATI SAMURAI KING', 11.0], ['CHAPATI SAMURAI PRO MAX', 12.0]
  ];
}
function MENU_DE_BASE_NOMS() {
  const VARIANTES = ['Kabeb', 'Chawerma', 'Escalope'];
  const base = MENU_DE_BASE().map(([nom]) => nom);
  const variantes = [];
  for (const nom of base) {
    if (/pro max|mexican/i.test(nom)) for (const v of VARIANTES) variantes.push(`${nom} ${v}`);
  }
  return [...base, ...variantes];
}

nettoyerAncienEmplacementMenu();

// ── Menu de base (Mlewi / Chapati, Classic / Samurai) ───────────────────────
// Sur un poste dont le catalogue est encore vide (aucun "PRO MAX" ni
// "MEXICAN" a decliner), on cree directement les articles du menu affiche
// en boutique — dans la table "products" (Gestion des produits), la seule
// que l'ecran de caisse affiche reellement (verifie dans products.js : la
// requete GET /api/products ne lit jamais produits_de_caisse). Chaque
// article n'est cree qu'une fois (verifie par son nom exact) : un poste qui
// a deja son propre catalogue, ou dont ces articles ont ete renommes ou
// supprimes volontairement, n'est jamais touche.
function seedMenuDeBase() {
  if (!dbTarget || !fs.existsSync(dbTarget)) return;
  let DatabaseSync;
  try { ({ DatabaseSync } = require('node:sqlite')); } catch (e) { return; }

  const MENU = MENU_DE_BASE();

  let db;
  try {
    db = new DatabaseSync(dbTarget);

    const colonnes = db.prepare(`SELECT name FROM pragma_table_info('products')`).all().map(c => c.name);
    if (colonnes.length === 0) return; // table absente (schema pas encore a niveau)

    // Famille et depot par defaut : on prend "General"/"Samurai" s'ils
    // existent, sinon le premier disponible. Sans famille ni depot valides
    // on ne peut rien creer proprement : on abandonne plutot que de deviner.
    const famille = db.prepare(`SELECT id FROM product_families WHERE name = 'General' LIMIT 1`).get()
      || db.prepare(`SELECT id FROM product_families ORDER BY id LIMIT 1`).get();
    const depot = db.prepare(`SELECT id FROM depots WHERE name = 'Samurai' LIMIT 1`).get()
      || db.prepare(`SELECT id FROM depots ORDER BY id LIMIT 1`).get();
    if (!famille || !depot) {
      console.error('[offline] Menu de base ignore : aucune famille/depot en base.');
      return;
    }

    const dejaLa = db.prepare(`SELECT 1 FROM products WHERE name = ? LIMIT 1`);
    const insererArticle = db.prepare(`
      INSERT INTO products (
        name, is_stockable, is_vrac, is_vraguable, is_wholesale, requires_approval,
        famille_id, prix_vente_ttc, tva, unite, created_at, updated_at
      ) VALUES (?, 1, 0, 0, 0, 0, ?, ?, 19, 'pcs', ?, ?)
    `);
    const insererDepot = db.prepare(`
      INSERT INTO product_depots (product_id, depot_id, created_at, updated_at)
      VALUES (?, ?, ?, ?)
    `);

    const maintenant = new Date().toISOString();
    let ajouts = 0;
    for (const [nom, prix] of MENU) {
      if (dejaLa.get(nom)) continue;
      insererArticle.run(nom, famille.id, prix, maintenant, maintenant);
      const nouvelId = db.prepare('SELECT last_insert_rowid() AS id').get().id;
      insererDepot.run(nouvelId, depot.id, maintenant, maintenant);
      ajouts++;
    }
    console.log(ajouts > 0
      ? `[offline] Menu de base ajoute : ${ajouts} article(s).`
      : '[offline] Menu de base deja present.');
  } catch (e) {
    console.error('[offline] Ajout du menu de base ignore :', e.message);
  } finally {
    try { if (db) db.close(); } catch (e) { /* deja fermee */ }
  }
}

seedMenuDeBase();

// ── Variantes "au choix de viande" pour les menus composes ─────────────────
// Le menu affiche des articles a prix fixe dont la viande est "au choix"
// (SAMURAI PRO MAX, SAMURAI MEXICAN...). En caisse il n'existait qu'UN
// bouton pour chacun, sans facon d'indiquer quelle viande a ete choisie.
// On cree ici 3 boutons par article existant (Kabeb / Chawerma / Escalope),
// clones a l'identique (meme prix, meme famille, meme depot(s)) pour que la
// cuisine sache directement quelle viande preparer. Rien n'est modifie ni
// supprime sur l'article d'origine, et un article deja cree n'est jamais
// recree (idempotent, execute a chaque demarrage).
function seedVariantesViande() {
  if (!dbTarget || !fs.existsSync(dbTarget)) return;
  let DatabaseSync;
  try { ({ DatabaseSync } = require('node:sqlite')); } catch (e) { return; }

  const VARIANTES = ['Kabeb', 'Chawerma', 'Escalope'];
  // Motifs des articles de base a decliner, et exclusion des variantes
  // deja generees (pour ne jamais les redecliner a leur tour).
  const MOTIFS = ['%pro max%', '%mexican%'];
  const EXCLUSIONS = VARIANTES.map(v => v.toLowerCase());

  let db;
  try {
    db = new DatabaseSync(dbTarget);

    const colonnes = db.prepare(`SELECT name FROM pragma_table_info('products')`).all().map(c => c.name);
    if (colonnes.length === 0) return; // table absente (schema pas encore a niveau)

    const base = db.prepare(
      `SELECT * FROM products
       WHERE (lower(name) LIKE ? OR lower(name) LIKE ?)
         AND lower(name) NOT LIKE '%kabeb%'
         AND lower(name) NOT LIKE '%chawerma%'
         AND lower(name) NOT LIKE '%chwaerma%'
         AND lower(name) NOT LIKE '%escalope%'`
    ).all(MOTIFS[0], MOTIFS[1]);

    const dejaLa = db.prepare(`SELECT 1 FROM products WHERE name = ? LIMIT 1`);
    const insererArticle = db.prepare(`
      INSERT INTO products (
        name, description, barcode, created_at, updated_at, photo, prix_vente_ttc, tva, unite,
        is_stockable, original_product_id, is_vrac, display_index, bundle_price, bundle_size,
        is_wholesale, min_margin, requires_approval, famille_id, designation_legale, prix_achat,
        conversion_ratio, is_vraguable, prix_achat_vrac, prix_vente_vrac
      ) VALUES (
        ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )
    `);
    const depotsArticle = db.prepare(`SELECT depot_id FROM product_depots WHERE product_id = ?`);
    const insererDepot = db.prepare(`
      INSERT INTO product_depots (product_id, depot_id, created_at, updated_at)
      VALUES (?, ?, ?, ?)
    `);

    const maintenant = new Date().toISOString();
    let ajouts = 0;

    for (const article of base) {
      for (const viande of VARIANTES) {
        const nouveauNom = `${article.name} ${viande}`;
        if (dejaLa.get(nouveauNom)) continue;

        insererArticle.run(
          nouveauNom, article.description, maintenant, maintenant, article.photo,
          article.prix_vente_ttc, article.tva, article.unite, article.is_stockable,
          article.original_product_id, article.is_vrac, article.display_index, article.bundle_price,
          article.bundle_size, article.is_wholesale, article.min_margin, article.requires_approval,
          article.famille_id, article.designation_legale, article.prix_achat, article.conversion_ratio,
          article.is_vraguable, article.prix_achat_vrac, article.prix_vente_vrac
        );
        const nouvelId = db.prepare('SELECT last_insert_rowid() AS id').get().id;

        for (const d of depotsArticle.all(article.id)) {
          insererDepot.run(nouvelId, d.depot_id, maintenant, maintenant);
        }
        ajouts++;
        console.log('[offline] Article cree :', nouveauNom);
      }
    }

    console.log(ajouts > 0
      ? `[offline] Variantes viande ajoutees : ${ajouts}`
      : '[offline] Variantes viande deja presentes (ou aucun article PRO MAX / MEXICAN trouve).');
  } catch (e) {
    console.error('[offline] Ajout des variantes viande ignore :', e.message);
  } finally {
    try { if (db) db.close(); } catch (e) { /* deja fermee */ }
  }
}

seedVariantesViande();

// Range chaque article du menu dans sa famille (Chapati Classic / Chapati
// Samurai / Mlewi Classic / Mlewi Samurai), d'apres le prefixe de son nom.
// Cree aussi deux familles vides "Supplement" et "Boisson", pretes a
// recevoir de futurs articles. Idempotent : ne fait rien si deja fait,
// ne touche jamais aux articles hors menu (ex: articles de test).
function organiserFamillesMenu() {
  if (!dbTarget || !fs.existsSync(dbTarget)) return;
  let DatabaseSync;
  try { ({ DatabaseSync } = require('node:sqlite')); } catch (e) { return; }

  const FAMILLES = ['Chapati Classic', 'Chapati Samurai', 'Mlewi Classic', 'Mlewi Samurai', 'Supplement', 'Boisson'];

  let db;
  try {
    db = new DatabaseSync(dbTarget);

    const colonnesProducts = db.prepare(`SELECT name FROM pragma_table_info('products')`).all().map(c => c.name);
    const colonnesFamilles = db.prepare(`SELECT name FROM pragma_table_info('product_families')`).all().map(c => c.name);
    if (colonnesProducts.length === 0 || colonnesFamilles.length === 0) return;

    const familleParNom = db.prepare(`SELECT id FROM product_families WHERE name = ?`);
    const creerFamille = db.prepare(`
      INSERT INTO product_families (name, description, is_active, created_at, updated_at)
      VALUES (?, ?, 1, ?, ?)
    `);
    const maintenant = new Date().toISOString();
    const idFamille = {};
    for (const nom of FAMILLES) {
      const existante = familleParNom.get(nom);
      if (existante) { idFamille[nom] = existante.id; continue; }
      creerFamille.run(nom, `Famille ${nom}`, maintenant, maintenant);
      idFamille[nom] = db.prepare('SELECT last_insert_rowid() AS id').get().id;
      console.log(`[offline] Famille creee : ${nom}`);
    }

    // Determine la famille cible d'apres le prefixe du nom du produit.
    const familleCible = (nom) => {
      const n = nom.toUpperCase();
      if (n.startsWith('CHAPATI SAMURAI')) return idFamille['Chapati Samurai'];
      if (n.startsWith('CHAPATI')) return idFamille['Chapati Classic'];
      if (n.startsWith('MLEWI SAMURAI')) return idFamille['Mlewi Samurai'];
      if (n.startsWith('MLEWI')) return idFamille['Mlewi Classic'];
      return null; // article hors menu (ex: article de test) : jamais touche
    };

    const tous = db.prepare(`SELECT id, name, famille_id FROM products`).all();
    const majFamille = db.prepare(`UPDATE products SET famille_id = ?, updated_at = ? WHERE id = ?`);
    let deplaces = 0;
    for (const produit of tous) {
      const cible = familleCible(produit.name);
      if (cible && cible !== produit.famille_id) {
        majFamille.run(cible, maintenant, produit.id);
        deplaces++;
      }
    }
    console.log(deplaces > 0
      ? `[offline] Articles ranges par famille : ${deplaces}`
      : '[offline] Familles du menu deja a jour.');
  } catch (e) {
    console.error('[offline] Organisation des familles ignoree :', e.message);
  } finally {
    try { if (db) db.close(); } catch (e) { /* deja fermee */ }
  }
}

organiserFamillesMenu();

// Remplit la "designation legale" (ingredients affiches) des articles composes
// DUO / TUNA / PRO MAX / KING, d'apres le menu officiel. S'applique aux deux
// versions (MLEWI et CHAPATI) et aux 3 variantes de viande du PRO MAX.
// Idempotent : reecrit la meme valeur a chaque demarrage, ne touche jamais
// aux articles hors de cette liste (ex: "b jhlbhl" garde sa designation).
function remplirIngredientsMenu() {
  if (!dbTarget || !fs.existsSync(dbTarget)) return;
  let DatabaseSync;
  try { ({ DatabaseSync } = require('node:sqlite')); } catch (e) { return; }

  const INGREDIENTS = {
    'SAMURAI DUO': 'Oeuf + Escalope + Chawerma + Mozzarella Arbi',
    'SAMURAI TUNA': 'Omelette + Thon + Jambon + Mozzarella Arbi + Fromage Triangle + Fromage Slice',
    'SAMURAI KING': 'Omelette + Cordon Bleu + Mozzarella Arbi + Jambon + Fromage Slice + Gruyere',
    'SAMURAI PRO MAX': 'Oeuf + Omelette + Mozzarella Arbi + Fromage Slice + Gruyere + Viande au choix (Escalope / Chawerma / Kebab)',
    'SAMURAI PRO MAX KABEB': 'Oeuf + Kebab + Omelette + Mozzarella Arbi + Fromage Slice + Gruyere',
    'SAMURAI PRO MAX CHAWERMA': 'Oeuf + Chawerma + Omelette + Mozzarella Arbi + Fromage Slice + Gruyere',
    'SAMURAI PRO MAX ESCALOPE': 'Oeuf + Escalope + Omelette + Mozzarella Arbi + Fromage Slice + Gruyere'
  };

  let db;
  try {
    db = new DatabaseSync(dbTarget);
    const colonnes = db.prepare(`SELECT name FROM pragma_table_info('products')`).all().map(c => c.name);
    if (colonnes.length === 0) return;

    const tous = db.prepare(`SELECT id, name FROM products`).all();
    const maj = db.prepare(`UPDATE products SET designation_legale = ?, updated_at = ? WHERE id = ?`);
    const maintenant = new Date().toISOString();
    let ecrits = 0;

    for (const produit of tous) {
      // "MLEWI SAMURAI PRO MAX KABEB" ou "CHAPATI SAMURAI DUO" -> on retire le
      // prefixe MLEWI/CHAPATI pour retrouver la cle du dictionnaire.
      const suffixe = produit.name.toUpperCase().replace(/^(MLEWI|CHAPATI)\s+/, '');
      const ingredients = INGREDIENTS[suffixe];
      if (!ingredients) continue;
      maj.run(ingredients, maintenant, produit.id);
      ecrits++;
    }
    console.log(ecrits > 0
      ? `[offline] Ingredients renseignes : ${ecrits} article(s).`
      : '[offline] Aucun article DUO/TUNA/PRO MAX/KING trouve pour les ingredients.');
  } catch (e) {
    console.error('[offline] Remplissage des ingredients ignore :', e.message);
  } finally {
    try { if (db) db.close(); } catch (e) { /* deja fermee */ }
  }
}

remplirIngredientsMenu();

require('./index');
