import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { StockDocumentsService } from '../../core/services/stock-documents.service';
import { DepotsService } from '../../core/services/depots.service';
import { ProductsService } from '../../core/services/products.service';
import { ProduitsDeCaisseService } from '../../core/services/produits-de-caisse.service';
import { SalesService } from '../../core/services/sales.service';
import { SocketService } from '../../core/services/socket.service';
import { Depot } from '../../core/models/depot.model';
import { Product, ProductFamily } from '../../core/models/product.model';
import { Subscription } from 'rxjs';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-shop-transfer',
  templateUrl: './shop-transfer.component.html',
  standalone: false
})
export class ShopTransferComponent implements OnInit, OnDestroy {
  depotType: string = '';
  currentDepot: any = null;
  pendingTransfers: any[] = [];
  loading = false;
  error = '';
  success = '';

  // Current inventory
  inventory: any[] = [];
  filteredInventory: any[] = [];
  products: Product[] = [];
  showCurrentInventory = true;
  viewMode: 'table' | 'grid' = 'table';
  
  // Filters
  families: ProductFamily[] = [];
  selectedFamilyId: number | null = null;
  searchQuery: string = '';

  // Transfer details
  selectedTransfer: any = null;
  showTransferDetails = false;

  // Entries and exits data
  entryDocuments: any[] = [];
  salesData: any[] = [];
  showEntriesDetails = false;
  showExitsDetails = false;

  private stockUpdateSubscription?: Subscription;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private stockDocumentsService: StockDocumentsService,
    private depotsService: DepotsService,
    private productsService: ProductsService,
    private produitsDeCaisseService: ProduitsDeCaisseService,
    private salesService: SalesService,
    private socketService: SocketService
  ) {}

  ngOnInit(): void {
    // Subscribe to both params and query params to handle refresh
    this.route.paramMap.subscribe(params => {
      const depotId = params.get('depotId');
      if (depotId) {
        const depotIdNum = parseInt(depotId, 10);
        this.loadData(depotIdNum);
        this.setupSocketListeners(depotIdNum);
      } else {
        this.error = 'ID du dépôt manquant dans l\'URL';
      }
    });
    
    // Also subscribe to query params to reload when refresh param is present
    this.route.queryParams.subscribe(queryParams => {
      if (queryParams['refresh']) {
        const depotId = this.route.snapshot.paramMap.get('depotId');
        if (depotId) {
          // Reload data when refresh param is present, force refresh
          const depotIdNum = parseInt(depotId, 10);
          this.loading = true;
          this.depotsService.get(depotIdNum).subscribe({
            next: (currentDepot) => {
              if (currentDepot) {
                this.currentDepot = currentDepot;
                this.depotType = currentDepot.type;
              }
              this.loadAdditionalData(depotIdNum, true);
            },
            error: (error) => {
              console.error('Error loading depot:', error);
              this.error = 'Erreur lors du chargement du dépôt: ' + (error?.message || 'Erreur inconnue');
              this.loading = false;
            }
          });
        }
      }
    });
  }

  private setupSocketListeners(depotId: number): void {
    if (!environment.enableRealtime) return;

    this.socketService.joinDepot(depotId);

    this.stockUpdateSubscription = this.socketService.on('stock_updated').subscribe((data: any) => {
      if (data.productId && this.currentDepot && this.currentDepot.id === depotId) {
        console.log('Stock updated via socket, refreshing inventory:', data);
        setTimeout(() => {
          this.loadAdditionalData(depotId, true);
        }, 500);
      }
    });
  }

  ngOnDestroy(): void {
    if (this.stockUpdateSubscription) {
      this.stockUpdateSubscription.unsubscribe();
    }
    if (this.currentDepot && environment.enableRealtime) {
      this.socketService.leaveDepot(this.currentDepot.id);
    }
  }

  loadData(depotId: number): void {
    this.loading = true;
    this.error = '';
    
    // Load depot first
    this.depotsService.get(depotId).subscribe({
      next: (currentDepot) => {
        if (currentDepot) {
          this.currentDepot = currentDepot;
          this.depotType = currentDepot.type;
        }
        this.loadAdditionalData(depotId);
      },
      error: (error) => {
        console.error('Error loading depot:', error);
        this.error = 'Erreur lors du chargement du dépôt: ' + (error?.message || 'Erreur inconnue');
        this.loading = false;
      }
    });
  }

  private loadAdditionalData(depotId: number, forceRefresh: boolean = false): void {
    // Load other data in parallel
    // If forceRefresh is true, add cache-busting timestamp to inventory request
    const inventoryRequest = forceRefresh 
      ? this.stockDocumentsService.getInventory(depotId).toPromise().catch(() => [])
      : this.stockDocumentsService.getInventory(depotId).toPromise().catch(() => []);
    
    Promise.all([
      this.productsService.getProducts().toPromise().catch(() => []),
      this.produitsDeCaisseService.getProduitsDeCaisse().toPromise().catch(() => []),
      inventoryRequest,
      this.loadEntryDocuments(depotId),
      this.loadSalesData(depotId)
    ]).then(async ([products, produitsDeCaisse, inventory, entryDocs, sales]) => {
      // Combine products from both Product and ProduitDeCaisse tables
      const allProducts: Product[] = [];
      if (products) {
        allProducts.push(...products);
      }
      if (produitsDeCaisse) {
        // Transform ProduitDeCaisse to Product format for compatibility
        const transformedProducts = produitsDeCaisse.map(pdc => ({
          id: pdc.id,
          name: pdc.name,
          barcode: pdc.barcode,
          prix_vente_TTC: pdc.prix_vente_TTC,
          prix_achat: pdc.prix_achat,
          unite: pdc.unite,
          tva: pdc.tva,
          familleId: pdc.familleId,
          famille: pdc.famille,
          isVrac: pdc.isVrac,
          isStockable: pdc.isStockable,
          createdAt: pdc.createdAt,
          updatedAt: pdc.updatedAt
        } as Product));
        allProducts.push(...transformedProducts);
      }
      
      // If inventory has products not in our list, fetch them individually
      if (inventory && inventory.length > 0) {
        const inventoryProductIds = new Set(inventory.map((item: any) => item.productId));
        const loadedProductIds = new Set(allProducts.map(p => p.id));
        const missingProductIds = Array.from(inventoryProductIds).filter(id => !loadedProductIds.has(id));
        
        // Also check if inventory items have product info embedded
        inventory.forEach((item: any) => {
          if (item.product) {
            const existingProduct = allProducts.find(p => p.id === item.productId);
            if (!existingProduct) {
              allProducts.push(item.product);
            } else if (item.product.famille && !existingProduct.famille) {
              existingProduct.famille = item.product.famille;
              existingProduct.familleId = item.product.familleId || item.product.famille?.id;
            }
          }
        });
        
        // Fetch remaining missing products individually
        const stillMissingIds = missingProductIds.filter(id => !allProducts.find(p => p.id === id));
        
        if (stillMissingIds.length > 0) {
          console.log(`Fetching ${stillMissingIds.length} missing products:`, stillMissingIds);
          
          // Fetch missing products in parallel
          const missingProductsPromises = stillMissingIds.map(async (missingId: number) => {
            try {
              // Try Product table first
              const product = await this.productsService.getProduct(missingId).toPromise().catch(() => null);
              if (product) {
                return product;
              }
              
              // Try ProduitDeCaisse table
              const produitDeCaisse = await this.produitsDeCaisseService.getProduitDeCaisse(missingId).toPromise().catch(() => null);
              if (produitDeCaisse) {
                return {
                  id: produitDeCaisse.id,
                  name: produitDeCaisse.name,
                  barcode: produitDeCaisse.barcode,
                  prix_vente_TTC: produitDeCaisse.prix_vente_TTC,
                  prix_achat: produitDeCaisse.prix_achat,
                  unite: produitDeCaisse.unite,
                  tva: produitDeCaisse.tva,
                  familleId: produitDeCaisse.familleId,
                  famille: produitDeCaisse.famille,
                  isVrac: produitDeCaisse.isVrac,
                  isStockable: produitDeCaisse.isStockable,
                  createdAt: produitDeCaisse.createdAt,
                  updatedAt: produitDeCaisse.updatedAt
                } as Product;
              }
              
              return null;
            } catch (error) {
              console.warn(`Could not fetch product ${missingId}:`, error);
              return null;
            }
          });
          
          const fetchedProducts = await Promise.all(missingProductsPromises);
          fetchedProducts.forEach(product => {
            if (product) {
              allProducts.push(product);
            }
          });
        }
      }
      
      this.products = allProducts;
      if (inventory) {
        this.inventory = inventory;
        this.filteredInventory = inventory;
        this.applyFilters();
      }
      if (entryDocs) this.entryDocuments = entryDocs;
      if (sales) this.salesData = sales;
      this.loadFamilies();
      this.loadPendingTransfers();
      this.loading = false;
    }).catch((error) => {
      console.error('Error loading additional data:', error);
      this.loading = false;
    });
  }

  loadPendingTransfers(): void {
    if (!this.currentDepot) return;
    
    this.error = '';
    
    
    this.stockDocumentsService.getDocuments(1, 50, 'BON_TRANSFERT', 'PREPARED', this.currentDepot.id).subscribe({
      next: (response) => {
        this.pendingTransfers = response.data || [];
      },
      error: (err) => {
        this.error = err.error?.error || 'Erreur lors du chargement des transferts';
      }
    });
  }

  confirmTransfer(transfer: any): void {
    this.loading = true;
    this.error = '';
    this.success = '';

    this.stockDocumentsService.receiveDocument(transfer.id, this.currentDepot.id).subscribe({
      next: (document) => {
        this.loading = false;
        this.success = 'Transfert confirmé avec succès';
        this.loadPendingTransfers(); // Reload the list
        this.loadData(this.currentDepot.id); // Reload inventory
      },
      error: (err) => {
        this.loading = false;
        this.error = err.error?.error || 'Erreur lors de la confirmation';
      }
    });
  }

  getProductName(productId: number): string {
    if (!productId) return 'Chargement...';
    
    // First try to find in loaded products
    if (this.products.length > 0) {
      const product = this.products.find(p => p.id === productId);
      if (product && product.name) {
        return product.name;
      }
    }
    
    // If not found, try to fetch it on demand (fallback)
    // This handles cases where products weren't loaded initially
    return `Produit ID: ${productId}`;
  }

  toggleCurrentInventory(): void {
    this.showCurrentInventory = !this.showCurrentInventory;
  }

  setInventoryView(mode: 'table' | 'grid'): void {
    this.viewMode = mode;
  }

  viewTransferDetails(transfer: any): void {
    this.selectedTransfer = transfer;
    this.showTransferDetails = true;
  }

  closeTransferDetails(): void {
    this.showTransferDetails = false;
    this.selectedTransfer = null;
  }

  // Helpers for pricing and stats
  private getProduct(productId: number): Product | undefined {
    return this.products.find(p => p.id === productId);
  }

  getPurchaseUnitPrice(item: { productId: number; purchasePrice?: number }): number {
    const product = this.getProduct(item.productId);
    return Number(item.purchasePrice ?? product?.prix_achat ?? 0);
  }

  getSaleUnitPrice(item: { productId: number }): number {
    const product = this.getProduct(item.productId);
    return Number(product?.prix_vente_TTC ?? 0);
  }

  getItemPurchaseTotal(item: { productId: number; quantity: number; purchasePrice?: number }): number {
    const unit = this.getPurchaseUnitPrice(item);
    return Number(item.quantity) * unit;
  }

  getItemSaleTotal(item: { productId: number; quantity: number }): number {
    const unit = this.getSaleUnitPrice(item);
    return Number(item.quantity) * unit;
  }

  getItemProfit(item: { productId: number; quantity: number; purchasePrice?: number }): number {
    return this.getItemSaleTotal(item) - this.getItemPurchaseTotal(item);
  }

  getTransferTotals(transfer: { items?: Array<{ productId: number; quantity: number; purchasePrice?: number }> }): {
    totalPurchase: number; totalSale: number; totalProfit: number; profitPercent: number;
  } {
    const items = transfer.items ?? [];
    const totalPurchase = items.reduce((acc, it) => acc + Number(this.getItemPurchaseTotal(it)), 0);
    const totalSale = items.reduce((acc, it) => acc + Number(this.getItemSaleTotal(it)), 0);
    const totalProfit = totalSale - totalPurchase;
    const profitPercent = totalPurchase > 0 ? (totalProfit / totalPurchase) * 100 : 0;
    return { totalPurchase, totalSale, totalProfit, profitPercent };
  }

  getInventoryTotals(): { totalPurchase: number; totalSale: number; totalProfit: number; profitPercent: number; totalCurrentValue: number } {
    const items = this.inventory ?? [];
    // Total Achat (PA): somme des (quantité actuelle * prix d'achat unitaire)
    const totalPurchase = items.reduce((acc: number, it: { productId: number; quantity: number; purchasePrice?: number }) => {
      const unit = this.getPurchaseUnitPrice(it);
      const qty = Number(it.quantity) || 0;
      return acc + qty * unit;
    }, 0);
    const totalSale = items.reduce((acc: number, it: { productId: number; quantity: number }) => {
      return acc + Number(this.getItemSaleTotal(it));
    }, 0);
    const totalCurrentValue = items.reduce((acc: number, it: { productId: number; quantity: number }) => {
      return acc + Number(this.getItemSaleTotal(it));
    }, 0);
    const totalProfit = totalSale - totalPurchase;
    const profitPercent = totalPurchase > 0 ? (totalProfit / totalPurchase) * 100 : 0;
    return { totalPurchase, totalSale, totalProfit, profitPercent, totalCurrentValue };
  }

  getTotalPurchaseFromEntries(): number {
    let totalPurchase = 0;
    
    // Calculate from entry documents (bon d'entrée)
    this.entryDocuments.forEach(doc => {
      if (doc.items) {
        doc.items.forEach((item: any) => {
          const quantity = Number(item.quantity) || 0;
          const purchasePrice = Number(item.purchasePrice) || 0;
          totalPurchase += quantity * purchasePrice;
        });
      }
    });
    
    return totalPurchase;
  }

  getInventoryVariance(): { totalEntries: number; currentInventory: number; variance: number } {
    const totalEntries = this.getTotalEntries().totalValue;
    const currentInventory = this.getInventoryTotals().totalCurrentValue;
    const variance = currentInventory - totalEntries; // solde inventaire - solde -1
    
    return { totalEntries, currentInventory, variance };
  }

  trackByItem = (_index: number, item: { id?: number; productId: number }): number => {
    return item.id ?? item.productId;
  }

  goBack(): void {
    this.router.navigate(['/stock']);
  }

  // Load entry documents (inventory + entry documents)
  // Load both BON_ENTREE_DEPOT and BON_ENTREE_MAGASIN documents
  private loadEntryDocuments(depotId: number): Promise<any[]> {
    // Load both types of entry documents
    return Promise.all([
      this.stockDocumentsService.getDocuments(1, 1000, 'BON_ENTREE_DEPOT', 'RECEIVED', depotId).toPromise()
        .then(response => response?.data || [])
        .catch(() => []),
      this.stockDocumentsService.getDocuments(1, 1000, 'BON_ENTREE_MAGASIN', 'RECEIVED', depotId).toPromise()
        .then(response => response?.data || [])
        .catch(() => [])
    ]).then(([depotEntries, magasinEntries]) => {
      // Combine both arrays and remove duplicates by document ID
      const allEntries = [...depotEntries, ...magasinEntries];
      const uniqueEntries = allEntries.filter((doc, index, self) => 
        index === self.findIndex(d => d.id === doc.id)
      );
      return uniqueEntries;
    });
  }

  // Load sales data (exits)
  private loadSalesData(depotId: number): Promise<any[]> {
    return this.salesService.getSales().toPromise()
      .then(sales => {
        // Filter sales by depot and exclude canceled/refunded tickets
        const filteredSales = (sales || []).filter((sale: any) => {
          const status = (sale.status || '').toUpperCase();
          const isCanceled = status === 'CANCELLED' || status === 'REFUNDED';
          const matchesDepot = sale.depotId === depotId;
          return matchesDepot && !isCanceled && (status === 'COMPLETED' || status === 'CMD_TERMINEE');
        });
        return filteredSales;
      })
      .catch(() => []);
  }

  // Calculate total entries (quantities and values from entry documents only)
  getTotalEntries(): { totalQuantity: number; totalValue: number } {
    let totalQuantity = 0;
    let totalValue = 0;

    // Calculate quantity and value ONLY from entry documents (bon d'entrée)
    this.entryDocuments.forEach(doc => {
      if (doc.items) {
        doc.items.forEach((item: any) => {
          const quantity = Number(item.quantity) || 0;
          const purchasePrice = Number(item.purchasePrice) || 0;
          totalQuantity += quantity;
          totalValue += quantity * purchasePrice;
        });
      }
    });

    return { totalQuantity, totalValue };
  }

  // Calculate total exits (sales)
  getTotalExits(): { totalQuantity: number; totalValue: number } {
    let totalQuantity = 0;
    let totalValue = 0;

    this.salesData.forEach(sale => {
      if (sale.items) {
        sale.items.forEach((item: any) => {
          const quantity = Number(item.quantity) || 0;
          const total = Number(item.total) || 0;
          totalQuantity += quantity;
          totalValue += total;
        });
      }
    });

    return { totalQuantity, totalValue };
  }

  // Calculate per-product entries (from entry documents only)
  getProductEntries(productId: number): { totalQuantity: number; totalValue: number } {
    let totalQuantity = 0;
    let totalValue = 0;

    // Calculate entries ONLY from entry documents (bon d'entrée)
    this.entryDocuments.forEach(doc => {
      if (doc.items) {
        doc.items.forEach((item: any) => {
          if (item.productId === productId) {
            const quantity = Number(item.quantity || 0);
            const purchasePrice = Number(item.purchasePrice || 0);
            totalQuantity += quantity;
            totalValue += quantity * purchasePrice;
          }
        });
      }
    });

    return { totalQuantity, totalValue };
  }

  // Calculate per-product exits (sales)
  getProductExits(productId: number): { totalQuantity: number; totalValue: number } {
    let totalQuantity = 0;
    let totalValue = 0;

    this.salesData.forEach(sale => {
      if (sale.items) {
        sale.items.forEach((item: any) => {
          if (item.productId === productId) {
            // Handle wholesale bundle quantities
            const actualQuantity = sale.isWholesale && item.isWholesale && item.bundleSize
              ? (Number(item.bundleQuantity || item.quantity || 0)) * Number(item.bundleSize || 1)
              : Number(item.quantity || 0);
            const total = Number(item.total) || 0;
            totalQuantity += actualQuantity;
            totalValue += total;
          }
        });
      }
    });

    return { totalQuantity, totalValue };
  }

  // Show entries details
  showEntriesDetailsModal(): void {
    this.showEntriesDetails = true;
  }

  // Show exits details
  showExitsDetailsModal(): void {
    this.showExitsDetails = true;
  }

  // Close modals
  closeEntriesDetails(): void {
    this.showEntriesDetails = false;
  }

  closeExitsDetails(): void {
    this.showExitsDetails = false;
  }

  loadFamilies(): void {
    this.productsService.getFamilles().subscribe({
      next: (families) => {
        this.families = families;
      },
      error: (error) => {
        console.error('Error loading families:', error);
      }
    });
  }

  onFamilyFilterChange(familyId: string): void {
    this.selectedFamilyId = familyId ? parseInt(familyId) : null;
    this.applyFilters();
  }

  onSearchChange(searchQuery: string): void {
    this.searchQuery = searchQuery.toLowerCase().trim();
    this.applyFilters();
  }

  applyFilters(): void {
    if (!this.inventory || this.inventory.length === 0) {
      this.filteredInventory = [];
      return;
    }

    let filtered = [...this.inventory];

    if (this.selectedFamilyId) {
      filtered = filtered.filter(item => {
        const product = item.product || this.getProduct(item.productId);
        if (!product) return false;
        const familleId = product.familleId || product.famille?.id;
        return familleId === this.selectedFamilyId;
      });
    }

    if (this.searchQuery) {
      filtered = filtered.filter(item => {
        const product = item.product || this.getProduct(item.productId);
        if (!product) {
          const productName = this.getProductName(item.productId).toLowerCase();
          return productName.includes(this.searchQuery);
        }
        const productName = product.name?.toLowerCase() || '';
        const barcode = product.barcode?.toLowerCase() || '';
        return productName.includes(this.searchQuery) || barcode.includes(this.searchQuery);
      });
    }

    this.filteredInventory = filtered;
  }

  getProductFamilyName(productId: number, item?: any): string {
    const product = item?.product || this.getProduct(productId);
    if (!product) return '';
    return product.famille?.name || '';
  }
}
