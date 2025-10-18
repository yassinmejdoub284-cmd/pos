import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { StockDocumentsService } from '../../../core/services/stock-documents.service';
import { StockDocument } from '../../../core/models/stock-document.model';
import { buildScanLikeDocumentHtmlFromDocument, getScanPrintStyles } from '../../shared/print-templates';
import { SettingsService } from '../../../core/services/settings.service';
import { ProduitsDeCaisseService } from '../../../core/services/produits-de-caisse.service';
import { ProductsService } from '../../../core/services/products.service';

@Component({
  selector: 'app-document',
  templateUrl: './document.component.html',
  styleUrls: ['./document.component.css'],
  standalone: false
})
export class DocumentComponent implements OnInit {
  document: StockDocument | null = null;
  loading = true;
  error = '';
  showInvoiceModal = false;
  invoiceNumber = '';
  documentHtml = '';
  printStyles = '';
  safeDocumentHtml: SafeHtml = '';
  
  // Caches for products and produits de caisse
  productsCache = new Map<number, any>();
  produitsDeCaisseCache = new Map<number, any>();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private stockDocumentsService: StockDocumentsService,
    private settingsService: SettingsService,
    private sanitizer: DomSanitizer,
    private produitsDeCaisseService: ProduitsDeCaisseService,
    private productsService: ProductsService
  ) {}

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      const documentId = params['id'];
      if (documentId) {
        this.loadDocument(documentId);
      }
    });
  }

  loadDocument(id: string): void {
    this.loading = true;
    this.error = '';
    
    this.stockDocumentsService.getDocumentById(id).subscribe({
      next: (document) => {
        console.log('Document loaded:', document);
        console.log('Client information:', document.client);
        console.log('Client ID:', document.clientId);
        this.document = document;
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

  generateDocumentHtml(): void {
    if (!this.document) return;
    
    // Get the document type for the print template
    const sessionType = this.getSessionType();
    
    // Load settings for the print template
    this.settingsService.getSettings().subscribe({
      next: (settings) => {
        // Generate the exact HTML using the print template function
        this.documentHtml = buildScanLikeDocumentHtmlFromDocument(this.document!, sessionType, settings);
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
        this.documentHtml = buildScanLikeDocumentHtmlFromDocument(this.document!, sessionType, null);
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
            console.log('Image failed to load:', img.src);
          };
          img.onload = () => {
            console.log('Image loaded successfully:', img.src);
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
    
    console.log('Generating invoice for document:', this.document.id);
    console.log('Using invoice number:', this.invoiceNumber);
    
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

    console.log('Invoice data with real products:', invoiceData);
    console.log('Original document clientId:', this.document.clientId);
    console.log('Original document client:', this.document.client);
    console.log('Final clientId being sent:', invoiceData.clientId);

    // Create the invoice document
    this.stockDocumentsService.createDocument(invoiceData).subscribe({
      next: (createdInvoice) => {
        console.log('Invoice created successfully:', createdInvoice);
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

  goBack(): void {
    this.router.navigate(['/stock/documents']);
  }
}