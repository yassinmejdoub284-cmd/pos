import { Component, OnInit, signal, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ProduitsDeCaisseService } from '../../core/services/produits-de-caisse.service';
import { ProductsService } from '../../core/services/products.service';
import { Product } from '../../core/models/product.model';
import { ProduitDeCaisse } from '../../core/models/produit-de-caisse.model';

@Component({
  selector: 'app-produits-de-caisse',
  templateUrl: './produits-de-caisse.component.html',
  standalone: false
})
export class ProduitsDeCaisseComponent implements OnInit {
  private produitsDeCaisseService = inject(ProduitsDeCaisseService);
  private productsService = inject(ProductsService);

  produitsDeCaisse = signal<ProduitDeCaisse[]>([]);
  allProducts = signal<Product[]>([]);
  loading = signal(false);
  error = signal('');
  showForm = signal(false);
  
  // Filtering
  searchQuery = signal('');
  selectedCategory = signal('Tous');
  productCategories = signal<string[]>(['Tous']);

  ngOnInit(): void {
    this.loadData();
  }

  private async loadData(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    
    try {
      const [produits, products] = await Promise.all([
        firstValueFrom(this.produitsDeCaisseService.getProduitsDeCaisse()),
        firstValueFrom(this.productsService.getProducts())
      ]) as [ProduitDeCaisse[], Product[]];
      
      this.produitsDeCaisse.set(produits as ProduitDeCaisse[] || []);
      this.allProducts.set(products as Product[] || []);
      
      console.log('Loaded products:', products.length);
      console.log('Loaded produits de caisse:', produits.length);
      
      // Extract unique categories from products
      const categories = ['Tous', ...new Set(products.map(p => p.famille?.name).filter(Boolean) as string[])];
      this.productCategories.set(categories);
    } catch (err) {
      this.error.set('Erreur lors du chargement des données');
      console.error('Error loading data:', err);
    } finally {
      this.loading.set(false);
    }
  }

  onProduitAdded(): void {
    this.showForm.set(true);
  }

  onProduitUpdated(): void {
    this.loadData();
  }

  onProduitDeleted(): void {
    this.loadData();
  }

  onFormClose(): void {
    this.showForm.set(false);
  }

  onFormSubmit(): void {
    this.loadData();
    this.showForm.set(false);
  }

  onSearchChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.searchQuery.set(target.value);
  }

  onCategoryChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    this.selectedCategory.set(target.value);
  }
}
