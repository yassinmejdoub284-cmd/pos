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
  batch?: string | null;
  notes?: string | null;
}

@Component({
  selector: 'app-entry',
  templateUrl: './entry.component.html',
  standalone: false
})
export class EntryComponent implements OnInit {
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

    // Build family counts to support "Autres" bucket
    const familyCounts = new Map<string, number>();
    all.forEach((p: any) => {
      const fam = (p.famille?.name || '').toString();
      const key = fam.trim();
      const prev = familyCounts.get(key) || 0;
      familyCounts.set(key, prev + 1);
    });

    let result = all;
    if (selected && selected !== 'Tous') {
      if (selected === 'Autres') {
        // Families that have 1 or fewer products OR missing family
        result = result.filter((p: any) => {
          const fam = (p.famille?.name || '').toString().trim();
          const count = familyCounts.get(fam) || 0;
          return !fam || count <= 1;
        });
      } else {
        result = result.filter((p) => (p.famille?.name || '').toLowerCase() === selected.toLowerCase());
      }
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
  selectedSupplierId: number | null = null;
  notes: string = '';
  newSupplierName = '';
  newSupplierPhone = '';
  newSupplierEmail = '';
  showCreateSupplier = false;

  // Payment dialog state
  showPaymentChoiceDialog = false;
  showPaymentDialog = false;
  paymentAmount = 0;
  paymentMethod = 'cash';
  paymentNotes = '';
  
  // Partial payment state
  partialPaymentAmount = 0;
  remainingAmount = 0;
  showPartialPaymentDialog = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private fb: FormBuilder,
    private supplierService: SupplierService,
    private productsService: ProductsService,
    private stockDocs: StockDocumentsService
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const id = params.get('depotId');
      this.depotId = id ? parseInt(id, 10) : -1;
    });

    // Initialize form after fb is available
    this.form = this.fb.group({
      supplierId: this.fb.control<number | null>(null),
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

  get supplierIdCtrl(): FormControl<number | null> {
    return this.form.get('supplierId') as FormControl<number | null>;
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

    this.productsService.getProducts(this.depotId).subscribe({
      next: (prods) => {
        // Filter products by depot for entry; include all products from this depot
        const list = (prods || []);
        this.products.set(list);
        // Build categories: only families with >1 product; add "Autres" for the rest
        const counts = new Map<string, number>();
        list.forEach((p: any) => {
          const fam = (p.famille?.name || '').toString().trim();
          const prev = counts.get(fam) || 0;
          counts.set(fam, prev + 1);
        });

        const multiFamilies = Array.from(counts.entries())
          .filter(([name, cnt]) => !!name && cnt > 1)
          .map(([name]) => name);

        const hasOthers = list.some((p: any) => {
          const fam = (p.famille?.name || '').toString().trim();
          const cnt = counts.get(fam) || 0;
          return !fam || cnt <= 1;
        });

        this.productCategories = ['Tous', ...multiFamilies, ...(hasOthers ? ['Autres'] : [])];
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
    if (!this.selectedSupplierId && !this.showCreateSupplier) {
      this.error = 'Veuillez sélectionner un fournisseur ou en créer un nouveau';
      return;
    }

    // Calculate total amount for payment
    this.paymentAmount = this.totalPurchaseAmount;
    
    // Close supplier dialog and show payment choice
    this.showSupplierDialog = false;
    this.showPaymentChoiceDialog = true;
    this.error = '';
  }

  proceedWithPayment(): void {
    this.showPaymentChoiceDialog = false;
    this.partialPaymentAmount = this.totalAmount;
    this.remainingAmount = 0;
    this.showPartialPaymentDialog = true;
  }

  proceedAsCredit(): void {
    this.showPaymentChoiceDialog = false;
    this.createEntryWithCredit();
  }

  createEntryWithCredit(): void {
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

    const supplierId = this.selectedSupplierId;
    const notes = this.notes || undefined;

    this.stockDocs.createEntry(this.depotId, supplierId, payloadItems, notes).subscribe({
      next: (doc) => {
        // Create credit record for the full amount
        this.createFullCreditRecord(supplierId!, this.totalPurchaseAmount, doc.id);
      },
      error: (err) => {
        this.loading = false;
        this.error = err.error?.error || 'Erreur lors de la création du bon d\'entrée';
        // Auto-dismiss error message after 5 seconds
        setTimeout(() => this.error = '', 5000);
      }
    });
  }

  processPayment(): void {
    if (!this.paymentAmount || this.paymentAmount <= 0) {
      this.error = 'Le montant du paiement doit être supérieur à 0';
      return;
    }

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

    const supplierId = this.selectedSupplierId;
    const notes = this.notes || undefined;

    // First create the entry
    this.stockDocs.createEntry(this.depotId, supplierId, payloadItems, notes).subscribe({
      next: (doc) => {
        // Then create the payment
        this.createSupplierPayment(supplierId!, this.paymentAmount, this.paymentMethod, this.paymentNotes, doc.id);
      },
      error: (err) => {
        this.loading = false;
        this.error = err.error?.error || 'Erreur lors de la création du bon d\'entrée';
        // Auto-dismiss error message after 5 seconds
        setTimeout(() => this.error = '', 5000);
      }
    });
  }

  createSupplierPayment(supplierId: number, amount: number, method: string, notes: string, documentId?: number): void {
    const paymentData = {
      supplierId: supplierId,
      amount: amount,
      paymentMethod: (method || 'CASH') as 'CASH'|'CARD'|'CHECK'|'BANK_TRANSFER'|'CREDIT', // Include payment method with proper type
      notes: `${method.toUpperCase()} - ${notes || 'Paiement bon d\'entrée'}`
    };

    this.supplierService.createSupplierPayment(paymentData).subscribe({
      next: (payment) => {
        this.loading = false;
        this.success = `Bon d'entrée créé et paiement de ${amount.toFixed(3)} dt effectué`;
        // Auto-dismiss success message after 3 seconds
        setTimeout(() => this.success = '', 3000);
        this.showPaymentDialog = false;
        this.router.navigate(['/stock/documents']);
      },
      error: (err) => {
        this.loading = false;
        this.error = err.error?.message || 'Erreur lors de la création du paiement';
      }
    });
  }

  cancel(): void {
    this.router.navigate(['/stock']);
  }

  // Supplier dialog methods
  closeSupplierDialog(): void {
    this.showSupplierDialog = false;
    this.selectedSupplierId = null;
    this.notes = '';
    this.showCreateSupplier = false;
    this.newSupplierName = '';
    this.newSupplierPhone = '';
    this.newSupplierEmail = '';
  }

  closePaymentChoiceDialog(): void {
    this.showPaymentChoiceDialog = false;
  }

  closePaymentDialog(): void {
    this.showPaymentDialog = false;
    this.paymentAmount = 0;
    this.paymentMethod = 'cash';
    this.paymentNotes = '';
  }

  // Partial payment methods
  updatePartialPayment(): void {
    this.remainingAmount = this.totalPurchaseAmount - this.partialPaymentAmount;
    if (this.remainingAmount < 0) {
      this.remainingAmount = 0; // No remaining amount if overpaid
    }
  }

  proceedWithPartialPayment(): void {
    if (this.partialPaymentAmount <= 0) {
      this.error = 'Le montant du paiement doit être supérieur à 0';
      return;
    }

    // Always process both payment and credit records
    this.processPartialPayment();
  }

  processPartialPayment(): void {
    this.loading = true;
    this.error = '';
    this.success = '';

    const payloadItems: EntryItemForm[] = this.itemsArray.controls.map((ctrl) => ({
      productId: ctrl.get('productId')?.value || 0,
      famille: ctrl.get('famille')?.value || 'Divers',
      quantity: ctrl.get('quantity')?.value || 0,
      purchasePrice: ctrl.get('unitPrice')?.value || null
    }));

    const supplierId = this.showCreateSupplier ? null : this.selectedSupplierId;
    const notes = this.notes + (supplierId ? `\nSupplier:${supplierId}` : '');

    // Create the entry document first
    this.stockDocs.createEntry(this.depotId, supplierId, payloadItems, notes).subscribe({
      next: (doc) => {
        // Always create both credit record (for bon d'entrée total) and payment record (for amount paid)
        this.createPartialPayment(supplierId!, this.partialPaymentAmount, this.totalPurchaseAmount, doc.id);
      },
      error: (err) => {
        this.loading = false;
        this.error = err.error?.error || 'Erreur lors de la création du bon d\'entrée';
        // Auto-dismiss error message after 5 seconds
        setTimeout(() => this.error = '', 5000);
      }
    });
  }

  createPartialPayment(supplierId: number, paidAmount: number, creditAmount: number, documentId?: number): void {
    // Send the paid amount; backend will normalize sign and handle cash movement
    const paymentData = {
      supplierId: supplierId,
      amount: paidAmount,
      paymentMethod: (this.paymentMethod || 'CASH') as 'CASH'|'CARD'|'CHECK'|'BANK_TRANSFER'|'CREDIT', // Include payment method with proper type
      notes: `Paiement partiel - ${this.paymentMethod.toUpperCase()} - Bon d'entrée #${documentId} (Payé: ${paidAmount.toFixed(3)} dt, Total: ${creditAmount.toFixed(3)} dt)`
    };

    this.supplierService.createSupplierPayment(paymentData).subscribe({
      next: (payment) => {
        this.completePartialPayment(paidAmount, creditAmount);
      },
      error: (err) => {
        this.loading = false;
        this.error = err.error?.message || 'Erreur lors de la création du paiement';
      }
    });
  }


  completePartialPayment(paidAmount: number, creditAmount: number): void {
    this.loading = false;
    this.showPartialPaymentDialog = false;
    
    if (paidAmount > creditAmount) {
      this.success = `Bon d'entrée créé - Paiement: ${paidAmount.toFixed(3)} dt - Crédit: ${creditAmount.toFixed(3)} dt (Surpaiement: ${(paidAmount - creditAmount).toFixed(3)} dt)`;
      // Auto-dismiss success message after 3 seconds
      setTimeout(() => this.success = '', 3000);
    } else if (paidAmount === creditAmount) {
      this.success = `Bon d'entrée créé et paiement complet de ${paidAmount.toFixed(3)} dt effectué`;
      // Auto-dismiss success message after 3 seconds
      setTimeout(() => this.success = '', 3000);
    } else {
      this.success = `Bon d'entrée créé - Paiement: ${paidAmount.toFixed(3)} dt - Crédit: ${creditAmount.toFixed(3)} dt (Reste: ${(creditAmount - paidAmount).toFixed(3)} dt)`;
      // Auto-dismiss success message after 3 seconds
      setTimeout(() => this.success = '', 3000);
    }
    
    this.router.navigate(['/stock/documents']);
  }

  closePartialPaymentDialog(): void {
    this.showPartialPaymentDialog = false;
    this.partialPaymentAmount = 0;
    this.remainingAmount = 0;
  }

  createFullCreditRecord(supplierId: number, creditAmount: number, documentId?: number): void {
    const creditData = {
      supplierId: supplierId,
      amount: -creditAmount, // Negative amount for credit/debt
      paymentMethod: 'CREDIT' as const, // Use CREDIT method to avoid cash deduction
      notes: `Crédit - Bon d'entrée #${documentId}`
    };

    this.supplierService.createSupplierPayment(creditData).subscribe({
      next: (credit) => {
        this.loading = false;
        this.success = `Bon d'entrée créé et crédit de ${creditAmount.toFixed(3)} dt enregistré`;
        // Auto-dismiss success message after 3 seconds
        setTimeout(() => this.success = '', 3000);
        this.router.navigate(['/stock/documents']);
      },
      error: (err) => {
        this.loading = false;
        this.error = err.error?.message || 'Erreur lors de la création du crédit';
      }
    });
  }

  toggleCreateSupplier(): void {
    this.showCreateSupplier = !this.showCreateSupplier;
    if (this.showCreateSupplier) {
      this.selectedSupplierId = null;
    }
  }

  createNewSupplier(): void {
    if (!this.newSupplierName.trim()) {
      this.error = 'Le nom du fournisseur est requis';
      return;
    }

    this.loading = true;
    this.error = '';

    const supplierData = {
      name: this.newSupplierName.trim(),
      phone: this.newSupplierPhone.trim() || undefined,
      email: this.newSupplierEmail.trim() || undefined
    };

    this.supplierService.createSupplier(supplierData).subscribe({
      next: (newSupplier: any) => {
        this.loading = false;
        this.selectedSupplierId = newSupplier.id;
        this.showCreateSupplier = false;
        this.newSupplierName = '';
        this.newSupplierPhone = '';
        this.newSupplierEmail = '';
        // Refresh suppliers list
        this.supplierService.getSuppliers().subscribe({
          next: (suppliers: any[]) => {
            this.suppliers.set(suppliers);
          }
        });
      },
      error: (err: any) => {
        this.loading = false;
        this.error = err.error?.message || 'Erreur lors de la création du fournisseur';
      }
    });
  }

  // UI helpers similar to inventory count
  selectCategory(category: string): void {
    this.selectedCategory.set(category);
  }

  trackByProductId(index: number, product: any): number {
    return product.id;
  }

  getProductCardClass(productId: number): string {
    const baseClass = 'product-button bg-white border border-gray-200 rounded-lg p-2 text-center transition-colors duration-150 cursor-pointer shadow-sm relative select-none';
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
      return `${baseClass} bg-white border-gray-300`;
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
        case 'Boissons':
          return `${baseClass} bg-cyan-500 text-white border-cyan-600 shadow-cyan-200`;
        case 'Vrac':
          return `${baseClass} bg-green-500 text-white border-green-600 shadow-green-200`;
        case 'Jus et Smoothies':
          return `${baseClass} bg-emerald-500 text-white border-emerald-600 shadow-emerald-200`;
        default:
          return `${baseClass} bg-gray-500 text-white border-gray-600 shadow-gray-200`;
      }
    } else {
      // Unselected state - lighter colors
      switch (category) {
        case 'Tous':
          return `${baseClass} bg-blue-50 text-blue-700 border-blue-200`;
        case 'Boissons':
          return `${baseClass} bg-cyan-50 text-cyan-700 border-cyan-200`;
        case 'Vrac':
          return `${baseClass} bg-green-50 text-green-700 border-green-200`;
        case 'Jus et Smoothies':
          return `${baseClass} bg-emerald-50 text-emerald-700 border-emerald-200`;
        default:
          return `${baseClass} bg-gray-50 text-gray-700 border-gray-200`;
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
