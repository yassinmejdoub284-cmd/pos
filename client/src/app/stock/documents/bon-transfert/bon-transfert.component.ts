import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { StockDocumentsService } from '../../../core/services/stock-documents.service';
import { DepotsService } from '../../../core/services/depots.service';
import { SettingsService, AppSettings } from '../../../core/services/settings.service';
import { StockDocument } from '../../../core/models/stock-document.model';
import { buildScanLikeDocumentHtmlFromDocument, getScanPrintStyles } from '../../shared/print-templates';
import { Depot } from '../../../core/models/stock-document.model';

@Component({
  selector: 'app-bon-transfert',
  templateUrl: './bon-transfert.component.html',
  styleUrls: ['./bon-transfert.component.css'],
  standalone: false
})
export class BonTransfertComponent implements OnInit {
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

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private stockDocsService: StockDocumentsService,
    private depotsService: DepotsService,
    private settingsService: SettingsService
  ) {}

  ngOnInit(): void {
    this.depotId = this.route.snapshot.paramMap.get('id');
    this.loadInitialData();
    
    // Check if we're in edit mode
    const url = this.router.url;
    this.isEditMode = url.includes('/edit/');
    
    if (this.depotId) {
      this.loadDocumentsForDepot();
    }
  }

  loadInitialData(): void {
    this.loading = true;
    
    Promise.all([
      this.depotsService.list().toPromise(),
      this.settingsService.getSettings().toPromise()
    ]).then(([depots, settings]) => {
      this.depots = depots || [];
      this.settings = settings || null;
      this.loading = false;
    }).catch(error => {
      this.error = 'Erreur lors du chargement des données';
      this.loading = false;
    });
  }

  loadDocumentsForDepot(): void {
    if (!this.depotId) return;
    
    this.loading = true;
    this.stockDocsService.getDocuments(1, 50, 'BON_TRANSFERT', undefined, parseInt(this.depotId)).subscribe({
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
    this.selectedDocument = document;
    this.showDocumentDetails = true;
  }

  closeDocumentDetails(): void {
    this.showDocumentDetails = false;
    this.selectedDocument = null;
  }

  editDocument(): void {
    if (this.selectedDocument) {
      // Navigate to the edit page for this document
      this.router.navigate(['/stock/documents/bon-transfert/edit', this.selectedDocument.id]);
    }
  }

  editDocumentFromList(document: StockDocument): void {
    // Navigate to the edit page for this document
    this.router.navigate(['/stock/documents/bon-transfert/edit', document.id]);
  }

  getDepotName(depotId: number): string {
    const depot = this.depots.find(d => d.id === depotId);
    return depot ? depot.name : `Dépôt ${depotId}`;
  }

  formatDate(date: string | Date): string {
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
      this.router.navigate(['/stock/scan', this.depotId], { queryParams: { type: 'transfert' } });
    }
  }

  printDocument(document: StockDocument): void {
    const printContent = buildScanLikeDocumentHtmlFromDocument(document, 'transfert', this.settings);
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      this.error = 'Impossible d\'ouvrir la fenêtre d\'impression';
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Bon de Transfert - ${document.numero}</title>
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

}
