   import { Component, OnInit, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ActivatedRoute } from '@angular/router';
import { environment } from '../../../environments/environment';
import { InventoryService, InventorySession } from '../../core/services/inventory.service';
import { SalesService } from '../../core/services/sales.service';
import { SessionsService } from '../../core/services/sessions.service';
import { ProductsService } from '../../core/services/products.service';
import { Product, ProductFamily } from '../../core/models/product.model';
import { Sale, SaleItem } from '../../core/models/sale.model';
import { PrintService } from '../../core/services/print.service';

export interface ReconciliationRow {
  date: Date;
  designation: string;
  isWholesale?: boolean;
  isGift?: boolean;
  achat: {
    entree: { qty: number; pu: number; totale: number };
    sortie: { qty: number; pu: number; totale: number };
    solde: { qty: number; pu: number; totale: number };
  };
  vente: {
    entree: { qty: number; pu: number; totale: number };
    sortie: { qty: number; pu: number; totale: number };
    solde: { qty: number; pu: number; totale: number };
  };
}

export interface EcartData {
  productId: number;
  productName: string;
  qtyVendu: number;
  prixVenteUnitaire: number;
  chiffreAffaireTheorique: number;
  chiffreAffaireRealise: number;
  ecartVenteGros: number;
  ecartGratuite: number;
  ecartRemise: number;
  ecartGlobal: number;
  deferenceEcart: number;
}

export interface ReconciliationData {
  productId: number;
  productName: string;
  rows: ReconciliationRow[];
  summary: {
    totalAchatEntree: { qty: number; totale: number };
    totalAchatSortie: { qty: number; totale: number };
    totalVenteEntree: { qty: number; totale: number };
    totalVenteSortie: { qty: number; totale: number };
    cogs: number;
    endingStock: { qty: number; value: number; pu: number };
  };
  ecartData?: EcartData;
  releveInventaire?: ReleveInventaireRow;
}

export interface GlobalEcartSummary {
  totalProducts: number;
  totalQtyVendu: number;
  totalChiffreAffaireTheorique: number;
  totalChiffreAffaireRealise: number;
  totalEcartVenteGros: number;
  totalEcartGratuite: number;
  totalEcartRemise: number;
  totalEcartGlobal: number;
  totalDeferenceEcart: number;
  products: EcartData[];
}

// Relevé Inventaire interfaces
export interface ReleveInventaireRow {
  id: string;
  designation: string;
  debut: number; // montant total
  credit: number; // montant total
  solde: number; // debut - credit
  type: 'ENTRY' | 'CREDIT' | 'INVENTORY' | 'MANUAL_CREDIT';
  details?: string; // détails pour les écarts, numéros de caisse, etc.
  date?: Date;
  createdAt?: Date; // For proper date ordering
  isInventory?: boolean; // ligne verte pour inventaire
  saleId?: number; // ID de la vente pour navigation
  ecartType?: string; // Type d'écart (GRATUITE, VENTE_GROS, REMISE)
  isExpandable?: boolean; // Can be expanded to show details
  expandableId?: string; // ID for expansion tracking
  isChild?: boolean; // Is a child row of an expandable parent
  parentId?: string; // ID of the parent row
  isEcartGrosChild?: boolean; // Is a child of ecart gros
  wholesaleSales?: any[]; // Wholesale sales data for dialog
  totalWholesaleSales?: number; // Total number of wholesale sales
  ticketNumber?: string; // Ticket number for wholesale sales
  wholesaleAmount?: number; // Wholesale amount
  retailAmount?: number; // Retail amount
  priceDifference?: number; // Price difference (loss)
  gratuitSales?: any[]; // Gratuité sales data for dialog
  totalGratuitSales?: number; // Total number of gratuité sales
  gratuitAmount?: number; // Gratuité amount
  gratuitQuantity?: number; // Gratuité quantity
  inventoryVariance?: number; // Inventory variance for calculation
  totalInventoryValue?: number; // Total inventory value for reference
}

export interface CreditEntry {
  id?: number;
  productId: number | null;
  amount: number;
  type: 'SALE' | 'FREE_ITEM' | 'EXIT_VOUCHER' | 'WHOLESALE_DIFFERENCE';
  description: string;
  date: Date;
  createdAt?: Date;
}

// Manual Debit/Credit Entry interface
export interface ManualEntry {
  id?: number;
  entryType: 'DEBIT' | 'CREDIT'; // Type of entry
  amount: number;
  description: string;
  date: Date;
  createdAt?: Date;
  positionIndex: number; // Index where this entry should be inserted
  referenceRowId?: string; // ID of the row after which this should be inserted
  dateFrom: string; // Start date of the report range
  dateTo: string; // End date of the report range
}

export interface ReleveInventaireSummary {
  totalProducts: number;
  totalDebut: number;
  totalCredit: number;
  totalSolde: number;
  products: ReleveInventaireRow[];
}

export type RangeMode = 'DATE' | 'INVENTORY' | 'LAST_INVENTORY';
export type Scope = 'ONE_PRODUCT' | 'ONE_CATEGORY' | 'ALL_PRODUCTS';
export type ValuationMode = 'CUMP' | 'FIFO';

interface FIFOLayer {
  qty: number;
  cost: number;
  date: Date;
}

// Sale FIFO layer for VENTE solde (price at sale side)
interface SaleLayer {
  qty: number;
  price: number;
}

@Component({
  selector: 'app-inventory-sales-reconciliation',
  templateUrl: './inventory-sales-reconciliation.component.html',
  styleUrls: ['./inventory-sales-reconciliation.component.css'],
  standalone: false
})
export class InventorySalesReconciliationComponent implements OnInit {
  // Range selectors
  rangeMode: RangeMode = 'DATE';
  startDate = '';
  endDate = '';
  startInventoryId: number | null = null;
  endInventoryId: number | null = null;
  
  // Scope selectors
  scope: Scope = 'ALL_PRODUCTS';
  selectedProductId: number | string | null = null;
  selectedCategoryId: number | string | null = null;
  
  // Valuation mode
  valuationMode: ValuationMode = 'CUMP';
  
  // Data
  products: Product[] = [];
  categories: ProductFamily[] = [];
  inventorySessions: InventorySession[] = [];
  reconciliationData: ReconciliationData[] = [];
  globalEcartSummary: GlobalEcartSummary | null = null;
  
  // Relevé Inventaire data
  releveInventaireData: ReleveInventaireRow[] = [];
  releveInventaireSummary: ReleveInventaireSummary | null = null;
  creditEntries: CreditEntry[] = [];
  manualEntries: ManualEntry[] = []; // Manual debit/credit entries
  expandedBonEntree: Set<string> = new Set();
  expandedEcartGros: Set<string> = new Set();
  isInventoryMode: boolean = false; // Track if we're showing inventory-based data
  
  // Manual entry modal state
  isManualEntryModalOpen = false;
  selectedRowIndex: number | null = null;
  selectedRowId: string | null = null;
  newManualEntry: ManualEntry = {
    entryType: 'DEBIT',
    amount: 0,
    description: '',
    date: new Date(),
    positionIndex: 0,
    dateFrom: '',
    dateTo: ''
  };
  // Snapshot and chaining state
  lastInventorySolde: number = 0;
  secondaryReleveRows: ReleveInventaireRow[] = [];
  
  // Wholesale sales dialog state
  showWholesaleDialog = false;
  selectedWholesaleSales: any[] = [];
  selectedWholesaleProduct = '';
  
  // Gratuité sales dialog state
  showGratuitDialog = false;
  selectedGratuitSales: any[] = [];
  selectedGratuitProduct = '';
  
  // UI state
  loading = false;
  error = '';
  success = '';
  showReport = false;
  showInactiveProducts = false; // Option to show inactive products
  totalProducts = 0;
  depotId: number | null = null;
  activeProducts = 0;
  
  // Collapse state for tables
  isReconciliationTableCollapsed = true; // Collapsed by default
  isReleveInventaireTableCollapsed = true; // Collapsed by default
  isGlobalEcartTableCollapsed = true; // Collapsed by default
  
  private readonly printService = inject(PrintService);

  constructor(
    private http: HttpClient,
    private route: ActivatedRoute,
    private inventoryService: InventoryService,
    private salesService: SalesService,
    private sessionsService: SessionsService,
    private productsService: ProductsService
  ) {}

  ngOnInit(): void {
    this.setDefaultDateRange();
    this.loadInitialData();
    
    // Get depotId from route parameters
    this.route.params.subscribe(params => {
      this.depotId = params['depotId'] ? parseInt(params['depotId']) : null;
    });
  }

  setDefaultDateRange(): void {
    const today = new Date();
    
    // Create date for 1st day of current month (avoiding timezone issues)
    const year = today.getFullYear();
    const month = today.getMonth(); // 0-based month (0 = January, 8 = September)
    const firstDayOfMonth = new Date(year, month, 1);
    
    // Format dates as YYYY-MM-DD for input[type="date"]
    // Use local date formatting to avoid timezone conversion issues
    this.startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    this.endDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  }

  loadInitialData(): void {
    this.loading = true;
    
    // Load products and categories
    this.productsService.getProducts().subscribe({
      next: (products) => {
        this.products = products;
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Erreur lors du chargement des produits';
        this.loading = false;
      }
    });

    // Load categories
    this.productsService.getFamilles().subscribe({
      next: (categories) => {
        this.categories = categories;
      },
      error: (err) => {
        console.error('Error loading categories:', err);
      }
    });

    // Load inventory sessions
    this.inventoryService.getSessions().subscribe({
      next: (sessions) => {
        this.inventorySessions = sessions.filter(s => s.status === 'POSTED');
      },
      error: (err) => {
        console.error('Error loading inventory sessions:', err);
      }
    });
  }

  // Save current relevé into local storage (minimal snapshot)
  saveCurrentReleve(): void {
    try {
      const snapshot = {
        savedAt: new Date().toISOString(),
        lastInventorySolde: this.lastInventorySolde,
        rows: this.releveInventaireData
      };
      const key = 'releveSnapshots';
      const existing = localStorage.getItem(key);
      const list = existing ? JSON.parse(existing) : [];
      list.push(snapshot);
      localStorage.setItem(key, JSON.stringify(list));
    } catch {}
  }

  // Start a new table using previous inventory solde as first line
  startNewReleveFromLastSolde(): void {
    const opening: ReleveInventaireRow = {
      id: `inventory_opening_${Date.now()}`,
      designation: 'INVENTAIRE (Solde précédent)',
      debut: 0,
      credit: 0,
      solde: this.lastInventorySolde,
      type: 'INVENTORY',
      details: 'Solde reporté du relevé précédent',
      date: new Date(),
      createdAt: new Date(),
      isInventory: true,
      totalInventoryValue: this.lastInventorySolde
    } as any;
    this.secondaryReleveRows = [opening];
    
    // Set flag to redirect new transactions to secondary table
    this.isInventoryMode = true;
  }

  // Clear secondary table and reset to normal mode
  clearSecondaryReleve(): void {
    this.secondaryReleveRows = [];
    this.isInventoryMode = false;
  }


  generateReport(): void {
    if (!this.validateInputs()) {
      return;
    }

    this.loading = true;
    this.error = '';
    this.showReport = false;

    // Determine date range
    let dateFrom: Date;
    let dateTo: Date;

    if (this.rangeMode === 'DATE') {
      dateFrom = new Date(this.startDate);
      dateTo = new Date(this.endDate);
      // Set end date to end of day (23:59:59) to include all movements from that day
      dateTo.setHours(23, 59, 59, 999);
    } else if (this.rangeMode === 'INVENTORY') {
      const startSession = this.inventorySessions.find(s => s.id === this.startInventoryId);
      const endSession = this.inventorySessions.find(s => s.id === this.endInventoryId);
      if (!startSession || !endSession) {
        this.error = 'Sessions d\'inventaire non trouvées';
        this.loading = false;
        return;
      }
      dateFrom = new Date(startSession.postedAt || startSession.closedAt || startSession.createdAt);
      dateTo = new Date(endSession.postedAt || endSession.closedAt || endSession.createdAt);
    } else { // LAST_INVENTORY
      const sessions = this.inventorySessions.sort((a, b) => 
        new Date(b.postedAt || b.closedAt || b.createdAt).getTime() - 
        new Date(a.postedAt || a.closedAt || a.createdAt).getTime()
      );
      if (sessions.length < 2) {
        this.error = 'Au moins 2 sessions d\'inventaire sont requises';
        this.loading = false;
        return;
      }
      dateFrom = new Date(sessions[1].postedAt || sessions[1].closedAt || sessions[1].createdAt);
      dateTo = new Date(sessions[0].postedAt || sessions[0].closedAt || sessions[0].createdAt);
    }

    // Determine products to analyze
    let targetProducts: Product[] = [];
    
    if (this.scope === 'ONE_PRODUCT' && this.selectedProductId) {
      const productId = typeof this.selectedProductId === 'string' ? parseInt(this.selectedProductId) : this.selectedProductId;
      const product = this.products.find(p => p.id === productId);
      if (product) targetProducts = [product];
    } else if (this.scope === 'ONE_CATEGORY' && this.selectedCategoryId) {
      const categoryId = typeof this.selectedCategoryId === 'string' ? parseInt(this.selectedCategoryId) : this.selectedCategoryId;
      targetProducts = this.products.filter(p => p.familleId === categoryId);
    } else {
      targetProducts = this.products;
    }

    if (targetProducts.length === 0) {
      this.error = 'Aucun produit trouvé pour la sélection';
      this.loading = false;
      return;
    }


    // Generate reconciliation data for each product
    this.generateReconciliationData(targetProducts, dateFrom, dateTo);
  }

  private validateInputs(): boolean {
    if (this.rangeMode === 'DATE') {
      if (!this.startDate || !this.endDate) {
        this.error = 'Veuillez sélectionner une plage de dates';
        return false;
      }
      if (new Date(this.startDate) > new Date(this.endDate)) {
        this.error = 'La date de début doit être antérieure à la date de fin';
        return false;
      }
    } else if (this.rangeMode === 'INVENTORY') {
      if (!this.startInventoryId || !this.endInventoryId) {
        this.error = 'Veuillez sélectionner deux sessions d\'inventaire';
        return false;
      }
      if (this.startInventoryId === this.endInventoryId) {
        this.error = 'Les sessions d\'inventaire doivent être différentes';
        return false;
      }
    }

    if (this.scope === 'ONE_PRODUCT' && !this.selectedProductId) {
      this.error = 'Veuillez sélectionner un produit';
      return false;
    }

    if (this.scope === 'ONE_CATEGORY' && !this.selectedCategoryId) {
      this.error = 'Veuillez sélectionner une catégorie';
      return false;
    }

    return true;
  }

  private async generateReconciliationData(products: Product[], dateFrom: Date, dateTo: Date): Promise<void> {
    this.reconciliationData = [];

    
    // Fetch ALL data once at the beginning
    const [allSales, allStockMovements, allInventory] = await Promise.all([
      this.getAllSalesData(),
      this.getAllStockMovements(dateFrom, dateTo),
      this.getAllInventoryData()
    ]);


    // Filter sales by date range
    const salesInRange = allSales.filter(sale => {
      const saleDate = new Date(sale.createdAt);
      return saleDate >= dateFrom && saleDate <= dateTo;
    });

    // Filter out products with no activity to optimize processing
    const activeProducts = this.filterActiveProducts(products, salesInRange, allStockMovements, allInventory);
    
    // Store counts for UI display
    this.totalProducts = products.length;
    this.activeProducts = activeProducts.length;
    
    // Choose which products to process based on user preference
    const productsToProcess = this.showInactiveProducts ? products : activeProducts;
    

    // Process selected products using pre-fetched data (no more API calls)
    const reconciliationPromises = productsToProcess.map(product => 
      this.generateProductReconciliationBulk(
        product, 
        salesInRange, 
        allStockMovements, 
        allInventory
      )
    );

    // Process all products in parallel
    this.reconciliationData = await Promise.all(reconciliationPromises);


    this.globalEcartSummary = this.calculateGlobalEcartSummary(this.reconciliationData);
    
    // Generate Relevé Inventaire from reconciliation data
    await this.generateReleveInventaireFromReconciliationData();
    
    this.loading = false;
    this.showReport = true;
  }

  private async getAllSalesData(): Promise<any[]> {
    try {
      const allSales = await firstValueFrom(this.salesService.getSales());
      return Array.isArray(allSales) ? allSales : [];
    } catch (err) {
      console.error('Error getting all sales data:', err);
      return [];
    }
  }

  private async getAllInventoryData(): Promise<any[]> {
    try {
      const inventory = await firstValueFrom(this.http.get<any>(`${environment.apiUrl}/stock/inventory`));
      return Array.isArray(inventory) ? inventory : [];
    } catch (err) {
      console.error('Error getting all inventory data:', err);
      return [];
    }
  }

  private filterActiveProducts(
    products: Product[], 
    salesInRange: any[], 
    allStockMovements: any[], 
    allInventory: any[]
  ): Product[] {
    
    // Create sets of product IDs that have activity for fast lookup
    const productsWithSales = new Set<number>();
    const productsWithStockMovements = new Set<number>();
    const productsWithInventory = new Set<number>();
    
    // Find products with sales in date range
    for (const sale of salesInRange) {
      if (sale.items && Array.isArray(sale.items)) {
        for (const item of sale.items) {
          if (item.productId) {
            productsWithSales.add(Number(item.productId));
          }
        }
      }
    }
    
    // Find products with stock movements
    for (const movement of allStockMovements) {
      if (movement.productId) {
        productsWithStockMovements.add(Number(movement.productId));
      }
    }
    
    // Find products with inventory
    for (const inventory of allInventory) {
      if (inventory.productId && Number(inventory.quantity) > 0) {
        productsWithInventory.add(Number(inventory.productId));
      }
    }
    
    // Filter products that have at least one type of activity
    const activeProducts = products.filter(product => {
      const hasSales = productsWithSales.has(product.id);
      const hasStockMovements = productsWithStockMovements.has(product.id);
      const hasInventory = productsWithInventory.has(product.id);
      
      return hasSales || hasStockMovements || hasInventory;
    });
    
    
    return activeProducts;
  }

  private async getAllStockMovements(dateFrom: Date, dateTo: Date): Promise<any[]> {
    try {
      // Get all stock documents in one call
      const response = await firstValueFrom(this.http.get<any>(`${environment.apiUrl}/stock-documents`, {
        params: {
          type: 'BON_ENTREE_DEPOT',
          limit: '1000',
          dateFrom: dateFrom.toISOString(),
          dateTo: dateTo.toISOString()
        }
      }));

      // Handle different response formats
      let stockDocs = [];
      if (Array.isArray(response)) {
        stockDocs = response;
      } else if (response && Array.isArray(response.data)) {
        stockDocs = response.data;
      } else if (response && response.stockDocuments && Array.isArray(response.stockDocuments)) {
        stockDocs = response.stockDocuments;
      } else {
        return [];
      }

      const movements: any[] = [];
      
      for (const doc of stockDocs) {
        if (doc.items && doc.items.length > 0) {
          for (const item of doc.items) {
            movements.push({
              date: doc.createdAt,
              designation: `Achat #${doc.numero}`,
              type: 'ACHAT_ENTREE',
              quantity: Number(item.quantity) || 0,
              unitCost: Number(item.purchasePrice) || 0,
              productId: item.productId,
              documentId: doc.id,
              itemId: item.id
            });
          }
        }
      }

      return movements;
    } catch (err) {
      console.error('Error getting all stock movements:', err);
      return [];
    }
  }

  private async generateProductReconciliationBulk(
    product: Product, 
    salesInRange: any[], 
    allStockMovements: any[],
    allInventory: any[]
  ): Promise<ReconciliationData> {
    const rows: ReconciliationRow[] = [];
    let currentStock = 0;
    let currentCost = 0;
    let currentValue = 0;
    let saleCumQty = 0;
    let saleCumValue = 0;
    let saleAvgPrice = Number(product.prix_vente_TTC) || 0;
    const fifoLayers: FIFOLayer[] = [];
    const saleLayers: SaleLayer[] = [];

    // Get initial inventory from pre-fetched data
    const initialInventory = allInventory.find(item => item.productId === product.id);
    if (initialInventory && Number(initialInventory.quantity) > 0) {
      currentStock = Number(initialInventory.quantity) || 0;
      currentCost = Number(product.prix_achat) || (Number(product.prix_vente_TTC) * 0.7) || 0;
      currentValue = currentStock * currentCost;
      saleAvgPrice = Number(product.prix_vente_TTC) || 0;
      
      if (this.valuationMode === 'FIFO' && currentStock > 0) {
        saleLayers.push({ qty: currentStock, price: saleAvgPrice });
      }

      rows.push({
        date: new Date(),
        designation: 'Inventaire Initial',
        achat: {
          entree: { qty: currentStock, pu: currentCost, totale: currentValue },
          sortie: { qty: 0, pu: 0, totale: 0 },
          solde: { qty: currentStock, pu: currentCost, totale: currentValue }
        },
        vente: {
          entree: { qty: 0, pu: 0, totale: 0 },
          sortie: { qty: 0, pu: 0, totale: 0 },
          solde: { qty: currentStock, pu: Number(product.prix_vente_TTC) || 0, totale: currentStock * Number(product.prix_vente_TTC) || 0 }
        }
      });
    }

    // Filter movements for this product from pre-fetched data
    const productMovements = allStockMovements.filter(m => m.productId === product.id);
    
    // Get sales for this product from pre-fetched data
    const productSales = salesInRange.filter(sale => 
      sale.items?.some((item: any) => item.productId === product.id)
    );

    // Process stock movements (no API calls)
    for (const movement of productMovements) {
      const row: ReconciliationRow = {
        date: new Date(movement.date),
        designation: movement.designation,
        isWholesale: false,
        isGift: false,
        achat: {
          entree: { qty: 0, pu: 0, totale: 0 },
          sortie: { qty: 0, pu: 0, totale: 0 },
          solde: { qty: currentStock, pu: currentCost, totale: currentValue }
        },
        vente: {
          entree: { qty: 0, pu: 0, totale: 0 },
          sortie: { qty: 0, pu: 0, totale: 0 },
          solde: { qty: currentStock, pu: currentCost, totale: currentValue }
        }
      };

      if (movement.type === 'ACHAT_ENTREE') {
        const newQty = Number(movement.quantity) || 0;
        const newCost = Number(movement.unitCost) || 0;
        const newValue = newQty * newCost;

        row.achat.entree = { qty: newQty, pu: newCost, totale: newValue };

        if (this.valuationMode === 'CUMP') {
          const totalQty = currentStock + newQty;
          const totalValue = currentValue + newValue;
          currentCost = totalQty > 0 ? totalValue / totalQty : currentCost;
        } else {
          fifoLayers.push({
            qty: newQty,
            cost: newCost,
            date: new Date(movement.date)
          });
          const totalValue = fifoLayers.reduce((sum, layer) => sum + (layer.qty * layer.cost), 0);
          const totalQty = fifoLayers.reduce((sum, layer) => sum + layer.qty, 0);
          currentCost = totalQty > 0 ? totalValue / totalQty : currentCost;
          saleLayers.push({ qty: newQty, price: Number(product.prix_vente_TTC) || 0 });
        }

        currentStock += newQty;
        currentValue = currentStock * currentCost;
      }

      row.achat.solde = { qty: currentStock, pu: currentCost, totale: currentValue };
      row.vente.solde = { qty: currentStock, pu: saleAvgPrice, totale: currentStock * saleAvgPrice };
      rows.push(row);
    }

    // Process sales (no API calls)
    for (const sale of productSales) {
      const saleItems = sale.items?.filter((item: any) => item.productId === product.id) || [];
      
      for (const item of saleItems) {
        const outQty = Number(item.quantity) || 0;
        const outCost = this.valuationMode === 'CUMP' ? currentCost : this.getFIFOCost(fifoLayers, outQty);
        const unitPrice = Number(item.unitPrice) || 0;
        const totalPrice = outQty * unitPrice;
        const isGift = sale.status === 'CADEAU';
        const isWholesale = item.isWholesale || sale.isWholesale;

        const row: ReconciliationRow = {
          date: new Date(sale.createdAt),
          designation: `Vente #${sale.id}`,
          isWholesale,
          isGift,
          achat: {
            entree: { qty: 0, pu: 0, totale: 0 },
            sortie: { qty: outQty, pu: outCost, totale: outQty * outCost },
            solde: { qty: currentStock, pu: currentCost, totale: currentValue }
          },
          vente: {
            entree: { qty: 0, pu: 0, totale: 0 },
            sortie: { qty: outQty, pu: isGift ? 0 : unitPrice, totale: isGift ? 0 : totalPrice },
            solde: { qty: currentStock, pu: saleAvgPrice, totale: currentStock * saleAvgPrice }
          }
        };

        if (!isGift) {
          saleCumQty += outQty;
          saleCumValue += totalPrice;
          saleAvgPrice = saleCumQty > 0 ? (saleCumValue / saleCumQty) : saleAvgPrice;
        }

        if (this.valuationMode === 'FIFO') {
          this.consumeFIFOLayers(fifoLayers, outQty);
          const totalValue = fifoLayers.reduce((sum, layer) => sum + (layer.qty * layer.cost), 0);
          const totalQty = fifoLayers.reduce((sum, layer) => sum + layer.qty, 0);
          currentCost = totalQty > 0 ? totalValue / totalQty : currentCost;
          
          let remainingToConsume = outQty;
          for (let i = 0; i < saleLayers.length && remainingToConsume > 0; i++) {
            const sl = saleLayers[i];
            const take = Math.min(remainingToConsume, sl.qty);
            sl.qty -= take;
            remainingToConsume -= take;
            if (sl.qty <= 0) {
              saleLayers.splice(i, 1);
              i--;
            }
          }
        }

        currentStock -= outQty;
        currentValue = currentStock * currentCost;
        row.achat.solde = { qty: currentStock, pu: currentCost, totale: currentValue };
        
        if (this.valuationMode === 'FIFO') {
          const saleTotalQty = saleLayers.reduce((s, l) => s + l.qty, 0);
          const saleTotalValue = saleLayers.reduce((s, l) => s + (l.qty * l.price), 0);
          const salePu = saleTotalQty > 0 ? (saleTotalValue / saleTotalQty) : (Number(product.prix_vente_TTC) || 0);
          row.vente.solde = { qty: currentStock, pu: salePu, totale: saleTotalQty * salePu };
        } else {
          row.vente.solde = { qty: currentStock, pu: saleAvgPrice, totale: currentStock * saleAvgPrice };
        }

        rows.push(row);
      }
    }

    // Calculate summary
    const summary = this.calculateSummary(rows);

    // Calculate ecart data using pre-fetched sales
    const ecartData = this.calculateEcartDataBulk(product, salesInRange);

    // Calculate Relevé Inventaire data using pre-fetched data
    // Get current inventory stock value directly - no calculations needed
    const solde = await this.getCurrentInventoryStockValue(product);
    
    const releveInventaire: ReleveInventaireRow = {
      id: `product_${product.id}`,
      designation: product.name,
      debut: 0, // Not used when using direct inventory value
      credit: 0, // Not used when using direct inventory value
      solde: solde, // Direct current inventory stock value
      type: 'ENTRY'
    };

    return {
      productId: product.id,
      productName: product.name,
      rows,
      summary,
      ecartData,
      releveInventaire
    };
  }

  private async generateProductReconciliationOptimized(
    product: Product, 
    dateFrom: Date, 
    dateTo: Date, 
    salesInRange: any[], 
    allStockMovements: any[]
  ): Promise<ReconciliationData> {
    const rows: ReconciliationRow[] = [];
    let currentStock = 0;
    let currentCost = 0;
    let currentValue = 0;
    let totalSaleValue = 0;
    let saleCumQty = 0;
    let saleCumValue = 0;
    let saleAvgPrice = Number(product.prix_vente_TTC) || 0;
    const fifoLayers: FIFOLayer[] = [];
    const saleLayers: SaleLayer[] = [];

    // Get initial inventory
    const initialInventory = await this.getInitialInventory(product.id, dateFrom);
    if (initialInventory) {
      currentStock = Number(initialInventory.quantity) || 0;
      currentCost = Number(product.prix_achat) || (Number(product.prix_vente_TTC) * 0.7) || 0;
      currentValue = currentStock * currentCost;
      totalSaleValue = currentStock * Number(product.prix_vente_TTC) || 0;
      saleAvgPrice = Number(product.prix_vente_TTC) || 0;
      
      if (this.valuationMode === 'FIFO' && currentStock > 0) {
        saleLayers.push({ qty: currentStock, price: saleAvgPrice });
      }

      rows.push({
        date: dateFrom,
        designation: 'Inventaire 1',
        achat: {
          entree: { qty: currentStock, pu: currentCost, totale: currentValue },
          sortie: { qty: 0, pu: 0, totale: 0 },
          solde: { qty: currentStock, pu: currentCost, totale: currentValue }
        },
        vente: {
          entree: { qty: 0, pu: 0, totale: 0 },
          sortie: { qty: 0, pu: 0, totale: 0 },
          solde: { qty: currentStock, pu: Number(product.prix_vente_TTC) || 0, totale: totalSaleValue }
        }
      });
    }

    // Filter movements for this product
    const productMovements = allStockMovements.filter(m => m.productId === product.id);
    
    // Get sales for this product
    const productSales = salesInRange.filter(sale => 
      sale.items?.some((item: any) => item.productId === product.id)
    );

    // Process stock movements
    for (const movement of productMovements) {
      const row: ReconciliationRow = {
        date: new Date(movement.date),
        designation: movement.designation,
        isWholesale: false,
        isGift: false,
        achat: {
          entree: { qty: 0, pu: 0, totale: 0 },
          sortie: { qty: 0, pu: 0, totale: 0 },
          solde: { qty: currentStock, pu: currentCost, totale: currentValue }
        },
        vente: {
          entree: { qty: 0, pu: 0, totale: 0 },
          sortie: { qty: 0, pu: 0, totale: 0 },
          solde: { qty: currentStock, pu: currentCost, totale: currentValue }
        }
      };

      if (movement.type === 'ACHAT_ENTREE') {
        const newQty = Number(movement.quantity) || 0;
        const newCost = Number(movement.unitCost) || 0;
        const newValue = newQty * newCost;

        row.achat.entree = { qty: newQty, pu: newCost, totale: newValue };

        if (this.valuationMode === 'CUMP') {
          const totalQty = currentStock + newQty;
          const totalValue = currentValue + newValue;
          currentCost = totalQty > 0 ? totalValue / totalQty : currentCost;
        } else {
          fifoLayers.push({
            qty: newQty,
            cost: newCost,
            date: new Date(movement.date)
          });
          const totalValue = fifoLayers.reduce((sum, layer) => sum + (layer.qty * layer.cost), 0);
          const totalQty = fifoLayers.reduce((sum, layer) => sum + layer.qty, 0);
          currentCost = totalQty > 0 ? totalValue / totalQty : currentCost;
          saleLayers.push({ qty: newQty, price: Number(product.prix_vente_TTC) || 0 });
        }

        currentStock += newQty;
        currentValue = currentStock * currentCost;
      }

      row.achat.solde = { qty: currentStock, pu: currentCost, totale: currentValue };
      row.vente.solde = { qty: currentStock, pu: saleAvgPrice, totale: currentStock * saleAvgPrice };
      rows.push(row);
    }

    // Process sales
    for (const sale of productSales) {
      const saleItems = sale.items?.filter((item: any) => item.productId === product.id) || [];
      
      for (const item of saleItems) {
        const outQty = Number(item.quantity) || 0;
        const outCost = this.valuationMode === 'CUMP' ? currentCost : this.getFIFOCost(fifoLayers, outQty);
        const unitPrice = Number(item.unitPrice) || 0;
        const totalPrice = outQty * unitPrice;
        const isGift = sale.status === 'CADEAU';
        const isWholesale = item.isWholesale || sale.isWholesale;

        const row: ReconciliationRow = {
          date: new Date(sale.createdAt),
          designation: `Vente #${sale.id}`,
          isWholesale,
          isGift,
          achat: {
            entree: { qty: 0, pu: 0, totale: 0 },
            sortie: { qty: outQty, pu: outCost, totale: outQty * outCost },
            solde: { qty: currentStock, pu: currentCost, totale: currentValue }
          },
          vente: {
            entree: { qty: 0, pu: 0, totale: 0 },
            sortie: { qty: outQty, pu: isGift ? 0 : unitPrice, totale: isGift ? 0 : totalPrice },
            solde: { qty: currentStock, pu: saleAvgPrice, totale: currentStock * saleAvgPrice }
          }
        };

        if (!isGift) {
          saleCumQty += outQty;
          saleCumValue += totalPrice;
          saleAvgPrice = saleCumQty > 0 ? (saleCumValue / saleCumQty) : saleAvgPrice;
        }

        if (this.valuationMode === 'FIFO') {
          this.consumeFIFOLayers(fifoLayers, outQty);
          const totalValue = fifoLayers.reduce((sum, layer) => sum + (layer.qty * layer.cost), 0);
          const totalQty = fifoLayers.reduce((sum, layer) => sum + layer.qty, 0);
          currentCost = totalQty > 0 ? totalValue / totalQty : currentCost;
          
          let remainingToConsume = outQty;
          for (let i = 0; i < saleLayers.length && remainingToConsume > 0; i++) {
            const sl = saleLayers[i];
            const take = Math.min(remainingToConsume, sl.qty);
            sl.qty -= take;
            remainingToConsume -= take;
            if (sl.qty <= 0) {
              saleLayers.splice(i, 1);
              i--;
            }
          }
        }

        currentStock -= outQty;
        currentValue = currentStock * currentCost;
        row.achat.solde = { qty: currentStock, pu: currentCost, totale: currentValue };
        
        if (this.valuationMode === 'FIFO') {
          const saleTotalQty = saleLayers.reduce((s, l) => s + l.qty, 0);
          const saleTotalValue = saleLayers.reduce((s, l) => s + (l.qty * l.price), 0);
          const salePu = saleTotalQty > 0 ? (saleTotalValue / saleTotalQty) : (Number(product.prix_vente_TTC) || 0);
          row.vente.solde = { qty: currentStock, pu: salePu, totale: saleTotalQty * salePu };
        } else {
          row.vente.solde = { qty: currentStock, pu: saleAvgPrice, totale: currentStock * saleAvgPrice };
        }

        rows.push(row);
      }
    }

    // Calculate summary
    const summary = this.calculateSummary(rows);

    // Calculate ecart data
    const ecartData = await this.calculateEcartDataOptimized(product, salesInRange);

    // Calculate Relevé Inventaire data
    // Get current inventory stock value directly - no calculations needed
    const solde = await this.getCurrentInventoryStockValue(product);
    
    const releveInventaire: ReleveInventaireRow = {
      id: `product_${product.id}`,
      designation: product.name,
      debut: 0, // Not used when using direct inventory value
      credit: 0, // Not used when using direct inventory value
      solde: solde, // Direct current inventory stock value
      type: 'ENTRY'
    };

    return {
      productId: product.id,
      productName: product.name,
      rows,
      summary,
      ecartData,
      releveInventaire
    };
  }

  private async generateProductReconciliation(product: Product, dateFrom: Date, dateTo: Date): Promise<ReconciliationData> {
    const rows: ReconciliationRow[] = [];
    let currentStock = 0;
    let currentCost = 0;
    let currentValue = 0;
    let totalSaleValue = 0; // Track total sale value for weighted average (legacy, no longer drives PU)
    // Track sale-only running average price (VENTE solde should not be affected by purchases in CUMP)
    let saleCumQty = 0;
    let saleCumValue = 0;
    let saleAvgPrice = Number(product.prix_vente_TTC) || 0;
    const fifoLayers: FIFOLayer[] = [];
    // FIFO sale layers for VENTE solde when mode === 'FIFO'
    const saleLayers: SaleLayer[] = [];


    // Get initial inventory (if any)
    const initialInventory = await this.getInitialInventory(product.id, dateFrom);
      if (initialInventory) {
        currentStock = Number(initialInventory.quantity) || 0;
        // Use the product's configured purchase price as the initial cost
        // If prix_achat is not set, use a reasonable default (e.g., 70% of sale price)
        currentCost = Number(product.prix_achat) || (Number(product.prix_vente_TTC) * 0.7) || 0;
        currentValue = currentStock * currentCost;
        // Initial sale value uses the product's default sale price
        totalSaleValue = currentStock * Number(product.prix_vente_TTC) || 0;
        // Initialize sale average with product default price
        saleAvgPrice = Number(product.prix_vente_TTC) || 0;
        
        // Initialize FIFO sale layers with initial stock at default sale price
        if (this.valuationMode === 'FIFO' && currentStock > 0) {
          saleLayers.push({ qty: currentStock, price: saleAvgPrice });
        }

      rows.push({
        date: dateFrom,
        designation: 'Inventaire 1',
        achat: {
          entree: { qty: currentStock, pu: currentCost, totale: currentValue },
          sortie: { qty: 0, pu: 0, totale: 0 },
          solde: { qty: currentStock, pu: currentCost, totale: currentValue }
        },
        vente: {
          entree: { qty: 0, pu: 0, totale: 0 },
          sortie: { qty: 0, pu: 0, totale: 0 },
          solde: { qty: currentStock, pu: Number(product.prix_vente_TTC) || 0, totale: totalSaleValue }
        }
      });
    }

    // Get all movements in date range
    const movements = await this.getProductMovements(product.id, dateFrom, dateTo);
    
    // Sort movements by date
    movements.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Process each movement
    for (const movement of movements) {
      const row: ReconciliationRow = {
        date: new Date(movement.date),
        designation: movement.designation,
        isWholesale: movement.isWholesale || false,
        isGift: (movement as any).isGift || false,
        achat: {
          entree: { qty: 0, pu: 0, totale: 0 },
          sortie: { qty: 0, pu: 0, totale: 0 },
          solde: { qty: currentStock, pu: currentCost, totale: currentValue }
        },
        vente: {
          entree: { qty: 0, pu: 0, totale: 0 },
          sortie: { qty: 0, pu: 0, totale: 0 },
          solde: { qty: currentStock, pu: currentCost, totale: currentValue }
        }
      };

      // Process Achat movements
      if (movement.type === 'ACHAT_ENTREE') {
        const newQty = Number(movement.quantity) || 0;
        const newCost = Number(movement.unitCost) || 0;
        const newValue = newQty * newCost;

        row.achat.entree = { qty: newQty, pu: newCost, totale: newValue };

        if (this.valuationMode === 'CUMP') {
          // Weighted average calculation
          const totalQty = currentStock + newQty;
          const totalValue = currentValue + newValue;
          currentCost = totalQty > 0 ? totalValue / totalQty : currentCost;
        } else { // FIFO
          fifoLayers.push({
            qty: newQty,
            cost: newCost,
            date: new Date(movement.date)
          });
          // Recalculate current cost from layers
          const totalValue = fifoLayers.reduce((sum, layer) => sum + (layer.qty * layer.cost), 0);
          const totalQty = fifoLayers.reduce((sum, layer) => sum + layer.qty, 0);
          currentCost = totalQty > 0 ? totalValue / totalQty : currentCost;
          
          // Also add sale layer at default sale price for VENTE solde FIFO
          const defaultSalePrice = Number(product.prix_vente_TTC) || 0;
          saleLayers.push({ qty: newQty, price: defaultSalePrice });
        }

        currentStock += newQty;
        currentValue = currentStock * currentCost;
      } else if (movement.type === 'ACHAT_SORTIE') {
        const outQty = Number(movement.quantity) || 0;
        const outCost = this.valuationMode === 'CUMP' ? currentCost : this.getFIFOCost(fifoLayers, outQty);

        row.achat.sortie = { qty: outQty, pu: outCost, totale: outQty * outCost };

        if (this.valuationMode === 'FIFO') {
          this.consumeFIFOLayers(fifoLayers, outQty);
          // Recalculate current cost from remaining layers
          const totalValue = fifoLayers.reduce((sum, layer) => sum + (layer.qty * layer.cost), 0);
          const totalQty = fifoLayers.reduce((sum, layer) => sum + layer.qty, 0);
          currentCost = totalQty > 0 ? totalValue / totalQty : currentCost;
        }

        currentStock -= outQty;
        currentValue = currentStock * currentCost;
      }

      // Process Vente movements
      if (movement.type === 'VENTE_SORTIE') {
        const outQty = Number(movement.quantity) || 0;
        const outCost = this.valuationMode === 'CUMP' ? currentCost : this.getFIFOCost(fifoLayers, outQty);

        // VENTE sortie shows at sale price
        let unitPrice = Number(movement.unitPrice) || 0;
        let totalPrice = outQty * unitPrice;
        
        if (movement.isWholesale && outQty > 0) {
          // For wholesale sales, use bundle information to calculate per-unit price
          const bundleSize = (movement as any).bundleSize;
          const bundlePrice = (movement as any).bundlePrice;
          
          if (bundleSize && bundlePrice) {
            // Calculate per-unit price from bundle information
            unitPrice = Number(bundlePrice) / Number(bundleSize);
            totalPrice = outQty * unitPrice;
          } else {
            // Fallback: use the unitPrice as is (it should already be per-unit)
            unitPrice = Number(movement.unitPrice) || 0;
            totalPrice = outQty * unitPrice;
          }
        }
        
        // For gift sales, show 0 price but still consume inventory
        if ((movement as any).isGift) {
          unitPrice = 0;
          totalPrice = 0;
        }
        
        row.vente.sortie = { qty: outQty, pu: unitPrice, totale: totalPrice };
        
        // Update sale-only running average based on actual sales (excluding gifts)
        if (!(movement as any).isGift) {
          saleCumQty += outQty;
          saleCumValue += totalPrice;
          saleAvgPrice = saleCumQty > 0 ? (saleCumValue / saleCumQty) : saleAvgPrice;
        }
        
        // Remove any coupling between purchases and VENTE solde
        // totalSaleValue is no longer used to compute sale PU; keep for backward compatibility if needed
        
        // Record COGS at cost for this sale (CUMP or FIFO depending on mode)
        (row as any).cogs = outQty * outCost;
        
        // ACHAT sortie shows the same quantity at cost price (what it cost us)
        row.achat.sortie = { qty: outQty, pu: outCost, totale: outQty * outCost };

        if (this.valuationMode === 'FIFO') {
          this.consumeFIFOLayers(fifoLayers, outQty);
          // Recalculate current cost from remaining layers
          const totalValue = fifoLayers.reduce((sum, layer) => sum + (layer.qty * layer.cost), 0);
          const totalQty = fifoLayers.reduce((sum, layer) => sum + layer.qty, 0);
          currentCost = totalQty > 0 ? totalValue / totalQty : currentCost;
          
          // Consume sale layers FIFO for VENTE solde
          let remainingToConsume = outQty;
          for (let i = 0; i < saleLayers.length && remainingToConsume > 0; i++) {
            const sl = saleLayers[i];
            const take = Math.min(remainingToConsume, sl.qty);
            sl.qty -= take;
            remainingToConsume -= take;
            if (sl.qty <= 0) {
              saleLayers.splice(i, 1);
              i--;
            }
          }
        }

        currentStock -= outQty;
        currentValue = currentStock * currentCost;
      } else if (movement.type === 'VENTE_ENTREE') {
        const inQty = Number(movement.quantity) || 0;
        const inCost = Number(movement.unitCost) || 0;

        row.vente.entree = { qty: inQty, pu: inCost, totale: inQty * inCost };

        if (this.valuationMode === 'CUMP') {
          // Weighted average calculation
          const totalQty = currentStock + inQty;
          const totalValue = currentValue + (inQty * inCost);
          currentCost = totalQty > 0 ? totalValue / totalQty : currentCost;
        } else { // FIFO
          fifoLayers.push({
            qty: inQty,
            cost: inCost,
            date: new Date(movement.date)
          });
          // Recalculate current cost from layers
          const totalValue = fifoLayers.reduce((sum, layer) => sum + (layer.qty * layer.cost), 0);
          const totalQty = fifoLayers.reduce((sum, layer) => sum + layer.qty, 0);
          currentCost = totalQty > 0 ? totalValue / totalQty : currentCost;
          
          // Add sale layer at default sale price for VENTE solde FIFO
          const defaultSalePrice = Number(product.prix_vente_TTC) || 0;
          saleLayers.push({ qty: inQty, price: defaultSalePrice });
        }

        currentStock += inQty;
        currentValue = currentStock * currentCost;
        // Do NOT change saleAvgPrice on purchases; VENTE solde must not be affected by purchases
        // Remove: valuing purchases at any sale price for VENTE solde
        // Previously we added to totalSaleValue; we stop doing that to keep PU stable
      }

      // Update solde values
      row.achat.solde = { qty: currentStock, pu: currentCost, totale: currentValue };
      // VENTE Solde: CUMP uses sales-driven average; FIFO uses remaining sale layers avg
      if (this.valuationMode === 'FIFO') {
        const saleTotalQty = saleLayers.reduce((s, l) => s + l.qty, 0);
        const saleTotalValue = saleLayers.reduce((s, l) => s + (l.qty * l.price), 0);
        const salePu = saleTotalQty > 0 ? (saleTotalValue / saleTotalQty) : (Number(product.prix_vente_TTC) || 0);
        row.vente.solde = { qty: currentStock, pu: salePu, totale: saleTotalQty * salePu };
      } else {
        row.vente.solde = { qty: currentStock, pu: saleAvgPrice, totale: currentStock * saleAvgPrice };
      }

      rows.push(row);
    }


    // Calculate summary
    const summary = this.calculateSummary(rows);

    // Calculate ecart data
    const ecartData = await this.calculateEcartData(product, dateFrom, dateTo);

    // Calculate Relevé Inventaire data for this product
    // Get current inventory stock value directly - no calculations needed
    const solde = await this.getCurrentInventoryStockValue(product);
    
    const releveInventaire: ReleveInventaireRow = {
      id: `product_${product.id}`,
      designation: product.name,
      debut: 0, // Not used when using direct inventory value
      credit: 0, // Not used when using direct inventory value
      solde: solde, // Direct current inventory stock value
      type: 'ENTRY'
    };

    return {
      productId: product.id,
      productName: product.name,
      rows,
      summary,
      ecartData,
      releveInventaire
    };
  }

  private calculateEcartDataBulk(product: Product, salesInRange: any[]): EcartData {
    try {
      let qtyVendu = 0;
      let chiffreAffaireRealise = 0;
      let qtyVenduGros = 0;
      let prixVenteGros = 0;
      let qtyGratuite = 0;
      let ecartGratuite = 0;
      let ecartRemise = 0;

      // Process each sale from pre-fetched data
      for (const sale of salesInRange) {
        const saleItems = sale.items?.filter((item: any) => item.productId === product.id) || [];
        
        for (const item of saleItems) {
          const itemQty = Number(item.quantity) || 0;
          const itemPrice = Number(item.unitPrice) || 0;
          const itemTotal = Number(item.total) || 0;
          const isWholesale = item.isWholesale || sale.isWholesale;
          const isGift = sale.status === 'CADEAU' || itemTotal === 0;
          const discount = Number(item.discount) || 0;

          qtyVendu += itemQty;
          
          if (isGift) {
            qtyGratuite += itemQty;
          } else {
            chiffreAffaireRealise += itemTotal;
          }

          if (isWholesale) {
            qtyVenduGros += itemQty;
            prixVenteGros += itemTotal;
          }

          if (discount > 0) {
            ecartRemise += discount;
          }
        }
      }

      const prixVenteUnitaire = Number(product.prix_vente_TTC) || 0;
      const chiffreAffaireTheorique = qtyVendu * prixVenteUnitaire;
      
      ecartGratuite = qtyGratuite * prixVenteUnitaire;
      
      const ecartVenteGros = qtyVenduGros > 0 ? 
        prixVenteGros - (qtyVenduGros * prixVenteUnitaire) : 0;

      const ecartGlobal = chiffreAffaireTheorique - chiffreAffaireRealise;
      const deferenceEcart = chiffreAffaireTheorique - (chiffreAffaireRealise + ecartGlobal);

      return {
        productId: product.id,
        productName: product.name,
        qtyVendu,
        prixVenteUnitaire,
        chiffreAffaireTheorique,
        chiffreAffaireRealise,
        ecartVenteGros,
        ecartGratuite,
        ecartRemise,
        ecartGlobal,
        deferenceEcart
      };
    } catch (error) {
      console.error('Error calculating ecart data:', error);
      return {
        productId: product.id,
        productName: product.name,
        qtyVendu: 0,
        prixVenteUnitaire: 0,
        chiffreAffaireTheorique: 0,
        chiffreAffaireRealise: 0,
        ecartVenteGros: 0,
        ecartGratuite: 0,
        ecartRemise: 0,
        ecartGlobal: 0,
        deferenceEcart: 0
      };
    }
  }

  private calculateDebutForReleveBulk(product: Product, allStockMovements: any[]): number {
    try {
      // For bulk processing, we'll use a simplified approach
      // In a real implementation, you might want to pre-fetch inventory data
      // For now, we'll return 0 and let the individual method handle it
      return 0;
    } catch (err) {
      console.error('Error calculating debut for product:', product.id, err);
      return 0;
    }
  }

  private calculateCreditForReleveBulk(product: Product, salesInRange: any[]): number {
    try {
      let totalCredit = 0;
      
      // Only include actual sales revenue (no ecart calculations)
      for (const sale of salesInRange) {
        const saleItems = sale.items?.filter((item: any) => item.productId === product.id) || [];
        for (const item of saleItems) {
          const itemTotal = Number(item.total) || 0;
          totalCredit += itemTotal;
        }
      }
      
      return totalCredit;
    } catch (err) {
      console.error('Error calculating credit for product:', product.id, err);
      return 0;
    }
  }

  private async calculateEcartDataOptimized(product: Product, salesInRange: any[]): Promise<EcartData> {
    try {
      let qtyVendu = 0;
      let chiffreAffaireRealise = 0;
      let qtyVenduGros = 0;
      let prixVenteGros = 0;
      let qtyGratuite = 0;
      let ecartGratuite = 0;
      let ecartRemise = 0;

      // Process each sale
      for (const sale of salesInRange) {
        const saleItems = sale.items?.filter((item: any) => item.productId === product.id) || [];
        
        for (const item of saleItems) {
          const itemQty = Number(item.quantity) || 0;
          const itemPrice = Number(item.unitPrice) || 0;
          const itemTotal = Number(item.total) || 0;
          const isWholesale = item.isWholesale || sale.isWholesale;
          const isGift = sale.status === 'CADEAU' || itemTotal === 0;
          const discount = Number(item.discount) || 0;

          qtyVendu += itemQty;
          
          if (isGift) {
            qtyGratuite += itemQty;
          } else {
            chiffreAffaireRealise += itemTotal;
          }

          if (isWholesale) {
            qtyVenduGros += itemQty;
            prixVenteGros += itemTotal;
          }

          if (discount > 0) {
            ecartRemise += discount;
          }
        }
      }

      const prixVenteUnitaire = Number(product.prix_vente_TTC) || 0;
      const chiffreAffaireTheorique = qtyVendu * prixVenteUnitaire;
      
      ecartGratuite = qtyGratuite * prixVenteUnitaire;
      
      const ecartVenteGros = qtyVenduGros > 0 ? 
        prixVenteGros - (qtyVenduGros * prixVenteUnitaire) : 0;

      const ecartGlobal = chiffreAffaireTheorique - chiffreAffaireRealise;
      const deferenceEcart = chiffreAffaireTheorique - (chiffreAffaireRealise + ecartGlobal);

      return {
        productId: product.id,
        productName: product.name,
        qtyVendu,
        prixVenteUnitaire,
        chiffreAffaireTheorique,
        chiffreAffaireRealise,
        ecartVenteGros,
        ecartGratuite,
        ecartRemise,
        ecartGlobal,
        deferenceEcart
      };
    } catch (error) {
      console.error('Error calculating ecart data:', error);
      return {
        productId: product.id,
        productName: product.name,
        qtyVendu: 0,
        prixVenteUnitaire: 0,
        chiffreAffaireTheorique: 0,
        chiffreAffaireRealise: 0,
        ecartVenteGros: 0,
        ecartGratuite: 0,
        ecartRemise: 0,
        ecartGlobal: 0,
        deferenceEcart: 0
      };
    }
  }

  private async calculateEcartData(product: Product, dateFrom: Date, dateTo: Date): Promise<EcartData> {
    try {
      // Get sales data for the product in the date range
      const sales = await firstValueFrom(this.salesService.getSales());
      const salesArray = Array.isArray(sales) ? sales : [];
      
      const salesInRange = salesArray.filter(sale => {
        const saleDate = new Date(sale.createdAt);
        return saleDate >= dateFrom && saleDate <= dateTo;
      });

      let qtyVendu = 0;
      let chiffreAffaireRealise = 0;
      let qtyVenduGros = 0;
      let prixVenteGros = 0;
      let qtyGratuite = 0;
      let ecartGratuite = 0;
      let ecartRemise = 0;

      // Process each sale
      for (const sale of salesInRange) {
        const saleItems = sale.items?.filter((item: any) => item.productId === product.id) || [];
        
        for (const item of saleItems) {
          const itemQty = Number(item.quantity) || 0;
          const itemPrice = Number(item.unitPrice) || 0;
          const itemTotal = Number(item.total) || 0;
          const isWholesale = item.isWholesale || sale.isWholesale;
          const isGift = sale.status === 'CADEAU' || itemTotal === 0;
          const discount = Number(item.discount) || 0;

          qtyVendu += itemQty;
          
          if (isGift) {
            qtyGratuite += itemQty;
            // Pour les cadeaux, on ne compte pas dans le CA réalisé
          } else {
            chiffreAffaireRealise += itemTotal;
          }

          if (isWholesale) {
            qtyVenduGros += itemQty;
            prixVenteGros += itemTotal;
          }

          if (discount > 0) {
            ecartRemise += discount;
          }
        }
      }

      const prixVenteUnitaire = Number(product.prix_vente_TTC) || 0;
      const chiffreAffaireTheorique = qtyVendu * prixVenteUnitaire;
      
      // Écart gratuité: quantité gratuite × prix unitaire
      ecartGratuite = qtyGratuite * prixVenteUnitaire;
      
      // Écart vente en gros: (qté vendu en gros * prix de vente en gros) - (qté vendu en gros * prix de vente unitaire)
      const ecartVenteGros = qtyVenduGros > 0 ? 
        prixVenteGros - (qtyVenduGros * prixVenteUnitaire) : 0;

      // Écart global: (qté vendu * prix de vente unitaire) - (chiffre d'affaire réalisé)
      const ecartGlobal = chiffreAffaireTheorique - chiffreAffaireRealise;

      // Déférence d'écart: écart théorique - (écart réalisé + écart global)
      const deferenceEcart = chiffreAffaireTheorique - (chiffreAffaireRealise + ecartGlobal);

      // Debug logs

      return {
        productId: product.id,
        productName: product.name,
        qtyVendu,
        prixVenteUnitaire,
        chiffreAffaireTheorique,
        chiffreAffaireRealise,
        ecartVenteGros,
        ecartGratuite,
        ecartRemise,
        ecartGlobal,
        deferenceEcart
      };
    } catch (error) {
      console.error('Error calculating ecart data:', error);
      return {
        productId: product.id,
        productName: product.name,
        qtyVendu: 0,
        prixVenteUnitaire: 0,
        chiffreAffaireTheorique: 0,
        chiffreAffaireRealise: 0,
        ecartVenteGros: 0,
        ecartGratuite: 0,
        ecartRemise: 0,
        ecartGlobal: 0,
        deferenceEcart: 0
      };
    }
  }

  private calculateGlobalEcartSummary(data: ReconciliationData[]): GlobalEcartSummary {
    const productsWithEcart = data.filter(d => d.ecartData);
    const ecartProducts = productsWithEcart.map(d => d.ecartData!);

    const summary: GlobalEcartSummary = {
      totalProducts: ecartProducts.length,
      totalQtyVendu: ecartProducts.reduce((sum, p) => sum + p.qtyVendu, 0),
      totalChiffreAffaireTheorique: ecartProducts.reduce((sum, p) => sum + p.chiffreAffaireTheorique, 0),
      totalChiffreAffaireRealise: ecartProducts.reduce((sum, p) => sum + p.chiffreAffaireRealise, 0),
      totalEcartVenteGros: ecartProducts.reduce((sum, p) => sum + p.ecartVenteGros, 0),
      totalEcartGratuite: ecartProducts.reduce((sum, p) => sum + p.ecartGratuite, 0),
      totalEcartRemise: ecartProducts.reduce((sum, p) => sum + p.ecartRemise, 0),
      totalEcartGlobal: ecartProducts.reduce((sum, p) => sum + p.ecartGlobal, 0),
      totalDeferenceEcart: ecartProducts.reduce((sum, p) => sum + p.deferenceEcart, 0),
      products: ecartProducts
    };

    return summary;
  }

  private getFIFOCost(layers: FIFOLayer[], qty: number): number {
    let remainingQty = qty;
    let totalCost = 0;

    for (const layer of layers) {
      if (remainingQty <= 0) break;
      
      const consumeQty = Math.min(remainingQty, layer.qty);
      totalCost += consumeQty * layer.cost;
      remainingQty -= consumeQty;
    }

    return qty > 0 ? totalCost / qty : 0;
  }

  private consumeFIFOLayers(layers: FIFOLayer[], qty: number): void {
    let remainingQty = qty;

    for (let i = 0; i < layers.length && remainingQty > 0; i++) {
      const layer = layers[i];
      const consumeQty = Math.min(remainingQty, layer.qty);
      
      layer.qty -= consumeQty;
      remainingQty -= consumeQty;

      if (layer.qty <= 0) {
        layers.splice(i, 1);
        i--; // Adjust index after removal
      }
    }
  }

  private calculateSummary(rows: ReconciliationRow[]): ReconciliationData['summary'] {
    let totalAchatEntree = { qty: 0, totale: 0 };
    let totalAchatSortie = { qty: 0, totale: 0 };
    let totalVenteEntree = { qty: 0, totale: 0 };
    let totalVenteSortie = { qty: 0, totale: 0 };
    let cogs = 0;

    for (const row of rows) {
      totalAchatEntree.qty += row.achat.entree.qty;
      totalAchatEntree.totale += row.achat.entree.totale;
      
      totalAchatSortie.qty += row.achat.sortie.qty;
      totalAchatSortie.totale += row.achat.sortie.totale;
      
      totalVenteEntree.qty += row.vente.entree.qty;
      totalVenteEntree.totale += row.vente.entree.totale;
      
      totalVenteSortie.qty += row.vente.sortie.qty;
      totalVenteSortie.totale += row.vente.sortie.totale;
      
      // COGS is the cost of goods sold, accumulated from each sale row at cost (FIFO/CUMP)
      const rowCogs = (row as any).cogs || 0;
      cogs += rowCogs;
    }

    const lastRow = rows[rows.length - 1];
    const endingStock = {
      qty: lastRow ? lastRow.vente.solde.qty : 0,
      value: lastRow ? lastRow.vente.solde.totale : 0,
      pu: lastRow ? lastRow.vente.solde.pu : 0
    };

    return {
      totalAchatEntree,
      totalAchatSortie,
      totalVenteEntree,
      totalVenteSortie,
      cogs,
      endingStock
    };
  }

  private async getInitialInventory(productId: number, dateFrom: Date): Promise<{ quantity: number; cost: number } | null> {
    try {
      // Get all inventory data and filter by product ID
      const inventoryList = await firstValueFrom(this.http.get<any[]>(`${environment.apiUrl}/stock/inventory`));
      // Find inventory for the specific product
      const productInventory = inventoryList?.find(item => item.productId === productId);
      
      if (productInventory && Number(productInventory.quantity) > 0) {
        return {
          quantity: Number(productInventory.quantity),
          cost: 0 // Cost will be determined from product's prix_achat in the reconciliation logic
        };
      }
      
      return null;
    } catch (err) {
      console.error('Error loading initial inventory:', err);
      return null;
    }
  }

  private async getProductMovements(productId: number, dateFrom: Date, dateTo: Date): Promise<any[]> {
    const movements: any[] = [];

    try {
      // Get sales data
      const sales = await firstValueFrom(this.salesService.getSales());
      
      // Ensure sales is an array
      const salesArray = Array.isArray(sales) ? sales : [];
      const salesInRange = salesArray.filter(sale => {
        const saleDate = new Date(sale.createdAt);
        return saleDate >= dateFrom && saleDate <= dateTo;
      });
      

      for (const sale of salesInRange) {
        const saleItems = sale.items?.filter((item: SaleItem) => item.productId === productId) || [];
        for (const item of saleItems) {
          // Check if this is a wholesale sale based on the actual wholesale flags from caisse
          const isWholesale = item.isWholesale || sale.isWholesale;
          // Check if this is a gift sale
          const isGift = sale.status === 'CADEAU';
          
          // Determine designation based on sale type
          let designation = `Vente #${sale.id}`;
          if (isGift) {
            designation += ' (CADEAU)';
          } else if (isWholesale) {
            designation += ' (GROS)';
          }
          
          movements.push({
            date: sale.createdAt,
            designation: designation,
            type: 'VENTE_SORTIE',
            quantity: Number(item.quantity) || 0,
            unitPrice: isGift ? 0 : (Number(item.unitPrice) || 0), // Gift sales have 0 price
            unitCost: 0, // Will be calculated based on valuation method
            isWholesale: isWholesale,
            isGift: isGift,
            // Include bundle information for wholesale sales
            bundleSize: item.bundleSize,
            bundlePrice: item.bundlePrice
          });
        }
      }


      // Get stock entry data
      try {
        const response = await firstValueFrom(this.http.get<any>(`${environment.apiUrl}/stock-documents`, {
          params: {
            type: 'BON_ENTREE_DEPOT',
            dateFrom: dateFrom.toISOString(),
            dateTo: dateTo.toISOString()
          }
        }));

        // Handle different response formats
        let entries = [];
        if (Array.isArray(response)) {
          entries = response;
        } else if (response && Array.isArray(response.data)) {
          entries = response.data;
        } else if (response && response.stockDocuments && Array.isArray(response.stockDocuments)) {
          entries = response.stockDocuments;
        } else {
          entries = [];
        }
        for (const entry of entries) {
          const items = entry.items?.filter((item: any) => item.productId === productId) || [];
          for (const item of items) {
            movements.push({
              date: entry.createdAt,
              designation: `Achat #${entry.numero}`,
              type: 'ACHAT_ENTREE',
              quantity: Number(item.quantity) || 0,
              unitCost: Number(item.purchasePrice) || 0
            });
          }
        }

      } catch (err) {
        console.error('Error loading stock entries:', err);
      }


    } catch (err) {
      console.error('Error in getProductMovements:', err);
    }

    return movements;
  }

  exportToExcel(): void {
    if (this.reconciliationData.length === 0) {
      this.error = 'Aucune donnée à exporter';
      return;
    }

    // Create Excel-like CSV with multi-level headers
    let csvContent = this.generateCSVContent();
    this.downloadFile(csvContent, 'reconciliation-inventaire-ventes.csv', 'text/csv');
  }

  exportToCSV(): void {
    if (this.reconciliationData.length === 0) {
      this.error = 'Aucune donnée à exporter';
      return;
    }

    // Create CSV with multi-level headers
    let csvContent = this.generateCSVContent();
    this.downloadFile(csvContent, 'reconciliation-inventaire-ventes.csv', 'text/csv');
  }

  private generateCSVContent(): string {
    let csvContent = '';
    
    // Add BOM for proper UTF-8 encoding
    csvContent += '\uFEFF';
    
    // Add report metadata
    csvContent += `Rapport de Réconciliation Inventaire & Ventes\n`;
    csvContent += `Généré le: ${new Date().toLocaleString('fr-FR')}\n`;
    csvContent += `Mode de valorisation: ${this.getValuationModeLabel(this.valuationMode)}\n`;
    csvContent += `\n`;

    for (const data of this.reconciliationData) {
      // Product header
      csvContent += `Produit: ${data.productName} (ID: ${data.productId})\n`;
      csvContent += `\n`;

      // Multi-level header
      csvContent += `Date,Désignation,`;
      csvContent += `Achat Entrée Qté,Achat Entrée P.U,Achat Entrée Totale,`;
      csvContent += `Vente Sortie Qté,Vente Sortie P.U,Vente Sortie Totale\n`;

      // Data rows
      for (const row of data.rows) {
        const designation = row.isWholesale ? `${row.designation} (GROS)` : row.designation;
        csvContent += `${this.formatDate(row.date)},${designation},`;
        csvContent += `${this.formatNumber(row.achat.entree.qty)},${this.formatNumber(row.achat.entree.pu)},${this.formatNumber(row.achat.entree.totale)},`;
        csvContent += `${this.formatNumber(row.vente.sortie.qty)},${this.formatNumber(row.vente.sortie.pu)},${this.formatNumber(row.vente.sortie.totale)}\n`;
      }

      // Summary
      csvContent += `\n`;
      csvContent += `Résumé:\n`;
      csvContent += `Achat Entrée - Qté: ${this.formatNumber(data.summary.totalAchatEntree.qty)}, Total: ${this.formatNumber(data.summary.totalAchatEntree.totale)} dt\n`;
      csvContent += `Achat Sortie - Qté: ${this.formatNumber(data.summary.totalAchatSortie.qty)}, Total: ${this.formatNumber(data.summary.totalAchatSortie.totale)} dt\n`;
      csvContent += `Vente Sortie - Qté: ${this.formatNumber(data.summary.totalVenteSortie.qty)}, Total: ${this.formatNumber(data.summary.totalVenteSortie.totale)} dt\n`;
      csvContent += `Stock Final - Qté: ${this.formatNumber(data.summary.endingStock.qty)}, Valeur: ${this.formatNumber(data.summary.endingStock.value)} dt, P.U: ${this.formatNumber(data.summary.endingStock.pu)} dt\n`;
      csvContent += `COGS (${this.valuationMode}): ${this.formatNumber(data.summary.cogs)} dt\n`;
      
      // Écart Data
      if (data.ecartData) {
        csvContent += `\n`;
        csvContent += `Tableau des Écarts:\n`;
        csvContent += `Produit,Qté Vendue,Prix Vente Unitaire,CA Théorique,CA Réalisé,Écart Vente Gros,Écart Gratuité,Écart Remise,Écart Global,Déférence d'Écart\n`;
        csvContent += `${data.ecartData.productName},${this.formatNumber(data.ecartData.qtyVendu)},${this.formatNumber(data.ecartData.prixVenteUnitaire)},${this.formatNumber(data.ecartData.chiffreAffaireTheorique)},${this.formatNumber(data.ecartData.chiffreAffaireRealise)},${this.formatNumber(data.ecartData.ecartVenteGros)},${this.formatNumber(data.ecartData.ecartGratuite)},${this.formatNumber(data.ecartData.ecartRemise)},${this.formatNumber(data.ecartData.ecartGlobal)},${this.formatNumber(data.ecartData.deferenceEcart)}\n`;
      }
    }

    return csvContent;
  }

  // Helpers used by template and CSV
  formatDate(d: Date | string): string {
    const date = typeof d === 'string' ? new Date(d) : d;
    if (!date) return '';
    return date.toLocaleString('fr-FR');
  }

  formatNumber(value: any): string {
    const n = Number(value);
    if (!isFinite(n) || n === 0) return '—';
    return n.toLocaleString('fr-FR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  }

  formatQuantity(value: any): string {
    const n = Number(value);
    if (!isFinite(n) || n === 0) return '—';
    return Math.round(n).toString();
  }

  getValuationModeLabel(mode: ValuationMode): string {
    switch (mode) {
      case 'CUMP': return 'CUMP (Moyenne Pondérée)';
      case 'FIFO': return 'FIFO (Premier Entré, Premier Sorti)';
      default: return String(mode);
    }
  }

  private downloadFile(content: string, filename: string, mime: string): void {
    const blob = new Blob([content], { type: mime + ';charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Relevé Inventaire methods - Bulk processing with no API calls
  async generateReleveInventaireFromReconciliationData(): Promise<void> {
    const releveRows: ReleveInventaireRow[] = [];
    
    // Set inventory mode to true when generating from reconciliation data
    this.isInventoryMode = true;

    // Load existing credit entries to avoid duplicates
    await this.loadExistingCreditEntries();
    
    // Load existing manual entries
    await this.loadExistingManualEntries();
    
    // 1. Calculer le total des entrées pour référence (pas affiché)
    const totalDebut = await this.calculateTotalDebut();

    // Collect all transactions to sort by date
    const allTransactions: ReleveInventaireRow[] = [];
    const processedTransactionIds = new Set<string>(); // Global duplicate prevention
    
    // Helper function to add transaction only if not already processed
    const addTransactionIfNotDuplicate = (transaction: ReleveInventaireRow) => {
      if (!processedTransactionIds.has(transaction.id)) {
        processedTransactionIds.add(transaction.id);
        allTransactions.push(transaction);
        
        // If in inventory mode and secondary table exists, also add to secondary table
        if (this.isInventoryMode && this.secondaryReleveRows.length > 0) {
          // Calculate running solde for secondary table
          const lastSecondarySolde = this.secondaryReleveRows[this.secondaryReleveRows.length - 1]?.solde || 0;
          const newSolde = lastSecondarySolde + (transaction.debut || 0) - (transaction.credit || 0);
          
          const secondaryTransaction: ReleveInventaireRow = {
            ...transaction,
            solde: newSolde
          };
          this.secondaryReleveRows.push(secondaryTransaction);
        }
        
        return true;
      }
      return false;
    };
    
    // 0. INVENTAIRE - All posted inventory sessions ordered by date/time
    const allInventorySessions = await this.getAllPostedInventorySessions();
    const inventoryData = await this.getInventoryData();
    
    // Add each inventory session as a separate line
    for (const inventorySession of allInventorySessions) {
      // Calculate total inventory value using COUNTED quantities from inventory session
      let totalInventoryValue = 0;
      if (inventorySession.items && inventorySession.items.length > 0) {
        for (const sessionItem of inventorySession.items) {
          const product = this.products.find(p => p.id === sessionItem.productId);
          if (product) {
            const countedQuantity = sessionItem.countedQuantity != null ? Number(sessionItem.countedQuantity) : 0;
            const unitPrice = Number(product.prix_vente_TTC) || 0;
            totalInventoryValue += countedQuantity * unitPrice;
          }
        }
      }
      
      // Calculate inventory variance (ecart) for display in designation only
      let inventoryVariance = 0;
      if (inventorySession.items && inventorySession.items.length > 0) {
        for (const sessionItem of inventorySession.items) {
          const product = this.products.find(p => p.id === sessionItem.productId);
          if (product && sessionItem.ecartQuantity !== null && sessionItem.ecartQuantity !== 0) {
            const ecartValue = sessionItem.ecartQuantity * Number(product.prix_vente_TTC);
            inventoryVariance += ecartValue;
          }
        }
      }
      
      // Use postedAt from inventory session (this is the actual inventory date)
      let inventoryDate = new Date();
      if (inventorySession?.postedAt) {
        try {
          inventoryDate = new Date(inventorySession.postedAt);
          if (isNaN(inventoryDate.getTime())) {
            inventoryDate = new Date(inventorySession.postedAt.replace(' ', 'T') + 'Z');
          }
          if (isNaN(inventoryDate.getTime())) {
            inventoryDate = new Date();
          }
        } catch (err) {
          console.error('Error parsing inventory date:', err);
          inventoryDate = new Date();
        }
      }
      
      // Clean up any existing inventory discrepancy credit entries (remove manual credits)
      await this.cleanupOldInventoryEcartCredits();

      // Add inventory line - direct solde from inventory, no variance applied
      const ecartText = inventoryVariance !== 0 ? ` | Écart: ${inventoryVariance >= 0 ? '+' : ''}${inventoryVariance.toFixed(2)} DT` : '';
      addTransactionIfNotDuplicate({
        id: `inventory_${inventorySession.id}`,
        designation: 'INVENTAIRE' + ecartText,
        debut: 0,
        credit: 0,
        solde: totalInventoryValue,
        type: 'INVENTORY' as const,
        details: `Inventaire: ${inventorySession.items?.length || 0} produits${ecartText}`,
        date: inventoryDate,
        createdAt: inventorySession?.postedAt || inventorySession?.closedAt || inventoryDate.toISOString(),
        isInventory: true,
        totalInventoryValue: totalInventoryValue
      });
      // Track last inventory solde for chaining
      this.lastInventorySolde = totalInventoryValue;
    }
    
    // 1. Lignes DÉBIT - Chaque bon d'entrée comme ligne séparée (pas de somme)
    const stockEntries = await this.getStockEntriesDetails();
    
    // Grouper les entrées par document (bon d'entrée)
    const entriesByDocument = new Map();
    
    for (const entry of stockEntries) {
      const docId = entry.documentId;
      if (!entriesByDocument.has(docId)) {
        entriesByDocument.set(docId, {
          documentId: docId,
          documentNumber: entry.documentNumber,
          date: entry.date,
          depotName: entry.depotName,
          supplierName: entry.supplierName,
          items: []
        });
      }
      entriesByDocument.get(docId).items.push(entry);
    }
    
    
    // Afficher chaque bon d'entrée comme une ligne séparée
    for (const [docId, docData] of entriesByDocument) {
      const totalDocAmount = docData.items.reduce((sum: number, item: any) => sum + item.amount, 0);
      
      
      // Ligne principale du bon d'entrée (DÉBIT)
      const docRow: ReleveInventaireRow = {
        id: `bon_entree_${docId}`,
        designation: `Bon d'Entrée #${docData.documentNumber} - ${docData.date.toLocaleDateString()}`,
        debut: totalDocAmount,
        credit: 0,
        solde: totalDocAmount,
        type: 'ENTRY' as const,
        details: `Dépôt: ${docData.depotName} | Fournisseur: ${docData.supplierName} | ${docData.items.length} articles`,
        date: new Date(docData.createdAt || docData.date) // Use createdAt for proper ordering
      };
      
      addTransactionIfNotDuplicate(docRow);
      
      // Lignes détaillées pour chaque article du bon (DÉBIT)
      for (const item of docData.items) {
        const itemRow: ReleveInventaireRow = {
          id: `item_${item.id}`,
          designation: `  └─ ${item.productName} (${item.quantity} × ${item.unitPrice})`,
          debut: item.amount,
          credit: 0,
          solde: item.amount,
          type: 'ENTRY' as const,
          details: `Article: ${item.productName} | Qty: ${item.quantity} | Prix: ${item.unitPrice} DT`,
          date: new Date(item.createdAt || item.date), // Use createdAt for proper ordering
          parentId: `bon_entree_${docId}` // Link to parent document
        };
        
        addTransactionIfNotDuplicate(itemRow);
      }
    }
    
    if (entriesByDocument.size === 0) {
      addTransactionIfNotDuplicate({
        id: 'no_stock_entries',
        designation: 'Aucune entrée de stock trouvée',
        debut: 0,
        credit: 0,
        solde: 0,
        type: 'CREDIT' as const,
        details: 'Vérifiez l\'API /stock/documents/bon-entree',
        date: new Date()
      });
    }
    
    // 2. Lignes CRÉDIT - Retraits de caisse
    const cashClosures = await this.getCashClosuresDetails();
    for (const closure of cashClosures) {
      const closureDate = new Date(closure.createdAt || closure.date);
      console.log(`🔍 Cash Withdrawal #${closure.sessionNumber}:`, {
        createdAt: closure.createdAt,
        date: closure.date,
        finalDate: closureDate,
        designation: `Retrait Caisse #${closure.sessionNumber} - ${closure.date.toLocaleDateString()}`
      });
      
      addTransactionIfNotDuplicate({
        id: `retrait_${closure.id}`,
        designation: `Retrait Caisse #${closure.sessionNumber} - ${closure.date.toLocaleDateString()}`,
        debut: 0,
        credit: closure.amount,
        solde: -closure.amount,
        type: 'CREDIT' as const,
        details: `Session: ${closure.sessionId}${closure.reason ? ` - ${closure.reason}` : ''}`,
        date: closureDate, // Use createdAt for proper ordering
        createdAt: closureDate // Ensure createdAt is set for sorting
      });
    }
    
    // 3. Lignes CRÉDIT - Dépenses
    const expenses = await this.getExpensesDetails();
    for (const expense of expenses) {
      addTransactionIfNotDuplicate({
        id: `expense_${expense.id}`,
        designation: `Dépense - ${expense.description}`,
        debut: 0,
        credit: expense.amount,
        solde: -expense.amount,
        type: 'CREDIT' as const,
        details: `Type: ${expense.type}, Date: ${expense.date}`,
        date: new Date(expense.createdAt || expense.date) // Use createdAt for proper ordering
      });
    }
    
     // 4. Lignes CRÉDIT - Écarts détaillés par type avec tickets
    const globalEcarts = await this.getGlobalEcartsDetails();
    
    for (const ecart of globalEcarts) {
       if (ecart.type === 'VENTE_GROS' && ecart.sales && ecart.sales.length > 0) {
         // Handle wholesale ecarts grouped by ticket
         const totalSales = ecart.totalSales || ecart.sales.length;
         const ticketNumber = ecart.ticketNumber || 'N/A';
         const salesInfo = `(${totalSales} ventes gros)`;
         
         // Main wholesale ecart row
         addTransactionIfNotDuplicate({
           id: `ecart_${ecart.id}`,
           designation: `${ecart.details} ${salesInfo}`,
           debut: 0,
           credit: ecart.amount,
           solde: -ecart.amount,
           type: 'CREDIT' as const,
           details: `Ticket #${ticketNumber} | Produit: ${ecart.productName} | Perte: ${Number(ecart.priceDifference || 0).toFixed(3)} DT | Vente Gros: ${Number(ecart.wholesaleAmount || 0).toFixed(3)} DT | Vente Détail: ${Number(ecart.retailAmount || 0).toFixed(3)} DT`,
           date: new Date(ecart.createdAt || ecart.date), // Use createdAt for proper ordering
           ecartType: ecart.type,
           isExpandable: false, // No children to expand - sales shown in dialog instead
           expandableId: `gros_${ecart.id}`,
           wholesaleSales: ecart.sales, // Store sales data for dialog
           totalWholesaleSales: totalSales,
           ticketNumber: ticketNumber
         });
         
         // Don't add individual sales as children - they'll be shown in dialog instead
       } else if (ecart.type === 'GRATUITE' && ecart.sales && ecart.sales.length > 0) {
         // Handle gratuité ecarts grouped by ticket
         const totalSales = ecart.totalSales || ecart.sales.length;
         const ticketNumber = ecart.ticketNumber || 'N/A';
         const salesInfo = `(${totalSales} ventes gratuité)`;
         
         // Main gratuité ecart row
         addTransactionIfNotDuplicate({
           id: `ecart_${ecart.id}`,
           designation: `${ecart.details} ${salesInfo}`,
           debut: 0,
           credit: ecart.amount,
           solde: -ecart.amount,
           type: 'CREDIT' as const,
           details: `Ticket #${ticketNumber} | Produit: ${ecart.productName} | Quantité Gratuite: ${Number(ecart.gratuitQuantity || 0)} | Montant: ${Number(ecart.gratuitAmount || 0).toFixed(3)} DT`,
           date: new Date(ecart.createdAt || ecart.date), // Use createdAt for proper ordering
           ecartType: ecart.type,
           isExpandable: false, // No children to expand - sales shown in dialog instead
           expandableId: `gratuite_${ecart.id}`,
           gratuitSales: ecart.sales, // Store sales data for dialog
           totalGratuitSales: totalSales,
           ticketNumber: ticketNumber
         });
         
         // Don't add individual sales as children - they'll be shown in dialog instead
       } else {
         // Handle other ecart types (Gratuité, Remise)
         const ticketInfo = ecart.ticketNumber ? ` - Ticket #${ecart.ticketNumber}` : '';
         const clickableDetails = ecart.saleId ? 
           `Produit: ${ecart.productName} | Ticket: #${ecart.ticketNumber} | Cliquez pour voir les détails` : 
           `Produit: ${ecart.productName}`;
         
        addTransactionIfNotDuplicate({
          id: `ecart_${ecart.id}`,
          designation: `${ecart.details}${ticketInfo}`,
          debut: 0,
          credit: ecart.amount,
          solde: -ecart.amount,
          type: 'CREDIT' as const,
          details: clickableDetails,
          date: new Date(ecart.createdAt || ecart.date), // Use createdAt for proper ordering
          saleId: ecart.saleId, // Store sale ID for click handling
          ticketNumber: ecart.ticketNumber, // Store ticket number for easy access
          ecartType: ecart.type // Store ecart type for styling
        });
       }
    }
    
    // 5. Lignes CRÉDIT - Remises avec numéros de caisse (pas de doublons)
    const discounts = await this.getDiscountsDetails();
    console.log('🔍 Processing Discounts:', discounts.map(d => ({
      id: d.id,
      designation: d.isSaleLevelDiscount ? `Remise Globale - Ticket #${d.ticketNumber}` : `Remise ${d.productName} - Ticket #${d.ticketNumber}`,
      amount: d.amount,
      isGratuiteSale: d.isGratuiteSale,
      isSaleLevelDiscount: d.isSaleLevelDiscount
    })));
    
    for (const discount of discounts) {
      // Skip if this is a gratuité sale (already processed in global ecarts)
      if (discount.isGratuiteSale) {
        console.log(`⏭️ Skipping gratuité sale: ${discount.id} - ${discount.isSaleLevelDiscount ? 'Sale-level' : 'Item-level'} discount`);
        continue;
      }
      
      // Une seule ligne par remise pour éviter les doublons
      const designation = discount.isSaleLevelDiscount 
        ? `Remise Globale - Ticket #${discount.ticketNumber}`
        : `Remise ${discount.productName} - Ticket #${discount.ticketNumber}`;
        
      addTransactionIfNotDuplicate({
        id: `discount_${discount.id}`,
        designation: designation,
        debut: 0,
        credit: discount.amount,
        solde: -discount.amount,
        type: 'CREDIT' as const,
        details: `Caisse ${discount.caisseNumber} - Lien: ${discount.link}`,
        date: new Date(discount.createdAt || discount.date) // Use createdAt for proper ordering
      });
    }
    
    // 6. Lignes CRÉDIT - Retours de stock
    const stockReturns = await this.getStockReturnsDetails();
    for (const return_ of stockReturns) {
      addTransactionIfNotDuplicate({
        id: `return_${return_.id}`,
        designation: `Retour Stock - ${return_.description}`,
        debut: 0,
        credit: return_.amount,
        solde: -return_.amount,
        type: 'CREDIT' as const,
        details: `Document: ${return_.documentNumber} - ${return_.productName}`,
        date: new Date(return_.createdAt || return_.date) // Use createdAt for proper ordering
      });
    }
    
    // 7. (INVENTAIRE moved to beginning - section 0)
    
    // 8. Crédits manuels
    for (const credit of this.creditEntries) {
      // Use date from credit entry, with createdAt as fallback
      let creditDate: Date;
      if (credit.date instanceof Date) {
        creditDate = credit.date;
      } else if (credit.createdAt) {
        creditDate = new Date(credit.createdAt);
      } else if (typeof credit.date === 'string') {
        creditDate = new Date(credit.date);
      } else {
        creditDate = new Date(); // Default to now
      }
      
      addTransactionIfNotDuplicate({
        id: `manual_${credit.id}`,
        designation: `Crédit Manuel - ${credit.description}`,
        debut: 0,
        credit: credit.amount,
        solde: -credit.amount,
        type: 'MANUAL_CREDIT' as const,
        details: `Type: ${this.getCreditTypeLabel(credit.type)}`,
        date: creditDate,
        createdAt: credit.createdAt ? new Date(credit.createdAt) : creditDate
      });
    }
    
    // Trier par date
    releveRows.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    // (Old cumulative logic removed - using new inventory mode logic below)
    
    // Sort all transactions by date and time (chronological order)
    allTransactions.sort((a, b) => {
      let dateA: Date;
      let dateB: Date;
      
      // Get proper date for comparison
      if (a.createdAt) {
        dateA = new Date(a.createdAt);
      } else if (a.date) {
        dateA = new Date(a.date);
      } else {
        dateA = new Date();
      }
      
      if (b.createdAt) {
        dateB = new Date(b.createdAt);
      } else if (b.date) {
        dateB = new Date(b.date);
      } else {
        dateB = new Date();
      }
      
      // Primary sort: by date and time
      const timeDiff = dateA.getTime() - dateB.getTime();
      if (timeDiff !== 0) {
        return timeDiff; // Ascending order (oldest first) - most recent at bottom
      }
      
      // Secondary sort: inventory line first if same date/time
      if (a.isInventory && !b.isInventory) return -1;
      if (!a.isInventory && b.isInventory) return 1;
      
      // Tertiary sort: by designation for consistent ordering
      return a.designation.localeCompare(b.designation);
    });
    
    // Debug: Log the sorted order
    console.log('📊 Sorted Transactions Order:', allTransactions.map(t => ({
      designation: t.designation,
      date: t.date,
      createdAt: t.createdAt,
      type: t.type
    })));
    
    // Add sorted transactions to releveRows after inventory
    releveRows.push(...allTransactions);
    
    // Insert manual entries at their correct positions
    this.insertManualEntries(releveRows);
    
    // Log summary of documents & inventories gathered
    const dateFrom = new Date(this.startDate);
    const dateTo = new Date(this.endDate);
    console.log('📊 Documents & Inventories Gathered:', {
      dateRange: `${dateFrom.toLocaleDateString()} - ${dateTo.toLocaleDateString()}`,
      stockEntries: stockEntries.length,
      cashClosures: cashClosures.length,
      expenses: expenses.length,
      globalEcarts: globalEcarts.length,
      discounts: discounts.length,
      stockReturns: stockReturns.length,
      creditEntries: this.creditEntries.length,
      inventoryData: inventoryData?.length || 0,
      totalTransactions: allTransactions.length
    });

    // Display each transaction with its date/time
    console.log('📅 Transactions by Date/Time (BEFORE sorting):');
    allTransactions.forEach((transaction, index) => {
      const dateTime = transaction.date ? transaction.date.toLocaleString('fr-FR') : 'No date';
      const createdAt = transaction.createdAt ? new Date(transaction.createdAt).toLocaleString('fr-FR') : 'No createdAt';
      console.log(`${index + 1}. [${dateTime}] [${createdAt}] ${transaction.designation} - ${transaction.type}`);
    });
    
    // Display each transaction with its date/time AFTER sorting
    console.log('📅 Transactions by Date/Time (AFTER sorting):');
    allTransactions.forEach((transaction, index) => {
      const dateTime = transaction.date ? transaction.date.toLocaleString('fr-FR') : 'No date';
      const createdAt = transaction.createdAt ? new Date(transaction.createdAt).toLocaleString('fr-FR') : 'No createdAt';
      console.log(`${index + 1}. [${dateTime}] [${createdAt}] ${transaction.designation} - ${transaction.type}`);
    });
    
    // Calculate cumulative solde for inventory mode
    let runningSolde = 0;
    let inventoryFound = false;
    let previousSolde = 0; // Track solde before inventory line
    
    for (const row of releveRows) {
      if (row.isInventory) {
        // Inventory line: Solde is the direct inventory value, resets the baseline
        runningSolde = Number(row.totalInventoryValue || row.solde || 0);
        row.solde = runningSolde;
        row.debut = 0;
        row.credit = 0;
        inventoryFound = true;
        this.lastInventorySolde = runningSolde;
        console.log(`🔍 Inventory Reset: ${row.designation}, New Baseline Solde: ${runningSolde}`);
      } else if (!this.isBonEntreeItem(row)) {
        // C'est une ligne parent - calculer le solde cumulatif
        // Solde = Previous Solde + Debit - Credit
        runningSolde = runningSolde + row.debut - row.credit;
        row.solde = runningSolde;
        previousSolde = runningSolde; // Update previous solde for inventory calculation
        console.log(`🔍 Transaction: ${row.designation}, Debit: ${row.debut}, Credit: ${row.credit}, New Solde: ${runningSolde}`);
      } else {
        // C'est une ligne enfant - garder le solde de la ligne parent
        row.solde = runningSolde;
      }
    }
    
    // If no inventory found, start from 0
    if (!inventoryFound) {
      console.log('⚠️ No inventory line found, starting from 0');
      runningSolde = 0;
      for (const row of releveRows) {
        if (!this.isBonEntreeItem(row)) {
          runningSolde = runningSolde + row.debut - row.credit;
          row.solde = runningSolde;
        } else {
          row.solde = runningSolde;
        }
      }
    }
    
    this.releveInventaireData = releveRows;
    this.releveInventaireSummary = this.calculateReleveSummary(releveRows);
  }

  private async calculateTotalDebut(): Promise<number> {
    try {
      // Get all stock entries
      const response = await firstValueFrom(this.http.get<any>(`${environment.apiUrl}/stock-documents`, {
        params: { type: 'BON_ENTREE_DEPOT' }
      }));

      // Handle different response formats
      let entries = [];
      if (Array.isArray(response)) {
        entries = response;
      } else if (response && Array.isArray(response.data)) {
        entries = response.data;
      } else if (response && response.stockDocuments && Array.isArray(response.stockDocuments)) {
        entries = response.stockDocuments;
      } else {
        return 0;
      }

      let totalDebut = 0;
      
      for (const entry of entries) {
        for (const item of entry.items || []) {
          const product = this.products.find(p => p.id === item.productId);
          if (product) {
            const qty = Number(item.quantity) || 0;
            const prixVente = Number(product.prix_vente_TTC) || 0;
            totalDebut += qty * prixVente;
          }
        }
      }
      
      return totalDebut;
    } catch (err) {
      console.error('Error calculating total debut:', err);
      return 0;
    }
  }

  private async getStockEntriesDetails(): Promise<any[]> {
    try {
      // Use the correct API endpoint with proper type parameter
      
      const response = await firstValueFrom(this.http.get<any>(`${environment.apiUrl}/stock-documents`, {
        params: {
          type: 'BON_ENTREE_DEPOT',
          limit: '1000' // Increase limit to get more entries
        }
      }));
      
      // Handle different response formats
      let stockDocs = [];
      if (Array.isArray(response)) {
        stockDocs = response;
      } else if (response && Array.isArray(response.data)) {
        stockDocs = response.data;
      } else if (response && response.stockDocuments && Array.isArray(response.stockDocuments)) {
        stockDocs = response.stockDocuments;
      } else {
        return [];
      }
      
      
      const entries = [];
      const processedEntries = new Set(); // Avoid duplicates
      
      for (const doc of stockDocs) {
        // Skip if no items
        if (!doc.items || doc.items.length === 0) {
          continue;
        }
        
        for (const item of doc.items) {
          const entryKey = `${doc.id}_${item.id}`;
          if (processedEntries.has(entryKey)) {
            continue; // Skip duplicates
          }
          processedEntries.add(entryKey);
          
          const product = this.products.find(p => p.id === item.productId);
          
          if (product) {
            const qty = Number(item.quantity) || 0;
            const price = Number(product.prix_vente_TTC) || 0;
            const amount = qty * price;
            
            if (amount > 0) {
              const entry = {
                id: `entry_${doc.id}_${item.id}`,
                amount,
                description: `Entrée ${product.name} (${qty} x ${price})`,
                documentNumber: doc.numero || doc.id,
                date: new Date(doc.createdAt),
                productName: product.name,
                quantity: qty,
                unitPrice: price,
                documentId: doc.id,
                itemId: item.id,
                createdAt: doc.createdAt, // Include createdAt for proper ordering
                depotName: doc.destinataire?.name || 'Dépôt principal',
                supplierName: doc.emetteur?.name || 'Fournisseur inconnu'
              };
              
              entries.push(entry);
            }
          }
        }
      }
      
      return entries;
    } catch (err) {
      console.error('Error getting stock entries details:', err);
      return [];
    }
  }

  private async getCashClosuresDetails(): Promise<any[]> {
    try {
      const dateFrom = new Date(this.startDate);
      const dateTo = new Date(this.endDate);
      dateTo.setHours(23, 59, 59, 999);

      // Fetch ALL sessions without date filtering to get all data
      const sessions = await firstValueFrom(
        this.sessionsService.getSessions({
          limit: 1000 // Increase limit to get more sessions
        })
      );

      const sessionsArray = Array.isArray(sessions) ? sessions : [];
      // Filter for CLOSED sessions within the date range based on closed_at
      const closedSessions = sessionsArray.filter(s => {
        if (s.status !== 'CLOSED' || !s.closedAt) return false;
        
        const closedDate = new Date(s.closedAt);
        return closedDate >= dateFrom && closedDate <= dateTo;
      });

      // Calculate withdrawals from cash movements (same logic as sessions-history)
      const withdrawals: Array<{
        id: string;
        sessionId: number;
        sessionNumber: number | string;
        amount: number;
        variance: number;
        date: Date;
        createdAt: string | Date;
        details: string;
        reason: string;
      }> = [];
      for (const session of closedSessions) {
        try {
          // Fetch session report to get cash movements (same as sessions-history)
          const sessionReport = await firstValueFrom(
            this.sessionsService.getSessionReport(session.id, 'Z')
          );
          
          const fullSession = sessionReport.session || session;
          const closedAt = fullSession.closedAt || fullSession.updatedAt || fullSession.createdAt;
          
          // Get all RETRAIT_CENTRALE movements from cash movements - always grab them, no conditions
          const cashMovements = fullSession.cashMovements || [];
          
          console.log(`🔍 Session ${fullSession.id} - Cash movements:`, cashMovements.length);
          console.log(`🔍 RETRAIT_CENTRALE movements:`, cashMovements.filter((m: any) => m.type === 'RETRAIT_CENTRALE'));
          
          cashMovements.forEach((movement: any) => {
            // Always grab RETRAIT_CENTRALE movements, no conditions
            if (movement.type === 'RETRAIT_CENTRALE') {
              const withdrawalAmount = parseFloat(movement.amount || 0) || 0;
              console.log(`✅ Adding RETRAIT_CENTRALE: ${withdrawalAmount} DT from session ${fullSession.id}`);
              withdrawals.push({
                id: `retrait_${fullSession.id}_${movement.id}`,
                sessionId: fullSession.id,
                sessionNumber: fullSession.zSeq || fullSession.xSeq || fullSession.id,
                amount: withdrawalAmount,
                variance: Number(fullSession.variance ?? 0),
                date: new Date(movement.createdAt || closedAt),
                createdAt: movement.createdAt || fullSession.closedAt, // Use movement createdAt for proper ordering
                details: `Session ${fullSession.id} - Retrait: ${withdrawalAmount} DT`,
                reason: movement.reason || 'Retrait vers Caisse Centrale'
              });
            }
          });
        } catch (err) {
          console.error(`Error fetching session ${session.id} report:`, err);
          // Fallback: try to use cashMovements from the session if available
          if (session.cashMovements) {
            const closedAt = session.closedAt || session.updatedAt || session.createdAt;
            
            // Always grab RETRAIT_CENTRALE movements, no conditions
            session.cashMovements.forEach((movement: any) => {
              if (movement.type === 'RETRAIT_CENTRALE') {
                const withdrawalAmount = parseFloat(movement.amount || 0) || 0;
                withdrawals.push({
                  id: `retrait_${session.id}_${movement.id}`,
                  sessionId: session.id,
                  sessionNumber: session.zSeq || session.xSeq || session.id,
                  amount: withdrawalAmount,
                  variance: Number(session.variance ?? 0),
                  date: new Date(movement.createdAt || closedAt),
                  createdAt: movement.createdAt || session.closedAt,
                  details: `Session ${session.id} - Retrait: ${withdrawalAmount} DT`,
                  reason: movement.reason || 'Retrait vers Caisse Centrale'
                });
              }
            });
          }
        }
      }
      
      console.log(`📊 Total withdrawals found: ${withdrawals.length}`, withdrawals);

      return withdrawals;
    } catch (err) {
      console.error('Error getting cash withdrawals details:', err);
      return [];
    }
  }

  private async getExpensesDetails(): Promise<any[]> {
    try {
      // Get real expenses from your database within the date range
      const dateFrom = new Date(this.startDate);
      const dateTo = new Date(this.endDate);
      dateTo.setHours(23, 59, 59, 999);
      
      
      const expensesResponse = await firstValueFrom(this.http.get<any>(`${environment.apiUrl}/expenses?startDate=${dateFrom.toISOString().split('T')[0]}&endDate=${dateTo.toISOString().split('T')[0]}&limit=100`));
      
      // Handle different response formats
      let expenses = [];
      if (Array.isArray(expensesResponse)) {
        expenses = expensesResponse;
      } else if (expensesResponse && Array.isArray(expensesResponse.data)) {
        expenses = expensesResponse.data;
      } else if (expensesResponse && Array.isArray(expensesResponse.expenses)) {
        expenses = expensesResponse.expenses;
      } else {
        expenses = [];
      }
      
      const processedExpenses = new Set(); // Avoid duplicates
      const mappedExpenses = [];
      
      for (const expense of expenses) {
        if (processedExpenses.has(expense.id)) {
          continue; // Skip duplicates
        }
        processedExpenses.add(expense.id);
        
        // Only include approved expenses with cash payment from your real data
        if (expense.isApproved && 
            (expense.paymentType === 'CASH' || expense.paymentType === 'CASH_ONLY') &&
            Number(expense.amount) > 0) {
          
          mappedExpenses.push({
            id: expense.id,
            description: expense.description || 'Dépense',
            amount: Number(expense.amount) || 0,
            type: expense.type || 'GENERAL',
            date: new Date(expense.approvedAt || expense.createdAt),
            createdAt: expense.createdAt, // Include createdAt for proper ordering
            category: expense.category?.name || 'Non spécifié',
            supplier: expense.supplier?.name || 'Non spécifié'
          });
        }
      }
      
      return mappedExpenses;
    } catch (err) {
      console.error('Error getting expenses details:', err);
      return [];
    }
  }

  private async getGlobalEcartsDetails(): Promise<any[]> {
    try {
      const ecarts = [];
      const processedEcarts = new Set(); // Éviter les doublons
      
      // First, collect all wholesale sales across all products and group by ticket
      const allWholesaleSalesByTicket = new Map<string, any[]>();
      const allGratuitSalesByTicket = new Map<string, any[]>();
      
      // Get ecarts from reconciliation data and break them down by type
      for (const data of this.reconciliationData) {
        if (data.ecartData) {
          const ecartData = data.ecartData;
          
          // Collect wholesale sales by ticket
          if (ecartData.ecartVenteGros !== 0) {
            const wholesaleSales = await this.findAllWholesaleSalesForProduct(data.productId);
            for (const sale of wholesaleSales) {
              const ticketKey = sale.dailyTicketNumber || sale.id.toString();
              if (!allWholesaleSalesByTicket.has(ticketKey)) {
                allWholesaleSalesByTicket.set(ticketKey, []);
              }
              allWholesaleSalesByTicket.get(ticketKey)!.push({
                ...sale,
                productName: data.productName,
                productId: data.productId
              });
            }
          }
          
          // Collect gratuit sales by ticket
          if (ecartData.ecartGratuite !== 0) {
            const gratuitSales = await this.findAllGratuitSalesForProduct(data.productId);
            for (const sale of gratuitSales) {
              const ticketKey = sale.dailyTicketNumber || sale.id.toString();
              if (!allGratuitSalesByTicket.has(ticketKey)) {
                allGratuitSalesByTicket.set(ticketKey, []);
              }
              allGratuitSalesByTicket.get(ticketKey)!.push({
                ...sale,
                productName: data.productName,
                productId: data.productId
              });
            }
          }
        }
      }
      
      // Create wholesale ecarts grouped by ticket
      for (const [ticketNumber, ticketSales] of allWholesaleSalesByTicket) {
        const totalWholesaleAmount = ticketSales.reduce((sum, sale) => {
          // Use the correct property path for wholesale amount
          return sum + (Number(sale.itemDetails?.total) || 0);
        }, 0);
        const totalRetailAmount = ticketSales.reduce((sum, sale) => {
          const product = this.products.find(p => p.id === sale.productId);
          const retailPrice = product ? Number(product.prix_vente_TTC) || 0 : 0;
          const quantity = Number(sale.itemDetails?.quantity) || 0;
          return sum + (retailPrice * quantity);
        }, 0);
        const priceDifference = totalRetailAmount - totalWholesaleAmount;
        
        ecarts.push({
          id: `gros_ticket_${ticketNumber}`,
          amount: priceDifference,
          details: `Vente Gros Ticket #${ticketNumber}`,
          type: 'VENTE_GROS',
          productName: 'Multiple Products',
          sales: ticketSales,
          totalSales: ticketSales.length,
          date: ticketSales.length > 0 ? new Date(ticketSales[0].createdAt) : new Date(),
          ticketNumber: ticketNumber,
          wholesaleAmount: totalWholesaleAmount,
          retailAmount: totalRetailAmount,
          priceDifference: priceDifference
        });
      }
      
      // Create gratuit ecarts grouped by ticket
      for (const [ticketNumber, ticketSales] of allGratuitSalesByTicket) {
        const totalGratuitAmount = ticketSales.reduce((sum, sale) => sum + (Number(sale.itemDetails?.total) || 0), 0);
        const totalGratuitQuantity = ticketSales.reduce((sum, sale) => sum + (Number(sale.itemDetails?.quantity) || 0), 0);
        
        console.log(`🎁 Processing Gratuité Globale for Ticket #${ticketNumber}:`, {
          sales: ticketSales.length,
          amount: totalGratuitAmount,
          quantity: totalGratuitQuantity
        });
        
        ecarts.push({
          id: `gratuite_ticket_${ticketNumber}`,
          amount: totalGratuitAmount,
          details: `Gratuité Globale`,
          type: 'GRATUITE',
          productName: 'Multiple Products',
          sales: ticketSales,
          totalSales: ticketSales.length,
          date: ticketSales.length > 0 ? new Date(ticketSales[0].createdAt) : new Date(),
          ticketNumber: ticketNumber,
          gratuitAmount: totalGratuitAmount,
          gratuitQuantity: totalGratuitQuantity
        });
      }
      
      // Handle individual product ecarts for remise (not grouped by ticket)
      for (const data of this.reconciliationData) {
        if (data.ecartData) {
          const ecartData = data.ecartData;
          
          // 3. Écart Remise
          if (ecartData.ecartRemise !== 0) {
            const ecartKey = `remise_${data.productId}_${ecartData.ecartRemise}`;
            if (!processedEcarts.has(ecartKey)) {
              processedEcarts.add(ecartKey);
              
              // Find the actual sale with discount
              const discountSale = await this.findDiscountSaleForProduct(data.productId);
          
              ecarts.push({
                id: `remise_${data.productId}`,
                amount: ecartData.ecartRemise,
                details: `Remise - ${data.productName}`,
                type: 'REMISE',
                productName: data.productName,
                saleId: discountSale?.id,
                ticketNumber: discountSale?.dailyTicketNumber || discountSale?.id,
                date: discountSale?.createdAt ? new Date(discountSale.createdAt) : new Date()
              });
            }
          }
        }
      }
      
      return ecarts;
    } catch (err) {
      console.error('Error getting global ecarts details:', err);
      return [];
    }
  }

  private async getDiscountsDetails(): Promise<any[]> {
    try {
      // Get real sales data from your database within the date range
      const dateFrom = new Date(this.startDate);
      const dateTo = new Date(this.endDate);
      dateTo.setHours(23, 59, 59, 999);
      
      
      const sales = await firstValueFrom(this.salesService.getSales());
      const salesArray = Array.isArray(sales) ? sales : [];
      
      // Filter sales by date range from your real database
      const salesInRange = salesArray.filter(sale => {
        const saleDate = new Date(sale.createdAt);
        return saleDate >= dateFrom && saleDate <= dateTo;
      });
      
      
      const discounts = [];
      const processedSales = new Set(); // Avoid processing the same sale multiple times
      
      for (const sale of salesInRange) {
        // Skip if we already processed this sale
        if (processedSales.has(sale.id)) {
          continue;
        }
        
        // Check if this sale is entirely gratuité (all items are free)
        const allItems = sale.items || [];
        const hasGratuiteItems = allItems.some(item => 
          Number(item.unitPrice) === 0 || 
          Number(item.total) === 0
        );
        const isEntirelyGratuite = allItems.length > 0 && allItems.every(item => 
          Number(item.unitPrice) === 0 || 
          Number(item.total) === 0
        );
        
        // Check for sale-level discount first
        const saleDiscount = Number(sale.discount) || 0;
        const saleTotal = Number(sale.total) || 0;
        const saleFinalTotal = Number(sale.finalTotal) || 0;
        const saleLevelDiscount = saleTotal - saleFinalTotal;
        
        if (saleLevelDiscount >= 0.001) {
          // This is a sale-level discount - create one total discount entry
          processedSales.add(sale.id);
          
          discounts.push({
            id: `discount_sale_${sale.id}`,
            amount: saleLevelDiscount,
            ticketNumber: sale.dailyTicketNumber || sale.id,
            caisseNumber: sale.sessionId || 'N/A',
            link: `${environment.apiUrl}/sales/${sale.id}`,
            date: new Date(sale.createdAt),
            createdAt: sale.createdAt,
            productName: 'Remise Globale', // Generic name for sale-level discount
            quantity: 1,
            unitPrice: saleLevelDiscount,
            total: saleLevelDiscount,
            isSaleLevelDiscount: true,
            isGratuiteSale: isEntirelyGratuite // Mark if this sale is entirely gratuité
          });
        } else {
          // Check for item-level discounts only if no sale-level discount
          for (const item of sale.items || []) {
            const discount = Number(item.discount) || 0;
            const itemTotal = Number(item.total) || 0;
            const itemUnitPrice = Number(item.unitPrice) || 0;
            const itemQuantity = Number(item.quantity) || 0;
            const expectedTotal = itemUnitPrice * itemQuantity;
            const calculatedDiscount = expectedTotal - itemTotal;
            
            // Only process item-level discounts if they're significant
            const hasItemDiscount = discount >= 0.001 || calculatedDiscount >= 0.001;
            
            if (hasItemDiscount) {
              const discountKey = `${sale.id}_${item.id}`;
              if (processedSales.has(discountKey)) {
                continue; // Skip duplicates
              }
              processedSales.add(discountKey);
              
              const product = this.products.find(p => p.id === item.productId);
              const productName = product ? product.name : 'Produit inconnu';
              
              // Use the largest discount found
              const finalDiscount = Math.max(
                discount > 0 ? discount : 0,
                calculatedDiscount > 0 ? calculatedDiscount : 0
              );
              
              // Check if this specific item is a gratuité item
              const isGratuiteItem = Number(item.unitPrice) === 0 || 
                                   Number(item.total) === 0;
              
              discounts.push({
                id: `discount_item_${sale.id}_${item.id}`,
                amount: finalDiscount,
                ticketNumber: sale.dailyTicketNumber || sale.id,
                caisseNumber: sale.sessionId || 'N/A',
                link: `${environment.apiUrl}/sales/${sale.id}`,
                date: new Date(sale.createdAt),
                createdAt: sale.createdAt,
                productName: productName,
                quantity: item.quantity || 0,
                unitPrice: item.unitPrice || 0,
                total: item.total || 0,
                isSaleLevelDiscount: false,
                isGratuiteSale: isGratuiteItem // Mark if this item is gratuité
              });
            }
          }
        }
      }
      
      return discounts;
    } catch (err) {
      console.error('Error getting discounts details:', err);
      return [];
    }
  }

  private async getStockReturnsDetails(): Promise<any[]> {
    try {
      // Only use valid DocumentType values to avoid API errors
      const dateFrom = new Date(this.startDate);
      const dateTo = new Date(this.endDate);
      dateTo.setHours(23, 59, 59, 999);
      
      
      // Only use valid DocumentType values
      const validReturnTypes = ['BON_EXPEDITION']; // Only use valid types
      const returns = [];
      const processedReturns = new Set(); // Avoid duplicates
      
      for (const type of validReturnTypes) {
        try {
          const response = await firstValueFrom(this.http.get<any>(`${environment.apiUrl}/stock-documents`, {
            params: {
              type: type,
              dateFrom: dateFrom.toISOString(),
              dateTo: dateTo.toISOString(),
              limit: '100'
            }
          }));
          
          // Handle different response formats
          let stockDocs = [];
          if (Array.isArray(response)) {
            stockDocs = response;
          } else if (response && Array.isArray(response.data)) {
            stockDocs = response.data;
          } else if (response && response.stockDocuments && Array.isArray(response.stockDocuments)) {
            stockDocs = response.stockDocuments;
          } else {
            stockDocs = [];
          }
          
          
          for (const doc of stockDocs) {
            // Check if this is a return document based on notes
            const isReturn = doc.notes?.toLowerCase().includes('retour') || 
                           doc.notes?.toLowerCase().includes('return');
            
            if (isReturn && doc.items && doc.items.length > 0) {
              for (const item of doc.items) {
                const returnKey = `${doc.id}_${item.id}`;
                if (processedReturns.has(returnKey)) {
                  continue; // Skip duplicates
                }
                processedReturns.add(returnKey);
                
                const product = this.products.find(p => p.id === item.productId);
                if (product) {
                  const qty = Number(item.quantity) || 0;
                  const price = Number(product.prix_vente_TTC) || 0;
                  const amount = qty * price;
                  
                  if (amount > 0) {
                    returns.push({
                      id: `return_${doc.id}_${item.id}`,
                      amount,
                      description: `Retour ${product.name} (${qty} x ${price})`,
                      documentNumber: doc.numero || doc.id,
                      date: new Date(doc.createdAt),
                      createdAt: doc.createdAt, // Include createdAt for proper ordering
                      productName: product.name,
                      quantity: qty,
                      unitPrice: price
                    });
                  }
                }
              }
            }
          }
        } catch (typeErr) {
          console.error(`Error getting documents of type ${type}:`, typeErr);
        }
      }
      
      return returns;
    } catch (err) {
      console.error('Error getting stock returns details:', err);
      return [];
    }
  }

  private async getInventorySessionForDate(): Promise<any> {
    try {
      // Get the latest posted inventory session with items
      const sessions = await firstValueFrom(this.inventoryService.getSessions());
      const postedSessions = sessions.filter(s => s.status === 'POSTED');
      
      if (postedSessions.length > 0) {
        // Return the most recent posted session
        const latestSession = postedSessions.sort((a, b) => 
          new Date(b.postedAt || b.closedAt || b.createdAt).getTime() - 
          new Date(a.postedAt || a.closedAt || a.createdAt).getTime()
        )[0];
        
        // Get the full session with items
        const fullSession = await firstValueFrom(this.inventoryService.getSession(latestSession.id));
        
        // Debug log to show which session is being used
        console.log('🔍 Inventory Session Debug:', {
          sessionId: latestSession.id,
          status: latestSession.status,
          postedAt: latestSession.postedAt,
          closedAt: latestSession.closedAt,
          createdAt: latestSession.createdAt,
          itemsCount: fullSession?.items?.length || 0
        });
        
        return fullSession;
      }
      
      return null;
    } catch (err) {
      console.error('Error getting inventory session for date:', err);
      return null;
    }
  }

  private async getAllPostedInventorySessions(): Promise<any[]> {
    try {
      // Get all inventory sessions
      const sessions = await firstValueFrom(this.inventoryService.getSessions());
      
      // Filter for posted sessions only
      const postedSessions = sessions.filter((s: any) => s.status === 'POSTED');
      
      // Sort by postedAt date (oldest first for chronological order)
      postedSessions.sort((a: any, b: any) => {
        const dateA = new Date(a.postedAt || a.closedAt || a.createdAt);
        const dateB = new Date(b.postedAt || b.closedAt || b.createdAt);
        return dateA.getTime() - dateB.getTime(); // Ascending order (oldest first)
      });
      
      // Get full session details with items for each session
      const fullSessions = [];
      for (const session of postedSessions) {
        try {
          const fullSession = await firstValueFrom(this.inventoryService.getSession(session.id));
          if (fullSession && fullSession.items) {
            fullSessions.push(fullSession);
          }
        } catch (err) {
          console.error(`Error getting session ${session.id}:`, err);
        }
      }
      
      console.log('📊 All Posted Inventory Sessions:', fullSessions.map(s => ({
        id: s.id,
        numero: s.numero,
        postedAt: s.postedAt,
        closedAt: s.closedAt,
        createdAt: s.createdAt,
        itemsCount: s.items?.length || 0
      })));
      
      return fullSessions;
    } catch (err) {
      console.error('Error getting all posted inventory sessions:', err);
      return [];
    }
  }

  private async getInventoryVariance(): Promise<number> {
    try {
      // Get the latest posted inventory session
      const sessions = await firstValueFrom(this.inventoryService.getSessions());
      const postedSessions = sessions.filter(s => s.status === 'POSTED');
      
      if (postedSessions.length === 0) {
        return 0;
      }
      
      // Get the most recent posted session
      const latestSession = postedSessions.sort((a, b) => 
        new Date(b.postedAt || b.closedAt || b.createdAt).getTime() - 
        new Date(a.postedAt || a.closedAt || a.createdAt).getTime()
      )[0];
      
      // Use the totalEcartValue directly from the session
      // Handle string values like "-601.2"
      const variance = latestSession.totalEcartValue;
      console.log('🔍 Raw totalEcartValue:', variance, 'Type:', typeof variance);
      
      if (typeof variance === 'string') {
        return parseFloat(variance) || 0;
      }
      return Number(variance) || 0;
    } catch (err) {
      console.error('Error getting inventory variance:', err);
      return 0;
    }
  }

  private async getInventoryData(): Promise<{productId: number, quantity: number, price: number, amount: number}[]> {
    try {
      // Get current stock levels for all products
      const inventory = await firstValueFrom(this.http.get<any>(`${environment.apiUrl}/stock/inventory`));
      
      const inventoryData: {productId: number, quantity: number, price: number, amount: number}[] = [];
      
      // Handle different response formats
      let inventoryItems = [];
      if (Array.isArray(inventory)) {
        inventoryItems = inventory;
      } else if (inventory && Array.isArray(inventory.data)) {
        inventoryItems = inventory.data;
      } else if (inventory && Array.isArray(inventory.items)) {
        inventoryItems = inventory.items;
      } else {
        inventoryItems = [];
      }
      
      for (const item of inventoryItems) {
        const productId = item.productId;
        const quantity = Number(item.quantity) || 0; // Current stock quantity
        const product = this.products.find(p => p.id === productId);
        const price = Number(product?.prix_vente_TTC) || 0;
        const amount = quantity * price;
        
        if (quantity > 0) { // Only include items with positive stock
          inventoryData.push({
            productId,
            quantity,
            price,
            amount
          });
        }
      }
      
      return inventoryData;
    } catch (err) {
      console.error('Error getting inventory data:', err);
      return [];
    }
  }

  async generateReleveInventaire(): Promise<void> {
    this.loading = true;
    this.error = '';
    
    // Reset inventory mode for regular reports
    this.isInventoryMode = false;
    
    try {
      const releveRows: ReleveInventaireRow[] = [];
      
      for (const product of this.products) {
        // Get current inventory stock value directly - no calculations needed
        const solde = await this.getCurrentInventoryStockValue(product);
        
        releveRows.push({
          id: `product_${product.id}`,
          designation: product.name,
          debut: 0, // Not used when using direct inventory value
          credit: 0, // Not used when using direct inventory value
          solde: solde, // Direct current inventory stock value
          type: 'ENTRY'
        });
      }
      
      this.releveInventaireData = releveRows;
      this.releveInventaireSummary = this.calculateReleveSummary(releveRows);
      this.loading = false;
    } catch (err) {
      this.error = 'Erreur lors de la génération du relevé inventaire';
      this.loading = false;
    }
  }


  private calculateReleveSummary(releveRows: ReleveInventaireRow[]): ReleveInventaireSummary {
    // Ne compter que les lignes parents (pas les enfants)
    const parentRows = releveRows.filter(row => !this.isBonEntreeItem(row));
    
    const totalDebut = parentRows.reduce((sum, row) => sum + row.debut, 0);
    const totalCredit = parentRows.reduce((sum, row) => sum + row.credit, 0);
    const totalSolde = totalDebut - totalCredit;
    
    return {
      totalProducts: parentRows.length,
      totalDebut,
      totalCredit,
      totalSolde,
      products: releveRows
    };
  }


  async removeCreditEntry(index: number): Promise<void> {
    const entry = this.creditEntries[index];
    
    try {
      // Remove from database
      if (entry.id) {
        await firstValueFrom(this.http.delete(`${environment.apiUrl}/credit-entries/${entry.id}`));
      }
      
      // Remove from local array
      this.creditEntries.splice(index, 1);
      
      // Regenerate the Relevé Inventaire
      await this.generateReleveInventaireFromReconciliationData();
    } catch (err) {
      this.error = 'Erreur lors de la suppression du crédit';
      console.error('Error removing credit entry:', err);
    }
  }

  async saveInventoryToReleveInventaire(): Promise<void> {
    try {
      this.loading = true;
      this.error = '';

      // Get current inventory data
      const inventoryData = await firstValueFrom(
        this.http.get<any[]>(`${environment.apiUrl}/inventory?depotId=${this.depotId}`)
      );

      // Get products data
      const productsData = await firstValueFrom(
        this.http.get<any[]>(`${environment.apiUrl}/products?depotId=${this.depotId}`)
      );

      // Create releve inventaire entries from inventory
      const releveEntries = inventoryData.map(item => {
        const product = productsData.find(p => p.id === item.productId);
        return {
          productId: item.productId,
          designation: product?.name || `Produit ID: ${item.productId}`,
          debut: 0, // Initial balance
          credit: 0, // No credit for inventory
          solde: item.quantity, // Current quantity
          type: 'INVENTORY',
          details: `Inventaire actuel - ${item.quantity} unités`,
          date: new Date(),
          createdAt: new Date()
        };
      });

      // Save to releve inventaire (you may need to create an API endpoint for this)
      await firstValueFrom(
        this.http.post(`${environment.apiUrl}/releve-inventaire`, {
          depotId: this.depotId,
          entries: releveEntries,
          date: new Date()
        })
      );

      this.success = 'Inventaire sauvegardé dans le tableau de relève inventaire';
      setTimeout(() => this.success = '', 3000);

    } catch (err) {
      this.error = 'Erreur lors de la sauvegarde de l\'inventaire';
      console.error('Error saving inventory to releve:', err);
    } finally {
      this.loading = false;
    }
  }

  getCreditTypeLabel(type: string): string {
    const labels: { [key: string]: string } = {
      'SALE': 'Vente',
      'FREE_ITEM': 'Gratuité',
      'EXIT_VOUCHER': 'Bon de sortie',
      'WHOLESALE_DIFFERENCE': 'Différence gros'
    };
    return labels[type] || type;
  }

  async loadExistingCreditEntries(): Promise<void> {
    try {
      const creditEntries = await firstValueFrom(this.http.get<CreditEntry[]>(`${environment.apiUrl}/credit-entries`));
      // Convert date strings to Date objects for proper handling
      this.creditEntries = (creditEntries || []).map(entry => ({
        ...entry,
        date: entry.date ? new Date(entry.date) : new Date(),
        createdAt: entry.createdAt ? new Date(entry.createdAt) : new Date()
      }));
    } catch (error: any) {
      console.error('Error loading existing credit entries:', error);
      // If it's a 503 error (table not available), that's expected
      if (error.status === 503) {
        console.log('Credit entries table not available yet, continuing without existing entries');
      }
      this.creditEntries = []; // Initialize as empty array if loading fails
    }
  }

  async loadExistingManualEntries(): Promise<void> {
    try {
      const dateFrom = this.startDate;
      const dateTo = this.endDate;
      
      const manualEntries = await firstValueFrom(
        this.http.get<ManualEntry[]>(`${environment.apiUrl}/manual-entries`, {
          params: { dateFrom, dateTo }
        })
      );
      
      // Convert date strings to Date objects (but keep date as string for date input compatibility)
      this.manualEntries = (manualEntries || []).map(entry => {
        const entryDate = entry.date ? (typeof entry.date === 'string' ? entry.date : new Date(entry.date).toISOString().split('T')[0]) : new Date().toISOString().split('T')[0];
        return {
          ...entry,
          date: entryDate as any, // Keep as string for date input
          createdAt: entry.createdAt ? new Date(entry.createdAt) : new Date()
        };
      });
    } catch (error: any) {
      console.error('Error loading existing manual entries:', error);
      // If it's a 503 error (table not available), that's expected
      if (error.status === 503 || error.status === 404) {
        console.log('Manual entries table not available yet, continuing without existing entries');
      }
      this.manualEntries = []; // Initialize as empty array if loading fails
    }
  }

  private insertManualEntries(releveRows: ReleveInventaireRow[]): void {
    const dateFrom = this.startDate;
    const dateTo = this.endDate;
    
    // Filter manual entries for current date range
    const relevantEntries = this.manualEntries.filter(entry => 
      entry.dateFrom === dateFrom && entry.dateTo === dateTo
    );
    
    if (relevantEntries.length === 0) return;
    
    // Sort entries by positionIndex (ascending) and then by createdAt for consistent ordering
    relevantEntries.sort((a, b) => {
      if (a.positionIndex !== b.positionIndex) {
        return a.positionIndex - b.positionIndex;
      }
      // If same position, sort by creation date
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateA - dateB;
    });
    
    // Insert entries at their positions (insert from end to start to preserve indices)
    // This ensures that when multiple entries have the same positionIndex, they're inserted correctly
    for (let i = relevantEntries.length - 1; i >= 0; i--) {
      const entry = relevantEntries[i];
      // Ensure positionIndex is within valid range
      const positionIndex = Math.max(0, Math.min(entry.positionIndex, releveRows.length));
      
      // Create ReleveInventaireRow from ManualEntry
      const entryDate = typeof entry.date === 'string' ? new Date(entry.date) : (entry.date || new Date());
      const row: ReleveInventaireRow = {
        id: `manual_${entry.id || Date.now()}_${i}`,
        designation: entry.description || `${entry.entryType === 'DEBIT' ? 'Débit' : 'Crédit'} Manuel`,
        debut: entry.entryType === 'DEBIT' ? entry.amount : 0,
        credit: entry.entryType === 'CREDIT' ? entry.amount : 0,
        solde: 0, // Will be calculated later
        type: entry.entryType === 'DEBIT' ? 'ENTRY' : 'CREDIT',
        details: `Entrée manuelle - ${entry.entryType === 'DEBIT' ? 'Débit' : 'Crédit'}`,
        date: entryDate,
        createdAt: entry.createdAt || entryDate,
        isInventory: false
      };
      
      // Insert at the specified position
      releveRows.splice(positionIndex, 0, row);
    }
  }

  showManualEntryModal(rowIndex: number, rowId: string): void {
    this.selectedRowIndex = rowIndex;
    this.selectedRowId = rowId;
    this.isManualEntryModalOpen = true;
    
    // Initialize new manual entry
    const today = new Date();
    const dateString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    
    // Count existing manual entries at the same position to adjust positionIndex
    const existingEntriesAtPosition = this.manualEntries.filter(entry => 
      entry.dateFrom === this.startDate && 
      entry.dateTo === this.endDate && 
      entry.positionIndex === rowIndex + 1
    ).length;
    
    this.newManualEntry = {
      entryType: 'DEBIT',
      amount: 0,
      description: '',
      date: dateString as any, // Store as string for date input compatibility
      positionIndex: rowIndex + 1 + existingEntriesAtPosition, // Insert after the selected row, accounting for existing entries
      referenceRowId: rowId,
      dateFrom: this.startDate,
      dateTo: this.endDate
    };
  }

  hideManualEntryModal(): void {
    this.isManualEntryModalOpen = false;
    this.selectedRowIndex = null;
    this.selectedRowId = null;
  }

  async saveManualEntry(): Promise<void> {
    if (!this.newManualEntry.amount || !this.newManualEntry.description) {
      this.error = 'Veuillez remplir tous les champs obligatoires';
      return;
    }

    if (this.selectedRowIndex === null) {
      this.error = 'Erreur: position de ligne non définie';
      return;
    }

    try {
      // Prepare data for API
      let entryDate: string;
      if (this.newManualEntry.date instanceof Date) {
        entryDate = this.newManualEntry.date.toISOString().split('T')[0];
      } else if (typeof this.newManualEntry.date === 'string') {
        entryDate = this.newManualEntry.date;
      } else {
        entryDate = new Date().toISOString().split('T')[0];
      }
      
      const entryData = {
        entryType: this.newManualEntry.entryType,
        amount: parseFloat(this.newManualEntry.amount.toString()),
        description: this.newManualEntry.description,
        date: entryDate,
        positionIndex: this.newManualEntry.positionIndex, // Use the calculated positionIndex from modal initialization
        referenceRowId: this.selectedRowId,
        dateFrom: this.startDate,
        dateTo: this.endDate
      };

      console.log('[saveManualEntry] Sending entry data:', entryData);

      // Save to database
      const savedEntry = await firstValueFrom(
        this.http.post<ManualEntry>(`${environment.apiUrl}/manual-entries`, entryData)
      );
      
      console.log('[saveManualEntry] Saved entry:', savedEntry);
      
      // Convert saved entry date to Date object
      const savedEntryWithDate = {
        ...savedEntry,
        date: savedEntry.date ? new Date(savedEntry.date) : new Date(),
        createdAt: savedEntry.createdAt ? new Date(savedEntry.createdAt) : new Date()
      };
      
      // Add the entry to local array (avoid duplicates)
      const existingIndex = this.manualEntries.findIndex(e => e.id === savedEntryWithDate.id);
      if (existingIndex === -1) {
        this.manualEntries.push(savedEntryWithDate);
      } else {
        this.manualEntries[existingIndex] = savedEntryWithDate;
      }
      
      // Regenerate the Relevé Inventaire to include the new entry
      await this.generateReleveInventaireFromReconciliationData();
      
      // Reset form
      this.newManualEntry = {
        entryType: 'DEBIT',
        amount: 0,
        description: '',
        date: new Date(),
        positionIndex: 0,
        dateFrom: '',
        dateTo: ''
      };
      
      this.hideManualEntryModal();
      this.success = 'Entrée ajoutée avec succès';
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        this.success = '';
      }, 3000);
    } catch (err: any) {
      this.error = err.error?.error || 'Erreur lors de la sauvegarde de l\'entrée';
      console.error('Error saving manual entry:', err);
    }
  }

  async removeManualEntry(entryId: number): Promise<void> {
    try {
      // Remove from database
      await firstValueFrom(this.http.delete(`${environment.apiUrl}/manual-entries/${entryId}`));
      
      // Remove from local array
      this.manualEntries = this.manualEntries.filter(entry => entry.id !== entryId);
      
      // Regenerate the Relevé Inventaire
      await this.generateReleveInventaireFromReconciliationData();
      
      this.success = 'Entrée supprimée avec succès';
      setTimeout(() => {
        this.success = '';
      }, 3000);
    } catch (err) {
      this.error = 'Erreur lors de la suppression de l\'entrée';
      console.error('Error removing manual entry:', err);
    }
  }

  async deleteManualEntryFromRow(row: ReleveInventaireRow): Promise<void> {
    // Extract entry ID from row.id (format: manual_<id>_<index>)
    const match = row.id.match(/^manual_(\d+)_/);
    if (!match) {
      this.error = 'Impossible d\'identifier l\'entrée à supprimer';
      return;
    }
    
    const entryId = parseInt(match[1]);
    await this.removeManualEntry(entryId);
  }

  async cleanupOldInventoryEcartCredits(): Promise<void> {
    try {
      // Find and remove old inventory discrepancy credit entries
      const oldEcartCredits = this.creditEntries.filter(entry => 
        entry.description.includes('Écart Inventaire')
      );

      for (const oldCredit of oldEcartCredits) {
        if (oldCredit.id) {
          try {
            await firstValueFrom(this.http.delete(`${environment.apiUrl}/credit-entries/${oldCredit.id}`));
            console.log('Removed old inventory ecart credit:', oldCredit.description);
          } catch (deleteError: any) {
            // If entry doesn't exist (404), just continue
            if (deleteError.status !== 404) {
              console.error('Error deleting credit entry:', deleteError);
            }
          }
        }
      }

      // Remove from local array
      this.creditEntries = this.creditEntries.filter(entry => 
        !entry.description.includes('Écart Inventaire')
      );
    } catch (error) {
      console.error('Error cleaning up old inventory ecart credits:', error);
    }
  }

  async removeInventoryEcartCredits(): Promise<void> {
    try {
      // Find all inventory discrepancy credit entries
      const ecartCredits = this.creditEntries.filter(entry => 
        entry.description.includes('Écart Inventaire')
      );

      for (const credit of ecartCredits) {
        if (credit.id) {
          try {
            await firstValueFrom(this.http.delete(`${environment.apiUrl}/credit-entries/${credit.id}`));
            console.log('Removed inventory ecart credit:', credit.description);
          } catch (deleteError: any) {
            console.error('Error deleting inventory ecart credit:', deleteError);
          }
        }
      }

      // Remove from local array
      this.creditEntries = this.creditEntries.filter(entry => 
        !entry.description.includes('Écart Inventaire')
      );

      // Regenerate the Relevé Inventaire
      await this.generateReleveInventaireFromReconciliationData();
    } catch (error) {
      console.error('Error removing inventory ecart credits:', error);
    }
  }

  getProductName(productId: number | null): string {
    if (productId === null) {
      return 'Global';
    }
    const product = this.products.find(p => p.id === productId);
    return product?.name || 'Produit inconnu';
  }

  toggleBonEntreeExpansion(bonEntreeId: string): void {
    if (this.expandedBonEntree.has(bonEntreeId)) {
      this.expandedBonEntree.delete(bonEntreeId);
    } else {
      this.expandedBonEntree.add(bonEntreeId);
    }
  }

  isBonEntreeExpanded(bonEntreeId: string): boolean {
    return this.expandedBonEntree.has(bonEntreeId);
  }

  isBonEntreeItem(row: ReleveInventaireRow): boolean {
    return row.id.startsWith('item_');
  }

  getBonEntreeIdFromItem(itemId: string): string {
    // Find the row with this itemId and return its parentId
    const row = this.releveInventaireData.find(r => r.id === itemId);
    return row?.parentId || '';
  }

  private async findGratuitSaleForProduct(productId: number): Promise<any> {
    try {
      const allSales = await firstValueFrom(this.salesService.getSales());
      const salesArray = Array.isArray(allSales) ? allSales : [];
      
      // Find the most recent gift sale for this product
      for (const sale of salesArray.reverse()) {
        const saleItems = sale.items?.filter((item: any) => item.productId === productId) || [];
        for (const item of saleItems) {
          if (sale.status === 'CADEAU' || Number(item.total) === 0) {
            return sale;
          }
        }
      }
      return null;
    } catch (err) {
      console.error('Error finding gratuit sale:', err);
      return null;
    }
  }

  private async findAllGratuitSalesForProduct(productId: number): Promise<any[]> {
    try {
      const allSales = await firstValueFrom(this.salesService.getSales());
      const salesArray = Array.isArray(allSales) ? allSales : [];
      
      const gratuitSales = [];
      
      // Find ALL gratuit sales for this product
      for (const sale of salesArray) {
        const saleItems = sale.items?.filter((item: any) => item.productId === productId) || [];
        for (const item of saleItems) {
          if (sale.status === 'CADEAU' || Number(item.total) === 0) {
            gratuitSales.push({
              ...sale,
              itemDetails: {
                productId: item.productId,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                total: item.total,
                isGratuit: true
              }
            });
            break; // Only add the sale once even if it has multiple gratuit items for this product
          }
        }
      }
      
      return gratuitSales;
    } catch (err) {
      console.error('Error finding all gratuit sales:', err);
      return [];
    }
  }

  private async findWholesaleSaleForProduct(productId: number): Promise<any> {
    try {
      const allSales = await firstValueFrom(this.salesService.getSales());
      const salesArray = Array.isArray(allSales) ? allSales : [];
      
      // Find the most recent wholesale sale for this product
      for (const sale of salesArray.reverse()) {
        const saleItems = sale.items?.filter((item: any) => item.productId === productId) || [];
        for (const item of saleItems) {
          if (item.isWholesale || sale.isWholesale) {
            return sale;
          }
        }
      }
      return null;
    } catch (err) {
      console.error('Error finding wholesale sale:', err);
      return null;
    }
  }

  private async findAllWholesaleSalesForProduct(productId: number): Promise<any[]> {
    try {
      const allSales = await firstValueFrom(this.salesService.getSales());
      const salesArray = Array.isArray(allSales) ? allSales : [];
      
      const wholesaleSales = [];
      
      // Find ALL wholesale sales for this product
      for (const sale of salesArray) {
        const saleItems = sale.items?.filter((item: any) => item.productId === productId) || [];
        for (const item of saleItems) {
          if (item.isWholesale || sale.isWholesale) {
            wholesaleSales.push({
              ...sale,
              itemDetails: {
                productId: item.productId,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                total: item.total,
                isWholesale: item.isWholesale,
                bundleSize: item.bundleSize,
                bundlePrice: item.bundlePrice
              }
            });
            break; // Only add the sale once even if it has multiple wholesale items for this product
          }
        }
      }
      
      return wholesaleSales;
    } catch (err) {
      console.error('Error finding all wholesale sales:', err);
      return [];
    }
  }

  private async findDiscountSaleForProduct(productId: number): Promise<any> {
    try {
      const allSales = await firstValueFrom(this.salesService.getSales());
      const salesArray = Array.isArray(allSales) ? allSales : [];
      
      // Find the most recent sale with discount for this product
      for (const sale of salesArray.reverse()) {
        const saleItems = sale.items?.filter((item: any) => item.productId === productId) || [];
        for (const item of saleItems) {
          if (Number(item.discount) > 0) {
            return sale;
          }
        }
      }
      return null;
    } catch (err) {
      console.error('Error finding discount sale:', err);
      return null;
    }
  }

  openSaleDetails(saleId: number): void {
    if (saleId) {
      // Open sale details in a new tab or modal
      const saleUrl = `${environment.apiUrl}/sales/${saleId}`;
      window.open(saleUrl, '_blank');
    }
  }





  showWholesaleSalesDialog(row: ReleveInventaireRow): void {
    if (row.wholesaleSales && row.wholesaleSales.length > 0) {
      this.selectedWholesaleSales = row.wholesaleSales;
      this.selectedWholesaleProduct = row.details?.split('Produit: ')[1]?.split(' |')[0] || 'Produit inconnu';
      this.showWholesaleDialog = true;
    }
  }

  closeWholesaleDialog(): void {
    this.showWholesaleDialog = false;
    this.selectedWholesaleSales = [];
    this.selectedWholesaleProduct = '';
  }

  showGratuitSalesDialog(row: ReleveInventaireRow): void {
    if (row.gratuitSales && row.gratuitSales.length > 0) {
      this.selectedGratuitSales = row.gratuitSales;
      this.selectedGratuitProduct = row.details?.split('Produit: ')[1]?.split(' |')[0] || 'Produit inconnu';
      this.showGratuitDialog = true;
    }
  }

  closeGratuitDialog(): void {
    this.showGratuitDialog = false;
    this.selectedGratuitSales = [];
    this.selectedGratuitProduct = '';
  }

  calculateTotalLoss(): number {
    return this.selectedWholesaleSales.reduce((sum, sale) => {
      // Find the product to get the retail price
      const product = this.products.find(p => p.id === sale.itemDetails?.productId);
      const retailPrice = product ? Number(product.prix_vente_TTC) || 0 : 0;
      const quantity = sale.itemDetails?.quantity || 0;
      const wholesaleTotal = sale.itemDetails?.total || 0;
      const retailTotal = retailPrice * quantity;
      return sum + (retailTotal - wholesaleTotal);
    }, 0);
  }

  calculateTotalWholesale(): number {
    return this.selectedWholesaleSales.reduce((sum, sale) => sum + (sale.itemDetails?.total || 0), 0);
  }

  calculateTotalRetail(): number {
    return this.selectedWholesaleSales.reduce((sum, sale) => {
      // Find the product to get the retail price
      const product = this.products.find(p => p.id === sale.itemDetails?.productId);
      const retailPrice = product ? Number(product.prix_vente_TTC) || 0 : 0;
      const quantity = sale.itemDetails?.quantity || 0;
      return sum + (retailPrice * quantity);
    }, 0);
  }

  calculateTotalGratuit(): number {
    return this.selectedGratuitSales.reduce((sum, sale) => {
      return sum + (sale.itemDetails?.total || 0);
    }, 0);
  }

  calculateTotalGratuitQuantity(): number {
    return this.selectedGratuitSales.reduce((sum, sale) => {
      return sum + (sale.itemDetails?.quantity || 0);
    }, 0);
  }

  calculateTotalGratuitValue(): number {
    return this.selectedGratuitSales.reduce((sum, sale) => {
      // Find the product to get the retail price
      const product = this.products.find(p => p.id === sale.itemDetails?.productId);
      const retailPrice = product ? Number(product.prix_vente_TTC) || 0 : 0;
      const quantity = sale.itemDetails?.quantity || 0;
      return sum + (retailPrice * quantity);
    }, 0);
  }

  calculateSaleLoss(sale: any): number {
    // Find the product to get the retail price
    const product = this.products.find(p => p.id === sale.itemDetails?.productId);
    const retailPrice = product ? Number(product.prix_vente_TTC) || 0 : 0;
    const quantity = sale.itemDetails?.quantity || 0;
    const wholesaleTotal = sale.itemDetails?.total || 0;
    const retailTotal = retailPrice * quantity;
    return retailTotal - wholesaleTotal;
  }



  onEcartRowClick(row: ReleveInventaireRow): void {
    if (row.saleId) {
      this.openSaleDetails(row.saleId);
    }
  }

  isEcartRowClickable(row: ReleveInventaireRow): boolean {
    return !!(row.saleId && row.ecartType);
  }

  getEcartRowClass(row: ReleveInventaireRow): string {
    if (!row.ecartType) return '';
    
    const baseClass = 'ecart-row';
    const typeClass = `ecart-${row.ecartType.toLowerCase()}`;
    const clickableClass = this.isEcartRowClickable(row) ? 'clickable' : '';
    
    return `${baseClass} ${typeClass} ${clickableClass}`.trim();
  }

  toggleEcartGrosExpansion(ecartId: string): void {
    if (this.expandedEcartGros.has(ecartId)) {
      this.expandedEcartGros.delete(ecartId);
    } else {
      this.expandedEcartGros.add(ecartId);
    }
  }

  isEcartGrosExpanded(ecartId: string): boolean {
    return this.expandedEcartGros.has(ecartId);
  }

  isEcartGrosChild(row: ReleveInventaireRow): boolean {
    return !!(row.isEcartGrosChild && row.parentId);
  }

  getEcartGrosParentId(row: ReleveInventaireRow): string {
    if (row.parentId) {
      // Convert "ecart_123" to "gros_123"
      return row.parentId.replace('ecart_', 'gros_');
    }
    return '';
  }

  shouldShowEcartGrosChild(row: ReleveInventaireRow): boolean {
    if (!this.isEcartGrosChild(row)) return true;
    
    const parentId = this.getEcartGrosParentId(row);
    return this.isEcartGrosExpanded(parentId);
  }


  getTextBeforeWholesaleSales(text: string): string {
    const match = text.match(/(.*?)\s*\(\d+\s+ventes\s+gros\)/);
    return match ? match[1] : text;
  }

  getWholesaleSalesText(text: string): string {
    const match = text.match(/\((\d+\s+ventes\s+gros)\)/);
    return match ? match[1] : '';
  }

  getTextAfterWholesaleSales(text: string): string {
    const match = text.match(/\(\d+\s+ventes\s+gros\)(.*)/);
    return match ? match[1] : '';
  }

  getTextBeforeGratuitSales(text: string): string {
    const match = text.match(/(.*?)\s*\(\d+\s+ventes\s+gratuité\)/);
    return match ? match[1] : text;
  }

  getGratuitSalesText(text: string): string {
    const match = text.match(/\((\d+\s+ventes\s+gratuité)\)/);
    return match ? match[1] : '';
  }

  getTextAfterGratuitSales(text: string): string {
    const match = text.match(/\(\d+\s+ventes\s+gratuité\)(.*)/);
    return match ? match[1] : '';
  }

  toggleInactiveProducts(): void {
    this.showInactiveProducts = !this.showInactiveProducts;
  }

  toggleReconciliationTable(): void {
    this.isReconciliationTableCollapsed = !this.isReconciliationTableCollapsed;
  }

  toggleReleveInventaireTable(): void {
    this.isReleveInventaireTableCollapsed = !this.isReleveInventaireTableCollapsed;
  }

  toggleGlobalEcartTable(): void {
    this.isGlobalEcartTableCollapsed = !this.isGlobalEcartTableCollapsed;
  }

  getFilteringSummary(): string {
    if (this.totalProducts === 0) return '';
    
    const inactiveCount = this.totalProducts - this.activeProducts;
    const percentage = Math.round((this.activeProducts / this.totalProducts) * 100);
    
    return `${this.activeProducts} produits actifs sur ${this.totalProducts} total (${percentage}%) - ${inactiveCount} produits inactifs filtrés`;
  }

  private async createBasicReconciliationForProduct(product: Product, dateFrom: Date, dateTo: Date): Promise<ReconciliationData> {
    // Create a basic reconciliation entry with empty data
    const basicSummary = {
      totalAchatEntree: { qty: 0, totale: 0 },
      totalAchatSortie: { qty: 0, totale: 0 },
      totalVenteEntree: { qty: 0, totale: 0 },
      totalVenteSortie: { qty: 0, totale: 0 },
      cogs: 0,
      endingStock: { qty: 0, value: 0, pu: 0 }
    };

    // Calculate basic Relevé Inventaire data
    // Get current inventory stock value directly - no calculations needed
    const solde = await this.getCurrentInventoryStockValue(product);
    
    const releveInventaire: ReleveInventaireRow = {
      id: `product_${product.id}`,
      designation: product.name,
      debut: 0, // Not used when using direct inventory value
      credit: 0, // Not used when using direct inventory value
      solde: solde, // Direct current inventory stock value
      type: 'ENTRY'
    };

    return {
      productId: product.id,
      productName: product.name,
      rows: [],
      summary: basicSummary,
      ecartData: undefined,
      releveInventaire: releveInventaire
    };
  }

  private async calculateDebutForReleve(product: Product): Promise<number> {
    try {
      // Get current inventory balance for this product from the inventory system
      const depotId = this.getDepotId();
      if (!depotId) {
        return 0;
      }

      const response = await firstValueFrom(this.http.get<any>(`${environment.apiUrl}/stock-documents/inventory/${depotId}`));
      
      // Find the inventory record for this product
      const inventoryRecord = response.find((record: any) => record.productId === product.id);
      if (!inventoryRecord) {
        return 0;
      }

      // Calculate current stock value: quantity * sale price
      const currentQuantity = Number(inventoryRecord.quantity) || 0;
      const prixVente = Number(product.prix_vente_TTC) || 0;
      const currentStockValue = currentQuantity * prixVente;
      
      return currentStockValue;
    } catch (err) {
      console.error('Error calculating debut for product:', product.id, err);
      return 0;
    }
  }

  private getDepotId(): number | null {
    // Prefer current open session depot if available
    const sessionDepotId = this.sessionsService.currentSession()?.depotId;
    if (sessionDepotId) return sessionDepotId;
    // Fallback to any loaded inventory session depot
    const invDepotId = this.inventorySessions?.[0]?.depotId;
    return invDepotId ?? null;
  }

  private async getCurrentInventoryStockValue(product: Product): Promise<number> {
    try {
      // Get current inventory balance for this product from the inventory system
      const depotId = this.getDepotId();
      if (!depotId) {
        return 0;
      }

      const response = await firstValueFrom(this.http.get<any>(`${environment.apiUrl}/stock-documents/inventory/${depotId}`));
      
      // Find the inventory record for this product
      const inventoryRecord = response.find((record: any) => record.productId === product.id);
      if (!inventoryRecord) {
        return 0;
      }

      // Calculate current stock value: quantity * sale price
      const currentQuantity = Number(inventoryRecord.quantity) || 0;
      const prixVente = Number(product.prix_vente_TTC) || 0;
      const currentStockValue = currentQuantity * prixVente;
      
      return currentStockValue;
    } catch (err) {
      console.error('Error getting current inventory stock value for product:', product.id, err);
      return 0;
    }
  }

  private async calculateCreditForReleve(product: Product): Promise<number> {
    try {
      let totalCredit = 0;
      
      // Only include actual sales revenue (no ecart calculations)
      const cashClosures = await this.getCashClosuresForProduct(product.id);
      totalCredit += cashClosures;
      
      // Note: Écarts are ONLY shown in designation, never calculated in credit/debit
      
      return totalCredit;
    } catch (err) {
      console.error('Error calculating credit for product:', product.id, err);
      return 0;
    }
  }

  private async getEcartForProduct(product: Product): Promise<{ qty: number; value: number }> {
    try {
      // Get current inventory balance
      const depotId = this.getDepotId();
      if (!depotId) {
        return { qty: 0, value: 0 };
      }

      const response = await firstValueFrom(this.http.get<any>(`${environment.apiUrl}/stock-documents/inventory/${depotId}`));
      const inventoryRecord = response.find((record: any) => record.productId === product.id);
      
      if (!inventoryRecord) {
        return { qty: 0, value: 0 };
      }

      const currentQuantity = Number(inventoryRecord.quantity) || 0;
      const prixVente = Number(product.prix_vente_TTC) || 0;
      const currentValue = currentQuantity * prixVente;

      // Get theoretical quantity from sales data (this is a simplified calculation)
      // In a real scenario, you might want to get this from a more sophisticated calculation
      const sales = await firstValueFrom(this.salesService.getSales());
      const salesArray = Array.isArray(sales) ? sales : [];
      
      let theoreticalQuantity = 0;
      for (const sale of salesArray) {
        const saleItems = sale.items?.filter((item: any) => item.productId === product.id) || [];
        for (const item of saleItems) {
          const qty = Number(item.quantity) || 0;
          theoreticalQuantity += qty;
        }
      }

      const ecartQty = currentQuantity - theoreticalQuantity;
      const ecartValue = ecartQty * prixVente;

      return { qty: ecartQty, value: ecartValue };
    } catch (err) {
      console.error('Error calculating ecart for product:', product.id, err);
      return { qty: 0, value: 0 };
    }
  }

  private async getCashClosuresForProduct(productId: number): Promise<number> {
    try {
      // Get all sales data and filter by product
      const allSales = await firstValueFrom(this.salesService.getSales());
      const salesArray = Array.isArray(allSales) ? allSales : [];
      
      let total = 0;
        for (const sale of salesArray) {
        // Process all sales (not just closed sessions) to avoid API calls
          const saleItems = sale.items?.filter((item: any) => item.productId === productId) || [];
          for (const item of saleItems) {
            const itemTotal = Number(item.total) || 0;
            total += itemTotal;
        }
      }
      
      return total;
    } catch (err) {
      console.error('Error getting cash closures for product:', productId, err);
      return 0;
    }
  }

  private async getExpensesForProduct(productId: number): Promise<number> {
    try {
      // Get expenses data
      const expenses = await firstValueFrom(this.http.get<any[]>(`${environment.apiUrl}/expenses`));
      const expensesArray = Array.isArray(expenses) ? expenses : [];
      
      let total = 0;
      for (const expense of expensesArray) {
        // Check if expense is related to this product
        if (expense.productId === productId || expense.products?.some((p: any) => p.productId === productId)) {
          total += Number(expense.amount) || 0;
        }
      }
      
      return total;
    } catch (err) {
      console.error('Error getting expenses for product:', productId, err);
      return 0;
    }
  }

  private async getGlobalEcartForProduct(productId: number): Promise<number> {
    try {
      // Get global ecart data for this product from reconciliation data
      const reconciliationData = this.reconciliationData.find(data => data.productId === productId);
      if (reconciliationData?.ecartData) {
        return Number(reconciliationData.ecartData.ecartGlobal) || 0;
      }
      
      return 0;
    } catch (err) {
      console.error('Error getting global ecart for product:', productId, err);
      return 0;
    }
  }

  private async getDiscountsForProduct(productId: number): Promise<number> {
    try {
      // Get sales with discounts for this product
      const sales = await firstValueFrom(this.salesService.getSales());
      const salesArray = Array.isArray(sales) ? sales : [];
      
      let total = 0;
      for (const sale of salesArray) {
        const saleItems = sale.items?.filter((item: any) => item.productId === productId) || [];
        for (const item of saleItems) {
          const discount = Number(item.discount) || 0;
          total += discount;
        }
      }
      
      return total;
    } catch (err) {
      console.error('Error getting discounts for product:', productId, err);
      return 0;
    }
  }

  private async getStockReturnsForProduct(productId: number): Promise<number> {
    try {
      // Get stock returns for this product from stock documents using valid DocumentType
      const response = await firstValueFrom(this.http.get<any>(`${environment.apiUrl}/stock-documents`, {
        params: {
          type: 'BON_EXPEDITION' // Use valid DocumentType for returns
        }
      }));
      
      // Handle different response formats
      let stockDocsArray = [];
      if (Array.isArray(response)) {
        stockDocsArray = response;
      } else if (response && Array.isArray(response.data)) {
        stockDocsArray = response.data;
      } else if (response && response.stockDocuments && Array.isArray(response.stockDocuments)) {
        stockDocsArray = response.stockDocuments;
      } else {
        stockDocsArray = [];
      }
      
      let total = 0;
      for (const doc of stockDocsArray) {
        // Check if this is a return document based on notes
        const isReturn = doc.notes?.toLowerCase().includes('retour') || 
                        doc.notes?.toLowerCase().includes('return');
        
        if (isReturn) {
        const items = doc.items?.filter((item: any) => item.productId === productId) || [];
        for (const item of items) {
          const qty = Number(item.quantity) || 0;
          const product = this.products.find(p => p.id === productId);
          const price = Number(product?.prix_vente_TTC) || 0;
          total += qty * price;
          }
        }
      }
      
      return total;
    } catch (err) {
      console.error('Error getting stock returns for product:', productId, err);
      return 0;
    }
  }

  printA4(): void {
    const title = 'Réconciliation Inventaire & Ventes';
    const period = this.rangeMode === 'DATE' 
      ? `Période: ${this.startDate} au ${this.endDate}`
      : this.rangeMode === 'INVENTORY'
      ? `Inventaire: ${this.startInventoryId} → ${this.endInventoryId}`
      : 'Dernier → Avant Dernier';
    
    let htmlContent = `
      <div class="header">
        <div class="title">${title}</div>
        <div class="subtitle">${period} | Mode: ${this.valuationMode}</div>
      </div>
    `;

    if (this.globalEcartSummary) {
      htmlContent += `
        <div class="summary">
          <p><strong>Total Produits:</strong> ${this.globalEcartSummary.totalProducts}</p>
          <p><strong>Quantité Vendue:</strong> ${this.formatQuantity(this.globalEcartSummary.totalQtyVendu)}</p>
          <p><strong>CA Théorique:</strong> ${this.formatNumber(this.globalEcartSummary.totalChiffreAffaireTheorique)} dt</p>
          <p><strong>CA Réalisé:</strong> ${this.formatNumber(this.globalEcartSummary.totalChiffreAffaireRealise)} dt</p>
          <p><strong>Écart Global:</strong> ${this.formatNumber(this.globalEcartSummary.totalEcartGlobal)} dt</p>
        </div>
      `;
    }

    this.reconciliationData.forEach((data, index) => {
      htmlContent += `
        <h2 style="margin-top: 20px; margin-bottom: 10px; font-size: 14px; font-weight: bold;">${data.productName}</h2>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Désignation</th>
              <th>Achat Entrée Qty</th>
              <th>Achat Entrée PU</th>
              <th>Achat Entrée Total</th>
              <th>Achat Sortie Qty</th>
              <th>Achat Sortie PU</th>
              <th>Achat Sortie Total</th>
              <th>Achat Solde Qty</th>
              <th>Achat Solde PU</th>
              <th>Achat Solde Total</th>
              <th>Vente Entrée Qty</th>
              <th>Vente Entrée PU</th>
              <th>Vente Entrée Total</th>
              <th>Vente Sortie Qty</th>
              <th>Vente Sortie PU</th>
              <th>Vente Sortie Total</th>
              <th>Vente Solde Qty</th>
              <th>Vente Solde PU</th>
              <th>Vente Solde Total</th>
            </tr>
          </thead>
          <tbody>
            ${data.rows.map(row => `
              <tr>
                <td>${new Date(row.date).toLocaleDateString('fr-FR')}</td>
                <td>${row.designation}</td>
                <td style="text-align: right;">${this.formatQuantity(row.achat.entree.qty)}</td>
                <td style="text-align: right;">${this.formatNumber(row.achat.entree.pu)}</td>
                <td style="text-align: right;">${this.formatNumber(row.achat.entree.totale)}</td>
                <td style="text-align: right;">${this.formatQuantity(row.achat.sortie.qty)}</td>
                <td style="text-align: right;">${this.formatNumber(row.achat.sortie.pu)}</td>
                <td style="text-align: right;">${this.formatNumber(row.achat.sortie.totale)}</td>
                <td style="text-align: right;">${this.formatQuantity(row.achat.solde.qty)}</td>
                <td style="text-align: right;">${this.formatNumber(row.achat.solde.pu)}</td>
                <td style="text-align: right;">${this.formatNumber(row.achat.solde.totale)}</td>
                <td style="text-align: right;">${this.formatQuantity(row.vente.entree.qty)}</td>
                <td style="text-align: right;">${this.formatNumber(row.vente.entree.pu)}</td>
                <td style="text-align: right;">${this.formatNumber(row.vente.entree.totale)}</td>
                <td style="text-align: right;">${this.formatQuantity(row.vente.sortie.qty)}</td>
                <td style="text-align: right;">${this.formatNumber(row.vente.sortie.pu)}</td>
                <td style="text-align: right;">${this.formatNumber(row.vente.sortie.totale)}</td>
                <td style="text-align: right;">${this.formatQuantity(row.vente.solde.qty)}</td>
                <td style="text-align: right;">${this.formatNumber(row.vente.solde.pu)}</td>
                <td style="text-align: right;">${this.formatNumber(row.vente.solde.totale)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    });

    this.printService.printA4Report(htmlContent, title);
  }
}