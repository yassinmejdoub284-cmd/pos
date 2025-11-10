import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { InventoryService, InventorySession, InventoryItem } from '../../core/services/inventory.service';
import { ProductsService } from '../../core/services/products.service';
import { Product } from '../../core/models/product.model';
import { ProduitsDeStockService } from '../../core/services/produits-de-caisse.service';
import { ProduitDeStock } from '../../core/models/produit-de-caisse.model';
import { DepotsService } from '../../core/services/depots.service';
import { AuthService } from '../../core/services/auth.service';
import { Subject, takeUntil } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

interface CountItem {
  product: Product;
  theoreticalQuantity: number;
  countedQuantity: number | null;
  isConfirmed: boolean;
  inventoryItemId?: number;
  purchasePrice: number; // prix d'achat (editable)
  salePrice: number;     // prix de vente (editable)
}

@Component({
  selector: 'app-count',
  templateUrl: './count.component.html',
  styleUrls: ['./count.component.css'],
  standalone: false
})
export class CountComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  
  depotId: number | null = null;
  session: InventorySession | null = null;
  depotType: string | null = null;
  items: InventoryItem[] = [];
  filteredItems: InventoryItem[] = [];
  searchTerm = '';
  
  // Caisse-like interface
  allProducts: Product[] = [];
  filteredProducts: Product[] = [];
  productCategories: string[] = ['Tous', 'Pâtisserie', 'Viennoiserie', 'Boulangerie', 'Boissons', 'Vrac', 'Pâtisserie Tunisienne', 'Jus et Smoothies'];
  selectedCategory: string = 'Tous';
  
  // Stock products filtering
  stockProducts: ProduitDeStock[] = [];
  hasStockProductsInDepot = false;
  
  // Display mode: true = show stock products directly, false = show parent products
  showStockProductsDirectly = false;
  
  // Count items (like receipt items in caisse)
  countItems: CountItem[] = [];
  selectedCountItem: CountItem | null = null;
  selectedCountItemIndex: number = -1;
  
  // Input handling (like caisse)
  currentInput: string = '';
  inputMode: 'quantity' | 'purchasePrice' | 'salePrice' = 'quantity';
  pendingProduct: Product | null = null;
  lastEnteredValue: string = '';
  
  
  loading = false;
  saving = false;
  error = '';
  success = '';
  
  // Statistics
  totalItems = 0;
  countedItems = 0;
  remainingItems = 0;

  // Math reference for template
  Math = Math;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpClient,
    private inventoryService: InventoryService,
    private productsService: ProductsService,
    private produitsDeStockService: ProduitsDeStockService,
    private depotsService: DepotsService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    const depotId = this.route.snapshot.paramMap.get('depotId');
    const sessionId = this.route.snapshot.paramMap.get('id');
    if (depotId && sessionId) {
      this.depotId = parseInt(depotId, 10);
      this.loadDepot();
      this.loadSession(parseInt(sessionId, 10));
    }
    this.loadProducts();
    this.loadStockProducts();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  @HostListener('document:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    // Handle keyboard input for numpad
    if (event.key >= '0' && event.key <= '9') {
      this.addToInput(event.key);
    } else if (event.key === '.') {
      this.addDecimal();
    } else if (event.key === 'Enter') {
      this.enterValue();
    } else if (event.key === 'Backspace') {
      this.clearDisplay();
    }
  }

  loadDepot(): void {
    if (!this.depotId) return;
    
    this.depotsService.get(this.depotId).subscribe({
      next: (depot) => {
        this.depotType = depot.type;
        this.showStockProductsDirectly = depot.type !== 'SHOP';
        this.applyProductFiltering();
      },
      error: (err) => {
        console.error('Error loading depot:', err);
      }
    });
  }

  loadSession(sessionId: number): void {
    this.loading = true;
    this.error = '';

    this.inventoryService.getSession(sessionId).subscribe({
      next: (session) => {
        this.session = session;
        this.items = session.items || [];
        this.filteredItems = [...this.items];
        this.initializeCountItems();
        this.updateStatistics();
        this.loading = false;
        
        // Check session status and provide user feedback
        const currentUser = this.authService.currentUser();
        const isAdmin = currentUser?.role === 'ADMIN';
        
        if (!['DRAFT', 'IN_PROGRESS'].includes(session.status)) {
          if (isAdmin) {
            this.error = `Attention: Cette session est en statut "${session.status}". En tant qu'administrateur, vous pouvez modifier cette session.`;
          } else {
          this.error = `Attention: Cette session est en statut "${session.status}". Les quantités ne peuvent être modifiées que dans les sessions DRAFT ou IN_PROGRESS.`;
          }
        }
      },
      error: (err) => {
        this.error = err.error?.error || 'Erreur lors du chargement de la session';
        this.loading = false;
      }
    });
  }

  loadProducts(): void {
    // For SHOP depots, only load products assigned to this specific depot
    const depotId = this.depotId || undefined;
    this.productsService.getProducts(depotId).pipe(takeUntil(this.destroy$)).subscribe({
      next: (products) => {
        this.allProducts = products;
        this.applyProductFiltering();
        // Backfill prices for existing count items after products load
        this.countItems = this.countItems.map(ci => {
          const prod = this.getProductById(ci.product.id);
          return {
            ...ci,
            purchasePrice: ci.purchasePrice || (prod?.prix_achat ?? (prod?.prix_vente_TTC ?? ci.product.prix_vente_TTC ?? 0) * 0.7),
            salePrice: ci.salePrice || (prod?.prix_vente_TTC ?? ci.product.prix_vente_TTC ?? 0)
          };
        });
      },
      error: (err) => {
        console.error('Error loading products:', err);
      }
    });
  }

  loadStockProducts(): void {
    this.produitsDeStockService.getProduitsDeStock().pipe(takeUntil(this.destroy$)).subscribe({
      next: (stockProducts) => {
        this.stockProducts = stockProducts;
        this.checkDepotHasStockProducts();
        this.applyProductFiltering();
        
        // Re-initialize count items with correct product data after stock products are loaded
        if (this.items.length > 0) {
          this.initializeCountItems();
        }
      },
      error: (err) => {
        console.error('Error loading stock products:', err);
      }
    });
  }

  checkDepotHasStockProducts(): void {
    if (!this.depotId) {
      this.hasStockProductsInDepot = false;
      return;
    }

    // Check if any stock products are assigned to this depot
    this.hasStockProductsInDepot = this.stockProducts.some(stockProduct => 
      stockProduct.depotAssignments?.some(assignment => assignment.depotId === this.depotId)
    );
  }

  applyProductFiltering(): void {
    if (!this.showStockProductsDirectly) {
      // For SHOP depots: products are already filtered by depot from backend, just use them directly
      this.filteredProducts = [...this.allProducts];
    } else if (this.showStockProductsDirectly) {
      // For NOT SHOP depots: show stock products directly (as Product objects)
      this.filteredProducts = this.stockProducts
        .filter(stockProduct => 
          stockProduct.depotAssignments?.some(assignment => assignment.depotId === this.depotId)
        )
        .map(stockProduct => ({
          id: stockProduct.id,
          name: stockProduct.name,
          barcode: stockProduct.barcode,
          unite: stockProduct.unite,
          prix_vente_TTC: stockProduct.prix_vente_TTC,
          prix_achat: stockProduct.prix_achat,
          photo: stockProduct.photo,
          famille: stockProduct.famille,
          familleId: stockProduct.familleId,
          tva: stockProduct.tva,
          isActive: stockProduct.isActive,
          createdAt: stockProduct.createdAt,
          updatedAt: stockProduct.updatedAt
        } as Product));
    } else {
      // Fallback: show all products (should not happen with proper depot filtering)
      this.filteredProducts = [...this.allProducts];
    }
  }

  initializeCountItems(): void {
    console.log('initializeCountItems called');
    console.log('showStockProductsDirectly:', this.showStockProductsDirectly);
    console.log('hasStockProductsInDepot:', this.hasStockProductsInDepot);
    console.log('items to process:', this.items.length);
    
    // Only show items that have already been counted (countedQuantity is not null)
    // This prevents preselection of all products - users must manually add products to count
    const itemsToProcess = this.items.filter(item => item.countedQuantity !== null);
    
    this.countItems = itemsToProcess
      .map(item => {
        // Use product data directly from the session item (already loaded by backend)
        let productData: Product = {
          id: item.product?.id ?? item.productId,
          name: item.product?.name ?? 'Produit inconnu',
          barcode: item.product?.barcode ?? '',
          unite: item.product?.unite ?? 'pcs',
          prix_vente_TTC: parseFloat(String(item.product?.prix_vente_TTC || 0)),
          prix_achat: parseFloat(String((item.product as any)?.prix_achat || 0)), // Use actual price from session
          familleId: (item.product as any)?.famille?.id || 0,
          tva: parseFloat(String((item.product as any)?.tva || 0)),
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        console.log('Processing item with productId:', item.productId, 'product name:', item.product?.name);
        
        if (this.showStockProductsDirectly && this.hasStockProductsInDepot) {
          // Find the stock product that matches this inventory item's productId
          const stockProduct = this.stockProducts.find(sp => 
            sp.id === item.productId && // item.productId is the stock product ID
            sp.depotAssignments?.some(assignment => assignment.depotId === this.depotId)
          );
          
          if (stockProduct) {
            console.log('Found stock product:', stockProduct.name, 'for productId:', item.productId);
            // Convert stock product to Product format
            productData = {
              id: stockProduct.id,
              name: stockProduct.name,
              barcode: stockProduct.barcode,
              unite: stockProduct.unite,
              prix_vente_TTC: stockProduct.prix_vente_TTC,
              prix_achat: stockProduct.prix_achat,
              photo: stockProduct.photo,
              famille: stockProduct.famille,
              familleId: stockProduct.familleId,
              tva: stockProduct.tva,
              isActive: stockProduct.isActive,
              createdAt: stockProduct.createdAt,
              updatedAt: stockProduct.updatedAt
            } as Product;
          } else {
            console.log('No stock product found for productId:', item.productId);
          }
        }
        
        return {
          product: productData,
        theoreticalQuantity: item.theoreticalQuantity,
        countedQuantity: item.countedQuantity,
        isConfirmed: item.countedQuantity !== null,
        inventoryItemId: item.id,
          purchasePrice: productData.prix_achat ?? (productData.prix_vente_TTC * 0.7), // Default to 70% of sale price if no purchase price
          salePrice: productData.prix_vente_TTC ?? 0
        } as CountItem;
      });
    
    console.log('Count items initialized:', this.countItems.length);
  }

  updateStatistics(): void {
    this.totalItems = this.items.length;
    this.countedItems = this.countItems.length; // All items in countItems are counted
    this.remainingItems = this.totalItems - this.countedItems;
  }

  // Caisse-like methods
  selectCategory(category: string): void {
    this.selectedCategory = category;
    this.filterProducts();
  }

  filterProducts(): void {
    let baseProducts: Product[];
    
    if (!this.hasStockProductsInDepot) {
      // If depot has no stock products, use all products
      baseProducts = [...this.allProducts];
    } else if (this.showStockProductsDirectly) {
      // If not a shop, show stock products directly (as Product objects)
      baseProducts = this.stockProducts
        .filter(stockProduct => 
          stockProduct.depotAssignments?.some(assignment => assignment.depotId === this.depotId)
        )
        .map(stockProduct => ({
          id: stockProduct.id,
          name: stockProduct.name,
          barcode: stockProduct.barcode,
          unite: stockProduct.unite,
          prix_vente_TTC: stockProduct.prix_vente_TTC,
          prix_achat: stockProduct.prix_achat,
          photo: stockProduct.photo,
          famille: stockProduct.famille,
          familleId: stockProduct.familleId,
          tva: stockProduct.tva,
          isActive: stockProduct.isActive,
          createdAt: stockProduct.createdAt,
          updatedAt: stockProduct.updatedAt
        } as Product));
    } else {
      // If it's a shop, show parent products that have stock products assigned to this depot
      baseProducts = this.allProducts.filter(product => 
        this.stockProducts.some(stockProduct => 
          stockProduct.parentProductId === product.id &&
          stockProduct.depotAssignments?.some(assignment => assignment.depotId === this.depotId)
        )
      );
    }

    // Apply category filter
    if (this.selectedCategory === 'Tous') {
      this.filteredProducts = baseProducts;
    } else {
      this.filteredProducts = baseProducts.filter(product => 
        product.famille?.name === this.selectedCategory
      );
    }
  }


  // Product selection (like caisse)
  handleProductClick(product: Product): void {
    
    // Check if product already exists in count items
    const existingItem = this.countItems.find(item => item.product.id === product.id);
    
    if (existingItem) {
      // Product exists - select it for quantity modification
      this.selectCountItem(existingItem);
      this.pendingProduct = product;
      this.currentInput = existingItem.countedQuantity?.toString() || '';
    } else {
      // New product - add to count items
      this.addProductToCount(product);
      this.pendingProduct = product;
      this.currentInput = '';
    }
  }

  addProductToCount(product: Product): void {
    const existingItem = this.items.find(item => item.product?.id === product.id);
    const theoreticalQuantity = existingItem?.theoreticalQuantity || 0;
    
    // Ensure product has all required data
    const productData: Product = {
      id: product.id,
      name: product.name || 'Produit inconnu',
      barcode: product.barcode || '',
      unite: product.unite || 'pcs',
      prix_vente_TTC: product.prix_vente_TTC || 0,
      prix_achat: product.prix_achat || 0,
      familleId: product.familleId || 0,
      tva: product.tva || 0,
      createdAt: product.createdAt || new Date(),
      updatedAt: product.updatedAt || new Date()
    };
    
    const countItem: CountItem = {
      product: productData,
      theoreticalQuantity: theoreticalQuantity,
      countedQuantity: null,
      isConfirmed: false,
      inventoryItemId: existingItem?.id,
      purchasePrice: productData.prix_achat ?? (productData.prix_vente_TTC * 0.7), // Default to 70% of sale price if no purchase price
      salePrice: productData.prix_vente_TTC || 0
    };
    
    this.countItems.push(countItem);
    this.updateStatistics();
  }

  selectCountItem(item: CountItem): void {
    const index = this.countItems.indexOf(item);
    this.selectedCountItem = item;
    this.selectedCountItemIndex = index;
    this.pendingProduct = item.product;
    // Keep current input aligned with selected input mode
    if (this.inputMode === 'quantity') {
      this.currentInput = item.countedQuantity?.toString() || '';
    } else if (this.inputMode === 'purchasePrice') {
      // Do not prefill when editing prices; start empty
      this.currentInput = '';
    } else if (this.inputMode === 'salePrice') {
      // Do not prefill when editing prices; start empty
      this.currentInput = '';
    }
  }

  // Input handling (like caisse)
  addToInput(value: string): void {
    this.currentInput += value;
  }

  clearInput(): void {
    this.currentInput = '';
  }

  addDecimal(): void {
    if (!this.currentInput.includes('.')) {
      this.currentInput += '.';
    }
  }

  clearDisplay(): void {
    if (this.currentInput.length > 0) {
      this.currentInput = this.currentInput.slice(0, -1);
    }
  }

  enterValue(): void {
    
    if (this.pendingProduct) {
      const value = parseFloat(this.currentInput);
      
      if (isNaN(value) || value < 0) {
        this.error = 'Valeur invalide (minimum 0)';
        return;
      }
      
      // Update or add the count item
      const existingItem = this.countItems.find(item => item.product.id === this.pendingProduct!.id);
      
      if (existingItem) {
        if (this.inputMode === 'quantity') {
          existingItem.countedQuantity = value;
          existingItem.isConfirmed = true;
          this.saveCountToBackend(existingItem);
        } else if (this.inputMode === 'purchasePrice') {
          existingItem.purchasePrice = value;
          this.savePricesToNotes(existingItem);
        } else if (this.inputMode === 'salePrice') {
          existingItem.salePrice = value;
          this.savePricesToNotes(existingItem);
        }
      } else {
        this.addProductToCount(this.pendingProduct);
        const newItem = this.countItems[this.countItems.length - 1];
        if (this.inputMode === 'quantity') {
          newItem.countedQuantity = value;
          newItem.isConfirmed = true;
          this.saveCountToBackend(newItem);
        } else if (this.inputMode === 'purchasePrice') {
          newItem.purchasePrice = value;
          this.savePricesToNotes(newItem);
        } else if (this.inputMode === 'salePrice') {
          newItem.salePrice = value;
          this.savePricesToNotes(newItem);
        }
      }
      
      this.pendingProduct = null;
      this.currentInput = '';
      this.updateStatistics();
    }
  }

  saveCountToBackend(item: CountItem): void {
    if (!this.session) {
      console.error('Cannot save count: missing session');
      this.error = 'Session d\'inventaire non trouvée';
      return;
    }

    // Check if session is in correct status for updates (allow admin to override)
    const currentUser = this.authService.currentUser();
    const isAdmin = currentUser?.role === 'ADMIN';
    
    if (!['DRAFT', 'IN_PROGRESS'].includes(this.session.status) && !isAdmin) {
      console.error('Cannot save count: session status is', this.session.status, 'and user is not admin');
      this.error = 'Impossible de modifier les quantités dans cette session (statut: ' + this.session.status + ')';
      return;
    }

    // If no inventoryItemId, create a new inventory item first
    if (!item.inventoryItemId) {
      this.createInventoryItemForProduct(item);
      return;
    }

    // Include prices encoded in notes for persistence
    const notes = this.composeNotesWithPrices(item);
    this.inventoryService.updateItemCount(
      this.session.id,
      item.inventoryItemId,
      item.countedQuantity,
      'PHYSICAL_COUNT_DIFFERENCE',
      notes
    ).subscribe({
      next: (updatedItem) => {
        // Update the item in our local array
        const index = this.items.findIndex(i => i.id === updatedItem.id);
        if (index !== -1) {
          this.items[index] = updatedItem;
        }
        this.updateStatistics();
        this.success = 'Quantité comptée sauvegardée avec succès';
        setTimeout(() => this.success = '', 2000);
      },
      error: (err) => {
        console.error('Error saving count:', err);
        this.error = err.error?.error || 'Erreur lors de la sauvegarde du comptage';
        console.error('Full error details:', {
          status: err.status,
          statusText: err.statusText,
          error: err.error,
          url: err.url
        });
      }
    });
  }

  // Persist price edits via notes field without changing server schema
  private composeNotesWithPrices(item: CountItem): string {
    const pa = Number.isFinite(item.purchasePrice) ? item.purchasePrice : 0;
    const pv = Number.isFinite(item.salePrice) ? item.salePrice : 0;
    return `PA=${pa};PV=${pv}`;
  }

  savePricesToNotes(item: CountItem): void {
    if (!this.session || !item.inventoryItemId) return;
    // Do a no-op quantity update (send current countedQuantity) with updated notes to persist prices
    this.saving = true;
    const notes = this.composeNotesWithPrices(item);
    this.inventoryService.updateItemCount(
      this.session.id,
      item.inventoryItemId,
      item.countedQuantity ?? null,
      'PHYSICAL_COUNT_DIFFERENCE',
      notes
    ).subscribe({
      next: () => { this.saving = false; },
      error: () => { this.saving = false; }
    });
  }

  // Helpers for totals
  getItemPurchaseTotal(item: CountItem): number {
    const qty = item.countedQuantity ?? 0;
    return qty * (item.purchasePrice ?? 0);
  }

  getItemSaleTotal(item: CountItem): number {
    const qty = item.countedQuantity ?? 0;
    return qty * (item.salePrice ?? 0);
  }

  setInputMode(mode: 'quantity' | 'purchasePrice' | 'salePrice', item?: CountItem): void {
    this.inputMode = mode;
    if (item) {
      this.selectCountItem(item);
    }
  }

  // Grand totals for header chips
  getGrandPurchaseTotal(): number {
    return this.countItems.reduce((sum, it) => sum + this.getItemPurchaseTotal(it), 0);
  }

  getGrandSaleTotal(): number {
    return this.countItems.reduce((sum, it) => sum + this.getItemSaleTotal(it), 0);
  }

  private getProductById(productId: number): Product | undefined {
    return this.allProducts.find(p => p.id === productId);
  }

  createInventoryItemForProduct(item: CountItem): void {
    if (!this.session) return;


    // Create a new inventory item for this product
    this.inventoryService.createInventoryItem(
      this.session.id,
      item.product.id,
      item.theoreticalQuantity
    ).subscribe({
      next: (newInventoryItem) => {
        // Update the count item with the new inventory item ID
        item.inventoryItemId = newInventoryItem.id;
        
        // Add the new item to our items array
        this.items.push(newInventoryItem);
        
        // Now save the count
        this.saveCountToBackend(item);
      },
      error: (err) => {
        console.error('Error creating inventory item:', err);
        this.error = err.error?.error || 'Erreur lors de la création de l\'article d\'inventaire';
        console.error('Full error details:', {
          status: err.status,
          statusText: err.statusText,
          error: err.error,
          url: err.url
        });
      }
    });
  }

  removeCountItem(index: number): void {
    this.countItems.splice(index, 1);
    if (this.selectedCountItemIndex === index) {
      this.selectedCountItem = null;
      this.selectedCountItemIndex = -1;
      this.pendingProduct = null;
      this.currentInput = '';
    } else if (this.selectedCountItemIndex > index) {
      this.selectedCountItemIndex--;
    }
    this.updateStatistics();
  }

  // Validation and save methods
  validateAllCounts(): void {
    if (!this.session) {
      this.error = 'Session d\'inventaire non trouvée';
      return;
    }

    // Post the session directly to apply stock changes
    this.postInventorySession();
  }

  saveAllCounts(): void {
    this.saving = true;
    this.error = '';

    const updatePromises = this.countItems.map(item => {
      if (item.countedQuantity !== null) {
        if (item.inventoryItemId) {
          // Update existing inventory item
        return this.inventoryService.updateItemCount(
          this.session!.id,
          item.inventoryItemId,
          item.countedQuantity,
          'PHYSICAL_COUNT_DIFFERENCE',
          ''
        ).toPromise();
        } else {
          // Create new inventory item for products not in original session
          return this.inventoryService.createInventoryItem(
            this.session!.id,
            item.product.id,
            item.theoreticalQuantity
          ).toPromise().then((newItem: any) => {
            // Update the new item with counted quantity
            return this.inventoryService.updateItemCount(
              this.session!.id,
              newItem.id,
              item.countedQuantity,
              'PHYSICAL_COUNT_DIFFERENCE',
              ''
            ).toPromise();
          });
        }
      }
      return Promise.resolve();
    });

    Promise.all(updatePromises).then(() => {
      this.saving = false;
      this.success = 'Tous les comptages ont été enregistrés avec succès';
      setTimeout(() => this.success = '', 3000);
      this.router.navigate(['/inventory', this.depotId, this.session!.id, 'review']);
    }).catch(err => {
      this.saving = false;
      this.error = 'Erreur lors de l\'enregistrement des comptages';
      console.error('Save error:', err);
    });
  }

  postInventorySession(): void {
    if (!this.session) {
      this.error = 'Session d\'inventaire non trouvée';
      return;
    }

    // Check if session is already posted
    if (this.session.status === 'POSTED') {
      this.error = 'Cette session d\'inventaire a déjà été finalisée';
      return;
    }

    this.saving = true;
    this.error = '';

    // Check if session is already closed, if not close it first
    if (this.session.status === 'DRAFT' || this.session.status === 'IN_PROGRESS') {
      // First close the session, then post it
      this.inventoryService.updateSessionStatus(this.session.id, 'CLOSED').subscribe({
        next: (closedSession) => {
          // Update local session status
          this.session!.status = 'CLOSED';
          
          // Refresh session from server to ensure we have the latest status
          this.inventoryService.getSession(this.session!.id).subscribe({
            next: (refreshedSession) => {
              // Now post the closed session
              this.inventoryService.postSession(this.session!.id).subscribe({
                next: (result) => {
                  this.saving = false;
                  this.success = 'Inventaire terminé et stock mis à jour avec succès!';
                  
                  // Update session status
                  this.session!.status = 'POSTED';

                  // Save an inventory line into tableau de relevé inventaire
                  try {
                    this.http.post(`${environment.apiUrl}/releve-inventaire/from-session/${this.session!.id}`, {
                      depotId: this.depotId
                    }, { withCredentials: true }).subscribe({
                      next: () => {},
                      error: (e) => console.error('Error saving inventory to releve:', e)
                    });
                  } catch (e) {
                    console.error('Error triggering releve save:', e);
                  }
                
                // Show success message and redirect after delay
                setTimeout(() => {
                  this.success = '';
                  this.router.navigate(['/inventory', this.depotId]);
                }, 3000);
              },
              error: (err) => {
                this.saving = false;
                this.error = err.error?.error || 'Erreur lors de la finalisation de l\'inventaire';
                console.error('Error posting inventory session:', err);
              }
            });
          },
          error: (refreshErr) => {
            this.saving = false;
            this.error = 'Erreur lors de la mise à jour de la session';
            console.error('Error refreshing session:', refreshErr);
          }
        });
      },
      error: (err) => {
        this.saving = false;
        this.error = err.error?.error || 'Erreur lors de la fermeture de l\'inventaire';
        console.error('Error closing inventory session:', err);
      }
    });
    } else if (this.session.status === 'CLOSED') {
      // Session is already closed, just post it
      this.inventoryService.postSession(this.session.id).subscribe({
        next: (result) => {
          this.saving = false;
          this.success = 'Inventaire terminé et stock mis à jour avec succès!';
          
          // Update session status
          this.session!.status = 'POSTED';
          
          // Show success message and redirect after delay
          setTimeout(() => {
            this.success = '';
            this.router.navigate(['/inventory', this.depotId]);
          }, 3000);
        },
        error: (err) => {
          this.saving = false;
          this.error = err.error?.error || 'Erreur lors de la finalisation de l\'inventaire';
          console.error('Error posting inventory session:', err);
        }
      });
    } else {
      this.saving = false;
      this.error = `Impossible de finaliser une session avec le statut: ${this.session.status}`;
    }
  }

  // Utility methods
  truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }

  formatCurrency(value: number): string {
    return value.toFixed(3) + ' dt';
  }

  formatDate(date: string | Date): string {
    return new Date(date).toLocaleDateString('fr-FR');
  }

  getTheoreticalQuantity(productId: number): number {
    const item = this.items.find(item => item.product?.id === productId);
    return item?.theoreticalQuantity || 0;
  }

  // Client-gros compatibility methods
  trackByProductId(index: number, product: Product): number {
    return product.id;
  }

  getProductCardClass(productId: number): string {
    const baseClass = 'product-button bg-white border border-gray-200 rounded-lg p-2 text-center transition-colors duration-150 cursor-pointer shadow-sm relative select-none';
    const isSelected = this.countItems.some(item => item.product.id === productId);
    
    if (isSelected) {
      return baseClass + ' border-blue-500 bg-blue-50';
    } else {
      return baseClass;
    }
  }

  // Legacy methods for compatibility
  goBack(): void {
    this.router.navigate(['/inventory', this.depotId]);
  }

  saveProgress(): void {
    // Auto-save functionality can be implemented here
  }

  closeSession(): void {
    if (!this.session) return;

    if (!confirm('Êtes-vous sûr de vouloir fermer cette session d\'inventaire ?')) {
      return;
    }

    this.loading = true;
    this.inventoryService.updateSessionStatus(this.session.id, 'CLOSED').subscribe({
      next: (updatedSession) => {
        this.session = updatedSession;
        this.loading = false;
        this.router.navigate(['/inventory', this.depotId, this.session.id, 'review']);
      },
      error: (err) => {
        this.error = err.error?.error || 'Erreur lors de la fermeture';
        this.loading = false;
      }
    });
  }

  startSession(): void {
    if (!this.session) return;

    this.loading = true;
    this.inventoryService.updateSessionStatus(this.session.id, 'IN_PROGRESS').subscribe({
      next: (updatedSession) => {
        this.session = updatedSession;
        this.loading = false;
      },
      error: (err) => {
        this.error = err.error?.error || 'Erreur lors du démarrage';
        this.loading = false;
      }
    });
  }

  getEcartClass(item: CountItem): string {
    if (item.countedQuantity === null) return '';
    const ecart = item.countedQuantity - item.theoreticalQuantity;
    return ecart > 0 ? 'text-green-600' : ecart < 0 ? 'text-red-600' : '';
  }

  getEcartText(item: CountItem): string {
    if (item.countedQuantity === null) return '';
    const ecart = item.countedQuantity - item.theoreticalQuantity;
    const sign = ecart > 0 ? '+' : '';
    return `${sign}${ecart}`;
  }

  // New methods for the redesigned UI
  filterStatus = 'all';

  onSearch(): void {
    // Search functionality can be implemented here if needed
  }

  onSearchChange(): void {
    this.onSearch();
  }

  clearSearch(): void {
    this.searchTerm = '';
    this.onSearch();
  }

  setFilter(status: string): void {
    this.filterStatus = status;
    this.applyFilters();
  }

  applyFilters(): void {
    let filtered = [...this.items];

    // Apply search filter
    if (this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(item => 
        item.product?.name.toLowerCase().includes(term) ||
        item.product?.barcode?.toLowerCase().includes(term) ||
        item.product?.famille?.name.toLowerCase().includes(term)
      );
    }

    // Apply status filter
    switch (this.filterStatus) {
      case 'counted':
        filtered = filtered.filter(item => item.countedQuantity !== null);
        break;
      case 'pending':
        filtered = filtered.filter(item => item.countedQuantity === null);
        break;
      case 'ecart':
        filtered = filtered.filter(item => 
          item.countedQuantity !== null && 
          item.ecartQuantity !== null && 
          item.ecartQuantity !== 0
        );
        break;
    }

    this.filteredItems = filtered;
  }


  clearAllFilters(): void {
    this.searchTerm = '';
    this.filterStatus = 'all';
    this.applyFilters();
  }

  getItemCardClass(item: InventoryItem): string {
    if (item.countedQuantity !== null && item.ecartQuantity !== null && item.ecartQuantity !== 0) {
      return 'ecart';
    } else if (item.countedQuantity !== null) {
      return 'counted';
    }
    return '';
  }

  getCountedItems(): number {
    return this.items.filter(item => item.countedQuantity !== null).length;
  }

  getRemainingItems(): number {
    return this.items.filter(item => item.countedQuantity === null).length;
  }

  getProgressPercentage(): number {
    if (this.items.length === 0) return 0;
    return Math.round((this.getCountedItems() / this.items.length) * 100);
  }

  incrementQuantity(item: InventoryItem): void {
    const current = item.countedQuantity || 0;
    this.updateItemQuantity(item, current + 1);
  }

  decrementQuantity(item: InventoryItem): void {
    const current = item.countedQuantity || 0;
    if (current > 0) {
      this.updateItemQuantity(item, current - 1);
    }
  }

  onQuantityChange(item: InventoryItem, event: any): void {
    const value = event.target.value;
    const quantity = value === '' ? null : parseFloat(value);
    this.updateItemQuantity(item, quantity);
  }

  onQuantityBlur(item: InventoryItem): void {
    // Recalculate ecart when quantity changes
    this.calculateEcart(item);
  }

  updateItemQuantity(item: InventoryItem, quantity: number | null): void {
    item.countedQuantity = quantity || undefined;
    this.calculateEcart(item);
    this.updateStatistics();
  }

  calculateEcart(item: InventoryItem): void {
    if (item.countedQuantity !== null) {
      item.ecartQuantity = (item.countedQuantity || 0) - item.theoreticalQuantity;
      item.ecartValue = item.ecartQuantity * (item.product?.prix_vente_TTC || 0);
    } else {
      item.ecartQuantity = undefined;
      item.ecartValue = undefined;
    }
  }

  clearQuantity(item: InventoryItem): void {
    this.updateItemQuantity(item, null);
  }

  confirmQuantity(item: InventoryItem): void {
    if (item.countedQuantity === null) return;
    
    this.saving = true;
    this.inventoryService.updateItemCount(
      item.sessionId,
      item.id,
      item.countedQuantity || null,
      item.reason || 'PHYSICAL_COUNT_DIFFERENCE',
      item.notes || ''
    ).subscribe({
      next: (updatedItem) => {
        const index = this.items.findIndex(i => i.id === updatedItem.id);
        if (index !== -1) {
          this.items[index] = updatedItem;
        }
        this.applyFilters();
        this.updateStatistics();
        this.saving = false;
      },
      error: (err) => {
        this.error = err.error?.error || 'Erreur lors de l\'enregistrement';
        this.saving = false;
      }
    });
  }

}
