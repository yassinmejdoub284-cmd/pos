import type { Sale } from '../models/sale.model';
import type { AppSettings } from './settings.service';

type Row = { label: string; value?: string; bold?: boolean; center?: boolean; big?: boolean };
export const receiptLogoPixels = { small: 128, medium: 192, large: 256 };
const escape = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const plain = (value: unknown) => String(value ?? '').replace(/[\x00-\x1f\x7f]/g, ' ');

export function receiptDateTime(value: Date | string, settings?: AppSettings | null) {
  const date = new Date(value);
  const pad = (n: number) => String(n).padStart(2, '0');
  const day = pad(date.getDate()), month = pad(date.getMonth() + 1), year = date.getFullYear();
  const format = settings?.printSettings?.dateFormat;
  const hours = date.getHours();
  return {
    date: format === 'yyyy-mm-dd' ? `${year}-${month}-${day}` : format === 'mm/dd/yyyy' ? `${month}/${day}/${year}` : `${day}/${month}/${year}`,
    time: settings?.printSettings?.timeFormat === '12h' ? `${pad(hours % 12 || 12)}:${pad(date.getMinutes())} ${hours < 12 ? 'AM' : 'PM'}` : `${pad(hours)}:${pad(date.getMinutes())}`
  };
}

function receiptRows(sale: Sale, settings?: AppSettings | null, kitchen = false): Row[] {
  const p = settings?.printSettings;
  const custom = p?.customTexts;
  const money = (n: number) => {
    const symbol = p?.currencySymbol ?? 'dt';
    const amount = Number(n).toFixed(3);
    return (p?.currencyPosition === 'before' ? `${symbol} ${amount}` : `${amount} ${symbol}`).trim();
  };
  const rows: Row[] = [];
  const add = (label: unknown, value?: string, bold = false, center = false, big = false) => {
    if (String(label ?? '').trim()) rows.push({ label: String(label), value, bold, center, big });
  };
  const center = (label: unknown, bold = false) => add(label, undefined, bold, true);
  /** Nom de l'entreprise : centre, gras et en gros caracteres. */
  const title = (label: unknown) => add(label, undefined, true, true, true);
  const { date, time } = receiptDateTime(sale.createdAt, settings);
  title(p?.receiptCompanyName?.trim() || settings?.companyName || 'Samurai Food');
  center(p?.receiptDepotName, true);
  if (!kitchen) {
    if (p?.showCompanyDetails !== false) {
      [settings?.companyAddress, settings?.companyPhone, settings?.companyEmail,
        settings?.companyRC ? `RC: ${settings.companyRC}` : '', settings?.companyMF ? `MF: ${settings.companyMF}` : ''].forEach(v => center(v));
    }
    center(custom?.companySlogan);
    center(custom?.receiptTitle ?? 'REÇU DE VENTE', true);
  } else center('CUISINE', true);
  add(`Date: ${date}`);
  add(`Heure: ${time}`);
  add(`Ticket: #${String(sale.dailyTicketNumber || String(sale.id).padStart(4, '0')).split('/').pop()}`, undefined, true);
  if (sale.tableInfo) add(`Table: ${sale.tableInfo.tableNumber}`);
  if (p?.showClientInfo !== false && sale.client) add(`Client: ${sale.client.firstName} ${sale.client.lastName}`);
  if (!kitchen && (sale.isWholesale || sale.items?.some(i => i.isWholesale))) {
    center('VENTE GROS', true);
    if (sale.user) add(`Caissier: ${sale.user.firstName} ${sale.user.lastName}`);
    if (p?.showClientInfo !== false && sale.client?.code) add(`Code client: ${sale.client.code}`);
    const statuses: Record<string, string> = { COMPLETED: 'Terminé', TEMPORARY: 'Temporaire', PENDING: 'En attente', CANCELLED: 'Annulé', REFUNDED: 'Remboursé', PENDING_ADMIN: 'En attente admin', CADEAU: 'Cadeau' };
    add(`Statut: ${statuses[sale.status] || sale.status}`);
  }
  add('─');
  for (const item of sale.items || []) {
    const qty = Number(item.quantity || 0);
    if (kitchen) {
      add(`${qty} × ${item.productName}`, undefined, true);
      // Description du produit : utile en cuisine (composition, cuisson,
      // sans oignon...). Volontairement absente du ticket client.
      const note = (item.description || item.product?.description || '').toString().trim();
      if (note) for (const l of note.split(/\r?\n/)) { if (l.trim()) add(`   ${l.trim()}`); }
      continue;
    }
    add(item.productName, undefined, true);
    if (item.isWholesale && item.bundlePrice != null) {
      add(`  ${Number(item.bundleQuantity || 0)} lots × ${money(Number(item.bundlePrice))}`, money(Number(item.total || 0)));
      add(`  Lot: ${Number(item.bundleSize || 1)} unités • ${qty} unités`);
    } else add(`  ${qty} × ${money(Number(item.unitPrice || 0))}`, money(Number(item.total || 0)));
  }
  add('─');
  if (kitchen) {
    add('Total articles', String((sale.items || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0)));
    return rows;
  }
  const subtotal = (sale.items || []).reduce((sum, item) => sum + Number(item.total || 0), 0);
  const discount = Number(sale.discount || 0);
  const total = Number(sale.finalTotal ?? subtotal - discount);
  add('Sous-total', money(subtotal));
  if (discount > 0 && p?.showDiscountDetails !== false) add('Remise', money(-discount));
  add('TOTAL A PAYER', money(total), true);
  const advance = Number(sale.advancePayment || 0);
  if (advance > 0) add('Avance payée', money(advance));
  if (advance > 0 || sale.paymentType === 'CREDIT' || sale.status === 'TEMPORARY') add('Reste à payer', money(Math.max(0, total - advance)), true);
  if (p?.showPaymentMethod !== false) {
    add('Paiement', sale.status === 'CADEAU' ? 'CADEAU' : sale.paymentType === 'CREDIT' ? 'Crédit' : 'Comptant');
    if (sale.paymentMethod) add('Méthode', sale.paymentMethod.name);
    if (advance > 0 && sale.advancePaymentMethod) add('Méthode acompte', sale.advancePaymentMethod.name);
  }
  add('─');
  center(custom?.thankYouMessage ?? 'Merci de votre visite!');
  center(custom?.footerMessage ?? 'Merci pour votre fidélité');
  return rows;
}

export function renderReceiptHtml(sale: Sale, settings: AppSettings | null | undefined, logoUrl = '', kitchen = false): string {
  const p = settings?.printSettings;
  // Only image protocols are accepted; all text and attributes are escaped.
  const safeLogo = /^(https?:\/\/|data:image\/|blob:|\/)/i.test(logoUrl) ? logoUrl : '';
  const width = receiptLogoPixels[p?.logoSize || 'medium'] / 2;
  const logo = !kitchen && p?.showLogo !== false && safeLogo ? `<img class="logo" src="${escape(safeLogo)}" alt="Logo entreprise" style="width:${width}px;max-height:${width}px" />` : '';
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${kitchen ? 'Cuisine' : 'Ticket de caisse'}</title><style>
    @page { size:80mm auto; margin:3mm; } * { box-sizing:border-box; }
    body { margin:0; background:white; color:#000; font:13px/1.45 'Courier New',monospace; }
    .ticket { width:74mm; max-width:100%; margin:0 auto; padding:10px 3px 24px; }
    .row { display:flex; justify-content:space-between; gap:8px; margin:3px 0; }
    .label { overflow-wrap:anywhere; min-width:0; white-space:pre-wrap; } .value { flex-shrink:0; white-space:nowrap; }
    .center { display:block; text-align:center; white-space:pre-wrap; overflow-wrap:anywhere; }
    .bold { font-weight:bold; } .big { font-size:24px; line-height:1.2; letter-spacing:1px; } .logo { display:block; object-fit:contain; margin:0 auto 10px; }
    hr { border:0; border-top:1px dashed black; margin:10px 0; }
    .kitchen { font-size:16px; } .ticket + .ticket { break-before:page; border-top:2px dashed #888; margin-top:24px; }
    @media print { .ticket + .ticket { border:0; margin-top:0; } .no-print { display:none; } }
    </style></head><body><article class="ticket${kitchen ? ' kitchen' : ''}">${logo}${receiptRows(sale, settings, kitchen).map(r => r.label === '─' ? '<hr>' : `<div class="row${r.center ? ' center' : ''}${r.bold ? ' bold' : ''}${r.big ? ' big' : ''}"><span class="label">${escape(r.label)}</span>${r.value !== undefined ? `<span class="value">${escape(r.value)}</span>` : ''}</div>`).join('')}</article></body></html>`;
}

export function renderReceiptText(sale: Sale, settings?: AppSettings | null, kitchen = false): string {
  const width = 48;
  return receiptRows(sale, settings, kitchen).map(row => {
    if (row.label === '─') return '-'.repeat(width) + '\n';
    const label = plain(row.label), value = row.value === undefined ? '' : plain(row.value);
    const line = value ? (label.length + value.length + 1 <= width ? label + ' '.repeat(width - label.length - value.length) + value : label + '\n' + value.padStart(width)) : label;
    // ESC ! 0x38 = double largeur + double hauteur + gras. Au-dela de 24
    // caracteres la double largeur ne tient pas sur 48 colonnes : on garde
    // alors la double hauteur seule (0x18) pour eviter la troncature.
    const size = row.big ? (label.length <= width / 2 ? '\x1b!\x38' : '\x1b!\x18') : '';
    const sizeOff = row.big ? '\x1b!\x00' : '';
    return `\x1ba${row.center ? '\x01' : '\x00'}\x1bE${row.bold ? '\x01' : '\x00'}${size}${line}${sizeOff}\x1bE\x00\n`;
  }).join('') + '\x1ba\x00\n';
}

/** Pack monochrome pixels into an ESC/POS GS v 0 raster command. */
export function encodeReceiptLogo(rgba: Uint8ClampedArray, width: number, height: number): Uint8Array {
  const rowBytes = Math.ceil(width / 8);
  const data = new Uint8Array(8 + rowBytes * height);
  data.set([0x1d, 0x76, 0x30, 0, rowBytes & 255, rowBytes >> 8, height & 255, height >> 8]);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = (y * width + x) * 4;
    const alpha = rgba[i + 3] / 255;
    const luminance = (rgba[i] * .299 + rgba[i + 1] * .587 + rgba[i + 2] * .114) * alpha + 255 * (1 - alpha);
    if (luminance < 160) data[8 + y * rowBytes + (x >> 3)] |= 0x80 >> (x % 8);
  }
  return data;
}
