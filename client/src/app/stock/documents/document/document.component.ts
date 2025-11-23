import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { StockDocumentsService } from '../../../core/services/stock-documents.service';
import { StockDocument } from '../../../core/models/stock-document.model';
import { buildScanLikeDocumentHtmlFromDocument, getScanPrintStyles } from '../../shared/print-templates';
import { SettingsService } from '../../../core/services/settings.service';
import { ProduitsDeCaisseService } from '../../../core/services/produits-de-caisse.service';
import { ProductsService } from '../../../core/services/products.service';
import { ClientsService } from '../../../core/services/clients.service';
import { DepotsService } from '../../../core/services/depots.service';
import { VehiclesService } from '../../../core/services/vehicles.service';
import { DriversService } from '../../../core/services/drivers.service';
import { SessionsService } from '../../../core/services/sessions.service';
import { AuthService } from '../../../core/services/auth.service';
import { WholesaleRulesService, WholesaleRule } from '../../../core/services/wholesale-rules.service';
import { Product } from '../../../core/models/product.model';
import { ProduitDeCaisse } from '../../../core/models/produit-de-caisse.model';

@Component({
  selector: 'app-document',
  templateUrl: './document.component.html',
  styleUrls: ['./document.component.css'],
  standalone: false
})
export class DocumentComponent implements OnInit, OnDestroy {
  document: StockDocument | null = null;
  loading = true;
  error = '';
  success = '';
  showInvoiceModal = false;
  invoiceNumber = '';
  documentHtml = '';
  printStyles = '';
  safeDocumentHtml: SafeHtml = '';
  isEditMode = false;
  
  // Product management (from scanning component)
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
    originalDocumentItem?: {
      prixUnitaire: number;
      tva: number;
      montantHT: number;
      montantTVA: number;
      montantTTC: number;
    };
  }> = [];

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

  // Scan Details Modal
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
  showUnitPriceEditModal = false;
  selectedProductForPriceEdit: any = null;
  editedUnitPrice = '';
  shouldClearPriceOnFirstTap = false;

  // Data for selections
  clients: any[] = [];
  depots: any[] = [];
  vehicles: any[] = [];
  drivers: any[] = [];
  currentDepotId: number | null = null;
  currentDepot: any = null;
  currentSettings: any = null;

  // Caches for products and produits de caisse
  productsCache = new Map<number, Product>();
  produitsDeCaisseCache = new Map<number, ProduitDeCaisse>();
  
  // Wholesale rules for pricing
  private wholesaleRules: WholesaleRule[] = [];

  // Sound effects
  private beepSound: HTMLAudioElement | null = null;
  private successSound: HTMLAudioElement | null = null;
  private errorSound: HTMLAudioElement | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private stockDocumentsService: StockDocumentsService,
    private settingsService: SettingsService,
    private sanitizer: DomSanitizer,
    private produitsDeCaisseService: ProduitsDeCaisseService,
    private productsService: ProductsService,
    private clientsService: ClientsService,
    private depotsService: DepotsService,
    private vehiclesService: VehiclesService,
    private driversService: DriversService,
    private sessionsService: SessionsService,
    private authService: AuthService,
    private wholesaleRulesService: WholesaleRulesService
  ) {}

  ngOnInit(): void {
    // Check if we're in edit mode
    const url = this.router.url;
    this.isEditMode = url.includes('/edit');
    
    // Initialize sounds and load data
    this.initializeSounds();
    this.loadProducts();
    this.loadProduitsDeCaisse();
    this.loadClients();
    this.loadCurrentDepot();
    this.loadDepots();
    this.loadVehicles();
    this.loadDrivers();
    this.loadSettings();
    this.loadWholesaleRules();
    
    this.route.params.subscribe(params => {
      const documentId = params['id'];
      if (documentId) {
        this.loadDocument(documentId);
      }
    });
  }

  ngOnDestroy(): void {
    this.cleanupSounds();
  }

  loadDocument(id: string): void {
    this.loading = true;
    this.error = '';
    
    this.stockDocumentsService.getDocumentById(id).subscribe({
      next: (document) => {



        this.document = document;
        
        // Convert document items to scannedItems format if in edit mode
        if (this.isEditMode && document.items) {
          this.convertDocumentItemsToScannedItems(document.items);
        }
        
        this.generateDocumentHtml();
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading document:', error);
        this.error = 'Erreur lors du chargement du document: ' + (error?.message || 'Erreur inconnue');
        this.loading = false;
      }
    });
  }

  private convertDocumentItemsToScannedItems(items: any[]): void {
    this.scannedItems = [];
    
    items.forEach(item => {
      // Create individual scan entry for each document item
      const individualScan = {
        id: `doc_${item.productId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        quantity: Math.round((item.quantity || 0) * 1000), // Convert kg to grams
        timestamp: new Date(),
        barcode: `DOC_${item.productId}_${Date.now()}`
      };

      // Find existing item or create new one
      const existingItemIndex = this.scannedItems.findIndex(scannedItem => scannedItem.articleId === item.productId);
      
      if (existingItemIndex >= 0) {
        // Update existing item
        this.scannedItems[existingItemIndex].quantity += individualScan.quantity;
        this.scannedItems[existingItemIndex].count += 1;
        this.scannedItems[existingItemIndex].colisCount += (item.colisCount || 1);
        this.scannedItems[existingItemIndex].lastScanned = new Date();
        this.scannedItems[existingItemIndex].individualScans.push(individualScan);
      } else {
        // Add new item
        // Use the product name from the document item's product object, or fallback to childProductName, or getProductName
        const productName = item.product?.name || item.childProductName || this.getProductName(item.productId) || `Produit ${item.productId}`;
        
        // Debug: Log the original item data

        
        this.scannedItems.push({
          articleId: item.productId,
          productName: productName,
          quantity: individualScan.quantity,
          count: 1,
          colisCount: item.colisCount || 1,
          lastScanned: new Date(),
          individualScans: [individualScan],
          // Preserve original document item data for TVA and pricing
          originalDocumentItem: {
            prixUnitaire: item.prixUnitaire,
            tva: item.tva,
            montantHT: item.montantHT,
            montantTVA: item.montantTVA,
            montantTTC: item.montantTTC
          }
        });
      }
    });
    

  }

  generateDocumentHtml(): void {
    if (!this.document) return;
    
    // Get the document type for the print template
    const sessionType = this.getSessionType();
    
    // Load settings for the print template
    this.settingsService.getSettings().subscribe({
      next: (settings) => {
        // Generate the exact HTML using the print template function
        // If in edit mode and we have scanned items, use them for display
        const documentToUse = this.getDocumentForDisplay();
        this.documentHtml = buildScanLikeDocumentHtmlFromDocument(documentToUse, sessionType, settings);
        this.printStyles = getScanPrintStyles();
        
        // Sanitize the HTML to prevent Angular from stripping content
        this.safeDocumentHtml = this.sanitizer.bypassSecurityTrustHtml(this.documentHtml);
        
        // Force DOM update to ensure images load
        setTimeout(() => {
          this.loadImages();
          this.applyPrintStyles();
        }, 100);
      },
      error: (error) => {
        console.error('Error loading settings:', error);
        // Generate HTML without settings
        const documentToUse = this.getDocumentForDisplay();
        this.documentHtml = buildScanLikeDocumentHtmlFromDocument(documentToUse, sessionType, null);
        this.printStyles = getScanPrintStyles();
        
        // Sanitize the HTML to prevent Angular from stripping content
        this.safeDocumentHtml = this.sanitizer.bypassSecurityTrustHtml(this.documentHtml);
        
        // Force DOM update to ensure images load
        setTimeout(() => {
          this.loadImages();
          this.applyPrintStyles();
        }, 100);
      }
    });
  }

  // Method to update preview when document data changes in edit mode
  updatePreview(): void {
    if (this.isEditMode) {
      this.generateDocumentHtml();
    }
  }

  private getDocumentForDisplay(): any {
    if (!this.document) return null;
    
    // If in edit mode and we have scanned items, create a temporary document with current items
    if (this.isEditMode && this.scannedItems.length > 0) {
      const { document: tempDocument, items } = this.convertScannedItemsToDocumentItems();
      if (tempDocument && items) {
        // Create a temporary document with the current scanned items for display
        return {
          ...tempDocument,
          items: items.map(item => ({
            ...item,
            id: Math.random(), // Temporary ID for display
            documentId: this.document!.id,
            product: this.productsCache.get(item.productId) || { name: item.childProductName || 'Produit' }
          }))
        };
      }
    }
    
    // Otherwise, use the original document
    return this.document;
  }

  applyPrintStyles(): void {
    // Apply print styles directly to the document wrapper
    const documentWrapper = document.querySelector('.document-wrapper');
    if (documentWrapper) {
      // Create a style element with high specificity
      const styleElement = document.createElement('style');
      styleElement.textContent = `
        .document-wrapper {
          font-family: Arial, Helvetica, sans-serif !important;
          font-size: 12px !important;
          line-height: 1.5 !important;
          color: #000 !important;
          background: white !important;
        }
        .document-wrapper .container {
          max-width: 800px !important;
          margin: 0 auto !important;
          padding: 12px 0 0 0 !important;
          background: white !important;
        }
        .document-wrapper .header {
          display: flex !important;
          justify-content: space-between !important;
          margin-bottom: 16px !important;
          border-bottom: 1px solid #000 !important;
          padding-bottom: 10px !important;
        }
        .document-wrapper .company-info { flex: 1 !important; }
        .document-wrapper .document-info { text-align: right !important; flex: 1 !important; }
        .document-wrapper .title {
          font-size: 20px !important;
          font-weight: bold !important;
          margin-bottom: 2px !important;
          text-transform: uppercase !important;
          letter-spacing: 1px !important;
        }
        .document-wrapper .subtitle { font-size: 13px !important; color: #000 !important; margin-bottom: 6px !important; font-weight: bold !important; }
        .document-wrapper .info-row { margin: 2px 0 !important; font-size: 12px !important; line-height: 1.35 !important; }
        .document-wrapper .label { font-weight: bold !important; display: inline-block !important; min-width: 110px !important; color: #000 !important; }
        .document-wrapper .value { font-weight: 600 !important; color: #000 !important; }
        .document-wrapper table { width: 100% !important; border-collapse: collapse !important; margin: 12px 0 0 0 !important; font-size: 12px !important; border: 1px solid #000 !important; }
        .document-wrapper th, .document-wrapper td { border: 1px solid #000 !important; padding: 6px 8px !important; text-align: left !important; }
        .document-wrapper th { background-color: transparent !important; font-weight: bold !important; text-align: center !important; font-size: 11px !important; text-transform: uppercase !important; letter-spacing: 0.5px !important; }
        .document-wrapper .text-right {
          text-align: right !important;
        }
        .document-wrapper .text-center {
          text-align: center !important;
        }
        .document-wrapper .font-bold {
          font-weight: bold !important;
        }
        .document-wrapper .total-breakdown {
          display: flex !important;
          justify-content: flex-end !important;
          flex-direction: column !important;
          align-items: flex-end !important;
        }
        .document-wrapper .total-line {
          display: flex !important;
          justify-content: space-between !important;
          margin-bottom: 5px !important;
          font-size: 13px !important;
          width: 100% !important;
        }
        .document-wrapper .total-final {
          border-top: 1px solid #000 !important;
          padding-top: 5px !important;
          font-weight: bold !important;
          font-size: 14px !important;
        }
        .document-wrapper .footer {
          margin-top: 120px !important;
          border-top: 1px solid #000 !important;
          padding-top: 10px !important;
        }
        .document-wrapper .signature-section {
          margin-bottom: 20px !important;
        }
        .document-wrapper .signature-box {
          width: 300px !important;
          margin: 0 auto !important;
          text-align: center !important;
        }
        .document-wrapper .signature-label {
          font-weight: bold !important;
          margin-bottom: 10px !important;
        }
        .document-wrapper .signature-line {
          border-bottom: 1px solid #000 !important;
          height: 20px !important;
        }
        .document-wrapper img {
          max-width: 140px !important;
          max-height: 80px !important;
          object-fit: contain !important;
        }
      `;
      document.head.appendChild(styleElement);
    }
  }

  loadImages(): void {
    // Ensure all images in the document are loaded properly
    const documentWrapper = document.querySelector('.document-wrapper');
    if (documentWrapper) {
      const images = documentWrapper.querySelectorAll('img');
      images.forEach(img => {
        // Force image reload if needed
        if (img.src) {
          img.onerror = () => {

          };
          img.onload = () => {

          };
        }
      });
    }
  }

  getSessionType(): 'sortie' | 'transfert' | 'livraison' {
    if (!this.document) return 'livraison';
    
    switch (this.document.type) {
      case 'BON_EXPEDITION':
        return 'sortie';
      case 'BON_TRANSFERT':
        return 'transfert';
      case 'BON_ENTREE_MAGASIN':
      case 'FACTURE':
      default:
        return 'livraison';
    }
  }

  getDocumentTypeLabel(): string {
    if (!this.document) return 'Document';
    
    switch (this.document.type) {
      case 'BON_ENTREE_DEPOT':
        return 'Bon d\'entrée';
      case 'BON_ENTREE_MAGASIN':
        return 'Bon de Livraison';
      case 'BON_EXPEDITION':
        return 'Bon d\'expédition';
      case 'BON_TRANSFERT':
        return 'Bon de transfert';
      case 'FACTURE':
        return 'Facture';
      default:
        return 'Document';
    }
  }

  getStatusLabel(): string {
    if (!this.document) return '';
    
    switch (this.document.status) {
      case 'PREPARED':
        return 'Préparé';
      case 'SENT':
        return 'Envoyé';
      case 'RECEIVED':
        return 'Reçu';
      case 'CANCELLED':
        return 'Annulé';
      case 'COMPLETED':
        return 'Terminé';
      default:
        return this.document.status;
    }
  }

  getStatusClass(): string {
    if (!this.document) return '';
    
    switch (this.document.status) {
      case 'PREPARED':
        return 'bg-yellow-100 text-yellow-800';
      case 'SENT':
        return 'bg-blue-100 text-blue-800';
      case 'RECEIVED':
        return 'bg-green-100 text-green-800';
      case 'CANCELLED':
        return 'bg-red-100 text-red-800';
      case 'COMPLETED':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }

  hasPricing(): boolean {
    if (!this.document?.items) return false;
    return this.document.items.some(item => 
      item.prixUnitaire !== undefined || 
      item.montantHT !== undefined || 
      item.montantTTC !== undefined
    );
  }

  canGenerateInvoice(): boolean {
    return this.document?.type === 'BON_ENTREE_MAGASIN' || this.document?.type === 'FACTURE';
  }

  getGroupedItems(items: any[]): any[] {
    if (!items) return [];
    
    const grouped = items.reduce((acc: any, item: any) => {
      const key = item.famille || 'Autres';
      if (!acc[key]) {
        acc[key] = {
          name: key,
          qty: 0,
          count: 0,
          prixUnitaire: item.prixUnitaire || 0,
          tva: item.tva || 0,
          montantHT: 0,
          montantTTC: 0
        };
      }
      acc[key].qty += item.quantity || 0;
      acc[key].count += item.count || 0;
      acc[key].montantHT += item.montantHT || 0;
      acc[key].montantTTC += item.montantTTC || 0;
      return acc;
    }, {});

    return Object.values(grouped).map((group: any, idx: number) => ({
      ...group,
      idx
    }));
  }

  getTotalQuantity(items: any[]): number {
    if (!items) return 0;
    return items.reduce((total, item) => total + (item.quantity || 0), 0);
  }

  getTotalCount(items: any[]): number {
    if (!items) return 0;
    return items.reduce((total, item) => total + (item.count || 0), 0);
  }

  getTotalHT(items: any[]): number {
    if (!items) return 0;
    return items.reduce((total, item) => total + (item.montantHT || 0), 0);
  }

  getTotalTVA(items: any[]): number {
    if (!items) return 0;
    return items.reduce((total, item) => total + (item.montantTVA || 0), 0);
  }

  getTotalTTC(items: any[]): number {
    if (!items) return 0;
    return items.reduce((total, item) => total + (item.montantTTC || 0), 0);
  }

  formatDate(date: string | Date): string {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  printDocument(): void {
    if (!this.document) return;
    
    // Create a new window for printing with proper HTML structure
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>${this.getDocumentTypeLabel()} - ${this.document.numero}</title>
            <meta charset="utf-8">
            <style>${this.printStyles}</style>
          </head>
          <body>
            ${this.documentHtml}
            <script>
              // Ensure images are loaded before printing
              window.onload = function() {
                setTimeout(function() {
                  window.print();
                }, 500);
              };
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
    }
  }

  openInvoiceModal(): void {
    this.showInvoiceModal = true;
    // Suggest next invoice number
    this.suggestNextInvoiceNumber();
  }

  private suggestNextInvoiceNumber(): void {
    const today = new Date();
    const year = today.getFullYear().toString().slice(-2);
    const month = (today.getMonth() + 1).toString().padStart(2, '0');
    const day = today.getDate().toString().padStart(2, '0');
    
    // Generate a suggested number like FAC-251011-0001
    this.invoiceNumber = `FAC-${year}${month}${day}-0001`;
  }

  cancelInvoice(): void {
    this.showInvoiceModal = false;
    this.invoiceNumber = '';
  }

  confirmGenerateInvoice(): void {
    if (!this.document) return;
    
    if (!this.invoiceNumber || this.invoiceNumber.trim() === '') {
      this.error = 'Veuillez saisir un numéro de facture';
      return;
    }
    


    
    // Load caches first, then generate invoice
    this.loadProductCaches().then(() => {
      this.generateInvoiceWithRealProducts();
    });
  }

  private async loadProductCaches(): Promise<void> {
    try {
      // Load all products
      const products = await this.productsService.getProducts().toPromise();
      if (products) {
        products.forEach((product: any) => {
          this.productsCache.set(product.id, product);
        });
      }

      // Load all produits de caisse
      const produitsDeCaisse = await this.produitsDeCaisseService.getProduitsDeCaisse().toPromise();
      if (produitsDeCaisse) {
        produitsDeCaisse.forEach((produit: any) => {
          this.produitsDeCaisseCache.set(produit.id, produit);
        });
      }

      console.log('Product caches loaded:', {
        products: this.productsCache.size,
        produitsDeCaisse: this.produitsDeCaisseCache.size
      });
    } catch (error) {
      console.error('Error loading product caches:', error);
    }
  }

  private generateInvoiceWithRealProducts(): void {
    if (!this.document) return;

    // Prepare invoice document data similar to scanning
    const invoiceData = {
      type: 'FACTURE',
      numero: this.invoiceNumber, // Use the manual invoice number from the modal
      fromDepotId: this.document.emetteurId || 1,
      destinationDepotId: this.document.destinataireId || this.document.emetteurId || 1,
      clientId: this.document.clientId || this.document.client?.id,
      status: 'COMPLETED',
      items: this.document.items?.map(item => {
        // Get the actual sub-product (produit de caisse) details
        const produit = this.produitsDeCaisseCache.get(item.productId);
        const parentProductId = produit?.parentProductId || item.productId;
        const parentProduct = this.productsCache.get(parentProductId);
        
        const baseItem = {
          productId: item.productId, // Keep the actual scanned sub-product ID
          quantity: item.quantity,
          count: item.count || 1,
          famille: parentProduct?.famille || parentProduct?.name || item.famille || 'Produit scanné',
          parentProductId: parentProductId,
          childProductName: produit?.name || `CHILDREN ${item.productId}`
        };
        
        // Use the actual sub-product pricing if available
        if (produit) {
          const prixUnitaire = produit.prix_vente_TTC || item.prixUnitaire || 0;
          const tva = produit.tva || item.tva || 19;
          const quantite = item.quantity;
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
            montantTTC: montantTTC,
            batch: item.batch,
            notes: item.notes,
            barcode: item.barcode
          };
        }
        
        // Fallback to stored values if produit not found
        return {
          ...baseItem,
          prixUnitaire: item.prixUnitaire || 0,
          tva: item.tva || 19,
          montantHT: item.montantHT || 0,
          montantTVA: item.montantTVA || 0,
          montantTTC: item.montantTTC || 0,
          batch: item.batch,
          notes: item.notes,
          barcode: item.barcode
        };
      }) || [],
      notes: `Facture générée automatiquement à partir du document ${this.document.numero}`,
      // Include client details
      client: this.document.client ? {
        id: this.document.client.id,
        code: this.document.client.code,
        firstName: this.document.client.firstName,
        lastName: this.document.client.lastName,
        email: this.document.client.email,
        phone: this.document.client.phone,
        address: this.document.client.address,
        city: this.document.client.city,
        matriculeFiscal: this.document.client.matriculeFiscal,
        postalCode: this.document.client.postalCode,
        clientType: this.document.client.clientType
      } : null
    };






    // Create the invoice document
    this.stockDocumentsService.createDocument(invoiceData).subscribe({
      next: (createdInvoice) => {

        this.cancelInvoice();
        
        // Navigate to the new invoice document
        this.router.navigate(['/stock/documents', createdInvoice.id]);
      },
      error: (error) => {
        console.error('Error creating invoice:', error);
        const errorMessage = error?.error?.error || error?.message || 'Erreur inconnue';
        this.error = 'Erreur lors de la création de la facture: ' + errorMessage;
      }
    });
  }

  goToScan(): void {
    this.router.navigate(['/scanning']);
  }

  saveDocument(): void {
    if (!this.document) return;
    
    this.loading = true;
    this.error = '';
    
    // Convert scannedItems back to document items format
    const { document: updatedDocument, items } = this.convertScannedItemsToDocumentItems();
    
    if (!updatedDocument) {
      this.error = 'Erreur lors de la conversion des données';
      this.loading = false;
      return;
    }
    
    // Add the items to the document
    updatedDocument.items = items;
    
    // Update the document
    this.stockDocumentsService.updateDocument(this.document.id!, updatedDocument).subscribe({
      next: (savedDocument) => {

        this.document = savedDocument;
        this.generateDocumentHtml();
        this.loading = false;
        this.success = 'Document mis à jour avec succès';
        
        // Navigate back to view mode after a short delay
        setTimeout(() => {
          this.router.navigate(['/stock/documents', this.document!.id]);
        }, 1500);
      },
      error: (error) => {
        console.error('Error updating document:', error);
        this.error = 'Erreur lors de la mise à jour du document: ' + (error?.message || 'Erreur inconnue');
        this.loading = false;
      }
    });
  }

  private convertScannedItemsToDocumentItems(): { document: any, items: any[] } {
    if (!this.document) return { document: null, items: [] };






    // Create a copy of the document
    const updatedDocument = { ...this.document };
    
    // Convert scannedItems to document items format (without id and documentId for now)
    const items = this.scannedItems.map(item => {
      const produit = this.produitsDeCaisseCache.get(item.articleId);

      const parentProductId = produit?.parentProductId || item.articleId;
      const parentProduct = this.productsCache.get(parentProductId);

      
      // Check if we have original document item data (for edit mode) - use this first
      const originalData = (item as any).originalDocumentItem;

      
      const baseItem = {
        productId: parentProductId, // Use parent product ID for stock management
        quantity: item.quantity / 1000, // Convert to kg
        count: item.count,
        colisCount: item.colisCount, // Include the colis count
        famille: typeof parentProduct?.famille === 'object' ? parentProduct.famille.name : (parentProduct?.famille || parentProduct?.name || 'Produit scanné'),
        parentProductId: parentProductId, // Add parent reference for grouping
        childProductName: produit?.name || parentProduct?.name || `Produit ${item.articleId}`, // Use real product name
        childProductId: item.articleId // Keep child product ID for reference
      };
      
      // If we have original data, use it to preserve TVA and pricing
      if (originalData) {

        
        const tva = originalData.tva !== undefined && originalData.tva !== null ? originalData.tva : 19;

        
        // Use the recalculated amounts from originalDocumentItem if available
        const finalItem = {
          ...baseItem,
          prixUnitaire: originalData.prixUnitaire || 0,
          tva: tva, // Keep original format - print template handles conversion
          montantHT: originalData.montantHT || 0,
          montantTVA: originalData.montantTVA || 0,
          montantTTC: originalData.montantTTC || 0
        };
        

        return finalItem;
      } else if (produit) {
        // Calculate new pricing (for new items)

        
        let prixUnitaire = produit.prix_vente_TTC || 0;
        
        // Apply custom/bundle pricing when available (for any client)
        if (this.hasCustomPrice(produit)) {
          prixUnitaire = this.getWholesalePrice(produit);
        }
        
        // Use the same TVA logic as scanning component
        const tva = produit.tva !== undefined && produit.tva !== null ? produit.tva : 19;
        const quantite = item.quantity / 1000; // Convert to kg
        const montantTTC = prixUnitaire * quantite;
        
        // Debug TVA values

        
        // For calculation, convert TVA to decimal if needed
        const tvaFraction = tva > 1 ? tva / 100 : tva;
        const montantHT = Math.round((montantTTC / (1 + tvaFraction)) * 1000) / 1000;
        const montantTVA = Math.round((montantTTC - montantHT) * 1000) / 1000;
        

        
        const finalItem = {
          ...baseItem,
          prixUnitaire: prixUnitaire,
          tva: tva, // Keep original format - print template handles conversion
          montantHT: montantHT,
          montantTVA: montantTVA,
          montantTTC: montantTTC
        };
        

        return finalItem;
      }
      
      return baseItem;
    });



    items.forEach((item, index) => {

    });
    return { document: updatedDocument, items: items };
  }

  cancelEdit(): void {
    // Navigate back to view mode
    this.router.navigate(['/stock/documents', this.document!.id]);
  }

  goBack(): void {
    this.router.navigate(['/stock/documents']);
  }

  // ===================== PRODUCT MANAGEMENT METHODS (from scanning component) =====================

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
        // Initialize filtered list for manual add
        this.filteredProduitsDeCaisse = produits;
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

  // Manual Add Methods
  showManualAdd(): void {
    this.openProductSelection();
  }

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

  getGroupedProduitsDeCaisse(): Array<{
    parentProduct: Product | null;
    parentProductId: number;
    parentProductName: string;
    parentProductImage: string | null;
    produits: any[];
  }> {
    const groups = new Map<number, any[]>();

    // Group produits by parent product
    this.filteredProduitsDeCaisse.forEach(produit => {
      const parentId = produit.parentProductId || -produit.id; // Use negative ID for standalone products
      if (!groups.has(parentId)) {
        groups.set(parentId, []);
      }
      groups.get(parentId)!.push(produit);
    });

    // Convert to array and sort
    const result = Array.from(groups.entries()).map(([parentId, produits]) => {
      let parentProduct: Product | null = null;
      let parentProductName = 'Produits Indépendants';
      let parentProductImage: string | null = null;

      if (parentId > 0) {
        parentProduct = this.productsCache.get(parentId) || null;
        parentProductName = parentProduct?.name || 'Produit Parent Inconnu';
        parentProductImage = parentProduct?.photo || null;
      } else {
        // For standalone products, use the first product's info
        if (produits.length > 0) {
          parentProductName = produits[0].name;
        }
      }

      return {
        parentProduct,
        parentProductId: parentId,
        parentProductName,
        parentProductImage,
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
    
    if (produit.parentProductId) {
      const parentProduct = this.productsCache.get(produit.parentProductId) || null;
      return parentProduct?.name || 'Produit Parent Inconnu';
    }
    
    return produit.name || '';
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
    const productName = this.selectedProductForManualAdd.name;

    // Create individual scan entry for manual add
    const individualScan = {
      id: `manual_${articleId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      quantity: Math.round(quantity * 1000), // Convert to grams
      timestamp: new Date(),
      barcode: `MANUAL_${articleId}_${Date.now()}`
    };

    // Find existing item or create new one
    const existingItemIndex = this.scannedItems.findIndex(item => item.articleId === articleId);

    if (existingItemIndex >= 0) {
      // Update existing item - add quantity and increment count
      this.scannedItems[existingItemIndex].quantity += Math.round(quantity * 1000);
      this.scannedItems[existingItemIndex].count += 1;
      this.scannedItems[existingItemIndex].colisCount += colisCount;
      this.scannedItems[existingItemIndex].lastScanned = new Date();
      this.scannedItems[existingItemIndex].individualScans.push(individualScan);
      
      // Recalculate prices for the updated item
      this.recalculateItemPrices(existingItemIndex);
      
      this.success = `${productName} ajouté manuellement (${this.scannedItems[existingItemIndex].count}x, Qty: ${(this.scannedItems[existingItemIndex].quantity/1000).toFixed(3)}kg)`;
    } else {
      // Add new item
      const newItem = {
        articleId: articleId,
        productName: productName,
        quantity: Math.round(quantity * 1000), // Convert to grams
        count: 1,
        colisCount: colisCount,
        lastScanned: new Date(),
        individualScans: [individualScan]
      };
      this.scannedItems.push(newItem);
      
      // Calculate prices for the new item
      const newItemIndex = this.scannedItems.length - 1;
      this.recalculateItemPrices(newItemIndex);
      
      this.success = `Nouveau ${productName} ajouté manuellement (Qty: ${quantity.toFixed(3)}kg, ${colisCount} colis)`;
    }

    // Play success sound
    this.playSuccessSound();

    // Clear success message after 3 seconds
    setTimeout(() => { this.success = ''; }, 3000);
    this.error = '';

    // Update document display immediately
    this.generateDocumentHtml();

    // Close all modals and reset state
    this.showManualColisModal = false;
    this.resetManualAddState();
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

  // Product removal
  removeScannedItem(articleId: number): void {
    this.scannedItems = this.scannedItems.filter(item => item.articleId !== articleId);
    this.showSuccess('Produit supprimé');
    // Update document display immediately
    this.generateDocumentHtml();
  }

  clearScannedItems(): void {
    this.scannedItems = [];
    this.showSuccess('Liste des articles effacée');
    // Update document display immediately
    this.generateDocumentHtml();
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
        } else {
          // Recalculate prices for the remaining item
          this.recalculateItemPrices(itemIndex);
        }
        
        this.showSuccess(`Scan supprimé (${(removedScan.quantity/1000).toFixed(3)}kg)`);
        
        // Update document display immediately
        this.generateDocumentHtml();
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

    // Recalculate prices based on the new total quantity
    this.recalculateItemPrices(itemIndex);

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

    this.showSuccess(`Quantité modifiée: ${(oldQuantity/1000).toFixed(3)}kg → ${(newQuantityInGrams/1000).toFixed(3)}kg`);

    // Update document display immediately
    this.generateDocumentHtml();

    this.closeQuantityEditModal();
  }

  // Recalculate prices for an item based on its current quantity
  private recalculateItemPrices(itemIndex: number): void {
    const item = this.scannedItems[itemIndex];
    const produit = this.produitsDeCaisseCache.get(item.articleId);
    const parentProduct = this.productsCache.get(item.articleId);
    


    
    // Use either produit (sub-product) or parentProduct (main product)
    const productData = produit || parentProduct;
    
    if (productData) {
      // Get the unit price - use custom price if manually set, otherwise use product price
      let prixUnitaire = 0;
      
      if (item.originalDocumentItem && item.originalDocumentItem.prixUnitaire !== undefined && item.originalDocumentItem.prixUnitaire !== null) {
        // Use manually set unit price
        prixUnitaire = Number(item.originalDocumentItem.prixUnitaire) || 0;
      } else {
        // Use product price with custom/bundle pricing when available
        if (produit) {
          // This is a sub-product (produit de caisse)
          prixUnitaire = Number(produit.prix_vente_TTC) || 0;
          if (this.hasCustomPrice(produit)) {
            prixUnitaire = Number(this.getWholesalePrice(produit)) || 0;
          }
        } else if (parentProduct) {
          // This is a main product
          prixUnitaire = Number((parentProduct as any).prix_vente_TTC) || 0;
        }
      }
      
      // Get TVA rate - use custom TVA if manually set, otherwise use product TVA
      let tva = 19;
      if (item.originalDocumentItem && item.originalDocumentItem.tva !== undefined && item.originalDocumentItem.tva !== null) {
        tva = Number(item.originalDocumentItem.tva) || 19;
      } else {
        if (produit) {
          tva = produit.tva !== undefined && produit.tva !== null ? Number(produit.tva) || 19 : 19;
        } else if (parentProduct) {
          tva = (parentProduct as any).tva !== undefined && (parentProduct as any).tva !== null ? Number((parentProduct as any).tva) || 19 : 19;
        }
      }
      
      // Calculate new amounts based on total quantity
      const quantite = item.quantity / 1000; // Convert to kg
      const montantTTC = prixUnitaire * quantite;
      
      // Calculate HT and TVA amounts
      const tvaFraction = tva > 1 ? tva / 100 : tva;
      const montantHT = Math.round((montantTTC / (1 + tvaFraction)) * 1000) / 1000;
      const montantTVA = Math.round((montantTTC - montantHT) * 1000) / 1000;
      
      // Update the originalDocumentItem with new prices
      if (!item.originalDocumentItem) {
        item.originalDocumentItem = {
          prixUnitaire: 0,
          tva: 19,
          montantHT: 0,
          montantTVA: 0,
          montantTTC: 0
        };
      }
      item.originalDocumentItem.prixUnitaire = prixUnitaire;
      item.originalDocumentItem.tva = tva;
      item.originalDocumentItem.montantHT = montantHT;
      item.originalDocumentItem.montantTVA = montantTVA;
      item.originalDocumentItem.montantTTC = montantTTC;
      

    } else {

    }
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

      this.showSuccess(`Nombre de colis modifié: ${oldColisCount} → ${newColisCount}`);
    }

    // Update document display immediately
    this.generateDocumentHtml();

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

  // Unit Price Edit Modal Methods
  editUnitPrice(product: any): void {
    this.selectedProductForPriceEdit = product;
    // Get current unit price from originalDocumentItem or calculate from product
    let currentPrice = 0;
    if (product.originalDocumentItem && product.originalDocumentItem.prixUnitaire) {
      currentPrice = Number(product.originalDocumentItem.prixUnitaire) || 0;
    } else {
      const produit = this.produitsDeCaisseCache.get(product.articleId);
      if (produit) {
        currentPrice = Number(produit.prix_vente_TTC) || 0;
        if (this.hasCustomPrice(produit)) {
          currentPrice = Number(this.getWholesalePrice(produit)) || 0;
        }
      }
    }
    this.editedUnitPrice = currentPrice.toFixed(3);
    this.shouldClearPriceOnFirstTap = true; // Set flag to clear on first tap
    this.showUnitPriceEditModal = true;
  }

  closeUnitPriceEditModal(): void {
    this.showUnitPriceEditModal = false;
    this.selectedProductForPriceEdit = null;
    this.editedUnitPrice = '';
    this.shouldClearPriceOnFirstTap = false; // Reset flag
  }

  updateUnitPrice(): void {
    if (!this.selectedProductForPriceEdit || !this.editedUnitPrice.trim()) {
      this.showError('Veuillez saisir un prix unitaire valide');
      return;
    }

    const newUnitPrice = parseFloat(this.editedUnitPrice);
    if (isNaN(newUnitPrice) || newUnitPrice < 0) {
      this.showError('Le prix unitaire doit être un nombre positif ou zéro');
      return;
    }

    const itemIndex = this.scannedItems.findIndex(item => item.articleId === this.selectedProductForPriceEdit.articleId);
    if (itemIndex >= 0) {
      // Get current unit price for comparison
      let oldUnitPrice = 0;
      if (this.scannedItems[itemIndex].originalDocumentItem && this.scannedItems[itemIndex].originalDocumentItem.prixUnitaire) {
        oldUnitPrice = Number(this.scannedItems[itemIndex].originalDocumentItem.prixUnitaire) || 0;
      }

      // Update the unit price in originalDocumentItem
      if (!this.scannedItems[itemIndex].originalDocumentItem) {
        this.scannedItems[itemIndex].originalDocumentItem = {
          prixUnitaire: 0,
          tva: 19,
          montantHT: 0,
          montantTVA: 0,
          montantTTC: 0
        };
      }
      this.scannedItems[itemIndex].originalDocumentItem.prixUnitaire = newUnitPrice;
      



      // Recalculate prices based on the new unit price
      this.recalculateItemPrices(itemIndex);
      


      // Update the selectedProductForDetails object to reflect the changes immediately
      if (this.selectedProductForDetails) {
        this.selectedProductForDetails.originalDocumentItem = this.scannedItems[itemIndex].originalDocumentItem;
      }

      this.showSuccess(`Prix unitaire modifié: ${oldUnitPrice.toFixed(3)} DT → ${newUnitPrice.toFixed(3)} DT`);
    }

    // Update document display immediately
    this.generateDocumentHtml();

    this.closeUnitPriceEditModal();
  }

  // Unit Price Numpad methods
  addPriceDigit(digit: string): void {
    if (this.shouldClearPriceOnFirstTap) {
      // Clear the current value and start fresh
      this.editedUnitPrice = digit;
      this.shouldClearPriceOnFirstTap = false; // Reset flag after first tap
    } else if (this.editedUnitPrice.length < 10) { // Limit to reasonable length
      this.editedUnitPrice += digit;
    }
  }

  removeLastPriceDigit(): void {
    this.editedUnitPrice = this.editedUnitPrice.slice(0, -1);
  }

  clearUnitPrice(): void {
    this.editedUnitPrice = '';
    this.shouldClearPriceOnFirstTap = false; // Reset flag when manually clearing
  }

  addPriceDecimalPoint(): void {
    if (this.shouldClearPriceOnFirstTap) {
      // Clear the current value and start with decimal point
      this.editedUnitPrice = '0.';
      this.shouldClearPriceOnFirstTap = false; // Reset flag after first tap
    } else if (!this.editedUnitPrice.includes('.')) {
      this.editedUnitPrice += '.';
    }
  }

  // Helper methods for product grouping and display
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

    // Group scanned items by their parent product or famille
    this.scannedItems.forEach(item => {
      const scannedProduit = this.produitsDeCaisseCache.get(item.articleId);
      let groupKey: number;
      
      if (scannedProduit && scannedProduit.parentProductId) {
        // This is a sous-produit, group it under its parent product
        groupKey = scannedProduit.parentProductId;
      } else {
        // For document items (main products), group by product ID
        // Since these are main products, each one gets its own group
        groupKey = item.articleId;
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
    }> = [];

    for (const [key, items] of groups) {
      if (key > 0) {
        // This is a parent product group
        let parentProduct = this.productsCache.get(key);
        
        // For document items, if we don't have the product in cache, create a mock product from the item
        if (!parentProduct && items.length > 0) {
          const firstItem = items[0];
          // Try to find the product in the document items
          const documentItem = this.document?.items?.find(item => item.productId === key);
          if (documentItem?.product) {
            // Cast the document item product to the expected Product type
            parentProduct = documentItem.product as any;
          } else {
            // Create a mock product with the product name
            parentProduct = {
              id: key,
              name: firstItem.productName,
              famille: documentItem?.famille || firstItem.productName
            } as any;
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
    if (!this.document?.client) {
      return false;
    }

    // Bundle-level price on parent product
    if (produit.parentProductId) {
      const parentProduct = this.productsCache.get(produit.parentProductId);
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

  // Data loading methods
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

      } else {
        this.loadDepotById(currentSession.depotId);
      }
    }

    // Also subscribe to changes
    this.sessionsService.currentSession$.subscribe({
      next: (session) => {

        if (session && session.depotId) {
          this.currentDepotId = session.depotId;

          // Store the depot information from the session if available
          if (session.depot) {
            this.currentDepot = session.depot;

          } else {
            // If depot info is not in session, load it separately

            this.loadDepotById(session.depotId);
          }
        } else {

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

        }
      },
      error: (error) => {
        console.error('Error loading depot by ID:', error);
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

  getProductCardColor(index: number, productIndex: number): string {
    const colors = [
      'bg-purple-400 border-purple-500',
      'bg-pink-400 border-pink-500',
      'bg-blue-400 border-blue-500',
      'bg-teal-400 border-teal-500',
      'bg-emerald-400 border-emerald-500',
      'bg-amber-400 border-amber-500',
      'bg-orange-400 border-orange-500',
      'bg-red-400 border-red-500',
      'bg-indigo-400 border-indigo-500',
      'bg-cyan-400 border-cyan-500',
      'bg-violet-400 border-violet-500',
      'bg-rose-400 border-rose-500',
      'bg-sky-400 border-sky-500',
      'bg-lime-400 border-lime-500',
      'bg-yellow-400 border-yellow-500'
    ];
    
    return colors[index % colors.length];
  }
}