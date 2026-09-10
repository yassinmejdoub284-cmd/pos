const fs = require('fs');
const path = require('path');

const SETTINGS_FILE = path.join((process.pkg ? path.dirname(process.execPath) : path.join(__dirname, '../..')), 'uploads/app-settings.json');

function ensureDefaults(data = {}) {
  return {
    // Conserver tout champ inconnu deja enregistre (evite toute perte silencieuse)
    ...data,
    companyName: data.companyName || 'Samurai Food',
    logoUrl: data.logoUrl || '/logo_sfax.webp',
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
      ...(data.printSettings || {}),
      showLogo: typeof data.printSettings?.showLogo === 'boolean' ? data.printSettings.showLogo : true,
      logoSize: data.printSettings?.logoSize || 'medium',
      dateFormat: data.printSettings?.dateFormat || 'dd/mm/yyyy',
      timeFormat: data.printSettings?.timeFormat || '24h',
      currencySymbol: data.printSettings?.currencySymbol ?? 'dt',
      currencyPosition: data.printSettings?.currencyPosition || 'after',
      customTexts: {
        thankYouMessage: data.printSettings?.customTexts?.thankYouMessage ?? 'Merci de votre visite!',
        receiptTitle: data.printSettings?.customTexts?.receiptTitle ?? 'REÇU DE VENTE',
        companySlogan: data.printSettings?.customTexts?.companySlogan ?? '',
        footerMessage: data.printSettings?.customTexts?.footerMessage ?? 'Merci pour votre fidélité'
      },
      // En-tete des tickets de caisse, saisi dans Parametres > Impression.
      // Sans ces deux lignes, ensureDefaults les effacait a chaque sauvegarde.
      receiptCompanyName: typeof data.printSettings?.receiptCompanyName === 'string' ? data.printSettings.receiptCompanyName : '',
      receiptDepotName: typeof data.printSettings?.receiptDepotName === 'string' ? data.printSettings.receiptDepotName : '',
      showCompanyDetails: typeof data.printSettings?.showCompanyDetails === 'boolean' ? data.printSettings.showCompanyDetails : true,
      showClientInfo: typeof data.printSettings?.showClientInfo === 'boolean' ? data.printSettings.showClientInfo : true,
      showPaymentMethod: typeof data.printSettings?.showPaymentMethod === 'boolean' ? data.printSettings.showPaymentMethod : true,
      showDiscountDetails: typeof data.printSettings?.showDiscountDetails === 'boolean' ? data.printSettings.showDiscountDetails : true,
      doubleImpression: typeof data.printSettings?.doubleImpression === 'boolean' ? data.printSettings.doubleImpression : true
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

function readRawSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const raw = fs.readFileSync(SETTINGS_FILE, 'utf-8');
      return JSON.parse(raw || '{}');
    }
  } catch (err) {
    console.warn(`[lib/settings] Failed to read raw settings file: ${err.message}`);
  }
  return {};
}

function getDepotSettings(depotId) {
  const all = readRawSettings();
  
  // Legacy flat object detection
  if (all && typeof all === 'object' && !Array.isArray(all) && (all.companyName !== undefined || all.printSettings !== undefined)) {
    return ensureDefaults(all);
  }
  
  const key = String(depotId);
  const depotData = (all && typeof all === 'object') ? all[key] : undefined;
  return ensureDefaults(depotData || {});
}

function writeAllFileSettingsRaw(rawObject) {
  const dir = path.dirname(SETTINGS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(rawObject || {}, null, 2), 'utf-8');
}

function writeDepotSettings(depotId, data) {
  let all = readRawSettings();
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

module.exports = {
  getDepotSettings,
  ensureDefaults,
  readRawSettings,
  writeDepotSettings,
  writeAllFileSettingsRaw,
  SETTINGS_FILE
};
