import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { InventoryService, InventorySession } from '../../core/services/inventory.service';
import { SalesService } from '../../core/services/sales.service';
import { ProductsService } from '../../core/services/products.service';
import { Product, ProductFamily } from '../../core/models/product.model';
import { Sale, SaleItem } from '../../core/models/sale.model';

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
  
  // UI state
  loading = false;
  error = '';
  showReport = false;
  
  constructor(
    private http: HttpClient,
    private inventoryService: InventoryService,
    private salesService: SalesService,
    private productsService: ProductsService
  ) {}

  ngOnInit(): void {
    this.setDefaultDateRange();
    this.loadInitialData();
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

    for (const product of products) {
      try {
        const data = await this.generateProductReconciliation(product, dateFrom, dateTo);
        
        // Include products that have any data (rows, movements, or initial inventory)
        if (data.rows.length > 0) {
          this.reconciliationData.push(data);
        }
      } catch (err) {
        console.error(`Error generating reconciliation for product ${product.id}:`, err);
      }
    }

    this.loading = false;
    this.showReport = true;
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

    return {
      productId: product.id,
      productName: product.name,
      rows,
      summary,
      ecartData
    };
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
          const isGift = sale.status === 'CADEAU';
          const discount = Number(item.discount) || 0;

          qtyVendu += itemQty;
          chiffreAffaireRealise += itemTotal;

          if (isWholesale) {
            qtyVenduGros += itemQty;
            prixVenteGros += itemTotal;
          }

          if (isGift) {
            ecartGratuite += itemTotal;
          }

          if (discount > 0) {
            ecartRemise += discount;
          }
        }
      }

      const prixVenteUnitaire = Number(product.prix_vente_TTC) || 0;
      const chiffreAffaireTheorique = qtyVendu * prixVenteUnitaire;
      
      // Écart vente en gros: (qté vendu en gros * prix de vente en gros) - (qté vendu en gros * prix de vente unitaire)
      const ecartVenteGros = qtyVenduGros > 0 ? 
        prixVenteGros - (qtyVenduGros * prixVenteUnitaire) : 0;

      // Écart global: (qté vendu * prix de vente unitaire) - (chiffre d'affaire réalisé)
      const ecartGlobal = chiffreAffaireTheorique - chiffreAffaireRealise;

      // Déférence d'écart: écart théorique - (écart réalisé + écart global)
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
        const stockEntries = await firstValueFrom(this.http.get<any[]>(`${environment.apiUrl}/stock-documents`, {
          params: {
            type: 'BON_ENTREE_DEPOT',
            dateFrom: dateFrom.toISOString(),
            dateTo: dateTo.toISOString()
          }
        }));


        // Handle the API response structure - it has a 'data' property
        const entries = Array.isArray(stockEntries) ? stockEntries : ((stockEntries as any)?.data || []);
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
}