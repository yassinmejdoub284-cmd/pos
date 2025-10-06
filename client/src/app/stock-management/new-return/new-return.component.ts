import { Component, OnInit, computed, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, Validators, FormArray, FormGroup, FormControl, AbstractControl } from '@angular/forms';
import { ProductsService } from '../../core/services/products.service';
import { StockDocumentsService } from '../../core/services/stock-documents.service';

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

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private fb: FormBuilder,
    private productsService: ProductsService,
    private stockDocs: StockDocumentsService
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const id = params.get('depotId');
      this.depotId = id ? parseInt(id, 10) : -1;
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

    this.itemSearchCtrl.valueChanges.subscribe((q) => {
      this.searchQuery.set((q || '').toString());
    });
  }

  get itemsArray(): FormArray { return this.form.get('items') as FormArray; }
  get itemSearchCtrl(): FormControl<string> { return this.form.get('itemSearch') as FormControl<string>; }
  asFormControl(control: AbstractControl | null): FormControl<any> { return control as FormControl<any>; }

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
    if (this.itemsArray.length === 0) {
      this.error = 'Ajouter au moins un produit';
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
      quantity: -Math.abs(ctrl.get('quantity')?.value || 0),
      purchasePrice: ctrl.get('unitPrice')?.value || null,
      batch: ctrl.get('batch')?.value || null,
      notes: ctrl.get('notes')?.value || null
    }));

    this.stockDocs.createEntry(this.depotId, null, items, 'Bon de retour').subscribe({
      next: () => {
        this.loading = false;
        this.success = `Bon de retour créé avec succès`;
        setTimeout(() => this.router.navigate(['/stock/documents/bon-entree', this.depotId]), 1500);
      },
      error: (err) => {
        this.loading = false;
        this.error = err.error?.error || 'Erreur lors de la création du bon de retour';
      }
    });
  }

  cancel(): void { this.router.navigate(['/stock/documents/bon-entree', this.depotId]); }
}
