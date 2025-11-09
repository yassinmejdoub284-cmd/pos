import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ProductsService } from '../../core/services/products.service';
import { AuthService } from '../../core/services/auth.service';
import { Product } from '../../core/models/product.model';

@Component({
  selector: 'app-transfer-vers-vrag',
  templateUrl: './transfer-vers-vrag.component.html',
  standalone: false
})
export class TransferVersVragComponent implements OnInit {
  products: Product[] = [];
  vraguableProducts: Product[] = [];
  loading = false;
  error = '';
  viewMode: 'table' | 'grid' = 'table';
  showTransferModal = false;
  selectedProductForTransfer: Product | null = null;

  constructor(
    private router: Router,
    private productsService: ProductsService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.loadProducts();
  }

  loadProducts(): void {
    this.loading = true;
    this.error = '';

    const userDepotId = this.authService.currentUser()?.depotId || 0;
    const visitingDepotIdStr = sessionStorage.getItem('visitingDepotId');
    const currentDepotId = visitingDepotIdStr ? parseInt(visitingDepotIdStr) : userDepotId;

    this.productsService.getProducts(currentDepotId || undefined).subscribe({
      next: (products) => {
        this.products = products;
        this.vraguableProducts = products.filter(product => product.isVraguable === true);
        this.loading = false;
      },
      error: (error) => {
        this.error = 'Erreur lors du chargement des produits';
        this.loading = false;
      }
    });
  }

  toggleViewMode(): void {
    this.viewMode = this.viewMode === 'table' ? 'grid' : 'table';
  }

  goBack(): void {
    this.router.navigate(['/stock']);
  }

  trackByProduct = (_index: number, product: Product): number => {
    return product.id;
  }

  openTransferModal(product: Product): void {
    this.selectedProductForTransfer = product;
    this.showTransferModal = true;
  }

  closeTransferModal(): void {
    this.showTransferModal = false;
    this.selectedProductForTransfer = null;
  }

  onProductTransferred(transferData: {
    targetProductId: number;
    quantity: number;
    conversionRatio: number;
    targetType: string;
  }): void {
    if (!this.selectedProductForTransfer) return;

    this.loading = true;
    this.error = '';

    const userDepotId = this.authService.currentUser()?.depotId || 0;
    const visitingDepotIdStr = sessionStorage.getItem('visitingDepotId');
    const currentDepotId = visitingDepotIdStr ? parseInt(visitingDepotIdStr) : userDepotId;

    const transferPayload = {
      sourceProductId: this.selectedProductForTransfer.id,
      targetProductId: transferData.targetProductId,
      quantity: parseFloat(transferData.quantity.toString()),
      conversionRatio: parseFloat(transferData.conversionRatio.toString()),
      depotId: currentDepotId
    };

    console.log('Transfer payload:', transferPayload);

    this.productsService.transferProduct(transferPayload).subscribe({
      next: () => {
        this.closeTransferModal();
        this.loadProducts();
        this.loading = false;
      },
      error: (error) => {
        this.error = error.error?.error || 'Erreur lors du transfert du produit';
        this.loading = false;
      }
    });
  }
}

