import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ProductsService } from '../../core/services/products.service';
import { AuthService } from '../../core/services/auth.service';
import { Product, ProductFamily } from '../../core/models/product.model';

@Component({
  selector: 'app-transfer-vers-vrag',
  templateUrl: './transfer-vers-vrag.component.html',
  standalone: false
})
export class TransferVersVragComponent implements OnInit {
  products: Product[] = [];
  vraguableProducts: Product[] = [];
  juscVracFamilyId: number | null = null;
  families: ProductFamily[] = [];
  loading = false;
  error = '';
  showTransferModal = false;
  selectedProductForTransfer: Product | null = null;

  constructor(
    private router: Router,
    private productsService: ProductsService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.loadFamilies();
    this.loadProducts();
  }

  loadFamilies(): void {
    this.productsService.getFamilles().subscribe({
      next: (families) => {
        this.families = families;
        // Try different variations of JUS VRAC name
        const juscVracFamily = families.find(f => 
          f.name === 'JUS VRAC' || 
          f.name === 'JUS VRAC' || 
          f.name.toUpperCase() === 'JUS VRAC' ||
          f.name.toUpperCase().includes('JUS') && f.name.toUpperCase().includes('VRAC')
        );
        if (juscVracFamily) {
          this.juscVracFamilyId = juscVracFamily.id;
        } else {
          // If not found, log available families for debugging
          console.warn('Famille JUS VRAC non trouvée. Familles disponibles:', families.map(f => f.name));
        }
      },
      error: (error) => {
        console.error('Error loading families:', error);
      }
    });
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
        // Filter products that are vraguable and can be transferred to JUS VRAC family
        this.vraguableProducts = products.filter(product => product.isVraguable === true);
        this.loading = false;
      },
      error: (error) => {
        this.error = 'Erreur lors du chargement des produits';
        this.loading = false;
      }
    });
  }


  goBack(): void {
    this.router.navigate(['/stock']);
  }

  trackByProduct = (_index: number, product: Product): number => {
    return product.id;
  }

  juscVracProducts: Product[] = [];
  selectedTargetProduct: Product | null = null;
  transferQuantity = 1;

  openTransferModal(product: Product): void {
    this.selectedProductForTransfer = product;
    this.selectedTargetProduct = null;
    this.transferQuantity = 1;
    // Conversion ratio is taken from source product, not editable
    this.loadJuscVracProducts();
    this.showTransferModal = true;
  }

  closeTransferModal(): void {
    this.showTransferModal = false;
    this.selectedProductForTransfer = null;
    this.selectedTargetProduct = null;
  }

  loadJuscVracProducts(): void {
    if (!this.juscVracFamilyId) {
      this.error = 'Famille JUS VRAC non trouvée';
      return;
    }

    const userDepotId = this.authService.currentUser()?.depotId || 0;
    const visitingDepotIdStr = sessionStorage.getItem('visitingDepotId');
    const currentDepotId = visitingDepotIdStr ? parseInt(visitingDepotIdStr) : userDepotId;

    this.productsService.getProducts(currentDepotId || undefined).subscribe({
      next: (products) => {
        this.juscVracProducts = products.filter(product => 
          product.familleId === this.juscVracFamilyId && 
          product.id !== this.selectedProductForTransfer?.id
        );
      },
      error: (error) => {
        this.error = 'Erreur lors du chargement des produits JUS VRAC';
      }
    });
  }

  selectTargetProduct(product: Product): void {
    this.selectedTargetProduct = product;
  }

  onProductTransferred(): void {
    if (!this.selectedProductForTransfer || !this.selectedTargetProduct) {
      this.error = 'Veuillez sélectionner un produit cible';
      return;
    }

    if (this.transferQuantity <= 0) {
      this.error = 'La quantité doit être positive';
      return;
    }

    // Use conversion ratio from source product, default to 1 if not available
    const conversionRatio = this.selectedProductForTransfer.conversionRatio || 1;
    
    if (conversionRatio <= 0) {
      this.error = 'Le ratio de conversion doit être positif';
      return;
    }

    this.loading = true;
    this.error = '';

    const userDepotId = this.authService.currentUser()?.depotId || 0;
    const visitingDepotIdStr = sessionStorage.getItem('visitingDepotId');
    const currentDepotId = visitingDepotIdStr ? parseInt(visitingDepotIdStr) : userDepotId;

    const transferPayload = {
      sourceProductId: this.selectedProductForTransfer.id,
      targetProductId: this.selectedTargetProduct.id,
      quantity: parseFloat(this.transferQuantity.toString()),
      conversionRatio: conversionRatio,
      depotId: currentDepotId
    };

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

