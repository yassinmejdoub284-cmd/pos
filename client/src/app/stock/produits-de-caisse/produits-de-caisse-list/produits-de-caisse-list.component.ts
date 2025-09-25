import { Component, Input, Output, EventEmitter, signal, inject } from '@angular/core';
import { ProduitDeCaisse } from '../../../core/models/produit-de-caisse.model';
import { Product } from '../../../core/models/product.model';
import { ProduitsDeCaisseService } from '../../../core/services/produits-de-caisse.service';

@Component({
  selector: 'app-produits-de-caisse-list',
  templateUrl: './produits-de-caisse-list.component.html',
  standalone: false
})
export class ProduitsDeCaisseListComponent {
  @Input() produitsDeCaisse: ProduitDeCaisse[] = [];
  @Input() allProducts: Product[] = [];
  @Input() searchQuery: string = '';
  @Input() selectedCategory: string = 'Tous';
  @Output() produitUpdated = new EventEmitter<void>();
  @Output() produitDeleted = new EventEmitter<void>();

  private produitsDeCaisseService = inject(ProduitsDeCaisseService);

  loading = signal(false);
  error = signal('');

  getProductName(productId: number): string {
    const product = this.allProducts.find(p => p.id === productId);
    return product ? product.name : `Produit #${productId}`;
  }

  getTotalQuantity(produit: ProduitDeCaisse): number {
    return produit.productIds.length;
  }

  getFilteredProduits(): ProduitDeCaisse[] {
    let filtered = this.produitsDeCaisse;

    // Filter by search query
    if (this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase();
      filtered = filtered.filter(produit => 
        produit.name.toLowerCase().includes(query)
      );
    }

    // Filter by category
    if (this.selectedCategory !== 'Tous') {
      filtered = filtered.filter(produit => {
        // Check if any product in the group belongs to the selected category
        return produit.productIds.some(productId => {
          const product = this.allProducts.find(p => p.id === productId);
          return product?.famille?.name === this.selectedCategory;
        });
      });
    }

    return filtered;
  }

  getProductImage(productId: number): string {
    const product = this.allProducts.find(p => p.id === productId);
    return product?.photo || '/images/placeholder-product.svg';
  }

  getFirstProductImage(produit: ProduitDeCaisse): string {
    if (produit.productIds.length > 0) {
      return this.getProductImage(produit.productIds[0]);
    }
    return '/images/placeholder-product.svg';
  }

  onImageError(event: Event): void {
    const target = event.target as HTMLImageElement;
    target.src = '/images/placeholder-product.svg';
  }

  editProduit(produit: ProduitDeCaisse): void {
    // Emit event to parent component to handle editing
    this.produitUpdated.emit();
  }

  deleteProduit(produit: ProduitDeCaisse): void {
    if (confirm(`Êtes-vous sûr de vouloir supprimer le regroupement "${produit.name}" ?`)) {
      this.loading.set(true);
      this.error.set('');
      
      this.produitsDeCaisseService.deleteProduitDeCaisse(produit.id).subscribe({
        next: () => {
          this.produitDeleted.emit();
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set('Erreur lors de la suppression');
          this.loading.set(false);
          console.error('Error deleting produit:', err);
        }
      });
    }
  }

  toggleActive(produit: ProduitDeCaisse): void {
    this.loading.set(true);
    this.error.set('');
    
    this.produitsDeCaisseService.updateProduitDeCaisse(produit.id, {
      isActive: !produit.isActive
    }).subscribe({
      next: () => {
        this.produitUpdated.emit();
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set('Erreur lors de la mise à jour');
        this.loading.set(false);
        console.error('Error updating produit:', err);
      }
    });
  }

}
