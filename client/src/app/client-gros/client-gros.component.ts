import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ProductsService } from '../core/services/products.service';
import { ProduitsDeCaisseService } from '../core/services/produits-de-caisse.service';
import { DepotsService } from '../core/services/depots.service';
import { SessionsService } from '../core/services/sessions.service';
import { ClientsService } from '../core/services/clients.service';
import { FamiliesService } from '../core/services/families.service';
import { SalesService } from '../core/services/sales.service';
import { WholesaleRulesService, WholesaleRule } from '../core/services/wholesale-rules.service';
import { InventoryService } from '../core/services/inventory.service';
import { Product } from '../core/models/product.model';
import { Client } from '../core/models/client.model';
import { ProductFamily } from '../core/models/product-family.model';
import { CreateWholesaleRuleRequest } from '../core/services/wholesale-rules.service';


export interface ClientGrosItem {
  id: number;
  name: string;
  prix_vente_TTC: number;
  famille?: any;
  barcode?: string | null;
  photo?: string | null;
  parentProductId?: number | null;
}

export interface SelectedProduct {
  product: ClientGrosItem;
  isSelected: boolean;
}

@Component({
  selector: 'app-client-gros',
  templateUrl: './client-gros.component.html',
  styleUrls: ['./client-gros.component.css'],
  standalone: false
})
export class ClientGrosComponent implements OnInit, OnDestroy {
  // Customer selection
  showCustomerDialog = true;
  selectedCustomer: Client | null = null;

  // Products
  products: ClientGrosItem[] = [];
  selectedProducts: SelectedProduct[] = [];
  filteredProducts: ClientGrosItem[] = [];
  loading = false;
  searchQuery = '';
  selectedFamily = '';

  // Product families for filtering
  families: ProductFamily[] = [];

  // Pagination for performance
  currentPage = 1;
  itemsPerPage = 50; // Limit to 50 products per page for better performance

  // Wholesale rules from backend
  predefinedRules: WholesaleRule[] = [];

  // Applied rules for preview (not saved yet)
  appliedRules: { ruleId: string; productIds: number[]; rule: WholesaleRule }[] = [];

  // New rule creation
  showNewRuleDialog = false;
  newRule: Partial<WholesaleRule> = {
    ruleType: 'percentage',
    value: 0
  };
  // Numpad state for new rule value
  newRuleValueString = '0';

  // Archive management
  showArchivedRules = false;
  // Grouping behavior: true => group by parent; false => flat list
  shouldGroupByParent = false;


  constructor(
    private route: ActivatedRoute,
    private productsService: ProductsService,
    private produitsDeCaisseService: ProduitsDeCaisseService,
    private clientsService: ClientsService,
    private familiesService: FamiliesService,
    private salesService: SalesService,
    private wholesaleRulesService: WholesaleRulesService,
    private depotsService: DepotsService,
    private sessionsService: SessionsService,
    private inventoryService: InventoryService
  ) {}

  ngOnInit(): void {
    // If clientId provided, auto-select client and skip dialog
    this.route.queryParams.subscribe(params => {
      const id = params['clientId'];
      if (id) {
        const clientId = Number(id);
        if (!Number.isNaN(clientId)) {
          this.clientsService.getClient(clientId).subscribe({
            next: (client: Client) => {
              this.selectedCustomer = client;
              this.showCustomerDialog = false;
            },
            error: (_err: unknown) => {
              // If fetch fails, keep dialog open so user can pick manually
              this.showCustomerDialog = true;
            }
          });
        }
      }
    });
    this.loadProducts();
    this.loadFamilies();
    this.loadWholesaleRules();
  }

  ngOnDestroy(): void {
    // Cleanup if needed
  }

  loadProducts(): void {
    this.loading = true;
    // Prefer the customer's linked depot when available (> 0), otherwise use active depot
    const customerDepotId = (this.selectedCustomer?.depotId ?? 0) > 0 ? this.selectedCustomer!.depotId! : undefined;
    const activeDepotFallbackId = this.sessionsService.getActiveDepotId();
    const targetDepotId = customerDepotId ?? activeDepotFallbackId ?? undefined;

    if (targetDepotId) {
      this.depotsService.get(targetDepotId).subscribe({
        next: (depot) => {
          const isShop = String(depot.type).toUpperCase() === 'SHOP';
          // Group by parent only when NOT a SHOP depot
          this.shouldGroupByParent = !isShop;
          this.loadProductsForDepot(targetDepotId, isShop);
        },
        error: (_err) => {
          // Fallback to parent products on failure
          this.shouldGroupByParent = false;
          this.loadParentProducts(targetDepotId);
        }
      });
    } else {
      // No depot context, fallback
      this.shouldGroupByParent = false;
      this.loadParentProducts();
    }
  }

  private loadParentProducts(depotId?: number): void {
    this.productsService.getProducts(depotId).subscribe({
      next: (products: Product[]) => {
        // Fill parent products cache
        this.parentProductsCache.clear();
        products.forEach(p => this.parentProductsCache.set(p.id, p));
        // Map to unified item type
        this.products = products.map(p => ({
          id: p.id,
          name: p.name,
          prix_vente_TTC: Number(p.prix_vente_TTC) || 0,
          famille: p.famille,
          barcode: (p as any).barcode || null,
          photo: (p as any).photo || null,
          parentProductId: null
        }));
        this.filteredProducts = this.products;
        this.selectedProductIds.clear();
        this.loading = false;
      },
      error: (error: unknown) => {
        console.error('Error loading products:', error);
        this.loading = false;
      }
    });
  }

  private loadChildSubProducts(depotId: number): void {
    // Use inventory service to fetch produits-de-caisse filtered by depot
    this.inventoryService.getProductsForDepot(depotId, 'NOT_SHOP').subscribe({
      next: (subs) => {
        // subs already include prix_vente_TTC and famille
        this.products = subs.map(sp => ({
          id: sp.id,
          name: sp.name,
          prix_vente_TTC: Number(sp.prix_vente_TTC) || 0,
          famille: sp.famille,
          barcode: sp.barcode || null,
          photo: sp.photo || null,
          parentProductId: (sp as any).parentProductId ?? null
        }));
        this.filteredProducts = this.products;
        this.selectedProductIds.clear();
        this.loading = false;
        // Warm parent products cache in background
        this.productsService.getProducts().subscribe({
          next: (parents: Product[]) => {
            this.parentProductsCache.clear();
            parents.forEach(p => this.parentProductsCache.set(p.id, p));
          },
          error: () => {}
        });
      },
      error: (error: unknown) => {
        console.error('Error loading sub-products:', error);
        // Fallback to parents if child load fails
        this.loadParentProducts(depotId);
      }
    });
  }

  private loadProductsForDepot(depotId: number, isShop: boolean): void {
    if (isShop) {
      this.loadParentProducts(depotId);
    } else {
      this.loadChildSubProducts(depotId);
    }
  }

  loadFamilies(): void {
    this.familiesService.getFamilies().subscribe({
      next: (families: ProductFamily[]) => {
        this.families = families;
      },
      error: (error: unknown) => {
        console.error('Error loading families:', error);
        // Fallback to empty array if backend fails
        this.families = [];
      }
    });
  }

  loadWholesaleRules(): void {
    this.wholesaleRulesService.getWholesaleRules().subscribe({
      next: (rules: WholesaleRule[]) => {
        this.predefinedRules = rules;
      },
      error: (error: unknown) => {
        console.error('Error loading wholesale rules:', error);
        // Fallback to empty array if backend fails
        this.predefinedRules = [];
      }
    });
  }

  onCustomerSelected(customer: Client): void {
    this.selectedCustomer = customer;
    this.showCustomerDialog = false;
    // Reload products constrained to the customer's depot when available
    this.loadProducts();
  }

  onCustomerDialogClosed(): void {
    this.showCustomerDialog = false;
  }


  onFamilyChange(): void {
    this.onProductSearch();
  }

  toggleProductSelection(product: ClientGrosItem): void {
    if (this.selectedProductIds.has(product.id)) {
      this.selectedProductIds.delete(product.id);
    } else {
      this.selectedProductIds.add(product.id);
    }
  }

  getSelectedProducts(): ClientGrosItem[] {
    return this.products.filter(product => this.selectedProductIds.has(product.id));
  }

  applyRuleToSelectedProducts(rule: WholesaleRule): void {
    const selectedProductIds = Array.from(this.selectedProductIds);
    if (selectedProductIds.length === 0) {
      alert('Veuillez sélectionner au moins un produit');
      return;
    }

    if (!this.selectedCustomer) {
      alert('Veuillez sélectionner un client');
      return;
    }

    // Add rule to applied rules for preview
    this.appliedRules.push({
      ruleId: rule.id,
      productIds: [...selectedProductIds],
      rule: rule
    });

    // Clear current selection
    this.selectedProductIds.clear();
  }


  removeAppliedRule(index: number): void {
    this.appliedRules.splice(index, 1);
  }

  getAppliedRulesCount(): number {
    return this.appliedRules.length;
  }

  getTotalAmount(): number {
    let total = 0;
    this.appliedRules.forEach(appliedRule => {
      const products = this.products.filter(p => appliedRule.productIds.includes(p.id));
      products.forEach(product => {
        const basePrice = Number(this.getWholesalePrice(product)) || 0;
        const ruleVal = Number(appliedRule.rule.value) || 0;
        let finalPrice = basePrice;
        if (appliedRule.rule.ruleType === 'percentage') {
          finalPrice = basePrice * (1 - ruleVal / 100);
        } else if (appliedRule.rule.ruleType === 'fixed') {
          finalPrice = ruleVal;
        } else if (appliedRule.rule.ruleType === 'discount') {
          finalPrice = Math.max(0, basePrice - ruleVal);
        }
        total += Number(finalPrice) || 0;
      });
    });
    return total;
  }

  getOriginalTotalAmount(): number {
    let total = 0;
    this.appliedRules.forEach(appliedRule => {
      const products = this.products.filter(p => appliedRule.productIds.includes(p.id));
      products.forEach(product => {
        const basePrice = Number(this.getWholesalePrice(product)) || 0;
        total += basePrice;
      });
    });
    return total;
  }

  getProductNames(productIds: number[]): string {
    return productIds
      .map(id => this.products.find(p => p.id === id)?.name)
      .filter(name => name)
      .join(', ');
  }

  getCalculatedPrice(product: ClientGrosItem, rule: WholesaleRule): number {
    const basePrice = Number(this.getWholesalePrice(product)) || 0;
    const ruleVal = Number(rule.value) || 0;
    if (rule.ruleType === 'percentage') {
      return basePrice * (1 - ruleVal / 100);
    } else if (rule.ruleType === 'fixed') {
      return ruleVal;
    } else if (rule.ruleType === 'discount') {
      return Math.max(0, basePrice - ruleVal);
    }
    return basePrice;
  }

  openNewRuleDialog(): void {
    this.newRule = {
      ruleType: 'percentage',
      value: 0
    };
    this.newRuleValueString = '0';
    this.showNewRuleDialog = true;
  }

  addNewRule(): void {
    // Sync numeric value from numpad string
    const parsed = Number(this.newRuleValueString.replace(',', '.'));
    this.newRule.value = Number.isFinite(parsed) ? parsed : 0;

    if (this.newRule.value === undefined || this.newRule.value <= 0) {
      alert('Veuillez remplir tous les champs correctement');
      return;
    }

    const payload: CreateWholesaleRuleRequest = {
      ruleType: this.newRule.ruleType!,
      value: this.newRule.value!,
      description: undefined
    };

    this.wholesaleRulesService.createWholesaleRule(payload).subscribe({
      next: (newRule) => {
        this.predefinedRules.push(newRule);
        this.showNewRuleDialog = false;
        this.newRule = { ruleType: 'percentage', value: 0 };
        this.newRuleValueString = '0';
      },
      error: (error) => {
        console.error('Error creating wholesale rule:', error);
        alert('Erreur lors de la création de la règle');
      }
    });
  }

  // Numpad handlers for new rule dialog
  onNumpadDigit(digit: '0'|'1'|'2'|'3'|'4'|'5'|'6'|'7'|'8'|'9'): void {
    if (this.newRuleValueString === '0') {
      this.newRuleValueString = digit;
    } else {
      this.newRuleValueString = this.newRuleValueString + digit;
    }
  }

  onNumpadDot(): void {
    if (!this.newRuleValueString.includes('.')) {
      this.newRuleValueString = this.newRuleValueString + '.';
    }
  }

  onNumpadClear(): void {
    this.newRuleValueString = '0';
  }

  setNewRuleType(type: 'percentage' | 'fixed' | 'discount'): void {
    this.newRule.ruleType = type;
    // Optionally keep current value; no reset to preserve user entry
    // If you want to reset on type change, uncomment the next line
    // this.newRuleValueString = '0';
  }

  removeCustomRule(ruleId: string): void {
    this.wholesaleRulesService.deleteWholesaleRule(ruleId).subscribe({
      next: () => {
        this.predefinedRules = this.predefinedRules.filter(rule => rule.id !== ruleId);
      },
      error: (error) => {
        console.error('Error deleting wholesale rule:', error);
        alert('Erreur lors de la suppression de la règle');
      }
    });
  }

  archiveRule(ruleId: string): void {
    this.wholesaleRulesService.archiveWholesaleRule(ruleId).subscribe({
      next: (updatedRule) => {
        const index = this.predefinedRules.findIndex(r => r.id === ruleId);
        if (index !== -1) {
          this.predefinedRules[index] = updatedRule;
        }
      },
      error: (error) => {
        console.error('Error archiving wholesale rule:', error);
        alert('Erreur lors de l\'archivage de la règle');
      }
    });
  }

  unarchiveRule(ruleId: string): void {
    this.wholesaleRulesService.unarchiveWholesaleRule(ruleId).subscribe({
      next: (updatedRule) => {
        const index = this.predefinedRules.findIndex(r => r.id === ruleId);
        if (index !== -1) {
          this.predefinedRules[index] = updatedRule;
        }
      },
      error: (error) => {
        console.error('Error unarchiving wholesale rule:', error);
        alert('Erreur lors de la restauration de la règle');
      }
    });
  }

  getActiveRules(): WholesaleRule[] {
    return this.predefinedRules.filter(rule => !rule.isArchived);
  }

  getArchivedRules(): WholesaleRule[] {
    return this.predefinedRules.filter(rule => rule.isArchived);
  }

  toggleArchivedRules(): void {
    this.showArchivedRules = !this.showArchivedRules;
  }

  confirmAndSave(): void {
    if (this.appliedRules.length === 0) {
      alert('Aucune règle appliquée');
      return;
    }

    // Create wholesale sales for each applied rule
    this.appliedRules.forEach(appliedRule => {
      this.createWholesaleSale(appliedRule.rule, appliedRule.productIds);
    });

    // Clear applied rules after saving
    this.appliedRules = [];
  }

  createWholesaleSale(rule: WholesaleRule, productIds: number[]): void {
    if (!this.selectedCustomer) {
      console.error('No customer selected');
      return;
    }

    const selectedProducts = this.products.filter(p => productIds.includes(p.id));
    
    // Create sale items with wholesale pricing
    const items = selectedProducts.map(product => {
      let finalPrice = Number(this.getWholesalePrice(product)) || 0;
      
      // Apply rule pricing
      if (rule.ruleType === 'percentage') {
        finalPrice = finalPrice * (1 - (Number(rule.value) || 0) / 100);
      } else if (rule.ruleType === 'fixed') {
        finalPrice = Number(rule.value) || 0;
      } else if (rule.ruleType === 'discount') {
        finalPrice = Math.max(0, finalPrice - (Number(rule.value) || 0));
      }

      return {
        productId: product.id,
        productName: product.name,
        quantity: 1, // Default quantity for wholesale
        unitPrice: Number(finalPrice) || 0,
        total: Number(finalPrice) || 0,
        isWholesale: true
      };
    });

    const total = items.reduce((sum, item) => sum + (Number(item.total) || 0), 0);

    const wholesaleSaleData = {
      items,
      total,
      discount: 0,
      finalTotal: total,
      clientId: this.selectedCustomer.id,
      amountPaid: total, // Assume full payment for wholesale
      paymentMethodId: 1, // Default payment method
      isWholesale: true,
      paymentType: 'COMPTANT' as 'COMPTANT'
    };

    this.salesService.createWholesaleSalePublic(wholesaleSaleData).subscribe({
      next: (response: unknown) => {
        alert(`Vente en gros créée avec succès! Total: ${total.toFixed(3)} dt`);
        // Success feedback - no need to clear selections since they're already cleared
      },
      error: (error: unknown) => {
        console.error('Error creating wholesale sale:', error);
        alert('Erreur lors de la création de la vente en gros');
        // Error handling - no need to remove applied rules since we don't track them anymore
      }
    });
  }



  getRuleTypeLabel(type: string): string {
    switch (type) {
      case 'percentage': return 'Remise %';
      case 'fixed': return 'Prix fixe';
      case 'discount': return 'Remise dt';
      case 'manual': return 'Remise manuelle';
      default: return type;
    }
  }

  getRuleTypeColor(type: string): string {
    switch (type) {
      case 'percentage': return 'bg-blue-500/20 text-blue-400';
      case 'fixed': return 'bg-green-500/20 text-green-400';
      case 'discount': return 'bg-orange-500/20 text-orange-400';
      case 'manual': return 'bg-purple-500/20 text-purple-400';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  }

  getProductById(productId: number): ClientGrosItem | undefined {
    return this.products.find(p => p.id === productId);
  }

  // Group selection helpers
  areAllGroupSelected(groupProducts: ClientGrosItem[]): boolean {
    if (!groupProducts || groupProducts.length === 0) return false;
    for (const p of groupProducts) {
      if (!this.selectedProductIds.has(p.id)) return false;
    }
    return true;
  }

  toggleSelectGroup(groupProducts: ClientGrosItem[]): void {
    if (!groupProducts || groupProducts.length === 0) return;
    const allSelected = this.areAllGroupSelected(groupProducts);
    if (allSelected) {
      // Deselect all in group
      for (const p of groupProducts) {
        this.selectedProductIds.delete(p.id);
      }
    } else {
      // Select all in group
      for (const p of groupProducts) {
        this.selectedProductIds.add(p.id);
      }
    }
  }

  goBack(): void {
    this.selectedCustomer = null;
    this.showCustomerDialog = true;
    this.selectedProductIds.clear();
    this.appliedRules = [];
  }

  // Optimized selection tracking with Set for O(1) lookup
  private selectedProductIds = new Set<number>();
  private parentProductsCache = new Map<number, Product>();

  isProductSelected(productId: number): boolean {
    return this.selectedProductIds.has(productId);
  }

  getProductCardClass(productId: number): string {
    const baseClass = 'product-button border border-gray-200 rounded-lg p-2 text-center transition-colors duration-150 cursor-pointer shadow-sm relative select-none';
    const isSelected = this.isProductSelected(productId);
    const product = this.products.find(p => p.id === productId);
    
    if (isSelected) {
      return baseClass + ' border-purple-500 bg-purple-50';
    } else if (product && this.hasWholesalePrice(product)) {
      return baseClass + ' bg-emerald-50/30 border-emerald-200/50';
    } else {
      return baseClass + ' bg-rose-50/30 border-rose-200/50';
    }
  }

  isWholesaleClient(): boolean {
    // Always return true for client-gros module - all clients get wholesale pricing
    return true;
  }

  getWholesalePrice(product: ClientGrosItem): number {
    // Always use wholesale pricing in client-gros module
    // Resolve the base product that carries bundle configuration
    const baseProductId = (product.parentProductId && product.parentProductId > 0)
      ? product.parentProductId
      : product.id;

    // Try parent products cache first (warmed in background)
    const cachedBase = this.parentProductsCache.get(baseProductId as number) as any | undefined;
    const cachedBundlePrice = Number(cachedBase?.bundlePrice || 0);
    const cachedBundleSize = Number(cachedBase?.bundleSize || 0);
    if (cachedBundlePrice > 0 && cachedBundleSize > 0) {
      return cachedBundlePrice / cachedBundleSize;
    }

    // Fallback to currently loaded list (may include parents when SHOP, or subs when NOT_SHOP)
    const listBase = this.products.find(p => p.id === baseProductId) as any | undefined;
    const listBundlePrice = Number(listBase?.bundlePrice || 0);
    const listBundleSize = Number(listBase?.bundleSize || 0);
    if (listBundlePrice > 0 && listBundleSize > 0) {
      return listBundlePrice / listBundleSize;
    }

    // As a final fallback, try bundle config on the displayed product itself
    const selfBundlePrice = Number((product as any)?.bundlePrice || 0);
    const selfBundleSize = Number((product as any)?.bundleSize || 0);
    if (selfBundlePrice > 0 && selfBundleSize > 0) {
      return selfBundlePrice / selfBundleSize;
    }

    // No bundle info anywhere: use original unit price
    return Number(product.prix_vente_TTC) || 0;
  }

  hasWholesalePrice(product: ClientGrosItem): boolean {
    const baseProductId = (product.parentProductId && product.parentProductId > 0)
      ? product.parentProductId
      : product.id;

    const cachedBase = this.parentProductsCache.get(baseProductId as number) as any | undefined;
    if (Number(cachedBase?.bundlePrice || 0) > 0 && Number(cachedBase?.bundleSize || 0) > 0) {
      return true;
    }

    const listBase = this.products.find(p => p.id === baseProductId) as any | undefined;
    if (Number(listBase?.bundlePrice || 0) > 0 && Number(listBase?.bundleSize || 0) > 0) {
      return true;
    }

    if (Number((product as any)?.bundlePrice || 0) > 0 && Number((product as any)?.bundleSize || 0) > 0) {
      return true;
    }

    return false;
  }

  truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
      return text;
    }
    return text.substring(0, maxLength) + '...';
  }

  // TrackBy function for better Angular performance
  trackByProductId(index: number, product: ClientGrosItem): number {
    return product.id;
  }

  // Get paginated products for better performance
  getPaginatedProducts(): ClientGrosItem[] {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    return this.filteredProducts.slice(startIndex, endIndex);
  }

  // Get total pages
  getTotalPages(): number {
    return Math.ceil(this.filteredProducts.length / this.itemsPerPage);
  }

  // Go to next page
  nextPage(): void {
    if (this.currentPage < this.getTotalPages()) {
      this.currentPage++;
    }
  }

  // Go to previous page
  previousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
    }
  }

  // Reset pagination when search changes
  onProductSearch(): void {
    this.currentPage = 1; // Reset to first page
    if (!this.searchQuery.trim() && !this.selectedFamily) {
      this.filteredProducts = this.products;
    } else {
      this.filteredProducts = this.products.filter(product => {
        const matchesSearch = !this.searchQuery.trim() || 
          product.name.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
          (product.barcode || '').toLowerCase().includes(this.searchQuery.toLowerCase());
        
        const matchesFamily = !this.selectedFamily || 
          product.famille?.id.toString() === this.selectedFamily;
        
        return matchesSearch && matchesFamily;
      });
    }
  }

  // Group products by parent product for UI rendering
  getGroupedProducts(): Array<{
    parentProduct: Product | null;
    parentProductId: number;
    parentProductName: string;
    parentProductImage: string | null;
    produits: ClientGrosItem[];
  }> {
    // If current depot is SHOP (parents already loaded), do not group by parent
    if (!this.shouldGroupByParent) {
      const produits = [...this.filteredProducts].sort((a, b) => a.name.localeCompare(b.name));
      return [{
        parentProduct: null,
        parentProductId: 0,
        parentProductName: 'Produits',
        parentProductImage: null,
        produits
      }];
    }

    const groups = new Map<number, ClientGrosItem[]>();
    const source = this.filteredProducts;

    source.forEach(prod => {
      const parentId = (prod.parentProductId ?? null) ? (prod.parentProductId as number) : -prod.id;
      if (!groups.has(parentId)) groups.set(parentId, []);
      groups.get(parentId)!.push(prod);
    });

    const result: Array<{
      parentProduct: Product | null;
      parentProductId: number;
      parentProductName: string;
      parentProductImage: string | null;
      produits: ClientGrosItem[];
    }> = [];

    for (const [parentId, produits] of groups) {
      let parentProduct: Product | null = null;
      let parentProductName = 'Produits Indépendants';
      let parentProductImage: string | null = null;
      if (parentId > 0) {
        parentProduct = this.parentProductsCache.get(parentId) || null;
        parentProductName = parentProduct?.name || 'Produit Parent';
        parentProductImage = (parentProduct as any)?.photo || null;
      } else if (produits.length > 0) {
        parentProductName = produits[0].name;
        parentProductImage = produits[0].photo || null;
      }

      result.push({
        parentProduct,
        parentProductId: parentId,
        parentProductName,
        parentProductImage,
        produits: produits.sort((a, b) => a.name.localeCompare(b.name))
      });
    }

    return result.sort((a, b) => {
      if (b.produits.length !== a.produits.length) return b.produits.length - a.produits.length;
      return a.parentProductName.localeCompare(b.parentProductName);
    });
  }
}
