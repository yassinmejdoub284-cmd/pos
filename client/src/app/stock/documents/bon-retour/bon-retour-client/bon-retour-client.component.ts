import { Component, OnInit, computed, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, Validators, FormArray, FormGroup, FormControl, AbstractControl } from '@angular/forms';
import { StockDocumentsService } from '../../../../core/services/stock-documents.service';
import { DepotsService } from '../../../../core/services/depots.service';
import { ProductsService } from '../../../../core/services/products.service';
import { ClientsService } from '../../../../core/services/clients.service';
import { AuthService } from '../../../../core/services/auth.service';
import { StockDocument, StockDocumentItem, Depot } from '../../../../core/models/stock-document.model';
import { Product } from '../../../../core/models/product.model';
import { Client } from '../../../../core/models/client.model';

@Component({
    selector: 'app-bon-retour-client',
    templateUrl: './bon-retour-client.component.html',
    styleUrls: ['./bon-retour-client.component.css'],
    standalone: false
})
export class BonRetourClientComponent implements OnInit {
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

    selectedDepot: Depot | null = null;
    selectedClient = signal<Client | null>(null);
    clientPrices = signal<any[]>([]);
    items: StockDocumentItem[] = [];
    notes = '';

    form!: FormGroup;

    depots: Depot[] = [];
    clients: Client[] = [];
    clientSearchQuery = signal<string>('');
    clientLetterFilter = signal<string>(''); // Filter by first letter
    filteredClients = computed(() => {
        const all = this.clients;
        const q = (this.clientSearchQuery() || '').toLowerCase();
        const letter = this.clientLetterFilter();
        
        let result = all;
        
        // Filter by search query
        if (q) {
            result = result.filter((c) => 
                (c.firstName || '').toLowerCase().includes(q) || 
                (c.lastName || '').toLowerCase().includes(q) ||
                (c.phone || '').toLowerCase().includes(q) ||
                (c.code || '').toLowerCase().includes(q)
            );
        }
        
        // Filter by first letter
        if (letter) {
            result = result.filter((c) => 
                (c.firstName || '').toUpperCase().startsWith(letter) ||
                (c.lastName || '').toUpperCase().startsWith(letter)
            );
        }
        
        return result;
    });
    products = signal<Product[]>([]);
    inventory = signal<any[]>([]);
    private searchQuery = signal<string>('');
    filteredProducts = computed(() => {
        const all = this.products();
        const q = (this.searchQuery() || '').toLowerCase();
        const selected = this.selectedCategory();
        const client = this.selectedClient(); // Get client from signal
        const prices = this.clientPrices(); // Get prices from signal
        
        let result = all;
        if (selected && selected !== 'Tous') {
            result = result.filter((p) => (p.famille?.name || '').toLowerCase() === selected.toLowerCase());
        }
        if (q) {
            result = result.filter((p) => (p.name || '').toLowerCase().includes(q) || (p.barcode || '').toLowerCase().includes(q));
        }

        // Sort products: wholesale (gros) prices first when client is selected
        if (client && prices.length > 0) {
            // Create a copy to avoid mutating the original array
            result = [...result].sort((a, b) => {
                const aHasClientPrice = this.hasClientPrice(a);
                const bHasClientPrice = this.hasClientPrice(b);
                
                // Products with client prices (gros) come FIRST
                if (aHasClientPrice && !bHasClientPrice) return -1;
                if (!aHasClientPrice && bHasClientPrice) return 1;
                
                // If both have or both don't have client prices, sort alphabetically
                return (a.name || '').localeCompare(b.name || '');
            });
        }

        return result;
    });

    showClientModal = false;
    showDepotModal = false;

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
        private clientsService: ClientsService,
        private authService: AuthService
    ) { }

    ngOnInit(): void {
        const url = this.router.url;
        this.documentId = this.route.snapshot.paramMap.get('documentId');
        const idParam = this.route.snapshot.paramMap.get('id');
        const depotIdParam = this.route.snapshot.paramMap.get('depotId');

        if (url.includes('/edit/')) {
            this.documentId = this.documentId || idParam;
        } else {
            this.depotId = depotIdParam || (idParam && !isNaN(Number(idParam)) ? idParam : null);
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
            } else if (this.depotId) {
                const depot = this.depots.find(d => d.id.toString() === this.depotId);
                if (depot) {
                    this.selectedDepot = depot;
                    this.loadInventory();
                }
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

    async loadInitialData(): Promise<void> {
        this.loading = true;
        const depotFilter = this.depotId ? parseInt(this.depotId, 10) : undefined;

        try {
            const [depots, clientsRes, products] = await Promise.all([
                this.depotsService.list().toPromise(),
                this.clientsService.getClients(1, 1000).toPromise(),
                this.productsService.getProducts(depotFilter).toPromise()
            ]);

            this.depots = depots || [];
            
            // Sort clients alphabetically by first name
            const allClients = (clientsRes as any)?.clients || [];
            this.clients = allClients.sort((a: any, b: any) => {
                return (a.firstName || '').localeCompare(b.firstName || '');
            });
            
            if (products && products.length > 0) {
                this.products.set(products || []);
                const cats = Array.from(new Set(products.map((p: any) => p.famille?.name).filter(Boolean)));
                this.productCategories = ['Tous', ...(cats as string[])];
            }

            if (this.depotId) {
                const depot = this.depots.find(d => d.id.toString() === this.depotId);
                if (depot) {
                    this.selectedDepot = depot;
                    this.loadInventory();
                }
            }
        } catch (error) {
            this.error = 'Erreur lors du chargement des données';
        } finally {
            this.loading = false;
        }
    }

    loadInventory(): void {
        if (!this.selectedDepot) return;
        this.stockDocsService.getInventory(this.selectedDepot.id).subscribe({
            next: (inventoryData: any) => {
                this.inventory.set(inventoryData || []);
            },
            error: () => { }
        });
    }

    getCurrentQuantity(productId: number): number {
        const inv = this.inventory();
        const item = inv.find((i: any) => i.productId === productId);
        return item ? parseFloat(item.quantity || 0) : 0;
    }

    loadDocument(): void {
        if (!this.documentId) return;
        this.loading = true;
        this.stockDocsService.getDocument(parseInt(this.documentId)).subscribe({
            next: (doc: StockDocument) => {
                if (!doc || doc.type !== 'BON_EXPEDITION') {
                    this.error = 'Document invalide';
                    this.loading = false;
                    return;
                }
                this.document = doc;
                this.selectedDepot = doc.emetteur || null;
                this.selectedClient.set((doc.client as unknown as Client) || null);
                const client = this.selectedClient();
                if (client) {
                    this.loadClientPrices(client.id);
                }

                this.itemsArray.clear();
                doc.items?.forEach((item: any) => {
                    this.itemsArray.push(this.fb.group({
                        productId: [item.productId, Validators.required],
                        famille: [item.famille || 'Divers', Validators.required],
                        quantity: [Math.abs(item.quantity || 0), [Validators.required, Validators.min(0.001)]],
                        unitPrice: [item.purchasePrice || 0],
                        batch: [item.batch || null],
                        notes: [item.notes || null]
                    }));
                });
                this.loading = false;
            },
            error: () => {
                this.error = 'Erreur chargement document';
                this.loading = false;
            }
        });
    }

    loadClientPrices(clientId: number): void {
        this.clientsService.getClientProductPrices(clientId).subscribe({
            next: (prices: any[]) => {
                this.clientPrices.set(prices || []);
            },
            error: () => { 
                this.clientPrices.set([]);
            }
        });
    }

    selectClient(client: Client): void {
        this.selectedClient.set(client);
        this.showClientModal = false;
        this.loadClientPrices(client.id);
    }

    selectDepot(depot: Depot): void {
        this.selectedDepot = depot;
        this.showDepotModal = false;
        this.loadInventory();
        this.productsService.getProducts(depot.id).subscribe((prods: any) => {
            this.products.set(prods || []);
            const cats = Array.from(new Set(prods.map((p: any) => p.famille?.name).filter(Boolean)));
            this.productCategories = ['Tous', ...(cats as string[])];
        });
    }

    handleProductClick(product: any): void {
        const existingIndex = this.itemsArray.controls.findIndex((c) => c.get('productId')?.value === product.id);

        if (existingIndex >= 0) {
            const existingCtrl = this.itemsArray.at(existingIndex) as FormGroup;
            existingCtrl.get('quantity')!.setValue((existingCtrl.get('quantity')?.value || 0) + 1);
            this.selectedIndex = existingIndex;
            this.selectedField = 'quantity';
        } else {
            // Get effective price (client-specific price if available)
            let price = this.getEffectiveUnitPrice(product);

            const group = this.fb.group({
                productId: [product.id, Validators.required],
                famille: [product.famille?.name || 'Divers', Validators.required],
                quantity: [1, [Validators.required, Validators.min(0.001)]],
                unitPrice: [price],
                batch: [null],
                notes: [null]
            });
            this.itemsArray.insert(0, group);
            this.selectedIndex = 0;
            this.selectedField = 'quantity';
        }
    }

    // Get effective unit price for a product (matches caisse logic)
    getEffectiveUnitPrice(product: any): number {
        if (!product) return 0;

        // First check if there's a client-specific price
        const client = this.selectedClient();
        const prices = this.clientPrices();
        if (client && prices.length > 0) {
            // Check for direct product ID match
            const directPrice = prices.find(cp => cp.productId === product.id);
            if (directPrice && directPrice.prix_vente_TTC) {
                return Number(directPrice.prix_vente_TTC) || 0;
            }

            // Also check for parent product ID if this is a variant
            const parentProductId = product.parentProductId;
            if (parentProductId && parentProductId > 0) {
                const parentPrice = prices.find(cp => cp.productId === parentProductId);
                if (parentPrice && parentPrice.prix_vente_TTC) {
                    return Number(parentPrice.prix_vente_TTC) || 0;
                }
            }
        }

        // Fallback to default price
        return Number(product.prix_vente_TTC) || 0;
    }

    // Check if product has a client-specific (wholesale) price
    hasClientPrice(product: any): boolean {
        const client = this.selectedClient();
        const prices = this.clientPrices();
        if (!client || prices.length === 0) return false;

        // Check for direct product ID match
        const directPrice = prices.find(cp => cp.productId === product.id);
        if (directPrice) return true;

        // Also check for parent product ID if this is a variant
        const parentProductId = product.parentProductId;
        if (parentProductId && parentProductId > 0) {
            const parentPrice = prices.find(cp => cp.productId === parentProductId);
            if (parentPrice) return true;
        }

        return false;
    }

    // Check if a product ID in the cart has a client-specific price
    hasClientPriceForItem(productId: number): boolean {
        const product = this.products().find(p => p.id === productId);
        if (!product) return false;
        return this.hasClientPrice(product);
    }

    removeItem(index: number): void {
        this.itemsArray.removeAt(index);
    }

    saveDocument(): void {
        const client = this.selectedClient();
        if (!this.selectedDepot || !client || this.itemsArray.length === 0) {
            this.error = 'Veuillez remplir tous les champs obligatoires (Dépôt, Client, Articles)';
            return;
        }

        this.loading = true;
        const items = this.itemsArray.controls.map(c => ({
            productId: c.get('productId')?.value,
            famille: c.get('famille')?.value,
            quantity: Math.abs(c.get('quantity')?.value),
            purchasePrice: c.get('unitPrice')?.value, // We use purchasePrice field in API but it's the return value
            batch: c.get('batch')?.value,
            notes: c.get('notes')?.value
        }));

        const data = {
            depotId: this.selectedDepot.id,
            clientId: client.id,
            items,
            notes: this.notesCtrl.value
        };

        this.stockDocsService.createReturnDocument(data).subscribe({
            next: (doc: any) => {
                this.success = 'Bon de retour client créé avec succès';
                this.successMessage = `Le bon #${doc.numero} a été enregistré et le crédit appliqué au client.`;
                this.showSuccessNotification = true;
                this.loading = false;
                setTimeout(() => this.router.navigate(['/stock/documents/bon-retour/client-return']), 2000);
            },
            error: (err: any) => {
                this.error = err.error?.error || 'Erreur lors de la création';
                this.loading = false;
            }
        });
    }

    get totalAmount(): number {
        return this.itemsArray.controls.reduce((total, ctrl) => {
            const q = parseFloat(ctrl.get('quantity')?.value || 0);
            const p = parseFloat(ctrl.get('unitPrice')?.value || 0);
            return total + (q * p);
        }, 0);
    }

    get totalItems(): number {
        return this.itemsArray.controls.reduce((total, ctrl) => total + (ctrl.get('quantity')?.value || 0), 0);
    }

    getProductName(id: number): string {
        return this.products().find(p => p.id === id)?.name || `Produit #${id}`;
    }

    selectCategory(cat: string): void { this.selectedCategory.set(cat); }
    addToInput(v: string): void { this.currentInput += v; }
    addDecimal(): void { if (!this.currentInput.includes('.')) this.currentInput += '.'; }
    clearInput(): void { this.currentInput = ''; }

    enterValue(): void {
        const val = parseFloat(this.currentInput);
        if (isNaN(val) || val <= 0) return;

        if (this.selectedIndex >= 0 && this.selectedField) {
            this.itemsArray.at(this.selectedIndex).get(this.selectedField)!.setValue(val);
        }
        this.currentInput = '';
        this.selectedField = null;
    }

    selectField(index: number, field: 'quantity' | 'unitPrice'): void {
        this.selectedIndex = index;
        this.selectedField = field;
        this.currentInput = '';
    }

    getFieldClass(index: number, field: string): string {
        const base = 'w-full border rounded px-2 py-1 text-xs text-right cursor-pointer';
        return this.selectedIndex === index && this.selectedField === field ? `${base} bg-red-100 border-red-400` : `${base} bg-white`;
    }

    getProductCardClass(id: number): string {
        const base = 'product-button bg-white border rounded-lg p-2 text-center cursor-pointer shadow-sm relative';
        return this.itemsArray.controls.some(c => c.get('productId')?.value === id) ? `${base} border-red-500 bg-red-50` : base;
    }

    getCategoryButtonClass(cat: string): string {
        const sel = this.selectedCategory() === cat;
        return sel ? 'px-3 py-1.5 rounded-full text-xs font-medium bg-red-500 text-white' : 'px-3 py-1.5 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-200';
    }

    goBack(): void { this.router.navigate(['/stock/documents/bon-retour/client-return']); }
    trackByProductId(i: number, p: any): number { return p.id; }
}
