import { Component, Input, OnInit, computed, signal } from '@angular/core';
import { ProductsService } from '../../core/services/products.service';
import { StockDocumentsService } from '../../core/services/stock-documents.service';

interface StockItem {
  productId: number;
  productName: string;
  famille: string;
  barcode?: string;
  importedQuantity: number;
  soldQuantity: number;
  currentStock: number;
  unitPrice: number;
  totalValue: number;
  movements: any[];
}

@Component({
  selector: 'app-stock-check',
  templateUrl: './stock-check.component.html',
  standalone: false
})
export class StockCheckComponent implements OnInit {
  @Input() depotId!: number;
  
  loading = false;
  error = '';
  
  products = signal<any[]>([]);
  stockItems = signal<StockItem[]>([]);
  private searchQuery = signal<string>('');
  
  filteredStockItems = computed(() => {
    const all = this.stockItems();
    const q = (this.searchQuery() || '').toLowerCase();
    const selected = this.selectedCategory();
    
    let result = all;
    
    // Filter by category
    if (selected && selected !== 'Tous') {
      result = result.filter((item) => 
        (item.famille || '').toLowerCase() === selected.toLowerCase()
      );
    }
    
    // Filter by search query
    if (q) {
      result = result.filter((item) => 
        (item.productName || '').toLowerCase().includes(q) || 
        (item.barcode || '').toLowerCase().includes(q) ||
        (item.famille || '').toLowerCase().includes(q)
      );
    }
    
    return result;
  });

  // UI state
  productCategories: string[] = ['Tous'];
  selectedCategory = signal<string>('Tous');
  viewMode: 'table' | 'grid' = 'table';
  
  // Details dialog state
  showDetailsDialog = false;
  selectedItem: StockItem | null = null;

  constructor(
    private productsService: ProductsService,
    private stockDocs: StockDocumentsService
  ) {}

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading = true;
    this.error = '';

    // Load products and stock movements data
    Promise.all([
      this.productsService.getProducts().toPromise(),
      this.stockDocs.getStockMovements(this.depotId).toPromise()
    ]).then(([products, movements]) => {
      if (products) {
        this.products.set(products);
        this.updateProductCategories();
      }
      
      if (movements) {
        this.processStockData(products || [], movements);
      }
      
      this.loading = false;
    }).catch((error) => {
      this.error = 'Erreur lors du chargement des données de stock';
      this.loading = false;
      console.error('Error loading stock data:', error);
    });
  }

  processStockData(products: any[], movements: any[]): void {
    const stockItems: StockItem[] = [];
    
    // Process each product
    products.forEach(product => {
      // Find stock movements for this product in this depot
      const productMovements = movements.filter(movement => 
        movement.productId === product.id && movement.depotId === this.depotId
      );
      
      // Calculate imported quantity (IN movements from entries)
      const importedQuantity = productMovements
        .filter(movement => movement.type === 'IN' && 
          (movement.reason === 'ENTRY_SUPPLIER' || movement.reason === 'ADM'))
        .reduce((sum, movement) => sum + parseFloat(movement.quantity || 0), 0);
      
      // Calculate sold quantity (OUT movements from sales)
      const soldQuantity = productMovements
        .filter(movement => movement.type === 'OUT' && 
          (movement.reason === 'SALE' || movement.reason === 'INVOICE' || movement.reason === 'TRANSFER'))
        .reduce((sum, movement) => sum + parseFloat(movement.quantity || 0), 0);
      
      // Current stock = imported - sold
      const currentStock = importedQuantity - soldQuantity;
      
      // Only show products that have some stock activity
      if (importedQuantity > 0 || soldQuantity > 0) {
        stockItems.push({
          productId: product.id,
          productName: product.name,
          famille: product.famille?.name || 'Divers',
          barcode: product.barcode,
          importedQuantity,
          soldQuantity,
          currentStock,
          unitPrice: product.prix_achat || 0,
          totalValue: currentStock * (product.prix_achat || 0),
          movements: productMovements
        });
      }
    });
    
    // Sort by current stock (descending)
    stockItems.sort((a, b) => b.currentStock - a.currentStock);
    
    this.stockItems.set(stockItems);
  }

  updateProductCategories(): void {
    const categories = new Set<string>(['Tous']);
    this.products().forEach(product => {
      if (product.famille?.name) {
        categories.add(product.famille.name);
      }
    });
    this.productCategories = Array.from(categories);
  }

  searchProducts(query: string): void {
    this.searchQuery.set(query);
  }

  selectCategory(category: string): void {
    this.selectedCategory.set(category);
  }

  toggleViewMode(): void {
    this.viewMode = this.viewMode === 'table' ? 'grid' : 'table';
  }

  getTotalStockValue(): number {
    return this.stockItems().reduce((total, item) => total + item.totalValue, 0);
  }

  getTotalImportedQuantity(): number {
    return this.stockItems().reduce((total, item) => total + item.importedQuantity, 0);
  }

  getTotalSoldQuantity(): number {
    return this.stockItems().reduce((total, item) => total + item.soldQuantity, 0);
  }

  getTotalCurrentStock(): number {
    return this.stockItems().reduce((total, item) => total + item.currentStock, 0);
  }

  getTotalProducts(): number {
    return this.stockItems().length;
  }

  getLowStockItems(): number {
    return this.stockItems().filter(item => item.currentStock <= 5).length;
  }

  getOutOfStockItems(): number {
    return this.stockItems().filter(item => item.currentStock <= 0).length;
  }

  getStockStatusClass(stock: number): string {
    if (stock <= 0) return 'text-red-600 bg-red-50';
    if (stock <= 5) return 'text-yellow-600 bg-yellow-50';
    return 'text-green-600 bg-green-50';
  }

  getStockStatusText(stock: number): string {
    if (stock <= 0) return 'Rupture';
    if (stock <= 5) return 'Stock faible';
    return 'En stock';
  }

  showDetails(item: StockItem): void {
    this.selectedItem = item;
    this.showDetailsDialog = true;
  }

  closeDetailsDialog(): void {
    this.showDetailsDialog = false;
    this.selectedItem = null;
  }

  getEntryMovements(item: StockItem): any[] {
    return item.movements.filter(movement => 
      movement.type === 'IN' && 
      (movement.reason === 'ENTRY_SUPPLIER' || movement.reason === 'ADM')
    ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  getSaleMovements(item: StockItem): any[] {
    return item.movements.filter(movement => 
      movement.type === 'OUT' && 
      (movement.reason === 'SALE' || movement.reason === 'INVOICE' || movement.reason === 'TRANSFER')
    ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }
}
