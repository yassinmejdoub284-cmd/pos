import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { StockDocumentsService } from '../../core/services/stock-documents.service';
import { DepotsService } from '../../core/services/depots.service';
import { ProductsService } from '../../core/services/products.service';
import { Depot } from '../../core/models/depot.model';
import { Product, ProductFamily } from '../../core/models/product.model';

@Component({
  selector: 'app-prepare-lot',
  templateUrl: './prepare-lot.component.html',
  standalone: false
})
export class PrepareLotComponent implements OnInit {
  depotType: string = '';
  currentDepot: Depot | null = null;
  availableDepots: Depot[] = [];
  families: ProductFamily[] = [];
  products: Product[] = [];
  inventory: any[] = [];
  form: FormGroup;
  loading = false;
  error = '';

  // Interactive product search
  showProductSearch = false;
  searchStep = 1;
  selectedFamily: ProductFamily | null = null;
  selectedProduct: Product | null = null;
  productQuantity = 1;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private fb: FormBuilder,
    private stockDocumentsService: StockDocumentsService,
    private depotsService: DepotsService,
    private productsService: ProductsService
  ) {
    this.form = this.fb.group({
      emetteurId: [{value: '', disabled: true}, Validators.required],
      destinataireId: ['', Validators.required],
      notes: [''],
      items: this.fb.array([])
    });
  }

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const depotId = params.get('depotId');
      if (depotId) {
        this.loadData(parseInt(depotId, 10));
      }
    });
  }

  loadData(depotId: number): void {
    this.loading = true;
    
    Promise.all([
      this.depotsService.get(depotId).toPromise(),
      this.depotsService.list().toPromise(),
      this.productsService.getFamilles().toPromise(),
      this.productsService.getProducts().toPromise(),
      this.stockDocumentsService.getInventory(depotId).toPromise()
    ]).then(([currentDepot, depots, families, products, inventory]) => {
      if (currentDepot) {
        this.currentDepot = currentDepot;
        this.depotType = currentDepot.type;
        this.form.get('emetteurId')?.setValue(currentDepot.id);
      }
      if (depots) {
        this.availableDepots = depots.filter(d => d.isActive);
        // Auto-select first BRANCH depot as destination
        const firstBranch = this.getDestinations()[0];
        if (firstBranch) {
          this.form.get('destinataireId')?.setValue(firstBranch.id);
        }
      }
      if (families) this.families = families;
      if (products) this.products = products;
      if (inventory) this.inventory = inventory;
      this.loading = false;
    }).catch(() => {
      this.error = 'Erreur lors du chargement des données';
      this.loading = false;
    });
  }

  get items(): FormArray {
    return this.form.get('items') as FormArray;
  }

  addItem(): void {
    const item = this.fb.group({
      famille: ['', Validators.required],
      productId: ['', Validators.required],
      quantity: [1, [Validators.required, Validators.min(1)]]
    });

    this.items.push(item);
  }

  removeItem(index: number): void {
    this.items.removeAt(index);
  }

  onFamilleChange(index: number): void {
    const item = this.items.at(index);
    const famille = item.get('famille')?.value;
    item.patchValue({ productId: '' });
  }

  getProductsByFamille(famille: string): Product[] {
    return this.products.filter(p => p.famille?.name === famille);
  }

  getDestinations(): Depot[] {
    return this.availableDepots.filter(d => d.type === 'BRANCH');
  }

  onSubmit(): void {
    if (this.form.valid && this.items.length > 0) {
      this.loading = true;
      this.error = '';

      const formData = this.form.getRawValue();
      

      
      this.stockDocumentsService.createExpedition(
        formData.emetteurId,
        formData.destinataireId,
        formData.items,
        formData.notes
      ).subscribe({
        next: (document: any) => {
          this.loading = false;
          // Show success message and stay on page
          alert('✅ Lot envoyé avec succès ! En attente de confirmation par le dépôt BRANCH.');
          this.form.reset();
          this.items.clear();
          this.form.get('emetteurId')?.setValue(this.currentDepot?.id);
          // Auto-select first BRANCH depot again
          const firstBranch = this.getDestinations()[0];
          if (firstBranch) {
            this.form.get('destinataireId')?.setValue(firstBranch.id);
          }
        },
        error: (err: any) => {
          this.loading = false;
          this.error = err.error?.error || 'Erreur lors de l\'envoi du lot';
        }
      });
    } else if (this.items.length === 0) {
      this.error = 'Veuillez ajouter au moins un produit au lot';
    }
  }

  goBack(): void {
    this.router.navigate(['/stock']);
  }

  // Interactive product search methods
  startProductSearch(): void {
    this.showProductSearch = true;
    this.searchStep = 1;
    this.resetProductSearch();
  }

  selectFamily(family: ProductFamily): void {
    this.selectedFamily = family;
    this.searchStep = 2;
  }

  selectProduct(product: Product): void {
    this.selectedProduct = product;
    this.searchStep = 3;
  }

  adjustQuantity(change: number): void {
    this.productQuantity = Math.max(1, this.productQuantity + change);
  }

  updateQuantityManually(quantity: number): void {
    this.productQuantity = Math.max(1, quantity);
  }

  addProductToLot(): void {
    if (this.selectedFamily && this.selectedProduct) {
      const availableStock = this.getInventoryForProduct(this.selectedProduct.id);
      
      // Check if product is already in the lot
      const existingItemIndex = this.items.controls.findIndex(
        control => control.get('productId')?.value === this.selectedProduct!.id
      );

      let totalRequestedQuantity = this.productQuantity;
      if (existingItemIndex !== -1) {
        const currentQuantity = this.items.at(existingItemIndex).get('quantity')?.value || 0;
        totalRequestedQuantity += currentQuantity;
      }

      if (totalRequestedQuantity > availableStock) {
        this.error = `Stock insuffisant. Disponible: ${availableStock}, Demandé: ${totalRequestedQuantity}`;
        return;
      }

      if (existingItemIndex !== -1) {
        // Update existing item quantity
        const existingItem = this.items.at(existingItemIndex);
        const currentQuantity = existingItem.get('quantity')?.value || 0;
        existingItem.patchValue({
          quantity: currentQuantity + this.productQuantity
        });
      } else {
        // Add new item
        const item = this.fb.group({
          famille: [this.selectedFamily.name, Validators.required],
          productId: [this.selectedProduct.id, Validators.required],
          quantity: [this.productQuantity, [Validators.required, Validators.min(1)]]
        });

        this.items.push(item);
      }

      this.cancelProductSearch();
    }
  }

  cancelProductSearch(): void {
    this.showProductSearch = false;
    this.resetProductSearch();
  }

  resetProductSearch(): void {
    this.searchStep = 1;
    this.selectedFamily = null;
    this.selectedProduct = null;
    this.productQuantity = 1;
  }

  getProductName(productId: number): string {
    if (!productId || !this.products.length) return 'Chargement...';
    const product = this.products.find(p => p.id === productId);
    return product ? product.name : `Produit ID: ${productId}`;
  }

  getInventoryForProduct(productId: number): number {
    const item = this.inventory.find(i => i.productId === productId);
    return item ? item.quantity : 0;
  }
}
