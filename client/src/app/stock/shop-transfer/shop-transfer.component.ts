import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { StockDocumentsService } from '../../core/services/stock-documents.service';
import { DepotsService } from '../../core/services/depots.service';
import { ProductsService } from '../../core/services/products.service';
import { SalesService } from '../../core/services/sales.service';
import { Depot } from '../../core/models/depot.model';
import { Product } from '../../core/models/product.model';

@Component({
  selector: 'app-shop-transfer',
  templateUrl: './shop-transfer.component.html',
  standalone: false
})
export class ShopTransferComponent implements OnInit {
  depotType: string = '';
  currentDepot: any = null;
  pendingTransfers: any[] = [];
  loading = false;
  error = '';
  success = '';

  // Current inventory
  inventory: any[] = [];
  products: Product[] = [];
  showCurrentInventory = true;
  viewMode: 'table' | 'grid' = 'table';

  // Transfer details
  selectedTransfer: any = null;
  showTransferDetails = false;

  // Entries and exits data
  entryDocuments: any[] = [];
  salesData: any[] = [];
  showEntriesDetails = false;
  showExitsDetails = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private stockDocumentsService: StockDocumentsService,
    private depotsService: DepotsService,
    private productsService: ProductsService,
    private salesService: SalesService
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const depotId = params.get('depotId');
      if (depotId) {
        this.loadData(parseInt(depotId, 10));
      } else {
        this.error = 'ID du dépôt manquant dans l\'URL';
      }
    });
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

  private loadAdditionalData(depotId: number): void {
    // Load other data in parallel
    Promise.all([
      this.productsService.getProducts().toPromise().catch(() => []),
      this.stockDocumentsService.getInventory(depotId).toPromise().catch(() => []),
      this.loadEntryDocuments(depotId),
      this.loadSalesData(depotId)
    ]).then(([products, inventory, entryDocs, sales]) => {
      if (products) this.products = products;
      if (inventory) this.inventory = inventory;
      if (entryDocs) this.entryDocuments = entryDocs;
      if (sales) this.salesData = sales;
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
    if (!productId || !this.products.length) return 'Chargement...';
    const product = this.products.find(p => p.id === productId);
    return product ? product.name : `Produit ID: ${productId}`;
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

  getInventoryTotals(): { totalPurchase: number; totalSale: number; totalProfit: number; profitPercent: number } {
    const items = this.inventory ?? [];
    const totalPurchase = items.reduce((acc: number, it: { productId: number; quantity: number; purchasePrice?: number }) => {
      return acc + Number(this.getItemPurchaseTotal(it));
    }, 0);
    const totalSale = items.reduce((acc: number, it: { productId: number; quantity: number }) => {
      return acc + Number(this.getItemSaleTotal(it));
    }, 0);
    const totalProfit = totalSale - totalPurchase;
    const profitPercent = totalPurchase > 0 ? (totalProfit / totalPurchase) * 100 : 0;
    return { totalPurchase, totalSale, totalProfit, profitPercent };
  }

  trackByItem = (_index: number, item: { id?: number; productId: number }): number => {
    return item.id ?? item.productId;
  }

  goBack(): void {
    this.router.navigate(['/stock']);
  }

  // Load entry documents (inventory + entry documents)
  private loadEntryDocuments(depotId: number): Promise<any[]> {
    return this.stockDocumentsService.getDocuments(1, 1000, 'BON_ENTREE_DEPOT', 'RECEIVED', depotId).toPromise()
      .then(response => response?.data || [])
      .catch(() => []);
  }

  // Load sales data (exits)
  private loadSalesData(depotId: number): Promise<any[]> {
    return this.salesService.getSales().toPromise()
      .then(sales => {
        // Filter sales by depot if needed, or return all sales
        // For now, returning all sales as the service doesn't have depot filtering
        return sales || [];
      })
      .catch(() => []);
  }

  // Calculate total entries (current inventory + exits = total entries)
  getTotalEntries(): { totalQuantity: number; totalValue: number } {
    let totalQuantity = 0;
    let totalValue = 0;

    // Get total exits first
    const exits = this.getTotalExits();
    
    // Add current inventory quantities
    this.inventory.forEach(item => {
      const quantity = Number(item.quantity) || 0;
      totalQuantity += quantity;
      totalValue += Number(this.getItemPurchaseTotal(item));
    });
    
    // Total entries = current inventory + exits
    totalQuantity += exits.totalQuantity;
    
    // Add exits value (calculated at purchase price)
    this.inventory.forEach(item => {
      const exits = this.getProductExits(item.productId);
      const unitPrice = this.getPurchaseUnitPrice(item);
      totalValue += exits.totalQuantity * unitPrice;
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

  // Calculate per-product entries (current inventory + exits = total entries)
  getProductEntries(productId: number): { totalQuantity: number; totalValue: number } {
    let totalQuantity = 0;
    let totalValue = 0;

    // Get current inventory quantity
    const inventoryItem = this.inventory.find(item => item.productId === productId);
    const currentQuantity = inventoryItem ? Number(inventoryItem.quantity) : 0;
    
    // Get total exits (sales)
    const exits = this.getProductExits(productId);
    
    // Total entries = current quantity + exits (what was sold)
    totalQuantity = currentQuantity + exits.totalQuantity;
    
    // Calculate value based on purchase price
    if (inventoryItem) {
      const unitPrice = this.getPurchaseUnitPrice(inventoryItem);
      totalValue = totalQuantity * unitPrice;
    }

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
            const quantity = Number(item.quantity) || 0;
            const total = Number(item.total) || 0;
            totalQuantity += quantity;
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
}
