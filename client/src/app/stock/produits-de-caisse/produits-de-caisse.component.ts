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
  
  // Multi-parent assignment
  showProductSelectionModal = signal(false);
  productSearchQuery = signal<string>('');
  selectedGroupForParent = signal<any>(null);
  assignmentConfirmationConfig = signal<any>(null);
  selectedProductToAssign = signal<Product | null>(null);
  
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

  // Filtered all products for the selection modal
  filteredAllProducts = computed(() => {
    const products = this.allProducts();
    const search = this.productSearchQuery().toLowerCase().trim();
    if (!search) return products.slice(0, 100); // Increased initial display
    return products.filter(p => 
      p.name.toLowerCase().includes(search) || 
      p.barcode?.toLowerCase().includes(search) ||
      p.id.toString().includes(search)
    ).slice(0, 200); // Increased search limit
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
      const [produits, products, allMasterProducts] = await Promise.all([
        firstValueFrom(this.produitsDeStockService.getProduitsDeStock(depotId)),
        firstValueFrom(this.productsService.getProducts(depotId)),
        firstValueFrom(this.productsService.getProducts(undefined, undefined, true))
      ]) as [ProduitDeStock[], Product[], Product[]];

      this.produitsDeStock.set(produits || []);
      this.allProducts.set(allMasterProducts || []);
      
      const groupsMap = new Map<string, {product: Product, subProducts: ProduitDeStock[]}>();
      const orphans: ProduitDeStock[] = [];

      // Pass 1: Initial grouping
      produits.forEach(sub => {
        const groupParentName = sub.parentProduct?.name || 'Divers';
        const groupFamilleId = sub.familleId || -1;
        const groupKey = `${groupParentName.toLowerCase()}|${groupFamilleId}`;

        if (!groupsMap.has(groupKey)) {
          groupsMap.set(groupKey, {
          product: {
            ...(sub.parentProduct || { id: -1, name: 'Articles Sans Parent' }),
            famille: sub.parentProduct?.famille || sub.famille
          } as any,
            subProducts: []
          });
        }
        groupsMap.get(groupKey)!.subProducts.push(sub);
      });

      // Pass 2: Finalize group metadata (deduplicated parents across ALL sub-products in the block)
      groupsMap.forEach(group => {
        const parentIds = new Set<string>();
        group.subProducts.forEach(sub => {
          const ids = this.parseProductIds(sub);
          ids.forEach(id => parentIds.add(id));
        });

        // Resolve parent objects uniquely by ID
        const settledParents = Array.from(parentIds).map(id => {
          let parent: Product | undefined;
          for (const sub of group.subProducts) {
            if (sub.parentProductId?.toString() === id && sub.parentProduct) {
              parent = sub.parentProduct;
              break;
            }
          }
          if (!parent) {
            parent = allMasterProducts.find(p => p.id.toString() === id);
          }
          return parent;
        }).filter(p => !!p) as Product[];

        group.product.displayParents = settledParents;
      });

      const grouped = Array.from(groupsMap.values())
        .sort((a, b) => b.subProducts.length - a.subProducts.length || a.product.name.localeCompare(b.product.name));

      this.groupedProducts.set(grouped);
      
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

  // Multi-parent assignment methods
  onAddParentClick(group: any): void {
    this.selectedGroupForParent.set(group);
    this.productSearchQuery.set('');
    this.showProductSelectionModal.set(true);
  }

  onProductSelected(product: Product): void {
    const group = this.selectedGroupForParent();
    if (!group || !product) return;

    // Check if any sub-product in the block is already associated with this parent
    const isAlreadyLinked = group.subProducts.some((sub: ProduitDeStock) => {
      const parentIds = this.parseProductIds(sub);
      return parentIds.includes(product.id.toString());
    });

    if (isAlreadyLinked) {
      // Could show a toast or message, but the button should be disabled in the UI anyway
      return;
    }

    this.selectedProductToAssign.set(product);
    this.assignmentConfirmationConfig.set({
      title: 'Confirmer l\'ajout du parent',
      subtitle: `Voulez-vous vraiment ajouter "${product.name}" comme parent pour tous les articles de ce bloc ?`,
      confirmText: 'Ajouter',
      confirmColor: 'success',
      showCancelButton: true,
      size: 'md'
    });
  }

  confirmAssignment(): void {
    const product = this.selectedProductToAssign();
    const group = this.selectedGroupForParent();
    
    if (product && group) {
      this.assignParentToBlock(product.id, group.subProducts);
    }
    this.assignmentConfirmationConfig.set(null);
  }

  async assignParentToBlock(productId: number, subProducts: ProduitDeStock[]): Promise<void> {
    this.loading.set(true);
    const productIdStr = productId.toString();
    
    try {
      const updatePromises = subProducts.map(sub => {
        const parentIds = this.parseProductIds(sub);
        if (!parentIds.includes(productIdStr)) {
          const newParentIds = [...parentIds, productIdStr];
          return firstValueFrom(this.produitsDeStockService.updateProduitDeStock(sub.id, {
            productIds: newParentIds
          }));
        }
        return Promise.resolve();
      });

      await Promise.all(updatePromises);
      this.showProductSelectionModal.set(false);
      this.selectedGroupForParent.set(null);
      await this.loadData();
    } catch (err) {
      console.error('Error assigning parent:', err);
      this.error.set('Certains articles n\'ont pas pu être mis à jour.');
    } finally {
      this.loading.set(false);
    }
  }

  isProductAlreadyLinked(product: Product): boolean {
    const group = this.selectedGroupForParent();
    if (!group || !product) return false;
    return group.subProducts.some((sub: ProduitDeStock) => {
      const parentIds = this.parseProductIds(sub);
      return parentIds.includes(product.id.toString());
    });
  }

  private parseProductIds(sub: ProduitDeStock): string[] {
    const ids = new Set<string>();
    if (sub.parentProductId) ids.add(sub.parentProductId.toString());
    if (sub.productIds) {
      const idsArray = typeof sub.productIds === 'string' 
        ? (sub.productIds as string).split(',').filter(id => !!id)
        : sub.productIds as any[];
      idsArray.forEach(id => {
        if (id) ids.add(id.toString());
      });
    }
    return Array.from(ids);
  }

  onProductSearchChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.productSearchQuery.set(target.value);
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
