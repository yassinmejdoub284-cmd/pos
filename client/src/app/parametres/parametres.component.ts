import { Component, OnInit } from '@angular/core';
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
  availablePrinters: {name: string, isDefault: boolean}[] = [];
  loadingPrinters = false;
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
    defaultFonds: 0.0,
    denominations: [50, 20, 10, 5, 2, 1, 0.5, 0.2, 0.1, 0.05],
    requireApprovalForVariance: true,
    ticketWidth: 58,
    droitDeTimbre: false,
    autoApproveExpenseBelow: 0,
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
      showDiscountDetails: true
    },
    devicesConfig: {
      printer: 'POS-80C',
      customPrinterName: '',
      enableDrawer: true,
      autoCut: true,
      printLogo: true
    }
  };

  constructor(
    private settingsService: SettingsService,
    private printService: PrintService
  ) {}

  ngOnInit(): void {
    this.load();
    this.loadAvailablePrinters();
  }

  load(): void {
    this.loading = true;
    this.error = '';
    this.settingsService.getSettings().subscribe({
      next: (s) => {
        this.settings = s || {};
        
        // Ensure devicesConfig exists with default values
        if (!this.settings.devicesConfig) {
          this.settings.devicesConfig = {
            printer: 'POS-80C',
            customPrinterName: '',
            enableDrawer: true,
            autoCut: true,
            printLogo: true
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
        
        console.log('Loaded settings with devicesConfig:', this.settings.devicesConfig);
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.error = "Erreur lors du chargement des paramètres";
      }
    });
  }

  save(): void {
    this.saving = true;
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
        printer: 'POS-80C',
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
    this.settings.defaultFonds = Number(this.settings.defaultFonds) || 0;
    this.settings.ticketWidth = Number(this.settings.ticketWidth) || 58;
    this.settings.autoApproveExpenseBelow = Number(this.settings.autoApproveExpenseBelow) || 0;
    
    console.log('Saving settings with devicesConfig:', this.settings.devicesConfig);
    
    this.settingsService.updateSettings(this.settings).subscribe({
      next: (s) => {
        this.settings = s;
        this.denominationsInput = (this.settings.denominations || []).join(', ');
        try { this.keyboardShortcutsInput = this.settings.keyboardShortcuts ? JSON.stringify(this.settings.keyboardShortcuts, null, 2) : ''; } catch {}
        try { this.devicesConfigInput = this.settings.devicesConfig ? JSON.stringify(this.settings.devicesConfig, null, 2) : ''; } catch {}
        this.saving = false;
        console.log('Settings saved successfully:', this.settings.devicesConfig);
      },
      error: (error) => {
        this.saving = false;
        this.error = "Erreur lors de l'enregistrement";
        console.error('Error saving settings:', error);
      }
    });
  }

  onDenominationsInput(value: string): void {
    this.denominationsInput = value;
  }

  onLogoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files && input.files[0];
    if (!file) { return; }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      this.error = 'Veuillez sélectionner un fichier image valide';
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      this.error = 'Le fichier est trop volumineux (max 5MB)';
      return;
    }

    this.saving = true;
    this.error = '';

    this.settingsService.uploadLogo(file).subscribe({
      next: (response) => {
        this.settings.logoUrl = this.settingsService.getAbsoluteLogoUrl(response.logoUrl);
        this.saving = false;
        // Clear the input
        if (input) input.value = '';
      },
      error: (error) => {
        this.saving = false;
        this.error = 'Erreur lors de l\'upload du logo';
        console.error('Logo upload error:', error);
      }
    });
  }

  loadAvailablePrinters(): void {
    this.loadingPrinters = true;
    this.printService.getAvailablePrinters().then(printers => {
      this.availablePrinters = printers;
      this.loadingPrinters = false;
      
      // Ensure devicesConfig exists
      if (!this.settings.devicesConfig) {
        this.settings.devicesConfig = {
          printer: 'POS-80C',
          customPrinterName: '',
          enableDrawer: true,
          autoCut: true,
          printLogo: true
        };
      }
      
      // If no printer is currently selected, select the default one
      if (!this.settings.devicesConfig.printer && printers.length > 0) {
        const defaultPrinter = printers.find(p => p.isDefault);
        if (defaultPrinter) {
          this.settings.devicesConfig.printer = defaultPrinter.name;
          console.log('Auto-selected default printer:', defaultPrinter.name);
        }
      }
      
      console.log('Available printers loaded:', printers);
      console.log('Current devicesConfig:', this.settings.devicesConfig);
    }).catch(error => {
      console.error('Error loading printers:', error);
      this.loadingPrinters = false;
      this.error = 'Erreur lors du chargement de la liste des imprimantes';
    });
  }

  testPrinter(): void {
    this.saving = true;
    this.error = '';
    
    // Get the printer name from settings
    const printerName = this.settings.devicesConfig?.printer === 'CUSTOM' 
      ? this.settings.devicesConfig?.customPrinterName || 'POS-80C'
      : this.settings.devicesConfig?.printer || 'POS-80C';

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
    console.log('=== TEST PRINT BUTTON CLICKED ===');
    console.log('Current settings before save:', this.settings);
    console.log('Current devicesConfig:', this.settings.devicesConfig);
    console.log('Selected printer:', this.settings.devicesConfig?.printer);
    
    // Force set a printer for testing
    if (!this.settings.devicesConfig) {
      this.settings.devicesConfig = {};
    }
    this.settings.devicesConfig.printer = 'POS-80C';
    this.settings.devicesConfig.enableDrawer = true;
    this.settings.devicesConfig.autoCut = true;
    this.settings.devicesConfig.printLogo = true;
    
    console.log('After setting printer:', this.settings.devicesConfig);
    
    // Test if Tauri is available
    console.log('Window object:', typeof window);
    console.log('Window.__TAURI__:', (window as any).__TAURI__);
    console.log('All window properties:', Object.keys(window).filter(k => k.includes('TAURI')));
    
    if (typeof window !== 'undefined' && (window as any).__TAURI__) {
      console.log('Tauri is available');
      // Now test actual printing
      this.testActualPrint();
    } else {
      console.log('Tauri is NOT available');
      // Try alternative detection
      try {
        import('@tauri-apps/api/core').then(({ invoke }) => {
          console.log('Tauri invoke function found via dynamic import');
          this.testActualPrint();
        }).catch((e) => {
          console.log('Tauri invoke not available via dynamic import:', e);
          alert('Tauri is not available - running in web mode');
        });
      } catch (e) {
        console.log('Tauri invoke not available:', e);
        alert('Tauri is not available - running in web mode');
      }
    }
  }

  // Test actual printing functionality
  testActualPrint(): void {
    console.log('Testing actual print functionality...');
    
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
    
    console.log('Sending test sale to print service:', testSale);
    
    // Use the print service to print the test receipt
    this.printService.printSaleReceipt(testSale);
    
    console.log('Print command sent to print service');
  }

  private parseDenominations(raw: string): number[] {
    if (!raw) { return []; }
    return raw
      .split(',')
      .map((p) => Number(String(p).trim().replace(/\s+/g, '')))
      .filter((n) => !isNaN(n) && n >= 0)
      .sort((a, b) => b - a);
  }
} 