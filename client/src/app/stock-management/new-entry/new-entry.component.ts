import { Component, OnInit, computed, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, Validators, FormArray, FormGroup, FormControl, AbstractControl } from '@angular/forms';
import { SupplierService } from '../../core/services/supplier.service';
import { ProductsService } from '../../core/services/products.service';
import { StockDocumentsService } from '../../core/services/stock-documents.service';

interface EntryItemForm {
  productId: number;
  famille: string;
  quantity: number;
  purchasePrice?: number | null;
  notes?: string | null;
}

@Component({
  selector: 'app-new-entry',
  templateUrl: './new-entry.component.html',
  standalone: false
})
export class NewEntryComponent implements OnInit {
  depotId = -1;
  loading = false;
  error = '';
  success = '';

  suppliers = signal<any[]>([]);
  products = signal<any[]>([]);
  private searchQuery = signal<string>('');
  filteredProducts = computed(() => {
    const all = this.products();
    const q = (this.searchQuery() || '').toLowerCase();
    const selected = this.selectedCategory();
    let result = all;
    if (selected && selected !== 'Tous') {
      result = result.filter((p) => (p.famille?.name || '').toLowerCase() === selected.toLowerCase());
    }
    if (!q) return result;
    return result.filter((p) => (p.name || '').toLowerCase().includes(q) || (p.barcode || '').toLowerCase().includes(q));
  });

  form!: FormGroup;

  // UI state inspired by inventory count
  productCategories: string[] = ['Tous'];
  selectedCategory = signal<string>('Tous');
  currentInput: string = '';
  pendingProduct: any | null = null;
  selectedIndex: number = -1;
  selectedField: 'quantity' | 'unitPrice' | null = null;
  lastEnteredValue: string = '';
  Math = Math;

  // Supplier dialog state
  showSupplierDialog = false;
  notes: string = '';
  newSupplierName = '';
  newSupplierPhone = '';
  newSupplierEmail = '';
  showCreateSupplier = false;

  // Simple supplier info for standalone entry
  selectedSupplierName = '';
  selectedSupplierPhone = '';
  selectedSupplierEmail = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private fb: FormBuilder,
    private supplierService: SupplierService,
    private productsService: ProductsService,
    private stockDocs: StockDocumentsService
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const id = params.get('depotId');
      this.depotId = id ? parseInt(id, 10) : -1;
    });

    // Initialize form after fb is available
    this.form = this.fb.group({
      notes: this.fb.control<string>(''),
      itemSearch: this.fb.control<string>(''),
      items: this.fb.array<FormGroup>([])
    });

    this.loadLookups();

    this.itemSearchCtrl.valueChanges.subscribe((q) => {
      this.searchQuery.set((q || '').toString());
    });
  }

  get itemsArray(): FormArray {
    return this.form.get('items') as FormArray;
  }


  get notesCtrl(): FormControl<string> {
    return this.form.get('notes') as FormControl<string>;
  }

  get itemSearchCtrl(): FormControl<string> {
    return this.form.get('itemSearch') as FormControl<string>;
  }

  asFormControl(control: AbstractControl | null): FormControl<any> {
    return control as FormControl<any>;
  }

  addItem(product: any): void {
    const group = this.fb.group({
      productId: this.fb.control<number>(product.id, { nonNullable: true, validators: [Validators.required] }),
      famille: this.fb.control<string>(product.famille?.name || 'Divers', { nonNullable: true, validators: [Validators.required] }),
      quantity: this.fb.control<number>(1, { nonNullable: true, validators: [Validators.required, Validators.min(0.001)] }),
      unitPrice: this.fb.control<number | null>(product.prix_achat || null),
      batch: this.fb.control<string | null>(null),
      notes: this.fb.control<string | null>(null)
    });
    this.itemsArray.insert(0, group);
    this.selectedIndex = 0;
    this.selectedField = 'quantity';
    this.pendingProduct = product;
    this.currentInput = '';
  }

  handleProductClick(product: any): void {
    // Check if product already exists in the list
    const existingIndex = this.itemsArray.controls.findIndex((c) => c.get('productId')?.value === product.id);
    
    if (existingIndex >= 0) {
      // Product exists - increment quantity by 1
      const existingCtrl = this.itemsArray.at(existingIndex) as FormGroup;
      const currentQty = existingCtrl.get('quantity')?.value || 0;
      existingCtrl.get('quantity')!.setValue(currentQty + 1);
      this.selectedIndex = existingIndex;
      this.selectedField = 'quantity';
    } else {
      // Product doesn't exist - add new item
      this.pendingProduct = product;
      this.currentInput = '';
      this.addItem(product);
    }
  }

  removeItem(index: number): void {
    this.itemsArray.removeAt(index);
  }

  loadLookups(): void {
    this.loading = true;
    this.error = '';

    this.supplierService.getSuppliers().subscribe({
      next: (sup) => this.suppliers.set((sup || []).filter((s: any) => s.isActive !== false)),
      error: () => {}
    });

    this.productsService.getProducts().subscribe({
      next: (prods) => {
        // No filtering by isStockable for entry; include all products
        const list = (prods || []);
        this.products.set(list);
        // Build categories
        const cats = Array.from(new Set(list.map((p: any) => p.famille?.name).filter(Boolean)));
        this.productCategories = ['Tous', ...cats];
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.error = 'Erreur chargement produits';
      }
    });
  }

  submit(): void {
    if (this.itemsArray.length === 0) {
      this.error = 'Ajouter au moins un produit';
      return;
    }
    
    this.showSupplierDialog = true;
    this.error = '';
  }

  confirmEntry(): void {
    if (!this.selectedSupplierName && !this.showCreateSupplier) {
      this.error = 'Veuillez sélectionner un fournisseur ou en créer un nouveau';
      return;
    }

    // Create entry directly without any payment processing
    this.createStandaloneEntry();
  }

  createStandaloneEntry(): void {
    this.loading = true;
    this.error = '';
    this.success = '';

    const payloadItems: EntryItemForm[] = this.itemsArray.controls.map((ctrl) => ({
      productId: ctrl.get('productId')?.value || 0,
      famille: ctrl.get('famille')?.value || 'Divers',
      quantity: ctrl.get('quantity')?.value || 0,
      purchasePrice: ctrl.get('unitPrice')?.value || null,
      batch: ctrl.get('batch')?.value || null,
      notes: ctrl.get('notes')?.value || null
    }));

    // Create entry with supplier info as text (not linked to suppliers table)
    const supplierInfo = this.showCreateSupplier 
      ? `${this.newSupplierName}${this.newSupplierPhone ? ` - ${this.newSupplierPhone}` : ''}${this.newSupplierEmail ? ` - ${this.newSupplierEmail}` : ''}`
      : this.selectedSupplierName;
    
    const notes = `${this.notes || ''}\nFournisseur: ${supplierInfo}`.trim();

    this.stockDocs.createEntry(this.depotId, null, payloadItems, notes).subscribe({
      next: (doc) => {
        this.loading = false;
        this.success = `Bon d'entrée créé avec succès`;
        this.showSupplierDialog = false;
        setTimeout(() => {
          this.router.navigate(['/stock-management']);
        }, 2000);
      },
      error: (err) => {
        this.loading = false;
        this.error = err.error?.error || 'Erreur lors de la création du bon d\'entrée';
      }
    });
  }

  cancel(): void {
    this.router.navigate(['/stock-management']);
  }

  // Supplier dialog methods
  closeSupplierDialog(): void {
    this.showSupplierDialog = false;
    this.selectedSupplierName = '';
    this.notes = '';
    this.showCreateSupplier = false;
    this.newSupplierName = '';
    this.newSupplierPhone = '';
    this.newSupplierEmail = '';
  }

  toggleCreateSupplier(): void {
    this.showCreateSupplier = !this.showCreateSupplier;
    if (this.showCreateSupplier) {
      this.selectedSupplierName = '';
    }
  }

  selectSupplier(supplier: any): void {
    this.selectedSupplierName = supplier.name;
    this.selectedSupplierPhone = supplier.phone || '';
    this.selectedSupplierEmail = supplier.email || '';
  }

  // UI helpers similar to inventory count
  selectCategory(category: string): void {
    this.selectedCategory.set(category);
  }

  trackByProductId(index: number, product: any): number {
    return product.id;
  }

  getProductCardClass(productId: number): string {
    const baseClass = 'product-button bg-white border border-gray-200 rounded-lg p-2 text-center transition-colors duration-150 cursor-pointer shadow-sm hover:shadow-md relative select-none';
    const isSelected = this.itemsArray.controls.some((c) => c.get('productId')?.value === productId);
    return isSelected ? baseClass + ' border-blue-500 bg-blue-50' : baseClass;
  }

  selectExisting(index: number): void {
    this.selectedIndex = index;
    this.selectedField = null;
    this.currentInput = '';
  }

  selectField(index: number, field: 'quantity' | 'unitPrice'): void {
    this.selectedIndex = index;
    this.selectedField = field;
    this.currentInput = '';
  }

  addToInput(value: string): void {
    this.currentInput += value;
  }

  addDecimal(): void {
    if (!this.currentInput.includes('.')) {
      this.currentInput += '.';
    }
  }

  clearInput(): void { this.currentInput = ''; }

  clearDisplay(): void {
    if (this.currentInput.length > 0) {
      this.currentInput = this.currentInput.slice(0, -1);
    }
  }

  enterValue(): void {
    const value = parseFloat(this.currentInput);
    if (isNaN(value) || value <= 0) {
      this.error = 'Valeur invalide (> 0)';
      return;
    }
    
    if (this.pendingProduct) {
      // Adding new product
      const idx = this.itemsArray.controls.findIndex((c) => c.get('productId')?.value === this.pendingProduct!.id);
      if (idx >= 0) {
        (this.itemsArray.at(idx) as FormGroup).get('quantity')!.setValue(value);
        this.selectedIndex = idx;
      } else {
        this.addItem(this.pendingProduct);
        (this.itemsArray.at(this.itemsArray.length - 1) as FormGroup).get('quantity')!.setValue(value);
      }
      this.pendingProduct = null;
    } else if (this.selectedIndex >= 0 && this.selectedField) {
      // Updating existing field
      (this.itemsArray.at(this.selectedIndex) as FormGroup).get(this.selectedField)!.setValue(value);
      
      // If updating unit price, also update the product's prix_achat
      if (this.selectedField === 'unitPrice') {
        const productId = this.itemsArray.at(this.selectedIndex).get('productId')?.value;
        this.updateProductPurchasePrice(productId, value);
      }
    }
    
    this.lastEnteredValue = this.currentInput;
    this.currentInput = '';
    this.selectedField = null;
  }

  getFieldClass(index: number, field: 'quantity' | 'unitPrice'): string {
    const isSelected = this.selectedIndex === index && this.selectedField === field;
    const baseClass = 'w-full border rounded px-2 py-1 text-xs text-right cursor-pointer transition-all duration-200';
    
    if (isSelected) {
      return `${baseClass} bg-blue-100 border-blue-400 shadow-md ring-2 ring-blue-300`;
    } else {
      return `${baseClass} bg-white border-gray-300 hover:bg-gray-50 hover:border-gray-400`;
    }
  }

  getProductName(productId: number): string {
    const product = this.products().find(p => p.id === productId);
    return product ? product.name : `Produit #${productId}`;
  }

  get totalAmount(): number {
    return this.itemsArray.controls.reduce((total, ctrl) => {
      const quantity = ctrl.get('quantity')?.value || 0;
      const unitPrice = ctrl.get('unitPrice')?.value || 0;
      return total + (quantity * unitPrice);
    }, 0);
  }

  get totalSellingAmount(): number {
    return this.itemsArray.controls.reduce((total, ctrl) => {
      const quantity = ctrl.get('quantity')?.value || 0;
      const productId = ctrl.get('productId')?.value;
      const product = this.products().find((p: any) => p.id === productId);
      const sellingPrice = product?.prix_vente_TTC || 0;
      return total + (quantity * sellingPrice);
    }, 0);
  }

  get totalPurchaseAmount(): number {
    return this.itemsArray.controls.reduce((total, ctrl) => {
      const quantity = ctrl.get('quantity')?.value || 0;
      const unitPrice = ctrl.get('unitPrice')?.value || 0;
      return total + (quantity * unitPrice);
    }, 0);
  }

  get totalItems(): number {
    return this.itemsArray.controls.reduce((total, ctrl) => {
      return total + (ctrl.get('quantity')?.value || 0);
    }, 0);
  }

  getCategoryButtonClass(category: string): string {
    const isSelected = this.selectedCategory() === category;
    const baseClass = 'border-2 shadow-sm';
    
    if (isSelected) {
      // Selected state - more prominent colors
      switch (category) {
        case 'Tous':
          return `${baseClass} bg-blue-500 text-white border-blue-600 shadow-blue-200`;
        case 'Pâtisserie':
          return `${baseClass} bg-pink-500 text-white border-pink-600 shadow-pink-200`;
        case 'Viennoiserie':
          return `${baseClass} bg-amber-500 text-white border-amber-600 shadow-amber-200`;
        case 'Boulangerie':
          return `${baseClass} bg-orange-500 text-white border-orange-600 shadow-orange-200`;
        case 'Boissons':
          return `${baseClass} bg-cyan-500 text-white border-cyan-600 shadow-cyan-200`;
        case 'Vrac':
          return `${baseClass} bg-green-500 text-white border-green-600 shadow-green-200`;
        case 'Pâtisserie Tunisienne':
          return `${baseClass} bg-purple-500 text-white border-purple-600 shadow-purple-200`;
        case 'Jus et Smoothies':
          return `${baseClass} bg-emerald-500 text-white border-emerald-600 shadow-emerald-200`;
        default:
          return `${baseClass} bg-gray-500 text-white border-gray-600 shadow-gray-200`;
      }
    } else {
      // Unselected state - lighter colors
      switch (category) {
        case 'Tous':
          return `${baseClass} bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100`;
        case 'Pâtisserie':
          return `${baseClass} bg-pink-50 text-pink-700 border-pink-200 hover:bg-pink-100`;
        case 'Viennoiserie':
          return `${baseClass} bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100`;
        case 'Boulangerie':
          return `${baseClass} bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100`;
        case 'Boissons':
          return `${baseClass} bg-cyan-50 text-cyan-700 border-cyan-200 hover:bg-cyan-100`;
        case 'Vrac':
          return `${baseClass} bg-green-50 text-green-700 border-green-200 hover:bg-green-100`;
        case 'Pâtisserie Tunisienne':
          return `${baseClass} bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100`;
        case 'Jus et Smoothies':
          return `${baseClass} bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100`;
        default:
          return `${baseClass} bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100`;
      }
    }
  }

  updateProductPurchasePrice(productId: number, newPrice: number): void {
    // Update the product in the local products array
    const products = this.products();
    const productIndex = products.findIndex((p: any) => p.id === productId);
    if (productIndex >= 0) {
      products[productIndex].prix_achat = newPrice;
      this.products.set([...products]);
    }

    // Update the product in the backend
    this.productsService.updateProduct(productId, { prix_achat: newPrice }).subscribe({
      next: () => {
        // Success - product updated
      },
      error: (err) => {
        console.error('Error updating product purchase price:', err);
        // Don't show error to user as this is a background update
      }
    });
  }
}