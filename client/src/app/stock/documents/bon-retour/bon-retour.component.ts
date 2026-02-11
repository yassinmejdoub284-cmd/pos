import { Component, OnInit, computed, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, Validators, FormArray, FormGroup, FormControl, AbstractControl } from '@angular/forms';
import { StockDocumentsService } from '../../../core/services/stock-documents.service';
import { DepotsService } from '../../../core/services/depots.service';
import { ProductsService } from '../../../core/services/products.service';
import { SuppliersService } from '../../../core/services/suppliers.service';
import { AuthService } from '../../../core/services/auth.service';
import { StockDocument, StockDocumentItem } from '../../../core/models/stock-document.model';
import { buildScanLikeDocumentHtmlFromDocument, getScanPrintStyles } from '../../shared/print-templates';
import { Depot } from '../../../core/models/stock-document.model';
import { Product } from '../../../core/models/product.model';
import { Supplier } from '../../../core/models/stock-document.model';

@Component({
  selector: 'app-bon-retour',
  templateUrl: './bon-retour.component.html',
  styleUrls: ['./bon-retour.component.css'],
  standalone: false
})
export class BonRetourComponent implements OnInit {
  depotId: string | null = null;
  documentId: string | null = null;
  document: StockDocument | null = null;
  documents: StockDocument[] = [];
  selectedDocument: StockDocument | null = null;
  loading = false;
  error = '';
  success = '';
  showSuccessNotification = false;
  showErrorNotification = false;
  successMessage = '';
  errorMessage = '';
  isEditMode = false;
  showDocumentDetails = false;
  showDocumentsList = false;

  selectedDepot: Depot | null = null;
  selectedSupplier: Supplier | null = null;
  items: StockDocumentItem[] = [];
  notes = '';

  form!: FormGroup;

  depots: Depot[] = [];
  suppliers: Supplier[] = [];
  products = signal<Product[]>([]);
  inventory = signal<any[]>([]);
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

  showSupplierModal = false;
  showProductModal = false;
  showDepotModal = false;
  supplierSearchQuery = '';

  productCategories: string[] = ['Tous'];
  selectedCategory = signal<string>('Tous');
  currentInput: string = '';
  pendingProduct: any | null = null;
  selectedIndex: number = -1;
  selectedField: 'quantity' | 'unitPrice' | null = null;
  lastEnteredValue: string = '';
  Math = Math;

  get filteredSuppliers(): Supplier[] {
    if (!this.supplierSearchQuery) {
      return this.suppliers;
    }
    const q = this.supplierSearchQuery.toLowerCase();
    return this.suppliers.filter(s => 
      (s.name || '').toLowerCase().includes(q) || 
      (s.phone || '').toLowerCase().includes(q)
    );
  }

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private fb: FormBuilder,
    private stockDocsService: StockDocumentsService,
    private depotsService: DepotsService,
    private productsService: ProductsService,
    private suppliersService: SuppliersService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    const url = this.router.url;
    this.documentId = this.route.snapshot.paramMap.get('documentId');
    const idParam = this.route.snapshot.paramMap.get('id');
    const depotIdParam = this.route.snapshot.paramMap.get('depotId');
    
    if (url.includes('/edit/')) {
      if (this.documentId) {
        this.documentId = this.documentId;
      } else if (idParam) {
        this.documentId = idParam;
      }
    } else {
      if (depotIdParam) {
        this.depotId = depotIdParam;
      } else if (idParam && !isNaN(Number(idParam)) && !url.includes('/edit/')) {
        this.depotId = idParam;
      }
    }
    
    if (!this.depotId && !this.documentId) {
      this.depotId = this.route.snapshot.paramMap.get('depotId');
    }
    
    this.isEditMode = url.includes('/edit/') || !!this.depotId || !!this.documentId;

    this.form = this.fb.group({
      notes: this.fb.control<string>(''),
      itemSearch: this.fb.control<string>(''),
      items: this.fb.array<FormGroup>([])
    });

    this.itemSearchCtrl.valueChanges.subscribe((q) => {
      this.searchQuery.set((q || '').toString());
    });

    this.loadInitialData().then(() => {
      if (this.documentId && this.documentId !== 'new' && url.includes('/edit/')) {
        this.loadDocument();
      } else if (this.depotId && !url.includes('/edit/')) {
        const depot = this.depots.find(d => d.id.toString() === this.depotId);
        if (depot) {
          this.selectedDepot = depot;
          this.isEditMode = true;
          this.loadDocumentsForDepot();
          this.loadInventory();
        } else {
          this.error = 'Dépôt non trouvé';
        }
      } else if (!this.documentId && !this.depotId) {
        this.isEditMode = false;
      }
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

  loadInitialData(): Promise<void> {
    this.loading = true;
    
    const depotFilter = this.depotId ? parseInt(this.depotId, 10) : undefined as any;
    return Promise.all([
      this.depotsService.list().toPromise(),
      this.suppliersService.list().toPromise(),
      this.productsService.getProducts(depotFilter).toPromise()
    ]).then(([depots, suppliers, products]) => {
      this.depots = depots || [];
      this.suppliers = suppliers || [];
      if (products && products.length > 0) {
        this.products.set(products || []);
        const list = products || [];
        const cats = Array.from(new Set(list.map((p: any) => p.famille?.name).filter(Boolean)));
        this.productCategories = ['Tous', ...cats];
      }
      if (this.depotId) {
        const depot = this.depots.find(d => d.id.toString() === this.depotId);
        if (depot) {
          this.selectedDepot = depot;
          this.isEditMode = true;
        }
        this.loadInventory();
      }
      this.loading = false;
    }).catch(error => {
      this.error = 'Erreur lors du chargement des données';
      this.loading = false;
      throw error;
    });
  }

  loadInventory(): void {
    if (!this.depotId) return;
    this.stockDocsService.getInventory(parseInt(this.depotId)).subscribe({
      next: (inventoryData) => {
        this.inventory.set(inventoryData || []);
      },
      error: () => {}
    });
  }

  getCurrentQuantity(productId: number): number {
    const inv = this.inventory();
    const item = inv.find((i: any) => i.productId === productId);
    return item ? parseFloat(item.quantity || 0) : 0;
  }

  loadDocument(): void {
    if (!this.documentId) return;
    
    const docId = parseInt(this.documentId);
    if (isNaN(docId)) {
      this.error = 'ID de document invalide';
      return;
    }
    
    this.loading = true;
    this.error = '';
    this.stockDocsService.getDocument(docId).subscribe({
      next: (doc) => {
        if (!doc) {
          this.error = `Document non trouvé (ID: ${docId})`;
          this.loading = false;
          this.documentId = null;
          return;
        }
        
        if (doc.type !== 'BON_EXPEDITION') {
          this.error = 'Ce document n\'est pas un bon de retour';
          this.loading = false;
          this.documentId = null;
          return;
        }
        
        this.document = doc;
        this.selectedDepot = doc.destinataire || null;
        if (doc.destinataire) {
          this.depotId = doc.destinataire.id.toString();
          this.productsService.getProducts(doc.destinataire.id).subscribe({
            next: (prods) => {
              this.products.set(prods || []);
              const list = prods || [];
              const cats = Array.from(new Set(list.map((p: any) => p.famille?.name).filter(Boolean)));
              this.productCategories = ['Tous', ...cats];
              this.loadInventory();
              
              this.items = doc.items || [];
              this.notes = doc.notes || '';
              this.notesCtrl.setValue(this.notes);
              
              this.itemsArray.clear();
              doc.items?.forEach(item => {
                const product = this.products().find(p => p.id === item.productId);
                const group = this.fb.group({
                  productId: this.fb.control<number>(item.productId, { nonNullable: true, validators: [Validators.required] }),
                  famille: this.fb.control<string>(item.famille || '', { nonNullable: true, validators: [Validators.required] }),
                  quantity: this.fb.control<number>(Math.abs(item.quantity || 0), { nonNullable: true, validators: [Validators.required, Validators.min(0.001)] }),
                  unitPrice: this.fb.control<number | null>(item.purchasePrice || null),
                  batch: this.fb.control<string | null>(item.batch || null),
                  notes: this.fb.control<string | null>(item.notes || null)
                });
                this.itemsArray.push(group);
              });
              
              this.loading = false;
            },
            error: () => {
              this.loading = false;
            }
          });
        } else {
          this.loading = false;
        }
        
        if (doc.supplier) {
          const supplier = doc.supplier;
          const matchingSupplier = this.suppliers.find(s => s.id === supplier.id);
          this.selectedSupplier = matchingSupplier || supplier;
        }
      },
      error: (error) => {
        if (error.status === 404) {
          const idParam = this.route.snapshot.paramMap.get('id');
          if (idParam && !isNaN(Number(idParam)) && !this.route.snapshot.url.some(segment => segment.path === 'edit')) {
            const depotIdNum = Number(idParam);
            const depot = this.depots.find(d => d.id === depotIdNum);
            if (depot) {
              this.depotId = idParam;
              this.documentId = null;
              this.selectedDepot = depot;
              this.loadDocumentsForDepot();
              this.loadInventory();
              this.loading = false;
              this.error = '';
              return;
            }
          }
          this.error = `Document non trouvé (ID: ${docId})`;
          this.documentId = null;
          this.isEditMode = false;
          setTimeout(() => {
            this.router.navigate(['/stock/documents/bon-retour']);
          }, 3000);
        } else {
          this.error = 'Erreur lors du chargement du document: ' + (error.error?.error || error.message || 'Erreur inconnue');
        }
        this.loading = false;
      }
    });
  }

  loadDocumentsForDepot(): void {
    if (!this.depotId) return;
    this.loading = true;
    
    this.stockDocsService.getDocuments(1, 50, 'BON_EXPEDITION', 'RECEIVED', parseInt(this.depotId)).subscribe({
      next: (response) => {
        const allDocs = response?.data || [];
        this.documents = allDocs.filter((d: StockDocument) => d.type === 'BON_EXPEDITION');
        this.loading = false;
      },
      error: (error) => {
        this.error = 'Erreur lors du chargement des documents de retour';
        this.loading = false;
      }
    });
  }

  editDocumentFromList(document: StockDocument): void {
    this.router.navigate(['/stock/documents/bon-retour/edit', document.id]);
  }

  viewDocument(document: StockDocument): void {
    this.loading = true;
    this.stockDocsService.getDocument(document.id).subscribe({
      next: (fullDocument) => {
        this.selectedDocument = fullDocument;
        this.showDocumentDetails = true;
        this.loading = false;
        
        if (fullDocument.supplier) {
          const supplier = this.suppliers.find(s => s.id === fullDocument.supplier!.id);
          this.selectedSupplier = supplier || fullDocument.supplier;
        } else if (fullDocument.notes && fullDocument.notes.includes('Supplier:')) {
          const supplierMatch = fullDocument.notes.match(/Supplier:(\d+)/);
          if (supplierMatch) {
            const supplierId = parseInt(supplierMatch[1]);
            const supplier = this.suppliers.find(s => s.id === supplierId);
            if (supplier) {
              this.selectedSupplier = supplier;
            }
          }
        }
      },
      error: () => {
        this.selectedDocument = document;
        this.showDocumentDetails = true;
        this.loading = false;
        
        if (document.notes && document.notes.includes('Supplier:')) {
          const supplierMatch = document.notes.match(/Supplier:(\d+)/);
          if (supplierMatch) {
            const supplierId = parseInt(supplierMatch[1]);
            const supplier = this.suppliers.find(s => s.id === supplierId);
            if (supplier) {
              this.selectedSupplier = supplier;
            }
          }
        }
      }
    });
  }

  getDocumentTotalAmount(document: StockDocument): number {
    if (!document.items || document.items.length === 0) return 0;
    return document.items.reduce((total, item) => {
      const quantity = Math.abs(item.quantity || 0);
      const price = typeof item.purchasePrice === 'number' ? item.purchasePrice : parseFloat(String(item.purchasePrice || 0));
      return total + (quantity * price);
    }, 0);
  }

  getDocumentSupplierName(document: StockDocument): string {
    if (document.supplier) {
      return document.supplier.name;
    }
    if (document.notes && document.notes.includes('Supplier:')) {
      const supplierMatch = document.notes.match(/Supplier:(\d+)/);
      if (supplierMatch) {
        const supplierId = parseInt(supplierMatch[1]);
        const supplier = this.suppliers.find(s => s.id === supplierId);
        if (supplier) {
          return supplier.name;
        }
      }
    }
    return 'Non spécifié';
  }

  closeDocumentDetails(): void {
    this.showDocumentDetails = false;
    this.selectedDocument = null;
  }

  addItem(product?: any): void {
    if (product) {
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

  removeItem(index: number): void {
    this.itemsArray.removeAt(index);
  }

  selectSupplier(supplier: Supplier): void {
    this.selectedSupplier = supplier;
    this.showSupplierModal = false;
  }

  selectDepot(depot: Depot): void {
    this.selectedDepot = depot;
    this.depotId = depot.id.toString();
    this.showDepotModal = false;
    this.loadInventory();
    this.productsService.getProducts(depot.id).subscribe({
      next: (prods) => {
        this.products.set(prods || []);
        const list = prods || [];
        const cats = Array.from(new Set(list.map((p: any) => p.famille?.name).filter(Boolean)));
        this.productCategories = ['Tous', ...cats];
      },
      error: () => {}
    });
  }

  saveDocument(): void {
    if (!this.selectedDepot) {
      this.error = 'Veuillez sélectionner un dépôt';
      this.errorMessage = 'Veuillez sélectionner un dépôt avant de créer le bon de retour';
      this.showErrorNotification = true;
      setTimeout(() => {
        this.showErrorNotification = false;
        this.error = '';
      }, 3000);
      return;
    }

    if (!this.selectedSupplier) {
      this.error = 'Veuillez sélectionner un fournisseur';
      this.errorMessage = 'La sélection d\'un fournisseur est obligatoire pour créer un bon de retour';
      this.showErrorNotification = true;
      setTimeout(() => {
        this.showErrorNotification = false;
        this.error = '';
      }, 3000);
      return;
    }

    if (this.itemsArray.length === 0) {
      this.error = 'Veuillez ajouter au moins un article';
      this.errorMessage = 'Veuillez ajouter au moins un article avant de créer le bon de retour';
      this.showErrorNotification = true;
      setTimeout(() => {
        this.showErrorNotification = false;
        this.error = '';
      }, 3000);
      return;
    }

    this.loading = true;
    this.error = '';

    const items = this.itemsArray.controls
      .map((ctrl) => {
        const productId = ctrl.get('productId')?.value;
        const quantity = ctrl.get('quantity')?.value;
        const famille = ctrl.get('famille')?.value;
        
        if (!productId || productId <= 0 || !quantity || quantity <= 0) {
          return null;
        }
        
        return {
          productId: parseInt(productId),
          famille: famille || 'Divers',
          quantity: -Math.abs(parseFloat(quantity) || 0),
          purchasePrice: ctrl.get('unitPrice')?.value ? parseFloat(ctrl.get('unitPrice')?.value) : null,
          batch: ctrl.get('batch')?.value || null,
          notes: ctrl.get('notes')?.value || null
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    if (items.length === 0) {
      this.error = 'Veuillez ajouter au moins un article valide';
      this.errorMessage = 'Veuillez ajouter au moins un article valide avant de créer le bon de retour';
      this.showErrorNotification = true;
      this.loading = false;
      setTimeout(() => {
        this.showErrorNotification = false;
        this.error = '';
      }, 3000);
      return;
    }

    const documentData = {
      type: 'BON_EXPEDITION',
      depotId: this.selectedDepot.id,
      supplierId: this.selectedSupplier?.id || null,
      items: items,
      notes: this.notesCtrl.value || this.notes
    };

    if (this.documentId && this.documentId !== 'new') {
      this.stockDocsService.updateDocument(parseInt(this.documentId), documentData).subscribe({
        next: (doc) => {
          this.document = doc;
          this.selectedDocument = doc;
          this.success = 'Document mis à jour avec succès';
          this.successMessage = `Bon de retour #${doc.numero} mis à jour avec succès!`;
          this.showSuccessNotification = true;
          this.loading = false;
          setTimeout(() => {
            this.showSuccessNotification = false;
            this.success = '';
            this.showDocumentDetails = true;
          }, 1500);
        },
        error: (error) => {
          this.error = error.error?.error || 'Erreur lors de la mise à jour du document';
          this.errorMessage = error.error?.error || 'Erreur lors de la mise à jour du document';
          this.showErrorNotification = true;
          this.loading = false;
          setTimeout(() => {
            this.showErrorNotification = false;
            this.error = '';
          }, 4000);
        }
      });
    } else {
      this.stockDocsService.createReturnDocument(documentData).subscribe({
        next: (doc) => {
          this.document = doc;
          this.selectedDocument = doc;
          this.documentId = doc.id.toString();
          this.success = 'Document créé avec succès';
          this.successMessage = `Bon de retour #${doc.numero} créé avec succès!`;
          this.showSuccessNotification = true;
          this.loading = false;
          setTimeout(() => {
            this.showSuccessNotification = false;
            this.success = '';
            this.showDocumentDetails = true;
          }, 1500);
        },
        error: (error) => {
          this.error = error.error?.error || 'Erreur lors de la création du document';
          this.errorMessage = error.error?.error || 'Erreur lors de la création du document';
          this.showErrorNotification = true;
          this.loading = false;
          setTimeout(() => {
            this.showErrorNotification = false;
            this.error = '';
          }, 4000);
        }
      });
    }
  }

  goToConsultation(): void {
    const targetDepotId = this.document?.destinataire?.id || (this.depotId ? parseInt(this.depotId) : null);
    if (targetDepotId) {
      this.router.navigate(['/stock/achat-consultation', 'bon-retour', targetDepotId]);
    }
  }

  printDocument(doc?: StockDocument): void {
    const target = doc || this.document;
    if (!target) return;
    const printContent = buildScanLikeDocumentHtmlFromDocument(target, 'sortie', null);
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      this.error = 'Impossible d\'ouvrir la fenêtre d\'impression';
      return;
    }
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Bon de Retour - ${target.numero}</title>
        <style>${getScanPrintStyles()}</style>
      </head>
      <body>
        ${printContent}
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
  }

  getAbsQuantity(quantity: number): number {
    return Math.abs(quantity);
  }

  getTotalQuantity(): number {
    return this.itemsArray.controls.reduce((total, ctrl) => {
      return total + Math.abs(ctrl.get('quantity')?.value || 0);
    }, 0);
  }

  calculateTotal(): number {
    return this.totalAmount;
  }

  getProductById(productId: number): Product | null {
    return this.products().find(p => p.id === productId) || null;
  }

  onProductSelect(item: StockDocumentItem, product: Product | null): void {
    if (product) {
      const existingIndex = this.itemsArray.controls.findIndex((c) => c.get('productId')?.value === product.id);
      if (existingIndex >= 0) {
        const existingCtrl = this.itemsArray.at(existingIndex) as FormGroup;
        const currentQty = existingCtrl.get('quantity')?.value || 0;
        existingCtrl.get('quantity')!.setValue(currentQty + 1);
      } else {
        const group = this.fb.group({
          productId: this.fb.control<number>(product.id, { nonNullable: true, validators: [Validators.required] }),
          famille: this.fb.control<string>(product.famille?.name || 'Divers', { nonNullable: true, validators: [Validators.required] }),
          quantity: this.fb.control<number>(1, { nonNullable: true, validators: [Validators.required, Validators.min(0.001)] }),
          unitPrice: this.fb.control<number | null>(product.prix_achat || null),
          batch: this.fb.control<string | null>(null),
          notes: this.fb.control<string | null>(null)
        });
        this.itemsArray.push(group);
      }
    }
  }

  goBack(): void {
    this.router.navigate(['/stock']);
  }

  get totalAmount(): number {
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

  getProductFamille(product: Product): string {
    return typeof product.famille === 'string' ? product.famille : product.famille?.name || 'N/A';
  }

  selectCategory(category: string): void {
    this.selectedCategory.set(category);
  }

  trackByProductId(index: number, product: any): number {
    return product.id;
  }

  getProductCardClass(productId: number): string {
    const baseClass = 'product-button bg-white border border-gray-200 rounded-lg p-2 text-center transition-colors duration-150 cursor-pointer shadow-sm relative select-none';
    const isSelected = this.itemsArray.controls.some((c) => c.get('productId')?.value === productId);
    return isSelected ? baseClass + ' border-red-500 bg-red-50' : baseClass;
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

  clearInput(): void { 
    this.currentInput = ''; 
  }

  enterValue(): void {
    const value = parseFloat(this.currentInput);
    if (isNaN(value) || value <= 0) {
      this.error = 'Valeur invalide (> 0)';
      return;
    }
    
    if (this.pendingProduct) {
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
      (this.itemsArray.at(this.selectedIndex) as FormGroup).get(this.selectedField)!.setValue(value);
    }
    
    this.lastEnteredValue = this.currentInput;
    this.currentInput = '';
    this.selectedField = null;
  }

  getFieldClass(index: number, field: 'quantity' | 'unitPrice'): string {
    const isSelected = this.selectedIndex === index && this.selectedField === field;
    const baseClass = 'w-full border rounded px-2 py-1 text-xs text-right cursor-pointer transition-all duration-200';
    
    if (isSelected) {
      return `${baseClass} bg-red-100 border-red-400 shadow-md ring-2 ring-red-300`;
    } else {
      return `${baseClass} bg-white border-gray-300`;
    }
  }

  getProductName(productId: number): string {
    const product = this.products().find(p => p.id === productId);
    return product ? product.name : `Produit #${productId}`;
  }

  getCategoryButtonClass(category: string): string {
    const isSelected = this.selectedCategory() === category;
    const baseClass = 'border-2 shadow-sm';
    
    if (isSelected) {
      switch (category) {
        case 'Tous':
          return `${baseClass} bg-red-500 text-white border-red-600 shadow-red-200`;
        default:
          return `${baseClass} bg-red-500 text-white border-red-600 shadow-red-200`;
      }
    } else {
      switch (category) {
        case 'Tous':
          return `${baseClass} bg-red-50 text-red-700 border-red-200`;
        default:
          return `${baseClass} bg-red-50 text-red-700 border-red-200`;
      }
    }
  }

  formatDate(date: string | Date): string {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleDateString('fr-FR');
  }

  getDocumentTypeLabel(doc: StockDocument): string {
    return 'Bon de Retour';
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'PREPARED':
        return 'Préparé';
      case 'SENT':
        return 'Envoyé';
      case 'RECEIVED':
        return 'Reçu';
      case 'CANCELLED':
        return 'Annulé';
      case 'COMPLETED':
        return 'Terminé';
      default:
        return status;
    }
  }

  startCreate(): void {
    this.resetForm();
    this.isEditMode = true;
    this.documentId = 'new';
  }

  resetForm(): void {
    this.itemsArray.clear();
    this.notesCtrl.setValue('');
    this.selectedSupplier = null;
    this.error = '';
    this.success = '';
  }

  isAdmin(): boolean {
    return this.authService.isAdmin();
  }

  deleteDocument(doc: StockDocument): void {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer le bon de retour ${doc.numero}? Cette action est irréversible et restaurera le stock.`)) {
      return;
    }

    this.loading = true;
    this.error = '';
    this.success = '';

    this.stockDocsService.deleteDocument(doc.id).subscribe({
      next: () => {
        this.success = 'Bon de retour supprimé avec succès';
        this.successMessage = `Bon de retour ${doc.numero} supprimé avec succès!`;
        this.showSuccessNotification = true;
        this.loading = false;
        setTimeout(() => {
          this.showSuccessNotification = false;
          this.success = '';
          this.showDocumentDetails = false;
          this.selectedDocument = null;
          if (this.depotId) {
            this.loadDocumentsForDepot();
          } else if (this.documentId && doc.id === parseInt(this.documentId)) {
            this.router.navigate(['/stock']);
          }
        }, 2000);
      },
      error: (error) => {
        this.error = error.error?.error || 'Erreur lors de la suppression du bon de retour';
        this.errorMessage = error.error?.error || 'Erreur lors de la suppression du bon de retour';
        this.showErrorNotification = true;
        this.loading = false;
        setTimeout(() => {
          this.showErrorNotification = false;
          this.error = '';
        }, 5000);
      }
    });
  }
}
