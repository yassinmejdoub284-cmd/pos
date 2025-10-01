import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { StockDocumentsService } from '../../../core/services/stock-documents.service';
import { DepotsService } from '../../../core/services/depots.service';
import { SettingsService, AppSettings } from '../../../core/services/settings.service';
import { ClientsService } from '../../../core/services/clients.service';
import { StockDocument } from '../../../core/models/stock-document.model';
import { buildScanLikeDocumentHtmlFromDocument, getScanPrintStyles } from '../../shared/print-templates';
import { Depot } from '../../../core/models/stock-document.model';

@Component({
  selector: 'app-bon-livraison',
  templateUrl: './bon-livraison.component.html',
  styleUrls: ['./bon-livraison.component.css'],
  standalone: false
})
export class BonLivraisonComponent implements OnInit {
  depotId: string | null = null;
  documents: StockDocument[] = [];
  selectedDocument: StockDocument | null = null;
  loading = false;
  error = '';
  success = '';

  // Available options
  depots: Depot[] = [];
  settings: AppSettings | null = null;

  // UI state
  showDocumentDetails = false;
  isEditMode = false;
  documentToEdit: StockDocument | null = null;
  // Invoice modal
  showInvoiceModal = false;
  invoiceNumber: string = '';
  
  // Edit form
  editForm = {
    clientId: null as number | null,
    destination: '',
    validationFromDate: '',
    validationToDate: '',
    notes: ''
  };

  // Available clients
  availableClients: any[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private stockDocsService: StockDocumentsService,
    private depotsService: DepotsService,
    private settingsService: SettingsService,
    private clientsService: ClientsService
  ) {}

  ngOnInit(): void {
    this.depotId = this.route.snapshot.paramMap.get('id');
    this.loadInitialData();
    
    // Check if we're in edit mode
    const url = this.router.url;
    this.isEditMode = url.includes('/edit/');
    
    if (this.isEditMode && this.depotId) {
      // In edit mode, load the specific document
      this.loadDocumentForEdit(parseInt(this.depotId));
    } else if (this.depotId) {
      // In view mode, load all documents for the depot
      this.loadDocumentsForDepot();
    }
  }

  loadInitialData(): void {
    this.loading = true;
    
    Promise.all([
      this.depotsService.list().toPromise(),
      this.settingsService.getSettings().toPromise(),
      this.clientsService.getClients().toPromise()
    ]).then(([depots, settings, clientsResponse]) => {
      this.depots = depots || [];
      this.settings = settings || null;
      this.availableClients = clientsResponse?.clients || [];
      this.loading = false;
    }).catch(error => {
      this.error = 'Erreur lors du chargement des données';
      this.loading = false;
    });
  }

  loadDocumentsForDepot(): void {
    if (!this.depotId) return;
    
    this.loading = true;
    this.stockDocsService.getDocuments(1, 50, 'BON_ENTREE_MAGASIN', undefined, parseInt(this.depotId)).subscribe({
      next: (response) => {
        this.documents = response.data || [];
        this.loading = false;
      },
      error: (error) => {
        this.error = 'Erreur lors du chargement des documents';
        this.loading = false;
      }
    });
  }

  viewDocument(document: StockDocument): void {
    this.loading = true;
    this.stockDocsService.getDocument(document.id).subscribe({
      next: (fullDocument) => {
        this.selectedDocument = fullDocument;
        this.showDocumentDetails = true;
        this.loading = false;
      },
      error: (error) => {
        this.error = 'Erreur lors du chargement du document';
        this.loading = false;
      }
    });
  }

  closeDocumentDetails(): void {
    this.showDocumentDetails = false;
    this.selectedDocument = null;
  }

  editDocument(): void {
    if (this.selectedDocument) {
      // Navigate to the edit page for this document
      this.router.navigate(['/stock/documents/bon-livraison/edit', this.selectedDocument.id]);
    }
  }

  editDocumentFromList(document: StockDocument): void {
    // Navigate to the edit page for this document
    this.router.navigate(['/stock/documents/bon-livraison/edit', document.id]);
  }

  getDepotName(depotId: number): string {
    const depot = this.depots.find(d => d.id === depotId);
    return depot ? depot.name : `Dépôt ${depotId}`;
  }

  getClientName(clientId: number): string {
    const client = this.availableClients.find(c => c.id === clientId);
    return client ? `${client.firstName} ${client.lastName}` : `Client ${clientId}`;
  }

  formatDate(date: string | Date): string {
    if (!date) return '';
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleDateString('fr-FR');
  }

  getTotalQuantity(items: any[] | undefined): number {
    if (!items || items.length === 0) return 0;
    const total = items.reduce((sum, item) => {
      const quantity = Number(item.quantity) || 0;
      return sum + quantity;
    }, 0);
    return Math.round(total * 1000) / 1000; // Round to 3 decimal places
  }

  getTotalCount(items: any[] | undefined): number {
    if (!items || items.length === 0) return 0;
    return items.reduce((sum, item) => {
      const count = Number(item['count']) || 0;
      return sum + count;
    }, 0);
  }

  goBack(): void {
    this.router.navigate(['/stock']);
  }

  goToScan(): void {
    if (this.depotId) {
      this.router.navigate(['/stock/scan', this.depotId], { queryParams: { type: 'livraison' } });
    }
  }

  printDocument(document: StockDocument): void {
    const printContent = buildScanLikeDocumentHtmlFromDocument(document, 'livraison', this.settings);
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      this.error = 'Impossible d\'ouvrir la fenêtre d\'impression';
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Bon de Livraison - ${document.numero}</title>
        <style>${getScanPrintStyles()}</style>
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
    }, 500);
  }

  // Generate invoice: ask number, print, and save to /invoices
  openInvoiceModal(document?: StockDocument): void {
    if (document) {
      this.selectedDocument = document;
    }
    this.invoiceNumber = '';
    this.showInvoiceModal = true;
  }

  cancelInvoice(): void {
    this.showInvoiceModal = false;
  }

  confirmGenerateInvoice(): void {
    if (!this.selectedDocument || !this.invoiceNumber) {
      return;
    }
    // Build invoice HTML by reusing livraison template but with title override
    const html = this.buildInvoiceHtml(this.selectedDocument, this.invoiceNumber);

    // Print
    const w = window.open('', '_blank');
    if (w) {
      w.document.write(html);
      w.document.close();
      w.focus();
      setTimeout(() => { w.print(); w.close(); }, 500);
    }

    // Save on server
    fetch(`${this.stockDocsService['apiUrl']}/${this.selectedDocument.id}/generate-invoice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
      body: JSON.stringify({ invoiceNumber: this.invoiceNumber, html })
    }).catch(() => {});

    this.showInvoiceModal = false;
  }

  private buildInvoiceHtml(document: StockDocument, invoiceNumber: string): string {
    const styles = getScanPrintStyles();
    // Start from the livraison layout but transform its header into an invoice header
    let content = buildScanLikeDocumentHtmlFromDocument(document, 'livraison', this.settings);
    // Replace title and number in the existing header
    content = content
      .replace('<div class="title">Bon de Livraison</div>', '<div class="title">FACTURE</div>')
      .replace(new RegExp(`N°\\s*${document.numero}`), `N° ${invoiceNumber}`);
    // Return a clean printable HTML with only one header (already inside content)
    return `<!DOCTYPE html><html><head><title>Facture ${invoiceNumber}</title><style>${styles}</style></head><body>${content}</body></html>`;
  }

  // Edit functionality
  loadDocumentForEdit(documentId: number): void {
    this.loading = true;
    this.error = '';
    
    this.stockDocsService.getDocument(documentId).subscribe({
      next: (document) => {
        this.documentToEdit = document;
      this.editForm = {
        clientId: document.clientId || null,
        destination: document.destination || '',
        validationFromDate: document.validationFromDate ? new Date(document.validationFromDate).toISOString().split('T')[0] : '',
        validationToDate: document.validationToDate ? new Date(document.validationToDate).toISOString().split('T')[0] : '',
        notes: document.notes || ''
      };
        this.loading = false;
      },
      error: (error) => {
        this.error = 'Erreur lors du chargement du document';
        this.loading = false;
      }
    });
  }

  saveDocument(): void {
    if (!this.documentToEdit) return;
    
    this.loading = true;
    this.error = '';
    
      const updateData = {
        clientId: this.editForm.clientId,
        destination: this.editForm.destination,
        validationFromDate: this.editForm.validationFromDate,
        validationToDate: this.editForm.validationToDate,
        notes: this.editForm.notes,
        items: this.documentToEdit.items?.map(item => ({
          id: item.id,
          productId: item.productId,
          famille: item.famille,
          quantity: item.quantity,
          count: item.count,
          notes: item.notes
        })) || []
      };
    
    this.stockDocsService.updateDocument(this.documentToEdit.id, updateData).subscribe({
      next: (updatedDocument) => {
        this.documentToEdit = updatedDocument;
        this.success = 'Document mis à jour avec succès';
        this.loading = false;
        setTimeout(() => this.success = '', 3000);
      },
      error: (error) => {
        this.error = 'Erreur lors de la mise à jour du document';
        this.loading = false;
        setTimeout(() => this.error = '', 5000);
      }
    });
  }

  cancelEdit(): void {
    this.router.navigate(['/stock/documents/bon-livraison', this.documentToEdit?.id]);
  }

}
