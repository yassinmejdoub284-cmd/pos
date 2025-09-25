import { Component, Input, Output, EventEmitter, OnInit, signal, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ProduitDeCaisse } from '../../../core/models/produit-de-caisse.model';
import { Product } from '../../../core/models/product.model';
import { ProduitsDeCaisseService } from '../../../core/services/produits-de-caisse.service';

@Component({
  selector: 'app-produits-de-caisse-form',
  templateUrl: './produits-de-caisse-form.component.html',
  standalone: false
})
export class ProduitsDeCaisseFormComponent implements OnInit {
  @Input() produit: ProduitDeCaisse | null = null;
  @Input() allProducts: Product[] = [];
  @Output() close = new EventEmitter<void>();
  @Output() submit = new EventEmitter<void>();

  private fb = inject(FormBuilder);
  private produitsDeCaisseService = inject(ProduitsDeCaisseService);

  form!: FormGroup;
  loading = signal(false);
  error = signal('');
  selectedProducts = signal<number[]>([]);

  ngOnInit(): void {
    this.initializeForm();
    if (this.produit) {
      this.selectedProducts.set([...this.produit.productIds]);
    }
    
    // Update filtered products when search changes
    this.form.get('searchQuery')?.valueChanges.subscribe(() => {
      this.updateFilteredProducts();
    });
    
    // Initial filter update
    this.updateFilteredProducts();
  }

  private initializeForm(): void {
    this.form = this.fb.group({
      name: [this.produit?.name || '', [Validators.required, Validators.minLength(2)]],
      price: [this.produit?.price || 0, [Validators.required, Validators.min(0.01)]],
      isActive: [this.produit?.isActive ?? true],
      searchQuery: ['']
    });
  }

  toggleProduct(productId: number): void {
    const current = this.selectedProducts();
    if (current.includes(productId)) {
      this.selectedProducts.set(current.filter(id => id !== productId));
    } else {
      this.selectedProducts.set([...current, productId]);
    }
  }

  isProductSelected(productId: number): boolean {
    return this.selectedProducts().includes(productId);
  }

  getSelectedProductsNames(): string[] {
    return this.selectedProducts().map(id => {
      const product = this.allProducts.find(p => p.id === id);
      return product ? product.name : `Produit #${id}`;
    });
  }

  getProductName(productId: number): string {
    const product = this.allProducts.find(p => p.id === productId);
    return product ? product.name : `Produit #${productId}`;
  }

  getProductImage(productId: number): string {
    const product = this.allProducts.find(p => p.id === productId);
    return product?.photo || '/images/placeholder-product.svg';
  }

  filteredProducts = signal<Product[]>([]);

  getFilteredProducts(): Product[] {
    return this.filteredProducts();
  }

  private updateFilteredProducts(): void {
    const searchQuery = this.form.get('searchQuery')?.value || '';
    const filtered = this.allProducts.filter(product => 
      product.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
    this.filteredProducts.set(filtered);
  }

  onImageError(event: Event): void {
    const target = event.target as HTMLImageElement;
    target.src = '/images/placeholder-product.svg';
  }

  onSubmit(): void {
    if (this.form.valid && this.selectedProducts().length > 0) {
      this.loading.set(true);
      this.error.set('');

      const formData = this.form.value;
      const request = {
        name: formData.name,
        price: formData.price,
        productIds: this.selectedProducts(),
        isActive: formData.isActive
      };

      const operation = this.produit 
        ? this.produitsDeCaisseService.updateProduitDeCaisse(this.produit.id, request)
        : this.produitsDeCaisseService.createProduitDeCaisse(request);

      operation.subscribe({
        next: () => {
          this.submit.emit();
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set('Erreur lors de la sauvegarde');
          this.loading.set(false);
          console.error('Error saving produit:', err);
        }
      });
    } else {
      this.error.set('Veuillez remplir tous les champs et sélectionner au moins un produit');
    }
  }

  onCancel(): void {
    this.close.emit();
  }
}
