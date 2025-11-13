import { Component, OnInit, signal, inject, computed } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ProduitsDeStockService } from '../../core/services/produits-de-caisse.service';
import { ProductsService } from '../../core/services/products.service';
import { SessionsService } from '../../core/services/sessions.service';
import { Product } from '../../core/models/product.model';
import { ProduitDeStock } from '../../core/models/produit-de-caisse.model';

@Component({
  selector: 'app-produits-de-stock',
  templateUrl: './produits-de-caisse.component.html',
  standalone: false
})
export class ProduitsDeStockComponent implements OnInit {
  private produitsDeStockService = inject(ProduitsDeStockService);
  private productsService = inject(ProductsService);
  private sessionsService = inject(SessionsService);

  produitsDeStock = signal<ProduitDeStock[]>([]);
  allProducts = signal<Product[]>([]);
  loading = signal(false);
  error = signal('');
  showForm = signal(false);
  editingProduit = signal<ProduitDeStock | null>(null);
  
  // Filtering
  searchQuery = signal('');
  selectedCategory = signal('Tous');
  productCategories = signal<string[]>(['Tous']);
  
  // Grouped products for display
  groupedProducts = signal<{product: Product, subProducts: ProduitDeStock[]}[]>([]);
  
  // Filtered products computed signal
  filteredProducts = computed(() => {
    const groups = this.groupedProducts();
    const search = this.searchQuery().toLowerCase().trim();
    const category = this.selectedCategory();
    
    return groups.filter(group => {
      // Category filter
      const categoryMatch = category === 'Tous' || group.product.famille?.name === category;
      
      // Search filter - search in product name and subproduct names
      const searchMatch = !search || 
        group.product.name.toLowerCase().includes(search) ||
        group.subProducts.some(sub => sub.name.toLowerCase().includes(search));
      
      return categoryMatch && searchMatch;
    });
  });
  
  // View mode toggle
  viewMode = signal<'table' | 'grid'>('table');

  ngOnInit(): void {
    this.loadData();
  }

  private async loadData(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    
    try {
      const depotId = this.sessionsService.getActiveDepotId();
      
      const [produits, products] = await Promise.all([
        firstValueFrom(this.produitsDeStockService.getProduitsDeStock(depotId)),
        firstValueFrom(this.productsService.getProducts())
      ]) as [ProduitDeStock[], Product[]];
      
      this.produitsDeStock.set(produits as ProduitDeStock[] || []);
      this.allProducts.set(products as Product[] || []);
      
      // Group sub-products under their parent products
      this.groupProductsWithSubProducts(products, produits);
      
      // Extract unique categories from all products
      const categories = ['Tous', ...new Set(
        products
          .map(product => product.famille?.name)
          .filter(Boolean) as string[]
      )];
      this.productCategories.set(categories);
    } catch (err) {
      this.error.set('Erreur lors du chargement des données');
      console.error('Error loading data:', err);
    } finally {
      this.loading.set(false);
    }
  }

  private groupProductsWithSubProducts(products: Product[], subProducts: ProduitDeStock[]): void {
    const grouped = products
      .map(product => ({
        product,
        subProducts: subProducts.filter(sub => sub.parentProductId === product.id)
      }))
      .sort((a, b) => {
        // First sort by number of subproducts (most to least)
        if (b.subProducts.length !== a.subProducts.length) {
          return b.subProducts.length - a.subProducts.length;
        }
        // Then sort alphabetically by product name
        return a.product.name.localeCompare(b.product.name);
      });
    
    this.groupedProducts.set(grouped);
  }

  onProduitAdded(): void {
    this.editingProduit.set(null);
    this.showForm.set(true);
  }

  onProduitEdit(produit: ProduitDeStock): void {
    this.editingProduit.set(produit);
    this.showForm.set(true);
  }

  onSubProductAdded(parentProduct: Product): void {
    this.editingProduit.set(null);
    this.showForm.set(true);
    // Set parent product context for the form
  }

  onProduitUpdated(): void {
    this.loadData();
  }

  onProduitDeleted(): void {
    this.loadData();
  }

  onFormClose(): void {
    this.showForm.set(false);
    this.editingProduit.set(null);
  }

  onFormSubmit(): void {
    this.loadData();
    this.showForm.set(false);
    this.editingProduit.set(null);
  }

  onSearchChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.searchQuery.set(target.value);
    // Filtering is automatically applied via the computed signal
  }

  onCategoryChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    this.selectedCategory.set(target.value);
  }

  setCategoryFilter(category: string): void {
    this.selectedCategory.set(category);
    // Filtering is automatically applied via the computed signal
  }

  onSearch(): void {
    // Trigger search - the filtering is already handled by the signal
    console.log('Searching for:', this.searchQuery());
  }

  toggleViewMode(): void {
    this.viewMode.set(this.viewMode() === 'table' ? 'grid' : 'table');
  }
}
