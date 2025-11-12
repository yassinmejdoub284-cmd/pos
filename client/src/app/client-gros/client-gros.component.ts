import { Component, OnInit, OnDestroy } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
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
  bundlePrice?: number;
  bundleSize?: number;
  isWholesale?: boolean;
  prix_achat?: number;
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

  // Client-specific prices cache
  clientPrices: Map<number, number> = new Map(); // Map<productId, prix_vente_TTC>

  constructor(
    private route: ActivatedRoute,
    private http: HttpClient,
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
          // Clear any existing client prices first
          this.clientPrices.clear();
          this.clientsService.getClient(clientId).subscribe({
            next: (client: Client) => {
              this.selectedCustomer = client;
              this.showCustomerDialog = false;
              // Load client-specific prices for this specific client
              this.loadClientPrices(client.id);
              // Reload products after client is selected to ensure correct prices
              this.loadProducts();
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
        // Filter only wholesale products
        const wholesaleProducts = products.filter(p => p.isWholesale === true);
        // Fill parent products cache
        this.parentProductsCache.clear();
        wholesaleProducts.forEach(p => this.parentProductsCache.set(p.id, p));
        // Map to unified item type, include wholesale config fields
        this.products = wholesaleProducts.map(p => ({
          id: p.id,
          name: p.name,
          prix_vente_TTC: Number(p.prix_vente_TTC) || 0,
          famille: p.famille,
          barcode: p.barcode || null,
          photo: p.photo || null,
          parentProductId: null,
          bundlePrice: p.bundlePrice ? Number(p.bundlePrice) : undefined,
          bundleSize: p.bundleSize || undefined,
          isWholesale: p.isWholesale,
          prix_achat: p.prix_achat ? Number(p.prix_achat) : undefined
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
        // Filter only wholesale products
        const wholesaleSubs = subs.filter((sp: any) => sp.isWholesale === true);
        // subs already include prix_vente_TTC and famille
        this.products = wholesaleSubs.map((sp: any) => ({
          id: sp.id,
          name: sp.name,
          prix_vente_TTC: Number(sp.prix_vente_TTC) || 0,
          famille: sp.famille,
          barcode: sp.barcode || null,
          photo: sp.photo || null,
          parentProductId: sp.parentProductId ?? null,
          bundlePrice: sp.bundlePrice ? Number(sp.bundlePrice) : undefined,
          bundleSize: sp.bundleSize || undefined,
          isWholesale: sp.isWholesale,
          prix_achat: sp.prix_achat ? Number(sp.prix_achat) : undefined
        }));
        this.filteredProducts = this.products;
        this.selectedProductIds.clear();
        this.loading = false;
        // Warm parent products cache in background (only wholesale products)
        this.productsService.getProducts().subscribe({
          next: (parents: Product[]) => {
            this.parentProductsCache.clear();
            parents.filter(p => p.isWholesale === true).forEach(p => this.parentProductsCache.set(p.id, p));
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
    // Clear existing prices first
    this.clientPrices.clear();
    this.selectedCustomer = customer;
    this.showCustomerDialog = false;
    // Load client-specific prices for this specific client
    this.loadClientPrices(customer.id);
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
        // Calculate final price per bundle (fardeau) with discount applied on margin
        const finalBundlePrice = this.calculateDiscountedBundlePrice(product, appliedRule.rule);
        total += Number(finalBundlePrice) || 0;
      });
    });
    return total;
  }

  getOriginalTotalAmount(): number {
    let total = 0;
    this.appliedRules.forEach(appliedRule => {
      const products = this.products.filter(p => appliedRule.productIds.includes(p.id));
      products.forEach(product => {
        // Use bundle price for original total (per bundle/fardeau)
        const config = this.getBundleConfig(product);
        total += config.bundlePrice;
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

  // Calculate discounted bundle price (per fardeau) based on rule type
  calculateDiscountedBundlePrice(product: ClientGrosItem, rule: WholesaleRule): number {
    const config = this.getBundleConfig(product);
    const ruleVal = Number(rule.value) || 0;

    if (rule.ruleType === 'percentage') {
      // Percentage discount is calculated on the wholesale margin
      // Formula: bundlePrice - (margin * discount_percentage / 100)
      const margin = this.getWholesaleMargin(product);
      const discountOnMargin = margin * (ruleVal / 100);
      return Math.max(0, config.bundlePrice - discountOnMargin);
    } else if (rule.ruleType === 'fixed') {
      // Fixed price per bundle (fardeau)
      return ruleVal;
    } else if (rule.ruleType === 'discount') {
      // Discount amount per bundle (fardeau)
      return Math.max(0, config.bundlePrice - ruleVal);
    }
    
    // No rule or unknown type: return original bundle price
    return config.bundlePrice;
  }

  // Get calculated price per unit (for display)
  getCalculatedPrice(product: ClientGrosItem, rule: WholesaleRule): number {
    // Calculate discounted bundle price, then convert to unit price
    const discountedBundlePrice = this.calculateDiscountedBundlePrice(product, rule);
    const config = this.getBundleConfig(product);
    if (config.bundleSize > 0) {
      return discountedBundlePrice / config.bundleSize;
    }
    return discountedBundlePrice;
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

    // Track all products that need price updates
    const productsToUpdate: { productId: number; newPrice: number }[] = [];

    // Create wholesale sales for each applied rule and collect price updates
    const salePromises: Promise<any>[] = [];
    
    this.appliedRules.forEach(appliedRule => {
      const selectedProducts = this.products.filter(p => appliedRule.productIds.includes(p.id));
      
      // Calculate new prices for each product (per bundle/fardeau)
      selectedProducts.forEach(product => {
        // Calculate discounted bundle price (discount applied on margin for percentage)
        const discountedBundlePrice = this.calculateDiscountedBundlePrice(product, appliedRule.rule);
        
        // Convert to unit price for storage (price per unit after discount)
        const config = this.getBundleConfig(product);
        const finalUnitPrice = config.bundleSize > 0 
          ? discountedBundlePrice / config.bundleSize 
          : discountedBundlePrice;

        // Store the new price for this product (will be saved to client-specific prices only)
        // This is the unit price after discount
        productsToUpdate.push({
          productId: product.id,
          newPrice: finalUnitPrice
        });
      });

      // Create sale
      salePromises.push(
        new Promise<void>((resolve, reject) => {
          this.createWholesaleSale(appliedRule.rule, appliedRule.productIds, () => resolve(), reject);
        })
      );
    });

    // Wait for all sales to be created, then update product prices
    Promise.all(salePromises).then(() => {
      // Update product prices in database
      this.updateProductPrices(productsToUpdate);
    }).catch((error) => {
      console.error('Error creating sales:', error);
      alert('Erreur lors de la création des ventes');
    });

    // Clear applied rules after saving
    this.appliedRules = [];
  }

  updateProductPrices(productsToUpdate: { productId: number; newPrice: number }[]): void {
    if (!this.selectedCustomer) {
      console.error('No customer selected');
      return;
    }

    // Remove duplicates and handle parent products
    // If a product has a parentProductId, save the price to the parent product ID
    const uniqueProducts = new Map<number, number>();
    productsToUpdate.forEach(({ productId, newPrice }) => {
      // Find the product to check if it has a parent
      const product = this.products.find(p => p.id === productId);
      // Use parent product ID if exists, otherwise use the product ID itself
      const targetProductId = (product?.parentProductId && product.parentProductId > 0) 
        ? product.parentProductId 
        : productId;
      
      // Keep the lowest price if product appears multiple times
      if (!uniqueProducts.has(targetProductId) || uniqueProducts.get(targetProductId)! > newPrice) {
        uniqueProducts.set(targetProductId, newPrice);
      }
    });

    // Prepare prices array for bulk update
    // These prices are saved to ClientProductPrice table, NOT to Product table
    const prices = Array.from(uniqueProducts.entries()).map(([productId, prix_vente_TTC]) => ({
      productId,
      prix_vente_TTC
    }));

    // Update client-specific prices using bulk endpoint
    this.http.post(`${environment.apiUrl}/clients/${this.selectedCustomer.id}/product-prices`, {
      prices
    }, { withCredentials: true }).subscribe({
      next: (response: any) => {
        alert(`Prix clients mis à jour avec succès pour ${uniqueProducts.size} produit(s)!`);
        // Reload client prices cache
        this.loadClientPrices(this.selectedCustomer!.id);
        // Reload products to reflect updated prices
        this.loadProducts();
      },
      error: (error: any) => {
        console.error('Error updating client prices:', error);
        alert('Erreur lors de la mise à jour des prix clients');
      }
    });
  }

  loadClientPrices(clientId: number): void {
    // Load all client-specific prices for this specific client
    this.http.get<any[]>(`${environment.apiUrl}/clients/${clientId}/product-prices`, { withCredentials: true }).subscribe({
      next: (clientPrices: any[]) => {
        // Load client prices into cache
        this.clientPrices.clear();
        clientPrices.forEach((cp: any) => {
          // Use productId from the product relation if available, otherwise from direct field
          const productId = cp.product?.id || cp.productId;
          const price = Number(cp.prix_vente_TTC);
          if (productId && price > 0) {
            this.clientPrices.set(productId, price);
          }
        });
      },
      error: (error: any) => {
        // If endpoint doesn't exist yet or no prices found, just clear the cache
        // This means we'll use default/wholesale prices
        this.clientPrices.clear();
      }
    });
  }

  createWholesaleSale(rule: WholesaleRule, productIds: number[], onSuccess?: () => void, onError?: (error: any) => void): void {
    if (!this.selectedCustomer) {
      console.error('No customer selected');
      if (onError) onError(new Error('No customer selected'));
      return;
    }

    const selectedProducts = this.products.filter(p => productIds.includes(p.id));
    
    // Create sale items with wholesale pricing (per bundle/fardeau)
    const items = selectedProducts.map(product => {
      // Calculate discounted bundle price (discount applied on margin for percentage)
      const discountedBundlePrice = this.calculateDiscountedBundlePrice(product, rule);
      
      // Convert to unit price for sale item
      const config = this.getBundleConfig(product);
      const finalUnitPrice = config.bundleSize > 0 
        ? discountedBundlePrice / config.bundleSize 
        : discountedBundlePrice;

      return {
        productId: product.id,
        productName: product.name,
        quantity: config.bundleSize || 1, // Quantity per bundle (fardeau)
        unitPrice: Number(finalUnitPrice) || 0,
        total: Number(discountedBundlePrice) || 0, // Total per bundle
        isWholesale: true,
        bundleQuantity: 1, // 1 bundle
        bundleSize: config.bundleSize,
        bundlePrice: discountedBundlePrice
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
        if (onSuccess) onSuccess();
      },
      error: (error: unknown) => {
        console.error('Error creating wholesale sale:', error);
        if (onError) onError(error);
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

  // Get bundle price and size from product configuration
  getBundleConfig(product: ClientGrosItem): { bundlePrice: number; bundleSize: number; prix_achat: number } {
    // Resolve the base product that carries bundle configuration
    const baseProductId = (product.parentProductId && product.parentProductId > 0)
      ? product.parentProductId
      : product.id;

    let bundlePrice = 0;
    let bundleSize = 0;
    let prix_achat = 0;

    // Try parent products cache first (warmed in background)
    const cachedBase = this.parentProductsCache.get(baseProductId as number);
    if (cachedBase) {
      bundlePrice = Number(cachedBase.bundlePrice || 0);
      bundleSize = Number(cachedBase.bundleSize || 0);
      prix_achat = Number(cachedBase.prix_achat || 0);
      if (bundlePrice > 0 && bundleSize > 0) {
        return { bundlePrice, bundleSize, prix_achat };
      }
    }

    // Fallback to currently loaded list (may include parents when SHOP, or subs when NOT_SHOP)
    const listBase = this.products.find(p => p.id === baseProductId);
    if (listBase) {
      bundlePrice = Number(listBase.bundlePrice || 0);
      bundleSize = Number(listBase.bundleSize || 0);
      prix_achat = Number(listBase.prix_achat || 0);
      if (bundlePrice > 0 && bundleSize > 0) {
        return { bundlePrice, bundleSize, prix_achat };
      }
    }

    // As a final fallback, try bundle config on the displayed product itself
    bundlePrice = Number(product.bundlePrice || 0);
    bundleSize = Number(product.bundleSize || 0);
    prix_achat = Number(product.prix_achat || 0);
    if (bundlePrice > 0 && bundleSize > 0) {
      return { bundlePrice, bundleSize, prix_achat };
    }

    // No bundle info: return defaults
    return { bundlePrice: 0, bundleSize: 1, prix_achat: 0 };
  }

  // Get wholesale margin: bundlePrice - (bundleSize * prix_achat)
  getWholesaleMargin(product: ClientGrosItem): number {
    const config = this.getBundleConfig(product);
    const cost = config.bundleSize * config.prix_achat;
    return config.bundlePrice - cost;
  }

  // Get base wholesale price from product configuration (for calculations)
  getBaseWholesalePrice(product: ClientGrosItem): number {
    // Always use base wholesale price from product configuration (bundlePrice / bundleSize)
    // This is the price BEFORE any discount rules are applied
    const config = this.getBundleConfig(product);
    if (config.bundlePrice > 0 && config.bundleSize > 0) {
      return config.bundlePrice / config.bundleSize;
    }
    // No bundle info anywhere: use original unit price
    return Number(product.prix_vente_TTC) || 0;
  }

  // Get wholesale price for display (shows client-specific price if exists, otherwise base wholesale price)
  getWholesalePrice(product: ClientGrosItem): number {
    // First check if there's a client-specific price for the selected client
    if (this.selectedCustomer) {
      // Check for direct product ID match
      if (this.clientPrices.has(product.id)) {
        return this.clientPrices.get(product.id)!;
      }
      
      // Also check for parent product ID if this is a variant
      if (product.parentProductId && product.parentProductId > 0 && this.clientPrices.has(product.parentProductId)) {
        return this.clientPrices.get(product.parentProductId)!;
      }
    }

    // No client-specific price, use base wholesale price
    return this.getBaseWholesalePrice(product);
  }

  hasWholesalePrice(product: ClientGrosItem): boolean {
    const baseProductId = (product.parentProductId && product.parentProductId > 0)
      ? product.parentProductId
      : product.id;

    const cachedBase = this.parentProductsCache.get(baseProductId as number);
    if (cachedBase && Number(cachedBase.bundlePrice || 0) > 0 && Number(cachedBase.bundleSize || 0) > 0) {
      return true;
    }

    const listBase = this.products.find(p => p.id === baseProductId);
    if (listBase && Number(listBase.bundlePrice || 0) > 0 && Number(listBase.bundleSize || 0) > 0) {
      return true;
    }

    if (Number(product.bundlePrice || 0) > 0 && Number(product.bundleSize || 0) > 0) {
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
