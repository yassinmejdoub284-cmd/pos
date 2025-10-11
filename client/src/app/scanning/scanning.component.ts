import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { Router } from '@angular/router';
import { ProductsService } from '../core/services/products.service';
import { ProduitsDeCaisseService } from '../core/services/produits-de-caisse.service';
import { ClientsService } from '../core/services/clients.service';
import { DepotsService } from '../core/services/depots.service';
import { VehiclesService } from '../core/services/vehicles.service';
import { DriversService } from '../core/services/drivers.service';
import { StockDocumentsService } from '../core/services/stock-documents.service';
import { SettingsService } from '../core/services/settings.service';
import { Product } from '../core/models/product.model';
import { ProduitDeCaisse } from '../core/models/produit-de-caisse.model';

@Component({
  selector: 'app-scanning',
  templateUrl: './scanning.component.html',
  standalone: false
})
export class ScanningComponent implements OnInit, OnDestroy {
  scannedCode = '';
  currentInput = '';
  isScanning = false;
  lastScannedProduct: Product | null = null;
  error = '';
  success = '';
  loading = false;

  // Scanned items tracking (same as scan-reception)
  scannedItems: Array<{
    articleId: number;
    productName: string;
    quantity: number;
    count: number;
    lastScanned: Date;
  }> = [];

  // Document type selection modal
  showDocumentTypeModal = false;
  showDocumentConfigurationModal = false;
  selectedDocumentType: 'livraison' | 'sortie' | 'transfert' | 'facture' | null = null;
  
  // Document configuration
  documentConfig = {
    client: false,
    depot: false,
    vehicle: false,
    driver: false,
    manualDestination: false,
    autoInvoice: false,
    tvaAndPrix: false
  };

  // Selection modals
  showClientSelectionModal = false;
  showDepotSelectionModal = false;
  showVehicleSelectionModal = false;
  showDriverSelectionModal = false;
  showManualDestinationModal = false;
  showInvoiceNumberModal = false;
  
  // Selected values
  selectedClient: any = null;
  selectedDepot: any = null;
  selectedVehicle: any = null;
  selectedDriver: any = null;
  manualDestination = '';
  invoiceNumber = '';
  
  // Data for selections
  clients: any[] = [];
  depots: any[] = [];
  vehicles: any[] = [];
  drivers: any[] = [];

  // Products cache for fast lookup
  private productsCache = new Map<number, Product>();
  private produitsDeCaisseCache = new Map<number, ProduitDeCaisse>();

  // Sound effects
  private beepSound: HTMLAudioElement | null = null;
  private successSound: HTMLAudioElement | null = null;
  private errorSound: HTMLAudioElement | null = null;

  constructor(
    private router: Router,
    private productsService: ProductsService,
    private produitsDeCaisseService: ProduitsDeCaisseService,
    private clientsService: ClientsService,
    private depotsService: DepotsService,
    private vehiclesService: VehiclesService,
    private driversService: DriversService,
    private stockDocumentsService: StockDocumentsService,
    private settingsService: SettingsService
  ) {}

  ngOnInit(): void {
    this.initializeSounds();
    this.focusInput();
    this.loadProducts();
    this.loadProduitsDeCaisse();
    this.loadClients();
    this.loadDepots();
    this.loadVehicles();
    this.loadDrivers();
    this.loadSettings();
  }

  ngOnDestroy(): void {
    this.cleanupSounds();
  }

  @HostListener('document:keydown', ['$event'])
  handleKeyDown(event: KeyboardEvent): void {
    // Don't process scanning input if any modal is open
    if (this.isAnyModalOpen()) {
      return;
    }

    // Prevent default behavior for Enter key to avoid form submission
    if (event.key === 'Enter') {
      event.preventDefault();
      this.processScannedCode();
      return;
    }

    // Handle numeric input and backspace
    if (event.key === 'Backspace') {
      this.currentInput = this.currentInput.slice(0, -1);
      return;
    }

    // Only allow numeric input
    if (/^\d$/.test(event.key)) {
      this.currentInput += event.key;
      this.playBeepSound();
    }
  }

  isAnyModalOpen(): boolean {
    return this.showDocumentTypeModal ||
           this.showDocumentConfigurationModal ||
           this.showClientSelectionModal ||
           this.showDepotSelectionModal ||
           this.showVehicleSelectionModal ||
           this.showDriverSelectionModal ||
           this.showManualDestinationModal ||
           this.showInvoiceNumberModal;
  }

  private loadProducts(): void {
    this.productsService.getProducts().subscribe({
      next: (products: Product[]) => {
        // Cache products by ID for fast lookup
        this.productsCache.clear();
        products.forEach((product: Product) => {
          this.productsCache.set(product.id, product);
        });
      },
      error: (error: any) => {
        console.error('Error loading products:', error);
      }
    });
  }

  private async loadProduitsDeCaisse(): Promise<void> {
    try {
      const produits = await this.produitsDeCaisseService.getActiveProduitsDeCaisse().toPromise();
      if (produits) {
        produits.forEach(produit => {
          this.produitsDeCaisseCache.set(produit.id, produit);
        });
    this.searchProductByBarcode("1234001891011")
    this.searchProductByBarcode("1234002891011")
    this.searchProductByBarcode("1234003891011")
    this.searchProductByBarcode("1234004891011")
    this.searchProductByBarcode("1234005891011")
    this.searchProductByBarcode("1234006891011")
    this.searchProductByBarcode("1234007891011")
    this.searchProductByBarcode("1234008891011")
    this.searchProductByBarcode("1234009891011")
    this.searchProductByBarcode("1234010891011")
    this.searchProductByBarcode("1234011891011")
    this.searchProductByBarcode("1234012891011")
    this.searchProductByBarcode("1234013891011")
    this.searchProductByBarcode("1234014891011")
    this.searchProductByBarcode("1234015891011")
    this.searchProductByBarcode("1234016891011")
    this.searchProductByBarcode("1234017891011")
    this.searchProductByBarcode("1234018891011")
    this.searchProductByBarcode("1234019891011")
    this.searchProductByBarcode("1234020891011")
    this.searchProductByBarcode("1234021891011")
    this.searchProductByBarcode("1234022891011")
    this.searchProductByBarcode("1234023891011")
    this.searchProductByBarcode("1234024891011")
    this.searchProductByBarcode("1234025891011")
      }
    } catch (error) {
      console.error('Error loading produits de caisse:', error);
    }
  }

  private getProductName(articleId: number): string | null {
    // ONLY look in sous-produits (produits-de-caisse) - NO fallback to main products
    for (const [produitId, produit] of this.produitsDeCaisseCache) {
      if (produit.id === articleId) {
        return produit.name;
      }
    }
    
    // Return null if not found in sous-produits - NO fallback to main products
    return null;
  }

  private initializeSounds(): void {
    try {
      // Create success sound (high pitch beep - 800Hz)
      this.successSound = new Audio();
      this.successSound.src = this.generateBeepDataUrl(800, 0.2);
      this.successSound.volume = 0.8;
      this.successSound.preload = 'auto';

      // Create error sound (low pitch beep - 300Hz)
      this.errorSound = new Audio();
      this.errorSound.src = this.generateBeepDataUrl(300, 0.3);
      this.errorSound.volume = 0.8;
      this.errorSound.preload = 'auto';

      // Create beep sound for each digit
      this.beepSound = new Audio();
      this.beepSound.src = this.generateBeepDataUrl(600, 0.1);
      this.beepSound.volume = 0.6;
      this.beepSound.preload = 'auto';
    } catch (error) {
      console.warn('Could not initialize sounds:', error);
    }
  }

  private generateBeepDataUrl(frequency: number, duration: number): string {
    const sampleRate = 44100;
    const samples = Math.floor(sampleRate * duration);
    const buffer = new ArrayBuffer(44 + samples * 2);
    const view = new DataView(buffer);
    
    // WAV header
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };
    
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + samples * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, samples * 2, true);
    
    // Generate sine wave with higher amplitude
    for (let i = 0; i < samples; i++) {
      const sample = Math.sin(2 * Math.PI * frequency * i / sampleRate) * 0.8;
      view.setInt16(44 + i * 2, sample * 32767, true);
    }
    
    const blob = new Blob([buffer], { type: 'audio/wav' });
    return URL.createObjectURL(blob);
  }

  private cleanupSounds(): void {
    if (this.beepSound) {
      this.beepSound.pause();
      this.beepSound = null;
    }
    if (this.successSound) {
      this.successSound.pause();
      this.successSound = null;
    }
    if (this.errorSound) {
      this.errorSound.pause();
      this.errorSound = null;
    }
  }

  private playBeepSound(): void {
    if (this.beepSound) {
      this.beepSound.currentTime = 0;
      this.beepSound.play().catch(() => {
        // Ignore audio play errors
      });
    }
  }

  private playSuccessSound(): void {
    if (this.successSound) {
      this.successSound.currentTime = 0;
      this.successSound.play().catch(() => {
        // Ignore audio play errors
      });
    }
  }

  private playErrorSound(): void {
    if (this.errorSound) {
      this.errorSound.currentTime = 0;
      this.errorSound.play().catch(() => {
        // Ignore audio play errors
      });
    }
  }

  private focusInput(): void {
    // Focus on the input field for better UX
    setTimeout(() => {
      const input = document.getElementById('barcode-input');
      if (input) {
        input.focus();
      }
    }, 100);
  }

  processScannedCode(): void {
    if (!this.currentInput.trim()) {
      this.showError('Aucun code scanné');
      return;
    }

    this.scannedCode = this.currentInput.trim();
    this.isScanning = true;
    this.loading = true;
    this.error = '';
    this.success = '';

    // Simulate scanning delay
    setTimeout(() => {
      this.searchProductByBarcode(this.scannedCode);
    }, 500);
  }

  private searchProductByBarcode(barcode: string): void {
    const code = this.sanitizeTo13(barcode);
    if (!code) {
      this.showError('Code-barres invalide (doit faire exactement 13 chiffres)');
      this.playErrorSound();
      this.isScanning = false;
      this.loading = false;
      this.currentInput = '';
      this.focusInput();
      return;
    }

    this.parseAndAddBarcode(code);
  }

  private parseAndAddBarcode(barcode: string): void {
    // Expect exactly 13 digits (already sanitized)
    if (barcode.length !== 13) {
      this.showError('Code-barres invalide (doit faire exactement 13 chiffres)');
      this.playErrorSound();
      this.isScanning = false;
      this.loading = false;
      this.currentInput = '';
      this.focusInput();
      return;
    }

    try {
      // For 2321001011504: extract "001" and "01150"
      // Looking at the barcode: 2321001011504
      // We need: article "001" and quantity "01150"
      // Article "001" is at positions 6-8 (0-indexed: 5-7)
      // Quantity "01150" is at positions 7-11 (0-indexed: 6-10)
      const articleIdStr = barcode.substring(4, 7); // positions 6-8: "001"
      const quantityStr = barcode.substring(7, 12); // positions 7-11: "01150"
      
      const articleId = parseInt(articleIdStr, 10);
      const quantity = parseInt(quantityStr, 10);

      if (isNaN(quantity) || isNaN(articleId)) {
        this.showError('Code-barres invalide (format incorrect)');
        this.playErrorSound();
        this.isScanning = false;
        this.loading = false;
        this.currentInput = '';
        this.focusInput();
        return;
      }

      if (quantity < 1 || quantity > 99999) {
        this.showError('Quantité invalide (1-99999)');
        this.playErrorSound();
        this.isScanning = false;
        this.loading = false;
        this.currentInput = '';
        this.focusInput();
        return;
      }

      if (articleId < 0 || articleId > 999) {
        this.showError('ID article invalide (0-999)');
        this.playErrorSound();
        this.isScanning = false;
        this.loading = false;
        this.currentInput = '';
        this.focusInput();
        return;
      }

      // Check if product exists in sous-produits first
      const productName = this.getProductName(articleId);
      if (!productName) {
        this.showError(`Produit ${articleId} non trouvé dans les sous-produits`);
        this.playErrorSound();
        this.isScanning = false;
        this.loading = false;
        this.currentInput = '';
        this.focusInput();
        return;
      }
      
      // Use parent product ID if available, otherwise use the produit de caisse ID
      const produitDeCaisse = this.produitsDeCaisseCache.get(articleId);
      const productId = produitDeCaisse?.parentProductId || articleId;
      
      // Find existing item or create new one
      const existingItemIndex = this.scannedItems.findIndex(item => item.articleId === articleId);
      
      if (existingItemIndex >= 0) {
        // Update existing item - add quantity and increment count
        this.scannedItems[existingItemIndex].quantity += quantity;
        this.scannedItems[existingItemIndex].count += 1;
        this.scannedItems[existingItemIndex].lastScanned = new Date();
        this.success = `${productName} scanné (${this.scannedItems[existingItemIndex].count}x, Qty: ${this.scannedItems[existingItemIndex].quantity}g)`;
      } else {
        // Add new item
        this.scannedItems.push({
          articleId: articleId, // Keep original articleId, not parent
          productName: productName,
          quantity,
          count: 1,
          lastScanned: new Date()
        });
        this.success = `Nouveau ${productName} ajouté (Qty: ${quantity}g)`;
      }

      // Find the parent product for display
      const parentProduct = this.productsCache.get(productId);
      if (parentProduct) {
        this.lastScannedProduct = parentProduct;
      }

      // Play success sound
      this.playSuccessSound();

      // Clear success message after 3 seconds
      setTimeout(() => { this.success = ''; }, 3000);
      this.error = '';

      this.isScanning = false;
      this.loading = false;
      this.currentInput = '';
      this.focusInput();

      // Scroll to the scanned item after a short delay to ensure DOM is updated
      setTimeout(() => {
        this.scrollToScannedItem(articleId);
      }, 100);

    } catch (err) {
      this.showError('Erreur lors du parsing du code-barres');
      this.playErrorSound();
      this.isScanning = false;
      this.loading = false;
      this.currentInput = '';
      this.focusInput();
    }
  }

  private sanitizeTo13(input: string): string | null {
    const digits = (input || '').replace(/\D+/g, '');
    if (!digits) return null;
    if (digits.length < 13) return null;
    // Always use the last 13 digits to avoid prefixes/suffixes from some readers
    return digits.slice(-13);
  }

  private showSuccess(message: string): void {
    this.success = message;
    this.error = '';
    
    // Clear success message after 3 seconds
    setTimeout(() => {
      this.success = '';
    }, 3000);
  }

  private showError(message: string): void {
    this.error = message;
    this.success = '';
    
    // Clear error message after 5 seconds
    setTimeout(() => {
      this.error = '';
    }, 5000);
  }

  clearInput(): void {
    this.currentInput = '';
    this.scannedCode = '';
    this.error = '';
    this.success = '';
    this.lastScannedProduct = null;
    this.focusInput();
  }

  goBack(): void {
    this.router.navigate(['/stock']);
  }

  viewProductDetails(): void {
    if (this.lastScannedProduct) {
      this.router.navigate(['/stock/produits'], { 
        queryParams: { 
          search: this.lastScannedProduct.name,
          highlight: this.lastScannedProduct.id 
        } 
      });
    }
  }

  getScannedQuantity(): string {
    // Extract quantity from the last scanned code
    if (!this.scannedCode) return 'N/A';
    
    const code = this.sanitizeTo13(this.scannedCode);
    if (!code || code.length !== 13) return 'N/A';
    
    try {
      const quantityStr = code.substring(7, 12);
      const quantity = parseInt(quantityStr, 10);
      
      if (isNaN(quantity)) return 'N/A';
      
      return `${quantity}g (${(quantity/1000).toFixed(3)}kg)`;
    } catch {
      return 'N/A';
    }
  }

  clearScannedItems(): void {
    this.scannedItems = [];
    this.lastScannedProduct = null;
    this.success = 'Liste des articles effacée';
    setTimeout(() => { this.success = ''; }, 3000);
  }

  removeScannedItem(articleId: number): void {
    this.scannedItems = this.scannedItems.filter(item => item.articleId !== articleId);
  }

  getGroupedScannedItems(): Array<{
    mainProduct: Product | null;
    subProducts: Array<{
      articleId: number;
      productName: string;
      quantity: number;
      count: number;
      lastScanned: Date;
      color?: string;
    }>;
    totalQuantity: number;
    totalPrice: number;
  }> {
    return this.groupScannedItemsByParentProduct();
  }

  private groupScannedItemsByParentProduct(): Array<{
    mainProduct: Product | null;
    subProducts: Array<{
      articleId: number;
      productName: string;
      quantity: number;
      count: number;
      lastScanned: Date;
      color?: string;
    }>;
    totalQuantity: number;
    totalPrice: number;
  }> {
    const groups = new Map<number, Array<{
      articleId: number;
      productName: string;
      quantity: number;
      count: number;
      lastScanned: Date;
      color?: string;
    }>>();

    // Group scanned items by their parent product
    this.scannedItems.forEach(item => {
      const scannedProduit = this.produitsDeCaisseCache.get(item.articleId);
      if (scannedProduit && scannedProduit.parentProductId) {
        // This is a sous-produit, group it under its parent product
        const parentProductId = scannedProduit.parentProductId;
        if (!groups.has(parentProductId)) {
          groups.set(parentProductId, []);
        }
        
        // Add color information if available (placeholder for now)
        const itemWithColor = {
          ...item,
          color: 'Sans couleur' // TODO: Add color property to ProduitDeCaisse model
        };
        
        groups.get(parentProductId)!.push(itemWithColor);
      } else {
        // If it's a standalone sous-produit (no parent), create a standalone group
        const standaloneKey = -item.articleId; // Use negative ID to avoid conflicts
        if (!groups.has(standaloneKey)) {
          groups.set(standaloneKey, []);
        }
        
        const itemWithColor = {
          ...item,
          color: 'Sans couleur' // TODO: Add color property to ProduitDeCaisse model
        };
        
        groups.get(standaloneKey)!.push(itemWithColor);
      }
    });

    // Convert to the required format
    const result: Array<{
      mainProduct: Product | null;
      subProducts: Array<{
        articleId: number;
        productName: string;
        quantity: number;
        count: number;
        lastScanned: Date;
        color?: string;
      }>;
      totalQuantity: number;
      totalPrice: number;
    }> = [];

    for (const [key, items] of groups) {
      if (key > 0) {
        // This is a parent product group
        const parentProduct = this.productsCache.get(key);
        const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
        const totalPrice = items.reduce((sum, item) => {
          const produit = this.produitsDeCaisseCache.get(item.articleId);
          if (produit) {
            const prixUnitaire = produit.prix_vente_TTC || 0;
            const quantite = item.quantity / 1000; // Convert to kg
            return sum + (prixUnitaire * quantite);
          }
          return sum;
        }, 0);
        
        result.push({
          mainProduct: parentProduct || null,
          subProducts: items,
          totalQuantity,
          totalPrice
        });
      } else {
        // This is a standalone sous-produit group
        const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
        const totalPrice = items.reduce((sum, item) => {
          const produit = this.produitsDeCaisseCache.get(item.articleId);
          if (produit) {
            const prixUnitaire = produit.prix_vente_TTC || 0;
            const quantite = item.quantity / 1000; // Convert to kg
            return sum + (prixUnitaire * quantite);
          }
          return sum;
        }, 0);
        
        result.push({
          mainProduct: null,
          subProducts: items,
          totalQuantity,
          totalPrice
        });
      }
    }

    return result;
  }

  getProductFamilyName(product: ProduitDeCaisse | null): string {
    if (!product) return 'Général';
    
    // If famille is a string, return it directly
    if (typeof product.famille === 'string') {
      return product.famille;
    }
    
    // If famille is an object with a name property, return the name
    if (product.famille && typeof product.famille === 'object' && 'name' in product.famille) {
      return product.famille.name || 'Général';
    }
    
    // Fallback
    return 'Général';
  }

  getSubProductPrice(articleId: number, quantity: number): number {
    const produit = this.produitsDeCaisseCache.get(articleId);
    if (produit) {
      const prixUnitaire = produit.prix_vente_TTC || 0;
      const quantite = quantity / 1000; // Convert to kg
      return prixUnitaire * quantite;
    }
    return 0;
  }

  getContrastColor(hexColor: string): string {
    // Remove # if present
    const color = hexColor.replace('#', '');
    
    // Convert to RGB
    const r = parseInt(color.substr(0, 2), 16);
    const g = parseInt(color.substr(2, 2), 16);
    const b = parseInt(color.substr(4, 2), 16);
    
    // Calculate luminance
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    
    // Return black for light colors, white for dark colors
    return luminance > 0.5 ? '#000000' : '#ffffff';
  }

  showDocumentTypeSelection(): void {
    if (this.scannedItems.length === 0) {
      this.showError('Veuillez scanner au moins un produit avant de continuer');
      return;
    }
    this.showDocumentTypeModal = true;
  }

  closeDocumentTypeModal(): void {
    this.showDocumentTypeModal = false;
  }

  closeInvoiceNumberModal(): void {
    this.showInvoiceNumberModal = false;
    this.invoiceNumber = '';
    this.selectedDocumentType = null;
  }

  confirmInvoiceNumber(): void {
    if (!this.invoiceNumber.trim()) {
      this.error = 'Veuillez saisir un numéro de facture';
      setTimeout(() => { this.error = ''; }, 3000);
      return;
    }
    
    this.showInvoiceNumberModal = false;
    
    // Continue with the document configuration flow
    if (this.selectedDocumentType) {
      this.loadDocumentTypeDefaults(this.selectedDocumentType);
    }
  }

  selectDocumentType(type: 'livraison' | 'sortie' | 'transfert' | 'facture'): void {
    this.selectedDocumentType = type;
    this.closeDocumentTypeModal();
    this.resetDocumentConfig();
    
    // Apply defaults immediately (synchronously)
    this.applyDocumentTypeDefaults(type);
    
    // If facture is selected, show invoice number modal first
    if (type === 'facture') {
      this.showInvoiceNumberModal = true;
      return;
    }
    
    // Then try to load from server settings (asynchronously)
    this.loadDocumentTypeDefaults(type);
  }

  private resetDocumentConfig(): void {
    this.documentConfig = {
      client: false,
      depot: false,
      vehicle: false,
      driver: false,
      manualDestination: false,
      autoInvoice: false,
      tvaAndPrix: false
    };
    this.selectedClient = null;
    this.selectedDepot = null;
    this.selectedVehicle = null;
    this.selectedDriver = null;
    this.manualDestination = '';
    
    // Close all modals
    this.showClientSelectionModal = false;
    this.showDepotSelectionModal = false;
    this.showVehicleSelectionModal = false;
    this.showDriverSelectionModal = false;
    this.showManualDestinationModal = false;
  }

  private applyDocumentTypeDefaults(type: 'livraison' | 'sortie' | 'transfert' | 'facture'): void {
    console.log('Applying document type defaults for:', type);
    
    // Define default configurations for each document type
    const defaultConfigs = {
      livraison: {
        client: true,
        depot: false,
        vehicle: true,
        driver: true,
        manualDestination: false,
        autoInvoice: false,
        tvaAndPrix: true
      },
      sortie: {
        client: false,
        depot: true,
        vehicle: false,
        driver: false,
        manualDestination: false,
        autoInvoice: false,
        tvaAndPrix: true
      },
      transfert: {
        client: false,
        depot: true,
        vehicle: true,
        driver: true,
        manualDestination: false,
        autoInvoice: false,
        tvaAndPrix: false
      },
      facture: {
        client: true,
        depot: false,
        vehicle: false,
        driver: false,
        manualDestination: false,
        autoInvoice: true,
        tvaAndPrix: true
      }
    };

    // Apply the defaults immediately
    const defaults = defaultConfigs[type];
    console.log('Applying defaults for', type, ':', defaults);
    
    this.documentConfig = {
      client: defaults.client,
      depot: defaults.depot,
      vehicle: defaults.vehicle,
      driver: defaults.driver,
      manualDestination: defaults.manualDestination,
      autoInvoice: defaults.autoInvoice,
      tvaAndPrix: defaults.tvaAndPrix
    };
    
    console.log('Document config after applying defaults:', this.documentConfig);
  }

  private loadDocumentTypeDefaults(type: 'livraison' | 'sortie' | 'transfert' | 'facture'): void {
    console.log('Loading document type defaults from server for:', type);
    
    // Try to load settings from server to override defaults
    this.settingsService.getSettings().subscribe({
      next: (settings) => {
        console.log('Settings loaded:', settings);
        console.log('Document type defaults from server:', settings?.documentTypeDefaults);
        console.log('Specific type defaults from server:', settings?.documentTypeDefaults?.[type]);
        
        if (settings?.documentTypeDefaults?.[type]) {
          const serverDefaults = settings.documentTypeDefaults[type];
          console.log('Overriding with server defaults:', serverDefaults);
          this.documentConfig = {
            client: serverDefaults.client || false,
            depot: serverDefaults.depot || false,
            vehicle: serverDefaults.vehicle || false,
            driver: serverDefaults.driver || false,
            manualDestination: serverDefaults.manualDestination || false,
            autoInvoice: serverDefaults.autoInvoice || false,
            tvaAndPrix: serverDefaults.tvaAndPrix || false
          };
        }
        console.log('Final document config after server override:', this.documentConfig);
        // Open the configuration modal after settings are loaded
        this.openDocumentConfigurationModal();
      },
      error: (error) => {
        console.error('Error loading document type defaults:', error);
        console.log('Using default configuration due to error:', this.documentConfig);
        // Still open the modal with default values
        this.openDocumentConfigurationModal();
      }
    });
  }

  private loadClients(): void {
    this.clientsService.getClients().subscribe({
      next: (response) => {
        this.clients = response.clients || [];
      },
      error: (error) => {
        console.error('Error loading clients:', error);
      }
    });
  }

  private loadDepots(): void {
    this.depotsService.list().subscribe({
      next: (depots) => {
        this.depots = depots.filter((d: any) => d.isActive);
      },
      error: (error) => {
        console.error('Error loading depots:', error);
      }
    });
  }

  private loadVehicles(): void {
    this.vehiclesService.getActiveVehicles().subscribe({
      next: (vehicles) => {
        this.vehicles = vehicles;
      },
      error: (error) => {
        console.error('Error loading vehicles:', error);
      }
    });
  }

  private loadDrivers(): void {
    this.driversService.getActiveDrivers().subscribe({
      next: (drivers) => {
        this.drivers = drivers;
      },
      error: (error) => {
        console.error('Error loading drivers:', error);
      }
    });
  }

  // Document Configuration Methods
  openDocumentConfigurationModal(): void {
    this.showDocumentConfigurationModal = true;
  }

  closeDocumentConfigurationModal(): void {
    this.showDocumentConfigurationModal = false;
    // Don't reset document config here - it should be preserved for the next steps
    // this.selectedDocumentType = null; // Also don't reset the selected type
    // this.resetDocumentConfig(); // This was causing the issue
  }

  toggleConfigOption(option: keyof typeof this.documentConfig): void {
    this.documentConfig[option] = !this.documentConfig[option];
    
    // Clear related selections when unchecked
    if (!this.documentConfig[option]) {
      switch (option) {
        case 'client':
          this.selectedClient = null;
          break;
        case 'depot':
          this.selectedDepot = null;
          break;
        case 'vehicle':
          this.selectedVehicle = null;
          break;
        case 'driver':
          this.selectedDriver = null;
          break;
        case 'manualDestination':
          this.manualDestination = '';
          break;
      }
    }
  }

  proceedToSelections(): void {
    console.log('proceedToSelections called');
    console.log('documentConfig:', this.documentConfig);
    console.log('selectedDocumentType:', this.selectedDocumentType);
    
    this.closeDocumentConfigurationModal();
    
    // Show selection modals based on configuration in sequence
    // Start with the first required selection
    this.proceedToNextSelection();
  }

  private proceedToNextSelection(): void {
    console.log('proceedToNextSelection called');
    console.log('documentConfig:', this.documentConfig);
    console.log('selectedClient:', this.selectedClient);
    console.log('selectedDepot:', this.selectedDepot);
    console.log('selectedVehicle:', this.selectedVehicle);
    console.log('selectedDriver:', this.selectedDriver);
    console.log('manualDestination:', this.manualDestination);
    
    // Check what selections are still needed in order
    if (this.documentConfig.client && !this.selectedClient) {
      console.log('Opening client selection modal');
      this.showClientSelectionModal = true;
    } else if (this.documentConfig.depot && !this.selectedDepot) {
      console.log('Opening depot selection modal');
      this.showDepotSelectionModal = true;
    } else if (this.documentConfig.vehicle && !this.selectedVehicle) {
      console.log('Opening vehicle selection modal');
      this.showVehicleSelectionModal = true;
    } else if (this.documentConfig.driver && !this.selectedDriver) {
      console.log('Opening driver selection modal');
      this.showDriverSelectionModal = true;
    } else if (this.documentConfig.manualDestination && !this.manualDestination) {
      console.log('Opening manual destination modal');
      this.showManualDestinationModal = true;
    } else {
      console.log('All selections completed, generating document');
      // All selections completed, generate document
      this.generateDocument();
    }
  }

  // Client Selection Methods
  closeClientSelectionModal(): void {
    this.showClientSelectionModal = false;
    // Continue to next selection if needed
    this.proceedToNextSelection();
  }

  selectClient(client: any): void {
    this.selectedClient = client;
    this.closeClientSelectionModal();
  }

  // Depot Selection Methods
  closeDepotSelectionModal(): void {
    this.showDepotSelectionModal = false;
    this.proceedToNextSelection();
  }

  selectDepot(depot: any): void {
    this.selectedDepot = depot;
    this.closeDepotSelectionModal();
  }

  // Vehicle Selection Methods
  closeVehicleSelectionModal(): void {
    this.showVehicleSelectionModal = false;
    this.proceedToNextSelection();
  }

  selectVehicle(vehicle: any): void {
    this.selectedVehicle = vehicle;
    this.closeVehicleSelectionModal();
  }

  // Driver Selection Methods
  closeDriverSelectionModal(): void {
    this.showDriverSelectionModal = false;
    this.proceedToNextSelection();
  }

  selectDriver(driver: any): void {
    this.selectedDriver = driver;
    this.closeDriverSelectionModal();
  }

  // Manual Destination Methods
  closeManualDestinationModal(): void {
    this.showManualDestinationModal = false;
    this.proceedToNextSelection();
  }

  confirmManualDestination(): void {
    if (this.manualDestination.trim()) {
      this.closeManualDestinationModal();
    }
  }

  // Document Generation
  private generateDocument(): void {
    console.log('generateDocument called');
    this.loading = true;
    this.error = '';
    this.success = '';

    const documentData = this.prepareDocumentData();
    console.log('Sending document data to server:', documentData);

    this.stockDocumentsService.createDocument(documentData).subscribe({
      next: (savedDocument) => {
        console.log('Document created successfully:', savedDocument);
        this.loading = false;
        this.success = `Document ${savedDocument.numero} créé avec succès!`;
        
        // Open the document for printing
        this.openDocumentForPrint(savedDocument);
        
        // Clear scanned items and reset
        this.clearScannedItems();
        this.resetDocumentConfig();
        this.selectedDocumentType = null;
        
        setTimeout(() => { this.success = ''; }, 3000);
      },
      error: (error) => {
        console.error('Error creating document:', error);
        this.loading = false;
        this.error = 'Erreur lors de la création du document: ' + (error?.message || 'Erreur inconnue');
        setTimeout(() => { this.error = ''; }, 5000);
      }
    });
  }

  private openDocumentForPrint(document: any): void {
    console.log('Opening document for print:', document);
    
    // Navigate to the generic document details page for printing
    // This will open the document in a new tab/window for printing
    const documentUrl = `/stock/documents/${document.id}`;
    
    // Open in new tab for printing
    window.open(documentUrl, '_blank');
  }

  private prepareDocumentData(): any {
    const documentType = this.getDocumentTypeForAPI();
    
    const documentData: any = {
      type: documentType,
      numero: this.invoiceNumber && this.selectedDocumentType === 'facture' ? this.invoiceNumber : undefined,
      depotId: this.selectedDepot?.id || 1, // Use selected depot or default
      status: 'COMPLETED',
      items: this.scannedItems.map(item => {
        const produit = this.produitsDeCaisseCache.get(item.articleId);
        const parentProductId = produit?.parentProductId || item.articleId;
        const parentProduct = this.productsCache.get(parentProductId);
        
        const baseItem = {
          productId: item.articleId, // Save individual child product ID
          quantity: item.quantity / 1000, // Convert to kg
          count: item.count,
          famille: parentProduct?.famille || parentProduct?.name || 'Produit scanné',
          parentProductId: parentProductId, // Add parent reference for grouping
          childProductName: produit?.name || `CHILDREN ${item.articleId}` // Add child name for display
        };
        
        // Always include price fields if produit exists
        if (produit) {
          const prixUnitaire = produit.prix_vente_TTC || 0;
          const tva = produit.tva || 19;
          const quantite = item.quantity / 1000; // Convert to kg
          const montantTTC = prixUnitaire * quantite;
          const montantHT = montantTTC / (1 + tva / 100);
          const montantTVA = montantTTC - montantHT;
          
          return {
            ...baseItem,
            prixUnitaire: prixUnitaire,
            tva: tva,
            montantHT: montantHT,
            montantTVA: montantTVA,
            montantTTC: montantTTC
          };
        }
        
        return baseItem;
      })
    };

    // Add specific data based on configuration
    if (this.selectedClient) {
      documentData.clientId = this.selectedClient.id;
    }
    if (this.selectedDepot) {
      documentData.destinationDepotId = this.selectedDepot.id;
    }
    if (this.selectedVehicle) {
      documentData.vehicleId = this.selectedVehicle.id;
    }
    if (this.selectedDriver) {
      documentData.driverId = this.selectedDriver.id;
    }
    if (this.manualDestination) {
      documentData.destination = this.manualDestination;
    }
    if (this.invoiceNumber && this.selectedDocumentType === 'facture') {
      documentData.invoiceNumber = this.invoiceNumber;
    }

    // Add notes if any configuration is selected
    const notes = [];
    if (this.selectedClient) {
      notes.push(`Client: ${this.selectedClient.firstName} ${this.selectedClient.lastName}`);
    }
    if (this.selectedVehicle) {
      const vehicleName = this.selectedVehicle.brand && this.selectedVehicle.model 
        ? `${this.selectedVehicle.brand} ${this.selectedVehicle.model}`
        : this.selectedVehicle.name || 'Véhicule sélectionné';
      notes.push(`Véhicule: ${vehicleName}`);
    }
    if (this.selectedDriver) {
      const driverName = this.selectedDriver.firstName && this.selectedDriver.lastName
        ? `${this.selectedDriver.firstName} ${this.selectedDriver.lastName}`
        : this.selectedDriver.name || 'Chauffeur sélectionné';
      notes.push(`Chauffeur: ${driverName}`);
    }
    if (this.manualDestination) {
      notes.push(`Destination: ${this.manualDestination}`);
    }
    if (this.invoiceNumber && this.selectedDocumentType === 'facture') {
      notes.push(`Numéro de facture: ${this.invoiceNumber}`);
    }
    
    if (notes.length > 0) {
      documentData.notes = notes.join(' | ');
    }

    return documentData;
  }

  private getDocumentTypeForAPI(): string {
    switch (this.selectedDocumentType) {
      case 'livraison':
        return 'BON_ENTREE_MAGASIN';
      case 'sortie':
        return 'BON_EXPEDITION';
      case 'transfert':
        return 'BON_TRANSFERT';
      case 'facture':
        return 'FACTURE';
      default:
        return 'BON_ENTREE_DEPOT';
    }
  }

  getDocumentTypeLabel(): string {
    switch (this.selectedDocumentType) {
      case 'livraison':
        return 'Bon de Livraison';
      case 'sortie':
        return 'Bon de Sortie';
      case 'transfert':
        return 'Bon de Transfert';
      case 'facture':
        return 'Facture';
      default:
        return 'Document';
    }
  }

  private scrollToScannedItem(articleId: number): void {
    // Find the scanned items container
    const container = document.querySelector('.space-y-4');
    if (!container) return;

    // Find the specific item that was just scanned
    const itemElement = container.querySelector(`[data-article-id="${articleId}"]`);
    if (!itemElement) return;

    // Scroll to the item with smooth behavior
    itemElement.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
      inline: 'nearest'
    });

    // Add a temporary highlight effect
    itemElement.classList.add('ring-2', 'ring-blue-500', 'ring-opacity-50');
    setTimeout(() => {
      itemElement.classList.remove('ring-2', 'ring-blue-500', 'ring-opacity-50');
    }, 2000);
  }

  private loadSettings(): void {
    this.settingsService.getSettings().subscribe({
      next: (settings) => {
        // Settings are loaded and available for use
        // The loadDocumentTypeDefaults method will be called when a document type is selected
        console.log('Settings loaded successfully');
      },
      error: (error) => {
        console.error('Error loading settings:', error);
      }
    });
  }
}