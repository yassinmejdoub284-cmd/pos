import { Component, OnInit, OnDestroy } from '@angular/core';
import { ProductsService } from '../core/services/products.service';
import { ClientsService } from '../core/services/clients.service';
import { FamiliesService } from '../core/services/families.service';
import { SalesService } from '../core/services/sales.service';
import { WholesaleRulesService, WholesaleRule } from '../core/services/wholesale-rules.service';
import { Product } from '../core/models/product.model';
import { Client } from '../core/models/client.model';
import { ProductFamily } from '../core/models/product-family.model';


export interface SelectedProduct {
  product: Product;
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
  products: Product[] = [];
  selectedProducts: SelectedProduct[] = [];
  filteredProducts: Product[] = [];
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
    value: 0,
    description: ''
  };

  // Archive management
  showArchivedRules = false;


  constructor(
    private productsService: ProductsService,
    private clientsService: ClientsService,
    private familiesService: FamiliesService,
    private salesService: SalesService,
    private wholesaleRulesService: WholesaleRulesService
  ) {}

  ngOnInit(): void {
    this.loadProducts();
    this.loadFamilies();
    this.loadWholesaleRules();
  }

  ngOnDestroy(): void {
    // Cleanup if needed
  }

  loadProducts(): void {
    this.loading = true;
    this.productsService.getProducts().subscribe({
      next: (products) => {
        this.products = products;
        this.filteredProducts = products;
        // Clear previous selections when loading new products
        this.selectedProductIds.clear();
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading products:', error);
        this.loading = false;
      }
    });
  }

  loadFamilies(): void {
    this.familiesService.getFamilies().subscribe({
      next: (families) => {
        this.families = families;
      },
      error: (error) => {
        console.error('Error loading families:', error);
        // Fallback to empty array if backend fails
        this.families = [];
      }
    });
  }

  loadWholesaleRules(): void {
    this.wholesaleRulesService.getWholesaleRules().subscribe({
      next: (rules) => {
        this.predefinedRules = rules;
      },
      error: (error) => {
        console.error('Error loading wholesale rules:', error);
        // Fallback to empty array if backend fails
        this.predefinedRules = [];
      }
    });
  }

  onCustomerSelected(customer: Client): void {
    this.selectedCustomer = customer;
    this.showCustomerDialog = false;
  }

  onCustomerDialogClosed(): void {
    this.showCustomerDialog = false;
  }


  onFamilyChange(): void {
    this.onProductSearch();
  }

  toggleProductSelection(product: Product): void {
    if (this.selectedProductIds.has(product.id)) {
      this.selectedProductIds.delete(product.id);
    } else {
      this.selectedProductIds.add(product.id);
    }
  }

  getSelectedProducts(): Product[] {
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
        let finalPrice = product.prix_vente_TTC;
        if (appliedRule.rule.ruleType === 'percentage') {
          finalPrice = product.prix_vente_TTC * (1 - appliedRule.rule.value / 100);
        } else if (appliedRule.rule.ruleType === 'fixed') {
          finalPrice = appliedRule.rule.value;
        }
        total += finalPrice;
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

  getCalculatedPrice(product: Product, rule: WholesaleRule): number {
    if (rule.ruleType === 'percentage') {
      return product.prix_vente_TTC * (1 - rule.value / 100);
    } else if (rule.ruleType === 'fixed') {
      return rule.value;
    } else if (rule.ruleType === 'discount') {
      return Math.max(0, product.prix_vente_TTC - rule.value);
    }
    return product.prix_vente_TTC;
  }

  openNewRuleDialog(): void {
    this.newRule = {
      ruleType: 'percentage',
      value: 0,
      description: ''
    };
    this.showNewRuleDialog = true;
  }

  addNewRule(): void {
    if (!this.newRule.description || this.newRule.value === undefined || this.newRule.value <= 0) {
      alert('Veuillez remplir tous les champs correctement');
      return;
    }

    const ruleData = {
      ruleType: this.newRule.ruleType!,
      value: this.newRule.value!,
      description: this.newRule.description!
    };

    this.wholesaleRulesService.createWholesaleRule(ruleData).subscribe({
      next: (newRule) => {
        this.predefinedRules.push(newRule);
        this.showNewRuleDialog = false;
        this.newRule = { ruleType: 'percentage', value: 0, description: '' };
      },
      error: (error) => {
        console.error('Error creating wholesale rule:', error);
        alert('Erreur lors de la création de la règle');
      }
    });
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
      let finalPrice = product.prix_vente_TTC;
      
      // Apply rule pricing
      if (rule.ruleType === 'percentage') {
        finalPrice = product.prix_vente_TTC * (1 - rule.value / 100);
      } else if (rule.ruleType === 'fixed') {
        finalPrice = rule.value;
      }

      return {
        productId: product.id,
        productName: product.name,
        quantity: 1, // Default quantity for wholesale
        unitPrice: finalPrice,
        total: finalPrice,
        isWholesale: true
      };
    });

    const total = items.reduce((sum, item) => sum + item.total, 0);

    const wholesaleSaleData = {
      items,
      total,
      discount: 0,
      finalTotal: total,
      clientId: this.selectedCustomer.id,
      amountPaid: total, // Assume full payment for wholesale
      paymentMethodId: 1, // Default payment method
      isWholesale: true
    };

    this.salesService.createWholesaleSale(wholesaleSaleData).subscribe({
      next: (response) => {
        console.log('Wholesale sale created successfully:', response);
        alert(`Vente en gros créée avec succès! Total: ${total.toFixed(3)} dt`);
        // Success feedback - no need to clear selections since they're already cleared
      },
      error: (error) => {
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

  getProductById(productId: number): Product | undefined {
    return this.products.find(p => p.id === productId);
  }

  goBack(): void {
    this.selectedCustomer = null;
    this.showCustomerDialog = true;
    this.selectedProductIds.clear();
    this.appliedRules = [];
  }

  // Optimized selection tracking with Set for O(1) lookup
  private selectedProductIds = new Set<number>();

  isProductSelected(productId: number): boolean {
    return this.selectedProductIds.has(productId);
  }

  getProductCardClass(productId: number): string {
    const baseClass = 'product-button bg-white border border-gray-200 rounded-lg p-2 text-center transition-colors duration-150 cursor-pointer shadow-sm hover:shadow-md relative select-none';
    const isSelected = this.isProductSelected(productId);
    
    if (isSelected) {
      return baseClass + ' border-purple-500 bg-purple-50';
    } else {
      return baseClass;
    }
  }

  truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
      return text;
    }
    return text.substring(0, maxLength) + '...';
  }

  // TrackBy function for better Angular performance
  trackByProductId(index: number, product: Product): number {
    return product.id;
  }

  // Get paginated products for better performance
  getPaginatedProducts(): Product[] {
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
}
