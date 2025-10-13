import { Component, OnDestroy, OnInit, signal, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DepotsService } from '../../core/services/depots.service';
import { StockDocumentsService } from '../../core/services/stock-documents.service';
import { ProductsService } from '../../core/services/products.service';
import { ClientsService } from '../../core/services/clients.service';
import { PrintService } from '../../core/services/print.service';
import { SettingsService, AppSettings } from '../../core/services/settings.service';
import { buildScanLikeDocumentHtmlFromDocument, getScanPrintStyles } from '../shared/print-templates';
import { VehiclesService } from '../../core/services/vehicles.service';
import { DriversService } from '../../core/services/drivers.service';
import { ProduitsDeCaisseService } from '../../core/services/produits-de-caisse.service';
import { Product } from '../../core/models/product.model';
import { Depot } from '../../core/models/depot.model';
import { Client } from '../../core/models/client.model';
import { VehicleBrand, Vehicle } from '../../core/models/vehicle.model';
import { Driver } from '../../core/models/driver.model';
import { ProduitDeCaisse } from '../../core/models/produit-de-caisse.model';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';

@Component({
  selector: 'app-scan-reception',
  templateUrl: './scan-reception.component.html',
  standalone: false
})
export class ScanReceptionComponent implements OnInit, OnDestroy {
  depotId = 0;
  loading = false;
  error = '';
  settings: AppSettings | null = null;
  success = '';

  // Products cache for fast lookup
  private productsCache = new Map<number, Product>();
  private produitsDeCaisseCache = new Map<number, ProduitDeCaisse>();
  private productsService = inject(ProductsService);
  private clientsService = inject(ClientsService);
  private printService = inject(PrintService);
  private vehiclesService = inject(VehiclesService);
  private driversService = inject(DriversService);
  private produitsDeCaisseService = inject(ProduitsDeCaisseService);
  private stockDocs = inject(StockDocumentsService);

  // Audio feedback
  private successSound: HTMLAudioElement | null = null;
  private errorSound: HTMLAudioElement | null = null;

  // camera
  isCameraReady = false;
  useCamera = true;
  stream: MediaStream | null = null;
  isSecure = typeof window !== 'undefined' ? (window.isSecureContext === true) : false;
  cameraUnavailableReason = '';
  currentFacingMode: 'environment' | 'user' = 'environment';

  // UI state
  lastBarcode = '';
  manualBarcode = '';
  depots = signal<any[]>([]);
  flashEnabled = false;
  isCapturing = false;
  
  // Scanned items tracking
  scannedItems: Array<{
    articleId: number;
    productName: string;
    quantity: number;
    count: number;
    lastScanned: Date;
  }> = [];

  // Numpad modal state
  showNumpad = false;
  currentBarcode = '';
  quantityInput = '';
  colisInput = '';
  currentInputType: 'quantity' | 'colis' = 'quantity';

  // Manual product selection state
  showManualProductModal = false;
  showManualQuantityModal = false;
  productSearchQuery = '';
  filteredProducts: ProduitDeCaisse[] = [];
  selectedManualProduct: ProduitDeCaisse | null = null;
  manualQuantityInput = '';
  manualColisInput = '';
  manualCurrentInputType: 'quantity' | 'colis' = 'quantity';
  isManualProductLoading = false;

  // Document type selection state
  showDocumentTypeModal = false;
  showDepotSelectionModal = false;
  showClientSelectionModal = false;
  selectedDocumentType: 'sortie' | 'livraison' | 'transfert' | null = null;
  selectedDestinationDepot: Depot | null = null;
  selectedClient: Client | null = null;
  availableDepots: Depot[] = [];
  allClients: Client[] = [];
  filteredClients: Client[] = [];
  clientSearchQuery = '';
  
  // Global document type for the session
  sessionDocumentType: 'sortie' | 'livraison' | 'transfert' | null = null;
  
  // Vehicle selection state
  showVehicleSelectionModal = false;
  vehicleSelectionStep: 'vehicle' | 'driver' | 'details' = 'vehicle';
  selectedVehicle: Vehicle | null = null;
  selectedDriver: Driver | null = null;
  availableVehicles: Vehicle[] = [];
  availableDrivers: Driver[] = [];
  vehicleSearchQuery = '';
  driverSearchQuery = '';
  filteredVehicles: Vehicle[] = [];
  filteredDrivers: Driver[] = [];
  
  // Bon de sortie details
  destination = '';
  validationFromDate = '';
  validationToDate = '';
  
  // Brand logos mapping
  brandLogos: Map<string, string> = new Map();
  
  // Cooldown prevention
  private lastCaptureTime = 0;
  private readonly CAPTURE_COOLDOWN = 0; // faster cooldown for rapid scans
  
  // Camera recovery
  private cameraRecoveryAttempts = 0;
  private readonly MAX_RECOVERY_ATTEMPTS = 3;
  private cameraCheckInterval: any = null;

  private videoEl?: HTMLVideoElement;
  private canvas?: HTMLCanvasElement;
  private zxingReader: BrowserMultiFormatReader | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private depotsService: DepotsService,
    private settingsService: SettingsService
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const id = params.get('depotId');
      this.depotId = id ? parseInt(id, 10) : 0;
    });
    // If a document type is provided via query params (from documents pages), use it
    this.route.queryParamMap.subscribe((qp) => {
      const type = qp.get('type') as ('sortie' | 'livraison' | 'transfert' | null);
      if (type === 'sortie' || type === 'livraison' || type === 'transfert') {
        this.sessionDocumentType = type;
        // Refresh available destination depots when type is preset
        this.availableDepots = this.filterAvailableDestinationDepots(this.depots());
        // If coming with a preset type, prompt for required context
        if (type === 'sortie' || type === 'transfert') {
          // Require destination depot selection
          if (!this.selectedDestinationDepot) {
            this.showDepotSelectionModal = true;
          }
        } else if (type === 'livraison') {
          // Require client selection
          if (!this.selectedClient) {
            this.showClientSelectionModal = true;
          }
        }
      }
    });
    this.loadDepots();
    this.loadClients();
    this.loadProducts();
    this.loadVehicles();
    this.loadSettings();
    this.loadVehicleBrands();
    this.loadDrivers();
    this.loadProduitsDeCaisse();
    this.initSounds();
    queueMicrotask(() => this.initCamera());
    
    // Show document type selection on component load only if not preset
    if (!this.sessionDocumentType) {
      this.showDocumentTypeSelection();
    } else {
      // If preset, ensure the dependent selection modals are opened accordingly
      if (this.sessionDocumentType === 'sortie' || this.sessionDocumentType === 'transfert') {
        if (!this.selectedDestinationDepot) {
          this.showDepotSelectionModal = true;
        }
      } else if (this.sessionDocumentType === 'livraison') {
        if (!this.selectedClient) {
          this.showClientSelectionModal = true;
        }
      }
    }
  }

  goBack(): void {
    this.router.navigate(['/stock']);
  }

  ngOnDestroy(): void {
    this.stopCamera();
  }

  loadDepots(): void {
    this.depotsService.list().subscribe({
      next: (list) => {
        this.depots.set(list.filter((d: any) => d.isActive));
        // Filter out current depot from available depots for destination selection
        this.availableDepots = this.filterAvailableDestinationDepots(list);
      },
      error: () => {}
    });
  }

  loadSettings(): void {
    this.settingsService.getSettings().subscribe({
      next: (settings) => {
        this.settings = settings;
      },
      error: (error) => {
        console.error('Error loading settings:', error);
      }
    });
  }

  private filterAvailableDestinationDepots(list: any[]): Depot[] {
    const base = list.filter((d: any) => d.isActive && d.id !== this.depotId);
    if (this.sessionDocumentType === 'transfert') {
      // Restrict to same company when transferring
      // Try to infer companyId if present on depot objects
      const currentDepot: any = list.find((d: any) => d.id === this.depotId);
      const currentCompanyId = currentDepot?.companyId ?? currentDepot?.company_id ?? null;
      if (currentCompanyId != null) {
        return base.filter((d: any) => (d.companyId ?? d.company_id) === currentCompanyId);
      }
    }
    return base;
  }

  loadClients(): void {
    this.clientsService.getClients().subscribe({
      next: (response) => {
        this.allClients = response.clients;
        this.filteredClients = response.clients;
      },
      error: (error) => {
        console.error('Error loading clients:', error);
        this.error = 'Erreur lors du chargement des clients';
      }
    });
  }

  loadProducts(): void {
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

  loadVehicles(): void {
    this.vehiclesService.getActiveVehicles().subscribe({
      next: (vehicles: Vehicle[]) => {
        this.availableVehicles = vehicles;
        this.filteredVehicles = vehicles;
      },
      error: (error: any) => {
        console.error('Error loading vehicles:', error);
      }
    });
  }

  loadVehicleBrands(): void {
    this.vehiclesService.getActiveVehicleBrands().subscribe({
      next: (brands: VehicleBrand[]) => {
        // Create mapping from brand name to logo URL
        this.brandLogos.clear();
        brands.forEach(brand => {
          if (brand.logoUrl) {
            this.brandLogos.set(brand.name.toLowerCase(), brand.logoUrl);
          }
        });
      },
      error: (error: any) => {
        console.error('Error loading vehicle brands:', error);
      }
    });
  }

  loadDrivers(): void {
    this.driversService.getActiveDrivers().subscribe({
      next: (drivers: Driver[]) => {
        this.availableDrivers = drivers;
        this.filteredDrivers = drivers;
      },
      error: (error: any) => {
        console.error('Error loading drivers:', error);
      }
    });
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

  private initSounds(): void {
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

  private playSuccessSound(): void {
    try {
      if (this.successSound) {
        this.successSound.currentTime = 0;
        this.successSound.play().catch(() => {
          // Ignore play errors (user interaction required on some browsers)
        });
      }
    } catch (error) {
      // Ignore sound errors
    }
  }

  private playErrorSound(): void {
    try {
      if (this.errorSound) {
        this.errorSound.currentTime = 0;
        this.errorSound.play().catch(() => {
          // Ignore play errors (user interaction required on some browsers)
        });
      }
    } catch (error) {
      // Ignore sound errors
    }
  }

  async initCamera(): Promise<void> {
    try {
      this.videoEl = document.querySelector('#scanVideo') as HTMLVideoElement | null || undefined;
      if (!this.videoEl) return;
      this.videoEl.setAttribute('playsinline', 'true');

      await this.startStream();
      this.isCameraReady = true;
      this.useCamera = true;
      this.cameraRecoveryAttempts = 0;
      
      // Start camera health monitoring
      this.startCameraMonitoring();
    } catch (e: any) {
      this.useCamera = false;
      if (!this.isSecure) {
        this.cameraUnavailableReason = 'La caméra nécessite HTTPS ou localhost (sécurité navigateur).';
      } else if (e && (e.name === 'NotAllowedError' || e.name === 'SecurityError')) {
        this.cameraUnavailableReason = 'Permission caméra refusée. Autorisez l\'accès dans le navigateur.';
      } else if (e && e.name === 'NotFoundError') {
        this.cameraUnavailableReason = 'Aucun appareil caméra détecté.';
      } else {
        this.cameraUnavailableReason = 'Caméra indisponible.';
      }
    }
  }

  private async startStream(): Promise<void> {
    if (!this.videoEl) return;

    if (this.stream) {
      try { this.stream.getTracks().forEach(t => t.stop()); } catch {}
      this.stream = null;
    }

    const constraints: MediaStreamConstraints = {
      audio: false,
      video: { 
        facingMode: this.currentFacingMode,
        width: { ideal: 1920, min: 1280 },
        height: { ideal: 1080, min: 720 }
      } as any
    };

    this.stream = await navigator.mediaDevices.getUserMedia(constraints);
    this.videoEl.srcObject = this.stream;
    
    // Wait for video to be ready
    await new Promise<void>((resolve) => {
      const onLoadedMetadata = () => {
        this.videoEl?.removeEventListener('loadedmetadata', onLoadedMetadata);
        resolve();
      };
      this.videoEl?.addEventListener('loadedmetadata', onLoadedMetadata);
    });
    
    await this.videoEl.play();
    
    // Try to set focus to infinity for better distance scanning
    const videoTrack = this.stream.getVideoTracks()[0];
    if (videoTrack && videoTrack.getCapabilities) {
      const capabilities = videoTrack.getCapabilities() as any;
      if (capabilities.focusDistance) {
        try {
          await videoTrack.applyConstraints({
            advanced: [{ focusDistance: { ideal: 0 } }] as any // 0 = infinity focus
          });
        } catch (e) {
          // Focus control not supported, continue without it
        }
      }
    }
  }

  async restartCamera(): Promise<void> {
    this.cameraRecoveryAttempts = 0;
    this.error = '';
    this.success = '';
    this.stopCamera();
    await new Promise(resolve => setTimeout(resolve, 500));
    await this.initCamera();
  }
 
  stopCamera(): void {
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }
    this.isCameraReady = false;
    this.stopCameraMonitoring();
  }

  private startCameraMonitoring(): void {
    this.stopCameraMonitoring(); // Clear any existing interval
    
    this.cameraCheckInterval = setInterval(() => {
      this.checkCameraHealth();
    }, 3000); // Check every 3 seconds
  }

  private stopCameraMonitoring(): void {
    if (this.cameraCheckInterval) {
      clearInterval(this.cameraCheckInterval);
      this.cameraCheckInterval = null;
    }
  }

  private async checkCameraHealth(): Promise<void> {
    if (!this.videoEl || !this.stream) return;

    // Check if video is actually playing and has content
    const isVideoPlaying = !this.videoEl.paused && !this.videoEl.ended && this.videoEl.readyState > 2;
    const hasVideoDimensions = this.videoEl.videoWidth > 0 && this.videoEl.videoHeight > 0;
    const streamActive = this.stream.active && this.stream.getVideoTracks().length > 0;
    
    if (!isVideoPlaying || !hasVideoDimensions || !streamActive) {
      console.log('Camera health check failed, attempting recovery...');
      await this.recoverCamera();
    }
  }

  private async recoverCamera(): Promise<void> {
    if (this.cameraRecoveryAttempts >= this.MAX_RECOVERY_ATTEMPTS) {
      this.error = 'Caméra non récupérable après plusieurs tentatives';
      this.useCamera = false;
      this.stopCameraMonitoring();
      return;
    }

    this.cameraRecoveryAttempts++;
    this.error = `Récupération de la caméra... (${this.cameraRecoveryAttempts}/${this.MAX_RECOVERY_ATTEMPTS})`;

    try {
      // Stop current stream
      if (this.stream) {
        this.stream.getTracks().forEach(t => t.stop());
        this.stream = null;
      }

      // Wait a bit before restarting
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Restart stream
      await this.startStream();
      this.isCameraReady = true;
      this.error = '';
      this.cameraRecoveryAttempts = 0;
      
      this.success = 'Caméra récupérée avec succès';
      setTimeout(() => { this.success = ''; }, 2000);
    } catch (e) {
      this.error = `Échec de récupération (${this.cameraRecoveryAttempts}/${this.MAX_RECOVERY_ATTEMPTS})`;
      // Will retry on next health check
    }
  }

  async toggleFacingMode(): Promise<void> {
    this.currentFacingMode = this.currentFacingMode === 'environment' ? 'user' : 'environment';
    await this.startStream();
  }

  async tapToFocus(event: MouseEvent): Promise<void> {
    if (!this.stream || !this.videoEl) return;

    const videoTrack = this.stream.getVideoTracks()[0];
    if (!videoTrack || !videoTrack.getCapabilities) return;

    const capabilities = videoTrack.getCapabilities() as any;
    if (!capabilities.focusDistance) return;

    // Calculate tap position relative to video
    const rect = this.videoEl.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;

    try {
      // Set focus to the tapped area
      await videoTrack.applyConstraints({
        advanced: [{ 
          focusDistance: { ideal: 0.1 }, // Close focus
          pointsOfInterest: [{ x, y }]
        }] as any
      });

      // Show focus indicator
      this.success = 'Focus ajusté';
      setTimeout(() => { this.success = ''; }, 1000);
    } catch (e) {
      // Focus control not supported
    }
  }

  onScan(barcode: string): void {
    const code = this.sanitizeTo13(barcode);
    if (!code) {
      this.error = 'Code-barres invalide (doit faire exactement 13 chiffres)';
      return;
    }
    
    // If no session document type is set, show the selection modal
    if (!this.sessionDocumentType) {
      this.showDocumentTypeSelection(code);
    } else {
      // Process the barcode according to the session document type
      this.processBarcodeWithSessionType(code);
    }
  }

  private parseAndAddBarcode(barcode: string): void {
    // Expect exactly 13 digits (already sanitized)
    if (barcode.length !== 13) {
      this.error = 'Code-barres invalide (doit faire exactement 13 chiffres)';
      this.playErrorSound();
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
        this.error = 'Code-barres invalide (format incorrect)';
        this.playErrorSound();
        return;
      }

      if (quantity < 1 || quantity > 99999) {
        this.error = 'Quantité invalide (1-99999)';
        this.playErrorSound();
        return;
      }

      if (articleId < 0 || articleId > 999) {
        this.error = 'ID article invalide (0-999)';
        this.playErrorSound();
        return;
      }

      // Check if product exists in sous-produits first
      const productName = this.getProductName(articleId);
      if (!productName) {
        this.error = `Produit ${articleId} non trouvé dans les sous-produits`;
        this.playErrorSound();
        return;
      }
      
      // Use parent product ID if available, otherwise use the produit de caisse ID
      const produitDeCaisse = this.produitsDeCaisseCache.get(articleId);
      const productId = produitDeCaisse?.parentProductId || articleId;
      
      // Find existing item or create new one
      const existingItemIndex = this.scannedItems.findIndex(item => item.articleId === productId);
      
      if (existingItemIndex >= 0) {
        // Update existing item - add quantity and increment count
        this.scannedItems[existingItemIndex].quantity += quantity;
        this.scannedItems[existingItemIndex].count += 1;
        this.scannedItems[existingItemIndex].lastScanned = new Date();
        this.success = `${productName} scanné (${this.scannedItems[existingItemIndex].count}x, Qty: ${this.scannedItems[existingItemIndex].quantity})`;
      } else {
        // Add new item
        this.scannedItems.push({
          articleId: productId,
          productName: productName,
          quantity,
          count: 1,
          lastScanned: new Date()
        });
        this.success = `Nouveau ${productName} ajouté (Qty: ${quantity})`;
      }

      // Play success sound
      this.playSuccessSound();

      // Clear success message after 3 seconds
      setTimeout(() => { this.success = ''; }, 3000);
      this.error = '';

    } catch (err) {
      this.error = 'Erreur lors du parsing du code-barres';
      this.playErrorSound();
    }
  }

  submitManual(): void {
    const code = this.sanitizeTo13((this.manualBarcode || '').trim());
    if (!code) return;
    this.manualBarcode = '';
    this.parseAndAddBarcode(code);
  }

  clearScannedItems(): void {
    this.scannedItems = [];
    this.success = 'Liste des articles effacée';
    setTimeout(() => { this.success = ''; }, 3000);
  }

  removeScannedItem(articleId: number): void {
    this.scannedItems = this.scannedItems.filter(item => item.articleId !== articleId);
  }

  getGroupedScannedItems(): Array<{
    mainProduct: ProduitDeCaisse | null;
    subProducts: Array<{
      articleId: number;
      productName: string;
      quantity: number;
      count: number;
      lastScanned: Date;
    }>;
  }> {
    return this.groupScannedItemsByProduitDeCaisse();
  }

  private submitScan(code: string): void {
    this.loading = true;
    this.error = '';
    this.success = '';
    
    // Map session document type to backend document type
    let documentType: string | undefined;
    if (this.sessionDocumentType) {
      switch (this.sessionDocumentType) {
        case 'sortie':
          documentType = 'BON_EXPEDITION';
          break;
        case 'transfert':
          documentType = 'BON_TRANSFERT';
          break;
        case 'livraison':
          documentType = 'BON_ENTREE_DEPOT';
          break;
      }
    }

    const call$ = this.stockDocs.scanBarcode(code, this.depotId, documentType);

    call$.subscribe({
      next: (result) => {
        this.loading = false;
        if (result.isNewDocument) {
          this.success = `Nouveau document créé: ${result.document.numero}`;
          // Navigate to the new document
          this.router.navigate([`/stock/documents/${this.getDocumentRoute(result.document.type)}/${result.document.id}`]);
        } else {
          this.success = `Produit scanné: ${code}`;
        }
        this.error = '';
        setTimeout(() => { this.success = ''; }, 3000);
      },
      error: (error) => {
        this.loading = false;
        this.error = `Code-barres introuvable: ${code}`;
        this.success = '';
        setTimeout(() => { this.error = ''; }, 5000);
      }
    });
  }

  private getDocumentRoute(documentType: string): string {
    switch (documentType) {
      case 'BON_EXPEDITION':
        return 'bon-sortie';
      case 'BON_TRANSFERT':
        return 'bon-transfert';
      case 'BON_ENTREE_DEPOT':
        return 'bon-entree';
      case 'BON_ENTREE_MAGASIN':
        return 'bon-livraison';
      default:
        return 'bon-entree';
    }
  }

  private getReader(): BrowserMultiFormatReader {
    if (!this.zxingReader) {
      const hints = new Map();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [
        BarcodeFormat.EAN_13,
        BarcodeFormat.CODE_128,
        BarcodeFormat.EAN_8,
        BarcodeFormat.UPC_A,
        BarcodeFormat.CODE_39,
        BarcodeFormat.QR_CODE
      ]);
      hints.set(DecodeHintType.TRY_HARDER, true);
      hints.set(DecodeHintType.CHARACTER_SET, 'UTF-8');
      this.zxingReader = new BrowserMultiFormatReader(hints);
    }
    return this.zxingReader;
  }

  private preprocessImage(canvas: HTMLCanvasElement): HTMLCanvasElement[] {
    // Only return original image for maximum speed
    return [canvas];
  }

  async onImageCapture(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files && input.files[0];
    if (!file) return;

    // Cooldown prevention
    const now = Date.now();
    if (now - this.lastCaptureTime < this.CAPTURE_COOLDOWN) {
      this.error = 'Veuillez attendre avant de capturer à nouveau';
      setTimeout(() => { this.error = ''; }, 1000);
      (event.target as HTMLInputElement).value = '';
      return;
    }
    this.lastCaptureTime = now;

    this.isCapturing = true;
    this.error = '';
    this.success = '';

    try {
      // Draw the image to a canvas to normalize orientation/size
      if (!this.canvas) this.canvas = document.createElement('canvas');
      const canvas = this.canvas;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        this.error = 'Impossible d\'accéder au canvas';
        return;
      }
      const img = new Image();
      const url = URL.createObjectURL(file);
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Image load failed'));
        img.src = url;
      });
      // Fit image into a reasonable size for decoding
      const maxW = 1280;
      const scale = Math.min(1, maxW / img.width);
      canvas.width = Math.max(1, Math.floor(img.width * scale));
      canvas.height = Math.max(1, Math.floor(img.height * scale));
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);

      const reader = this.getReader();
      const processedCanvases = this.preprocessImage(canvas);
      
      // Try with very short timeout to prevent UI freezing
      let result: any = null;
      try {
        // Very short timeout - if no barcode found quickly, give up
        result = await Promise.race([
          reader.decodeFromCanvas(processedCanvases[0]),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 300))
        ]);
      } catch (e) {
        // Timeout or decode error - no barcode found
        result = null;
      }
      
      const text = result?.getText();
      if (text && text.trim()) {
        this.onScan(text.trim());
      } else {
        this.error = 'Aucun code-barres détecté dans la photo';
        this.playErrorSound();
      }
    } catch (err: any) {
      this.error = err?.message ? `Erreur: ${err.message}` : 'Échec de la détection depuis la photo';
      this.playErrorSound();
    } finally {
      this.isCapturing = false;
      (event.target as HTMLInputElement).value = '';
    }
  }

  async captureFromVideo(): Promise<void> {
    if (!this.videoEl || !this.isCameraReady) return;

    // Cooldown prevention
    const now = Date.now();
    if (now - this.lastCaptureTime < this.CAPTURE_COOLDOWN) {
      this.error = 'Veuillez attendre avant de capturer à nouveau';
      setTimeout(() => { this.error = ''; }, 1000);
      return;
    }
    this.lastCaptureTime = now;

    this.isCapturing = true;
    this.error = '';
    this.success = '';

    try {
      if (this.videoEl.videoWidth === 0 || this.videoEl.videoHeight === 0) {
        this.error = 'Vidéo pas encore prête, réessayez';
        return;
      }

      if (!this.canvas) this.canvas = document.createElement('canvas');
      const canvas = this.canvas;
      const context = canvas.getContext('2d');
      if (!context) {
        this.error = 'Impossible d\'accéder au canvas';
        return;
      }

      // Capture full frame
      canvas.width = this.videoEl.videoWidth;
      canvas.height = this.videoEl.videoHeight;
      context.drawImage(this.videoEl, 0, 0);

      const reader = this.getReader();
      const processedCanvases = this.preprocessImage(canvas);
      
      // Try with very short timeout to prevent UI freezing
      let result: any = null;
      try {
        // Very short timeout - if no barcode found quickly, give up
        result = await Promise.race([
          reader.decodeFromCanvas(processedCanvases[0]),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 300))
        ]);
      } catch (e) {
        // Timeout or decode error - no barcode found
        result = null;
      }
      
      const text = result?.getText();
      if (text && text.trim()) {
        this.onScan(text.trim());
      } else {
        this.error = 'Aucun code-barres détecté dans l\'image capturée';
        this.playErrorSound();
      }
    } catch (err: any) {
      this.error = err?.message ? `Erreur: ${err.message}` : 'Échec de la capture et détection';
      this.playErrorSound();
    } finally {
      this.isCapturing = false;
    }
  }

  rescanBarcode(barcode: string): void {
    this.onScan(barcode);
  }

  showQuantityNumpad(barcode: string): void {
    this.currentBarcode = barcode;
    this.quantityInput = '';
    this.colisInput = '';
    this.currentInputType = 'quantity';
    this.showNumpad = true;
  }

  showQuantityNumpadForItem(item: any): void {
    // Create a barcode from the item's articleId for consistency
    // Format: 2321 + articleId (3 digits) + quantity (5 digits) + checksum
    const articleIdStr = item.articleId.toString().padStart(3, '0');
    const quantityStr = item.quantity.toString().slice(-5).padStart(5, '0');
    const barcode = `2321${articleIdStr}${quantityStr}4`; // Simple checksum
    
    this.currentBarcode = barcode;
    this.quantityInput = item.quantity.toString();
    this.colisInput = item.count.toString();
    this.currentInputType = 'quantity';
    this.showNumpad = true;
  }

  closeNumpad(): void {
    this.showNumpad = false;
    this.currentBarcode = '';
    this.quantityInput = '';
    this.colisInput = '';
    this.currentInputType = 'quantity';
  }

  addDigit(digit: string): void {
    const currentInput = this.currentInputType === 'quantity' ? this.quantityInput : this.colisInput;
    const maxLength = this.currentInputType === 'quantity' ? 9 : 5; // Allow up to 9 digits for quantity
    if (currentInput.length < maxLength) {
      if (this.currentInputType === 'quantity') {
        this.quantityInput += digit;
      } else {
        this.colisInput += digit;
      }
    }
  }

  clearCurrentInput(): void {
    if (this.currentInputType === 'quantity') {
      this.quantityInput = '';
    } else {
      this.colisInput = '';
    }
  }

  backspaceCurrentInput(): void {
    if (this.currentInputType === 'quantity') {
      if (this.quantityInput.length > 0) {
        this.quantityInput = this.quantityInput.slice(0, -1);
      }
    } else {
      if (this.colisInput.length > 0) {
        this.colisInput = this.colisInput.slice(0, -1);
      }
    }
  }

  switchToColisInput(): void {
    if (this.quantityInput && parseInt(this.quantityInput, 10) > 0) {
      this.currentInputType = 'colis';
    }
  }

  confirmInput(): void {
    const quantity = parseInt(this.quantityInput, 10);
    const colis = parseInt(this.colisInput, 10);
    
    if (this.currentInputType === 'quantity') {
      if (quantity > 0) {
        this.switchToColisInput();
      }
    } else {
      if (quantity > 0 && colis > 0) {
        this.addBarcodeWithCustomQuantityAndColis(this.currentBarcode, quantity, colis);
        this.closeNumpad();
      }
    }
  }

  private addBarcodeWithCustomQuantityAndColis(barcode: string, customQuantity: number, customColis: number): void {
    const code = this.sanitizeTo13(barcode);
    if (!code) {
      this.error = 'Code-barres invalide (doit faire exactement 13 chiffres)';
      return;
    }

    try {
      // Parse the barcode to get article ID
      const articleIdStr = code.substring(4, 7);
      const articleId = parseInt(articleIdStr, 10);

      if (isNaN(articleId)) {
        this.error = 'Code-barres invalide (format incorrect)';
        this.playErrorSound();
        return;
      }

      if (articleId < 0 || articleId > 999) {
        this.error = 'ID article invalide (0-999)';
        this.playErrorSound();
        return;
      }

      // Check if product exists in sous-produits first
      const productName = this.getProductName(articleId);
      if (!productName) {
        this.error = `Produit ${articleId} non trouvé dans les sous-produits`;
        this.playErrorSound();
        return;
      }
      
      // Use parent product ID if available, otherwise use the produit de caisse ID
      const produitDeCaisse = this.produitsDeCaisseCache.get(articleId);
      const productId = produitDeCaisse?.parentProductId || articleId;
      
      // Find existing item or create new one
      const existingItemIndex = this.scannedItems.findIndex(item => item.articleId === productId);
      
      if (existingItemIndex >= 0) {
        // Update existing item - set exact quantity and colis
        this.scannedItems[existingItemIndex].quantity = customQuantity;
        this.scannedItems[existingItemIndex].count = customColis;
        this.scannedItems[existingItemIndex].lastScanned = new Date();
        this.success = `${productName} mis à jour (Colis: ${customColis}, Qty: ${customQuantity})`;
      } else {
        // Add new item with custom quantity and colis
        this.scannedItems.push({
          articleId: productId,
          productName: productName,
          quantity: customQuantity,
          count: customColis,
          lastScanned: new Date()
        });
        this.success = `Nouveau ${productName} ajouté (Colis: ${customColis}, Qty: ${customQuantity})`;
      }

      // Play success sound
      this.playSuccessSound();

      // Clear success message after 3 seconds
      setTimeout(() => { this.success = ''; }, 3000);
      this.error = '';

    } catch (err) {
      this.error = 'Erreur lors du parsing du code-barres';
      this.playErrorSound();
    }
  }


  private sanitizeTo13(input: string): string | null {
    const digits = (input || '').replace(/\D+/g, '');
    if (!digits) return null;
    if (digits.length < 13) return null;
    // Always use the last 13 digits to avoid prefixes/suffixes from some readers
    return digits.slice(-13);
  }

  // Helper method for template
  parseInt(value: string): number {
    return parseInt(value, 10);
  }

  // Helper method to get product family name
  getProductFamilyName(product: ProduitDeCaisse | null): string {
    if (!product) return 'Général';
    
    // Debug: Log the product and famille structure
    console.log('getProductFamilyName - Product:', product.name, 'Famille:', product.famille, 'Type:', typeof product.famille);
    
    // If famille is a string, return it directly
    if (typeof product.famille === 'string') {
      return product.famille;
    }
    
    // If famille is an object with a name property, return the name
    if (product.famille && typeof product.famille === 'object' && 'name' in product.famille) {
      console.log('Famille object name:', product.famille.name);
      return product.famille.name || 'Général';
    }
    
    // Fallback
    console.log('Using fallback for famille');
    return 'Général';
  }

  // Document type selection methods
  showDocumentTypeSelection(barcode?: string): void {
    if (barcode) {
      this.currentBarcode = barcode;
    }
    this.showDocumentTypeModal = true;
    this.selectedDocumentType = null;
    this.selectedDestinationDepot = null;
    this.selectedClient = null;
  }

  closeDocumentTypeModal(): void {
    this.showDocumentTypeModal = false;
    this.currentBarcode = '';
    this.selectedDocumentType = null;
  }

  selectDocumentType(type: 'sortie' | 'livraison' | 'transfert'): void {
    this.selectedDocumentType = type;
    this.sessionDocumentType = type; // Set the session document type
    this.showDocumentTypeModal = false;
    // Refresh available destination depots based on the chosen type
    this.availableDepots = this.filterAvailableDestinationDepots(this.depots());
    
    if (type === 'sortie') {
      this.showDepotSelectionModal = true;
    } else if (type === 'transfert') {
      this.showDepotSelectionModal = true;
    } else if (type === 'livraison') {
      this.showClientSelectionModal = true;
    }
  }

  // Depot selection methods
  closeDepotSelectionModal(): void {
    this.showDepotSelectionModal = false;
    this.selectedDestinationDepot = null;
  }

  selectDestinationDepot(depot: Depot): void {
    this.selectedDestinationDepot = depot;
  }

  confirmDepotSelection(): void {
    if (this.selectedDestinationDepot) {
      this.showDepotSelectionModal = false;
      // Process bon de sortie or bon de transfert with selected depot
      if (this.sessionDocumentType === 'sortie') {
        this.processBonDeSortie();
      } else if (this.sessionDocumentType === 'transfert') {
        this.processBonDeTransfert();
      }
    }
  }

  // Client selection methods
  closeClientSelectionModal(): void {
    this.showClientSelectionModal = false;
    this.selectedClient = null;
    this.clientSearchQuery = '';
    this.filteredClients = this.allClients;
  }

  selectClient(client: Client): void {
    this.selectedClient = client;
  }

  filterClients(): void {
    if (!this.clientSearchQuery.trim()) {
      this.filteredClients = this.allClients;
      return;
    }
    
    const query = this.clientSearchQuery.toLowerCase();
    this.filteredClients = this.allClients.filter(client => 
      client.firstName.toLowerCase().includes(query) ||
      client.lastName.toLowerCase().includes(query) ||
      (client.phone && client.phone.includes(query))
    );
  }

  confirmClientSelection(): void {
    if (this.selectedClient) {
      this.showClientSelectionModal = false;
      // Process bon de livraison with selected client
      this.processBonDeLivraison();
    }
  }


  // Document processing methods
  private processBarcodeWithSessionType(barcode: string): void {
    this.currentBarcode = barcode;
    
    if (this.sessionDocumentType === 'sortie' || this.sessionDocumentType === 'transfert') {
      // For bon de sortie or bon de transfert, check if depot is already selected
      if (this.selectedDestinationDepot) {
        this.parseAndAddBarcode(barcode);
      } else {
        this.showDepotSelectionModal = true;
      }
    } else if (this.sessionDocumentType === 'livraison') {
      // For bon de livraison, check if client is already selected
      if (this.selectedClient) {
        this.parseAndAddBarcode(barcode);
      } else {
        this.showClientSelectionModal = true;
      }
    }
  }

  private processBonDeSortie(): void {
    // Just close the modal and wait for user to scan barcodes
    // The numpad will open when they actually scan a barcode
    this.showDepotSelectionModal = false;
    this.success = 'Bon de sortie configuré. Scannez maintenant les produits.';
    setTimeout(() => { this.success = ''; }, 3000);
  }

  private processBonDeLivraison(): void {
    // Just close the modal and wait for user to scan barcodes
    // The numpad will open when they actually scan a barcode
    this.showClientSelectionModal = false;
    this.success = 'Bon de livraison configuré. Scannez maintenant les produits.';
    setTimeout(() => { this.success = ''; }, 3000);
  }

  private processBonDeTransfert(): void {
    // Just close the modal and wait for user to scan barcodes
    // The numpad will open when they actually scan a barcode
    this.showDepotSelectionModal = false;
    this.success = 'Bon de transfert configuré. Scannez maintenant les produits.';
    setTimeout(() => { this.success = ''; }, 3000);
  }

  // UI helper methods
  getDepotCardClasses(depot: Depot): string {
    const isSelected = this.selectedDestinationDepot?.id === depot.id;
    return isSelected 
      ? 'p-4 bg-blue-50 border-2 border-blue-500 rounded-xl'
      : 'p-4 bg-white border border-slate-200 rounded-xl';
  }

  getClientCardClasses(client: Client): string {
    const isSelected = this.selectedClient?.id === client.id;
    return isSelected 
      ? 'bg-green-50 border-green-500'
      : 'bg-white border-slate-200';
  }

  getTypeBadgeClasses(type: string): string {
    switch (type) {
      case 'magasin': return 'bg-blue-100 text-blue-800';
      case 'entrepot': return 'bg-purple-100 text-purple-800';
      case 'boutique': return 'bg-pink-100 text-pink-800';
      default: return 'bg-slate-100 text-slate-800';
    }
  }

  getTypeLabel(type: string): string {
    switch (type) {
      case 'magasin': return 'Magasin';
      case 'entrepot': return 'Entrepôt';
      case 'boutique': return 'Boutique';
      default: return type;
    }
  }

  getClientTypeBadgeClasses(type: string): string {
    switch (type) {
      case 'INDIVIDUAL': return 'bg-green-100 text-green-800';
      case 'BUSINESS': return 'bg-blue-100 text-blue-800';
      case 'WHOLESALE': return 'bg-purple-100 text-purple-800';
      default: return 'bg-slate-100 text-slate-800';
    }
  }

  getClientTypeLabel(type: string): string {
    switch (type) {
      case 'INDIVIDUAL': return 'Particulier';
      case 'BUSINESS': return 'Professionnel';
      case 'WHOLESALE': return 'Gros';
      default: return type;
    }
  }

  getClientInitials(client: Client): string {
    return (client.firstName.charAt(0) + client.lastName.charAt(0)).toUpperCase();
  }

  getDepotLogo(depotId: number): string | null {
    // This would typically come from a service that manages depot logos
    // For now, return null to show the default icon
    return null;
  }

  onImageError(event: any): void {
    // Handle image loading errors
    console.log('Image failed to load:', event.target.src);
    event.target.style.display = 'none';
  }

  printDocument(): void {
    if (!this.sessionDocumentType || this.scannedItems.length === 0) {
      this.error = 'Aucun document à imprimer';
      return;
    }

    // For bon de sortie, show vehicle selection modal first
    if (this.sessionDocumentType === 'sortie') {
      this.showVehicleSelectionModal = true;
      this.vehicleSelectionStep = 'vehicle';
      this.selectedVehicle = null;
      this.selectedDriver = null;
      this.destination = '';
      this.setDefaultValidationDates();
      return;
    }

    // For bon de transfert, show driver selection modal first
    if (this.sessionDocumentType === 'transfert') {
      this.showVehicleSelectionModal = true;
      this.vehicleSelectionStep = 'driver';
      this.selectedVehicle = null;
      this.selectedDriver = null;
      this.destination = '';
      this.validationFromDate = '';
      this.validationToDate = '';
      return;
    }

    // Save document to database and print
    this.printDocumentDirectly();
  }

  private printDocumentDirectly(): void {
    this.loading = true;
    this.error = '';
    this.success = '';
    
    // First save the document to database
    this.saveDocumentToDatabase().then((savedDocument) => {
      if (savedDocument) {
        const sessionType = this.sessionDocumentType || 'livraison';
        // Ensure client details are present for livraison prints
        if (sessionType === 'livraison' && this.selectedClient) {
          (savedDocument as any).client = this.selectedClient;
        }
        // Ensure destination details are present for sortie prints
        if (sessionType === 'sortie') {
          (savedDocument as any).destination = this.destination;
          (savedDocument as any).validationFromDate = this.validationFromDate;
          (savedDocument as any).validationToDate = this.validationToDate;
        }
        const printContent = buildScanLikeDocumentHtmlFromDocument(savedDocument as any, sessionType, this.settings);
        let documentTitle = 'Bon de livraison';
        if (sessionType === 'sortie') {
          documentTitle = 'Bon de sortie';
        } else if (sessionType === 'transfert') {
          documentTitle = 'Bon de transfert';
        }

        const printWindow = window.open('', '_blank');
        if (!printWindow) {
          this.loading = false;
          this.error = 'Impossible d\'ouvrir la fenêtre d\'impression';
          return;
        }

        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>${documentTitle}</title>
            <style>
              ${getScanPrintStyles()}
            </style>
          </head>
          <body>
            ${printContent}
          </body>
          </html>
        `);

        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
          printWindow.print();
          printWindow.close();
          
          // Show success notification
          this.loading = false;
          this.success = `${documentTitle} généré avec succès!`;
          
          // Clear scanned items and reset session
          this.clearScannedItems();
          this.sessionDocumentType = null;
          this.selectedDestinationDepot = null;
          this.selectedClient = null;
          this.selectedVehicle = null;
          this.selectedDriver = null;
          
          // Auto-hide success message after 3 seconds
          setTimeout(() => {
            this.success = '';
          }, 3000);
        }, 500);
      }
    }).catch((error) => {
      console.error('Error saving document:', error);
      this.loading = false;
      this.error = 'Erreur lors de la sauvegarde du document: ' + (error?.message || 'Erreur inconnue');
    });
  }

  private async loadProduitsDeCaisse(): Promise<void> {
    try {
      const produits = await this.produitsDeCaisseService.getActiveProduitsDeCaisse().toPromise();
      if (produits) {
        produits.forEach(produit => {
          this.produitsDeCaisseCache.set(produit.id, produit);
        });
      }
    } catch (error) {
      console.error('Error loading produits de caisse:', error);
    }
  }

  private groupScannedItemsByProduitDeCaisse(): Array<{
    mainProduct: ProduitDeCaisse | null;
    subProducts: Array<{
      articleId: number;
      productName: string;
      quantity: number;
      count: number;
      lastScanned: Date;
    }>;
  }> {
    const groups = new Map<number, Array<{
      articleId: number;
      productName: string;
      quantity: number;
      count: number;
      lastScanned: Date;
    }>>();

    // Group scanned items by their parent product (if they are sous-produits)
    this.scannedItems.forEach(item => {
      // Check if this scanned item is a sous-produit (produit-de-caisse)
      const scannedProduit = this.produitsDeCaisseCache.get(item.articleId);
      if (scannedProduit && scannedProduit.parentProductId) {
        // This is a sous-produit, group it under its parent product
        const parentProductId = scannedProduit.parentProductId;
        if (!groups.has(parentProductId)) {
          groups.set(parentProductId, []);
        }
        groups.get(parentProductId)!.push(item);
      } else {
        // If it's a sous-produit without parent, create a standalone group
        const standaloneKey = -item.articleId; // Use negative ID to avoid conflicts
        if (!groups.has(standaloneKey)) {
          groups.set(standaloneKey, []);
        }
        groups.get(standaloneKey)!.push(item);
      }
    });

    // Convert to the required format
    const result: Array<{
      mainProduct: ProduitDeCaisse | null;
      subProducts: Array<{
        articleId: number;
        productName: string;
        quantity: number;
        count: number;
        lastScanned: Date;
      }>;
    }> = [];

    for (const [key, items] of groups) {
      if (key > 0) {
        // This is a parent product group - find the parent product
        const parentProduct = this.productsCache.get(key);
        if (parentProduct) {
          result.push({
            mainProduct: null, // We don't have a ProduitDeCaisse for the parent, just the Product
            subProducts: items
          });
        }
      } else {
        // This is a standalone sous-produit group
        result.push({
          mainProduct: null,
          subProducts: items
        });
      }
    }

    return result;
  }

  private generateGroupedItemsRows(groupedItems: Array<{
    mainProduct: ProduitDeCaisse | null;
    subProducts: Array<{
      articleId: number;
      productName: string;
      quantity: number;
      count: number;
      lastScanned: Date;
    }>;
  }>): string {
    let rows = '';
    
    console.log('Generating rows for grouped items:', groupedItems);
    
    groupedItems.forEach((group, groupIndex) => {
      console.log(`Processing group ${groupIndex}:`, group);
      
      if (group.subProducts.length > 0) {
        // Get the first sub-product to determine if it's a sous-produit
        const firstSubProduct = group.subProducts[0];
        const scannedProduit = this.produitsDeCaisseCache.get(firstSubProduct.articleId);
        
        console.log(`First sub-product:`, firstSubProduct);
        console.log(`Scanned produit:`, scannedProduit);
        
        if (scannedProduit && scannedProduit.parentProductId) {
          // This is a group of sous-produits, show parent product info
          const parentProduct = this.productsCache.get(scannedProduit.parentProductId);
          console.log(`Parent product:`, parentProduct);
          
          const totalQuantity = group.subProducts.reduce((sum, item) => sum + item.quantity, 0);
          const totalCount = group.subProducts.reduce((sum, item) => sum + item.count, 0);
          
          // Calculate pricing for the group
          let totalHT = 0;
          let totalTVA = 0;
          let totalTTC = 0;
          
          group.subProducts.forEach(subProduct => {
            const produit = this.produitsDeCaisseCache.get(subProduct.articleId);
            if (produit) {
              const prixUnitaire = produit.prix_vente_TTC || 0;
              const tva = produit.tva || 19;
              const quantite = subProduct.quantity / 1000; // Convert to kg
              
              const montantTTC = prixUnitaire * quantite;
              const montantHT = montantTTC / (1 + tva / 100);
              const montantTVA = montantTTC - montantHT;
              
              totalHT += montantHT;
              totalTVA += montantTVA;
              totalTTC += montantTTC;
            }
          });
          
          console.log(`Total quantity: ${totalQuantity}, Total count: ${totalCount}`);
          console.log(`Pricing - HT: ${totalHT}, TVA: ${totalTVA}, TTC: ${totalTTC}`);
          
          // Parent product row with sub-products in same designation
          const subProductNames = group.subProducts.map(sub => sub.productName).join(', ');
          const parentProductName = parentProduct ? parentProduct.name : `Produit Parent #${scannedProduit.parentProductId}`;
          const parentProductId = parentProduct ? parentProduct.id : scannedProduit.parentProductId;
          
          rows += `
            <tr class="main-product-row">
              <td class="text-center font-semibold">${parentProductId}</td>
              <td class="font-semibold">${parentProductName} (${subProductNames})</td>
              <td class="text-center font-semibold">${(totalQuantity/1000).toFixed(3)} kg</td>
              <td class="text-center font-semibold">${totalCount}</td>
              ${this.sessionDocumentType !== 'sortie' ? `
                <td class="text-center font-semibold">${totalHT.toFixed(3)} DT</td>
                <td class="text-center font-semibold">${totalTVA.toFixed(3)} DT</td>
                <td class="text-center font-semibold">${totalTTC.toFixed(3)} DT</td>
              ` : ''}
            </tr>
          `;
        } else {
          // This is a standalone sous-produit (no parent)
          console.log(`Standalone sous-produit:`, group.subProducts);
          group.subProducts.forEach(item => {
            const produit = this.produitsDeCaisseCache.get(item.articleId);
            if (produit) {
              const prixUnitaire = produit.prix_vente_TTC || 0;
              const tva = produit.tva || 19;
              const quantite = item.quantity / 1000; // Convert to kg
              
              const montantTTC = prixUnitaire * quantite;
              const montantHT = montantTTC / (1 + tva / 100);
              const montantTVA = montantTTC - montantHT;
              
              rows += `
                <tr>
                  <td class="text-center">${item.articleId}</td>
                  <td>${item.productName}</td>
                  <td class="text-center">${quantite.toFixed(3)} kg</td>
                  <td class="text-center">${item.count}</td>
                  ${this.sessionDocumentType !== 'sortie' ? `
                    <td class="text-center">${montantHT.toFixed(3)} DT</td>
                    <td class="text-center">${montantTVA.toFixed(3)} DT</td>
                    <td class="text-center">${montantTTC.toFixed(3)} DT</td>
                  ` : ''}
                </tr>
              `;
            }
          });
        }
      }
    });
    
    console.log('Generated rows:', rows);
    return rows;
  }

  private async saveDocumentToDatabase(): Promise<any> {
    try {
      const documentData = await this.prepareDocumentData();
      
      // Use the correct API endpoint based on document type
      let savedDocument;
      if (this.sessionDocumentType === 'transfert' && this.selectedDestinationDepot) {
        // Use the transfer-specific endpoint
        savedDocument = await this.stockDocs.createTransfer(
          this.depotId,
          this.selectedDestinationDepot.id,
          documentData.items,
          documentData.notes
        ).toPromise();
      } else {
        // Use the general document endpoint
        savedDocument = await this.stockDocs.createDocument(documentData).toPromise();
      }
      
      console.log('Document saved:', savedDocument);
      return savedDocument;
    } catch (error) {
      console.error('Error saving document to database:', error);
      throw error;
    }
  }

  private async prepareDocumentData(): Promise<any> {
    const documentType = this.getDocumentTypeForAPI();
    const documentNumber = await this.getNextDocumentNumber(documentType);
    
    // Calculate totals only for non-sortie documents
    let totalHT = 0;
    let totalTVA = 0;
    let totalTTC = 0;
    
    if (documentType !== 'BON_EXPEDITION') {
      this.scannedItems.forEach(item => {
        const produit = this.produitsDeCaisseCache.get(item.articleId);
        if (produit) {
          const prixUnitaire = produit.prix_vente_TTC || 0;
          const tva = produit.tva || 19;
          const quantite = item.quantity / 1000;
          
          const montantTTC = prixUnitaire * quantite;
          // Correct TVA calculation: HT = TTC / (1 + TVA), TVA = TTC - HT
          const tvaFraction = tva <= 1 ? tva : tva / 100;
          const montantHT = Math.round((montantTTC / (1 + tvaFraction)) * 1000) / 1000;
          const montantTVA = Math.round((montantTTC - montantHT) * 1000) / 1000;
          
          totalHT += montantHT;
          totalTVA += montantTVA;
          totalTTC += montantTTC;
        }
      });
    }

    const documentData: any = {
      type: documentType,
      numero: documentNumber,
      depotId: this.depotId,
      status: 'COMPLETED',
      items: this.scannedItems.map(item => {
        const produit = this.produitsDeCaisseCache.get(item.articleId);
        const baseItem = {
          productId: item.articleId, // Use productId for transfer API
          famille: produit?.famille || 'Général',
          quantity: item.quantity / 1000, // Convert to kg
          count: item.count
        };
        
        // Only include price fields for non-sortie documents
        if (documentType !== 'BON_EXPEDITION') {
          return {
            ...baseItem,
            prixUnitaire: produit?.prix_vente_TTC || 0,
            tva: produit?.tva || 19,
            montantHT: produit ? (produit.prix_vente_TTC * (item.quantity / 1000)) / (1 + (produit.tva || 19) / 100) : 0,
            montantTVA: produit ? (produit.prix_vente_TTC * (item.quantity / 1000)) - ((produit.prix_vente_TTC * (item.quantity / 1000)) / (1 + (produit.tva || 19) / 100)) : 0,
            montantTTC: produit ? produit.prix_vente_TTC * (item.quantity / 1000) : 0
          };
        }
        
        return baseItem;
      })
    };

    // Only include totals for non-sortie documents
    if (documentType !== 'BON_EXPEDITION') {
      documentData.totalHT = totalHT;
      documentData.totalTVA = totalTVA;
      documentData.totalTTC = totalTTC;
    }

    // Add specific data based on document type
    if (this.sessionDocumentType === 'sortie') {
      documentData.destinationDepotId = this.selectedDestinationDepot?.id;
      documentData.vehicleId = this.selectedVehicle?.id;
      documentData.driverId = this.selectedDriver?.id;
      documentData.destination = this.destination;
      documentData.validationFromDate = this.validationFromDate;
      documentData.validationToDate = this.validationToDate;
    } else if (this.sessionDocumentType === 'transfert') {
      documentData.destinationDepotId = this.selectedDestinationDepot?.id;
      documentData.driverId = this.selectedDriver?.id;
    } else if (this.sessionDocumentType === 'livraison') {
      documentData.clientId = this.selectedClient?.id;
    }

    return documentData;
  }

  private getDocumentTypeForAPI(): string {
    switch (this.sessionDocumentType) {
      case 'sortie':
        return 'BON_EXPEDITION';
      case 'transfert':
        return 'BON_TRANSFERT';
      case 'livraison':
        return 'BON_ENTREE_MAGASIN';
      default:
        return 'BON_ENTREE_DEPOT';
    }
  }

  private async getNextDocumentNumber(documentType: string): Promise<string> {
    try {
      // Get the next document number from the database
      const nextNumber = await this.stockDocs.getNextDocumentNumber(documentType).toPromise();
      return nextNumber || this.generateDocumentNumber();
    } catch (error) {
      console.error('Error getting next document number:', error);
      // Fallback to generated number
      return this.generateDocumentNumber();
    }
  }

  private generateDocumentContent(savedDocument?: any): string {
    let documentType = 'Bon de livraison';
    if (this.sessionDocumentType === 'sortie') {
      documentType = 'Bon de sortie';
    } else if (this.sessionDocumentType === 'transfert') {
      documentType = 'Bon de transfert';
    }
    
    const currentDate = new Date().toLocaleDateString('fr-FR');
    const currentTime = new Date().toLocaleTimeString('fr-FR');
    const documentNumber = savedDocument?.numero || this.generateDocumentNumber();
    
     let headerInfo = '';
     if (this.sessionDocumentType === 'sortie') {
       // Add vehicle and driver info for bon de sortie
       if (this.selectedVehicle && this.selectedDriver) {
         headerInfo = `
           <div class="info-section">
             <span class="label">Véhicule:</span>
             <span class="value">${this.selectedVehicle.brand?.name || 'N/A'} ${this.selectedVehicle.model || 'N/A'} - ${this.selectedVehicle.matricule || 'N/A'}</span>
           </div>
           <div class="info-section">
             <span class="label">Chauffeur:</span>
             <span class="value">${this.selectedDriver.prenom} ${this.selectedDriver.nom}</span>
           </div>
           <div class="info-section">
             <span class="label">CIN Chauffeur:</span>
             <span class="value">${this.selectedDriver.cin}</span>
           </div>
           <div class="info-section">
             <span class="label">Destination:</span>
             <span class="value">${this.destination}</span>
           </div>
           <div class="info-section">
             <span class="label">Validité du:</span>
             <span class="value">${new Date(this.validationFromDate).toLocaleDateString('fr-FR')}</span>
           </div>
           <div class="info-section">
             <span class="label">Validité au:</span>
             <span class="value">${new Date(this.validationToDate).toLocaleDateString('fr-FR')}</span>
           </div>
         `;
       }
     } else if (this.sessionDocumentType === 'transfert') {
       // Add depot info for bon de transfert
       const currentDepot = this.depots().find(d => d.id === this.depotId);
       if (currentDepot && this.selectedDestinationDepot) {
         headerInfo = `
           <div class="info-section">
             <span class="label">Dépôt source:</span>
             <span class="value">${currentDepot.name} (${currentDepot.code})</span>
             <br>
             <span class="label">Adresse source:</span>
             <span class="value">${currentDepot.address || 'Adresse non renseignée'}</span>
           </div>
           <div class="info-section">
             <span class="label">Dépôt destination:</span>
             <span class="value">${this.selectedDestinationDepot.name} (${this.selectedDestinationDepot.code})</span>
             <br>
             <span class="label">Adresse destination:</span>
             <span class="value">${this.selectedDestinationDepot.address || 'Adresse non renseignée'}</span>
           </div>
         `;
         
         // Add driver info for bon de transfert if selected
         if (this.selectedDriver) {
           headerInfo += `
             <div class="info-section">
               <span class="label">Chauffeur:</span>
               <span class="value">${this.selectedDriver.prenom} ${this.selectedDriver.nom}</span>
             </div>
             <div class="info-section">
               <span class="label">CIN Chauffeur:</span>
               <span class="value">${this.selectedDriver.cin}</span>
             </div>
           `;
         }
       }
     } else if (this.sessionDocumentType === 'livraison' && this.selectedClient) {
      headerInfo = `
        <div class="info-section">
          <span class="label">Client:</span>
          <span class="value">${this.selectedClient.firstName} ${this.selectedClient.lastName}</span>
        </div>
        <div class="info-section">
          <span class="label">Téléphone:</span>
          <span class="value">${this.selectedClient.phone || 'Non renseigné'}</span>
        </div>
      `;
    }

    const groupedItems = this.groupScannedItemsByProduitDeCaisse();
    const itemsRows = this.generateGroupedItemsRows(groupedItems);

    // Use saved document totals or calculate if not available
    let totalHT = savedDocument?.totalHT || 0;
    let totalTVA = savedDocument?.totalTVA || 0;
    let totalTTC = savedDocument?.totalTTC || 0;
    
    // If no saved document, calculate totals only for non-sortie documents
    if (!savedDocument && this.sessionDocumentType !== 'sortie') {
      this.scannedItems.forEach(item => {
        const produit = this.produitsDeCaisseCache.get(item.articleId);
        if (produit) {
          const prixUnitaire = produit.prix_vente_TTC || 0;
          const tva = produit.tva || 19;
          const quantite = item.quantity / 1000; // Convert to kg
          
          const montantTTC = prixUnitaire * quantite;
          const montantHT = montantTTC / (1 + tva / 100);
          const montantTVA = montantTTC - montantHT;
          
          totalHT += montantHT;
          totalTVA += montantTVA;
          totalTTC += montantTTC;
        }
      });
    }

    const totalQuantity = this.scannedItems.reduce((sum, item) => sum + item.quantity, 0);
    const totalColis = this.scannedItems.reduce((sum, item) => sum + item.count, 0);
    
    // Get current depot info
    const currentDepot = this.depots().find(d => d.id === this.depotId);

    return `
      <div class="container">
        <div class="header">
          <div class="company-info">
            <div class="title">${documentType === 'Bon de livraison' ? 'FACTURE' : documentType}</div>
            <div class="subtitle">N° ${documentNumber}</div>
            ${currentDepot ? `
              <div class="company-details">
                <div class="company-name">${currentDepot.name}</div>
                <div class="company-address">${currentDepot.address || 'Adresse non renseignée'}</div>
                <div class="company-contact">
                  ${currentDepot.phone ? `Tél: ${currentDepot.phone}` : ''}
                  ${currentDepot.email ? ` | Email: ${currentDepot.email}` : ''}
                </div>
                <div class="company-fiscal">
                  Matricule Fiscal: ${currentDepot.matriculeFiscal || 'Non renseigné'}
                  ${currentDepot.registreCommerce ? ` | RC: ${currentDepot.registreCommerce}` : ''}
                </div>
              </div>
            ` : ''}
          </div>
          <div class="document-info">
            <div class="info-row">
              <span class="label">Date:</span>
              <span class="value">${currentDate}</span>
            </div>
            <div class="info-row">
              <span class="label">Heure:</span>
              <span class="value">${currentTime}</span>
            </div>
            <div class="info-row">
              <span class="label">Dépôt:</span>
              <span class="value">${currentDepot?.name || 'Non spécifié'}</span>
            </div>
          </div>
        </div>

        ${headerInfo}

        <table>
          <thead>
            <tr>
              <th>Code</th>
              <th>Désignation</th>
              <th>Qté (kg)</th>
              <th>Colis</th>
              ${this.sessionDocumentType !== 'sortie' ? `
                <th>Montant HT</th>
                <th>TVA</th>
                <th>Montant TTC</th>
              ` : ''}
            </tr>
          </thead>
          <tbody>
            ${itemsRows}
          </tbody>
          ${this.sessionDocumentType !== 'sortie' ? `
            <tfoot>
              <tr class="total-row">
                <td colspan="4" class="text-right font-bold">TOTAL:</td>
                <td class="text-center font-bold">${totalHT.toFixed(3)} DT</td>
                <td class="text-center font-bold">${totalTVA.toFixed(3)} DT</td>
                <td class="text-center font-bold">${totalTTC.toFixed(3)} DT</td>
              </tr>
            </tfoot>
          ` : ''}
        </table>

        ${this.sessionDocumentType !== 'sortie' ? `
          <div class="totals-summary">
            <div class="total-breakdown">
              <div class="total-line">
                <span class="label">Total HT:</span>
                <span class="value">${totalHT.toFixed(3)} DT</span>
              </div>
              <div class="total-line">
                <span class="label">Total TVA:</span>
                <span class="value">${totalTVA.toFixed(3)} DT</span>
              </div>
              <div class="total-line total-final">
                <span class="label">Total TTC:</span>
                <span class="value">${totalTTC.toFixed(3)} DT</span>
              </div>
            </div>
          </div>
        ` : ''}

        <div class="footer">
          <div class="signature-section">
            <div class="signature-box">
              <div class="signature-label">Cachet et Signature</div>
              <div class="signature-line"></div>
            </div>
          </div>
          <div class="legal-notice">
            ${this.sessionDocumentType !== 'sortie' ? `
              <p>Arrêté à la somme de: <strong>${this.numberToWords(totalTTC)} dinars tunisiens</strong></p>
            ` : ''}
            <p>Conformément à la législation tunisienne en vigueur</p>
          </div>
        </div>
      </div>
    `;
  }

  private getPrintStyles(): string {
    return `
      body { 
        font-family: 'Times New Roman', serif; 
        margin: 0; 
        padding: 20px; 
        font-size: 12px;
        line-height: 1.5;
        color: #000;
        background: white;
      }
      .container { 
        max-width: 800px; 
        margin: 0 auto; 
        border: 2px solid #000;
        padding: 20px;
        background: white;
      }
      .header { 
        display: flex; 
        justify-content: space-between; 
        margin-bottom: 25px; 
        border-bottom: 3px solid #000; 
        padding-bottom: 15px; 
      }
      .company-info { 
        flex: 1; 
      }
      .document-info { 
        text-align: right; 
        flex: 1; 
      }
      .title { 
        font-size: 24px; 
        font-weight: bold; 
        margin-bottom: 5px; 
        text-transform: uppercase;
        letter-spacing: 1px;
      }
      .subtitle { 
        font-size: 14px; 
        color: #333; 
        margin-bottom: 10px; 
        font-weight: bold;
      }
      .company-details {
        margin-top: 10px;
        font-size: 11px;
      }
      .company-name {
        font-weight: bold;
        font-size: 14px;
        margin-bottom: 5px;
      }
      .company-address, .company-contact, .company-fiscal {
        margin-bottom: 3px;
        color: #333;
      }
      .info-row { 
        margin: 4px 0; 
        font-size: 12px; 
      }
      .info-section {
        margin: 12px 0;
        padding: 10px;
        background-color: #f8f8f8;
        border: 1px solid #ccc;
        border-radius: 4px;
      }
      .label { 
        font-weight: bold; 
        display: inline-block; 
        width: 140px; 
        color: #333;
      }
      .value {
        font-weight: normal;
        color: #000;
      }
      table { 
        width: 100%; 
        border-collapse: collapse; 
        margin: 20px 0; 
        font-size: 12px; 
        border: 2px solid #000;
      }
      th, td { 
        border: 1px solid #000; 
        padding: 8px; 
        text-align: left; 
      }
      th { 
        background-color: #e0e0e0; 
        font-weight: bold; 
        text-align: center; 
        font-size: 11px; 
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      tfoot {
        border-top: 2px solid #000;
      }
      .total-row {
        background-color: #f0f0f0;
        font-weight: bold;
      }
      .text-right { 
        text-align: right; 
      }
      .text-center {
        text-align: center;
      }
      .main-product-row {
        background-color: #f0f8ff;
        font-weight: bold;
        border-top: 2px solid #000;
      }
      .main-product-row td {
        border-top: 2px solid #000;
        font-weight: bold;
      }
      .sub-product-row {
        background-color: #fafafa;
      }
      .sub-product-row td {
        border-top: 1px solid #ccc;
        font-size: 11px;
      }
      .pl-4 {
        padding-left: 16px;
      }
      .text-sm {
        font-size: 11px;
      }
      .font-semibold {
        font-weight: 600;
      }
      .font-bold {
        font-weight: bold;
      }
      .totals-summary {
        margin: 20px 0;
        padding: 15px;
        background-color: #f8f8f8;
        border: 1px solid #ccc;
        border-radius: 4px;
      }
      .total-breakdown {
        display: flex;
        justify-content: flex-end;
        flex-direction: column;
        align-items: flex-end;
      }
      .total-line {
        display: flex;
        justify-content: space-between;
        width: 300px;
        margin-bottom: 5px;
        font-size: 13px;
      }
      .total-final {
        border-top: 1px solid #000;
        padding-top: 5px;
        font-weight: bold;
        font-size: 14px;
      }
      .footer { 
        margin-top: 40px; 
        border-top: 2px solid #000; 
        padding-top: 20px; 
      }
      .signature-section {
        margin-bottom: 20px;
      }
      .signature-box {
        width: 300px;
        margin: 0 auto;
        text-align: center;
      }
      .signature-label {
        font-weight: bold;
        margin-bottom: 10px;
      }
      .signature-line {
        border-bottom: 1px solid #000;
        height: 20px;
      }
      .legal-notice {
        text-align: center;
        font-size: 11px;
        color: #333;
        margin-top: 20px;
      }
      .legal-notice p {
        margin: 5px 0;
      }
      @media print { 
        body { 
          margin: 0; 
          padding: 10px; 
        }
        .container {
          max-width: none;
          border: none;
          padding: 0;
        }
      }
    `;
  }

  // Vehicle selection methods
  closeVehicleSelectionModal(): void {
    this.showVehicleSelectionModal = false;
    this.vehicleSelectionStep = 'vehicle';
    this.selectedVehicle = null;
    this.selectedDriver = null;
    this.vehicleSearchQuery = '';
    this.driverSearchQuery = '';
    this.filteredVehicles = this.availableVehicles;
    this.filteredDrivers = this.availableDrivers;
    this.destination = '';
    this.validationFromDate = '';
    this.validationToDate = '';
  }

  selectVehicle(vehicle: Vehicle): void {
    this.selectedVehicle = vehicle;
    this.vehicleSelectionStep = 'driver';
  }

  selectDriver(driver: Driver): void {
    this.selectedDriver = driver;
    if (this.sessionDocumentType === 'sortie') {
      this.vehicleSelectionStep = 'details';
    } else if (this.sessionDocumentType === 'transfert') {
      // For bon de transfert, we can proceed directly to print
      // The confirmVehicleSelection method will handle this
    }
  }

  goBackToVehicleSelection(): void {
    this.vehicleSelectionStep = 'vehicle';
    this.selectedVehicle = null;
  }

  goBackToDriverSelection(): void {
    this.vehicleSelectionStep = 'driver';
    this.selectedDriver = null;
  }

  filterVehicles(): void {
    if (!this.vehicleSearchQuery.trim()) {
      this.filteredVehicles = this.availableVehicles;
      return;
    }
    
    const query = this.vehicleSearchQuery.toLowerCase();
    this.filteredVehicles = this.availableVehicles.filter(vehicle => 
      (vehicle.matricule && vehicle.matricule.toLowerCase().includes(query)) ||
      (vehicle.brand && vehicle.brand.name && vehicle.brand.name.toLowerCase().includes(query)) ||
      (vehicle.model && vehicle.model.toLowerCase().includes(query))
    );
  }

  filterDrivers(): void {
    if (!this.driverSearchQuery.trim()) {
      this.filteredDrivers = this.availableDrivers;
      return;
    }
    
    const query = this.driverSearchQuery.toLowerCase();
    this.filteredDrivers = this.availableDrivers.filter(driver => 
      driver.nom.toLowerCase().includes(query) ||
      driver.prenom.toLowerCase().includes(query) ||
      (driver.cin && driver.cin.includes(query))
    );
  }

  confirmVehicleSelection(): void {
    if (this.sessionDocumentType === 'sortie') {
      // For bon de sortie, require vehicle, driver, destination, and dates
      if (this.selectedVehicle && this.selectedDriver && this.destination && this.validationFromDate && this.validationToDate) {
        this.showVehicleSelectionModal = false;
        this.printDocumentDirectly();
      }
    } else if (this.sessionDocumentType === 'transfert') {
      // For bon de transfert, only require driver
      if (this.selectedDriver) {
        this.showVehicleSelectionModal = false;
        this.printDocumentDirectly();
      }
    }
  }

  getVehicleCardClasses(vehicle: Vehicle): string {
    const isSelected = this.selectedVehicle?.id === vehicle.id;
    return isSelected 
      ? 'p-4 bg-blue-50 border-2 border-blue-500 rounded-xl'
      : 'p-4 bg-white border border-slate-200 rounded-xl';
  }

  getDriverCardClasses(driver: Driver): string {
    const isSelected = this.selectedDriver?.id === driver.id;
    return isSelected 
      ? 'bg-green-50 border-green-500'
      : 'bg-white border-slate-200';
  }

  getDriverInitials(driver: Driver): string {
    if (!driver.prenom || !driver.nom) {
      return '??';
    }
    return (driver.prenom.charAt(0) + driver.nom.charAt(0)).toUpperCase();
  }

  getVehicleBrandLogo(vehicle: Vehicle): string | null {
    // Get logo URL directly from the vehicle's brand object
    if (!vehicle.brand || !vehicle.brand.logoUrl) {
      return null;
    }
    return vehicle.brand.logoUrl;
  }


  generateDocumentNumber(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const timestamp = Date.now().toString().slice(-4);
    
    let prefix = 'BEXP';
    if (this.sessionDocumentType === 'transfert') {
      prefix = 'BT';
    } else if (this.sessionDocumentType === 'livraison') {
      prefix = 'BL';
    }
    
    return `${prefix}-${year}${month}-${timestamp}`;
  }

  setDefaultValidationDates(): void {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    this.validationFromDate = today.toISOString().split('T')[0];
    this.validationToDate = tomorrow.toISOString().split('T')[0];
  }

  private numberToWords(num: number): string {
    const ones = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
    const tens = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante-dix', 'quatre-vingt', 'quatre-vingt-dix'];
    
    if (num === 0) return 'zéro';
    
    const integerPart = Math.floor(num);
    const decimalPart = Math.round((num - integerPart) * 1000);
    
    let result = '';
    
    if (integerPart >= 1000) {
      const thousands = Math.floor(integerPart / 1000);
      result += this.numberToWords(thousands) + ' mille ';
      const remainder = integerPart % 1000;
      if (remainder > 0) {
        result += this.numberToWords(remainder);
      }
    } else if (integerPart >= 100) {
      const hundreds = Math.floor(integerPart / 100);
      result += ones[hundreds] + ' cent';
      if (hundreds > 1) result += 's';
      const remainder = integerPart % 100;
      if (remainder > 0) {
        result += ' ' + this.numberToWords(remainder);
      }
    } else if (integerPart >= 20) {
      const ten = Math.floor(integerPart / 10);
      const one = integerPart % 10;
      result += tens[ten];
      if (one > 0) {
        if (ten === 7 || ten === 9) {
          result += '-' + ones[one + 10];
        } else {
          result += '-' + ones[one];
        }
      }
    } else {
      result += ones[integerPart];
    }
    
    if (decimalPart > 0) {
      result += ' virgule ' + decimalPart.toString();
    }
    
    return result;
  }

  // Manual product selection methods
  showManualProductSelection(): void {
    this.isManualProductLoading = true;
    this.showManualProductModal = true;
    this.productSearchQuery = '';
    this.filteredProducts = Array.from(this.produitsDeCaisseCache.values());
    
    // Simulate loading for better UX
    setTimeout(() => {
      this.isManualProductLoading = false;
    }, 300);
  }

  closeManualProductModal(): void {
    this.showManualProductModal = false;
    this.productSearchQuery = '';
    this.filteredProducts = [];
  }

  filterProducts(): void {
    if (!this.productSearchQuery.trim()) {
      this.filteredProducts = Array.from(this.produitsDeCaisseCache.values());
      return;
    }
    
    const query = this.productSearchQuery.toLowerCase();
    this.filteredProducts = Array.from(this.produitsDeCaisseCache.values()).filter(product => 
      product.name.toLowerCase().includes(query) ||
      this.getProductFamilyName(product).toLowerCase().includes(query) ||
      product.id.toString().includes(query)
    );
  }

  selectManualProduct(product: ProduitDeCaisse): void {
    this.selectedManualProduct = product;
    this.showManualProductModal = false;
    this.showManualQuantityModal = true;
    this.manualQuantityInput = '';
    this.manualColisInput = '';
    this.manualCurrentInputType = 'quantity';
  }

  closeManualQuantityModal(): void {
    this.showManualQuantityModal = false;
    this.selectedManualProduct = null;
    this.manualQuantityInput = '';
    this.manualColisInput = '';
    this.manualCurrentInputType = 'quantity';
  }

  addManualDigit(digit: string): void {
    const currentInput = this.manualCurrentInputType === 'quantity' ? this.manualQuantityInput : this.manualColisInput;
    const maxLength = this.manualCurrentInputType === 'quantity' ? 9 : 5;
    
    if (currentInput.length < maxLength) {
      if (this.manualCurrentInputType === 'quantity') {
        this.manualQuantityInput += digit;
      } else {
        this.manualColisInput += digit;
      }
    }
  }

  switchToManualColisInput(): void {
    if (this.manualQuantityInput && parseInt(this.manualQuantityInput, 10) > 0) {
      this.manualCurrentInputType = 'colis';
    }
  }

  clearManualInput(): void {
    if (this.manualCurrentInputType === 'quantity') {
      this.manualQuantityInput = '';
    } else {
      this.manualColisInput = '';
    }
  }

  backspaceManualInput(): void {
    if (this.manualCurrentInputType === 'quantity') {
      if (this.manualQuantityInput.length > 0) {
        this.manualQuantityInput = this.manualQuantityInput.slice(0, -1);
      }
    } else {
      if (this.manualColisInput.length > 0) {
        this.manualColisInput = this.manualColisInput.slice(0, -1);
      }
    }
  }

  confirmManualProduct(): void {
    if (this.manualCurrentInputType === 'quantity') {
      const quantity = parseInt(this.manualQuantityInput, 10);
      if (quantity > 0) {
        this.switchToManualColisInput();
      }
    } else {
      if (!this.selectedManualProduct || !this.manualQuantityInput || !this.manualColisInput) {
        return;
      }

      const quantity = parseInt(this.manualQuantityInput, 10);
      const colis = parseInt(this.manualColisInput, 10);
      
      if (quantity <= 0 || colis <= 0) {
        return;
      }

      // Convert quantity from kg to grams (to match barcode format)
      const quantityInGrams = quantity * 1000;

      // Use parent product ID if available, otherwise use the produit de caisse ID
      const productId = this.selectedManualProduct.parentProductId || this.selectedManualProduct.id;
      
      // Find existing item or create new one
      const existingItemIndex = this.scannedItems.findIndex(item => item.articleId === productId);
      
      if (existingItemIndex >= 0) {
        // Update existing item - set exact quantity and colis
        this.scannedItems[existingItemIndex].quantity = quantityInGrams;
        this.scannedItems[existingItemIndex].count = colis;
        this.scannedItems[existingItemIndex].lastScanned = new Date();
        this.success = `${this.selectedManualProduct.name} mis à jour (Colis: ${colis}, Qty: ${quantity}kg)`;
      } else {
        // Add new item with custom quantity and colis
        this.scannedItems.push({
          articleId: productId,
          productName: this.selectedManualProduct.name,
          quantity: quantityInGrams,
          count: colis,
          lastScanned: new Date()
        });
        this.success = `Nouveau ${this.selectedManualProduct.name} ajouté (Colis: ${colis}, Qty: ${quantity}kg)`;
      }

      // Play success sound
      this.playSuccessSound();

      // Clear success message after 3 seconds
      setTimeout(() => { this.success = ''; }, 3000);
      this.error = '';

      // Close modal and reset
      this.closeManualQuantityModal();
    }
  }
}


