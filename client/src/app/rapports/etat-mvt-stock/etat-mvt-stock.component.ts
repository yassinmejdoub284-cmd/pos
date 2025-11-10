import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { PrintService } from '../../core/services/print.service';

interface StockMovementData {
  id: number;
  productId: number;
  depotId: number;
  quantity: number;
  type: 'IN' | 'OUT' | 'TRANSFER';
  fromDepotId?: number;
  toDepotId?: number;
  reason: string;
  reference?: string;
  userId: number;
  date: string;
  // Enriched data
  productName: string;
  depotName: string;
  depotCode: string;
  // Document item data
  documentItem?: {
    id: number;
    quantity: number;
    prixUnitaire?: number;
    purchasePrice?: number;
    montantTTC?: number;
    montantHT?: number;
    montantTVA?: number;
    tva?: number;
  };
  // Product data
  productPrixAchat?: number;
  productPrixVenteTTC?: number;
  productTVA?: number;
}

interface ReportRow {
  datePj: string;
  article: string;
  entreeQte?: number;
  entreePu?: number;
  entreeTotal?: number;
  sortieQte?: number;
  sortiePu?: number;
  sortieTotal?: number;
  stockQte: number;
  stockPu: number;
  stockTotal: number;
  notes?: string;
  isTicket?: boolean;
  isOpening?: boolean;
  rowType: 'MOUVEMENT' | 'INV' | 'BE' | 'TICKET' | 'BR';
  productId: number;
  depotId: number;
  date: string;
  reference: string;
  movementId: number;
}

interface InventoryData {
  productId: number;
  depotId: number;
  quantity: number;
  reservedQuantity: number;
  lastUpdated: string;
}

@Component({
  selector: 'app-etat-mvt-stock',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './etat-mvt-stock.component.html',
  styleUrls: ['./etat-mvt-stock.component.css']
})
export class EtatMvtStockComponent implements OnInit {
  // Signals for reactive state
  stockMovements = signal<StockMovementData[]>([]);
  inventoryData = signal<InventoryData[]>([]);
  reportRows = signal<ReportRow[]>([]);
  filteredRows = signal<ReportRow[]>([]);
  
  // Filter signals
  dateFilter = signal<string>('');
  articleFilter = signal<string>('');
  
  // Display mode
  displayMode = signal<'detail' | 'closure'>('detail');
  // Toggle last section per product group (collapse/expand details)
  // Collapsed state per (productId-depotId)
  collapsedGroups = signal<Record<string, boolean>>({});
  
  // Loading state
  isLoading = signal<boolean>(false);
  
  // Computed filtered rows
  computedFilteredRows = computed(() => {
    const rows = this.reportRows();
    const dateFilter = this.dateFilter();
    const articleFilter = this.articleFilter();
    
    return rows.filter(row => {
      const dateMatch = !dateFilter || row.datePj.toLowerCase().includes(dateFilter.toLowerCase());
      const articleMatch = !articleFilter || row.article.toLowerCase().includes(articleFilter.toLowerCase());
      return dateMatch && articleMatch;
    });
  });

  private readonly printService = inject(PrintService);

  constructor(private http: HttpClient, private router: Router) {}

  ngOnInit() {
    this.loadData();
  }

  async loadData() {
    this.isLoading.set(true);
    try {
      // Load movements first to determine depotId, then load inventory for that depot
      await this.loadStockMovements();
      const firstMovement = this.stockMovements()[0];
      const depotId = firstMovement?.depotId || 3; // fallback to 3 (shop) if unknown
      await this.loadInventoryData(depotId);
      this.generateReport();
    } catch (error) {
      console.error('Error loading data:', error);
      // Load sample data for testing
      this.loadSampleData();
    } finally {
      this.isLoading.set(false);
    }
  }

  loadSampleData() {
    console.log('Loading sample data for testing...');
    
    // Sample inventory data
    const sampleInventory: InventoryData[] = [
      {
        productId: 1,
        depotId: 1,
        quantity: 100,
        reservedQuantity: 0,
        lastUpdated: new Date().toISOString()
      }
    ];
    this.inventoryData.set(sampleInventory);
    
    // Sample stock movements
    const sampleMovements: StockMovementData[] = [
      {
        id: 1,
        productId: 1,
        depotId: 1,
        quantity: 50,
        type: 'IN',
        reason: 'Purchase',
        reference: 'INV 001',
        userId: 1,
        date: new Date().toISOString(),
        productName: 'Sample Product',
        depotName: 'Main Depot',
        depotCode: 'MAIN',
        documentItem: {
          id: 1,
          quantity: 50,
          prixUnitaire: 10.5,
          purchasePrice: 10.5,
          montantTTC: 525,
          montantHT: 441.18,
          montantTVA: 83.82,
          tva: 19
        },
        productPrixAchat: 10.5,
        productPrixVenteTTC: 15.0,
        productTVA: 19
      },
      {
        id: 2,
        productId: 1,
        depotId: 1,
        quantity: 10,
        type: 'OUT',
        reason: 'Sale',
        reference: 'TICKET 001',
        userId: 1,
        date: new Date().toISOString(),
        productName: 'Sample Product',
        depotName: 'Main Depot',
        depotCode: 'MAIN',
        documentItem: {
          id: 2,
          quantity: 10,
          prixUnitaire: 15.0,
          purchasePrice: 10.5,
          montantTTC: 150,
          montantHT: 126.05,
          montantTVA: 23.95,
          tva: 19
        },
        productPrixAchat: 10.5,
        productPrixVenteTTC: 15.0,
        productTVA: 19
      }
    ];
    this.stockMovements.set(sampleMovements);
    
    this.generateReport();
  }

  async loadStockMovements() {
    const response = await this.http.get<any[]>(`${environment.apiUrl}/reports/etat-mvt-stock`).toPromise();
    
    const movements: StockMovementData[] = response?.map(movement => ({
      id: movement.id,
      productId: movement.productId,
      depotId: movement.depotId,
      quantity: parseFloat(movement.quantity),
      type: movement.type,
      fromDepotId: movement.fromDepotId,
      toDepotId: movement.toDepotId,
      reason: movement.reason,
      reference: movement.reference,
      userId: movement.userId,
      date: movement.date,
      productName: movement.product?.name || '',
      depotName: movement.depot?.name || '',
      depotCode: movement.depot?.code || '',
      documentItem: movement.documentItem ? {
        id: movement.documentItem.id,
        quantity: parseFloat(movement.documentItem.quantity),
        prixUnitaire: movement.documentItem.prixUnitaire ? parseFloat(movement.documentItem.prixUnitaire) : undefined,
        purchasePrice: movement.documentItem.purchasePrice ? parseFloat(movement.documentItem.purchasePrice) : undefined,
        montantTTC: movement.documentItem.montantTTC ? parseFloat(movement.documentItem.montantTTC) : undefined,
        montantHT: movement.documentItem.montantHT ? parseFloat(movement.documentItem.montantHT) : undefined,
        montantTVA: movement.documentItem.montantTVA ? parseFloat(movement.documentItem.montantTVA) : undefined,
        tva: movement.documentItem.tva ? parseFloat(movement.documentItem.tva) : undefined
      } : undefined,
      productPrixAchat: movement.product?.prix_achat ? parseFloat(movement.product.prix_achat) : undefined,
      productPrixVenteTTC: movement.product?.prix_vente_TTC ? parseFloat(movement.product.prix_vente_TTC) : undefined,
      productTVA: movement.product?.tva ? parseFloat(movement.product.tva) : undefined
    })) || [];
    
    this.stockMovements.set(movements);
  }

  async loadInventoryData(depotId: number) {
    const response = await this.http.get<any[]>(`${environment.apiUrl}/stock/inventory`, {
      params: { depotId: depotId.toString() }
    }).toPromise();
    
    const inventory: InventoryData[] = response?.map(item => ({
      productId: item.productId,
      depotId: item.depotId,
      quantity: parseFloat(item.quantity),
      reservedQuantity: parseFloat(item.reservedQuantity),
      lastUpdated: item.lastUpdated
    })) || [];
    
    this.inventoryData.set(inventory);
  }

  generateReport() {
    const movements = this.stockMovements();
    const inventory = this.inventoryData();
    const mode = this.displayMode();
    
    // Group movements by (productId, depotId)
    const groupedMovements = new Map<string, StockMovementData[]>();
    
    movements.forEach(movement => {
      const key = `${movement.productId}-${movement.depotId}`;
      if (!groupedMovements.has(key)) {
        groupedMovements.set(key, []);
      }
      groupedMovements.get(key)!.push(movement);
    });
    
    const allRows: ReportRow[] = [];
    
    // Process each product-depot combination
    groupedMovements.forEach((productMovements, key) => {
      const [productId, depotId] = key.split('-').map(Number);
      
      // Sort movements by date, reference, movement id
      productMovements.sort((a, b) => {
        const dateCompare = new Date(a.date).getTime() - new Date(b.date).getTime();
        if (dateCompare !== 0) return dateCompare;
        
        const refCompare = (a.reference || '').localeCompare(b.reference || '');
        if (refCompare !== 0) return refCompare;
        
        return a.id - b.id;
      });
      
      // Get opening inventory
      const openingInventory = inventory.find(inv => 
        inv.productId === productId && inv.depotId === depotId
      );
      
      const openingQty = openingInventory?.quantity || 0;
      const openingCump = this.calculateOpeningCump(productMovements, productId);
      
      if (mode === 'detail') {
        // Detail mode: show all movements
        this.generateDetailMode(allRows, productMovements, productId, depotId, openingQty, openingCump);
      } else {
        // Closure mode: consolidate by date
        this.generateClosureMode(allRows, productMovements, productId, depotId, openingQty, openingCump);
      }
    });
    
    this.reportRows.set(allRows);
  }

  private generateDetailMode(
    allRows: ReportRow[], 
    productMovements: StockMovementData[], 
    productId: number, 
    depotId: number, 
    openingQty: number, 
    openingCump: number
  ) {
    // Add opening/summary line
    const openingRow: ReportRow = {
      datePj: 'MOUVEMENT',
      article: productMovements[0]?.productName || '',
      stockQte: openingQty,
      stockPu: openingCump,
      stockTotal: openingQty * openingCump,
      rowType: 'MOUVEMENT',
      productId,
      depotId,
      date: '',
      reference: 'MOUVEMENT',
      movementId: 0,
      isOpening: true
    };
    allRows.push(openingRow);
    
    // Process movements with running balance
    let runningQty = openingQty;
    let runningValue = openingQty * openingCump;
    let cump = openingCump;
    
    productMovements.forEach(movement => {
      const row = this.processMovement(movement, runningQty, runningValue, cump);
      
      // Update running balance
      if (movement.type === 'IN') {
        const inQty = row.entreeQte || 0;
        const inValue = (row.entreePu || 0) * inQty;
        runningQty += inQty;
        runningValue += inValue;
        cump = runningQty > 0 ? runningValue / runningQty : cump;
      } else if (movement.type === 'OUT') {
        const outQty = row.sortieQte || 0;
        const outValue = cump * outQty;
        runningQty -= outQty;
        runningValue -= outValue;
      }
      
      row.stockQte = runningQty;
      row.stockPu = cump;
      row.stockTotal = runningQty * cump;
      
      allRows.push(row);
    });
  }

  private generateClosureMode(
    allRows: ReportRow[], 
    productMovements: StockMovementData[], 
    productId: number, 
    depotId: number, 
    openingQty: number, 
    openingCump: number
  ) {
    // Group movements by date
    const movementsByDate = new Map<string, StockMovementData[]>();
    
    productMovements.forEach(movement => {
      const dateKey = new Date(movement.date).toDateString();
      if (!movementsByDate.has(dateKey)) {
        movementsByDate.set(dateKey, []);
      }
      movementsByDate.get(dateKey)!.push(movement);
    });
    
    let runningQty = openingQty;
    let runningValue = openingQty * openingCump;
    let cump = openingCump;
    
    // Process each date
    movementsByDate.forEach((dayMovements, dateKey) => {
      const date = new Date(dateKey);
      
      // Calculate totals for the day
      let dayEntreeQte = 0;
      let dayEntreeTotal = 0;
      let daySortieQte = 0;
      let daySortieTotal = 0;
      
      dayMovements.forEach(movement => {
        if (movement.type === 'IN') {
          const quantity = movement.documentItem?.quantity || movement.quantity;
          const unitPrice = movement.documentItem?.prixUnitaire || 
                           movement.documentItem?.purchasePrice || 
                           movement.productPrixAchat || 0;
          const total = movement.documentItem?.montantTTC || (quantity * unitPrice);
          
          dayEntreeQte += quantity;
          dayEntreeTotal += total;
          
          // Update running balance
          runningQty += quantity;
          runningValue += total;
          cump = runningQty > 0 ? runningValue / runningQty : cump;
        } else if (movement.type === 'OUT') {
          const quantity = movement.documentItem?.quantity || movement.quantity;
          const sellingPrice = this.calculateSellingPrice(movement);
          const total = movement.documentItem?.montantTTC || (quantity * sellingPrice);
          
          daySortieQte += quantity;
          daySortieTotal += total;
          
          // Update running balance
          const outValue = cump * quantity;
          runningQty -= quantity;
          runningValue -= outValue;
        }
      });
      
      // Create consolidated row for the day
      const consolidatedRow: ReportRow = {
        datePj: this.formatDatePj('CLOTURE', date.toISOString()),
        article: dayMovements[0]?.productName || '',
        entreeQte: dayEntreeQte > 0 ? dayEntreeQte : undefined,
        entreePu: dayEntreeQte > 0 ? dayEntreeTotal / dayEntreeQte : undefined,
        entreeTotal: dayEntreeTotal > 0 ? dayEntreeTotal : undefined,
        sortieQte: daySortieQte > 0 ? daySortieQte : undefined,
        sortiePu: daySortieQte > 0 ? daySortieTotal / daySortieQte : undefined,
        sortieTotal: daySortieTotal > 0 ? daySortieTotal : undefined,
        stockQte: runningQty,
        stockPu: cump,
        stockTotal: runningQty * cump,
        rowType: 'MOUVEMENT',
        productId,
        depotId,
        date: date.toISOString(),
        reference: 'CLOTURE',
        movementId: 0,
        isOpening: false
      };
      
      allRows.push(consolidatedRow);
    });
  }

  private calculateOpeningCump(movements: StockMovementData[], productId: number): number {
    // Find the first IN movement to get initial CUMP
    const firstInMovement = movements.find(m => m.type === 'IN');
    if (firstInMovement?.documentItem?.prixUnitaire) {
      return firstInMovement.documentItem.prixUnitaire;
    }
    if (firstInMovement?.documentItem?.purchasePrice) {
      return firstInMovement.documentItem.purchasePrice;
    }
    if (firstInMovement?.productPrixAchat) {
      return firstInMovement.productPrixAchat;
    }
    return 0;
  }

  private processMovement(movement: StockMovementData, runningQty: number, runningValue: number, cump: number): ReportRow {
    const datePj = this.formatDatePj(movement.reference, movement.date);
    const rowType = this.determineRowType(movement.reference);
    
    const row: ReportRow = {
      datePj,
      article: movement.productName,
      stockQte: runningQty,
      stockPu: cump,
      stockTotal: runningQty * cump,
      rowType,
      productId: movement.productId,
      depotId: movement.depotId,
      date: movement.date,
      reference: movement.reference || '',
      movementId: movement.id,
      isTicket: rowType === 'TICKET'
    };
    
    if (movement.type === 'IN') {
      const quantity = movement.documentItem?.quantity || movement.quantity;
      const unitPrice = movement.documentItem?.prixUnitaire || 
                       movement.documentItem?.purchasePrice || 
                       movement.productPrixAchat || 0;
      const total = movement.documentItem?.montantTTC || (quantity * unitPrice);
      
      row.entreeQte = quantity;
      row.entreePu = unitPrice;
      row.entreeTotal = total;
    } else if (movement.type === 'OUT') {
      const quantity = movement.documentItem?.quantity || movement.quantity;
      const sellingPrice = this.calculateSellingPrice(movement);
      const total = movement.documentItem?.montantTTC || (quantity * sellingPrice);
      
      row.sortieQte = quantity;
      row.sortiePu = sellingPrice;
      row.sortieTotal = total;
    }
    
    return row;
  }

  private formatDatePj(reference: string | undefined, date: string): string {
    const dateObj = new Date(date);
    const formattedDate = dateObj.toLocaleDateString('fr-FR');
    return reference ? `${reference} ${formattedDate}` : formattedDate;
  }

  private determineRowType(reference: string | undefined): 'MOUVEMENT' | 'INV' | 'BE' | 'TICKET' | 'BR' {
    if (!reference) return 'MOUVEMENT';
    if (reference.startsWith('INV')) return 'INV';
    if (reference.startsWith('BE')) return 'BE';
    if (reference.startsWith('TICKET')) return 'TICKET';
    if (reference.startsWith('BR')) return 'BR';
    return 'MOUVEMENT';
  }

  private calculateSellingPrice(movement: StockMovementData): number {
    const documentItem = movement.documentItem;
    
    // Preferred: montantTTC / quantity
    if (documentItem?.montantTTC && documentItem.quantity > 0) {
      return documentItem.montantTTC / documentItem.quantity;
    }
    
    // Fallback to product selling price
    if (movement.productPrixVenteTTC) {
      return movement.productPrixVenteTTC;
    }
    
    // Last fallback to unit price
    if (documentItem?.prixUnitaire) {
      return documentItem.prixUnitaire;
    }
    
    return 0;
  }

  onDateFilterChange(event: Event) {
    const target = event.target as HTMLInputElement;
    this.dateFilter.set(target.value);
  }

  onArticleFilterChange(event: Event) {
    const target = event.target as HTMLInputElement;
    this.articleFilter.set(target.value);
  }

  toggleDisplayMode() {
    this.displayMode.set(this.displayMode() === 'detail' ? 'closure' : 'detail');
    this.generateReport(); // Regenerate with new mode
  }

  toggleGroup(productId: number, depotId: number) {
    const key = `${productId}-${depotId}`;
    const current = { ...this.collapsedGroups() };
    current[key] = !current[key];
    this.collapsedGroups.set(current);
  }

  isGroupCollapsed(productId: number, depotId: number): boolean {
    const key = `${productId}-${depotId}`;
    return !!this.collapsedGroups()[key];
  }

  // Deprecated: movement toggle removed; header is INVENTAIRE and groups are collapsible

  exportToExcel() {
    const rows = this.computedFilteredRows();
    const csvContent = this.generateCSV(rows);
    this.downloadFile(csvContent, 'etat-mvt-stock.csv', 'text/csv');
  }

  exportToPDF() {
    // For now, we'll export as CSV and let the user convert to PDF
    // In a real implementation, you'd use a library like jsPDF or html2pdf
    this.exportToExcel();
  }

  private generateCSV(rows: ReportRow[]): string {
    const headers = [
      'DATE/PJ',
      'ARTICLE', 
      'ENTREE.QTE',
      'ENTREE.PU',
      'ENTREE.TOTAL',
      'SORTIE.QTE',
      'SORTIE.PU', 
      'SORTIE.TOTAL',
      'STOCK.QTE',
      'STOCK.PU',
      'STOCK.TOTAL',
      'NOTES'
    ];

    const csvRows = [headers.join(',')];

    rows.forEach(row => {
      const csvRow = [
        `"${row.datePj}"`,
        `"${row.article}"`,
        row.entreeQte?.toFixed(3) || '',
        row.entreePu?.toFixed(3) || '',
        row.entreeTotal?.toFixed(3) || '',
        row.sortieQte?.toFixed(3) || '',
        row.sortiePu?.toFixed(3) || '',
        row.sortieTotal?.toFixed(3) || '',
        row.stockQte.toFixed(3),
        row.stockPu.toFixed(3),
        row.stockTotal.toFixed(3),
        row.notes || ''
      ];
      csvRows.push(csvRow.join(','));
    });

    return csvRows.join('\n');
  }

  private downloadFile(content: string, filename: string, mimeType: string) {
    const blob = new Blob([content], { type: mimeType });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }

  async testApiConnection() {
    try {
      console.log('Testing API connection...');
      const response = await this.http.get<any>(`${environment.apiUrl}/reports/etat-mvt-stock-test`).toPromise();
      console.log('API Test Response:', response);
      
      if (response?.movements && response.movements.length > 0) {
        // Convert test data to our format
        const testMovements: StockMovementData[] = response.movements.map((movement: any) => ({
          id: movement.id,
          productId: movement.productId,
          depotId: movement.depotId,
          quantity: parseFloat(movement.quantity),
          type: movement.type,
          fromDepotId: movement.fromDepotId,
          toDepotId: movement.toDepotId,
          reason: movement.reason,
          reference: movement.reference,
          userId: movement.userId,
          date: movement.date,
          productName: movement.product?.name || '',
          depotName: movement.depot?.name || '',
          depotCode: movement.depot?.code || '',
          documentItem: undefined,
          productPrixAchat: movement.product?.prix_achat ? parseFloat(movement.product.prix_achat) : undefined,
          productPrixVenteTTC: movement.product?.prix_vente_TTC ? parseFloat(movement.product.prix_vente_TTC) : undefined,
          productTVA: undefined
        }));
        
        this.stockMovements.set(testMovements);
        
        const testInventory: InventoryData[] = response.inventory.map((item: any) => ({
          productId: item.productId,
          depotId: item.depotId,
          quantity: parseFloat(item.quantity),
          reservedQuantity: parseFloat(item.reservedQuantity),
          lastUpdated: item.lastUpdated
        }));
        
        this.inventoryData.set(testInventory);
        this.generateReport();
        
        alert(`API Test successful! Found ${response.movements.length} movements and ${response.inventory.length} inventory items.`);
      } else {
        alert('API Test successful but no data found in database.');
      }
    } catch (error) {
      console.error('API Test failed:', error);
      alert(`API Test failed: ${error}`);
    }
  }

  navigateToHome() {
    this.router.navigate(['/rapports']);
  }

  printA4(): void {
    const title = 'État MVT STOCK';
    const rows = this.filteredRows();
    
    let htmlContent = `
      <div class="header">
        <div class="title">${title}</div>
        <div class="subtitle">Date: ${new Date().toLocaleDateString('fr-FR')}</div>
      </div>
      
      <table>
        <thead>
          <tr>
            <th>Date PJ</th>
            <th>Article</th>
            <th style="text-align: right;">Entrée Qty</th>
            <th style="text-align: right;">Entrée PU</th>
            <th style="text-align: right;">Entrée Total</th>
            <th style="text-align: right;">Sortie Qty</th>
            <th style="text-align: right;">Sortie PU</th>
            <th style="text-align: right;">Sortie Total</th>
            <th style="text-align: right;">Stock Qty</th>
            <th style="text-align: right;">Stock PU</th>
            <th style="text-align: right;">Stock Total</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(row => `
            <tr>
              <td>${row.datePj}</td>
              <td>${row.article}</td>
              <td style="text-align: right;">${row.entreeQte?.toFixed(3) || '—'}</td>
              <td style="text-align: right;">${row.entreePu?.toFixed(3) || '—'}</td>
              <td style="text-align: right;">${row.entreeTotal?.toFixed(3) || '—'}</td>
              <td style="text-align: right;">${row.sortieQte?.toFixed(3) || '—'}</td>
              <td style="text-align: right;">${row.sortiePu?.toFixed(3) || '—'}</td>
              <td style="text-align: right;">${row.sortieTotal?.toFixed(3) || '—'}</td>
              <td style="text-align: right;">${row.stockQte.toFixed(3)}</td>
              <td style="text-align: right;">${row.stockPu.toFixed(3)}</td>
              <td style="text-align: right;">${row.stockTotal.toFixed(3)}</td>
              <td>${row.notes || ''}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
    
    this.printService.printA4Report(htmlContent, title);
  }
}
