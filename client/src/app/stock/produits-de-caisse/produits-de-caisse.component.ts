import { Component, OnInit, signal, inject, computed } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { ProduitsDeStockService } from '../../core/services/produits-de-caisse.service';
import { ProductsService } from '../../core/services/products.service';
import { SessionsService } from '../../core/services/sessions.service';
import { Product, ProductFamily } from '../../core/models/product.model';
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
  private fb = inject(FormBuilder);

  produitsDeStock = signal<ProduitDeStock[]>([]);
  allProducts = signal<Product[]>([]);
  loading = signal(false);
  error = signal('');
  showForm = signal(false);
  editingProduit = signal<ProduitDeStock | null>(null);
  showParentProductForm = signal(false);
  families = signal<ProductFamily[]>([]);
  parentProductForm!: FormGroup;
  creatingParentProduct = signal(false);
  
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
      // Category filter - check parent and sub-products
      const categoryMatch = category === 'Tous' || 
        group.product.famille?.name === category ||
        group.subProducts.some(sub => sub.famille?.name === category);
      
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
    this.initializeParentProductForm();
    this.loadFamilies();
    this.loadData();
  }

  private initializeParentProductForm(): void {
    this.parentProductForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      familleId: [null, Validators.required],
      prix_vente_TTC: [0, [Validators.required, Validators.min(0)]],
      prix_achat: [null, [Validators.min(0)]],
      tva: [19, [Validators.required, Validators.min(0), Validators.max(100)]],
      unite: ['pcs', Validators.required]
    });
  }

  private loadFamilies(): void {
    this.productsService.getFamilles().subscribe({
      next: (families) => {
        this.families.set(families);
      },
      error: (err) => {
        console.error('Error loading families:', err);
      }
    });
  }

  private async loadData(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    
    try {
      const depotId = this.sessionsService.getActiveDepotId();
      
      // Fetch both scannable articles and master products
      const [produits, products] = await Promise.all([
        firstValueFrom(this.produitsDeStockService.getProduitsDeStock(depotId)),
        firstValueFrom(this.productsService.getProducts(depotId))
      ]) as [ProduitDeStock[], Product[]];

      this.produitsDeStock.set(produits || []);
      this.allProducts.set(products || []);
      
      // Group scannable articles by their parent product NAME + FAMILLE
      // This merges conceptual duplicates (like the two HLOU ARBI products) into one UI group
      const groupsMap = new Map<string, {product: Product, subProducts: ProduitDeStock[]}>();
      const orphans: ProduitDeStock[] = [];

      produits.forEach(sub => {
        if (sub.parentProduct) {
          const groupKey = `${sub.parentProduct.name.toLowerCase()}|${sub.familleId}`;
          if (!groupsMap.has(groupKey)) {
            // Find if there's a "proper" master product for this name assigned to this depot
            const assignedParent = products.find(p => 
              p.name.toLowerCase() === sub.parentProduct!.name.toLowerCase() && 
              p.familleId === sub.familleId
            );

            groupsMap.set(groupKey, {
              product: {
                ...(assignedParent || sub.parentProduct),
                famille: sub.famille,
                unite: sub.unite,
                // These header fields are just for the group display
                prix_vente_TTC: assignedParent?.prix_vente_TTC || sub.prix_vente_TTC
              } as any,
              subProducts: []
            });
          }
          groupsMap.get(groupKey)!.subProducts.push(sub);
        } else {
          orphans.push(sub);
        }
      });

      const grouped = Array.from(groupsMap.values())
        .sort((a, b) => b.subProducts.length - a.subProducts.length || a.product.name.localeCompare(b.product.name));

      if (orphans.length > 0) {
        grouped.push({
          product: {
            id: -1,
            name: 'Articles Sans Parent / Divers',
            famille: { id: -1, name: 'Divers' } as any,
            prix_vente_TTC: 0 as any,
            unite: '-',
            isStockable: false
          } as any,
          subProducts: orphans.sort((a, b) => a.name.localeCompare(b.name))
        });
      }

      this.groupedProducts.set(grouped);
      
      // Extract unique categories purely from scannable articles
      const uniqueFamilies = Array.from(new Set(
        produits.map(p => p.famille?.name).filter((name): name is string => !!name)
      )).sort();
      
      this.productCategories.set(['Tous', ...uniqueFamilies]);
    } catch (err) {
      this.error.set('Erreur lors du chargement des données');
      console.error('Error loading data:', err);
    } finally {
      this.loading.set(false);
    }
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

  }

  toggleViewMode(): void {
    this.viewMode.set(this.viewMode() === 'table' ? 'grid' : 'table');
  }

  onParentProductAdded(): void {
    this.error.set('');
    this.parentProductForm.reset({
      name: '',
      familleId: null,
      prix_vente_TTC: 0,
      prix_achat: null,
      tva: 19,
      unite: 'pcs'
    });
    this.showParentProductForm.set(true);
  }

  onCreateParentProduct(): void {
    if (this.parentProductForm.valid) {
      this.creatingParentProduct.set(true);
      const formValue = this.parentProductForm.value;
      
      const productData: Partial<Product> = {
        name: formValue.name,
        familleId: parseInt(formValue.familleId),
        prix_vente_TTC: formValue.prix_vente_TTC,
        prix_achat: formValue.prix_achat || null,
        tva: formValue.tva,
        unite: formValue.unite,
        isStockable: false,
        isVraguable: false
      };

      this.productsService.createProduct(productData).subscribe({
        next: () => {
          this.error.set('');
          this.loadData();
          this.showParentProductForm.set(false);
          this.creatingParentProduct.set(false);
          this.parentProductForm.reset({
            name: '',
            familleId: null,
            prix_vente_TTC: 0,
            prix_achat: null,
            tva: 19,
            unite: 'pcs'
          });
        },
        error: (err) => {
          this.error.set(err.error?.error || 'Erreur lors de la création du produit parent');
          this.creatingParentProduct.set(false);
        }
      });
    }
  }

  onParentProductFormClose(): void {
    this.error.set('');
    this.showParentProductForm.set(false);
    this.parentProductForm.reset({
      name: '',
      familleId: null,
      prix_vente_TTC: 0,
      prix_achat: null,
      tva: 19,
      unite: 'pcs'
    });
  }
}
