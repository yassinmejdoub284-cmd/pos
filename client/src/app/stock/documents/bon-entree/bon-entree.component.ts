import { Component, OnInit, computed, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, Validators, FormArray, FormGroup, FormControl, AbstractControl } from '@angular/forms';
import { StockDocumentsService } from '../../../core/services/stock-documents.service';
import { DepotsService } from '../../../core/services/depots.service';
import { ProductsService } from '../../../core/services/products.service';
import { SuppliersService } from '../../../core/services/suppliers.service';
import { SupplierService } from '../../../core/services/supplier.service';
import { AuthService } from '../../../core/services/auth.service';
import { StockDocument, StockDocumentItem } from '../../../core/models/stock-document.model';
import { buildScanLikeDocumentHtmlFromDocument, getScanPrintStyles } from '../../shared/print-templates';
import { Depot } from '../../../core/models/stock-document.model';
import { Product } from '../../../core/models/product.model';
import { Supplier } from '../../../core/models/stock-document.model';

@Component({
  selector: 'app-bon-entree',
  templateUrl: './bon-entree.component.html',
  styleUrls: ['./bon-entree.component.css'],
  standalone: false
})
export class BonEntreeComponent implements OnInit {
  depotId: string | null = null;
  documentId: string | null = null;
  document: StockDocument | null = null;
  documents: StockDocument[] = [];
  selectedDocument: StockDocument | null = null;
  loading = false;
  error = '';
  success = '';
  isEditMode = false;
  showSmartNotification = false;
  smartNotificationMessage = '';
  smartNotificationType: 'success' | 'error' | 'info' = 'success';
  showDocumentDetails = false;
  isReturnsMode = false;
  showDocumentsList = false;

  // Form data
  selectedDepot: Depot | null = null;
  selectedSupplier: Supplier | null = null;
  items: StockDocumentItem[] = [];
  notes = '';
  paymentMethod: 'CREDIT' | 'CASH' = 'CREDIT';

  // Form for new-entry style interface
  form!: FormGroup;

  // Available options
  depots: Depot[] = [];
  suppliers: Supplier[] = [];
  products = signal<Product[]>([]);
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

  // UI state
  showSupplierModal = false;
  showProductModal = false;
  showDepotModal = false;

  // UI state for new-entry style interface
  productCategories: string[] = ['Tous'];
  selectedCategory = signal<string>('Tous');
  currentInput: string = '';
  pendingProduct: any | null = null;
  selectedIndex: number = -1;
  selectedField: 'quantity' | 'unitPrice' | null = null;
  lastEnteredValue: string = '';
  Math = Math;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private fb: FormBuilder,
    private stockDocsService: StockDocumentsService,
    private depotsService: DepotsService,
    private productsService: ProductsService,
    private suppliersService: SuppliersService,
    private supplierService: SupplierService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    // Distinguish params based on route configuration
    this.depotId = this.route.snapshot.paramMap.get('depotId');
    this.documentId = this.route.snapshot.paramMap.get('documentId');
    // Returns mode: when navigating via /stock/documents/bon-retour/:depotId
    const path = this.router.url;
    const showReturnsOnly = path.includes('/stock/documents/bon-retour/');
    this.isReturnsMode = showReturnsOnly;
    
    const url = this.router.url;
    this.isEditMode = url.includes('/edit/') || !!this.depotId || !!this.documentId;

    // Initialize form
    this.form = this.fb.group({
      notes: this.fb.control<string>(''),
      itemSearch: this.fb.control<string>(''),
      items: this.fb.array<FormGroup>([])
    });

    // Subscribe to search changes
    this.itemSearchCtrl.valueChanges.subscribe((q) => {
      this.searchQuery.set((q || '').toString());
    });

    // Load initial data first, then load document if needed
    this.loadInitialData().then(() => {
      if (this.documentId && this.documentId !== 'new') {
        // Load document for editing
        this.loadDocument();
      } else if (this.depotId) {
        // If we have depotId, show the new-entry interface
        // Set selected depot from depotId
        const depot = this.depots.find(d => d.id.toString() === this.depotId);
        if (depot) {
          this.selectedDepot = depot;
        }
        // Load documents list for this depot (will be shown when user clicks the toggle button)
        this.loadDocumentsForDepot(showReturnsOnly);
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
      this.products.set(products || []);
      // Build categories
      const list = products || [];
      const cats = Array.from(new Set(list.map((p: any) => p.famille?.name).filter(Boolean)));
      this.productCategories = ['Tous', ...cats];
      this.loading = false;
    }).catch(error => {
      this.error = 'Erreur lors du chargement des données';
      this.loading = false;
      throw error;
    });
  }

  loadDocument(): void {
    if (!this.documentId) return;
    
    this.loading = true;
    this.stockDocsService.getDocument(parseInt(this.documentId)).subscribe({
      next: (doc) => {
        this.document = doc;
        this.selectedDepot = doc.destinataire || null;
        // Set depotId from document for product loading
        if (doc.destinataire) {
          this.depotId = doc.destinataire.id.toString();
          // Reload products for this depot
          this.productsService.getProducts(doc.destinataire.id).subscribe({
            next: (prods) => {
              this.products.set(prods || []);
              // Build categories
              const list = prods || [];
              const cats = Array.from(new Set(list.map((p: any) => p.famille?.name).filter(Boolean)));
              this.productCategories = ['Tous', ...cats];
            },
            error: () => {}
          });
        }
        
        // Automatically set supplier from document
        if (doc.supplier) {
          // Find matching supplier from the suppliers list
          const supplier = doc.supplier;
          const matchingSupplier = this.suppliers.find(s => s.id === supplier.id);
          this.selectedSupplier = matchingSupplier || supplier;
        } else {
          // Try to extract supplier from notes if not in document
          if (doc.notes) {
            const supplierMatch = doc.notes.match(/Supplier:(\d+)/);
            if (supplierMatch) {
              const supplierId = parseInt(supplierMatch[1]);
              const matchingSupplier = this.suppliers.find(s => s.id === supplierId);
              if (matchingSupplier) {
                this.selectedSupplier = matchingSupplier;
              }
            }
          }
        }
        
        this.items = doc.items || [];
        this.notes = doc.notes || '';
        this.notesCtrl.setValue(this.notes);
        
        // Convert items to FormArray
        this.itemsArray.clear();
        doc.items?.forEach(item => {
          const product = this.products().find(p => p.id === item.productId);
          const group = this.fb.group({
            productId: this.fb.control<number>(item.productId, { nonNullable: true, validators: [Validators.required] }),
            famille: this.fb.control<string>(item.famille || '', { nonNullable: true, validators: [Validators.required] }),
            quantity: this.fb.control<number>(item.quantity || 0, { nonNullable: true, validators: [Validators.required, Validators.min(0.001)] }),
            unitPrice: this.fb.control<number | null>(item.purchasePrice || null),
            batch: this.fb.control<string | null>(item.batch || null),
            notes: this.fb.control<string | null>(item.notes || null)
          });
          this.itemsArray.push(group);
        });
        
        // Load parent products for items that have parentProductId
        this.loadParentProductsForItems();
        
        this.loading = false;
      },
      error: (error) => {
        this.error = 'Erreur lors du chargement du document';
        this.loading = false;
      }
    });
  }

  private loadParentProductsForItems(): void {
    if (!this.items || this.items.length === 0) return;
    
    // Get unique parent product IDs
    const parentProductIds = [...new Set(this.items
      .filter(item => (item as any).parentProductId)
      .map(item => (item as any).parentProductId)
    )];
    
    if (parentProductIds.length === 0) return;
    
    // Load parent products
    this.productsService.getProducts().subscribe({
      next: (allProducts) => {
        const parentProducts = allProducts.filter(p => parentProductIds.includes(p.id));
        
        // Update items to use parent product data
        this.items.forEach(item => {
          const parentProductId = (item as any).parentProductId;
          if (parentProductId) {
            const parentProduct = parentProducts.find(p => p.id === parentProductId);
            if (parentProduct) {
              // Replace the child product with parent product for display
              (item as any).product = parentProduct;
              (item as any).productId = parentProductId; // Update productId to parent ID for consistency
            }
          }
        });
      },
      error: (error) => {
        console.error('Error loading parent products:', error);
      }
    });
  }

  loadDocumentsForDepot(returnsOnly: boolean = false): void {
    if (!this.depotId) return;
    this.loading = true;
    
    // Load all document types for this depot with RECEIVED status
    this.stockDocsService.getDocuments(1, 50, undefined, 'RECEIVED', parseInt(this.depotId)).subscribe({
      next: (response) => {
        const allDocs = response?.data || [];
        
        this.documents = returnsOnly
          ? allDocs.filter((d: StockDocument) => this.isReturnDocument(d))
          : allDocs.filter((d: StockDocument) => !this.isReturnDocument(d));
        
        // Load parent products for all document items
        this.loadParentProductsForAllDocuments();
        
        this.loading = false;
      },
      error: (error) => {
        this.error = 'Erreur lors du chargement des documents';
        this.loading = false;
      }
    });
  }

  private loadParentProductsForAllDocuments(): void {
    if (!this.documents || this.documents.length === 0) return;
    
    // Get unique parent product IDs from all documents
    const parentProductIds = new Set<number>();
    this.documents.forEach(doc => {
      if (doc.items) {
        doc.items.forEach(item => {
          const parentProductId = (item as any).parentProductId;
          if (parentProductId) {
            parentProductIds.add(parentProductId);
          }
        });
      }
    });
    
    if (parentProductIds.size === 0) return;
    
    // Load parent products
    this.productsService.getProducts().subscribe({
      next: (allProducts) => {
        const parentProducts = allProducts.filter(p => parentProductIds.has(p.id));
        
        // Update all document items to use parent product data
        this.documents.forEach(doc => {
          if (doc.items) {
            doc.items.forEach(item => {
              const parentProductId = (item as any).parentProductId;
              if (parentProductId) {
                const parentProduct = parentProducts.find(p => p.id === parentProductId);
                if (parentProduct) {
                  // Replace the child product with parent product for display
                  (item as any).product = parentProduct;
                  (item as any).productId = parentProductId; // Update productId to parent ID for consistency
                }
              }
            });
          }
        });
      },
      error: (error) => {
        console.error('Error loading parent products for documents:', error);
      }
    });
  }

  editDocumentFromList(document: StockDocument): void {
    this.router.navigate(['/stock/documents/bon-entree/edit', document.id]);
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

  startCreate(): void {
    this.isEditMode = true;
    this.documentId = 'new';
    this.document = null;
    this.selectedDepot = null;
    this.selectedSupplier = null;
    this.items = [];
    this.notes = '';
    this.error = '';
    this.success = '';
  }

  cancelCreate(): void {
    this.isEditMode = false;
    this.error = '';
    this.success = '';
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
    } else {
      // Legacy method for backward compatibility
      this.items.push({
        id: 0,
        documentId: 0,
        productId: 0,
        famille: '',
        quantity: 1,
        purchasePrice: 0,
        batch: '',
        notes: '',
        barcode: undefined
      });
    }
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

  selectProduct(item: StockDocumentItem, product: Product): void {
    item.productId = product.id;
    item.famille = typeof product.famille === 'string' ? product.famille : product.famille?.name || '';
    item.product = product as any; // Cast to avoid type mismatch
    this.showProductModal = false;
  }

  selectSupplier(supplier: Supplier): void {
    this.selectedSupplier = supplier;
    this.showSupplierModal = false;
  }

  selectDepot(depot: Depot): void {
    this.selectedDepot = depot;
    this.showDepotModal = false;
  }

  saveDocument(): void {
    if (!this.selectedDepot || this.itemsArray.length === 0) {
      this.error = 'Veuillez sélectionner un dépôt et ajouter au moins un article';
      return;
    }

    if (!this.selectedSupplier) {
      this.error = 'Veuillez sélectionner un fournisseur';
      this.showSupplierModal = true;
      return;
    }

    this.loading = true;
    this.error = '';

    // Convert FormArray items to document items, filtering out invalid items
    const items = this.itemsArray.controls
      .map((ctrl) => {
        const productId = ctrl.get('productId')?.value;
        const quantity = ctrl.get('quantity')?.value;
        const famille = ctrl.get('famille')?.value;
        
        // Skip items with invalid productId or quantity
        if (!productId || productId <= 0 || !quantity || quantity <= 0) {
          return null;
        }
        
        return {
          productId: parseInt(productId),
          famille: famille || 'Divers',
          quantity: parseFloat(quantity) || 0,
          purchasePrice: ctrl.get('unitPrice')?.value ? parseFloat(ctrl.get('unitPrice')?.value) : null,
          batch: ctrl.get('batch')?.value || null,
          notes: ctrl.get('notes')?.value || null
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    // Validate we still have items after filtering
    if (items.length === 0) {
      this.error = 'Veuillez ajouter au moins un article valide';
      this.loading = false;
      return;
    }

    const documentData = {
      depotId: this.selectedDepot.id,
      supplierId: this.selectedSupplier?.id || null,
      items: items,
      notes: this.notesCtrl.value || this.notes
    };

    if (this.documentId && this.documentId !== 'new') {
      this.stockDocsService.updateDocument(parseInt(this.documentId), documentData).subscribe({
        next: (doc) => {
          this.document = doc;
          this.loading = false;
          this.showSmartNotificationMessage('success', `Bon d'entrée #${doc.numero} mis à jour avec succès`);
          setTimeout(() => {
            this.router.navigate(['/stock/documents/bon-entree/edit', doc.id]);
          }, 1500);
        },
        error: (error) => {
          this.loading = false;
          this.showSmartNotificationMessage('error', error.error?.error || 'Erreur lors de la mise à jour du document');
        }
      });
    } else {
      // Create new document
      this.stockDocsService.createEntry(
        documentData.depotId,
        documentData.supplierId,
        documentData.items,
        documentData.notes
      ).subscribe({
        next: (doc) => {
          this.document = doc;
          
          if (documentData.supplierId && this.selectedSupplier && this.totalAmount > 0) {
            this.createSupplierPayment(documentData.supplierId, this.totalAmount, doc);
          } else {
            this.loading = false;
            this.showSmartNotificationMessage('success', `Bon d'entrée #${doc.numero} créé avec succès`);
            setTimeout(() => {
              this.router.navigate(['/stock/documents/bon-entree/edit', doc.id]);
            }, 1500);
          }
        },
        error: (error) => {
          this.loading = false;
          const errorMessage = error.error?.error || error.message || 'Erreur lors de la création du document';
          this.showSmartNotificationMessage('error', errorMessage);
        }
      });
    }
  }

  goToConsultation(): void {
    const targetDepotId = this.document?.destinataire?.id || (this.depotId ? parseInt(this.depotId) : null);
    if (targetDepotId) {
      const actionType = this.isReturnsMode ? 'bon-retour' : 'entry';
      this.router.navigate(['/stock/achat-consultation', actionType, targetDepotId]);
    }
  }

  printDocument(doc?: StockDocument): void {
    const target = doc || this.document;
    if (!target) return;
    // Show as actual "Bon d'entrée" with TTC-based pricing
    const printContent = buildScanLikeDocumentHtmlFromDocument(target, 'entree', null);
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      this.error = 'Impossible d\'ouvrir la fenêtre d\'impression';
      return;
    }
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Bon d'Entrée - ${target.numero}</title>
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

  goBack(): void {
    this.router.navigate(['/stock']);
  }

  getTotalQuantity(items?: any[] | undefined): number {
    const source = items ?? this.items;
    if (!source || source.length === 0) return 0;
    const total = source.reduce((sum, item: any) => {
      const quantity = Number(item.quantity) || 0;
      return sum + quantity;
    }, 0);
    return Math.round(total * 1000) / 1000;
  }

  getTotalCount(items?: any[] | undefined): number {
    const source = items ?? this.items;
    if (!source || source.length === 0) return 0;
    return source.reduce((sum, item: any) => {
      const count = Number(item['count']) || 0;
      return sum + count;
    }, 0);
  }

  getTotalValue(): number {
    if (this.itemsArray && this.itemsArray.length > 0) {
      return this.itemsArray.controls.reduce((total, ctrl) => {
        const quantity = ctrl.get('quantity')?.value || 0;
        const unitPrice = ctrl.get('unitPrice')?.value || 0;
        return total + (quantity * unitPrice);
      }, 0);
    }
    return this.items.reduce((total, item) => {
      const quantity = item.quantity || 0;
      const price = item.purchasePrice || 0;
      return total + (quantity * price);
    }, 0);
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

  // Keypad methods
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

  formatDate(date: string | Date): string {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleDateString('fr-FR');
  }

  // Helpers to distinguish returns vs entries
  isReturnDocument(doc: StockDocument): boolean {
    // Check if it's a BON_EXPEDITION type (which is used for returns in the backend)
    return doc.type === 'BON_EXPEDITION';
  }

  getDocumentTypeLabel(doc: StockDocument): string {
    if (this.isReturnDocument(doc)) return 'Bon de Retour';
    switch (doc.type) {
      case 'BON_ENTREE_DEPOT':
        return 'Bon d\'Entrée';
      case 'BON_ENTREE_MAGASIN':
        return 'Bon d\'Entrée magasin';
      case 'BON_EXPEDITION':
        return 'Bon d\'expédition';
      case 'BON_TRANSFERT':
        return 'Bon de transfert';
      case 'FACTURE':
        return 'Facture approuvée';
      default:
        return doc.type as any;
    }
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

  // Group items by parent product for display
  getGroupedItems(items: any[]): any[] {
    if (!items || items.length === 0) return [];
    
    const grouped = new Map<number, any>();
    
    items.forEach(item => {
      const parentProductId = (item as any).parentProductId || item.productId;
      const parentProduct = (item as any).product;
      
      if (grouped.has(parentProductId)) {
        // Add to existing group
        const group = grouped.get(parentProductId);
        group.quantity += parseFloat(item.quantity) || 0;
        group.count += parseInt(item.count) || 1;
        group.childItems.push(item);
      } else {
        // Create new group
        grouped.set(parentProductId, {
          productId: parentProductId,
          product: parentProduct,
          quantity: parseFloat(item.quantity) || 0,
          count: parseInt(item.count) || 1,
          childItems: [item]
        });
      }
    });
    
    return Array.from(grouped.values());
  }

  isAdmin(): boolean {
    return this.authService.isAdmin();
  }

  createSupplierPayment(supplierId: number, amount: number, doc: StockDocument): void {
    if (!amount || amount <= 0) {
      this.success = 'Document créé avec succès';
      this.loading = false;
      setTimeout(() => this.success = '', 3000);
      this.router.navigate(['/stock/documents/bon-entree/edit', doc.id]);
      return;
    }

    const paymentData = {
      supplierId: supplierId,
      amount: this.paymentMethod === 'CASH' ? amount : -amount, // Negative for credit (debt), positive for cash payment
      paymentMethod: this.paymentMethod,
      notes: `Bon d'entrée #${doc.numero} - Montant: ${amount.toFixed(3)} dt`
    };

    this.supplierService.createSupplierPayment(paymentData).subscribe({
      next: (payment) => {
        this.loading = false;
        const paymentText = this.paymentMethod === 'CASH' ? ' - Paiement en espèces enregistré' : ' - Crédit enregistré';
        this.showSmartNotificationMessage('success', `Bon d'entrée #${doc.numero} créé avec succès${paymentText}`);
        setTimeout(() => {
          this.router.navigate(['/stock/documents/bon-entree/edit', doc.id]);
        }, 1500);
      },
      error: (error) => {
        this.loading = false;
        this.showSmartNotificationMessage('success', `Bon d'entrée #${doc.numero} créé avec succès (Erreur lors de l'enregistrement du paiement)`);
        setTimeout(() => {
          this.router.navigate(['/stock/documents/bon-entree/edit', doc.id]);
        }, 1500);
      }
    });
  }

  showSmartNotificationMessage(type: 'success' | 'error' | 'info', message: string): void {
    this.smartNotificationType = type;
    this.smartNotificationMessage = message;
    this.showSmartNotification = true;
    setTimeout(() => {
      this.hideSmartNotification();
    }, 4000);
  }

  hideSmartNotification(): void {
    this.showSmartNotification = false;
    this.smartNotificationMessage = '';
  }

  deleteDocument(doc: StockDocument): void {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer le document ${doc.numero}? Cette action est irréversible et remboursera le stock.`)) {
      return;
    }

    this.loading = true;
    this.error = '';
    this.success = '';

    this.stockDocsService.deleteDocument(doc.id).subscribe({
      next: () => {
        this.success = 'Document supprimé avec succès';
        this.loading = false;
        setTimeout(() => {
          this.success = '';
          // Reload documents list
          if (this.depotId) {
            this.loadDocumentsForDepot(this.isReturnsMode);
          } else if (this.documentId && doc.id === parseInt(this.documentId)) {
            // If we deleted the currently viewed document, go back
            this.router.navigate(['/stock']);
          }
        }, 2000);
      },
      error: (error) => {
        this.error = error.error?.error || 'Erreur lors de la suppression du document';
        this.loading = false;
        setTimeout(() => this.error = '', 5000);
      }
    });
  }
}
