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
import { SessionsService } from '../core/services/sessions.service';
import { AuthService } from '../core/services/auth.service';
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
    colisCount: number;
    lastScanned: Date;
    individualScans: Array<{
      id: string;
      quantity: number;
      timestamp: Date;
      barcode: string;
    }>;
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
    tvaAndPrix: false,
    validity: false
  };

  // Selection modals
  showClientSelectionModal = false;
  showDepotSelectionModal = false;
  showVehicleSelectionModal = false;
  showDriverSelectionModal = false;
  showManualDestinationModal = false;
  showInvoiceNumberModal = false;
  showValidityModal = false;
  showScanDetailsModal = false;
  selectedProductForDetails: any = null;
  showQuantityEditModal = false;
  selectedScanForEdit: any = null;
  editedQuantity = '';
  shouldClearOnFirstTap = false;
  showColisEditModal = false;
  selectedProductForColisEdit: any = null;
  editedColisCount = '';
  shouldClearColisOnFirstTap = false;
  
  // Selected values
  selectedClient: any = null;
  selectedDepot: any = null;
  selectedVehicle: any = null;
  selectedDriver: any = null;
  manualDestination = '';
  invoiceNumber = '';
  validityFromDate = '';
  validityToDate = '';
  
  // Data for selections
  clients: any[] = [];
  depots: any[] = [];
  vehicles: any[] = [];
  drivers: any[] = [];
  currentDepotId: number | null = null;
  currentDepot: any = null;
  currentSettings: any = null;

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
    private settingsService: SettingsService,
    private sessionsService: SessionsService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.initializeSounds();
    this.focusInput();
    this.loadProducts();
    this.loadProduitsDeCaisse();
    this.loadClients();
    this.loadCurrentDepot();
    this.loadDepots();
    this.loadVehicles();
    this.loadDrivers();
    this.loadSettings();
    
    // Also try to get the active session directly
    this.sessionsService.getActiveSession().subscribe({
      next: (session) => {
        console.log('Active session from getActiveSession:', session);
        console.log('Session depotId:', session?.depotId);
        console.log('Session depot:', session?.depot);
        console.log('Full session object:', JSON.stringify(session, null, 2));
        
        if (session && session.depotId) {
          this.currentDepotId = session.depotId;
          if (session.depot) {
            this.currentDepot = session.depot;
          } else {
            this.loadDepotById(session.depotId);
          }
        } else {
          console.log('No session or no depotId found');
          // Try to get depot from user or other sources
          this.tryAlternativeDepotLoading();
        }
      },
      error: (error) => {
        console.error('Error getting active session:', error);
        this.tryAlternativeDepotLoading();
      }
    });
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
           this.showInvoiceNumberModal ||
           this.showValidityModal ||
           this.showScanDetailsModal ||
           this.showQuantityEditModal ||
           this.showColisEditModal;
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
    // this.searchProductByBarcode("1234002891011")
    // this.searchProductByBarcode("1234003891011")
    // this.searchProductByBarcode("1234004891011")
    // this.searchProductByBarcode("1234005891011")
    // this.searchProductByBarcode("1234006891011")
    // this.searchProductByBarcode("1234007891011")
    // this.searchProductByBarcode("1234008891011")
    // this.searchProductByBarcode("1234009891011")
    // this.searchProductByBarcode("1234010891011")
    // this.searchProductByBarcode("1234011891011")
    // this.searchProductByBarcode("1234012891011")
    // this.searchProductByBarcode("1234013891011")
    // this.searchProductByBarcode("1234014891011")
    // this.searchProductByBarcode("1234015891011")
    // this.searchProductByBarcode("1234016891011")
    // this.searchProductByBarcode("1234017891011")
    // this.searchProductByBarcode("1234018891011")
    // this.searchProductByBarcode("1234019891011")
    // this.searchProductByBarcode("1234020891011")
    // this.searchProductByBarcode("1234021891011")
    // this.searchProductByBarcode("1234022891011")
    // this.searchProductByBarcode("1234023891011")
    // this.searchProductByBarcode("1234024891011")
    // this.searchProductByBarcode("1234025891011")
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
      
      // Create individual scan entry
      const individualScan = {
        id: `${articleId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        quantity: quantity,
        timestamp: new Date(),
        barcode: barcode
      };
      
      // Find existing item or create new one
      const existingItemIndex = this.scannedItems.findIndex(item => item.articleId === articleId);
      
      if (existingItemIndex >= 0) {
        // Update existing item - add quantity and increment count
        this.scannedItems[existingItemIndex].quantity += quantity;
        this.scannedItems[existingItemIndex].count += 1;
        this.scannedItems[existingItemIndex].colisCount += 1; // Increment colis count
        this.scannedItems[existingItemIndex].lastScanned = new Date();
        this.scannedItems[existingItemIndex].individualScans.push(individualScan);
        this.success = `${productName} scanné (${this.scannedItems[existingItemIndex].count}x, Qty: ${this.scannedItems[existingItemIndex].quantity}g)`;
      } else {
        // Add new item
        this.scannedItems.push({
          articleId: articleId, // Keep original articleId, not parent
          productName: productName,
          quantity,
          count: 1,
          colisCount: 1, // Initialize colis count to 1
          lastScanned: new Date(),
          individualScans: [individualScan]
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

  // Scan Details Modal Methods
  showScanDetails(product: any): void {
    this.selectedProductForDetails = product;
    this.showScanDetailsModal = true;
  }

  closeScanDetailsModal(): void {
    this.showScanDetailsModal = false;
    this.selectedProductForDetails = null;
  }

  removeIndividualScan(articleId: number, scanId: string): void {
    const itemIndex = this.scannedItems.findIndex(item => item.articleId === articleId);
    if (itemIndex >= 0) {
      const scanIndex = this.scannedItems[itemIndex].individualScans.findIndex(scan => scan.id === scanId);
      if (scanIndex >= 0) {
        const removedScan = this.scannedItems[itemIndex].individualScans[scanIndex];
        
        // Remove the individual scan
        this.scannedItems[itemIndex].individualScans.splice(scanIndex, 1);
        
        // Update totals
        this.scannedItems[itemIndex].quantity -= removedScan.quantity;
        this.scannedItems[itemIndex].count -= 1;
        this.scannedItems[itemIndex].colisCount -= 1; // Decrement colis count
        
        // Update last scanned time
        if (this.scannedItems[itemIndex].individualScans.length > 0) {
          this.scannedItems[itemIndex].lastScanned = this.scannedItems[itemIndex].individualScans
            .reduce((latest, scan) => scan.timestamp > latest ? scan.timestamp : latest, new Date(0));
        }
        
        // Update the selectedProductForDetails object to reflect the changes immediately
        if (this.selectedProductForDetails) {
          // Remove the scan from selectedProductForDetails
          this.selectedProductForDetails.individualScans = this.selectedProductForDetails.individualScans.filter((scan: any) => scan.id !== scanId);
          
          // Update the total quantity, count, and colis count in selectedProductForDetails
          this.selectedProductForDetails.quantity = this.scannedItems[itemIndex].quantity;
          this.selectedProductForDetails.count = this.scannedItems[itemIndex].count;
          this.selectedProductForDetails.colisCount = this.scannedItems[itemIndex].colisCount;
        }
        
        // Remove the entire item if no scans remain
        if (this.scannedItems[itemIndex].individualScans.length === 0) {
          this.scannedItems.splice(itemIndex, 1);
          this.closeScanDetailsModal();
        }
        
        this.success = `Scan supprimé (${(removedScan.quantity/1000).toFixed(3)}kg)`;
        setTimeout(() => { this.success = ''; }, 3000);
      }
    }
  }

  // Quantity Edit Modal Methods
  editScanQuantity(articleId: number, scanId: string): void {
    const itemIndex = this.scannedItems.findIndex(item => item.articleId === articleId);
    if (itemIndex >= 0) {
      const scanIndex = this.scannedItems[itemIndex].individualScans.findIndex(scan => scan.id === scanId);
      if (scanIndex >= 0) {
        this.selectedScanForEdit = {
          articleId: articleId,
          scanIndex: scanIndex,
          itemIndex: itemIndex,
          currentQuantity: this.scannedItems[itemIndex].individualScans[scanIndex].quantity
        };
        this.editedQuantity = (this.scannedItems[itemIndex].individualScans[scanIndex].quantity / 1000).toFixed(3);
        this.shouldClearOnFirstTap = true; // Set flag to clear on first tap
        this.showQuantityEditModal = true;
      }
    }
  }

  closeQuantityEditModal(): void {
    this.showQuantityEditModal = false;
    this.selectedScanForEdit = null;
    this.editedQuantity = '';
    this.shouldClearOnFirstTap = false; // Reset flag
  }

  updateQuantity(): void {
    if (!this.selectedScanForEdit || !this.editedQuantity.trim()) {
      this.showError('Veuillez saisir une quantité valide');
      return;
    }

    const newQuantity = parseFloat(this.editedQuantity);
    if (isNaN(newQuantity) || newQuantity <= 0) {
      this.showError('La quantité doit être un nombre positif');
      return;
    }

    const newQuantityInGrams = Math.round(newQuantity * 1000);
    const itemIndex = this.selectedScanForEdit.itemIndex;
    const scanIndex = this.selectedScanForEdit.scanIndex;
    const oldQuantity = this.selectedScanForEdit.currentQuantity;

    // Update the individual scan quantity
    this.scannedItems[itemIndex].individualScans[scanIndex].quantity = newQuantityInGrams;

    // Update the total quantity for the item
    this.scannedItems[itemIndex].quantity = this.scannedItems[itemIndex].quantity - oldQuantity + newQuantityInGrams;

    // Update the selectedProductForDetails object to reflect the changes immediately
    if (this.selectedProductForDetails) {
      // Find the scan in the selectedProductForDetails and update it
      const scanToUpdate = this.selectedProductForDetails.individualScans.find((scan: any) => scan.id === this.scannedItems[itemIndex].individualScans[scanIndex].id);
      if (scanToUpdate) {
        scanToUpdate.quantity = newQuantityInGrams;
      }
      
      // Update the total quantity in selectedProductForDetails
      this.selectedProductForDetails.quantity = this.scannedItems[itemIndex].quantity;
    }

    this.success = `Quantité modifiée: ${(oldQuantity/1000).toFixed(3)}kg → ${(newQuantityInGrams/1000).toFixed(3)}kg`;
    setTimeout(() => { this.success = ''; }, 3000);

    this.closeQuantityEditModal();
  }

  // Numpad methods
  addDigit(digit: string): void {
    if (this.shouldClearOnFirstTap) {
      // Clear the current value and start fresh
      this.editedQuantity = digit;
      this.shouldClearOnFirstTap = false; // Reset flag after first tap
    } else if (this.editedQuantity.length < 10) { // Limit to reasonable length
      this.editedQuantity += digit;
    }
  }

  removeLastDigit(): void {
    this.editedQuantity = this.editedQuantity.slice(0, -1);
  }

  clearQuantity(): void {
    this.editedQuantity = '';
    this.shouldClearOnFirstTap = false; // Reset flag when manually clearing
  }

  addDecimalPoint(): void {
    if (this.shouldClearOnFirstTap) {
      // Clear the current value and start with decimal point
      this.editedQuantity = '0.';
      this.shouldClearOnFirstTap = false; // Reset flag after first tap
    } else if (!this.editedQuantity.includes('.')) {
      this.editedQuantity += '.';
    }
  }

  // Colis Edit Modal Methods
  editColisCount(product: any): void {
    this.selectedProductForColisEdit = product;
    this.editedColisCount = product.colisCount.toString();
    this.shouldClearColisOnFirstTap = true; // Set flag to clear on first tap
    this.showColisEditModal = true;
  }

  closeColisEditModal(): void {
    this.showColisEditModal = false;
    this.selectedProductForColisEdit = null;
    this.editedColisCount = '';
    this.shouldClearColisOnFirstTap = false; // Reset flag
  }

  updateColisCount(): void {
    if (!this.selectedProductForColisEdit || !this.editedColisCount.trim()) {
      this.showError('Veuillez saisir un nombre de colis valide');
      return;
    }

    const newColisCount = parseInt(this.editedColisCount, 10);
    if (isNaN(newColisCount) || newColisCount < 1) {
      this.showError('Le nombre de colis doit être un nombre entier positif');
      return;
    }

    const itemIndex = this.scannedItems.findIndex(item => item.articleId === this.selectedProductForColisEdit.articleId);
    if (itemIndex >= 0) {
      const oldColisCount = this.scannedItems[itemIndex].colisCount;
      this.scannedItems[itemIndex].colisCount = newColisCount;

      // Update the selectedProductForDetails object to reflect the changes immediately
      if (this.selectedProductForDetails) {
        this.selectedProductForDetails.colisCount = newColisCount;
      }

      this.success = `Nombre de colis modifié: ${oldColisCount} → ${newColisCount}`;
      setTimeout(() => { this.success = ''; }, 3000);
    }

    this.closeColisEditModal();
  }

  // Colis Numpad methods
  addColisDigit(digit: string): void {
    if (this.shouldClearColisOnFirstTap) {
      // Clear the current value and start fresh
      this.editedColisCount = digit;
      this.shouldClearColisOnFirstTap = false; // Reset flag after first tap
    } else if (this.editedColisCount.length < 3) { // Limit to reasonable length for colis count
      this.editedColisCount += digit;
    }
  }

  removeLastColisDigit(): void {
    this.editedColisCount = this.editedColisCount.slice(0, -1);
  }

  clearColisCount(): void {
    this.editedColisCount = '';
    this.shouldClearColisOnFirstTap = false; // Reset flag when manually clearing
  }

  // Helper method to get the most recent scan timestamp
  getMostRecentScanTimestamp(): Date | null {
    if (!this.selectedProductForDetails || !this.selectedProductForDetails.individualScans || this.selectedProductForDetails.individualScans.length === 0) {
      return null;
    }
    
    return this.selectedProductForDetails.individualScans.reduce((latest: Date, scan: any) => {
      return scan.timestamp > latest ? scan.timestamp : latest;
    }, new Date(0));
  }

  // Helper method to check if a scan is the most recent one
  isMostRecentScan(scan: any): boolean {
    const mostRecentTimestamp = this.getMostRecentScanTimestamp();
    return mostRecentTimestamp !== null && scan.timestamp.getTime() === mostRecentTimestamp.getTime();
  }

  // Helper method to get the globally most recent scan timestamp across all products
  getGlobalMostRecentScanTimestamp(): Date | null {
    if (this.scannedItems.length === 0) {
      return null;
    }
    
    let globalMostRecent = new Date(0);
    
    this.scannedItems.forEach(item => {
      if (item.individualScans && item.individualScans.length > 0) {
        const itemMostRecent = item.individualScans.reduce((latest: Date, scan: any) => {
          return scan.timestamp > latest ? scan.timestamp : latest;
        }, new Date(0));
        
        if (itemMostRecent > globalMostRecent) {
          globalMostRecent = itemMostRecent;
        }
      }
    });
    
    return globalMostRecent.getTime() > 0 ? globalMostRecent : null;
  }

  // Helper method to check if a scan is the globally most recent one
  isGlobalMostRecentScan(scan: any): boolean {
    const globalMostRecentTimestamp = this.getGlobalMostRecentScanTimestamp();
    return globalMostRecentTimestamp !== null && scan.timestamp.getTime() === globalMostRecentTimestamp.getTime();
  }

  // Helper method to check if a product has the most recent scan
  hasMostRecentScan(subProduct: any): boolean {
    if (!subProduct.individualScans || subProduct.individualScans.length === 0) {
      return false;
    }
    
    const globalMostRecentTimestamp = this.getGlobalMostRecentScanTimestamp();
    if (!globalMostRecentTimestamp) {
      return false;
    }
    
    return subProduct.individualScans.some((scan: any) => 
      scan.timestamp.getTime() === globalMostRecentTimestamp.getTime()
    );
  }

  getGroupedScannedItems(): Array<{
    mainProduct: Product | null;
    subProducts: Array<{
      articleId: number;
      productName: string;
      quantity: number;
      count: number;
      colisCount: number;
      lastScanned: Date;
      color?: string;
      individualScans: Array<{
        id: string;
        quantity: number;
        timestamp: Date;
        barcode: string;
      }>;
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
      colisCount: number;
      lastScanned: Date;
      color?: string;
      individualScans: Array<{
        id: string;
        quantity: number;
        timestamp: Date;
        barcode: string;
      }>;
    }>;
    totalQuantity: number;
    totalPrice: number;
  }> {
    const groups = new Map<number, Array<{
      articleId: number;
      productName: string;
      quantity: number;
      count: number;
      colisCount: number;
      lastScanned: Date;
      color?: string;
      individualScans: Array<{
        id: string;
        quantity: number;
        timestamp: Date;
        barcode: string;
      }>;
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
        colisCount: number;
        lastScanned: Date;
        color?: string;
        individualScans: Array<{
          id: string;
          quantity: number;
          timestamp: Date;
          barcode: string;
        }>;
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
      tvaAndPrix: false,
      validity: false
    };
    this.selectedClient = null;
    this.selectedDepot = null;
    this.selectedVehicle = null;
    this.selectedDriver = null;
    this.manualDestination = '';
    this.validityFromDate = '';
    this.validityToDate = '';
    
    // Close all modals
    this.showClientSelectionModal = false;
    this.showDepotSelectionModal = false;
    this.showVehicleSelectionModal = false;
    this.showDriverSelectionModal = false;
    this.showManualDestinationModal = false;
    this.showValidityModal = false;
  }

  private cancelDocumentCreation(): void {
    // Reset all document creation state
    this.resetDocumentConfig();
    this.selectedDocumentType = null;
    this.invoiceNumber = '';
    
    // Close all document-related modals
    this.showDocumentTypeModal = false;
    this.showDocumentConfigurationModal = false;
    this.showInvoiceNumberModal = false;
    
    // Show a message to the user
    this.success = 'Création de document annulée';
    setTimeout(() => { this.success = ''; }, 3000);
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
        tvaAndPrix: false,
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
      tvaAndPrix: defaults.tvaAndPrix,
      validity: defaults.validity
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
          const serverDefaults = settings.documentTypeDefaults[type] as any;
          console.log('Overriding with server defaults:', serverDefaults);
          this.documentConfig = {
            client: serverDefaults.client || false,
            depot: serverDefaults.depot || false,
            vehicle: serverDefaults.vehicle || false,
            driver: serverDefaults.driver || false,
            manualDestination: serverDefaults.manualDestination || false,
            autoInvoice: serverDefaults.autoInvoice || false,
            tvaAndPrix: serverDefaults.tvaAndPrix || false,
            validity: serverDefaults.validity || false
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

  private loadCurrentDepot(): void {
    // First try to get the current session directly
    const currentSession = this.sessionsService.currentSession();
    console.log('Direct current session:', currentSession);
    
    if (currentSession && currentSession.depotId) {
      this.currentDepotId = currentSession.depotId;
      console.log('Current depot ID from direct session:', this.currentDepotId);
      if (currentSession.depot) {
        this.currentDepot = currentSession.depot;
        console.log('Current depot from direct session:', this.currentDepot);
      } else {
        this.loadDepotById(currentSession.depotId);
      }
    }

    // Also subscribe to changes
    this.sessionsService.currentSession$.subscribe({
      next: (session) => {
        console.log('Current session from subscription:', session);
        if (session && session.depotId) {
          this.currentDepotId = session.depotId;
          console.log('Current depot ID from subscription:', this.currentDepotId);
          // Store the depot information from the session if available
          if (session.depot) {
            this.currentDepot = session.depot;
            console.log('Current depot from subscription:', this.currentDepot);
          } else {
            // If depot info is not in session, load it separately
            console.log('Loading depot by ID from subscription:', session.depotId);
            this.loadDepotById(session.depotId);
          }
        } else {
          console.log('No session or depot ID found in subscription');
        }
      },
      error: (error) => {
        console.error('Error loading current depot:', error);
      }
    });
  }

  private loadDepotById(depotId: number): void {
    this.depotsService.list().subscribe({
      next: (depots) => {
        console.log('All depots:', depots);
        const depot = depots.find((d: any) => d.id === depotId);
        console.log('Found depot:', depot);
        if (depot) {
          this.currentDepot = depot;
          console.log('Set current depot:', this.currentDepot);
        }
      },
      error: (error) => {
        console.error('Error loading depot by ID:', error);
      }
    });
  }

  private tryAlternativeDepotLoading(): void {
    console.log('Trying alternative depot loading methods...');
    
    // Try to get depot from user profile
    const currentUser = this.authService.currentUser();
    console.log('Current user from auth service:', currentUser);
    
    if (currentUser && currentUser.depotId) {
      console.log('Found depot ID in user profile:', currentUser.depotId);
      this.currentDepotId = currentUser.depotId;
      this.loadDepotById(this.currentDepotId);
      return;
    }
    
    // Try to get depot from localStorage
    const storedDepotId = localStorage.getItem('currentDepotId');
    if (storedDepotId) {
      console.log('Found depot ID in localStorage:', storedDepotId);
      this.currentDepotId = parseInt(storedDepotId);
      this.loadDepotById(this.currentDepotId);
      return;
    }
    
    // Try to get depot from ticket counter service localStorage
    const ticketStateKeys = Object.keys(localStorage).filter(key => key.startsWith('pos_ticket_state_depot_'));
    if (ticketStateKeys.length > 0) {
      const depotIdFromTicket = ticketStateKeys[0].replace('pos_ticket_state_depot_', '');
      console.log('Found depot ID from ticket counter:', depotIdFromTicket);
      this.currentDepotId = parseInt(depotIdFromTicket);
      this.loadDepotById(this.currentDepotId);
      return;
    }
    
    console.log('No alternative depot sources found');
    
    // If no depot found, try to get the first available depot as fallback
    this.depotsService.list().subscribe({
      next: (depots) => {
        const activeDepots = depots.filter((d: any) => d.isActive);
        if (activeDepots.length > 0) {
          console.log('Using first available depot as fallback:', activeDepots[0]);
          this.currentDepotId = activeDepots[0].id;
          this.currentDepot = activeDepots[0];
        }
      },
      error: (error) => {
        console.error('Error loading fallback depot:', error);
      }
    });
  }

  private loadDepots(): void {
    this.depotsService.list().subscribe({
      next: (depots) => {
        this.depots = depots.filter((d: any) => {
          // Filter out inactive depots and the current depot
          return d.isActive && d.id !== this.currentDepotId;
        });
      },
      error: (error) => {
        console.error('Error loading depots:', error);
      }
    });
  }

  private loadDepotsForTransfer(): void {
    this.depotsService.list().subscribe({
      next: (depots) => {
        // For transfer documents, filter depots to show only those from the same enterprise
        // This assumes that depots with similar characteristics belong to the same enterprise
        this.depots = this.filterDepotsByEnterprise(depots);
      },
      error: (error) => {
        console.error('Error loading depots for transfer:', error);
      }
    });
  }

  private filterDepotsByEnterprise(allDepots: any[]): any[] {
    if (!this.currentDepot) {
      // If no current depot, return all active depots except current
      return allDepots.filter((d: any) => d.isActive && d.id !== this.currentDepotId);
    }

    // Get current depot characteristics for filtering
    const currentDepot = this.currentDepot;
    
    // Filter depots based on enterprise characteristics
    // This is a simplified approach - in a real system, you'd have explicit enterprise/company relationships
    const filteredDepots = allDepots.filter((d: any) => {
      // Basic filters
      if (!d.isActive || d.id === this.currentDepotId) {
        return false;
      }

      // For now, we'll use a simple approach:
      // - Include all MAIN type depots (they're usually central/enterprise level)
      // - Include depots that share similar characteristics with current depot
      // - Exclude depots that are clearly from different enterprises (different city, very different naming patterns)
      
      // Include MAIN type depots (enterprise level)
      if (d.type === 'MAIN') {
        return true;
      }

      // Include depots from the same city (likely same enterprise)
      if (currentDepot.city && d.city && currentDepot.city === d.city) {
        return true;
      }

      // Include depots with similar naming patterns (e.g., same prefix)
      if (currentDepot.name && d.name) {
        const currentPrefix = currentDepot.name.split(' ')[0];
        const depotPrefix = d.name.split(' ')[0];
        if (currentPrefix === depotPrefix && currentPrefix.length > 2) {
          return true;
        }
      }

      // Include BRANCH and SHOP types (likely same enterprise)
      if (d.type === 'BRANCH' || d.type === 'SHOP') {
        return true;
      }

      return false;
    });

    console.log('Filtered depots for transfer:', {
      currentDepot: currentDepot,
      totalDepots: allDepots.length,
      filteredDepots: filteredDepots.length,
      filteredDepotNames: filteredDepots.map(d => d.name)
    });

    return filteredDepots;
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
        case 'validity':
          this.validityFromDate = '';
          this.validityToDate = '';
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
      // Load appropriate depots based on document type
      if (this.selectedDocumentType === 'transfert') {
        this.loadDepotsForTransfer();
      } else {
        this.loadDepots();
      }
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
    } else if (this.documentConfig.validity && (!this.validityFromDate || !this.validityToDate)) {
      console.log('Opening validity modal');
      this.setDefaultValidityDates(); // Automatically set default dates
      this.showValidityModal = true;
    } else {
      console.log('All selections completed, generating document');
      // All selections completed, generate document
      this.generateDocument();
    }
  }

  // Client Selection Methods
  closeClientSelectionModal(): void {
    this.showClientSelectionModal = false;
    // Cancel the entire document creation process
    this.cancelDocumentCreation();
  }

  selectClient(client: any): void {
    this.selectedClient = client;
    this.showClientSelectionModal = false;
    this.proceedToNextSelection();
  }

  // Depot Selection Methods
  closeDepotSelectionModal(): void {
    this.showDepotSelectionModal = false;
    // Cancel the entire document creation process
    this.cancelDocumentCreation();
  }

  selectDepot(depot: any): void {
    this.selectedDepot = depot;
    this.showDepotSelectionModal = false;
    this.proceedToNextSelection();
  }

  // Vehicle Selection Methods
  closeVehicleSelectionModal(): void {
    this.showVehicleSelectionModal = false;
    // Cancel the entire document creation process
    this.cancelDocumentCreation();
  }

  selectVehicle(vehicle: any): void {
    this.selectedVehicle = vehicle;
    this.showVehicleSelectionModal = false;
    this.proceedToNextSelection();
  }

  // Driver Selection Methods
  closeDriverSelectionModal(): void {
    this.showDriverSelectionModal = false;
    // Cancel the entire document creation process
    this.cancelDocumentCreation();
  }

  selectDriver(driver: any): void {
    this.selectedDriver = driver;
    this.showDriverSelectionModal = false;
    this.proceedToNextSelection();
  }

  // Manual Destination Methods
  closeManualDestinationModal(): void {
    this.showManualDestinationModal = false;
    // Cancel the entire document creation process
    this.cancelDocumentCreation();
  }

  confirmManualDestination(): void {
    if (this.manualDestination.trim()) {
      this.showManualDestinationModal = false;
      this.proceedToNextSelection();
    }
  }

  // Validity Methods
  closeValidityModal(): void {
    this.showValidityModal = false;
    // Cancel the entire document creation process
    this.cancelDocumentCreation();
  }

  confirmValidity(): void {
    if (this.validityFromDate && this.validityToDate) {
      this.showValidityModal = false;
      this.proceedToNextSelection();
    }
  }

  setDefaultValidityDates(): void {
    const today = new Date();
    const threeDaysLater = new Date();
    threeDaysLater.setDate(today.getDate() + 3);
    
    this.validityFromDate = today.toISOString().split('T')[0];
    this.validityToDate = threeDaysLater.toISOString().split('T')[0];
  }

  // Document Generation
  private generateDocument(): void {
    console.log('generateDocument called');
    
    // Validate that we have the required depot information
    if (!this.currentDepotId) {
      this.error = 'Erreur: Impossible de déterminer le dépôt actuel. Veuillez vous reconnecter.';
      setTimeout(() => { this.error = ''; }, 5000);
      return;
    }
    
    this.loading = true;
    this.error = '';
    this.success = '';

    // Get the document type for number generation
    const documentType = this.getDocumentTypeForAPI();
    
    // Get next document number to avoid duplicates
    this.stockDocumentsService.getNextDocumentNumber(documentType).subscribe({
      next: (nextNumber) => {
        console.log('Next document number:', nextNumber);
        
        const documentData = this.prepareDocumentData();
        // Set the generated number if not already set (for non-facture documents)
        if (!documentData.numero) {
          documentData.numero = nextNumber;
        }
        
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
      },
      error: (error) => {
        console.error('Error getting next document number:', error);
        this.loading = false;
        this.error = 'Erreur lors de la génération du numéro de document';
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
    
    // Ensure we have a valid current depot ID
    const emetteurId = this.currentDepotId || 1;
    // For documents that don't require a destination depot, use the same depot as sender
    const destinataireId = this.selectedDepot?.id || emetteurId;
    
    console.log('Document data - emetteurId:', emetteurId, 'destinataireId:', destinataireId);
    console.log('Current depot:', this.currentDepot);
    console.log('Selected depot:', this.selectedDepot);
    
    const documentData: any = {
      type: documentType,
      numero: this.invoiceNumber && this.selectedDocumentType === 'facture' ? this.invoiceNumber : undefined,
      fromDepotId: emetteurId, // Use the server-expected field name
      destinationDepotId: destinataireId, // Use the server-expected field name
      status: this.selectedDepot && this.selectedDepot.id !== emetteurId ? 'SENT' : 'COMPLETED',
      items: this.scannedItems.map(item => {
        const produit = this.produitsDeCaisseCache.get(item.articleId);
        const parentProductId = produit?.parentProductId || item.articleId;
        const parentProduct = this.productsCache.get(parentProductId);
        
        const baseItem = {
          productId: parentProductId, // Use parent product ID for stock management
          quantity: item.quantity / 1000, // Convert to kg
          count: item.count,
          famille: parentProduct?.famille || parentProduct?.name || 'Produit scanné',
          parentProductId: parentProductId, // Add parent reference for grouping
          childProductName: produit?.name || `CHILDREN ${item.articleId}`, // Add child name for display
          childProductId: item.articleId // Keep child product ID for reference
        };
        
        // Always include price fields if produit exists
        if (produit) {
          const prixUnitaire = produit.prix_vente_TTC || 0;
          const tva = produit.tva || 19;
          const quantite = item.quantity / 1000; // Convert to kg
          const montantTTC = prixUnitaire * quantite;
          // Correct TVA calculation: HT = TTC / (1 + TVA), TVA = TTC - HT
          const tvaFraction = tva <= 1 ? tva : tva / 100;
          const montantHT = Math.round((montantTTC / (1 + tvaFraction)) * 1000) / 1000;
          const montantTVA = Math.round((montantTTC - montantHT) * 1000) / 1000;
          
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

    // Add enterprise information from current depot/settings
    if (this.currentSettings) {
      documentData.enterpriseInfo = {
        companyName: this.currentSettings.companyName,
        logoUrl: this.currentSettings.logoUrl,
        companyAddress: this.currentSettings.companyAddress,
        companyPhone: this.currentSettings.companyPhone,
        companyEmail: this.currentSettings.companyEmail,
        companyRC: this.currentSettings.companyRC,
        companyMF: this.currentSettings.companyMF
      };
    }

    // Add current depot information as sender
    if (this.currentDepot) {
      documentData.senderDepot = {
        id: this.currentDepot.id,
        name: this.currentDepot.name,
        code: this.currentDepot.code,
        address: this.currentDepot.address,
        city: this.currentDepot.city,
        phone: this.currentDepot.phone,
        email: this.currentDepot.email
      };
    }

    // Add destination depot information if different from sender
    if (this.selectedDepot && this.selectedDepot.id !== emetteurId) {
      documentData.destinationDepot = {
        id: this.selectedDepot.id,
        name: this.selectedDepot.name,
        code: this.selectedDepot.code,
        address: this.selectedDepot.address,
        city: this.selectedDepot.city,
        phone: this.selectedDepot.phone,
        email: this.selectedDepot.email
      };
    }

    // Add specific data based on configuration
    if (this.selectedClient) {
      documentData.clientId = this.selectedClient.id;
    }
    // Note: selectedDepot is already used as destinataireId above
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
    if (this.validityFromDate && this.validityToDate) {
      notes.push(`Validité du: ${new Date(this.validityFromDate).toLocaleDateString('fr-FR')} au: ${new Date(this.validityToDate).toLocaleDateString('fr-FR')}`);
    }
    
    if (notes.length > 0) {
      documentData.notes = notes.join(' | ');
    }

    // Add validity dates to document data
    if (this.validityFromDate && this.validityToDate) {
      documentData.validationFromDate = this.validityFromDate;
      documentData.validationToDate = this.validityToDate;
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
        this.currentSettings = settings;
        console.log('Settings loaded successfully:', settings);
      },
      error: (error) => {
        console.error('Error loading settings:', error);
      }
    });
  }
}