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
  @Input() produits: ProduitDeCaisse[] = [];
  @Input() allProducts: Product[] = [];
  @Input() searchQuery: string = '';
  @Input() selectedCategory: string = 'Tous';
  @Input() productCategories: string[] = [];
  @Output() produitUpdated = new EventEmitter<void>();
  @Output() produitDeleted = new EventEmitter<void>();
  @Output() produitEdit = new EventEmitter<ProduitDeCaisse>();
  @Output() produitDelete = new EventEmitter<void>();
  @Output() produitToggleActive = new EventEmitter<void>();

  private produitsDeCaisseService = inject(ProduitsDeCaisseService);

  loading = signal(false);
  error = signal('');

  getProductName(productId: number): string {
    const product = this.allProducts.find(p => p.id === productId);
    return product ? product.name : `Produit #${productId}`;
  }

  getTotalQuantity(produit: ProduitDeCaisse): number {
    return 1; // Each produit de stock is now a single sub-product
  }

  getFilteredProduits(): ProduitDeCaisse[] {
    let filtered = this.produits;

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
        // Check if the produit belongs to the selected category
        return produit.famille?.name === this.selectedCategory;
      });
    }

    return filtered;
  }

  getProductImage(productId: number): string {
    const product = this.allProducts.find(p => p.id === productId);
    return product?.photo || '/images/placeholder-product.svg';
  }

  getFirstProductImage(produit: ProduitDeCaisse): string {
    // Show the actual produit-de-caisse image if it exists
    if (produit.photo) {
      return produit.photo;
    }
    // Fallback to parent product image if no produit-de-caisse image
    if (produit.parentProductId) {
      return this.getProductImage(produit.parentProductId);
    }
    return '/images/placeholder-product.svg';
  }

  onImageError(event: Event): void {
    const target = event.target as HTMLImageElement;
    target.src = '/images/placeholder-product.svg';
  }

  editProduit(produit: ProduitDeCaisse): void {
    // Emit event to parent component to handle editing
    this.produitEdit.emit(produit);
  }

  deleteProduit(produit: ProduitDeCaisse): void {
    if (confirm(`Êtes-vous sûr de vouloir supprimer le sous-produit "${produit.name}" ?`)) {
      this.loading.set(true);
      this.error.set('');
      
      this.produitsDeCaisseService.deleteProduitDeCaisse(produit.id).subscribe({
        next: () => {
          this.produitDelete.emit();
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
        this.produitToggleActive.emit();
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
