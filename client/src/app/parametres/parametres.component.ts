import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';
import { SettingsService, AppSettings } from '../core/services/settings.service';
import { PrintService } from '../core/services/print.service';

@Component({
  selector: 'app-parametres',
  templateUrl: './parametres.component.html',
  standalone: false
})
export class ParametresComponent implements OnInit {
  loading = false;
  saving = false;
  error = '';
  denominationsInput = '';
  keyboardShortcutsInput = '';
  devicesConfigInput = '';
  availablePrinters: {name: string, isDefault: boolean}[] = [
    { name: 'POS-80', isDefault: false },
    { name: 'Xprinter XP-80', isDefault: false }
  ];
  loadingPrinters = false;
  
  // Toast system
  showAlert = false;
  alertMessage = '';
  alertType: 'success' | 'error' | 'info' = 'info';
  settings: AppSettings = {
    companyName: '',
    companyAddress: '',
    companyPhone: '',
    companyEmail: '',
    companyRC: '',
    companyMF: '',
    loyaltyEnabled: false,
    loyaltyRate: 1,
    maxDiscountPercent: 50,
    defaultClientMaxDebt: 0,
    auditRetentionDays: 90,
    varianceThreshold: 5.0,
    denominations: [50, 20, 10, 5, 2, 1, 0.5, 0.2, 0.1, 0.05],
    requireApprovalForVariance: true,
    autoApproveExpenseBelow: 0,
    historyRetentionDays: 30,
    // Role-based history limits
    roleHistoryLimits: {
      ADMIN: 9999,
      MANAGER: 30,
      CASHIER: 5,
      STOCK_MANAGER: 15
    },
    // Stock
    printSettings: {
      showLogo: true,
      logoSize: 'medium',
      dateFormat: 'dd/mm/yyyy',
      timeFormat: '24h',
      currencySymbol: 'dt',
      currencyPosition: 'after',
      customTexts: {
        thankYouMessage: 'Merci de votre visite!',
        receiptTitle: 'REÇU DE VENTE',
        companySlogan: 'Votre pâtisserie de confiance',
        footerMessage: 'Merci pour votre fidélité'
      },
      showCompanyDetails: true,
      showClientInfo: true,
      showPaymentMethod: true,
      showDiscountDetails: true,
      doubleImpression: false
    },
    // Document display settings
    documentDisplaySettings: {
      livraison: {
        showPackageCount: true // Default to showing package count
      },
      sortie: {
        showPackageCount: true
      },
      transfert: {
        showPackageCount: true
      },
      facture: {
        showPackageCount: true,
        timbrePrice: 1 // Default timbre price
      }
    },
    devicesConfig: {
      printer: 'Xprinter XP-80',
      customPrinterName: '',
      enableDrawer: true,
      autoCut: true,
      printLogo: true
    },
    isDesktopVersion: true,
    // Document type defaults
    documentTypeDefaults: {
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
    }
  };

  constructor(
    public settingsService: SettingsService,
    private printService: PrintService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.load();
    this.updateSectionFromRoute();
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe(() => {
      this.updateSectionFromRoute();
    });
  }

  private ensureDocumentTypeDefaults(): void {
    if (!this.settings.documentTypeDefaults) {

      this.settings.documentTypeDefaults = {
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
      };
    }
  }

  load(): void {
    this.loading = true;
    this.error = '';
    this.settingsService.getSettings().subscribe({
      next: (s) => {

        this.settings = s || {};
        
        // Ensure basic company info exists with default values
        if (!this.settings.companyName) {
          this.settings.companyName = 'PATISSERIE TUNISIENNE';
        }
        
        // Ensure printSettings exists with default values including doubleImpression
        if (!this.settings.printSettings) {
          this.settings.printSettings = {
            showLogo: true,
            logoSize: 'medium',
            dateFormat: 'dd/mm/yyyy',
            timeFormat: '24h',
            currencySymbol: 'dt',
            currencyPosition: 'after',
            customTexts: {
              thankYouMessage: 'Merci de votre visite!',
              receiptTitle: 'REÇU DE VENTE',
              companySlogan: 'Votre pâtisserie de confiance',
              footerMessage: 'Merci pour votre fidélité'
            },
            showCompanyDetails: true,
            showClientInfo: true,
            showPaymentMethod: true,
            showDiscountDetails: true,
            doubleImpression: false
          };
        } else {
          // Ensure doubleImpression exists in printSettings
          if (this.settings.printSettings.doubleImpression === undefined) {
            this.settings.printSettings.doubleImpression = false;
          }
        }
        
        // Ensure devicesConfig exists with default values
        if (!this.settings.devicesConfig) {
          this.settings.devicesConfig = {
            printer: 'Xprinter XP-80',
            customPrinterName: '',
            enableDrawer: true,
            autoCut: true,
            printLogo: true
          };
        }
        
        // Ensure documentDisplaySettings exists with default values
        if (!this.settings.documentDisplaySettings) {

          this.settings.documentDisplaySettings = {
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
          };
        } else {
          // Ensure each document type has the required properties (only if missing)
          if (!this.settings.documentDisplaySettings.livraison) {
            this.settings.documentDisplaySettings.livraison = { showPackageCount: true };
          } else if (typeof this.settings.documentDisplaySettings.livraison.showPackageCount === 'undefined') {
            this.settings.documentDisplaySettings.livraison.showPackageCount = true;
          }
          
          if (!this.settings.documentDisplaySettings.sortie) {
            this.settings.documentDisplaySettings.sortie = { showPackageCount: true };
          } else if (typeof this.settings.documentDisplaySettings.sortie.showPackageCount === 'undefined') {
            this.settings.documentDisplaySettings.sortie.showPackageCount = true;
          }
          
          if (!this.settings.documentDisplaySettings.transfert) {
            this.settings.documentDisplaySettings.transfert = { showPackageCount: true };
          } else if (typeof this.settings.documentDisplaySettings.transfert.showPackageCount === 'undefined') {
            this.settings.documentDisplaySettings.transfert.showPackageCount = true;
          }
          
          if (!this.settings.documentDisplaySettings.facture) {
            this.settings.documentDisplaySettings.facture = { showPackageCount: true, timbrePrice: 1 };
          } else {
            if (typeof this.settings.documentDisplaySettings.facture.showPackageCount === 'undefined') {
              this.settings.documentDisplaySettings.facture.showPackageCount = true;
            }
            if (typeof this.settings.documentDisplaySettings.facture.timbrePrice === 'undefined') {
              this.settings.documentDisplaySettings.facture.timbrePrice = 1;
            }
          }
        }
        
        // Ensure documentTypeDefaults exists with default values
        if (!this.settings.documentTypeDefaults) {

          this.settings.documentTypeDefaults = {
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
          };
        }
        
        // Convert relative logo URL to absolute URL
        if (this.settings.logoUrl) {
          this.settings.logoUrl = this.settingsService.getAbsoluteLogoUrl(this.settings.logoUrl);
        }
        this.denominationsInput = (this.settings.denominations || [])
          .map((n) => (typeof n === 'number' && !isNaN(n) ? n : Number(n)))
          .filter((n) => typeof n === 'number' && !isNaN(n))
          .join(', ');
        // JSON fields as strings for editable textarea
        try {
          this.keyboardShortcutsInput = this.settings.keyboardShortcuts ? JSON.stringify(this.settings.keyboardShortcuts, null, 2) : '';
        } catch { this.keyboardShortcutsInput = ''; }
        try {
          this.devicesConfigInput = this.settings.devicesConfig ? JSON.stringify(this.settings.devicesConfig, null, 2) : '';
        } catch { this.devicesConfigInput = ''; }
        

        
        // Ensure documentTypeDefaults is initialized
        this.ensureDocumentTypeDefaults();
        
        // Ensure roleHistoryLimits is initialized
        if (!this.settings.roleHistoryLimits) {
          this.settings.roleHistoryLimits = {
            ADMIN: 9999,
            MANAGER: 30,
            CASHIER: 5,
            STOCK_MANAGER: 15
          };
        }
        
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.error = "Erreur lors du chargement des paramètres";
      }
    });
  }

  private currentSection: string | null = null;

  private updateSectionFromRoute(): void {
    // Get the last segment after /parametres
    const url = this.router.url || '';
    const parts = url.split('?')[0].split('#')[0].split('/').filter(Boolean);
    const idx = parts.indexOf('parametres');
    this.currentSection = idx >= 0 && parts[idx + 1] ? parts[idx + 1] : null;
  }

  showSection(sectionKey: string): boolean {
    // Only show when this component is used for a specific sub-route
    return this.currentSection === sectionKey;
  }

  get currentSectionLabel(): string {
    const map: Record<string, string> = {

      peripheriques: "Périphériques",
      fidelite: "Fidélité",
      'remises-dettes': "Remises & Dettes",
      raccourcis: "Raccourcis",
      impression: "Impression",
      depenses: "Dépenses",
      cloture: "Clôture",
      logs: "Logs & Audit",
      documents: "Documents"
    };
    return this.currentSection ? (map[this.currentSection] || this.currentSection) : 'Paramètres';
  }

  get documentTypeDefaults(): any {
    return this.settings.documentTypeDefaults || {};
  }

  // Expose Object to template for Object.keys() usage
  Object = Object;

  // Role history limits getters and setters for safe two-way binding
  get adminHistoryLimit(): number {
    return this.settings.roleHistoryLimits?.ADMIN ?? 9999;
  }

  set adminHistoryLimit(value: number) {
    if (!this.settings.roleHistoryLimits) {
      this.settings.roleHistoryLimits = {};
    }
    this.settings.roleHistoryLimits.ADMIN = value;
  }

  get managerHistoryLimit(): number {
    return this.settings.roleHistoryLimits?.MANAGER ?? 30;
  }

  set managerHistoryLimit(value: number) {
    if (!this.settings.roleHistoryLimits) {
      this.settings.roleHistoryLimits = {};
    }
    this.settings.roleHistoryLimits.MANAGER = value;
  }

  get cashierHistoryLimit(): number {
    return this.settings.roleHistoryLimits?.CASHIER ?? 5;
  }

  set cashierHistoryLimit(value: number) {
    if (!this.settings.roleHistoryLimits) {
      this.settings.roleHistoryLimits = {};
    }
    this.settings.roleHistoryLimits.CASHIER = value;
  }

  get stockManagerHistoryLimit(): number {
    return this.settings.roleHistoryLimits?.STOCK_MANAGER ?? 15;
  }

  set stockManagerHistoryLimit(value: number) {
    if (!this.settings.roleHistoryLimits) {
      this.settings.roleHistoryLimits = {};
    }
    this.settings.roleHistoryLimits.STOCK_MANAGER = value;
  }

  save(): void {
    this.saving = true;
    this.error = '';
    this.hideAlert();
    
    // Validate required fields
    if (!this.validateRequiredFields()) {
      this.saving = false;
      this.showAlertMessage('Veuillez vérifier les champs requis.', 'error');
      return;
    }
    
    // Ensure denominations are synced from input field
    this.settings.denominations = this.parseDenominations(this.denominationsInput);
    // Parse JSON inputs back to objects (only if they have content)
    try {
      this.settings.keyboardShortcuts = this.keyboardShortcutsInput ? JSON.parse(this.keyboardShortcutsInput) : {};
    } catch {}
    
    // Only parse devicesConfig from JSON input if it has content, otherwise keep the form values
    if (this.devicesConfigInput && this.devicesConfigInput.trim()) {
      try {
        this.settings.devicesConfig = JSON.parse(this.devicesConfigInput);
      } catch {}
    }
    // If no JSON input, ensure devicesConfig exists with current form values
    if (!this.settings.devicesConfig) {
      this.settings.devicesConfig = {
        printer: 'Xprinter XP-80',
        customPrinterName: '',
        enableDrawer: true,
        autoCut: true,
        printLogo: true
      };
    }
    
    // Coerce numeric fields to numbers to avoid sending strings/undefined
    this.settings.loyaltyRate = Number(this.settings.loyaltyRate) || 0;
    this.settings.maxDiscountPercent = Number(this.settings.maxDiscountPercent) || 0;
    this.settings.defaultClientMaxDebt = Number(this.settings.defaultClientMaxDebt) || 0;
    this.settings.auditRetentionDays = Number(this.settings.auditRetentionDays) || 0;
    this.settings.varianceThreshold = Number(this.settings.varianceThreshold) || 0;
    this.settings.autoApproveExpenseBelow = Number(this.settings.autoApproveExpenseBelow) || 0;
    this.settings.historyRetentionDays = Number((this.settings as any).historyRetentionDays) || 30;
    
    // Ensure documentTypeDefaults is properly included in settings
    this.ensureDocumentTypeDefaults();
    



    
    this.settingsService.updateSettings(this.settings).subscribe({
      next: (s) => {
        this.settings = s;
        this.denominationsInput = (this.settings.denominations || []).join(', ');
        try { this.keyboardShortcutsInput = this.settings.keyboardShortcuts ? JSON.stringify(this.settings.keyboardShortcuts, null, 2) : ''; } catch {}
        try { this.devicesConfigInput = this.settings.devicesConfig ? JSON.stringify(this.settings.devicesConfig, null, 2) : ''; } catch {}
        this.saving = false;

        
        // Show success toast and navigate back
        this.showAlertMessage('Paramètres enregistrés avec succès.', 'success');
        setTimeout(() => {
          this.navigateBack();
        }, 1500);
      },
      error: (error) => {
        this.saving = false;
        this.error = "Erreur lors de l'enregistrement";
        this.showAlertMessage('Veuillez vérifier les champs requis.', 'error');
        console.error('Error saving settings:', error);
      }
    });
  }

  onDenominationsInput(value: string): void {
    this.denominationsInput = value;
  }

  testPrinter(): void {
    this.saving = true;
    this.error = '';
    
    // Get the printer name from settings
    const printerName = this.settings.devicesConfig?.printer === 'CUSTOM' 
      ? this.settings.devicesConfig?.customPrinterName || 'Xprinter XP-80'
      : this.settings.devicesConfig?.printer || 'Xprinter XP-80';

    // Test the printer connection
    this.printService.testPrinter().then(success => {
      this.saving = false;
      if (success) {
        alert(`Test d'imprimante réussi!\nImprimante: ${printerName}`);
      } else {
        this.error = 'Échec du test d\'imprimante. Vérifiez la connexion.';
      }
    }).catch(error => {
      this.saving = false;
      this.error = 'Erreur lors du test d\'imprimante: ' + error;
    });
  }

  // Debug method to test printer selection and actual printing
  testPrinterSelection(): void {
    alert('Test Print button clicked!');




    
    // Force set a printer for testing
    if (!this.settings.devicesConfig) {
      this.settings.devicesConfig = {};
    }
    this.settings.devicesConfig.printer = 'Xprinter XP-80';
    this.settings.devicesConfig.enableDrawer = true;
    this.settings.devicesConfig.autoCut = true;
    this.settings.devicesConfig.printLogo = true;
    

    
    // Test if Tauri is available



    
    if (typeof window !== 'undefined' && (window as any).__TAURI__) {

      // Now test actual printing
      this.testActualPrint();
    } else {

      // Try alternative detection
      try {
        import('@tauri-apps/api/core').then(({ invoke }) => {

          this.testActualPrint();
        }).catch((e) => {

          alert('Tauri is not available - running in web mode');
        });
      } catch (e) {

        alert('Tauri is not available - running in web mode');
      }
    }
  }

  // Test actual printing functionality
  testActualPrint(): void {

    
    // Create a test sale object for printing with all required properties
    const testSale = {
      id: 999,
      createdAt: new Date(),
      updatedAt: new Date(),
      total: 12.500,
      finalTotal: 12.500,
      status: 'COMPLETED' as const,
      cashierId: 1,
      items: [
        {
          id: 1,
          saleId: 999,
          productId: 1,
          productName: 'Test Produit',
          quantity: 1,
          unitPrice: 10.000,
          total: 10.000,
          discount: 0
        },
        {
          id: 2,
          saleId: 999,
          productId: 2,
          productName: 'Test Service',
          quantity: 1,
          unitPrice: 2.500,
          total: 2.500,
          discount: 0
        }
      ],
      paymentMethod: {
        id: 1,
        name: 'ESPÈCES',
        type: 'CASH' as const,
        isActive: true
      },
      client: undefined,
      discount: 0,
      tax: 0
    };
    

    
    // Use the print service to print the test receipt
    this.printService.printSaleReceipt(testSale);
    

  }

  private parseDenominations(raw: string): number[] {
    if (!raw) { return []; }
    return raw
      .split(',')
      .map((p) => Number(String(p).trim().replace(/\s+/g, '')))
      .filter((n) => !isNaN(n) && n >= 0)
      .sort((a, b) => b - a);
  }

  private validateRequiredFields(): boolean {
    // Basic validation - can be extended based on requirements
    if (!this.settings.companyName?.trim()) {
      return false;
    }
    return true;
  }

  showAlertMessage(message: string, type: 'success' | 'error' | 'info' = 'info'): void {
    this.alertMessage = message;
    this.alertType = type;
    this.showAlert = true;
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
      this.hideAlert();
    }, 5000);
  }

  hideAlert(): void {
    this.showAlert = false;
    this.alertMessage = '';
  }

  navigateBack(): void {
    // Navigate back to the parametres overview or home
    this.router.navigate(['/parametres']);
  }
} 