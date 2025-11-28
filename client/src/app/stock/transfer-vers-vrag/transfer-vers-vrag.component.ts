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
  filteredVraguableProducts: Product[] = [];
  juscVracFamilyId: number | null = null;
  families: ProductFamily[] = [];
  loading = false;
  error = '';
  showTransferModal = false;
  selectedProductForTransfer: Product | null = null;
  searchQuery = '';

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
        this.vraguableProducts = products.filter(product => {
          const isSourceProduct = !product.isVrac && !product.originalProductId;
          if (!isSourceProduct) return false;
          
          const isConvertible = product.isVraguable === true;
          const hasConversionRatio = product.conversionRatio && product.conversionRatio > 0;
          const hasVracProducts = products.some(p => 
            p.isVrac && p.originalProductId === product.id
          );
          
          return isConvertible || hasConversionRatio || hasVracProducts;
        });
        this.applySearchFilter();
        this.loading = false;
      },
      error: (error) => {
        this.error = 'Erreur lors du chargement des produits';
        this.loading = false;
      }
    });
  }

  applySearchFilter(): void {
    if (!this.searchQuery || this.searchQuery.trim() === '') {
      this.filteredVraguableProducts = this.vraguableProducts;
      return;
    }

    const query = this.searchQuery.toLowerCase().trim();
    this.filteredVraguableProducts = this.vraguableProducts.filter(product => 
      product.name?.toLowerCase().includes(query) ||
      product.barcode?.toLowerCase().includes(query) ||
      product.designation_legale?.toLowerCase().includes(query) ||
      product.famille?.name?.toLowerCase().includes(query)
    );
  }

  onSearchChange(): void {
    this.applySearchFilter();
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

    if (!this.selectedProductForTransfer) {
      return;
    }

    const userDepotId = this.authService.currentUser()?.depotId || 0;
    const visitingDepotIdStr = sessionStorage.getItem('visitingDepotId');
    const currentDepotId = visitingDepotIdStr ? parseInt(visitingDepotIdStr) : userDepotId;

    this.productsService.getProducts(currentDepotId || undefined).subscribe({
      next: (products) => {
        const allJusVracProducts = products.filter(product => {
          const isVracProduct = product.isVrac === true;
          const isInJusVracFamily = product.familleId === this.juscVracFamilyId;
          return isVracProduct && isInJusVracFamily && 
                 product.id !== this.selectedProductForTransfer?.id;
        });
        
        const relatedProducts = allJusVracProducts.filter(product => 
          product.originalProductId === this.selectedProductForTransfer?.id
        );
        
        this.juscVracProducts = relatedProducts.length > 0 
          ? relatedProducts 
          : allJusVracProducts;
        
        if (this.juscVracProducts.length === 0) {
          this.error = 'Aucun produit vrac trouvé dans la famille JUS VRAC';
        } else {
          this.error = '';
        }
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

