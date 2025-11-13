import { Component, OnInit, computed, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, Validators, FormArray, FormGroup, FormControl, AbstractControl } from '@angular/forms';
import { ProductsService } from '../../core/services/products.service';
import { StockDocumentsService } from '../../core/services/stock-documents.service';
import { SuppliersService } from '../../core/services/suppliers.service';
import { Supplier } from '../../core/models/supplier.model';

interface ReturnItemForm {
  productId: number;
  famille: string;
  quantity: number;
  purchasePrice?: number | null;
  batch?: string | null;
  notes?: string | null;
}

@Component({
  selector: 'app-new-return',
  templateUrl: 'new-return.component.html',
  standalone: false
})
export class NewReturnComponent implements OnInit {
  depotId = -1;
  loading = false;
  error = '';
  success = '';

  products = signal<any[]>([]);
  inventory = signal<any[]>([]);
  suppliers = signal<Supplier[]>([]);
  selectedSupplierId: number | null = null;
  showSupplierModal = false;
  
  private searchQuery = signal<string>('');
  filteredProducts = computed(() => {
    const all = this.products();
    const q = (this.searchQuery() || '').toLowerCase();
    if (!q) return all;
    return all.filter((p) => (p.name || '').toLowerCase().includes(q) || (p.barcode || '').toLowerCase().includes(q));
  });

  form!: FormGroup;
  selectedIndex: number = -1;
  selectedField: 'quantity' | 'unitPrice' | null = null;
  pendingProduct: any | null = null;
  currentInput = '';

  getProductName(productId: number): string {
    const product = this.products().find(p => p.id === productId);
    return product ? (product.name || `Produit #${productId}`) : `Produit #${productId}`;
  }

  getProductStock(productId: number): number {
    const invItem = this.inventory().find(item => item.productId === productId);
    return invItem ? parseFloat(invItem.quantity || 0) : 0;
  }

  getSelectedSupplierName(): string {
    if (!this.selectedSupplierId) return 'Non sélectionné';
    const supplier = this.suppliers().find(s => s.id === this.selectedSupplierId);
    return supplier ? supplier.name : 'Non sélectionné';
  }

  getTotalQuantity(): number {
    return this.itemsArray.controls.reduce((total, ctrl) => {
      const quantity = ctrl.get('quantity')?.value || 0;
      return total + (Number(quantity) || 0);
    }, 0);
  }

  getTotalAmount(): number {
    return this.itemsArray.controls.reduce((total, ctrl) => {
      const quantity = ctrl.get('quantity')?.value || 0;
      const price = ctrl.get('unitPrice')?.value || 0;
      return total + (Number(quantity) || 0) * (Number(price) || 0);
    }, 0);
  }

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private fb: FormBuilder,
    private productsService: ProductsService,
    private stockDocs: StockDocumentsService,
    private suppliersService: SuppliersService
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const id = params.get('depotId');
      this.depotId = id ? parseInt(id, 10) : -1;
      if (this.depotId > 0) {
        this.loadInventory();
      }
    });

    this.form = this.fb.group({
      itemSearch: this.fb.control<string>(''),
      items: this.fb.array<FormGroup>([])
    });

    const filterDepotId: number | undefined = this.depotId > 0 ? this.depotId : undefined;
    this.productsService.getProducts(filterDepotId).subscribe({
      next: (prods) => {
        this.products.set(prods || []);
      },
      error: () => {
        this.error = 'Erreur chargement produits';
      }
    });

    this.suppliersService.list().subscribe({
      next: (suppliers) => {
        this.suppliers.set(suppliers || []);
      },
      error: () => {
        this.error = 'Erreur chargement fournisseurs';
      }
    });

    this.itemSearchCtrl.valueChanges.subscribe((q) => {
      this.searchQuery.set((q || '').toString());
    });
  }

  loadInventory(): void {
    this.stockDocs.getInventory(this.depotId).subscribe({
      next: (inv) => {
        this.inventory.set(inv || []);
      },
      error: () => {
        this.error = 'Erreur chargement inventaire';
      }
    });
  }

  selectSupplier(supplierId: number): void {
    this.selectedSupplierId = supplierId;
    this.showSupplierModal = false;
  }

  openSupplierModal(): void {
    this.showSupplierModal = true;
  }

  closeSupplierModal(): void {
    this.showSupplierModal = false;
  }

  get itemsArray(): FormArray { return this.form.get('items') as FormArray; }
  get itemSearchCtrl(): FormControl<string> { return this.form.get('itemSearch') as FormControl<string>; }
  asFormControl(control: AbstractControl | null): FormControl<any> { return control as FormControl<any>; }

  addItem(product: any): void {
    const availableStock = this.getProductStock(product.id);
    const group = this.fb.group({
      productId: this.fb.control<number>(product.id, { nonNullable: true, validators: [Validators.required] }),
      famille: this.fb.control<string>(product.famille?.name || 'Divers', { nonNullable: true, validators: [Validators.required] }),
      quantity: this.fb.control<number>(Math.min(1, availableStock), { 
        nonNullable: true, 
        validators: [Validators.required, Validators.min(0.001), Validators.max(availableStock)] 
      }),
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
    const existingIndex = this.itemsArray.controls.findIndex((c) => c.get('productId')?.value === product.id);
    if (existingIndex >= 0) {
      const existingCtrl = this.itemsArray.at(existingIndex) as FormGroup;
      const currentQty = existingCtrl.get('quantity')?.value || 0;
      existingCtrl.get('quantity')!.setValue(currentQty + 1);
      this.selectedIndex = existingIndex;
      this.selectedField = 'quantity';
    } else {
      this.pendingProduct = product;
      this.currentInput = '';
      this.addItem(product);
    }
  }

  removeItem(index: number): void { this.itemsArray.removeAt(index); }

  submit(): void {
    if (!this.selectedSupplierId) {
      this.error = 'Veuillez sélectionner un fournisseur';
      return;
    }

    if (this.itemsArray.length === 0) {
      this.error = 'Veuillez ajouter au moins un produit à retourner';
      return;
    }

    // Validate that all items have quantities and stock availability
    const invalidItems = this.itemsArray.controls.filter(ctrl => {
      const quantity = ctrl.get('quantity')?.value;
      const productId = ctrl.get('productId')?.value;
      const availableStock = this.getProductStock(productId);
      return !quantity || Number(quantity) <= 0 || Number(quantity) > availableStock;
    });

    if (invalidItems.length > 0) {
      this.error = 'Certains produits ont des quantités invalides ou dépassent le stock disponible';
      return;
    }

    this.createReturn();
  }

  private createReturn(): void {
    this.loading = true;
    this.error = '';
    this.success = '';

    const items: ReturnItemForm[] = this.itemsArray.controls.map((ctrl) => ({
      productId: ctrl.get('productId')?.value || 0,
      famille: ctrl.get('famille')?.value || 'Divers',
      quantity: Math.abs(ctrl.get('quantity')?.value || 0),
      purchasePrice: ctrl.get('unitPrice')?.value || null,
      batch: ctrl.get('batch')?.value || null,
      notes: ctrl.get('notes')?.value || null
    }));

    this.stockDocs.createReturnDocument({
      depotId: this.depotId,
      supplierId: this.selectedSupplierId,
      items: items,
      notes: `Bon de retour vers ${this.getSelectedSupplierName()}`
    }).subscribe({
      next: () => {
        this.loading = false;
        this.success = `Bon de retour créé avec succès - Les quantités ont été soustraites de l'inventaire et le débit a été ajouté au relevé du fournisseur`;
        setTimeout(() => this.router.navigate(['/stock/documents/bon-retour', this.depotId]), 1500);
      },
      error: (err) => {
        this.loading = false;
        this.error = err.error?.error || 'Erreur lors de la création du bon de retour';
      }
    });
  }

  cancel(): void { this.router.navigate(['/stock/documents/bon-retour', this.depotId]); }
}
