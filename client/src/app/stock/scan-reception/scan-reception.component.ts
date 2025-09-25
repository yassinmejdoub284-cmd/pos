import { Component, OnDestroy, OnInit, signal, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { DepotsService } from '../../core/services/depots.service';
import { StockDocumentsService } from '../../core/services/stock-documents.service';
import { ProductsService } from '../../core/services/products.service';
import { Product } from '../../core/models/product.model';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';

@Component({
  selector: 'app-scan-reception',
  templateUrl: './scan-reception.component.html',
  standalone: false
})
export class ScanReceptionComponent implements OnInit, OnDestroy {
  depotId = 0;
  fromDepotId: number | null = null;
  loading = false;
  error = '';
  success = '';

  // Products cache for fast lookup
  private productsCache = new Map<number, Product>();
  private productsService = inject(ProductsService);

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
  recentScans: Array<{ barcode: string; timestamp: Date }> = [];
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
    private depotsService: DepotsService,
    private stockDocs: StockDocumentsService
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const id = params.get('depotId');
      this.depotId = id ? parseInt(id, 10) : 0;
    });
    this.loadDepots();
    this.loadProducts();
    this.initSounds();
    queueMicrotask(() => this.initCamera());
  }

  ngOnDestroy(): void {
    this.stopCamera();
  }

  loadDepots(): void {
    this.depotsService.list().subscribe({
      next: (list) => {
        this.depots.set(list.filter((d: any) => d.isActive));
      },
      error: () => {}
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

  private getProductName(articleId: number): string {
    const product = this.productsCache.get(articleId);
    return product ? product.name : `Article ${articleId}`;
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
    this.addToRecentScans(code);
    this.parseAndAddBarcode(code);
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

      // Find existing item or create new one
      const existingItemIndex = this.scannedItems.findIndex(item => item.articleId === articleId);
      
      const productName = this.getProductName(articleId);
      
      if (existingItemIndex >= 0) {
        // Update existing item - add quantity and increment count
        this.scannedItems[existingItemIndex].quantity += quantity;
        this.scannedItems[existingItemIndex].count += 1;
        this.scannedItems[existingItemIndex].lastScanned = new Date();
        this.success = `${productName} scanné (${this.scannedItems[existingItemIndex].count}x, Qty: ${this.scannedItems[existingItemIndex].quantity})`;
      } else {
        // Add new item
        this.scannedItems.push({
          articleId,
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
    this.addToRecentScans(code);
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

  private submitScan(code: string): void {
    this.loading = true;
    this.error = '';
    this.success = '';

    const fromDepotId = this.fromDepotId ?? 0;
    const call$ = fromDepotId
      ? this.stockDocs.scanTransfer(fromDepotId, this.depotId, code)
      : this.stockDocs.scanBarcode(code, this.depotId);

    call$.subscribe({
      next: () => {
        this.loading = false;
        this.success = `Produit scanné: ${code}`;
        this.error = '';
        setTimeout(() => { this.success = ''; }, 3000);
      },
      error: () => {
        this.loading = false;
        this.error = `Code-barres introuvable: ${code}`;
        this.success = '';
        setTimeout(() => { this.error = ''; }, 5000);
      }
    });
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

  private addToRecentScans(barcode: string): void {
    this.recentScans = this.recentScans.filter(scan => scan.barcode !== barcode);
    this.recentScans.unshift({ barcode, timestamp: new Date() });
    if (this.recentScans.length > 5) {
      this.recentScans = this.recentScans.slice(0, 5);
    }
  }

  private sanitizeTo13(input: string): string | null {
    const digits = (input || '').replace(/\D+/g, '');
    if (!digits) return null;
    if (digits.length < 13) return null;
    // Always use the last 13 digits to avoid prefixes/suffixes from some readers
    return digits.slice(-13);
  }
}


