import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
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
import { WholesaleRulesService, WholesaleRule } from '../core/services/wholesale-rules.service';
import { Product } from '../core/models/product.model';
import { ProduitDeCaisse } from '../core/models/produit-de-caisse.model';
import { environment } from '../../environments/environment';

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
  
  // Manual Add Modals
  showManualAddModal = false;
  showProductSelectionModal = false;
  showManualQuantityModal = false;
  showManualColisModal = false;
  selectedProductForManualAdd: any = null;
  manualQuantity = '';
  manualColisCount = '';
  shouldClearManualQuantityOnFirstTap = false;
  shouldClearManualColisOnFirstTap = false;
  searchQuery = '';
  filteredProduitsDeCaisse: any[] = [];
  
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
  public productsCache = new Map<number, Product>();
  public produitsDeCaisseCache = new Map<number, ProduitDeCaisse>();
  
  // Wholesale rules for pricing
  private wholesaleRules: WholesaleRule[] = [];

  // Sound effects
  private beepSound: HTMLAudioElement | null = null;
  private successSound: HTMLAudioElement | null = null;
  private errorSound: HTMLAudioElement | null = null;

  constructor(
    private router: Router,
    private http: HttpClient,
    private productsService: ProductsService,
    private produitsDeCaisseService: ProduitsDeCaisseService,
    private clientsService: ClientsService,
    private depotsService: DepotsService,
    private vehiclesService: VehiclesService,
    private driversService: DriversService,
    private stockDocumentsService: StockDocumentsService,
    private settingsService: SettingsService,
    private sessionsService: SessionsService,
    private authService: AuthService,
    private wholesaleRulesService: WholesaleRulesService
  ) {}

  ngOnInit(): void {
    this.initializeSounds();
    this.focusInput();
    this.loadProducts();
    // Don't load produits de caisse here - wait for depot to be determined
    // It will be loaded in loadCurrentDepot() or tryAlternativeDepotLoading()
    this.loadClients();
    this.loadCurrentDepot();
    this.loadDepots();
    this.loadVehicles();
    this.loadDrivers();
    this.loadSettings();
    this.loadWholesaleRules();
    
    // Also try to get the active session directly
    this.sessionsService.getActiveSessionByDepot().subscribe({
      next: (session) => {
        if (session && session.depotId) {
          this.currentDepotId = session.depotId;
          if (session.depot) {
            this.currentDepot = session.depot;
          } else {
            this.loadDepotById(session.depotId);
          }
          // Reload produits de caisse with the correct depot ID
          this.loadProduitsDeCaisse();
        } else {
          // Try to get depot from user or other sources
          this.tryAlternativeDepotLoading();
        }
      },
      error: (error) => {
        console.error('Error getting active session:', error);
        this.tryAlternativeDepotLoading();
      }
    });

    // START FLOW: Always show document type selection on enter
    setTimeout(() => {
      this.showDocumentTypeSelection();
    }, 500);
  }

  ngOnDestroy(): void {
    this.cleanupSounds();
  }

  @HostListener('document:keydown', ['$event'])
  handleKeyDown(event: KeyboardEvent): void {
    // Don't process scanning input if any modal is open or no document type selected
    if (this.isAnyModalOpen() || !this.selectedDocumentType) {
      if (!this.selectedDocumentType && /^\d$/.test(event.key)) {
        this.showError('Veuillez configurer le document avant de scanner');
        this.playErrorSound();
      }
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
           this.showColisEditModal ||
           this.showManualAddModal ||
           this.showProductSelectionModal ||
           this.showManualQuantityModal ||
           this.showManualColisModal;
  }

  private loadProducts(): void {
    const depotId = this.currentDepotId || this.sessionsService.currentSession()?.depotId;
    const apiUrl = `${environment.apiUrl}/products${depotId ? '?depotId=' + depotId : ''}`;
    this.http.get<Product[]>(apiUrl).subscribe({
      next: (products: Product[]) => {
        // Cache products by ID for fast lookup
        this.productsCache.clear();
        products.forEach((product: Product) => {
          this.productsCache.set(product.id, product);
        });
      },
      error: (error: any) => {
        // Silently fallback to service method if direct call fails
        this.productsService.getProducts().subscribe({
          next: (products: Product[]) => {
            this.productsCache.clear();
            products.forEach((product: Product) => {
              this.productsCache.set(product.id, product);
            });
          },
          error: (fallbackError: any) => {
            // Only log if it's not a 404 (expected for missing products)
            if (fallbackError?.status !== 404) {
              console.warn('Error loading products (fallback):', fallbackError);
            }
          }
        });
      }
    });
  }

  private loadMissingParentProducts(parentIds: number[]): void {
    // This method is now primarily for telemetry or future bulk hooks
    // Most data is now pre-loaded or aggregated from sub-product metadata
  }

  private parseProductIds(sub: ProduitDeCaisse): number[] {
    const ids = new Set<number>();
    if (sub.parentProductId) ids.add(sub.parentProductId);
    if (sub.productIds) {
      if (typeof sub.productIds === 'string') {
        const idsArray = (sub.productIds as string).split(',').filter(id => !!id);
        idsArray.forEach(id => {
          const numId = parseInt(id.trim(), 10);
          if (!isNaN(numId)) ids.add(numId);
        });
      } else if (Array.isArray(sub.productIds)) {
        sub.productIds.forEach((id: any) => {
          const numId = typeof id === 'number' ? id : parseInt(id, 10);
          if (!isNaN(numId)) ids.add(numId);
        });
      }
    }
    return Array.from(ids);
  }

  private async loadProduitsDeCaisse(): Promise<void> {
    try {
      const depotId = this.currentDepotId;
      if (!depotId) {
        console.warn('No depot ID available, skipping produits de caisse load');
        return;
      }
      
      // Fetch scannable articles, active depot products, and ALL master products for metadata
      const [produitsDeCaisse, depotProducts, allMasterProducts] = await Promise.all([
        this.produitsDeCaisseService.getActiveProduitsDeCaisse(depotId).toPromise(),
        this.productsService.getProducts(depotId).toPromise(),
        this.productsService.getProducts(undefined, undefined, true).toPromise()
      ]);

      // Populate products cache from all master products first (metadata foundation)
      if (allMasterProducts) {
        allMasterProducts.forEach(p => this.productsCache.set(p.id, p));
      }

      // Populate/Override products cache from depot products
      if (depotProducts) {
        depotProducts.forEach(p => this.productsCache.set(p.id, p));
      }

      if (produitsDeCaisse) {
        produitsDeCaisse.forEach(produit => {
          this.produitsDeCaisseCache.set(produit.id, produit);
          
          // Aggressively populate parent product metadata from sub-product data
          // This ensures we have basic info for parents even if not assigned to this depot
          if (produit.parentProduct) {
            if (!this.productsCache.has(produit.parentProduct.id)) {
              this.productsCache.set(produit.parentProduct.id, produit.parentProduct);
            }
          }
        });

        // Initialize filtered list for manual add
        this.filteredProduitsDeCaisse = produitsDeCaisse;
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

      // EXCLUSIVE RESOLUTION LOGIC: 
      // Barcodes (2321...) ALWAYS refer to ProduitDeCaisse (SELECT * FROM produits_de_caisse)
      
      let productId: number | null = null;
      let productName: string | null = null;
      let isMapped = false;
      let childProductId: number | null = null;
      let childProductName: string | null = null;

      // Lookup ONLY in POS Item Cache
      const posItem = this.produitsDeCaisseCache.get(articleId);
      
      if (posItem) {
        childProductId = posItem.id;
        childProductName = posItem.name;

        // Use parseProductIds to get all parent IDs associated with this sub-product
        const parentIds = this.parseProductIds(posItem);
        
        if (parentIds.length > 0) {
          // Find the first parent that is present in the cache
          // Metadata was ghosted into productsCache during loadProduitsDeCaisse
          
          let filteredParentIds = parentIds;
          // DEPOT FILTERING RULE: Only filter parents when a destination depot exists (Transfert)
          if (this.selectedDocumentType === 'transfert' && this.selectedDepot) {
            const destinationDepotId = this.selectedDepot.id;
            const depotMatchedIds = parentIds.filter(parentId => {
              const p = this.productsCache.get(parentId);
              return p?.depotAssignments?.some(da => da.depotId === destinationDepotId);
            });
            
            if (depotMatchedIds.length > 0) {
              filteredParentIds = depotMatchedIds;
            }
          }

          for (const parentId of filteredParentIds) {
            const parentProduct = this.productsCache.get(parentId);
            if (parentProduct) {
              productId = parentProduct.id;
              productName = parentProduct.name;
              isMapped = true;
              break;
            }
          }

          if (!isMapped) {
            const cacheSize = this.productsCache.size;
            this.showError(`Produit de stock introuvable pour "${posItem.name}" (ID Parents: ${parentIds.join(', ')} - Cache: ${cacheSize} produits)`);
            this.playErrorSound();
            this.resetScanningState();
            return;
          }
        } else {
          // Block if not linked to stock (Stock Documents require a master product)
          this.showError(`L'article #${articleId} (${posItem.name}) n'est pas lié à un produit de stock`);
          this.playErrorSound();
          this.resetScanningState();
          return;
        }
      } else {
        const cacheSize = this.produitsDeCaisseCache.size;
        this.showError(`ID #${articleId} introuvable dans produits_de_caisse (Cache: ${cacheSize} articles)`);
        this.playErrorSound();
        this.resetScanningState();
        return;
      }

      if (!productId || !productName) {
        this.showError(`Résolution impossible pour article #${articleId} (ID Stock introuvable)`);
        this.playErrorSound();
        this.resetScanningState();
        return;
      }
      
      // Create individual scan entry
      const individualScan = {
        id: `${articleId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        quantity: quantity,
        timestamp: new Date(),
        barcode: barcode
      };
      
      // Find existing item or create new one
      // MATCH BY ARTICLE ID (Sub-article ID), not Parent ID
      // This allows grouping by parent in the UI while keeping sub-article identity
      const existingItemIndex = this.scannedItems.findIndex(item => item.articleId === articleId);
      
      if (existingItemIndex >= 0) {
        // Update existing item - add quantity and increment count
        this.scannedItems[existingItemIndex].quantity += quantity;
        this.scannedItems[existingItemIndex].count += 1;
        this.scannedItems[existingItemIndex].colisCount += 1;
        this.scannedItems[existingItemIndex].lastScanned = new Date();
        this.scannedItems[existingItemIndex].individualScans.push(individualScan);
        this.success = `${childProductName} scanné (${this.scannedItems[existingItemIndex].count}x, Qty: ${this.scannedItems[existingItemIndex].quantity}g)`;
      } else {
        // Add new item
        this.scannedItems.push({
          articleId: articleId, // Original scanned ID (sub-article)
          productId: productId as any, // Resolved Stock ID (parent)
          productName: childProductName as string, // Use sub-article name for display
          quantity,
          count: 1,
          colisCount: 1,
          lastScanned: new Date(),
          individualScans: [individualScan]
        } as any);
        this.success = `Nouveau ${childProductName} ajouté (Qty: ${quantity}g)`;
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
      this.resetScanningState();
    }
  }

  private resetScanningState(): void {
    this.isScanning = false;
    this.loading = false;
    this.currentInput = '';
    this.focusInput();
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
    if (confirm('Êtes-vous sûr de vouloir effacer toute la liste ?')) {
      this.scannedItems = [];
      this.lastScannedProduct = null;
      this.success = 'Liste des articles effacée';
      setTimeout(() => { this.success = ''; }, 3000);
    }
  }

  startNewScan(): void {
    if (this.scannedItems.length > 0) {
      if (!confirm('Démarrer un nouveau scan effacera la liste actuelle. Continuer ?')) {
        return;
      }
    }
    
    this.scannedItems = [];
    this.resetDocumentConfig();
    this.selectedDocumentType = null;
    this.invoiceNumber = '';
    this.showDocumentTypeSelection();
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
    displayParents?: Array<{ id: number, name: string, depotId?: number, depotName?: string }>;
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
    displayParents?: Array<{ id: number, name: string, depotId?: number, depotName?: string }>;
  }> {
    const groups = new Map<string, Array<{
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

    // Group scanned items by their parent product set
    this.scannedItems.forEach(item => {
      const scannedProduit = this.produitsDeCaisseCache.get(item.articleId);
      let groupKey = "-1";

      if (scannedProduit) {
        const allParentIds = this.parseProductIds(scannedProduit);
        if (allParentIds.length > 0) {
          groupKey = allParentIds.sort((a, b) => a - b).join(',');
        } else {
          groupKey = `-standalone_${item.articleId}`;
        }
      } else {
        groupKey = `-orphan_${item.articleId}`;
      }

      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      
      // Add color information if available (placeholder for now)
      const itemWithColor = {
        ...item,
        color: 'Sans couleur' // TODO: Add color property to ProduitDeCaisse model
      };
      
      groups.get(groupKey)!.push(itemWithColor);
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
      displayParents?: Array<{ id: number, name: string, depotId?: number, depotName?: string }>;
    }> = [];

    for (const [groupKey, items] of groups) {
      const displayParents: Array<{ id: number, name: string, depotId?: number, depotName?: string }> = [];
      const parentIds = new Set<number>();
      
      if (!groupKey.startsWith('-')) {
        groupKey.split(',').forEach(id => parentIds.add(parseInt(id, 10)));
      }

      parentIds.forEach(id => {
      const p = this.productsCache.get(id);
      if (p) {
        const mainDepot = p.depotAssignments && p.depotAssignments.length > 0 ? p.depotAssignments[0].depot : null;
        displayParents.push({ 
          id: p.id, 
          name: p.name,
          depotId: mainDepot?.id,
          depotName: mainDepot?.name
        });
      }
    });

    // Filter parents based on the current context (flux)
    if (displayParents.length > 1) {
      if (this.selectedDepot) {
        const destMatch = displayParents.filter(p => p.depotId === this.selectedDepot.id);
        if (destMatch.length > 0) {
          displayParents.splice(0, displayParents.length, ...destMatch);
        }
      }
      
      if (displayParents.length > 1 && this.currentDepotId) {
        const sourceMatch = displayParents.filter(p => p.depotId === this.currentDepotId);
        if (sourceMatch.length > 0) {
          displayParents.splice(0, displayParents.length, ...sourceMatch);
        }
      }

      // If still multiple, just take the first one to avoid redundancy
      if (displayParents.length > 1) {
        displayParents.splice(1);
      }
    }

      const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
      const totalPrice = items.reduce((sum, item) => {
        const produit = this.produitsDeCaisseCache.get(item.articleId);
        if (produit) {
          let prixUnitaire = produit.prix_vente_TTC || 0;

          // Apply custom/bundle pricing when available (for any client)
          if (this.hasCustomPrice(produit)) {
            prixUnitaire = this.getWholesalePrice(produit);
          }
          
          const quantite = item.quantity / 1000; // Convert to kg
          return sum + (prixUnitaire * quantite);
        }
        return sum;
      }, 0);

      let mainProduct: Product | null = null;
      if (displayParents.length > 0) {
        mainProduct = this.productsCache.get(displayParents[0].id) || null;
      }

      result.push({
        mainProduct,
        subProducts: items,
        totalQuantity,
        totalPrice,
        displayParents
      });
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

  getParentProductImage(produit: any): string | null {
    if (!produit) return null;
    
    // If this produit has a parentProductId, get the parent product image
    if (produit.parentProductId) {
      const parentProduct = this.productsCache.get(produit.parentProductId) || null;
      if (parentProduct && parentProduct.photo) {
        return parentProduct.photo;
      }
    }
    
    // If no parent product or no image, return null
    return null;
  }

  getSubProductPrice(articleId: number, quantity: number): number {
    const produit = this.produitsDeCaisseCache.get(articleId);
    if (produit) {
      let prixUnitaire = produit.prix_vente_TTC || 0;

      // Apply custom/bundle pricing when available (for any client)
      if (this.hasCustomPrice(produit)) {
        prixUnitaire = this.getWholesalePrice(produit);
      }

      const quantite = quantity / 1000; // Convert to kg
      return prixUnitaire * quantite;
    }
    return 0;
  }

  private isWholesaleClient(): boolean {
    return this.selectedClient?.clientType === 'WHOLESALE';
  }

  private getWholesalePrice(produit: ProduitDeCaisse): number {
    // First try to get from parent product if available
    if (produit.parentProductId) {
      const parentProduct = this.productsCache.get(produit.parentProductId);
      if (parentProduct && (parentProduct as any).bundlePrice && (parentProduct as any).bundleSize) {
        return (parentProduct as any).bundlePrice / (parentProduct as any).bundleSize;
      }
    }

    // Then try from the produit itself
    if ((produit as any).bundlePrice && (produit as any).bundleSize) {
      return (produit as any).bundlePrice / (produit as any).bundleSize;
    }

    // Apply wholesale rules if available
    const applicableRule = this.findApplicableWholesaleRule(produit.id);
    if (applicableRule) {
      const basePrice = produit.prix_vente_TTC || 0;
      const ruleVal = Number(applicableRule.value) || 0;
      
      if (applicableRule.ruleType === 'percentage') {
        return basePrice * (1 - ruleVal / 100);
      } else if (applicableRule.ruleType === 'fixed') {
        return ruleVal;
      } else if (applicableRule.ruleType === 'discount') {
        return Math.max(0, basePrice - ruleVal);
      }
    }

    // Fallback to regular price
    return produit.prix_vente_TTC || 0;
  }

  private findApplicableWholesaleRule(productId: number): WholesaleRule | null {
    // Since wholesale rules don't have specific productIds, apply the first active rule
    // In a real system, you might want to have more sophisticated rule matching
    return this.wholesaleRules.find(rule => 
      !rule.isArchived
    ) || null;
  }

  private hasCustomPrice(produit: ProduitDeCaisse): boolean {
    // Only apply custom pricing if a client is selected
    if (!this.selectedClient) {
      return false;
    }

    // Bundle-level price on any associated parent product
    const parentIds = this.parseProductIds(produit);
    for (const parentId of parentIds) {
      const parentProduct = this.productsCache.get(parentId);
      if (parentProduct && (parentProduct as any).bundlePrice && (parentProduct as any).bundleSize) {
        return true;
      }
    }
    // Bundle on the produit itself
    if ((produit as any).bundlePrice && (produit as any).bundleSize) {
      return true;
    }
    // Applicable pricing rule
    return this.findApplicableWholesaleRule(produit.id) !== null;
  }

  private loadWholesaleRules(): void {
    this.wholesaleRulesService.getWholesaleRules().subscribe({
      next: (rules: WholesaleRule[]) => {
        this.wholesaleRules = rules;
      },
      error: (error: any) => {
        console.error('Error loading wholesale rules:', error);
        this.wholesaleRules = [];
      }
    });
  }

  // Check if wholesale pricing is being applied
  isCustomPricingActiveForArticle(articleId: number, quantity: number): boolean {
    const produit = this.produitsDeCaisseCache.get(articleId);
    if (!produit) {
      return false;
    }
    if (!this.hasCustomPrice(produit)) {
      return false;
    }
    // Compare computed custom price with original
    const original = this.getOriginalPrice(articleId, quantity);
    const current = this.getSubProductPrice(articleId, quantity);
    return Math.abs(current - original) > 1e-9;
  }

  // Check if the selected client has any custom pricing available
  hasClientCustomPricing(): boolean {
    if (!this.selectedClient) {
      return false;
    }

    // Check if any scanned products have custom pricing
    for (const item of this.scannedItems) {
      const produit = this.produitsDeCaisseCache.get(item.articleId);
      if (produit && this.hasCustomPrice(produit)) {
        return true;
      }
    }
    return false;
  }

  // Get the original price for comparison
  getOriginalPrice(articleId: number, quantity: number): number {
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

  onGenerateDocument(): void {
    if (this.scannedItems.length === 0) {
      this.showError('La liste des articles est vide');
      this.playErrorSound();
      return;
    }
    
    if (!this.selectedDocumentType) {
      this.showDocumentTypeSelection();
      return;
    }
    
    this.proceedToNextSelection();
  }

  showDocumentTypeSelection(): void {
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
    

  }

  private loadDocumentTypeDefaults(type: 'livraison' | 'sortie' | 'transfert' | 'facture'): void {

    
    // Try to load settings from server to override defaults
    this.settingsService.getSettings().subscribe({
      next: (settings) => {



        
        if (settings?.documentTypeDefaults?.[type]) {
          const serverDefaults = settings.documentTypeDefaults[type] as any;

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

        // Open the configuration modal after settings are loaded
        this.openDocumentConfigurationModal();
      },
      error: (error) => {
        console.error('Error loading document type defaults:', error);

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
    
    if (currentSession && currentSession.depotId) {
      this.currentDepotId = currentSession.depotId;
      if (currentSession.depot) {
        this.currentDepot = currentSession.depot;
        // Reload produits de caisse with the correct depot ID
        this.loadProduitsDeCaisse();
      } else {
        this.loadDepotById(currentSession.depotId);
      }
    }

    // Also subscribe to changes
    this.sessionsService.currentSession$.subscribe({
      next: (session) => {
        if (session && session.depotId) {
          const previousDepotId = this.currentDepotId;
          this.currentDepotId = session.depotId;

          // Store the depot information from the session if available
          if (session.depot) {
            this.currentDepot = session.depot;
            // Reload produits de caisse if depot changed
            if (previousDepotId !== session.depotId) {
              this.loadProduitsDeCaisse();
            }
          } else {
            // If depot info is not in session, load it separately
            this.loadDepotById(session.depotId);
          }
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
        const depot = depots.find((d: any) => d.id === depotId);
        if (depot) {
          this.currentDepot = depot;
          // Reload produits de caisse with the correct depot ID
          this.loadProduitsDeCaisse();
        }
      },
      error: (error) => {
        console.error('Error loading depot by ID:', error);
      }
    });
  }

  private tryAlternativeDepotLoading(): void {
    // Try to get depot from user profile
    const currentUser = this.authService.currentUser();
    
    if (currentUser && currentUser.depotId) {
      this.currentDepotId = currentUser.depotId;
      this.loadDepotById(this.currentDepotId);
      this.loadProduitsDeCaisse();
      return;
    }
    
    // Try to get depot from localStorage
    const storedDepotId = localStorage.getItem('currentDepotId');
    if (storedDepotId) {
      this.currentDepotId = parseInt(storedDepotId);
      this.loadDepotById(this.currentDepotId);
      this.loadProduitsDeCaisse();
      return;
    }
    
    // Try to get depot from ticket counter service localStorage
    const ticketStateKeys = Object.keys(localStorage).filter(key => key.startsWith('pos_ticket_state_depot_'));
    if (ticketStateKeys.length > 0) {
      const depotIdFromTicket = ticketStateKeys[0].replace('pos_ticket_state_depot_', '');
      this.currentDepotId = parseInt(depotIdFromTicket);
      this.loadDepotById(this.currentDepotId);
      this.loadProduitsDeCaisse();
      return;
    }
    
    // If no depot found, try to get the first available depot as fallback
    this.depotsService.list().subscribe({
      next: (depots) => {
        const activeDepots = depots.filter((d: any) => d.isActive);
        if (activeDepots.length > 0) {
          this.currentDepotId = activeDepots[0].id;
          this.currentDepot = activeDepots[0];
          this.loadProduitsDeCaisse();
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



    
    this.closeDocumentConfigurationModal();
    
    // Show selection modals based on configuration in sequence
    // Start with the first required selection
    this.proceedToNextSelection();
  }

  public proceedToNextSelection(): void {







    
    // Check what selections are still needed in order
    if (this.documentConfig.client && !this.selectedClient) {

      this.showClientSelectionModal = true;
    } else if (this.documentConfig.depot && !this.selectedDepot) {

      // Load appropriate depots based on document type
      if (this.selectedDocumentType === 'transfert') {
        this.loadDepotsForTransfer();
      } else {
        this.loadDepots();
      }
      this.showDepotSelectionModal = true;
    } else if (this.documentConfig.vehicle && !this.selectedVehicle) {

      this.showVehicleSelectionModal = true;
    } else if (this.documentConfig.driver && !this.selectedDriver) {

      this.showDriverSelectionModal = true;
    } else if (this.documentConfig.manualDestination && !this.manualDestination) {

      this.showManualDestinationModal = true;
    } else if (this.documentConfig.validity && (!this.validityFromDate || !this.validityToDate)) {

      this.setDefaultValidityDates(); // Automatically set default dates
      this.showValidityModal = true;
    } else {
      // Configuration completed
      // Only generate document if items actually exist to be processed
      if (this.scannedItems.length > 0) {
        this.generateDocument();
      } else {
        // Just configuration complete, stop here and let user scan
        this.success = 'Configuration terminée. Vous pouvez commencer à scanner.';
        setTimeout(() => { 
          if (this.success === 'Configuration terminée. Vous pouvez commencer à scanner.') {
            this.success = ''; 
          }
        }, 3000);
      }
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

        
        const documentData = this.prepareDocumentData();
        
        // Detailed logging for debugging
        console.log('Generating document with data:', {
          type: documentData.type,
          itemCount: documentData.items?.length,
          items: documentData.items
        });

        // Final sanity check: ensuring all items have a productId
        const invalidItems = documentData.items.filter((item: any) => !item.productId);
        if (invalidItems.length > 0) {
            this.error = 'Erreur: Certains articles n\'on pas d\'ID de produit valide';
            this.loading = false;
            return;
        }

        // Final sanity check for items array
        if (!documentData.items || documentData.items.length === 0) {
          this.error = 'Erreur: La liste des articles est vide';
          this.loading = false;
          return;
        }

        // Set the generated number if not already set (for non-facture documents)
        if (!documentData.numero) {
          documentData.numero = nextNumber;
        }

        this.stockDocumentsService.createDocument(documentData).subscribe({
          next: (savedDocument) => {
            this.loading = false;
            this.success = `Document ${savedDocument.numero} créé avec succès!`;
            
            // Open the document for printing
            this.openDocumentForPrint(savedDocument);
            
            // Clear scanned items and reset
            this.scannedItems = []; // Explicitly clear local array
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
          colisCount: item.colisCount, // Include the colis count
          famille: parentProduct?.famille || parentProduct?.name || 'Produit scanné',
          parentProductId: parentProductId, // Add parent reference for grouping
          childProductName: produit?.name || `CHILDREN ${item.articleId}`, // Add child name for display
          childProductId: item.articleId // Keep child product ID for reference
        };
        
        // Always include price fields if produit exists
        if (produit) {
          let prixUnitaire = produit.prix_vente_TTC || 0;
          
          // Apply custom/bundle pricing when available (for any client)
          if (this.hasCustomPrice(produit)) {
            prixUnitaire = this.getWholesalePrice(produit);
          }
          
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

    // Calculate document-level totals
    documentData.totalHT = documentData.items.reduce((sum: number, item: any) => sum + (item.montantHT || 0), 0);
    documentData.totalTVA = documentData.items.reduce((sum: number, item: any) => sum + (item.montantTVA || 0), 0);
    documentData.totalTTC = documentData.items.reduce((sum: number, item: any) => sum + (item.montantTTC || 0), 0);

    // Add extra required IDs
    if (this.selectedClient) documentData.clientId = this.selectedClient.id;
    if (this.selectedVehicle) documentData.vehicleId = this.selectedVehicle.id;
    if (this.selectedDriver) documentData.driverId = this.selectedDriver.id;
    if (this.manualDestination) documentData.destination = this.manualDestination;
    if (this.validityFromDate) documentData.validationFromDate = this.validityFromDate;
    if (this.validityToDate) documentData.validationToDate = this.validityToDate;

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

    // Do not duplicate structured fields into notes; rely on dedicated columns (clientId, vehicleId, driverId, destination, validationFromDate, validationToDate, numero)

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

      },
      error: (error) => {
        console.error('Error loading settings:', error);
      }
    });
  }

  // Manual Add Methods


  private resetManualAddState(): void {
    this.selectedProductForManualAdd = null;
    this.manualQuantity = '';
    this.manualColisCount = '';
    this.searchQuery = '';
    this.shouldClearManualQuantityOnFirstTap = false;
    this.shouldClearManualColisOnFirstTap = false;
    this.filteredProduitsDeCaisse = Array.from(this.produitsDeCaisseCache.values());
  }

  openProductSelection(): void {
    this.showProductSelectionModal = true;
    this.filteredProduitsDeCaisse = Array.from(this.produitsDeCaisseCache.values());
  }

  closeProductSelectionModal(): void {
    this.showProductSelectionModal = false;
    this.searchQuery = '';
    this.filteredProduitsDeCaisse = Array.from(this.produitsDeCaisseCache.values());
    this.resetManualAddState();
  }

  filterProduitsDeCaisse(): void {
    if (!this.searchQuery.trim()) {
      this.filteredProduitsDeCaisse = Array.from(this.produitsDeCaisseCache.values());
    } else {
      const query = this.searchQuery.toLowerCase();
      this.filteredProduitsDeCaisse = Array.from(this.produitsDeCaisseCache.values()).filter(produit =>
        produit.name.toLowerCase().includes(query) ||
        produit.id.toString().includes(query) ||
        this.getParentProductName(produit).toLowerCase().includes(query)
      );
    }
  }

  showManualAdd(): void {
    if (!this.selectedDocumentType) {
      this.showError('Veuillez configurer le document avant d\'ajouter des produits');
      this.playErrorSound();
      this.showDocumentTypeSelection();
      return;
    }
    this.openProductSelection();
  }

  getGroupedProduitsDeCaisse(): Array<{
    parentProduct: Product | null;
    parentProductId: number;
    parentProductName: string;
    parentProductImage: string | null;
    displayParents?: Array<{ id: number, name: string, depotId?: number, depotName?: string }>;
    produits: any[];
  }> {
    const groups = new Map<string, any[]>();

    // Group produits by parent product set
    this.filteredProduitsDeCaisse.forEach(produit => {
      const allParentIds = this.parseProductIds(produit);
      
      if (allParentIds.length > 0) {
        // Create a canonical key: sorted parent IDs as string
        const groupKey = allParentIds.sort((a, b) => a - b).join(',');
        
        if (!groups.has(groupKey)) {
          groups.set(groupKey, []);
        }
        const currentGroup = groups.get(groupKey)!;
        if (!currentGroup.find(p => p.id === produit.id)) {
          currentGroup.push(produit);
        }
      } else {
        // No parent, group under a single "Standalone" key
        const standaloneId = "-1";
        if (!groups.has(standaloneId)) {
          groups.set(standaloneId, []);
        }
        groups.get(standaloneId)!.push(produit);
      }
    });

    // Convert to array and sort
    const result = Array.from(groups.entries()).map(([groupKey, produits]) => {
      let parentProduct: Product | null = null;
      let parentProductName = 'Produits Indépendants';
      let parentProductImage: string | null = null;
      let displayParents: Array<{ id: number, name: string, depotId?: number, depotName?: string }> = [];
      let parentId = -1;

      if (groupKey !== "-1") {
        const parentIds = groupKey.split(',').map(id => parseInt(id, 10));
        parentId = parentIds[0]; // First parent as "id" for internal logic
        
        // Resolve all parents for display
        parentIds.forEach(id => {
          const p = this.productsCache.get(id);
          if (p) {
            // DEPOT FILTERING RULE: Only filter parents when a destination depot exists (Transfert)
            if (this.selectedDocumentType === 'transfert' && this.selectedDepot) {
              const destinationDepotId = this.selectedDepot.id;
              const isAssignedToDestination = p.depotAssignments?.some(da => da.depotId === destinationDepotId);
              if (!isAssignedToDestination) {
                return; // Skip this parent for display if not in destination depot
              }
            }

            const mainDepot = p.depotAssignments && p.depotAssignments.length > 0 ? p.depotAssignments[0].depot : null;
            displayParents.push({ 
              id: p.id, 
              name: p.name,
              depotId: mainDepot?.id,
              depotName: mainDepot?.name
            });
            // Use the first resolved parent for the group's main identity/image
            if (!parentProduct) {
              parentProduct = p;
              parentProductName = p.name || 'Produits Indépendants';
              parentProductImage = p.photo || null;
              parentId = p.id;
            }
          }
        });

        if (!parentProduct && produits.length > 0) {
          parentProductName = produits[0].name;
        }
      } else {
        parentProductName = 'Articles Indépendants';
      }

      return {
        parentProduct,
        parentProductId: parentId,
        parentProductName,
        parentProductImage,
        displayParents,
        produits: produits.sort((a, b) => a.name.localeCompare(b.name))
      };
    });

    // Sort groups by number of variants (most variants first), then by parent product name
    return result.sort((a, b) => {
      if (b.produits.length !== a.produits.length) {
        return b.produits.length - a.produits.length;
      }
      return a.parentProductName.localeCompare(b.parentProductName);
    });
  }

  getParentProductName(produit: any): string {
    if (!produit) return '';
    
    const parentIds = this.parseProductIds(produit);
    if (parentIds.length === 0) return '';

    const names: string[] = [];
    parentIds.forEach(id => {
      const p = this.productsCache.get(id);
      if (p && p.name) {
        names.push(p.name);
      }
    });

    return names.join(', ');
  }

  selectProductForManualAdd(produit: any): void {
    this.selectedProductForManualAdd = produit;
    this.showProductSelectionModal = false;
    this.openManualQuantityModal();
  }

  openManualQuantityModal(): void {
    this.manualQuantity = '';
    this.shouldClearManualQuantityOnFirstTap = true;
    this.showManualQuantityModal = true;
  }

  closeManualQuantityModal(): void {
    this.showManualQuantityModal = false;
    this.manualQuantity = '';
    this.shouldClearManualQuantityOnFirstTap = false;
  }

  confirmManualQuantity(): void {
    if (!this.manualQuantity.trim()) {
      this.showError('Veuillez saisir une quantité valide');
      return;
    }

    const quantity = parseFloat(this.manualQuantity);
    if (isNaN(quantity) || quantity <= 0) {
      this.showError('La quantité doit être un nombre positif');
      return;
    }

    this.showManualQuantityModal = false;
    this.openManualColisModal();
  }

  openManualColisModal(): void {
    this.manualColisCount = '1';
    this.shouldClearManualColisOnFirstTap = true;
    this.showManualColisModal = true;
  }

  closeManualColisModal(): void {
    this.showManualColisModal = false;
    this.manualColisCount = '';
    this.shouldClearManualColisOnFirstTap = false;
  }

  confirmManualColis(): void {
    if (!this.manualColisCount.trim()) {
      this.showError('Veuillez saisir un nombre de colis valide');
      return;
    }

    const colisCount = parseInt(this.manualColisCount, 10);
    if (isNaN(colisCount) || colisCount < 1) {
      this.showError('Le nombre de colis doit être un nombre entier positif');
      return;
    }

    this.addManualProduct();
  }

  private addManualProduct(): void {
    if (!this.selectedProductForManualAdd) {
      this.showError('Aucun produit sélectionné');
      return;
    }

    const quantity = parseFloat(this.manualQuantity);
    const colisCount = parseInt(this.manualColisCount, 10);
    const articleId = this.selectedProductForManualAdd.id;
    // const productName = this.selectedProductForManualAdd.name; // Logic moved below

    // UNIFIED RESOLUTION LOGIC FOR MANUAL ADD:
    // Resolve productId from the selected item (which comes from ProduitsDeCaisseCache)
    // Note: Manual add usually selects from ProduitsDeCaisseCache (since that's what filteredProduitsDeCaisse uses)
    
    // EXCLUSIVE RESOLUTION LOGIC FOR MANUAL ADD:
    // Manual add MUST resolve from ProduitDeCaisse (SELECT * FROM produits_de_caisse)
    
    let productId: number | null = null;
    let productName: string | null = null;
    let isMapped = false;
    
    const posItem = this.produitsDeCaisseCache.get(articleId);
    
    if (posItem) {
        // Use parseProductIds to get all parent IDs associated with this sub-product
        const parentIds = this.parseProductIds(posItem);
        
        if (parentIds.length > 0) {
          // Find the first parent that is present in the cache
          for (const parentId of parentIds) {
            const parentProduct = this.productsCache.get(parentId);
            if (parentProduct) {
              productId = parentProduct.id;
              productName = parentProduct.name;
              isMapped = true;
              break;
            }
          }

          if (!isMapped) {
            this.showError(`Produit de stock introuvable pour "${posItem.name}" (ID Parents: ${parentIds.join(', ')})`);
            return;
          }
        } else {
          this.showError(`Article ${articleId} (${posItem.name}) n'est pas lié à un produit de stock`);
          return;
        }
    } else {
        this.showError(`Article ${articleId} introuvable dans la table produits_de_caisse`);
        return;
    }

    if (!productId || !productName) {
        this.showError(`Résolution du produit de stock impossible pour l'article ${articleId}`);
        return;
    }

    // Create individual scan entry for manual add
    const individualScan = {
      id: `manual_${articleId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      quantity: Math.round(quantity * 1000), // Convert to grams
      timestamp: new Date(),
      barcode: `MANUAL_${articleId}_${Date.now()}`
    };

    // Find existing item or create new one
    // MATCH BY ARTICLE ID (Sub-article ID), not Parent ID
    // This allows grouping by parent in the UI while keeping sub-article identity
    const existingItemIndex = this.scannedItems.findIndex(item => item.articleId === articleId);

    if (existingItemIndex >= 0) {
      // Update existing item - add quantity and increment count
      this.scannedItems[existingItemIndex].quantity += Math.round(quantity * 1000);
      this.scannedItems[existingItemIndex].count += 1;
      this.scannedItems[existingItemIndex].colisCount += colisCount;
      this.scannedItems[existingItemIndex].lastScanned = new Date();
      this.scannedItems[existingItemIndex].individualScans.push(individualScan);
      this.success = `${posItem.name} ajouté manuellement (${this.scannedItems[existingItemIndex].count}x, Qty: ${(this.scannedItems[existingItemIndex].quantity/1000).toFixed(3)}kg)`;
    } else {
      // Add new item
      this.scannedItems.push({
        articleId: articleId, // Original scanned ID (sub-article)
        productId: productId as any, // Resolved Stock ID (parent)
        productName: posItem.name, // Use sub-article name for display
        quantity: Math.round(quantity * 1000), // Convert to grams
        count: 1,
        colisCount: colisCount,
        lastScanned: new Date(),
        individualScans: [individualScan]
      } as any);
      this.success = `Nouveau ${posItem.name} ajouté manuellement (Qty: ${quantity.toFixed(3)}kg, ${colisCount} colis)`;
    }

    // Play success sound
    this.playSuccessSound();

    // Clear success message after 3 seconds
    setTimeout(() => { this.success = ''; }, 3000);
    this.error = '';

    // Close all modals and reset state
    this.showManualColisModal = false;
    this.resetManualAddState();

    // Scroll to the added item after a short delay to ensure DOM is updated
    setTimeout(() => {
      this.scrollToScannedItem(articleId);
    }, 100);
  }

  // Manual Quantity Numpad methods
  addManualQuantityDigit(digit: string): void {
    if (this.shouldClearManualQuantityOnFirstTap) {
      // Clear the current value and start fresh
      this.manualQuantity = digit;
      this.shouldClearManualQuantityOnFirstTap = false; // Reset flag after first tap
    } else if (this.manualQuantity.length < 10) { // Limit to reasonable length
      this.manualQuantity += digit;
    }
  }

  removeLastManualQuantityDigit(): void {
    this.manualQuantity = this.manualQuantity.slice(0, -1);
  }

  clearManualQuantity(): void {
    this.manualQuantity = '';
    this.shouldClearManualQuantityOnFirstTap = false; // Reset flag when manually clearing
  }

  addManualQuantityDecimalPoint(): void {
    if (this.shouldClearManualQuantityOnFirstTap) {
      // Clear the current value and start with decimal point
      this.manualQuantity = '0.';
      this.shouldClearManualQuantityOnFirstTap = false; // Reset flag after first tap
    } else if (!this.manualQuantity.includes('.')) {
      this.manualQuantity += '.';
    }
  }

  // Manual Colis Numpad methods
  addManualColisDigit(digit: string): void {
    if (this.shouldClearManualColisOnFirstTap) {
      // Clear the current value and start fresh
      this.manualColisCount = digit;
      this.shouldClearManualColisOnFirstTap = false; // Reset flag after first tap
    } else if (this.manualColisCount.length < 3) { // Limit to reasonable length for colis count
      this.manualColisCount += digit;
    }
  }

  removeLastManualColisDigit(): void {
    this.manualColisCount = this.manualColisCount.slice(0, -1);
  }

  clearManualColisCount(): void {
    this.manualColisCount = '';
    this.shouldClearManualColisOnFirstTap = false; // Reset flag when manually clearing
  }

  // Color methods for vibrant pastel theme
  getGroupHeaderColor(index: number): string {
    const colors = [
      'from-purple-500 to-purple-600',      // Deep purple
      'from-pink-500 to-pink-600',          // Deep pink
      'from-blue-500 to-blue-600',          // Deep blue
      'from-teal-500 to-teal-600',          // Deep teal
      'from-emerald-500 to-emerald-600',    // Deep emerald
      'from-amber-500 to-amber-600',        // Deep amber
      'from-orange-500 to-orange-600',      // Deep orange
      'from-red-500 to-red-600',            // Deep red
      'from-indigo-500 to-indigo-600',      // Deep indigo
      'from-cyan-500 to-cyan-600'           // Deep cyan
    ];
    return colors[index % colors.length];
  }

  getProductCardColor(groupIndex: number, productIndex: number): string {
    const colorSets = [
      // Purple group
      ['bg-purple-400 border-purple-500', 'bg-purple-300 border-purple-400', 'bg-purple-500 border-purple-600'],
      // Pink group
      ['bg-pink-400 border-pink-500', 'bg-pink-300 border-pink-400', 'bg-pink-500 border-pink-600'],
      // Blue group
      ['bg-blue-400 border-blue-500', 'bg-blue-300 border-blue-400', 'bg-blue-500 border-blue-600'],
      // Teal group
      ['bg-teal-400 border-teal-500', 'bg-teal-300 border-teal-400', 'bg-teal-500 border-teal-600'],
      // Emerald group
      ['bg-emerald-400 border-emerald-500', 'bg-emerald-300 border-emerald-400', 'bg-emerald-500 border-emerald-600'],
      // Amber group
      ['bg-amber-400 border-amber-500', 'bg-amber-300 border-amber-400', 'bg-amber-500 border-amber-600'],
      // Orange group
      ['bg-orange-400 border-orange-500', 'bg-orange-300 border-orange-400', 'bg-orange-500 border-orange-600'],
      // Red group
      ['bg-red-400 border-red-500', 'bg-red-300 border-red-400', 'bg-red-500 border-red-600'],
      // Indigo group
      ['bg-indigo-400 border-indigo-500', 'bg-indigo-300 border-indigo-400', 'bg-indigo-500 border-indigo-600'],
      // Cyan group
      ['bg-cyan-400 border-cyan-500', 'bg-cyan-300 border-cyan-400', 'bg-cyan-500 border-cyan-600']
    ];
    
    const colorSet = colorSets[groupIndex % colorSets.length];
    return colorSet[productIndex % colorSet.length];
  }
}