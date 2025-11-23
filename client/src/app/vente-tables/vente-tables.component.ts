import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SalonService, Salon, Table } from '../core/services/salon.service';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Observable } from 'rxjs';
import { AuthService } from '../core/services/auth.service';
import { SettingsService, AppSettings } from '../core/services/settings.service';
import { takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';

interface ProductCategory {
  id: number;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
}

interface Product {
  id: number;
  name: string;
  description?: string;
  prix_vente_TTC: number;
  photo?: string;
  familleId: number;
  unite: string;
}

interface CartItem {
  product: Product;
  quantity: number;
  total: number;
  isPaid?: boolean;
}

interface TableStatus {
  tableId: number;
  isOccupied: boolean;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
}

@Component({
  selector: 'app-vente-tables',
  imports: [CommonModule, FormsModule],
  templateUrl: './vente-tables.component.html',
  styleUrl: './vente-tables.component.css'
})
export class VenteTablesComponent implements OnInit, OnDestroy {
  selectedTable = signal<Table | null>(null);
  selectedSalon = signal<Salon | null>(null);
  salons = signal<Salon[]>([]);
  tables = signal<Table[]>([]);
  productCategories = signal<ProductCategory[]>([]);
  products = signal<Product[]>([]);
  cart = signal<CartItem[]>([]);
  showProductCategories = signal(false);
  showProducts = signal(false);
  selectedCategory = signal<ProductCategory | null>(null);
  showPaymentDialog = signal(false);
  paymentAmount = signal(0);
  paymentType = signal<'byProduct' | 'byTotal'>('byTotal');
  amountReceived = signal(0);
  selectedItemsForPayment = signal<Set<number>>(new Set());
  tableStatuses = signal<Map<number, TableStatus>>(new Map());

  // Top bar properties
  currentUser = signal<any>(null);
  companyName = signal('PoS Pâtisserie');
  companyLogo = signal('');
  logoLoadError = signal(false);
  appSettings = signal<AppSettings | null>(null);
  private destroy$ = new Subject<void>();

  constructor(
    private router: Router,
    private salonService: SalonService,
    private http: HttpClient,
    private authService: AuthService,
    private settingsService: SettingsService
  ) {}

  ngOnInit(): void {
    this.currentUser.set(this.authService.currentUser());
    this.loadSettings();
    this.loadSalons();
    this.loadTables();
    this.loadProductCategories();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadSettings(): void {
    this.settingsService.getSettings().pipe(
      takeUntil(this.destroy$)
    ).subscribe(settings => {
      if (settings) {
        this.appSettings.set(settings);
        this.companyName.set(settings.companyName || 'PoS Pâtisserie');
        this.companyLogo.set(settings.logoUrl ? this.settingsService.getAbsoluteLogoUrl(settings.logoUrl) : '');
        this.logoLoadError.set(false);
      }
    });
  }

  onLogoError(): void {
    this.logoLoadError.set(true);
    this.companyLogo.set('');
  }

  goBackToHome(): void {
    this.router.navigate(['/home']);
  }

  goToTablesSalon(): void {
    this.router.navigate(['/tables-salon']);
  }

  private initializeTableStatuses(): void {
    // Load actual table statuses from database
    this.loadTableStatusesFromDatabase();
  }

  private loadTableStatusesFromDatabase(): void {
    // Load all active table sales to determine which tables are occupied
    this.http.get<any[]>(`${environment.apiUrl}/table-sales/active`).subscribe({
      next: (activeTableSales) => {
        const currentStatuses = new Map<number, TableStatus>();
        
        // Initialize all tables as free first
        this.tables().forEach(table => {
          currentStatuses.set(table.id, {
            tableId: table.id,
            isOccupied: false,
            totalAmount: 0,
            paidAmount: 0,
            remainingAmount: 0
          });
        });

        // Update statuses based on active table sales
        activeTableSales.forEach(tableSale => {
          const tableId = tableSale.tableId;
          if (currentStatuses.has(tableId)) {
            currentStatuses.set(tableId, {
              tableId: tableId,
              isOccupied: true,
              totalAmount: parseFloat(tableSale.totalAmount),
              paidAmount: parseFloat(tableSale.paidAmount),
              remainingAmount: parseFloat(tableSale.remainingAmount)
            });
          }
        });

        this.tableStatuses.set(currentStatuses);
      },
      error: (error) => {
        console.error('Error loading table statuses from database:', error);
        // Fallback to initialize all tables as free
        this.initializeAllTablesAsFree();
      }
    });
  }

  private initializeAllTablesAsFree(): void {
    const currentStatuses = new Map<number, TableStatus>();
    this.tables().forEach(table => {
      currentStatuses.set(table.id, {
        tableId: table.id,
        isOccupied: false,
        totalAmount: 0,
        paidAmount: 0,
        remainingAmount: 0
      });
    });
    this.tableStatuses.set(currentStatuses);
  }

  loadSalons(): void {
    this.salonService.getSalons().subscribe({
      next: (salons) => this.salons.set(salons),
      error: (error) => console.error('Error loading salons:', error)
    });
  }

  loadTables(): void {
    this.salonService.getTables().subscribe({
      next: (tables) => {
        this.tables.set(tables);
        // Load table statuses from database after tables are loaded
        this.loadTableStatusesFromDatabase();
      },
      error: (error) => console.error('Error loading tables:', error)
    });
  }

  loadProductCategories(): void {
    this.http.get<any[]>(`${environment.apiUrl}/families`).subscribe({
      next: (families) => {
        const formattedCategories: ProductCategory[] = families.map(family => ({
          id: family.id,
          name: family.name,
          description: family.description,
          color: this.getRandomPastelColor(),
          icon: this.getDefaultIcon(family.name)
        }));
        this.productCategories.set(formattedCategories);
      },
      error: (error) => {
        console.error('Error loading product families:', error);
        this.productCategories.set([]);
      }
    });
  }


  private getRandomPastelColor(): string {
    const colors = ['#FDE68A', '#FCA5A5', '#A7F3D0', '#C4B5FD', '#FDBA74', '#93C5FD', '#FBCFE8', '#C7D2FE'];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  private getDefaultIcon(categoryName: string): string {
    const iconMap: { [key: string]: string } = {
      // Boissons
      'boisson': '🥤', 'boissons': '🥤', 'café': '☕', 'cafe': '☕', 'coffee': '☕',
      'thé': '🍵', 'the': '🍵', 'tea': '🍵', 'jus': '🧃', 'juice': '🧃',
      'eau': '💧', 'water': '💧', 'soda': '🥤', 'limonade': '🍋',
      
      // Pâtisseries & Desserts
      'pâtisserie': '🧁', 'patisserie': '🧁', 'pâtisseries': '🧁', 'patisseries': '🧁',
      'gâteau': '🎂', 'gateau': '🎂', 'gâteaux': '🎂', 'gateaux': '🎂', 'cake': '🎂',
      'tarte': '🥧', 'tartes': '🥧', 'pie': '🥧', 'dessert': '🍰', 'desserts': '🍰',
      'viennoiserie': '🥐', 'viennoiseries': '🥐', 'croissant': '🥐', 'croissants': '🥐',
      'pain': '🍞', 'bread': '🍞', 'brioche': '🍞',
      
      // Sandwichs & Plats
      'sandwich': '🥪', 'sandwichs': '🥪', 'panini': '🥪', 'wrap': '🌯', 'wraps': '🌯',
      'salade': '🥗', 'salades': '🥗', 'salad': '🥗', 'plats': '🍲', 'plat': '🍲',
      'soupe': '🍲', 'soupes': '🍲', 'soup': '🍲', 'quiche': '🥧', 'quiches': '🥧',
      
      // Snacks & Autres
      'snack': '🍿', 'snacks': '🍿', 'chips': '🍟', 'biscuit': '🍪', 'biscuits': '🍪',
      'cookies': '🍪', 'chocolat': '🍫', 'chocolate': '🍫', 'bonbon': '🍬', 'bonbons': '🍬',
      'candy': '🍬', 'glace': '🍦', 'glaces': '🍦', 'ice cream': '🍦',
      'fruit': '🍎', 'fruits': '🍎', 'légume': '🥕', 'legume': '🥕', 'légumes': '🥕', 'legumes': '🥕',
      'vegetable': '🥕', 'vegetables': '🥕',
      
      // Produits laitiers
      'lait': '🥛', 'milk': '🥛', 'yaourt': '🥛', 'yaourts': '🥛', 'yogurt': '🥛',
      'fromage': '🧀', 'cheese': '🧀', 'beurre': '🧈', 'butter': '🧈',
      
      // Viandes
      'viande': '🥩', 'meat': '🥩', 'poulet': '🍗', 'chicken': '🍗', 'poisson': '🐟', 'fish': '🐟',
      
      // Général
      'épicerie': '🛒', 'epicerie': '🛒', 'grocery': '🛒', 'produit': '📦', 'produits': '📦',
      'product': '📦', 'products': '📦', 'famille': '👨‍👩‍👧‍👦', 'family': '👨‍👩‍👧‍👦'
    };
    
    const lowerName = categoryName.toLowerCase();
    for (const [key, icon] of Object.entries(iconMap)) {
      if (lowerName.includes(key)) {
        return icon;
      }
    }
    return '📦';
  }


  startSale(): void {
    if (this.selectedSalon() && this.selectedTable()) {
      this.showProductCategories.set(true);
    }
  }

  goBackToTableSelection(): void {
    this.showProductCategories.set(false);
  }

  selectProductCategory(category: ProductCategory): void {
    this.selectedCategory.set(category);
    this.loadProductsByCategory(category.id);
    this.showProductCategories.set(false);
    this.showProducts.set(true);
  }

  loadProductsByCategory(categoryId: number): void {
    this.http.get<any>(`${environment.apiUrl}/families/${categoryId}`).subscribe({
      next: (family) => {
        if (family && family.products) {
          const formattedProducts: Product[] = family.products.map((product: any) => ({
            id: product.id,
            name: product.name,
            description: product.description,
            prix_vente_TTC: parseFloat(product.prix_vente_TTC),
            photo: product.photo,
            familleId: product.familleId || categoryId,
            unite: product.unite || 'pcs'
          }));
          this.products.set(formattedProducts);
        } else {
          this.products.set([]);
        }
      },
      error: (error) => {
        console.error('Error loading products for family:', error);
        // Try alternative API endpoint
        this.loadProductsAlternative(categoryId);
      }
    });
  }

  private loadProductsAlternative(categoryId: number): void {
    this.http.get<any[]>(`${environment.apiUrl}/products`).subscribe({
      next: (allProducts) => {
        const familyProducts = allProducts.filter(product => 
          product.familleId === categoryId || product.famille?.id === categoryId
        );
        
        const formattedProducts: Product[] = familyProducts.map(product => ({
          id: product.id,
          name: product.name,
          description: product.description,
          prix_vente_TTC: parseFloat(product.prix_vente_TTC),
          photo: product.photo,
          familleId: product.familleId || product.famille?.id || categoryId,
          unite: product.unite || 'pcs'
        }));
        
        this.products.set(formattedProducts);
      },
      error: (error) => {
        console.error('Error loading all products:', error);
        this.products.set([]);
      }
    });
  }


  decreaseProductQuantity(product: Product): void {
    // Decrease product quantity by 1 and save to database
    const currentCart = this.cart();
    const existingItem = currentCart.find(item => item.product.id === product.id);
    
    if (existingItem) {
      existingItem.quantity -= 1;
      existingItem.total = existingItem.quantity * product.prix_vente_TTC;
      
      // Remove item if quantity becomes 0 or negative
      if (existingItem.quantity <= 0) {
        const index = currentCart.indexOf(existingItem);
        currentCart.splice(index, 1);
      }
    } else {
      // If product doesn't exist in cart, add it with quantity -1 (which will be removed)
      currentCart.push({
        product,
        quantity: -1,
        total: -product.prix_vente_TTC,
        isPaid: false
      });
      // Remove it immediately since quantity is negative
      currentCart.pop();
    }
    
    this.cart.set([...currentCart]);
    this.updateAllTableStatuses();
    
    // Save cart data to database
    this.saveCartToDatabase();
  }

  addProductToCart(product: Product): void {
    const currentCart = this.cart();
    const existingItem = currentCart.find(item => item.product.id === product.id);
    
    if (existingItem) {
      existingItem.quantity += 1;
      existingItem.total = existingItem.quantity * product.prix_vente_TTC;
    } else {
      currentCart.push({
        product,
        quantity: 1,
        total: product.prix_vente_TTC,
        isPaid: false
      });
    }
    
    this.cart.set([...currentCart]);
    this.updateAllTableStatuses(); // Update table status when cart changes
    
    // Save cart data to database
    this.saveCartToDatabase();
  }

  removeProductUnit(product: Product): void {
    const currentCart = this.cart();
    const existingItem = currentCart.find(item => item.product.id === product.id);
    
    if (existingItem) {
      if (existingItem.quantity > 1) {
        existingItem.quantity -= 1;
        existingItem.total = existingItem.quantity * product.prix_vente_TTC;
      } else {
        const index = currentCart.indexOf(existingItem);
        currentCart.splice(index, 1);
      }
      this.cart.set([...currentCart]);
      this.updateAllTableStatuses(); // Update table status when cart changes
      
      // Save cart data to database
      this.saveCartToDatabase();
    }
  }

  removeLastProduct(): void {
    const currentCart = this.cart();
    if (currentCart.length > 0) {
      const lastItem = currentCart[currentCart.length - 1];
      if (lastItem.quantity > 1) {
        lastItem.quantity -= 1;
        lastItem.total = lastItem.quantity * lastItem.product.prix_vente_TTC;
      } else {
        currentCart.pop();
      }
      this.cart.set([...currentCart]);
      this.updateAllTableStatuses(); // Update table status when cart changes
      
      // Save cart data to database
      this.saveCartToDatabase();
    }
  }

  getCartTotal(): number {
    return this.cart().reduce((total, item) => total + item.total, 0);
  }

  getUnpaidTotal(): number {
    return this.cart().reduce((total, item) => total + (item.isPaid ? 0 : item.total), 0);
  }

  getPaidTotal(): number {
    return this.cart().reduce((total, item) => total + (item.isPaid ? item.total : 0), 0);
  }

  goBackToCategories(): void {
    this.showProducts.set(false);
    this.showProductCategories.set(true);
    this.selectedCategory.set(null);
  }

  validateOrder(): void {
    const currentCart = this.cart();
    const selectedTable = this.selectedTable();
    const selectedSalon = this.selectedSalon();
    
    if (!selectedTable || !selectedSalon || currentCart.length === 0) {
      console.warn('Cannot validate order: missing table, salon, or empty cart');
      return;
    }
    
    // Create order data for saving
    const orderData = {
      tableId: selectedTable.id,
      salonId: selectedSalon.id,
      tableName: selectedTable.name,
      salonName: selectedSalon.name,
      items: currentCart.map(item => ({
        productId: item.product.id,
        productName: item.product.name,
        quantity: item.quantity,
        unitPrice: item.product.prix_vente_TTC,
        totalPrice: item.total,
        isPaid: true // Mark as paid when validating
      })),
      totalAmount: this.getCartTotal(),
      paidAmount: this.getCartTotal(),
      remainingAmount: 0,
      status: 'VALIDATED',
      validatedAt: new Date().toISOString()
    };
    
    // Save order to database (you can implement this API call)
    this.saveOrderToDatabase(orderData).subscribe({
      next: (savedOrder) => {

        
        // Mark all items as paid when validating
        currentCart.forEach(item => {
          item.isPaid = true;
        });
        this.cart.set([...currentCart]);
        
        // Update table status - this will make the table green (free)
        this.updateAllTableStatuses();
        
        // Clear the cart after successful validation
        this.cart.set([]);
        
        // Close the sale interface
        this.showProducts.set(false);
        this.showProductCategories.set(false);
        
        // Show success message (optional)
        this.showSuccessMessage('Commande validée avec succès !');
      },
      error: (error) => {
        console.error('Error saving order:', error);
        this.showErrorMessage('Erreur lors de la validation de la commande');
      }
    });
  }

  private saveCartToDatabase(): void {
    const selectedTable = this.selectedTable();
    const selectedSalon = this.selectedSalon();
    const currentCart = this.cart();
    
    if (!selectedTable || !selectedSalon || currentCart.length === 0) {
      return;
    }
    
    const cartData = {
      tableId: selectedTable.id,
      salonId: selectedSalon.id,
      items: currentCart.map(item => ({
        productId: item.product.id,
        productName: item.product.name,
        quantity: item.quantity,
        unitPrice: item.product.prix_vente_TTC,
        total: item.total,
        isPaid: item.isPaid || false
      })),
      totalAmount: this.getCartTotal(),
      paidAmount: this.getPaidTotal(),
      remainingAmount: this.getUnpaidTotal()
    };
    

    this.http.post(`${environment.apiUrl}/table-sales`, cartData).subscribe({
      next: (savedSale) => {

        // Immediately refresh UI state from DB to keep interface in sync
        this.loadExistingTableCart(selectedTable.id);
        this.loadTableStatusesFromDatabase();
      },
      error: (error) => {
        console.error('Error saving cart to database:', error);
      }
    });
  }

  private saveOrderToDatabase(orderData: any) {
    // TODO: Replace with your actual API endpoint
    // For now, we'll simulate a successful save
    return new Observable(observer => {
      setTimeout(() => {
        observer.next({ id: Date.now(), ...orderData });
        observer.complete();
      }, 500);
    });
  }

  private showSuccessMessage(message: string): void {
    // You can implement a toast notification here

    // For now, we'll use alert
    alert(message);
  }

  private showErrorMessage(message: string): void {
    // You can implement a toast notification here
    console.error('ERROR:', message);
    // For now, we'll use alert
    alert(message);
  }

  openPaymentDialog(): void {
    this.paymentAmount.set(this.getUnpaidTotal());
    this.amountReceived.set(0);
    this.selectedItemsForPayment.set(new Set());
    this.paymentType.set('byTotal');
    this.showPaymentDialog.set(true);
  }

  closePaymentDialog(): void {
    this.showPaymentDialog.set(false);
    this.paymentAmount.set(0);
    this.amountReceived.set(0);
    this.selectedItemsForPayment.set(new Set());
  }

  setPaymentType(type: 'byProduct' | 'byTotal'): void {
    this.paymentType.set(type);
    if (type === 'byTotal') {
      this.selectedItemsForPayment.set(new Set());
    }
  }

  getUnpaidItems(): CartItem[] {
    return this.cart().filter(item => !item.isPaid);
  }

  isItemSelectedForPayment(productId: number): boolean {
    return this.selectedItemsForPayment().has(productId);
  }

  toggleItemForPayment(productId: number): void {
    const current = this.selectedItemsForPayment();
    const newSet = new Set(current);
    if (newSet.has(productId)) {
      newSet.delete(productId);
    } else {
      newSet.add(productId);
    }
    this.selectedItemsForPayment.set(newSet);
  }

  getChangeAmount(): number {
    const received = this.amountReceived();
    const total = this.getUnpaidTotal();
    return Math.max(0, received - total);
  }

  canProcessPayment(): boolean {
    if (this.paymentType() === 'byProduct') {
      return this.selectedItemsForPayment().size > 0;
    } else {
      return this.amountReceived() >= this.getUnpaidTotal();
    }
  }

  processPayment(): void {
    const currentCart = this.cart();
    
    if (this.paymentType() === 'byProduct') {
      // Payment by product - mark selected items as paid
      const selectedIds = this.selectedItemsForPayment();
      currentCart.forEach(item => {
        if (selectedIds.has(item.product.id)) {
          item.isPaid = true;
        }
      });
    } else {
      // Payment by total - mark all unpaid items as paid
      currentCart.forEach(item => {
        if (!item.isPaid) {
          item.isPaid = true;
        }
      });
    }
    
    this.cart.set([...currentCart]);
    
    // Update table status
    this.updateAllTableStatuses();
    
    // Save payment update to database
    this.saveCartToDatabase();
    // After saving, also re-fetch the active sale for this table to sync paid/unpaid
    const table = this.selectedTable();
    if (table) {
      this.loadExistingTableCart(table.id);
      this.loadTableStatusesFromDatabase();
    }
    
    // Check if table can be liberated
    this.checkTableLiberation();
    
    // Close payment dialog
    this.closePaymentDialog();
  }

  checkTableLiberation(): void {
    const unpaidTotal = this.getUnpaidTotal();
    const selectedTable = this.selectedTable();
    
    if (unpaidTotal === 0 && selectedTable) {
      // All items are paid, ask if user wants to liberate the table
      const shouldLiberate = confirm(
        `Tous les articles de la Table ${selectedTable.number} sont payés.\n\n` +
        `Voulez-vous libérer la table ?\n\n` +
        `- OUI: La table sera marquée comme libre\n` +
        `- NON: La table garde son historique de commande`
      );
      
      if (shouldLiberate) {
        this.liberateTable();
      }
    }
  }

  liberateTable(): void {
    const selectedTable = this.selectedTable();
    if (selectedTable) {
      // Clear the cart
      this.cart.set([]);
      
      // Mark the table sale as completed in the database
      this.completeTableSale(selectedTable.id);
      
      // Update table status to free
      this.updateAllTableStatuses();
      
      // Close the sale interface
      this.showProducts.set(false);
      this.showProductCategories.set(false);
      
      // Show success message
      this.showSuccessMessage(`Table ${selectedTable.number} libérée avec succès !`);
    }
  }

  private completeTableSale(tableId: number): void {
    // Get the active table sale for this table
    this.http.get<any[]>(`${environment.apiUrl}/table-sales/table/${tableId}`).subscribe({
      next: (tableSales) => {
        if (tableSales && tableSales.length > 0) {
          const activeSale = tableSales[0];
          // Mark the sale as completed
          this.http.patch(`${environment.apiUrl}/table-sales/${activeSale.id}/complete`, {}).subscribe({
            next: () => {

            },
            error: (error) => {
              console.error('Error completing table sale:', error);
            }
          });
        }
      },
      error: (error) => {
        console.error('Error fetching table sales for completion:', error);
      }
    });
  }

  private updateTableStatus(): void {
    const tableId = this.selectedTable()?.id;
    if (tableId) {
      const currentStatuses = this.tableStatuses();
      const unpaidTotal = this.getUnpaidTotal();
      const paidTotal = this.getPaidTotal();
      
      currentStatuses.set(tableId, {
        tableId,
        isOccupied: unpaidTotal > 0,
        totalAmount: this.getCartTotal(),
        paidAmount: paidTotal,
        remainingAmount: unpaidTotal
      });
      
      this.tableStatuses.set(new Map(currentStatuses));
    }
  }

  // Update table status when cart changes
  updateAllTableStatuses(): void {
    const currentStatuses = this.tableStatuses();
    const currentCart = this.cart();
    const selectedTable = this.selectedTable();
    
    // If we have a selected table and cart items, update its status
    if (selectedTable && currentCart.length > 0) {
      const unpaidTotal = currentCart.reduce((total, item) => total + (item.isPaid ? 0 : item.total), 0);
      const paidTotal = currentCart.reduce((total, item) => total + (item.isPaid ? item.total : 0), 0);
      const totalAmount = currentCart.reduce((total, item) => total + item.total, 0);
      
      currentStatuses.set(selectedTable.id, {
        tableId: selectedTable.id,
        isOccupied: unpaidTotal > 0,
        totalAmount,
        paidAmount: paidTotal,
        remainingAmount: unpaidTotal
      });
    } else if (selectedTable && currentCart.length === 0) {
      // If cart is empty, mark table as free
      currentStatuses.set(selectedTable.id, {
        tableId: selectedTable.id,
        isOccupied: false,
        totalAmount: 0,
        paidAmount: 0,
        remainingAmount: 0
      });
    }
    
    // Force update the signal to trigger UI changes
    this.tableStatuses.set(new Map(currentStatuses));
    
    // Log for debugging

  }

  getTableStatus(tableId: number): TableStatus | null {
    return this.tableStatuses().get(tableId) || null;
  }

  hasTableItems(tableId: number): boolean {
    const tableStatus = this.getTableStatus(tableId);
    const selectedTable = this.selectedTable();
    
    // If this is the currently selected table and has items in cart
    if (selectedTable?.id === tableId && this.cart().length > 0) {
      return true;
    }
    
    // If table has items in cart (total amount > 0)
    if (tableStatus && tableStatus.totalAmount > 0) {
      return true;
    }
    
    return false;
  }

  getTableBackgroundColor(table: Table): string {
    const tableStatus = this.getTableStatus(table.id);
    const selectedTable = this.selectedTable();
    
    // If this is the currently selected table and has items in cart, show red
    if (selectedTable?.id === table.id && this.cart().length > 0) {
      return '#ef4444'; // Red color
    }
    
    // If table has items in cart (total amount > 0), show red
    if (tableStatus && tableStatus.totalAmount > 0) {
      return '#ef4444'; // Red color
    }
    
    // If table is fully paid (remaining amount = 0 and total > 0), show green
    if (tableStatus && tableStatus.totalAmount > 0 && tableStatus.remainingAmount === 0) {
      return '#10b981'; // Green color
    }
    
    // Default: show original table color
    return table.color;
  }

  ceil(value: number): number {
    return Math.ceil(value);
  }

  selectTable(table: Table): void {
    // Clear current cart when switching tables
    this.cart.set([]);
    
    this.selectedTable.set(table);
    
    // Check if table has existing items
    const tableStatus = this.getTableStatus(table.id);
    if (tableStatus && tableStatus.totalAmount > 0) {
      // Table has existing items, load them and open cart directly
      this.loadExistingTableCart(table.id);
    } else {
      // Table is empty, start normal sale process
      this.startSale();
    }
  }

  loadExistingTableCart(tableId: number): void {
    // Load existing cart items from database
    this.http.get<any[]>(`${environment.apiUrl}/table-sales/table/${tableId}`).subscribe({
      next: (tableSales) => {
        if (tableSales && tableSales.length > 0) {
          const activeSale = tableSales[0]; // Get the first active sale
          if (activeSale && activeSale.items) {
            // Convert database items to cart format
            const cartItems: CartItem[] = activeSale.items.map((item: any) => ({
              product: {
                id: item.productId,
                name: item.productName,
                prix_vente_TTC: parseFloat(item.unitPrice),
                unite: item.product?.unite || 'pcs',
                familleId: item.product?.familleId || 1,
                photo: item.product?.photo,
                description: item.product?.description
              },
              quantity: parseFloat(item.quantity),
              total: parseFloat(item.total),
              isPaid: item.isPaid || false
            }));
            
            // Set the cart with existing items
            this.cart.set(cartItems);
            
            // Update table statuses
            this.updateAllTableStatuses();
            
            // Open products interface directly (skip category selection)
            this.showProductCategories.set(false);
            this.showProducts.set(true);
            
            // Load a default category to show products
            if (this.productCategories().length > 0) {
              this.selectedCategory.set(this.productCategories()[0]);
              this.loadProductsByCategory(this.productCategories()[0].id);
            }
          }
        } else {
          // No existing items, start normal sale
          this.startSale();
        }
      },
      error: (error) => {
        console.error('Error loading existing table cart:', error);
        // Fallback to normal sale process
        this.startSale();
      }
    });
  }

  selectSalon(salon: Salon): void {
    this.selectedSalon.set(salon);
    // Reset selected table when changing salon
    this.selectedTable.set(null);
  }

  getTablesBySalon(salonId: number): Table[] {
    return this.tables()
      .filter(table => table.salonId === salonId)
      .sort((a, b) => {
        const matchA = a.number.match(/\d+$/);
        const matchB = b.number.match(/\d+$/);
        const numA = parseInt(matchA ? matchA[0] : '0');
        const numB = parseInt(matchB ? matchB[0] : '0');
        return numA - numB;
      });
  }

  getTablesCountBySalon(salonId: number): number {
    return this.getTablesBySalon(salonId).length;
  }

  getDominantColorForSalon(salonId: number): string {
    const tables = this.getTablesBySalon(salonId);
    if (tables.length === 0) return '#F3E8FF'; // Default light purple

    // Count color occurrences
    const colorCount: { [key: string]: number } = {};
    tables.forEach(table => {
      colorCount[table.color] = (colorCount[table.color] || 0) + 1;
    });

    // Find the most frequent color
    let dominantColor = '#F3E8FF';
    let maxCount = 0;
    for (const [color, count] of Object.entries(colorCount)) {
      if (count > maxCount) {
        maxCount = count;
        dominantColor = color;
      }
    }

    // Convert to pastel vibrant version
    return this.convertToPastelVibrant(dominantColor);
  }

  private convertToPastelVibrant(hexColor: string): string {
    // Remove # if present
    const hex = hexColor.replace('#', '');
    
    // Convert to RGB
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    
    // Convert to HSL for easier manipulation
    const hsl = this.rgbToHsl(r, g, b);
    
    // Make it more vibrant and pastel
    const vibrantHsl = {
      h: hsl.h,
      s: Math.min(85, hsl.s + 20), // Increase saturation but keep it pastel
      l: Math.min(85, hsl.l + 15)  // Increase lightness for pastel effect
    };
    
    // Convert back to RGB and then to hex
    const rgb = this.hslToRgb(vibrantHsl.h, vibrantHsl.s, vibrantHsl.l);
    return this.rgbToHex(rgb.r, rgb.g, rgb.b);
  }

  private rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
    r /= 255;
    g /= 255;
    b /= 255;
    
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;
    
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }
    
    return { h: h * 360, s: s * 100, l: l * 100 };
  }

  private hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
    h /= 360;
    s /= 100;
    l /= 100;
    
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    
    let r, g, b;
    
    if (s === 0) {
      r = g = b = l; // achromatic
    } else {
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1/3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1/3);
    }
    
    return {
      r: Math.round(r * 255),
      g: Math.round(g * 255),
      b: Math.round(b * 255)
    };
  }

  private rgbToHex(r: number, g: number, b: number): string {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }
}
