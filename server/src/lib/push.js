const fs = require('fs');
const path = require('path');
const webpush = require('web-push');

const SETTINGS_PATH = path.join(__dirname, '..', '..', 'uploads', 'app-settings.json');

function readSettings() {
  try {
    const raw = fs.readFileSync(SETTINGS_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch (e) {
    return {};
  }
}

function writeSettings(settings) {
  try {
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2), 'utf-8');
  } catch (e) {
    // noop
  }
}

function ensureVapid() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const mailto = process.env.VAPID_SUBJECT || 'mailto:admin@example.com';
  if (!publicKey || !privateKey) {
    console.warn('[push] VAPID keys missing. Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in env.');
    return false;
  }
  webpush.setVapidDetails(mailto, publicKey, privateKey);
  return true;
}

function getSubscriptions() {
  const settings = readSettings();
  return Array.isArray(settings.pushSubscriptions) ? settings.pushSubscriptions : [];
}

function saveSubscription(sub) {
  const settings = readSettings();
  const list = Array.isArray(settings.pushSubscriptions) ? settings.pushSubscriptions : [];
  // Avoid duplicates by endpoint
  const exists = list.find((s) => s.endpoint === sub.endpoint);
  if (!exists) list.push(sub);
  settings.pushSubscriptions = list;
  writeSettings(settings);
}

async function sendPushToAll(payload) {
  if (!ensureVapid()) return;
  const subs = getSubscriptions();
  const body = JSON.stringify(payload);
  await Promise.all(
    subs.map((s) =>
      webpush.sendNotification(s, body).catch((err) => {
        // Cleanup gone subscriptions (410/404)
        if (err?.statusCode === 410 || err?.statusCode === 404) {
          const settings = readSettings();
          settings.pushSubscriptions = (settings.pushSubscriptions || []).filter((x) => x.endpoint !== s.endpoint);
          writeSettings(settings);
        } else {
          console.warn('[push] send error', err?.statusCode || err);
        }
      })
    )
  );
}

module.exports = {
  getSubscriptions,
  saveSubscription,
  sendPushToAll,
};


