import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { StockDocumentsService } from '../../core/services/stock-documents.service';
import { DepotsService } from '../../core/services/depots.service';
import { Depot } from '../../core/models/depot.model';

@Component({
  selector: 'app-shop-transfer',
  templateUrl: './shop-transfer.component.html',
  styleUrls: ['./shop-transfer.component.css'],
  standalone: false
})
export class ShopTransferComponent implements OnInit {
  depotType: string = '';
  currentDepot: any = null;
  pendingTransfers: any[] = [];
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
        this.loadData(parseInt(depotId, 10));
      }
    });
  }

  loadData(depotId: number): void {
    this.depotsService.get(depotId).subscribe({
      next: (currentDepot) => {
        this.currentDepot = currentDepot;
        this.depotType = currentDepot.type;
        this.loadPendingTransfers();
      },
      error: () => {
        this.error = 'Erreur lors du chargement du dépôt';
      }
    });
  }

  loadPendingTransfers(): void {
    if (!this.currentDepot) return;
    
    this.loading = true;
    this.error = '';
    
    console.log('Loading pending transfers for shop depot:', this.currentDepot.id);
    
    this.stockDocumentsService.getDocuments(1, 50, 'BON_TRANSFERT', 'PREPARED', this.currentDepot.id).subscribe({
      next: (response) => {
        console.log('Received transfer response:', response);
        this.pendingTransfers = response.data || [];
        console.log('Pending transfers:', this.pendingTransfers);
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.error = err.error?.error || 'Erreur lors du chargement des transferts';
      }
    });
  }

  confirmTransfer(transfer: any): void {
    this.loading = true;
    this.error = '';
    this.success = '';

    this.stockDocumentsService.receiveDocument(transfer.id, this.currentDepot.id).subscribe({
      next: (document) => {
        this.loading = false;
        this.success = 'Transfert confirmé avec succès';
        this.loadPendingTransfers(); // Reload the list
      },
      error: (err) => {
        this.loading = false;
        this.error = err.error?.error || 'Erreur lors de la confirmation';
      }
    });
  }

  goBack(): void {
    this.router.navigate(['/stock']);
  }
}
