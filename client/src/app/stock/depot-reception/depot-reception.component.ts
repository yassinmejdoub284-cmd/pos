import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { StockDocumentsService } from '../../core/services/stock-documents.service';
import { DepotsService } from '../../core/services/depots.service';
import { ScanResult } from '../../core/models/stock-document.model';

@Component({
  selector: 'app-depot-reception',
  templateUrl: './depot-reception.component.html',
  standalone: false
})
export class DepotReceptionComponent implements OnInit {
  depotType: string = '';
  currentDepot: any = null;
  pendingShipments: any[] = [];
  loading = false;
  error = '';
  success = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private stockDocumentsService: StockDocumentsService,
    private depotsService: DepotsService
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const depotId = params.get('depotId');
      if (depotId) {
        this.loadCurrentDepot(parseInt(depotId, 10));
      }
    });
  }

  loadCurrentDepot(depotId: number): void {
    this.depotsService.get(depotId).subscribe({
      next: (depot) => {
        this.currentDepot = depot;
        this.depotType = depot.type;
        this.loadPendingShipments();
      },
      error: () => {
        this.error = 'Erreur lors du chargement du dépôt';
      }
    });
  }

  loadPendingShipments(): void {
    if (!this.currentDepot) return;
    
    this.loading = true;
    this.error = '';
    
    
    this.stockDocumentsService.getDocuments(1, 50, undefined, 'PREPARED', this.currentDepot.id).subscribe({
      next: (response) => {
        this.pendingShipments = response.data || [];
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading shipments:', err);
        this.loading = false;
        this.error = err.error?.error || 'Erreur lors du chargement des expéditions';
      }
    });
  }

  confirmReceipt(shipment: any): void {
    this.loading = true;
    this.error = '';
    this.success = '';

    this.stockDocumentsService.receiveDocument(shipment.id, this.currentDepot.id).subscribe({
      next: (document) => {
        this.loading = false;
        this.success = 'Expédition reçue avec succès';
        this.loadPendingShipments(); // Reload the list
      },
      error: (err) => {
        this.loading = false;
        this.error = err.error?.error || 'Erreur lors de la réception';
      }
    });
  }

  goBack(): void {
    this.router.navigate(['/stock']);
  }
}
