import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ProductsService } from '../../core/services/products.service';
import { AuthService } from '../../core/services/auth.service';
import { Product, ProductFamily } from '../../core/models/product.model';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-transfer-vers-vrag',
  templateUrl: './transfer-vers-vrag.component.html',
  standalone: false
})
export class TransferVersVragComponent implements OnInit {
  products: Product[] = [];
  vraguableProducts: Product[] = [];
  filteredVraguableProducts: Product[] = [];
  families: ProductFamily[] = [];
  loading = false;
  error = '';
  showTransferModal = false;
  selectedProductForTransfer: Product | null = null;
  searchQuery = '';
  vracConversions: VracConversion[] = [];
  transferQuantity = 1;
  loadingConversions = false;
  showSuccessNotification = false;
  successMessage = '';
  productConversionsMap: Map<number, VracConversion[]> = new Map();

  constructor(
    private router: Router,
    private productsService: ProductsService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.loadProducts();
  }

  async loadProducts(): Promise<void> {
    this.loading = true;
    this.error = '';

    const userDepotId = this.authService.currentUser()?.depotId || 0;
    const visitingDepotIdStr = sessionStorage.getItem('visitingDepotId');
    const currentDepotId = visitingDepotIdStr ? parseInt(visitingDepotIdStr) : userDepotId;

    try {
      const products = await firstValueFrom(this.productsService.getProducts(currentDepotId || undefined));
      this.products = products;
      
      const vraguableProductIds = new Set<number>();
      
      for (const product of products) {
        if (product.isVraguable === true) {
          vraguableProductIds.add(product.id);
        } else {
          try {
            const conversions = await firstValueFrom(this.productsService.getVracConversions(product.id));
            if (conversions && conversions.conversions && conversions.conversions.length > 0) {
              vraguableProductIds.add(product.id);
            }
          } catch (error) {
          }
        }
      }
      
      this.vraguableProducts = products.filter(product => vraguableProductIds.has(product.id));
      await this.loadAllConversions();
      this.vraguableProducts = this.vraguableProducts.filter(product => {
        const conversions = this.productConversionsMap.get(product.id);
        return conversions && conversions.length > 0;
      });
      this.applySearchFilter();
      this.loading = false;
    } catch (error) {
      this.error = 'Erreur lors du chargement des produits';
      this.loading = false;
    }
  }

  applySearchFilter(): void {
    let filtered = this.vraguableProducts.filter(product => {
      const conversions = this.productConversionsMap.get(product.id);
      return conversions && conversions.length > 0;
    });

    if (this.searchQuery && this.searchQuery.trim() !== '') {
      const query = this.searchQuery.toLowerCase().trim();
      filtered = filtered.filter(product => 
        product.name?.toLowerCase().includes(query) ||
        product.barcode?.toLowerCase().includes(query) ||
        product.designation_legale?.toLowerCase().includes(query) ||
        product.famille?.name?.toLowerCase().includes(query)
      );
    }

    this.filteredVraguableProducts = filtered;
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

  async loadAllConversions(): Promise<void> {
    this.productConversionsMap.clear();
    for (const product of this.vraguableProducts) {
      try {
        const conversions = await firstValueFrom(this.productsService.getVracConversions(product.id));
        if (conversions && conversions.conversions && conversions.conversions.length > 0) {
          this.productConversionsMap.set(product.id, conversions.conversions);
        }
      } catch (error) {
      }
    }
  }

  getProductDestinations(productId: number): string[] {
    const conversions = this.productConversionsMap.get(productId);
    if (!conversions || conversions.length === 0) {
      return [];
    }
    return conversions.map(c => c.targetProductName);
  }

  getTotalCalculatedQuantity(): number {
    if (!this.vracConversions || this.vracConversions.length === 0) {
      return 0;
    }
    return this.vracConversions.reduce((sum, c) => sum + (c.calculatedQuantity || 0), 0);
  }

  openTransferModal(product: Product): void {
    this.selectedProductForTransfer = product;
    this.transferQuantity = 1;
    this.vracConversions = [];
    this.error = '';
    this.loadingConversions = true;
    this.showTransferModal = true;
    this.loadVracConversions();
  }

  closeTransferModal(): void {
    this.showTransferModal = false;
    this.selectedProductForTransfer = null;
    this.vracConversions = [];
    this.transferQuantity = 1;
    this.loadingConversions = false;
  }

  loadVracConversions(): void {
    if (!this.selectedProductForTransfer) {
      this.loadingConversions = false;
      return;
    }

    this.loadingConversions = true;
    this.error = '';
    
    this.productsService.getVracConversions(this.selectedProductForTransfer.id).subscribe({
      next: (response) => {
        if (response && response.conversions && Array.isArray(response.conversions)) {
          this.vracConversions = response.conversions.map(conv => ({
            ...conv,
            calculatedQuantity: this.transferQuantity * conv.conversionRatio
          }));
          
          if (this.vracConversions.length === 0) {
            this.error = 'Aucune conversion VRAC configurée pour ce produit. Veuillez d\'abord configurer les conversions dans /stock/produits';
          } else {
            this.error = '';
          }
        } else {
          this.vracConversions = [];
          this.error = 'Format de réponse invalide du serveur';
        }
        this.loadingConversions = false;
      },
      error: (error) => {
        console.error('Error loading vrac conversions:', error);
        this.error = error.error?.error || error.message || 'Erreur lors du chargement des conversions VRAC';
        this.vracConversions = [];
        this.loadingConversions = false;
      }
    });
  }

  onQuantityChange(): void {
    if (this.transferQuantity > 0) {
      this.vracConversions = this.vracConversions.map(conv => ({
        ...conv,
        calculatedQuantity: this.transferQuantity * conv.conversionRatio
      }));
    }
  }

  onProductTransferred(): void {
    if (!this.selectedProductForTransfer) {
      this.error = 'Aucun produit source sélectionné';
      return;
    }

    if (this.vracConversions.length === 0) {
      this.error = 'Aucune conversion VRAC configurée';
      return;
    }

    if (this.transferQuantity <= 0) {
      this.error = 'La quantité doit être positive';
      return;
    }

    this.loading = true;
    this.error = '';

    const userDepotId = this.authService.currentUser()?.depotId || 0;
    const visitingDepotIdStr = sessionStorage.getItem('visitingDepotId');
    const currentDepotId = visitingDepotIdStr ? parseInt(visitingDepotIdStr) : userDepotId;

    if (!currentDepotId || currentDepotId <= 0) {
      this.error = 'Dépôt invalide. Veuillez sélectionner un dépôt valide.';
      this.loading = false;
      return;
    }

    const transfersPayload = this.vracConversions
      .filter(conv => {
        const hasTargetId = conv.targetProductId && conv.targetProductId > 0;
        const hasRatio = conv.conversionRatio !== undefined && conv.conversionRatio !== null;
        const ratioValue = parseFloat(conv.conversionRatio?.toString() || '0');
        const isValidRatio = !isNaN(ratioValue) && ratioValue > 0;
        return hasTargetId && hasRatio && isValidRatio;
      })
      .map(conv => {
        const quantity = parseFloat(this.transferQuantity.toString());
        const ratio = parseFloat(conv.conversionRatio.toString());
        return {
          targetProductId: parseInt(conv.targetProductId.toString()),
          quantity: isNaN(quantity) ? 0 : quantity,
          conversionRatio: isNaN(ratio) ? 0 : ratio
        };
      })
      .filter(transfer => transfer.quantity > 0 && transfer.conversionRatio > 0);

    if (transfersPayload.length === 0) {
      this.error = 'Aucun transfert valide. Vérifiez que tous les produits destinataires ont un ratio de conversion valide.';
      this.loading = false;
      return;
    }

    const transferPayload = {
      sourceProductId: this.selectedProductForTransfer.id,
      transfers: transfersPayload,
      depotId: currentDepotId
    };

    console.log('Sending transfer payload:', JSON.stringify(transferPayload, null, 2));

    this.productsService.transferProductMultiple(transferPayload).subscribe({
      next: async (response) => {
        this.closeTransferModal();
        await this.loadProducts();
        this.loading = false;
        this.successMessage = response?.message || `Transfert réussi: ${this.transferQuantity} ${this.selectedProductForTransfer?.unite} de ${this.selectedProductForTransfer?.name} transféré(s) vers ${this.vracConversions.length} produit(s) VRAC`;
        this.showSuccessNotification = true;
        setTimeout(() => {
          this.showSuccessNotification = false;
        }, 5000);
      },
      error: (error) => {
        this.loading = false;
        console.error('Transfer error full:', error);
        console.error('Transfer error response:', error.error);
        console.error('Transfer error response stringified:', JSON.stringify(error.error, null, 2));
        const errorMessage = error.error?.error || error.error?.message || 'Erreur lors du transfert des produits';
        const errorDetails = error.error ? JSON.stringify(error.error, null, 2) : '';
        this.error = errorMessage + (errorDetails ? `\n\nDétails complets:\n${errorDetails}` : '');
        alert(`Erreur: ${errorMessage}\n\nDétails dans la console.`);
      }
    });
  }
}

interface VracConversion {
  id: number;
  targetProductId: number;
  targetProductName: string;
  targetProductUnite: string;
  conversionRatio: number;
  prix_vente_vrac: number | null;
  prix_achat_vrac: number | null;
  isStockable: boolean;
  calculatedQuantity?: number;
}
