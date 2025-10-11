import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { StockDocumentsService } from '../../../core/services/stock-documents.service';
import { StockDocument } from '../../../core/models/stock-document.model';
import { buildScanLikeDocumentHtmlFromDocument, getScanPrintStyles } from '../../shared/print-templates';
import { SettingsService } from '../../../core/services/settings.service';

@Component({
  selector: 'app-document',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './document.component.html',
  styleUrls: ['./document.component.css']
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

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private stockDocumentsService: StockDocumentsService,
    private settingsService: SettingsService,
    private sanitizer: DomSanitizer
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
          font-family: 'Times New Roman', serif !important;
          font-size: 12px !important;
          line-height: 1.5 !important;
          color: #000 !important;
          background: white !important;
        }
        .document-wrapper .container {
          max-width: 800px !important;
          margin: 0 auto !important;
          border: 2px solid #000 !important;
          padding: 20px !important;
          background: white !important;
        }
        .document-wrapper .header {
          display: flex !important;
          justify-content: space-between !important;
          margin-bottom: 25px !important;
          border-bottom: 3px solid #000 !important;
          padding-bottom: 15px !important;
        }
        .document-wrapper .company-info {
          flex: 1 !important;
        }
        .document-wrapper .document-info {
          text-align: right !important;
          flex: 1 !important;
        }
        .document-wrapper .title {
          font-size: 24px !important;
          font-weight: bold !important;
          margin-bottom: 5px !important;
          text-transform: uppercase !important;
          letter-spacing: 1px !important;
        }
        .document-wrapper .subtitle {
          font-size: 14px !important;
          color: #333 !important;
          margin-bottom: 10px !important;
          font-weight: bold !important;
        }
        .document-wrapper .info-row {
          margin: 4px 0 !important;
          font-size: 12px !important;
        }
        .document-wrapper .info-section {
          margin: 12px 0 !important;
          padding: 10px !important;
          background-color: #f8f8f8 !important;
          border: 1px solid #ccc !important;
          border-radius: 4px !important;
        }
        .document-wrapper .label {
          font-weight: bold !important;
          display: inline-block !important;
          width: 140px !important;
          color: #333 !important;
        }
        .document-wrapper .value {
          font-weight: normal !important;
          color: #000 !important;
        }
        .document-wrapper table {
          width: 100% !important;
          border-collapse: collapse !important;
          margin: 20px 0 !important;
          font-size: 12px !important;
          border: 2px solid #000 !important;
        }
        .document-wrapper th,
        .document-wrapper td {
          border: 1px solid #000 !important;
          padding: 8px !important;
          text-align: left !important;
        }
        .document-wrapper th {
          background-color: #e0e0e0 !important;
          font-weight: bold !important;
          text-align: center !important;
          font-size: 11px !important;
          text-transform: uppercase !important;
          letter-spacing: 0.5px !important;
        }
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
          width: 300px !important;
          margin-bottom: 5px !important;
          font-size: 13px !important;
        }
        .document-wrapper .total-final {
          border-top: 1px solid #000 !important;
          padding-top: 5px !important;
          font-weight: bold !important;
          font-size: 14px !important;
        }
        .document-wrapper .footer {
          margin-top: 40px !important;
          border-top: 2px solid #000 !important;
          padding-top: 20px !important;
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
      case 'BON_ENTREE_MAGASIN':
        return 'Bon de Livraison';
      case 'BON_EXPEDITION':
        return 'Bon de Sortie';
      case 'BON_TRANSFERT':
        return 'Bon de Transfert';
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
    this.invoiceNumber = '';
  }

  cancelInvoice(): void {
    this.showInvoiceModal = false;
    this.invoiceNumber = '';
  }

  confirmGenerateInvoice(): void {
    if (!this.invoiceNumber || !this.document) return;
    
    // TODO: Implement invoice generation logic
    console.log('Generating invoice:', this.invoiceNumber, 'for document:', this.document.id);
    
    this.cancelInvoice();
  }

  goToScan(): void {
    this.router.navigate(['/scanning']);
  }

  goBack(): void {
    this.router.navigate(['/stock/documents']);
  }
}