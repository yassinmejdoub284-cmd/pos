import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { StockDocumentsService } from '../../core/services/stock-documents.service';
import { DepotsService } from '../../core/services/depots.service';
import { ProductsService } from '../../core/services/products.service';
import { Depot } from '../../core/models/depot.model';
import { Product } from '../../core/models/product.model';

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

  // Current inventory
  inventory: any[] = [];
  products: Product[] = [];
  showCurrentInventory = false;

  // Transfer details
  selectedTransfer: any = null;
  showTransferDetails = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private stockDocumentsService: StockDocumentsService,
    private depotsService: DepotsService,
    private productsService: ProductsService
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
    this.loading = true;
    
    Promise.all([
      this.depotsService.get(depotId).toPromise(),
      this.productsService.getProducts().toPromise(),
      this.stockDocumentsService.getInventory(depotId).toPromise()
    ]).then(([currentDepot, products, inventory]) => {
      if (currentDepot) {
        this.currentDepot = currentDepot;
        this.depotType = currentDepot.type;
      }
      if (products) this.products = products;
      if (inventory) this.inventory = inventory;
      this.loadPendingTransfers();
      this.loading = false;
    }).catch(() => {
      this.error = 'Erreur lors du chargement des données';
      this.loading = false;
    });
  }

  loadPendingTransfers(): void {
    if (!this.currentDepot) return;
    
    this.error = '';
    
    console.log('Loading pending transfers for shop depot:', this.currentDepot.id);
    
    this.stockDocumentsService.getDocuments(1, 50, 'BON_TRANSFERT', 'PREPARED', this.currentDepot.id).subscribe({
      next: (response) => {
        console.log('Received transfer response:', response);
        this.pendingTransfers = response.data || [];
        console.log('Pending transfers:', this.pendingTransfers);
      },
      error: (err) => {
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
        this.loadData(this.currentDepot.id); // Reload inventory
      },
      error: (err) => {
        this.loading = false;
        this.error = err.error?.error || 'Erreur lors de la confirmation';
      }
    });
  }

  getProductName(productId: number): string {
    if (!productId || !this.products.length) return 'Chargement...';
    const product = this.products.find(p => p.id === productId);
    return product ? product.name : `Produit ID: ${productId}`;
  }

  toggleCurrentInventory(): void {
    this.showCurrentInventory = !this.showCurrentInventory;
  }

  viewTransferDetails(transfer: any): void {
    this.selectedTransfer = transfer;
    this.showTransferDetails = true;
  }

  closeTransferDetails(): void {
    this.showTransferDetails = false;
    this.selectedTransfer = null;
  }

  goBack(): void {
    this.router.navigate(['/stock']);
  }
}
