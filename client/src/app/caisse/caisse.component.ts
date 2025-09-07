import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ProductsService } from '../core/services/products.service';
import { SalesService, CreateSaleRequest } from '../core/services/sales.service';
import { ClientsService } from '../core/services/clients.service';
import { StockDocumentsService } from '../core/services/stock-documents.service';
import { ReportsService, ProductSalesData } from '../core/services/reports.service';
import { SettingsService } from '../core/services/settings.service';
import { SessionsService } from '../core/services/sessions.service';
import { DailyExtractService } from '../core/services/daily-extract.service';
import { PrintService } from '../core/services/print.service';
import { Product } from '../core/models/product.model';
import { Sale } from '../core/models/sale.model';
import { Client } from '../core/models/client.model';

interface ReceiptItem {
  product: Product;
  quantity: number;
  unitPrice: number;
  total: number;
  isGift: boolean;
  hasCustomTotal?: boolean;
}

interface ClientCart {
  id: number;
  clientName: string;
  clientId?: number;
  client?: Client;
  items: ReceiptItem[];
  subtotal: number;
  discount: number;
  netTotal: number;
  isActive: boolean;
  createdAt: Date;
}

@Component({
  selector: 'app-caisse',
  templateUrl: './caisse.component.html',
  standalone: false
})
export class CaisseComponent implements OnInit {
  // Top bar data
  currentCustomer: string = 'PASSAGER';
  currentCashier: string = 'CAISSIER +';
  total: number = 0;

  // Ticket number management
  currentTicketNumber: number = 1;
  lastTicketDate: string = '';
  isShiftOpen: boolean = true;

  // Math reference for template
  Math = Math;

  // Multi-client system
  clientCarts: ClientCart[] = [];
  activeCartId: number = 1;
  maxClients: number = 10; // Increased max for dynamic addition
  
  // Receipt data (now refers to active cart)
  get receiptItems(): ReceiptItem[] {
    return this.getActiveCart()?.items || [];
  }
  
  get subtotal(): number {
    return this.getActiveCart()?.subtotal || 0;
  }
  
  get discount(): number {
    return this.getActiveCart()?.discount || 0;
  }
  
  get netTotal(): number {
    return this.getActiveCart()?.netTotal || 0;
  }
  
  change: number = 0;

  // Product catalog
  allProducts: Product[] = [];
  filteredProducts: Product[] = [];
  productCategories: string[] = ['Tous', 'Pâtisserie', 'Viennoiserie', 'Boulangerie', 'Boissons', 'Vrac', 'Pâtisserie Tunisienne', 'Jus et Smoothies'];
  selectedCategory: string = 'Tous';
  searchQuery: string = '';

  // Sales data for ordering
  productSalesData: ProductSalesData[] = [];

  // Pagination
  currentPage: number = 0;
  productsPerPage: number = 20; // Adjust based on screen size
  totalPages: number = 0;

  // Shop inventory
  shopInventory: any[] = [];
  currentShopDepotId: number = 1; // Shop depot ID (SHOP-CV)

  // Input handling
  currentInput: string = '';
  isTemporarySale: boolean = false;
  
  // Quantity/Price toggle mode
  inputMode: 'quantity' | 'price' = 'quantity';
  pendingProduct: Product | null = null;
  lastEnteredValue: string = '';


  // Remise popup
  showDiscountPopup: boolean = false;
  showDiscountTypeSelection = false;
  discountPercent: number | undefined;
  discountAmount: number | undefined;
  discountTarget: string = 'Tous';
  discountType: 'percentage' | 'amount' | undefined;

  // Payment popup
  showPaymentPopup = false;
  showPaymentConfirmation = false;
  invoiceMode = false;

  // Remise payment popup
  showRemisePaymentPopup = false;
  remisePaymentAmount: number | undefined;

  // Temporary sales history popup
  showTemporarySalesHistory = false;
  allTemporarySales: any[] = [];

  // Temporary sale customer selection
  temporarySaleCustomerType: 'passager' | 'existing' | 'new' = 'passager';
  temporarySaleCustomerSearch = '';
  temporarySaleCustomerResults: any[] = [];
  temporarySaleSelectedCustomer: any = null;
  temporarySaleNewCustomer = {
    firstName: '',
    lastName: '',
    phone: '',
    email: ''
  };

  // Settings
  maxDiscountPercent: number = 50; // Default value

  // Session management
  currentSession: any = null;
  showClosurePopup = false;
  closureForm = {
    countedCash: 0,
    retraitCentrale: 0,
    note: ''
  };

  paymentType: 'cash' | 'card' | 'check' | 'virement' | undefined;
  amountPaid: number | undefined;
  calculatedChange = 0;

  // Cheque details
  chequeId: string = '';
  encaissementDate: string = '';

  // Virement details
  virementNumber: string = '';

  // Temporary sale
  temporarySaleExpectedDate: string = '';
  temporarySaleExpectedTime: string = '';
  temporarySaleNotes: string = '';
  showTemporarySalePopup = false;
  showTemporarySaleSelectionPopup = false;
  showExistingTemporarySalesPopup = false;
  existingTemporarySales: Sale[] = [];
  selectedTemporarySale: Sale | null = null;
  showTemporarySalePaymentPopup = false;
  pendingTemporarySalesCount: number = 0;

  // Advance payment for temporary sales
  showAdvancePaymentPopup = false;
  advancePaymentAmount: number | undefined;
  advancePaymentMethod: 'cash' | 'card' | 'check' | 'virement' | undefined;
  advancePaymentNotes: string = '';
  advancePaymentChequeId: string = '';
  advancePaymentEncaissementDate: string = '';
  advancePaymentVirementNumber: string = '';

  // Gift functionality
  showGiftPopup = false;
  giftReason: string = '';
  giftRecipient: string = '';
  pendingGiftSalesCount: number = 0;
  showExistingGiftSalesPopup = false;
  existingGiftSales: Sale[] = [];
  selectedGiftSale: Sale | null = null;

  // Product quantity/amount modal
  showProductModal = false;
  selectedProduct: Product | null = null;
  productModalMode: 'quantity' | 'amount' = 'quantity';
  productModalQuantity: number = 1;
  productModalAmount: number = 0;
  productModalCalculatedQuantity: number = 0;
  productModalCalculatedAmount: number = 0;

  // Stock warning modal
  showStockWarningModal = false;
  stockWarningProduct: Product | null = null;
  stockWarningQuantity: number = 0;
  stockWarningCurrentStock: number = 0;

  // Last validated sale for printing
  lastValidatedSale: any = null;

  // Selected receipt item for modification
  selectedReceiptItem: ReceiptItem | null = null;
  selectedReceiptItemIndex: number = -1;

  // Quick note options for pastry
  quickNoteOptions = [
    'Commandé',
    'En préparation',
    'Anniversaire',
    'Mariage',
    'Événement',
    'Client régulier',
  ];

  // Quick gift reason options
  quickGiftReasons = [
    'Anniversaire',
    'Mariage',
    'Événement spécial',
    'Client fidèle',
    'Promotion',
    'Test produit',
    'Dégustation',
    'Autre'
  ];

  // Quick amount buttons for cash payments
  paymentQuickAmounts = [0, 0.5, 1, 5, 10];

  // Alert system
  showAlert = false;
  alertMessage = '';
  alertType: 'success' | 'error' | 'info' | 'warning' = 'info';


  // Action buttons configuration
  actionButtons = [
    {
      id: 'close',
      label: 'Clôturer',
      icon: 'M17 16l4-4-4-4m-6 8H3V8h8', // door with arrow
      color: '#ef4444', // Red-500: urgent/critical
      action: () => this.closeShift()
    },
    {
      id: 'invoice',
      label: 'Facture',
      icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586l6.414 6.414V19a2 2 0 01-2 2z',
      color: '#2563eb', // Blue-600: professional
      action: () => this.generateInvoice()
    },
    {
      id: 'client',
      label: 'Client',
      icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
      color: '#9333ea', // Purple-600: identity/people
      action: () => this.openClientSearch()
    },
    {
      id: 'history',
      label: 'Historique',
      icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
      color: '#0ea5e9', // Cyan-500: time/history
      action: () => this.showHistory()
    },
    {
      id: 'temporary',
      label: 'Temporaire',
      icon: 'M12 6v6l4 2m-4-8a9 9 0 100 18 9 9 0 000-18z', // clock/hourglass style
      color: '#f97316', // Orange-500: pending/in-progress
      action: () => this.toggleTemporarySale()
    },
    {
      id: 'gift',
      label: 'Cadeau',
      icon: 'M12 8v13m0-13V6a2 2 0 112 2h-2zM5 12h14M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7',
      color: '#84cc16', // Lime-500: joyful
      action: () => this.markAsGift()
    },
    {
      id: 'discount',
      label: 'Remise',
      icon: 'M7 7h.01M7 3h5l7 7-7 7-7-7V7a4 4 0 014-4z',
      color: '#f59e0b', // Amber-500: discount
      action: () => this.applyDiscount()
    },
    {
      id: 'validate',
      label: 'Régler',
      icon: 'M4 6h16M4 10h16M4 14h10', // credit card
      color: '#10b981', // Green-500: confirm/positive
      action: () => this.validateSale()
    }
  ];

  commandButtons = [
    {
      id: 'validate-esp',
      label: 'Espèces',
      icon: 'M5 13l4 4L19 7', // checkmark
      color: '#22c55e', // Green-500: cash OK
      action: () => this.validateESP()
    },
    
    {
      id: 'reset',
      label: 'Reset',
      icon: 'M4 4v5h.582m15.356 2A8 8 0 004.582 9m0 0H9m11 11v-5h-.581',
      color: '#ef4444', // Red-500: clear
      action: () => this.resetSale()
    },
    {
      id: 'remise',
      label: 'Régler Rem.',
      icon: 'M9 5h6m-3 0v14m-7-7h14M4 9l2 2m0-2l-2 2m12-2l2 2m0-2l-2 2', // ticket with cut lines
      color: '#eab308', // Yellow-500: discount
      action: () => this.openRemisePaymentPopup()
    }
  ];

  constructor(
    private router: Router,
    private productsService: ProductsService,
    private salesService: SalesService,
    private clientsService: ClientsService,
    private stockDocumentsService: StockDocumentsService,
    private reportsService: ReportsService,
    private settingsService: SettingsService,
    private sessionsService: SessionsService,
    private dailyExtractService: DailyExtractService,
    private printService: PrintService
  ) {}

  ngOnInit(): void {
    this.loadTicketState(); // Initialize ticket number system
    this.initializeMultiClientSystem();
    this.loadProducts();
    this.loadPendingTemporarySalesCount();
    this.loadPendingGiftSalesCount();
    this.loadShopInventory();
    this.loadSettings();
    this.loadCurrentSession();
  }

  // Multi-client system methods
  initializeMultiClientSystem(): void {
    this.clientCarts = [];
    // Start with only Client 1
    this.clientCarts.push({
      id: 1,
      clientName: `Client 1`,
      items: [],
      subtotal: 0,
      discount: 0,
      netTotal: 0,
      isActive: true,
      createdAt: new Date()
    });
    this.activeCartId = 1;
  }

  getActiveCart(): ClientCart | undefined {
    return this.clientCarts.find(cart => cart.id === this.activeCartId);
  }

  getCartById(id: number): ClientCart | undefined {
    return this.clientCarts.find(cart => cart.id === id);
  }

  switchToCart(cartId: number): void {
    if (cartId < 1 || cartId > this.maxClients) return;
    
    // Auto-remove empty clients before switching
    this.autoRemoveEmptyClients();
    
    this.switchToCartDirectly(cartId);
  }

  switchToCartDirectly(cartId: number): void {
    if (cartId < 1 || cartId > this.maxClients) return;
    
    // Deactivate current cart
    const currentCart = this.getActiveCart();
    if (currentCart) {
      currentCart.isActive = false;
    }
    
    // Activate new cart
    this.activeCartId = cartId;
    const newCart = this.getActiveCart();
    if (newCart) {
      newCart.isActive = true;
    }
    
    // Clear any pending product selection
    this.pendingProduct = null;
    this.selectedReceiptItem = null;
    this.selectedReceiptItemIndex = -1;
    this.currentInput = '';
    
    this.showAlertMessage(`Basculé vers ${newCart?.clientName}`, 'info');
  }

  clearCart(cartId: number): void {
    const cart = this.getCartById(cartId);
    if (!cart) return;
    
    cart.items = [];
    cart.subtotal = 0;
    cart.discount = 0;
    cart.netTotal = 0;
    
    // If this was the active cart, clear selections
    if (cartId === this.activeCartId) {
      this.pendingProduct = null;
      this.selectedReceiptItem = null;
      this.selectedReceiptItemIndex = -1;
      this.currentInput = '';
    }
    
    // Auto-remove the client if it's not Client 1
    if (cartId !== 1) {
      this.removeClientDirectly(cartId);
      this.showAlertMessage(`${cart.clientName} supprimé (panier vidé)`, 'info');
    } else {
      this.showAlertMessage(`Panier de ${cart.clientName} vidé`, 'info');
    }
  }

  getCartItemCount(cartId: number): number {
    const cart = this.getCartById(cartId);
    return cart ? cart.items.length : 0;
  }

  getCartTotal(cartId: number): number {
    const cart = this.getCartById(cartId);
    return cart ? cart.netTotal : 0;
  }

  isCartEmpty(cartId: number): boolean {
    const cart = this.getCartById(cartId);
    return cart ? cart.items.length === 0 : true;
  }

  getCartStatus(cartId: number): 'empty' | 'active' | 'ready' | 'processing' {
    const cart = this.getCartById(cartId);
    if (!cart) return 'empty';
    
    if (cart.items.length === 0) return 'empty';
    if (cart.id === this.activeCartId) return 'active';
    return 'ready';
  }

  getCartButtonClass(cartId: number): string {
    const status = this.getCartStatus(cartId);
    const baseClass = 'relative px-2 py-1 rounded border transition-all duration-200 hover:scale-105 min-w-0 flex-shrink-0';
    
    switch (status) {
      case 'active':
        return `${baseClass} bg-blue-100 border-blue-500 shadow-md`;
      case 'ready':
        return `${baseClass} bg-green-100 border-green-500`;
      case 'empty':
        return `${baseClass} bg-gray-100 border-gray-300`;
      default:
        return `${baseClass} bg-gray-100 border-gray-300`;
    }
  }

  getCartStatusColor(cartId: number): string {
    const status = this.getCartStatus(cartId);
    
    switch (status) {
      case 'active':
        return 'bg-blue-500';
      case 'ready':
        return 'bg-green-500';
      case 'empty':
        return 'bg-gray-300';
      default:
        return 'bg-gray-300';
    }
  }

  addNewClient(): void {
    if (this.clientCarts.length >= this.maxClients) {
      this.showAlertMessage(`Maximum ${this.maxClients} clients allowed`, 'error');
      return;
    }

    // Auto-remove empty clients before adding new one
    this.autoRemoveEmptyClients();

    const newClientId = this.getNextClientId();
    const newCart: ClientCart = {
      id: newClientId,
      clientName: `Client ${newClientId}`,
      items: [],
      subtotal: 0,
      discount: 0,
      netTotal: 0,
      isActive: false,
      createdAt: new Date()
    };

    this.clientCarts.push(newCart);
    
    // Manually switch to the newly added client without calling autoRemoveEmptyClients again
    this.switchToCartDirectly(newClientId);
    
    this.showAlertMessage(`Client ${newClientId} ajouté et sélectionné`, 'success');
  }

  removeClient(cartId: number): void {
    if (this.clientCarts.length <= 1) {
      this.showAlertMessage('Au moins un client doit rester', 'error');
      return;
    }

    this.removeClientDirectly(cartId);
  }

  removeClientDirectly(cartId: number): void {
    const cartIndex = this.clientCarts.findIndex(cart => cart.id === cartId);
    if (cartIndex === -1) return;

    // If removing the active cart, switch to the first remaining cart
    if (cartId === this.activeCartId) {
      const remainingCarts = this.clientCarts.filter(cart => cart.id !== cartId);
      if (remainingCarts.length > 0) {
        this.switchToCartDirectly(remainingCarts[0].id);
      }
    }

    this.clientCarts.splice(cartIndex, 1);
    this.showAlertMessage(`Client ${cartId} supprimé`, 'info');
  }

  private getNextClientId(): number {
    const existingIds = this.clientCarts.map(cart => cart.id);
    let nextId = 1;
    while (existingIds.includes(nextId)) {
      nextId++;
    }
    return nextId;
  }

  canAddMoreClients(): boolean {
    return this.clientCarts.length < this.maxClients;
  }

  canRemoveClient(cartId: number): boolean {
    return this.clientCarts.length > 1;
  }

  autoRemoveEmptyClients(): void {
    // Remove empty clients except Client 1
    const emptyClients = this.clientCarts.filter(cart => 
      cart.id !== 1 && cart.items.length === 0
    );
    
    emptyClients.forEach(cart => {
      this.removeClientDirectly(cart.id);
    });
  }

  autoRemoveClientAfterPayment(cartId: number): void {
    const cart = this.getCartById(cartId);
    if (!cart) return;
    
    // If it's Client 1, just clear the cart but keep the client
    if (cartId === 1) {
      cart.items = [];
      cart.subtotal = 0;
      cart.discount = 0;
      cart.netTotal = 0;
      this.calculateTotals();
      return;
    }
    
    // For other clients, remove them after payment
    this.removeClientDirectly(cartId);
  }

  loadProducts(): void {
    // Load products and sales data in parallel
    this.productsService.getProducts().subscribe({
      next: (products) => {
        this.allProducts = products;
        this.loadProductSalesData();
      },
      error: (error) => {
        console.error('Error loading products:', error);
      }
    });
  }

  loadProductSalesData(): void {
    // Get sales data for the last 30 days to order products by popularity
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    this.reportsService.getProductSales(
      startDate.toISOString().split('T')[0],
      endDate.toISOString().split('T')[0],
      this.currentShopDepotId
    ).subscribe({
      next: (salesData) => {
        this.productSalesData = salesData;
        this.orderProductsBySales();
        this.filterProducts();
      },
      error: (error) => {
        console.error('Error loading product sales data:', error);
        // If sales data fails to load, just use the products as they are
        this.filterProducts();
      }
    });
  }

  orderProductsBySales(): void {
    // Create a map of product ID to sales data for quick lookup
    const salesMap = new Map<number, ProductSalesData>();
    this.productSalesData.forEach(sales => {
      salesMap.set(sales.productId, sales);
    });

    // Sort products by sales data (most sold first)
    this.allProducts.sort((a, b) => {
      const salesA = salesMap.get(a.id);
      const salesB = salesMap.get(b.id);
      
      // If both have sales data, sort by total sold (descending)
      if (salesA && salesB) {
        return salesB.totalSold - salesA.totalSold;
      }
      
      // If only one has sales data, prioritize it
      if (salesA && !salesB) return -1;
      if (!salesA && salesB) return 1;
      
      // If neither has sales data, maintain original order
      return 0;
    });
  }

  selectCategory(category: string): void {
    this.selectedCategory = category;
    this.currentPage = 0; // Reset to first page when changing category
    this.filterProducts();
  }

  filterProducts(): void {
    let filtered = this.allProducts;
    
    // Filter by category
    if (this.selectedCategory !== 'Tous') {
      filtered = filtered.filter(p => p.famille?.name === this.selectedCategory);
    }
    
    // Filter by search query
    if (this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase().trim();
      filtered = filtered.filter(p => 
        p.name.toLowerCase().includes(query) || 
        (p.barcode && p.barcode.toLowerCase().includes(query))
      );
    }
    
    // Store all filtered results
    this.filteredProducts = filtered;
    
    // Update pagination
    this.updatePagination();
  }

  onSearchChange(): void {
    this.filterProducts();
  }

  // Pagination methods
  updatePagination(): void {
    this.totalPages = Math.ceil(this.filteredProducts.length / this.productsPerPage);
    if (this.currentPage >= this.totalPages) {
      this.currentPage = Math.max(0, this.totalPages - 1);
    }
  }

  getCurrentPageProducts(): Product[] {
    const startIndex = this.currentPage * this.productsPerPage;
    const endIndex = startIndex + this.productsPerPage;
    return this.filteredProducts.slice(startIndex, endIndex);
  }

  goToNextPage(): void {
    if (this.currentPage < this.totalPages - 1) {
      this.currentPage++;
    }
  }

  goToPreviousPage(): void {
    if (this.currentPage > 0) {
      this.currentPage--;
    }
  }

  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      this.goToPreviousPage();
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      this.goToNextPage();
    }
  }



  addProductToReceipt(product: Product): void {
    const activeCart = this.getActiveCart();
    if (!activeCart) return;
    
    const existingItem = activeCart.items.find(item => item.product.id === product.id);
    
    if (existingItem) {
      existingItem.quantity += 1;
      existingItem.total = Number(existingItem.quantity) * Number(existingItem.unitPrice);
      // Ensure all values are numbers
      existingItem.quantity = Number(existingItem.quantity);
      existingItem.unitPrice = Number(existingItem.unitPrice);
      
      // Select the existing item
      this.selectedReceiptItem = existingItem;
      this.selectedReceiptItemIndex = activeCart.items.indexOf(existingItem);
    } else {
      const newItem = {
        product,
        quantity: 1,
        unitPrice: Number(product.prix_vente_TTC),
        total: Number(product.prix_vente_TTC),
        isGift: false
      };
      activeCart.items.unshift(newItem);
      
      // Select the newly added item (now at index 0)
      this.selectedReceiptItem = newItem;
      this.selectedReceiptItemIndex = 0;
    }
    
    this.calculateTotals();
  }

  openProductDialog(product: Product, event: MouseEvent): void {
    event.preventDefault();
    // TODO: Implement product dialog for quantity/discount
    console.log('Open product dialog for:', product.name);
  }

  calculateTotals(): void {
    const activeCart = this.getActiveCart();
    if (!activeCart) return;
    
    activeCart.subtotal = activeCart.items.reduce((sum, item) => sum + Number(item.total), 0);
    activeCart.netTotal = Number(activeCart.subtotal) - Number(activeCart.discount);
    // Round up the total to nearest 0.050 increment
    this.total = this.roundUpToFiftyMillimes(activeCart.netTotal);
  }

  // Round up to 50 millimes increments (0.050, 0.100, 0.150, etc.)
  roundUpToFiftyMillimes(value: number): number {
    return Math.ceil(value / 0.05) * 0.05;
  }

  // Action buttons
  generateInvoice(): void {
    const activeCart = this.getActiveCart();
    if (!activeCart || activeCart.items.length === 0) {
      this.showAlertMessage('Aucun article dans le panier', 'error');
      return;
    }
    this.invoiceMode = true;
    this.validateSale();
  }

  // Client search functionality
  showClientSearchPopup = false;
  clientSearchQuery = '';
  searchResults: any[] = [];
  allClientsCache: any[] = [];
  selectedClient: Client | null = null;
  selectedClientId: number | null = null;
  searchingClients = false;

  openClientSearch(): void {
    this.showClientSearchPopup = true;
    this.clientSearchQuery = '';
    this.searchResults = [];
    this.selectedClient = null;
    if (this.allClientsCache.length === 0) {
      this.fetchAllClients();
    } else {
      this.filterClients();
    }
  }

  fetchAllClients(): void {
    this.searchingClients = true;
    // Load first 200 active clients for quick local filtering
    this.clientsService.getClients(1, 200, undefined, '', true).subscribe({
      next: (response: any) => {
        this.allClientsCache = response.clients || [];
        this.searchingClients = false;
        this.filterClients();
      },
      error: (error: any) => {
        this.searchingClients = false;
        this.showAlertMessage('Erreur chargement clients', 'error');
      }
    });
  }

  filterClients(): void {
    const q = (this.clientSearchQuery || '').trim().toLowerCase();
    if (!q) {
      this.searchResults = this.allClientsCache.slice(0, 20);
      return;
    }
    this.searchResults = this.allClientsCache.filter(c => {
      const name = `${c.firstName || ''} ${c.lastName || ''}`.toLowerCase();
      return name.includes(q) || (c.code || '').toLowerCase().includes(q) || (c.phone || '').toLowerCase().includes(q);
    }).slice(0, 20);
  }

  searchClients(): void {
    // Deprecated backend search: switch to local filtering only
    this.filterClients();
  }

  selectClient(client: any): void {
    const activeCart = this.getActiveCart();
    if (!activeCart) return;
    
    this.selectedClient = client;
    this.selectedClientId = client.id;
    this.currentCustomer = `${client.firstName} ${client.lastName}`;
    
    // Update the active cart with client information
    activeCart.client = client;
    activeCart.clientId = client.id;
    activeCart.clientName = `${client.firstName} ${client.lastName}`;
    
    this.showClientSearchPopup = false;
    this.showAlertMessage(`Client sélectionné: ${client.firstName} ${client.lastName}`, 'success');
  }

  clearSelectedClient(): void {
    const activeCart = this.getActiveCart();
    if (activeCart) {
      activeCart.client = undefined;
      activeCart.clientId = undefined;
      activeCart.clientName = `Client ${activeCart.id}`;
    }
    
    this.selectedClient = null;
    this.selectedClientId = null;
    this.currentCustomer = 'PASSAGER';
  }

  showHistory(): void {
    this.router.navigate(['/historique']);
  }

  applyDiscount(): void {
    this.openDiscountPopup();
  }

  cancelLastItem(): void {
    const activeCart = this.getActiveCart();
    if (activeCart && activeCart.items.length > 0) {
      activeCart.items.pop();
      this.calculateTotals();
    }
  }

  validateSale(): void {
    const activeCart = this.getActiveCart();
    if (!activeCart || activeCart.items.length === 0) {
      this.showAlertMessage('Aucun article dans le panier', 'error');
      return;
    }
    this.showPaymentPopup = true;
    this.paymentType = undefined;
    this.amountPaid = undefined;
    this.calculatedChange = 0;
  }

  selectPaymentType(type: 'cash' | 'card' | 'check' | 'virement'): void {
    this.paymentType = type;
    if (type === 'card') {
      // For card, assume exact payment
      this.amountPaid = Number(this.netTotal);
      this.calculateChange();
    } else if (type === 'check') {
      // For cheque, set amount but require additional details
      this.amountPaid = Number(this.netTotal);
      this.calculateChange();
      this.chequeId = '';
      this.encaissementDate = '';
    } else if (type === 'virement') {
      // For virement, set amount but require number
      this.amountPaid = Number(this.netTotal);
      this.calculateChange();
      this.virementNumber = '';
    }
  }

  calculateChange(): void {
    if (this.amountPaid && this.netTotal) {
      const change = Number(this.amountPaid) - Number(this.netTotal);
      this.calculatedChange = this.roundToTenthAsThreeDecimals(Math.max(0, change));
    } else {
      this.calculatedChange = 0;
    }
  }

  onAmountPaidChange(): void {
    const activeCart = this.getActiveCart();
    if (!activeCart) return;
    
    let total = this.selectedTemporarySale ? this.selectedTemporarySale.finalTotal : activeCart.netTotal;
    
    // Subtract advance payment if it exists
    if (this.selectedTemporarySale && this.selectedTemporarySale.advancePayment) {
      total = total - this.selectedTemporarySale.advancePayment;
    }
    
    if (this.amountPaid && this.amountPaid > 0) {
      this.calculatedChange = this.roundToTenthAsThreeDecimals(this.amountPaid - total);
    } else {
      this.calculatedChange = 0;
    }
  }

  cancelPayment(): void {
    this.showPaymentPopup = false;
    this.paymentType = undefined;
    this.amountPaid = undefined;
    this.calculatedChange = 0;
    this.chequeId = '';
    this.encaissementDate = '';
    this.virementNumber = '';
  }

  confirmPayment(): void {
    if (!this.paymentType) {
      this.showAlertMessage('Veuillez sélectionner un type de paiement', 'error');
      return;
    }
    
    if (this.paymentType === 'check' && (!this.chequeId.trim() || !this.encaissementDate)) {
      this.showAlertMessage('Veuillez remplir les détails du chèque (ID et date d\'encaissement)', 'error');
      return;
    }
    
    if (this.paymentType === 'virement' && !this.virementNumber.trim()) {
      this.showAlertMessage('Veuillez entrer le numéro de virement', 'error');
      return;
    }
    
    const activeCart = this.getActiveCart();
    if (!activeCart) return;
    
    const requiresFullPayment = !activeCart.clientId;
    if (requiresFullPayment && (!this.amountPaid || Number(this.amountPaid) < Number(activeCart.netTotal))) {
      this.showAlertMessage('Montant insuffisant', 'error');
      return;
    }

    // Show confirmation dialog instead of directly processing
    this.showPaymentConfirmation = true;
  }

  // Cancel payment confirmation dialog
  cancelPaymentConfirmation(): void {
    this.showPaymentConfirmation = false;
  }

  // Remise payment methods
  openRemisePaymentPopup(): void {
    const activeCart = this.getActiveCart();
    if (!activeCart || activeCart.items.length === 0) {
      this.showAlertMessage('Aucun article dans le panier', 'error');
      return;
    }
    this.showRemisePaymentPopup = true;
    this.remisePaymentAmount = undefined;
  }

  cancelRemisePayment(): void {
    this.showRemisePaymentPopup = false;
    this.remisePaymentAmount = undefined;
  }

  // Temporary sales history methods
  openTemporarySalesHistory(): void {
    this.showTemporarySalesHistory = true;
    this.loadAllTemporarySales();
  }

  closeTemporarySalesHistory(): void {
    this.showTemporarySalesHistory = false;
    this.allTemporarySales = [];
  }

  loadAllTemporarySales(): void {
    this.salesService.getSales().subscribe({
      next: (sales: any) => {
        // Filter for temporary sales (both pending and completed)
        this.allTemporarySales = sales.filter((sale: any) => 
          sale.status === 'TEMPORARY' || sale.status === 'CMD_TERMINEE' || sale.isTemporary
        );
      },
      error: (error: any) => {
        console.error('Error loading temporary sales history:', error);
        this.showAlertMessage('Erreur lors du chargement de l\'historique', 'error');
      }
    });
  }

  confirmRemisePayment(): void {
    if (this.remisePaymentAmount === undefined || this.remisePaymentAmount === null) {
      this.showAlertMessage('Veuillez entrer le montant reçu', 'error');
      return;
    }

    const activeCart = this.getActiveCart();
    if (!activeCart) return;
    
    const total = Number(activeCart.netTotal);
    const received = Number(this.remisePaymentAmount);
    
    // Calculate discount (difference between total and received amount)
    const discountAmount = total - received;
    const discountPercent = (discountAmount / total) * 100;
    
    // Validate against max discount percentage
    if (discountPercent > this.maxDiscountPercent) {
      const maxDiscountAmount = (total * this.maxDiscountPercent) / 100;
      this.showAlertMessage(`La remise ne peut pas dépasser ${this.maxDiscountPercent}% du total (${maxDiscountAmount.toFixed(3)} dt). Montant minimum à recevoir: ${(total - maxDiscountAmount).toFixed(3)} dt`, 'error');
      return;
    }
    
    // Apply the discount
    activeCart.discount = discountAmount;
    this.discountType = 'amount';
    this.discountTarget = 'Tous';
    
    // Recalculate totals to reflect the discount
    this.calculateTotals();
    
    // Set payment details
    this.paymentType = 'cash';
    this.amountPaid = received;
    this.calculatedChange = 0; // No change since we're accepting partial payment
    
    // Close popup and show payment confirmation
    this.showRemisePaymentPopup = false;
    this.showPaymentConfirmation = true;
    
    this.showAlertMessage(`Remise appliquée: ${discountAmount.toFixed(3)} dt (${discountPercent.toFixed(1)}%)`, 'success');
  }

  // Process payment with receipt printing
  processPaymentWithReceipt(): void {
    this.showPaymentConfirmation = false;
    this.processPayment(true);
  }

  // Process payment without receipt printing
  processPaymentWithoutReceipt(): void {
    this.showPaymentConfirmation = false;
    this.processPayment(false);
  }

  // Main payment processing method
  private processPayment(shouldPrintReceipt: boolean): void {
    const paymentMethodMap: { [key: string]: number } = {
      'cash': 1,
      'card': 2,
      'check': 3,
      'virement': 4
    };

    const activeCart = this.getActiveCart();
    if (!activeCart) return;
    
    const saleData: CreateSaleRequest = {
      items: activeCart.items.map(item => ({
        productId: item.product.id,
        productName: item.product.name,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        total: Number(item.total),
        discount: 0
      })),
      total: Number(activeCart.subtotal),
      discount: Number(activeCart.discount),
      finalTotal: Number(activeCart.netTotal),
      paymentMethodId: paymentMethodMap[this.paymentType!] || 1,
      clientId: activeCart.clientId || undefined,
      amountPaid: this.amountPaid !== undefined ? Number(this.amountPaid) : Number(activeCart.netTotal)
    };

    this.salesService.createSale(saleData).subscribe({
      next: (savedSale: any) => {
        const loyaltyEarned = savedSale?.loyaltyPointsEarned || 0;
        
        // Store the last validated sale for printing
        this.lastValidatedSale = {
          ...savedSale,
          loyaltyEarned,
          receiptItems: [...activeCart.items],
          subtotal: activeCart.subtotal,
          discount: activeCart.discount,
          netTotal: activeCart.netTotal,
          paymentType: this.paymentType,
          amountPaid: this.amountPaid,
          calculatedChange: this.calculatedChange,
          selectedClient: activeCart.client,
          invoiceMode: this.invoiceMode
        };
        
        // Print receipt if requested
        if (shouldPrintReceipt) {
          this.printReceipt();
        }
        
        // Increment ticket number after successful sale
        this.incrementTicketNumber();
        
        // Refresh shop inventory to show updated stock quantities
        this.loadShopInventory();
        
        // Refresh session data to update sales totals
        this.sessionsService.getActiveSession().subscribe();
        
        // Auto-remove client after successful payment (except Client 1)
        this.autoRemoveClientAfterPayment(activeCart.id);
        
        this.showPaymentPopup = false;
        this.paymentType = undefined;
        this.amountPaid = undefined;
        this.calculatedChange = 0;
        this.chequeId = '';
        this.encaissementDate = '';
        this.virementNumber = '';
        this.selectedClient = null;
        this.selectedClientId = null;
        this.currentCustomer = 'PASSAGER';
        this.invoiceMode = false;
        
        this.showAlertMessage('Vente validée avec succès!', 'success');
      },
      error: (error) => {
        this.showAlertMessage(error?.error?.error || 'Erreur lors de la sauvegarde de la vente. Veuillez réessayer.', 'error');
      }
    });
  }

  printReceiptWithClient(loyaltyEarned: number): void {
    const data = this.generateReceiptData();
    data.clientName = this.selectedClient ? `${this.selectedClient.firstName} ${this.selectedClient.lastName}` : null;
    data.loyaltyEarned = loyaltyEarned;
    this.generateThermalReceipt(data);
    this.showAlertMessage('Reçu imprimé avec succès!', 'success');
  }

  printReceipt(): void {
    // Generate and print thermal receipt
    const receiptData = this.generateReceiptData();
    this.generateThermalReceipt(receiptData);
    this.showAlertMessage('Reçu imprimé avec succès!', 'success');
  }

  generateThermalReceipt(data: any): void {
    const receiptContent = this.formatThermalReceipt(data);
    console.log('Thermal Receipt:\n' + receiptContent);
    
    // In a real implementation, this would be sent to thermal printer
    // For now, we'll create a printable window
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Reçu - ${data.storeName}</title>
            <style>
              body { 
                font-family: 'Courier New', monospace; 
                font-size: 12px; 
                margin: 0; 
                padding: 10px;
                white-space: pre-wrap;
                max-width: 300px;
              }
              @media print {
                body { margin: 0; padding: 5px; }
              }
            </style>
          </head>
          <body>${receiptContent.replace(/\n/g, '<br>')}</body>
        </html>
      `);
      printWindow.document.close();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 500);
    }
  }

  formatThermalReceipt(data: any): string {
    const line = '--------------------------------';
    const doubleLine = '================================';
    
    let receipt = '';
    
    receipt += this.centerText(data.storeName, 32) + '\n';
    receipt += this.centerText(data.address, 32) + '\n';
    receipt += this.centerText(data.city, 32) + '\n';
    receipt += this.centerText(data.phone, 32) + '\n';
    receipt += doubleLine + '\n';
    
    receipt += `Date: ${data.date}    Heure: ${data.time}\n`;
    if (data.clientName) {
      receipt += `Client: ${data.clientName}\n`;
    }
    receipt += `Caissier: PASSAGER\n`;
    receipt += line + '\n';
    
    receipt += this.formatLine('ARTICLE', 'QTE', 'P.U.', 'TOTAL', 32) + '\n';
    receipt += line + '\n';
    
    data.items.forEach((item: any) => {
      const name = this.truncate(item.product.name, 20);
      receipt += `${name}\n`;
      receipt += this.formatLine(
        '', 
        item.quantity.toString(),
        Number(item.unitPrice).toFixed(3),
        Number(item.total).toFixed(3),
        32
      ) + '\n';
    });
    
    receipt += line + '\n';
    
    receipt += this.formatReceiptLine('Sous-total:', Number(data.subtotal).toFixed(3) + ' dt', 32) + '\n';
    if (Number(data.discount) > 0) {
      receipt += this.formatReceiptLine('Remise:', '-' + Number(data.discount).toFixed(3) + ' dt', 32) + '\n';
    }
    receipt += doubleLine + '\n';
    receipt += this.formatReceiptLine('TOTAL A PAYER:', Number(data.netTotal).toFixed(3) + ' dt', 32) + '\n';
    receipt += doubleLine + '\n';
    
    const paymentTypeText = data.paymentType === 'cash' ? 'ESPECES' : 
                           data.paymentType === 'card' ? 'CARTE' : data.paymentType === 'check' ? 'CHEQUE' : 'VIREMENT';
    receipt += this.formatReceiptLine('Paiement:', paymentTypeText, 32) + '\n';
    if (data.paymentType === 'cash') {
      receipt += this.formatReceiptLine('Reçu:', Number(data.amountPaid).toFixed(3) + ' dt', 32) + '\n';
      receipt += this.formatReceiptLine('Rendu:', Number(data.change).toFixed(3) + ' dt', 32) + '\n';
    }
    if (data.clientName && data.loyaltyEarned) {
      receipt += this.formatReceiptLine('Points fidélité:', `${data.loyaltyEarned}`, 32) + '\n';
    }
    receipt += line + '\n';
    
    receipt += this.centerText('Merci de votre visite!', 32) + '\n';
    receipt += this.centerText('A bientôt!', 32) + '\n';
    receipt += line + '\n';
    receipt += this.centerText(`Articles: ${data.items.length}`, 32) + '\n';
    
    return receipt;
  }

  centerText(text: string, width: number): string {
    const padding = Math.max(0, Math.floor((width - text.length) / 2));
    return ' '.repeat(padding) + text;
  }

  formatLine(col1: string, col2: string, col3: string, col4: string, width: number): string {
    const col1Width = 12;
    const col2Width = 4;
    const col3Width = 6;
    const col4Width = 8;
    
    return (
      col1.padEnd(col1Width).substring(0, col1Width) +
      col2.padStart(col2Width).substring(0, col2Width) +
      col3.padStart(col3Width).substring(0, col3Width) +
      col4.padStart(col4Width).substring(0, col4Width)
    );
  }

  formatReceiptLine(label: string, value: string, width: number): string {
    const maxLabelWidth = width - value.length - 1;
    const truncatedLabel = label.length > maxLabelWidth ? label.substring(0, maxLabelWidth) : label;
    const padding = width - truncatedLabel.length - value.length;
    return truncatedLabel + ' '.repeat(Math.max(1, padding)) + value;
  }

  generateReceiptData(): any {
    const activeCart = this.getActiveCart();
    if (!activeCart) return {};
    
    const now = new Date();
    return {
      storeName: 'PÂTISSERIE DELICE',
      address: '123 Rue des Gourmandises',
      city: 'Tunis, Tunisie',
      phone: 'Tél: +216 XX XXX XXX',
      date: now.toLocaleDateString('fr-FR'),
      time: now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      items: activeCart.items,
      subtotal: activeCart.subtotal,
      discount: activeCart.discount,
      netTotal: activeCart.netTotal,
      paymentType: this.paymentType,
      amountPaid: this.amountPaid,
      change: this.calculatedChange
    };
  }

  resetSale(): void {
    const activeCart = this.getActiveCart();
    if (!activeCart) return;
    
    activeCart.items = [];
    activeCart.discount = 0;
    this.calculateTotals();
  }

  openSettings(): void {
    console.log('Open settings');
  }

  toggleTemporarySale(): void {
    this.showTemporarySaleSelectionPopup = true;
  }

  // Temporary sale customer methods
  searchTemporarySaleCustomers(): void {
    if (!this.temporarySaleCustomerSearch.trim()) {
      this.temporarySaleCustomerResults = [];
      return;
    }

    const query = this.temporarySaleCustomerSearch.trim().toLowerCase();
    this.temporarySaleCustomerResults = this.allClientsCache.filter(client => 
      client.firstName.toLowerCase().includes(query) ||
      client.lastName.toLowerCase().includes(query) ||
      client.code.toLowerCase().includes(query) ||
      (client.phone && client.phone.includes(query))
    ).slice(0, 10);
  }

  selectTemporarySaleCustomer(customer: any): void {
    this.temporarySaleSelectedCustomer = customer;
    this.temporarySaleCustomerSearch = `${customer.firstName} ${customer.lastName}`;
    this.temporarySaleCustomerResults = [];
  }

  clearTemporarySaleCustomer(): void {
    this.temporarySaleSelectedCustomer = null;
    this.temporarySaleCustomerSearch = '';
    this.temporarySaleCustomerResults = [];
  }

  createTemporarySaleNewCustomer(): void {
    if (!this.temporarySaleNewCustomer.firstName || !this.temporarySaleNewCustomer.lastName) {
      this.showAlertMessage('Prénom et nom sont requis', 'error');
      return;
    }

    const newCustomerData = {
      firstName: this.temporarySaleNewCustomer.firstName,
      lastName: this.temporarySaleNewCustomer.lastName,
      phone: this.temporarySaleNewCustomer.phone || undefined,
      email: this.temporarySaleNewCustomer.email || undefined,
      clientType: 'INDIVIDUAL' as const
    };

    this.clientsService.createClient(newCustomerData).subscribe({
      next: (newCustomer) => {
        this.temporarySaleSelectedCustomer = newCustomer;
        this.showAlertMessage(`Nouveau client créé: ${newCustomer.firstName} ${newCustomer.lastName}`, 'success');
        this.resetTemporarySaleNewCustomerForm();
      },
      error: (error) => {
        this.showAlertMessage('Erreur lors de la création du client', 'error');
      }
    });
  }

  resetTemporarySaleNewCustomerForm(): void {
    this.temporarySaleNewCustomer = {
      firstName: '',
      lastName: '',
      phone: '',
      email: ''
    };
  }

  getTemporarySaleCustomerDisplayName(): string {
    if (this.temporarySaleCustomerType === 'passager') {
      return 'Passager';
    } else if (this.temporarySaleSelectedCustomer) {
      return `${this.temporarySaleSelectedCustomer.firstName} ${this.temporarySaleSelectedCustomer.lastName}`;
    }
    return 'Aucun client sélectionné';
  }

  getTemporarySaleClientId(): number | undefined {
    if (this.temporarySaleCustomerType === 'existing' && this.temporarySaleSelectedCustomer) {
      return this.temporarySaleSelectedCustomer.id;
    } else if (this.temporarySaleCustomerType === 'new' && this.temporarySaleSelectedCustomer) {
      return this.temporarySaleSelectedCustomer.id;
    }
    return undefined;
  }

  confirmTemporarySale(): void {
    if (!this.temporarySaleExpectedDate || !this.temporarySaleExpectedTime) {
      this.showAlertMessage('Veuillez spécifier la date et l\'heure de vente prévue', 'error');
      return;
    }

    // Validate customer selection
    if (this.temporarySaleCustomerType === 'existing' && !this.temporarySaleSelectedCustomer) {
      this.showAlertMessage('Veuillez sélectionner un client existant', 'error');
      return;
    }

    if (this.temporarySaleCustomerType === 'new' && !this.temporarySaleSelectedCustomer) {
      this.showAlertMessage('Veuillez créer un nouveau client', 'error');
      return;
    }
    
    const activeCart = this.getActiveCart();
    if (!activeCart) return;
    
    // Create temporary sale data
    const tempSaleData = {
      items: activeCart.items.map(item => ({
        productId: item.product.id,
        productName: item.product.name,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        total: Number(item.total)
      })),
      total: Number(activeCart.subtotal),
      discount: Number(activeCart.discount),
      finalTotal: Number(activeCart.netTotal),
      expectedDate: this.temporarySaleExpectedDate,
      expectedTime: this.temporarySaleExpectedTime,
      notes: this.temporarySaleNotes,
      status: 'TEMPORARY',
      clientId: this.getTemporarySaleClientId(),
      // Advance payment fields
      advancePayment: this.advancePaymentAmount || undefined,
      advancePaymentMethod: this.advancePaymentMethod || undefined,
      advancePaymentNotes: this.advancePaymentNotes || undefined
    };
    
    // Save temporary sale to backend
    this.salesService.createTemporarySale(tempSaleData).subscribe({
      next: (savedSale) => {
        console.log('Temporary sale saved successfully:', savedSale);
        this.showAlertMessage('Vente temporaire enregistrée avec succès!', 'success');
        
        // Auto-remove client after successful temporary sale (except Client 1)
        this.autoRemoveClientAfterPayment(activeCart.id);
        this.showTemporarySalePopup = false;
        this.isTemporarySale = false;
        this.temporarySaleExpectedDate = '';
        this.temporarySaleExpectedTime = '';
        this.temporarySaleNotes = '';
        this.loadPendingTemporarySalesCount(); // Refresh the count
      },
      error: (error) => {
        console.error('Error saving temporary sale:', error);
        this.showAlertMessage('Erreur lors de la sauvegarde de la vente temporaire. Veuillez réessayer.', 'error');
      }
    });
  }

  cancelTemporarySale(): void {
    this.showTemporarySalePopup = false;
    this.isTemporarySale = false;
    this.temporarySaleExpectedDate = '';
    this.temporarySaleExpectedTime = '';
    this.temporarySaleNotes = '';
    this.resetAdvancePayment();
    
    // Reset customer selection
    this.temporarySaleCustomerType = 'passager';
    this.temporarySaleCustomerSearch = '';
    this.temporarySaleCustomerResults = [];
    this.temporarySaleSelectedCustomer = null;
    this.resetTemporarySaleNewCustomerForm();
  }

  // Advance payment methods
  openAdvancePaymentPopup(): void {
    this.showAdvancePaymentPopup = true;
    this.advancePaymentAmount = undefined;
    this.advancePaymentMethod = undefined;
    this.advancePaymentNotes = '';
    this.advancePaymentChequeId = '';
    this.advancePaymentEncaissementDate = '';
    this.advancePaymentVirementNumber = '';
  }

  closeAdvancePaymentPopup(): void {
    this.showAdvancePaymentPopup = false;
    this.resetAdvancePayment();
  }

  resetAdvancePayment(): void {
    this.advancePaymentAmount = undefined;
    this.advancePaymentMethod = undefined;
    this.advancePaymentNotes = '';
    this.advancePaymentChequeId = '';
    this.advancePaymentEncaissementDate = '';
    this.advancePaymentVirementNumber = '';
  }

  selectAdvancePaymentMethod(method: 'cash' | 'card' | 'check' | 'virement'): void {
    this.advancePaymentMethod = method;
    
    // Set default amount to full total if not set
    const activeCart = this.getActiveCart();
    if (!this.advancePaymentAmount && activeCart) {
      this.advancePaymentAmount = activeCart.netTotal;
    }
    
    // Clear method-specific fields when switching
    this.advancePaymentChequeId = '';
    this.advancePaymentEncaissementDate = '';
    this.advancePaymentVirementNumber = '';
  }

  confirmAdvancePayment(): void {
    if (!this.advancePaymentMethod) {
      this.showAlertMessage('Veuillez sélectionner un type de paiement', 'error');
      return;
    }

    if (!this.advancePaymentAmount || this.advancePaymentAmount <= 0) {
      this.showAlertMessage('Veuillez entrer un montant valide', 'error');
      return;
    }

    const activeCart = this.getActiveCart();
    if (!activeCart) return;
    
    if (this.advancePaymentAmount > activeCart.netTotal) {
      this.showAlertMessage('Le paiement d\'avance ne peut pas dépasser le montant total', 'error');
      return;
    }

    if (this.advancePaymentMethod === 'check' && (!this.advancePaymentChequeId.trim() || !this.advancePaymentEncaissementDate)) {
      this.showAlertMessage('Veuillez remplir les détails du chèque (ID et date d\'encaissement)', 'error');
      return;
    }

    if (this.advancePaymentMethod === 'virement' && !this.advancePaymentVirementNumber.trim()) {
      this.showAlertMessage('Veuillez entrer le numéro de virement', 'error');
      return;
    }

    // Add payment method details to notes if needed
    let notes = this.advancePaymentNotes;
    if (this.advancePaymentMethod === 'check' && this.advancePaymentChequeId) {
      notes += (notes ? ' | ' : '') + `Chèque: ${this.advancePaymentChequeId}`;
    }
    if (this.advancePaymentMethod === 'virement' && this.advancePaymentVirementNumber) {
      notes += (notes ? ' | ' : '') + `Virement: ${this.advancePaymentVirementNumber}`;
    }

    this.advancePaymentNotes = notes;
    this.showAdvancePaymentPopup = false;
    
    this.showAlertMessage(`Paiement d'avance configuré: ${this.advancePaymentAmount.toFixed(3)}dt (${this.advancePaymentMethod.toUpperCase()})`, 'success');
  }

  getAdvancePaymentRemainingAmount(): number {
    const activeCart = this.getActiveCart();
    if (!activeCart) return 0;
    
    if (!this.advancePaymentAmount) return activeCart.netTotal;
    return Math.max(0, activeCart.netTotal - this.advancePaymentAmount);
  }

  hasAdvancePayment(): boolean {
    return !!(this.advancePaymentAmount && this.advancePaymentAmount > 0);
  }

  getTemporarySaleBadge(): string {
    if (!this.isTemporarySale) return '';
    const activeCart = this.getActiveCart();
    if (!activeCart) return '';
    
    const itemCount = activeCart.items.length;
    const totalQuantity = activeCart.items.reduce((sum, item) => sum + item.quantity, 0);
    return `${itemCount} article${itemCount > 1 ? 's' : ''} (${totalQuantity} unités)`;
  }

  getTodayDate(): string {
    return new Date().toISOString().split('T')[0];
  }

  getDefaultTime(): string {
    const now = new Date();
    now.setHours(now.getHours() + 1); // Add 1 hour
    
    // Round to nearest 15 minutes
    const minutes = now.getMinutes();
    const roundedMinutes = Math.round(minutes / 15) * 15;
    
    if (roundedMinutes === 60) {
      now.setHours(now.getHours() + 1);
      now.setMinutes(0);
    } else {
      now.setMinutes(roundedMinutes);
    }
    
    // Format as HH:MM
    const hours = now.getHours().toString().padStart(2, '0');
    const mins = now.getMinutes().toString().padStart(2, '0');
    
    return `${hours}:${mins}`;
  }

  getTimeStep(): number {
    return 15; // 15 minutes intervals
  }

  setQuickNote(note: string): void {
    this.temporarySaleNotes = note;
  }

  addQuickNote(note: string): void {
    if (this.temporarySaleNotes) {
      this.temporarySaleNotes += ', ' + note;
    } else {
      this.temporarySaleNotes = note;
    }
  }

  clearNotes(): void {
    this.temporarySaleNotes = '';
  }

  selectTemporarySaleOption(option: 'new' | 'view'): void {
    this.showTemporarySaleSelectionPopup = false;
    
    if (option === 'new') {
      const activeCart = this.getActiveCart();
      if (!activeCart || activeCart.items.length === 0) {
        this.showAlertMessage('Aucun article dans le panier pour une vente temporaire', 'error');
        return;
      }
      this.showTemporarySalePopup = true;
      this.isTemporarySale = true;
      this.temporarySaleExpectedDate = '';
      this.temporarySaleExpectedTime = this.getDefaultTime();
      this.temporarySaleNotes = '';
    } else {
      this.loadExistingTemporarySales();
    }
  }

  loadExistingTemporarySales(): void {
    this.salesService.getSales().subscribe({
      next: (sales) => {
        this.existingTemporarySales = sales.filter(sale => sale.status === 'TEMPORARY');
        this.showExistingTemporarySalesPopup = true;
        // Auto-close popup if no more temporary sales
        if (this.existingTemporarySales.length === 0) {
          this.closeExistingTemporarySales();
          this.showAlertMessage('Aucune vente temporaire en attente', 'info');
        }
      },
      error: (error) => {
        console.error('Error loading temporary sales:', error);
        this.showAlertMessage('Erreur lors du chargement des ventes temporaires', 'error');
      }
    });
  }

  selectExistingTemporarySale(sale: Sale): void {
    this.selectedTemporarySale = sale;
    this.showExistingTemporarySalesPopup = false;
    this.showTemporarySalePaymentPopup = true;
  }

  closeTemporarySaleSelection(): void {
    this.showTemporarySaleSelectionPopup = false;
  }

  closeExistingTemporarySales(): void {
    this.showExistingTemporarySalesPopup = false;
    this.existingTemporarySales = [];
  }

  closeTemporarySalePayment(): void {
    this.showTemporarySalePaymentPopup = false;
    this.selectedTemporarySale = null;
    this.paymentType = undefined;
    this.amountPaid = undefined;
    this.calculatedChange = 0;
    this.chequeId = '';
    this.encaissementDate = '';
    this.virementNumber = '';
  }

  finalizeTemporarySale(): void {
    if (!this.selectedTemporarySale) return;
    
    // Calculate the remaining amount to pay (considering advance payment)
    const advancePaid = Math.abs(this.selectedTemporarySale.advancePayment || 0);
    const remainingAmount = this.selectedTemporarySale.finalTotal - advancePaid;
    
    // Validate payment details
    console.log('Validation check - paymentType:', this.paymentType, 'amountPaid:', this.amountPaid, 'calculatedChange:', this.calculatedChange);
    if (!this.paymentType || 
        (this.paymentType === 'cash' && (!this.amountPaid || this.calculatedChange < 0)) ||
        (this.paymentType === 'check' && (!this.chequeId.trim() || !this.encaissementDate)) ||
        (this.paymentType === 'virement' && !this.virementNumber.trim())) {
      console.log('Validation failed - showing error message');
      this.showAlertMessage('Veuillez remplir tous les champs requis', 'error');
      return;
    }
    
    // Prepare payment data
    const paymentData = {
      paymentType: this.paymentType,
      amountPaid: this.amountPaid,
      chequeId: this.chequeId,
      encaissementDate: this.encaissementDate,
      virementNumber: this.virementNumber
    };
    
    // Call backend to complete the temporary sale
    this.salesService.updateTemporarySaleToCompleted(this.selectedTemporarySale.id, paymentData).subscribe({
      next: (completedSale) => {
        console.log('Temporary sale completed successfully:', completedSale);
        this.showAlertMessage('Vente temporaire finalisée avec succès!', 'success');
        
        // Increment ticket number after successful temporary sale completion
        this.incrementTicketNumber();
        
        // Refresh shop inventory to show updated stock quantities
        this.loadShopInventory();
        
        this.closeTemporarySalePayment();
        this.loadPendingTemporarySalesCount(); // Refresh the count
        // Refresh the existing temporary sales list to remove the finalized sale
        if (this.showExistingTemporarySalesPopup) {
          this.loadExistingTemporarySales();
        }
        
        // Auto-remove empty clients after temporary sale finalization
        this.autoRemoveEmptyClients();
      },
      error: (error) => {
        console.error('Error completing temporary sale:', error);
        this.showAlertMessage('Erreur lors de la finalisation de la vente temporaire. Veuillez réessayer.', 'error');
      }
    });
  }

  markAsGift(): void {
    const activeCart = this.getActiveCart();
    if (!activeCart || activeCart.items.length === 0) {
      this.showAlertMessage('Aucun article dans le panier pour un cadeau', 'error');
      return;
    }
    this.showGiftPopup = true;
    this.giftReason = '';
    this.giftRecipient = '';
  }

  setQuickGiftReason(reason: string): void {
    this.giftReason = reason;
  }

  confirmGift(): void {
    if (!this.giftReason.trim()) {
      this.showAlertMessage('Veuillez spécifier la raison du cadeau', 'error');
      return;
    }
    
    const activeCart = this.getActiveCart();
    if (!activeCart) return;
    
    // Create gift sale data
    const giftSaleData = {
      items: activeCart.items.map(item => ({
        productId: item.product.id,
        productName: item.product.name,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        total: Number(item.total)
      })),
      total: Number(activeCart.subtotal),
      discount: Number(activeCart.discount),
      finalTotal: 0, // Gift is free
      reason: this.giftReason,
      recipient: this.giftRecipient,
      status: 'PENDING_ADMIN',
      clientId: activeCart.clientId || undefined
    };
    
    // Save gift sale to backend
    this.salesService.createGiftSale(giftSaleData).subscribe({
      next: (savedSale) => {
        console.log('Gift sale saved successfully:', savedSale);
        this.showAlertMessage('Demande de cadeau envoyée pour approbation!', 'success');
        
        // Auto-remove client after successful gift sale (except Client 1)
        this.autoRemoveClientAfterPayment(activeCart.id);
        this.showGiftPopup = false;
        this.giftReason = '';
        this.giftRecipient = '';
        this.loadPendingGiftSalesCount(); // Refresh the count
      },
      error: (error) => {
        console.error('Error saving gift sale:', error);
        this.showAlertMessage('Erreur lors de la sauvegarde de la demande de cadeau. Veuillez réessayer.', 'error');
      }
    });
  }

  cancelGift(): void {
    this.showGiftPopup = false;
    this.giftReason = '';
    this.giftRecipient = '';
  }

  loadExistingGiftSales(): void {
    this.salesService.getSales().subscribe({
      next: (sales) => {
        this.existingGiftSales = sales.filter(sale => sale.status === 'PENDING_ADMIN' || sale.status === 'CADEAU');
        this.showExistingGiftSalesPopup = true;
      },
      error: (error) => {
        console.error('Error loading gift sales:', error);
        this.showAlertMessage('Erreur lors du chargement des cadeaux', 'error');
      }
    });
  }

  closeExistingGiftSales(): void {
    this.showExistingGiftSalesPopup = false;
    this.existingGiftSales = [];
  }

  approveGiftSale(sale: Sale): void {
    if (sale.status !== 'PENDING_ADMIN') {
      this.showAlertMessage('Ce cadeau a déjà été traité', 'error');
      return;
    }
    
    this.salesService.approveGiftSale(sale.id).subscribe({
      next: (approvedSale) => {
        console.log('Gift sale approved successfully:', approvedSale);
        this.showAlertMessage('Cadeau approuvé avec succès!', 'success');
        this.loadExistingGiftSales(); // Refresh the list
        this.loadPendingGiftSalesCount(); // Refresh the count
      },
      error: (error) => {
        console.error('Error approving gift sale:', error);
        this.showAlertMessage('Erreur lors de l\'approbation du cadeau. Veuillez réessayer.', 'error');
      }
    });
  }

  rejectGiftSale(sale: Sale): void {
    if (sale.status !== 'PENDING_ADMIN') {
      this.showAlertMessage('Ce cadeau a déjà été traité', 'error');
      return;
    }
    
    this.salesService.rejectGiftSale(sale.id).subscribe({
      next: (rejectedSale) => {
        console.log('Gift sale rejected successfully:', rejectedSale);
        this.showAlertMessage('Cadeau rejeté avec succès!', 'success');
        this.loadExistingGiftSales(); // Refresh the list
        this.loadPendingGiftSalesCount(); // Refresh the count
      },
      error: (error) => {
        console.error('Error rejecting gift sale:', error);
        this.showAlertMessage('Erreur lors du rejet du cadeau. Veuillez réessayer.', 'error');
      }
    });
  }

  loadSettings(): void {
    this.settingsService.getSettings().subscribe({
      next: (settings) => {
        if (settings?.maxDiscountPercent) {
          this.maxDiscountPercent = settings.maxDiscountPercent;
        }
      },
      error: (error) => {
        console.error('Error loading settings:', error);
      }
    });
  }

  loadCurrentSession(): void {
    this.sessionsService.getActiveSession().subscribe({
      next: (session) => {
        this.currentSession = session;
        this.isShiftOpen = !!session;
      },
      error: (error) => {
        console.error('Error loading current session:', error);
      }
    });
  }

  openClosurePopup(): void {
    if (!this.currentSession) {
      this.showAlertMessage('Aucune session active trouvée', 'error');
      return;
    }
    this.showClosurePopup = true;
  }

  closeClosurePopup(): void {
    this.showClosurePopup = false;
    this.closureForm = {
      countedCash: 0,
      retraitCentrale: 0,
      note: ''
    };
  }

  confirmClosure(): void {
    if (!this.currentSession) {
      this.showAlertMessage('Aucune session active trouvée', 'error');
      return;
    }

    if (!this.closureForm.countedCash || this.closureForm.countedCash < 0) {
      this.showAlertMessage('Veuillez entrer le montant compté', 'error');
      return;
    }

    const closureData = {
      countedCash: this.closureForm.countedCash,
      fonds: 50, // Default fonds, could be from settings
      retraitCentrale: this.closureForm.retraitCentrale || undefined,
      denominations: {} // Could be enhanced with denomination counting
    };

    this.sessionsService.closeSession(this.currentSession.id, closureData).subscribe({
      next: (result) => {
        this.showAlertMessage('Session fermée avec succès', 'success');
        this.closeClosurePopup();
        this.currentSession = null;
        this.isShiftOpen = false;
        
        // Reset ticket number for new shift
        this.resetTicketNumber();
        this.saveTicketState();
        
        // Auto-print daily extract if withdrawal was made
        if (this.closureForm.retraitCentrale > 0) {
          this.printDailyExtract(result);
        }
      },
      error: (error) => {
        console.error('Error closing session:', error);
        this.showAlertMessage('Erreur lors de la fermeture de la session', 'error');
      }
    });
  }

  printDailyExtract(sessionData: any): void {
    // Get today's date for the daily extract
    const today = new Date();
    const dateString = today.toISOString().split('T')[0]; // YYYY-MM-DD format
    
    // Call the daily extract service to get today's data
    this.dailyExtractService.getExtractDetail(dateString).subscribe({
      next: (dailyExtract) => {
        // Enhance the daily extract with withdrawal information
        const enhancedExtract = {
          ...dailyExtract,
          withdrawalAmount: this.closureForm.retraitCentrale || 0,
          remainingBalance: (this.closureForm.countedCash || 0) - (this.closureForm.retraitCentrale || 0),
          closureTimestamp: new Date()
        };
        
        // Print the enhanced daily extract
        this.printService.printDailyExtractWithWithdrawal(enhancedExtract);
        this.showAlertMessage(`Extrait journalière imprimé - Retrait: ${this.closureForm.retraitCentrale} TND`, 'success');
      },
      error: (error) => {
        console.error('Error fetching daily extract:', error);
        this.showAlertMessage('Erreur lors de l\'impression de l\'extrait journalier', 'error');
      }
    });
  }

  closeShift(): void {
    // Redirect to the cloture page
    this.router.navigate(['/cloture']);
  }

  openProducts(): void {
    this.router.navigate(['/stock/products']);
  }



  computeConservationSummary(product: Product): { status: 'Normal' | 'Proche de péremption' | 'Périmé' | 'Valide'; minDaysUntilExpiry: number; batches: Array<{ productionDate: Date | null; expirationDate: Date | null; remainingQuantity: number; daysUntilExpiry: number; isExpired: boolean; }>; } {
    const batches = (product.conservation || []).map(c => {
      const today = new Date();
      const expiration = c.expirationDate ? new Date(c.expirationDate) : null;
      const daysUntil = expiration ? Math.ceil((expiration.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) : 0;
      const expired = expiration ? daysUntil < 0 : false;
      return {
        productionDate: c.productionDate ? new Date(c.productionDate) : null,
        expirationDate: expiration,
        remainingQuantity: Number(c.remainingQuantity || 0),
        daysUntilExpiry: expiration ? daysUntil : 0,
        isExpired: expired
      };
    });

    if (batches.length === 0) {
      return { status: 'Valide', minDaysUntilExpiry: 0, batches: [] };
    }

    const minDays = batches.reduce((min, b) => Math.min(min, b.daysUntilExpiry), Infinity);
    const anyExpired = batches.some(b => b.isExpired);
    const closeThreshold = 2;

    let status: 'Normal' | 'Proche de péremption' | 'Périmé' | 'Valide' = 'Normal';
    if (anyExpired) status = 'Périmé';
    else if (minDays <= closeThreshold) status = 'Proche de péremption';
    else status = 'Normal';

    return { status, minDaysUntilExpiry: minDays === Infinity ? 0 : minDays, batches };
  }


  openDiscountPopup(): void {
    this.showDiscountTypeSelection = true;
    this.discountPercent = undefined;
    this.discountAmount = undefined;
    this.discountTarget = 'Tous';
    this.discountType = undefined;
  }

  selectDiscountType(type: 'percentage' | 'amount'): void {
    this.discountType = type;
    this.showDiscountTypeSelection = false;
    this.showDiscountPopup = true;
  }

  cancelDiscount(): void {
    this.showDiscountPopup = false;
    this.showDiscountTypeSelection = false;
    this.discountPercent = undefined;
    this.discountAmount = undefined;
    this.discountTarget = 'Tous';
    this.discountType = undefined;
  }

  private roundToTenthAsThreeDecimals(value: number): number {
    if (!isFinite(value)) return 0;
    const rounded = Math.round(value / 0.05) * 0.05;
    return Number(rounded.toFixed(3));
  }





  confirmDiscount(): void {
    const targetTotal = this.getTargetedTotal();
    let amount: number;
    let discountPercent: number;
    
    if (this.discountType === 'percentage') {
      const percent = Number(this.discountPercent) || 0;
      
      // Validate against max discount percentage
      if (percent > this.maxDiscountPercent) {
        this.showAlertMessage(`Le pourcentage de remise ne peut pas dépasser ${this.maxDiscountPercent}%`, 'error');
        return;
      }
      
      const raw = (targetTotal * percent) / 100;
      amount = this.roundToTenthAsThreeDecimals(raw);
      discountPercent = percent;
    } else {
      amount = this.roundToTenthAsThreeDecimals(Number(this.discountAmount) || 0);
      discountPercent = (amount / targetTotal) * 100;
      
      // Validate against max discount percentage
      if (discountPercent > this.maxDiscountPercent) {
        this.showAlertMessage(`Le montant de remise ne peut pas dépasser ${this.maxDiscountPercent}% du total (${(targetTotal * this.maxDiscountPercent / 100).toFixed(3)} dt)`, 'error');
        return;
      }
    }
    
    const activeCart = this.getActiveCart();
    if (!activeCart) return;
    
    activeCart.discount = amount;
    this.calculateTotals();
    this.showDiscountPopup = false;
    this.showDiscountTypeSelection = false;
    
    this.showAlertMessage(`Remise appliquée: ${amount.toFixed(3)} dt (${discountPercent.toFixed(1)}%)`, 'success');
  }

  getTargetedTotal(): number {
    const activeCart = this.getActiveCart();
    if (!activeCart || !activeCart.items || activeCart.items.length === 0) return 0;
    if (this.discountTarget === 'Tous') {
      return activeCart.items.reduce((sum, item) => sum + Number(item.total || 0), 0);
    }
    return activeCart.items
      .filter(item => item.product && item.product.famille?.name === this.discountTarget)
      .reduce((sum, item) => sum + Number(item.total || 0), 0);
  }

  getDiscountPreview(): number {
    const targetTotal = this.getTargetedTotal();
    
    if (this.discountType === 'percentage') {
      const percent = Number(this.discountPercent) || 0;
      const raw = (targetTotal * percent) / 100;
      return this.roundToTenthAsThreeDecimals(raw);
    } else {
      return this.roundToTenthAsThreeDecimals(Number(this.discountAmount) || 0);
    }
  }

  getCalculatedPercent(): number {
    if (this.discountType === 'amount' && this.discountAmount) {
      const targetTotal = this.getTargetedTotal();
      if (targetTotal > 0) {
        return (Number(this.discountAmount) / targetTotal) * 100;
      }
    }
    return Number(this.discountPercent) || 0;
  }

  getCalculatedAmount(): number {
    if (this.discountType === 'percentage' && this.discountPercent) {
      const targetTotal = this.getTargetedTotal();
      return this.roundToTenthAsThreeDecimals((targetTotal * Number(this.discountPercent)) / 100);
    }
    return this.roundToTenthAsThreeDecimals(Number(this.discountAmount) || 0);
  }

  // Numeric keypad
  addToInput(value: string): void {
    // Skip empty buttons
    if (value === '▄') {
      return;
    }
    
    // Add the value as is
    this.currentInput += value;
  }

  clearInput(): void {
    this.currentInput = '';
  }

  // Simple multiply functionality - toggle between quantity and price mode
  handleMultiply(): void {
    console.log('Multiply button clicked - current mode:', this.inputMode);
    if (this.inputMode === 'quantity') {
      this.inputMode = 'price';
      console.log('Switched to price mode');
    } else {
      this.inputMode = 'quantity';
      console.log('Switched to quantity mode');
    }
    this.currentInput = '';
  }

  addDecimal(): void {
    // Add . as per requirement
    this.currentInput += '.';
  }

  enterValue(): void {
    console.log('enterValue called - current inputMode:', this.inputMode);
    if (this.selectedReceiptItem && this.selectedReceiptItemIndex !== -1) {
      // Handle selected receipt item modification
      let value = parseFloat(this.currentInput);
      
      if (isNaN(value) || value < 0.001) {
        this.showAlertMessage('Valeur invalide (minimum 0.001)', 'error');
        return;
      }
      
      if (this.inputMode === 'price') {
        // Update total price and calculate quantity based on unit price
        this.selectedReceiptItem.total = value;
        this.selectedReceiptItem.quantity = value / Number(this.selectedReceiptItem.unitPrice);
        this.selectedReceiptItem.hasCustomTotal = true; // Mark as custom price
        console.log('Set hasCustomTotal = true for item:', this.selectedReceiptItem.product.name, 'total:', value);
        this.calculateTotals();
        // this.showAlertMessage(`Prix total mis à jour: ${value}€ (Qté: ${this.selectedReceiptItem.quantity.toFixed(2)})`, 'success');
      } else {
        // Update quantity
        this.selectedReceiptItem.quantity = value;
        this.selectedReceiptItem.total = Number(this.selectedReceiptItem.quantity) * Number(this.selectedReceiptItem.unitPrice);
        this.calculateTotals();
        // this.showAlertMessage(`Quantité mise à jour: ${value}`, 'success');
      }
      
      // Clear selection
      this.selectedReceiptItem = null;
      this.selectedReceiptItemIndex = -1;
      this.pendingProduct = null;
    } else if (this.pendingProduct) {
      // Handle new product addition
      let value = parseFloat(this.currentInput);
      
      // If no input or invalid input, use default values
      if (isNaN(value) || value < 0.001) {
        if (this.inputMode === 'quantity') {
          value = 1; // Default quantity
        } else if (this.inputMode === 'price') {
          value = Number(this.pendingProduct.prix_vente_TTC); // Default price
        }
      }
      
      if (this.inputMode === 'quantity') {
        // Replace the existing quantity with the new one
        this.replaceProductQuantity(this.pendingProduct, value);
      } else if (this.inputMode === 'price') {
        this.addProductToReceiptWithTotalPrice(this.pendingProduct, value);
      }
      this.pendingProduct = null;
    }
    
    // Store the last entered value and reset current input
    this.lastEnteredValue = this.currentInput;
    this.currentInput = '';
    
    // Only reset to quantity mode if we were in quantity mode
    // If we're in price mode, stay in price mode until manually toggled
    if (this.inputMode === 'quantity') {
      console.log('Resetting inputMode to quantity (was already quantity)');
      this.inputMode = 'quantity';
    } else {
      console.log('Keeping inputMode as:', this.inputMode);
    }

    this.inputMode = 'quantity';
  }

  // ⌫ button - backspace (delete one character)
  clearDisplay(): void {
    if (this.currentInput.length > 0) {
      this.currentInput = this.currentInput.slice(0, -1);
    }
  }

  // Remove specific line from receipt
  removeReceiptLine(index: number): void {
    const activeCart = this.getActiveCart();
    if (!activeCart || index < 0 || index >= activeCart.items.length) return;
    
    activeCart.items.splice(index, 1);
    
    // Clear selection if the removed item was selected
    if (this.selectedReceiptItemIndex === index) {
      this.selectedReceiptItem = null;
      this.selectedReceiptItemIndex = -1;
      this.pendingProduct = null;
      this.currentInput = '';
    } else if (this.selectedReceiptItemIndex > index) {
      // Adjust index if a previous item was removed
      this.selectedReceiptItemIndex--;
    }
    
    this.calculateTotals();
  }

  // Toggle between quantity and price input modes
  toggleInputMode(): void {
    this.pendingProduct = null;
    this.currentInput = '';
    // Don't auto-switch modes - let user choose
  }

  // Utility function to truncate text
  truncate(text: string, limit: number): string {
    if (!text) return '-';
    return text.length > limit ? text.substring(0, limit) + '...' : text;
  }

  showAlertMessage(message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info'): void {
    this.alertMessage = message;
    this.alertType = type;
    this.showAlert = true;
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
      this.hideAlert();
    }, 5000);
  }

  hideAlert(): void {
    this.showAlert = false;
    this.alertMessage = '';
  }

  loadPendingTemporarySalesCount(): void {
    this.salesService.getSales().subscribe({
      next: (sales) => {
        this.pendingTemporarySalesCount = sales.filter(sale => sale.status === 'TEMPORARY').length;
      },
      error: (error) => {
        console.error('Error loading pending temporary sales count:', error);
        this.pendingTemporarySalesCount = 0;
      }
    });
  }

  loadPendingGiftSalesCount(): void {
    this.salesService.getSales().subscribe({
      next: (sales) => {
        this.pendingGiftSalesCount = sales.filter(sale => sale.status === 'PENDING_ADMIN').length;
      },
      error: (error) => {
        console.error('Error loading pending gift sales count:', error);
        this.pendingGiftSalesCount = 0;
      }
    });
  }

  isFinalizeButtonDisabled(): boolean {
    if (!this.paymentType) return true;
    
    if (this.paymentType === 'cash') {
      // Enable button if change is 0 or more (meaning customer paid enough)
      console.log('Button disabled check - calculatedChange:', this.calculatedChange, 'amountPaid:', this.amountPaid);
      return !this.selectedTemporarySale?.client && (!this.amountPaid || this.calculatedChange < 0);
    }
    
    if (this.paymentType === 'check') {
      return !this.chequeId.trim() || !this.encaissementDate;
    }
    
    if (this.paymentType === 'virement') {
      return !this.virementNumber.trim();
    }
    
    return false;
  }

  printInvoice(): void {
    const activeCart = this.getActiveCart();
    if (!activeCart) return;
    
    const now = new Date();
    const lines = activeCart.items.map(item => `
      <tr>
        <td style=\"padding:6px;border:1px solid #ddd;\">${this.truncate(item.product.name, 40)}</td>
        <td style=\"padding:6px;border:1px solid #ddd;text-align:center;\">${item.quantity}</td>
        <td style=\"padding:6px;border:1px solid #ddd;text-align:right;\">${Number(item.unitPrice).toFixed(3)}</td>
        <td style=\"padding:6px;border:1px solid #ddd;text-align:right;\">${Number(item.total).toFixed(3)}</td>
      </tr>
    `).join('');

    const customer = activeCart.client ? `${activeCart.client.firstName} ${activeCart.client.lastName}` : 'PASSAGER';

    const html = `
      <html>
      <head>
        <meta charset=\"utf-8\" />
        <title>Facture</title>
        <style>
          body { font-family: Arial, sans-serif; color:#111; }
          .container { width: 800px; margin: 0 auto; }
          .header { display:flex; justify-content:space-between; align-items:flex-start; }
          .title { font-size: 22px; font-weight: 700; }
          .muted { color:#666; font-size:12px; }
          table { width:100%; border-collapse: collapse; margin-top: 16px; }
          .totals { width: 300px; margin-left:auto; margin-top:12px; }
          .totals td { padding:6px; }
          .right { text-align:right; }
        </style>
      </head>
      <body>
        <div class=\"container\">
          <div class=\"header\">
            <div>
              <div class=\"title\">Facture</div>
              <div class=\"muted\">Date: ${now.toLocaleDateString('fr-FR')} ${now.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}</div>
              <div class=\"muted\">Client: ${customer}</div>
            </div>
            <div style=\"text-align:right\">
              <div style=\"font-weight:700\">${'PÂTISSERIE DELICE'}</div>
              <div class=\"muted\">123 Rue des Gourmandises</div>
              <div class=\"muted\">Tunis, Tunisie</div>
              <div class=\"muted\">Tél: +216 XX XXX XXX</div>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th style=\"padding:6px;border:1px solid #ddd;text-align:left\">Article</th>
                <th style=\"padding:6px;border:1px solid #ddd;text-align:center\">Qté</th>
                <th style=\"padding:6px;border:1px solid #ddd;text-align:right\">P.U.</th>
                <th style=\"padding:6px;border:1px solid #ddd;text-align:right\">Total</th>
              </tr>
            </thead>
            <tbody>
              ${lines}
            </tbody>
          </table>
          <table class=\"totals\">
            <tr><td>Sous-total:</td><td class=\"right\">${Number(activeCart.subtotal).toFixed(3)} dt</td></tr>
            ${Number(activeCart.discount) > 0 ? `<tr><td>Remise:</td><td class=\"right\">-${Number(activeCart.discount).toFixed(3)} dt</td></tr>` : ''}
            <tr><td style=\"font-weight:700\">TOTAL:</td><td class=\"right\" style=\"font-weight:700\">${Number(activeCart.netTotal).toFixed(3)} dt</td></tr>
            <tr><td>Paiement:</td><td class=\"right\">${this.paymentType?.toUpperCase() || ''}</td></tr>
            ${activeCart.client && this.amountPaid !== undefined && Number(this.amountPaid) < Number(activeCart.netTotal) ? `<tr><td>Crédit client:</td><td class=\"right\">${(Number(activeCart.netTotal)-Number(this.amountPaid)).toFixed(3)} dt</td></tr>` : ''}
          </table>
        </div>
        <script>window.onload = function(){ window.print(); setTimeout(()=>window.close(), 400); };</script>
      </body>
      </html>
    `;

    const w = window.open('', '_blank');
    if (w) {
      w.document.open();
      w.document.write(html);
      w.document.close();
    }
    this.invoiceMode = false;
  }

  // Product Modal Methods
  onProductModalModeChange(): void {
    if (this.productModalMode === 'quantity') {
      this.productModalAmount = this.productModalQuantity * Number(this.selectedProduct?.prix_vente_TTC || 0);
    } else {
      this.productModalQuantity = this.productModalAmount / Number(this.selectedProduct?.prix_vente_TTC || 1);
    }
  }

  onProductModalQuantityChange(): void {
    if (this.selectedProduct) {
      this.productModalAmount = this.productModalQuantity * Number(this.selectedProduct.prix_vente_TTC);
    }
  }

  onProductModalAmountChange(): void {
    if (this.selectedProduct && this.selectedProduct.prix_vente_TTC > 0) {
      this.productModalQuantity = this.productModalAmount / Number(this.selectedProduct.prix_vente_TTC);
    }
  }


  addProductToReceiptWithQuantity(product: Product, quantity: number): void {
    console.log('addProductToReceiptWithQuantity called:', product.name, 'quantity:', quantity);
    const activeCart = this.getActiveCart();
    if (!activeCart) return;
    
    const existingItem = activeCart.items.find(item => item.product.id === product.id);
    
    if (existingItem) {
      existingItem.quantity += quantity;
      existingItem.total = Number(existingItem.quantity) * Number(existingItem.unitPrice);
      existingItem.quantity = Number(existingItem.quantity);
      existingItem.unitPrice = Number(existingItem.unitPrice);
      
      // Select the existing item
      this.selectedReceiptItem = existingItem;
      this.selectedReceiptItemIndex = activeCart.items.indexOf(existingItem);
    } else {
      const newItem = {
        product,
        quantity: quantity,
        unitPrice: Number(product.prix_vente_TTC),
        total: quantity * Number(product.prix_vente_TTC),
        isGift: false,
        hasCustomTotal: false
      };
      activeCart.items.unshift(newItem);
      
      // Select the newly added item (now at index 0)
      this.selectedReceiptItem = newItem;
      this.selectedReceiptItemIndex = 0;
    }
    
    this.calculateTotals();
  }

  addProductToReceiptWithCustomTotal(product: Product, customTotal: number): void {
    const activeCart = this.getActiveCart();
    if (!activeCart) return;
    
    const existingItem = activeCart.items.find(item => item.product.id === product.id);
    
    if (existingItem) {
      existingItem.quantity += 1;
      existingItem.total = customTotal; // Use the custom total directly
      existingItem.quantity = Number(existingItem.quantity);
      existingItem.unitPrice = customTotal; // Set unit price to the total (since quantity is 1)
      
      // Select the existing item
      this.selectedReceiptItem = existingItem;
      this.selectedReceiptItemIndex = activeCart.items.indexOf(existingItem);
    } else {
      const newItem = {
        product,
        quantity: 1,
        unitPrice: customTotal, // Set unit price to the total
        total: customTotal, // Use the custom total directly
        isGift: false
      };
      activeCart.items.unshift(newItem);
      
      // Select the newly added item (now at index 0)
      this.selectedReceiptItem = newItem;
      this.selectedReceiptItemIndex = 0;
    }
    
    this.calculateTotals();
  }

  replaceProductQuantity(product: Product, newQuantity: number): void {
    const activeCart = this.getActiveCart();
    if (!activeCart) return;
    
    const existingItem = activeCart.items.find(item => item.product.id === product.id);
    
    if (existingItem) {
      // Replace the quantity with the new one
      existingItem.quantity = newQuantity;
      existingItem.total = Number(existingItem.quantity) * Number(existingItem.unitPrice);
      existingItem.quantity = Number(existingItem.quantity);
      existingItem.unitPrice = Number(existingItem.unitPrice);
      
      // Select the existing item
      this.selectedReceiptItem = existingItem;
      this.selectedReceiptItemIndex = activeCart.items.indexOf(existingItem);
    } else {
      // If item doesn't exist, add it with the new quantity
      this.addProductToReceiptWithQuantity(product, newQuantity);
    }
    
    this.calculateTotals();
  }

  addProductToReceiptWithPrice(product: Product, customTotalAmount: number): void {
    // Round total amount to 50 millimes increments (0.050, 0.100, 0.150, etc.)
    const roundedTotalAmount = this.roundToFiftyMillimes(customTotalAmount);
    
    // Calculate quantity: montant / unit_price and round to 3 decimal places
    const originalPrice = Number(product.prix_vente_TTC);
    const calculatedQuantity = originalPrice > 0 ? 
      Math.round((roundedTotalAmount / originalPrice) * 1000) / 1000 : 1;
    
    const activeCart = this.getActiveCart();
    if (!activeCart) return;
    
    const existingItem = activeCart.items.find(item => item.product.id === product.id);
    
    if (existingItem) {
      // Replace the existing item with new calculated values
      existingItem.quantity = calculatedQuantity;
      existingItem.unitPrice = originalPrice;
      existingItem.total = roundedTotalAmount;
      existingItem.hasCustomTotal = true;
      
      // Select the existing item
      this.selectedReceiptItem = existingItem;
      this.selectedReceiptItemIndex = activeCart.items.indexOf(existingItem);
    } else {
      // Add new item with calculated quantity and custom total amount
      const newItem = {
        product,
        quantity: calculatedQuantity, // Calculated: montant / unit_price
        unitPrice: originalPrice, // Keep original unit price
        total: roundedTotalAmount, // Use the custom total amount
        isGift: false,
        hasCustomTotal: true
      };
      activeCart.items.unshift(newItem);
      
      // Select the newly added item (now at index 0)
      this.selectedReceiptItem = newItem;
      this.selectedReceiptItemIndex = 0;
    }
    
    this.calculateTotals();
  }

  addProductToReceiptWithTotalPrice(product: Product, customTotalPrice: number): void {
    console.log('addProductToReceiptWithTotalPrice called:', product.name, 'total:', customTotalPrice);
    const activeCart = this.getActiveCart();
    if (!activeCart) return;
    
    const existingItem = activeCart.items.find(item => item.product.id === product.id);
    
    if (existingItem) {
      // Update existing item with new total price and calculate quantity
      existingItem.total = customTotalPrice;
      existingItem.quantity = customTotalPrice / Number(existingItem.unitPrice);
      existingItem.hasCustomTotal = true;
      
      // Select the existing item
      this.selectedReceiptItem = existingItem;
      this.selectedReceiptItemIndex = activeCart.items.indexOf(existingItem);
    } else {
      // Add new item with custom total price and calculate quantity
      const unitPrice = Number(product.prix_vente_TTC);
      const calculatedQuantity = customTotalPrice / unitPrice;
      
      const newItem = {
        product,
        quantity: calculatedQuantity,
        unitPrice: unitPrice,
        total: customTotalPrice,
        isGift: false,
        hasCustomTotal: true
      };
      activeCart.items.unshift(newItem);
      
      // Select the newly added item (now at index 0)
      this.selectedReceiptItem = newItem;
      this.selectedReceiptItemIndex = 0;
    }
    
    this.calculateTotals();
  }

  // Round to 50 millimes increments (0.050, 0.100, 0.150, etc.)
  roundToFiftyMillimes(value: number): number {
    return Math.round(value / 0.05) * 0.05;
  }

  closeProductModal(): void {
    this.showProductModal = false;
    this.selectedProduct = null;
    this.productModalQuantity = 1;
    this.productModalAmount = 0;
  }

  validateESP(): void {
    const activeCart = this.getActiveCart();
    if (!activeCart || activeCart.items.length === 0) {
      this.showAlertMessage('Aucun article dans le panier', 'error');
      return;
    }
    
    // Auto-submit the sale with ESP payment method and exact pricing
    this.paymentType = 'cash';
    this.amountPaid = activeCart.netTotal;
    this.confirmPayment();
  }

  getProductModalCalculatedAmount(): number {
    if (this.selectedProduct && this.productModalMode === 'quantity') {
      return this.productModalQuantity * Number(this.selectedProduct.prix_vente_TTC);
    }
    return this.productModalAmount;
  }

  getProductModalCalculatedQuantity(): number {
    if (this.selectedProduct && this.productModalMode === 'amount' && this.selectedProduct.prix_vente_TTC > 0) {
      return this.productModalAmount / Number(this.selectedProduct.prix_vente_TTC);
    }
    return this.productModalQuantity;
  }

  // Shop inventory methods
  loadShopInventory(): void {
    console.log('Loading shop inventory for depot ID:', this.currentShopDepotId);
    this.stockDocumentsService.getInventory(this.currentShopDepotId).subscribe({
      next: (inventory) => {
        this.shopInventory = inventory;
        console.log('Shop inventory loaded successfully:', inventory.length, 'items');
        console.log('First few items:', inventory.slice(0, 3));
      },
      error: (error) => {
        console.error('Error loading shop inventory:', error);
        this.showAlertMessage('Erreur lors du chargement de l\'inventaire du magasin', 'error');
      }
    });
  }

  getShopStock(productId: number): number {
    const inventoryItem = this.shopInventory.find(item => item.productId === productId);
    const stock = inventoryItem ? inventoryItem.quantity : 0;
    return stock;
  }

  getStockStatus(productId: number): 'sufficient' | 'low' | 'out' {
    const stock = this.getShopStock(productId);
    if (stock <= 0) return 'out';
    if (stock <= 5) return 'low';
    return 'sufficient';
  }

  getStockStatusColor(productId: number): string {
    const status = this.getStockStatus(productId);
    switch (status) {
      case 'out': return 'text-red-600';
      case 'low': return 'text-yellow-500';
      default: return 'text-green-500';
    }
  }

  getStockStatusText(productId: number): string {
    const status = this.getStockStatus(productId);
    switch (status) {
      case 'out': return '(x)';
      case 'low': return '(!)';
      default: return '(+)';
    }
  }

  moveItemToTop(item: any): void {
    const activeCart = this.getActiveCart();
    if (!activeCart) return;
    
    // Remove the item from its current position
    const index = activeCart.items.indexOf(item);
    if (index > -1) {
      activeCart.items.splice(index, 1);
      // Add it to the top (beginning of array)
      activeCart.items.unshift(item);
    }
  }

  onProductClick(event: MouseEvent, product: Product): void {
    
    const currentStock = this.getShopStock(product.id);
    const requestedQuantity = 1;
    
    console.log('Product clicked:', product.name, 'Current stock:', currentStock, 'Shop inventory loaded:', this.shopInventory.length);
    
    // Check if product already exists in receipt with custom price
    const activeCart = this.getActiveCart();
    if (!activeCart) return;
    
    const existingItem = activeCart.items.find(item => item.product.id === product.id);
    
    if (existingItem) {
      // Check if the existing item has a custom total price
      let hasCustomPrice = existingItem.hasCustomTotal === true;
      
      // If the flag is not set, try to detect custom price by checking if the total doesn't match expected calculation
      if (!hasCustomPrice) {
        const defaultPrice = Number(product.prix_vente_TTC);
        const expectedTotal = Math.round(existingItem.quantity * defaultPrice * 100) / 100;
        const totalMatches = Math.abs(existingItem.total - expectedTotal) <= 0.01;
        
        // If the total doesn't match the expected calculation, it's likely a custom price
        hasCustomPrice = !totalMatches;
        
        console.log('Custom price detection - default price:', defaultPrice, 'quantity:', existingItem.quantity, 'expected total:', expectedTotal, 'actual total:', existingItem.total, 'total matches:', totalMatches, 'hasCustomPrice:', hasCustomPrice);
        
        // Fix the flag if we detect a custom price
        if (hasCustomPrice) {
          existingItem.hasCustomTotal = true;
          console.log('Fixed hasCustomTotal flag to true for item:', product.name);
        }
      }
      
      console.log('Debug - hasCustomTotal value:', existingItem.hasCustomTotal, 'Type:', typeof existingItem.hasCustomTotal, 'hasCustomPrice:', hasCustomPrice);
      
      console.log('Existing item found:', {
        productName: product.name,
        existingQuantity: existingItem.quantity,
        existingTotal: existingItem.total,
        hasCustomTotal: existingItem.hasCustomTotal,
        hasCustomPrice: hasCustomPrice
      });
      
      if (hasCustomPrice) {
        // Product exists with custom price - move to top, select it, and inform user
        this.moveItemToTop(existingItem);
        const index = this.receiptItems.indexOf(existingItem);
        this.selectedReceiptItem = existingItem;
        this.selectedReceiptItemIndex = index;
        this.pendingProduct = product;
        this.inputMode = 'price'; // Set to price mode for editing
        this.currentInput = '';
        
        this.showAlertMessage(
          `${product.name} sélectionné (Prix personnalisé: ${existingItem.total.toFixed(3)}dt)`, 
          'info'
        );
        console.log('Custom price detected - returning early');
        return;
      }
    }
    
    // Check if adding this product would result in negative stock
    if (currentStock < requestedQuantity && !product.name.toLowerCase().includes('vrac')) {
      console.log('Showing stock warning for product:', product.name);
      this.showStockWarning(product, requestedQuantity, currentStock);
      return;
    }
    
    console.log('Current inputMode:', this.inputMode);
    
    if (this.inputMode === 'quantity') {
      // In quantity mode: automatically add +1, but allow custom quantity input
      console.log('Adding product in quantity mode');
      this.addProductToReceiptWithQuantity(product, 1);
      this.pendingProduct = product;
      this.currentInput = ''; // Don't show "1" in input
    } else if (this.inputMode === 'price') {
      // In price mode: set pending product for price input (PU)
      console.log('Setting product for price mode');
      this.pendingProduct = product;
      this.currentInput = '';
    }
  }

  showStockWarning(product: Product, quantity: number, currentStock: number): void {
    console.log('showStockWarning called:', product.name, quantity, currentStock);
    
    // First close any existing modals that might interfere
    this.showProductModal = false;
    this.showDiscountPopup = false;
    this.showPaymentPopup = false;
    this.showClientSearchPopup = false;
    
    // Set stock warning modal properties
    this.stockWarningProduct = product;
    this.stockWarningQuantity = quantity;
    this.stockWarningCurrentStock = currentStock;
    this.showStockWarningModal = true;
    
    console.log('showStockWarningModal set to:', this.showStockWarningModal);
    console.log('stockWarningProduct set to:', this.stockWarningProduct?.name);
    
    // Force Angular change detection
    setTimeout(() => {
      console.log('After timeout - Modal state check...');
      console.log('showStockWarningModal:', this.showStockWarningModal);
      console.log('stockWarningProduct:', this.stockWarningProduct?.name);
    }, 50);
  }

  closeStockWarning(): void {
    this.showStockWarningModal = false;
    this.stockWarningProduct = null;
    this.stockWarningQuantity = 0;
    this.stockWarningCurrentStock = 0;
  }

  proceedWithNegativeStock(): void {
    if (this.stockWarningProduct) {
      this.selectedProduct = this.stockWarningProduct;
      this.showProductModal = true;
      this.productModalMode = 'quantity';
      this.productModalQuantity = this.stockWarningQuantity;
      this.productModalAmount = 0;
      this.productModalCalculatedQuantity = 0;
      this.productModalCalculatedAmount = 0;
    }
    this.closeStockWarning();
  }

  confirmProductModal(): void {
    if (this.selectedProduct && this.productModalQuantity > 0) {
      const currentStock = this.getShopStock(this.selectedProduct.id);
      
      // Check if adding this quantity would result in negative stock
      if (currentStock < this.productModalQuantity) {
        this.showStockWarning(this.selectedProduct, this.productModalQuantity, currentStock);
        this.closeProductModal();
        return;
      }
      
      this.addProductToReceiptWithQuantity(this.selectedProduct, this.productModalQuantity);
      this.closeProductModal();
    }
  }

  // Temporary test method
  testStockWarning(): void {
    const testProduct = this.allProducts[0];
    if (testProduct) {
      this.showStockWarning(testProduct, 1, 0);
    }
  }

  // Print last validated sale
  printLastSale(): void {
    if (!this.lastValidatedSale) {
      this.showAlertMessage('Aucune vente validée récente à imprimer', 'error');
      return;
    }

    if (this.lastValidatedSale.invoiceMode) {
      this.printLastInvoice();
    } else {
      this.printLastReceipt();
    }
  }

  // Print last receipt
  printLastReceipt(): void {
    const data = this.generateLastReceiptData();
    this.generateThermalReceipt(data);
    this.showAlertMessage('Reçu imprimé avec succès!', 'success');
  }

  // Print last invoice
  printLastInvoice(): void {
    const now = new Date();
    const lines = this.lastValidatedSale.receiptItems.map((item: any) => `
      <tr>
        <td style="padding:6px;border:1px solid #ddd;">${this.truncate(item.product.name, 40)}</td>
        <td style="padding:6px;border:1px solid #ddd;text-align:center;">${item.quantity}</td>
        <td style="padding:6px;border:1px solid #ddd;text-align:right;">${Number(item.unitPrice).toFixed(3)}</td>
        <td style="padding:6px;border:1px solid #ddd;text-align:right;">${Number(item.total).toFixed(3)}</td>
      </tr>
    `).join('');

    const customer = this.lastValidatedSale.selectedClient ? 
      `${this.lastValidatedSale.selectedClient.firstName} ${this.lastValidatedSale.selectedClient.lastName}` : 'PASSAGER';

    const html = `
      <html>
      <head>
        <meta charset="utf-8" />
        <title>Facture</title>
        <style>
          body { font-family: Arial, sans-serif; color:#111; }
          .container { width: 800px; margin: 0 auto; }
          .header { display:flex; justify-content:space-between; align-items:flex-start; }
          .title { font-size: 22px; font-weight: 700; }
          .muted { color:#666; font-size:12px; }
          table { width:100%; border-collapse: collapse; margin-top: 16px; }
          .totals { width: 300px; margin-left:auto; margin-top:12px; }
          .totals td { padding:6px; }
          .right { text-align:right; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div>
              <div class="title">Facture</div>
              <div class="muted">Date: ${now.toLocaleDateString('fr-FR')} ${now.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}</div>
              <div class="muted">Client: ${customer}</div>
            </div>
            <div style="text-align:right">
              <div style="font-weight:700">${'PÂTISSERIE DELICE'}</div>
              <div class="muted">123 Rue des Gourmandises</div>
              <div class="muted">Tunis, Tunisie</div>
              <div class="muted">Tél: +216 XX XXX XXX</div>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th style="padding:6px;border:1px solid #ddd;text-align:left">Article</th>
                <th style="padding:6px;border:1px solid #ddd;text-align:center">Qté</th>
                <th style="padding:6px;border:1px solid #ddd;text-align:right">P.U.</th>
                <th style="padding:6px;border:1px solid #ddd;text-align:right">Total</th>
              </tr>
            </thead>
            <tbody>
              ${lines}
            </tbody>
          </table>
          <table class="totals">
            <tr><td>Sous-total:</td><td class="right">${Number(this.lastValidatedSale.subtotal).toFixed(3)} dt</td></tr>
            ${Number(this.lastValidatedSale.discount) > 0 ? `<tr><td>Remise:</td><td class="right">-${Number(this.lastValidatedSale.discount).toFixed(3)} dt</td></tr>` : ''}
            <tr><td style="font-weight:700">TOTAL:</td><td class="right" style="font-weight:700">${Number(this.lastValidatedSale.netTotal).toFixed(3)} dt</td></tr>
            <tr><td>Paiement:</td><td class="right">${this.lastValidatedSale.paymentType?.toUpperCase() || ''}</td></tr>
            ${this.lastValidatedSale.selectedClient && this.lastValidatedSale.amountPaid !== undefined && Number(this.lastValidatedSale.amountPaid) < Number(this.lastValidatedSale.netTotal) ? `<tr><td>Crédit client:</td><td class="right">${(Number(this.lastValidatedSale.netTotal)-Number(this.lastValidatedSale.amountPaid)).toFixed(3)} dt</td></tr>` : ''}
          </table>
        </div>
        <script>window.onload = function(){ window.print(); setTimeout(()=>window.close(), 400); };</script>
      </body>
      </html>
    `;

    const w = window.open('', '_blank');
    if (w) {
      w.document.open();
      w.document.write(html);
      w.document.close();
    }
  }

  // Generate receipt data for last sale
  generateLastReceiptData(): any {
    const now = new Date();
    return {
      storeName: 'PÂTISSERIE DELICE',
      address: '123 Rue des Gourmandises',
      city: 'Tunis, Tunisie',
      phone: 'Tél: +216 XX XXX XXX',
      date: now.toLocaleDateString('fr-FR'),
      time: now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      items: this.lastValidatedSale.receiptItems,
      subtotal: this.lastValidatedSale.subtotal,
      discount: this.lastValidatedSale.discount,
      netTotal: this.lastValidatedSale.netTotal,
      paymentType: this.lastValidatedSale.paymentType,
      amountPaid: this.lastValidatedSale.amountPaid,
      change: this.lastValidatedSale.calculatedChange,
      clientName: this.lastValidatedSale.selectedClient ? 
        `${this.lastValidatedSale.selectedClient.firstName} ${this.lastValidatedSale.selectedClient.lastName}` : null,
      loyaltyEarned: this.lastValidatedSale.loyaltyEarned
    };
  }

  // Select receipt item for modification
  selectReceiptItem(item: ReceiptItem, index: number): void {
    this.selectedReceiptItem = item;
    this.selectedReceiptItemIndex = index;
    this.pendingProduct = item.product;
    this.inputMode = 'quantity';
    // this.showAlertMessage(`Article sélectionné: ${item.product.name}`, 'info');
  }

  // Modify selected item quantity
  modifySelectedItemQuantity(delta: number): void {
    if (!this.selectedReceiptItem || this.selectedReceiptItemIndex === -1) {
      this.showAlertMessage('Aucun article sélectionné', 'error');
      return;
    }

    const activeCart = this.getActiveCart();
    if (!activeCart) return;

    const newQuantity = this.selectedReceiptItem.quantity + delta;
    
    if (newQuantity <= 0) {
      // Remove item if quantity becomes 0 or negative
      activeCart.items.splice(this.selectedReceiptItemIndex, 1);
      this.selectedReceiptItem = null;
      this.selectedReceiptItemIndex = -1;
      this.pendingProduct = null;
      this.currentInput = '';
      // this.showAlertMessage('Article supprimé', 'info');
    } else {
      // Update quantity
      this.selectedReceiptItem.quantity = newQuantity;
      this.selectedReceiptItem.total = Number(this.selectedReceiptItem.quantity) * Number(this.selectedReceiptItem.unitPrice);
      this.currentInput = newQuantity.toString();
      // this.showAlertMessage(`Quantité mise à jour: ${newQuantity}`, 'info');
    }
    
    this.calculateTotals();
  }

  // Ticket number management methods
  getCurrentTicketNumber(): string {
    return this.currentTicketNumber.toString().padStart(4, '0');
  }

  getCurrentDate(): string {
    return new Date().toLocaleDateString('fr-FR');
  }

  getCurrentTime(): string {
    return new Date().toLocaleTimeString('fr-FR', { 
      hour: '2-digit', 
      minute: '2-digit',
    });
  }

  getCurrentVendor(): string {
    return 'Vendeur'; // You can replace this with actual vendor logic
  }

  getCurrentCashier(): string {
    return this.currentCashier;
  }

  incrementTicketNumber(): void {
    const today = new Date().toDateString();
    
    // Check if it's a new day
    if (this.lastTicketDate !== today) {
      this.currentTicketNumber = 1;
      this.lastTicketDate = today;
    } else {
      this.currentTicketNumber++;
    }
    
    // Save to localStorage for persistence
    this.saveTicketState();
  }

  resetTicketNumber(): void {
    this.currentTicketNumber = 1;
    this.lastTicketDate = new Date().toDateString();
    this.saveTicketState();
  }

  private saveTicketState(): void {
    const ticketState = {
      currentTicketNumber: this.currentTicketNumber,
      lastTicketDate: this.lastTicketDate,
      isShiftOpen: this.isShiftOpen
    };
    localStorage.setItem('pos_ticket_state', JSON.stringify(ticketState));
  }

  private loadTicketState(): void {
    const savedState = localStorage.getItem('pos_ticket_state');
    if (savedState) {
      try {
        const ticketState = JSON.parse(savedState);
        const today = new Date().toDateString();
        
        // If it's a new day, reset ticket number
        if (ticketState.lastTicketDate !== today) {
          this.currentTicketNumber = 1;
          this.lastTicketDate = today;
        } else {
          this.currentTicketNumber = ticketState.currentTicketNumber || 1;
          this.lastTicketDate = ticketState.lastTicketDate || today;
        }
        
        this.isShiftOpen = ticketState.isShiftOpen !== false; // Default to true
      } catch (error) {
        console.error('Error loading ticket state:', error);
        this.initializeTicketState();
      }
    } else {
      this.initializeTicketState();
    }
  }

  private initializeTicketState(): void {
    this.currentTicketNumber = 1;
    this.lastTicketDate = new Date().toDateString();
    this.isShiftOpen = true;
    this.saveTicketState();
  }
} 