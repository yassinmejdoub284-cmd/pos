import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { StockDocumentsService } from '../../../core/services/stock-documents.service';
import { DepotsService } from '../../../core/services/depots.service';
import { StockDocument } from '../../../core/models/stock-document.model';
import { buildScanLikeDocumentHtmlFromDocument, getScanPrintStyles } from '../../shared/print-templates';
import { Depot } from '../../../core/models/stock-document.model';

@Component({
  selector: 'app-bon-sortie',
  templateUrl: './bon-sortie.component.html',
  styleUrls: ['./bon-sortie.component.css'],
  standalone: false
})
export class BonSortieComponent implements OnInit {
  depotId: string | null = null;
  documents: StockDocument[] = [];
  selectedDocument: StockDocument | null = null;
  loading = false;
  error = '';
  success = '';

  // Available options
  depots: Depot[] = [];

  // UI state
  showDocumentDetails = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private stockDocsService: StockDocumentsService,
    private depotsService: DepotsService
  ) {}

  ngOnInit(): void {
    this.depotId = this.route.snapshot.paramMap.get('id');
    this.loadInitialData();
    
    if (this.depotId) {
      this.loadDocumentsForDepot();
    }
  }

  loadInitialData(): void {
    this.loading = true;
    
    this.depotsService.list().toPromise().then(depots => {
      this.depots = depots || [];
      this.loading = false;
    }).catch(error => {
      this.error = 'Erreur lors du chargement des données';
      this.loading = false;
    });
  }

  loadDocumentsForDepot(): void {
    if (!this.depotId) return;
    
    this.loading = true;
    this.stockDocsService.getDocuments(1, 50, 'BON_EXPEDITION', undefined, parseInt(this.depotId)).subscribe({
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

  getDepotName(depotId: number): string {
    const depot = this.depots.find(d => d.id === depotId);
    return depot ? depot.name : `Dépôt ${depotId}`;
  }

  formatDate(date: string | Date): string {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleDateString('fr-FR');
  }

  getTotalQuantity(items: any[] | undefined): number {
    return items?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0;
  }

  goBack(): void {
    this.router.navigate(['/stock']);
  }

  goToScan(): void {
    if (this.depotId) {
      this.router.navigate(['/stock/scan', this.depotId], { queryParams: { type: 'sortie' } });
    }
  }

  printDocument(document: StockDocument): void {
    const printContent = buildScanLikeDocumentHtmlFromDocument(document, 'sortie');
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      this.error = 'Impossible d\'ouvrir la fenêtre d\'impression';
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Bon de Sortie - ${document.numero}</title>
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