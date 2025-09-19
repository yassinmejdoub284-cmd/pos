import { Component, OnInit, OnDestroy, HostListener, ViewChild, ElementRef } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { ProductsService } from '../core/services/products.service';
import { SalesService, CreateSaleRequest } from '../core/services/sales.service';
import { ClientsService } from '../core/services/clients.service';
import { StockDocumentsService } from '../core/services/stock-documents.service';
import { ReportsService, ProductSalesData } from '../core/services/reports.service';
import { SettingsService } from '../core/services/settings.service';
import { SessionsService } from '../core/services/sessions.service';
import { DailyExtractService } from '../core/services/daily-extract.service';
import { PrintService } from '../core/services/print.service';
import { DragDropService } from '../core/services/drag-drop.service';
import { WholesaleRulesService, WholesaleRule } from '../core/services/wholesale-rules.service';
import { AuthService } from '../core/services/auth.service';
import { DepotsService } from '../core/services/depots.service';
import { ReturnsService } from '../core/services/returns.service';
import { Product } from '../core/models/product.model';
import { Sale } from '../core/models/sale.model';
import { Client } from '../core/models/client.model';
import { Subject, takeUntil } from 'rxjs';
import { environment } from '../../environments/environment';

interface ReceiptItem {
  product: Product;
  quantity: number;
  unitPrice: number;
  total: number;
  isGift: boolean;
  hasCustomTotal?: boolean;
  // Wholesale fields
  isWholesale?: boolean;
  bundleQuantity?: number;
  bundleSize?: number;
  bundlePrice?: number;
  marginPercent?: number;
  isApproved?: boolean;
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
  styleUrls: ['./caisse.component.css'],
  standalone: false
})
export class CaisseComponent implements OnInit, OnDestroy {
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

  // Ticket menu functionality
  showTicketMenu = false;
  todaysTickets: Sale[] = [];
  loadingTodaysTickets = false;

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
  currentShopDepotId: number = 0; // Will be set from user account
  currentShopName: string = ''; // Will be fetched from user's depot

  // Input handling
  currentInput: string = '';
  isTemporarySale: boolean = false;
  isWholesaleMode: boolean = false;
  pendingWholesaleToggle: boolean = false; // Track if we're waiting for client selection to enable wholesale
  
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
  
  // Payment type (Comptant/Crédit)
  salePaymentType: 'COMPTANT' | 'CREDIT' = 'COMPTANT';

  // Toggle payment type
  togglePaymentType(): void {
    this.salePaymentType = this.salePaymentType === 'COMPTANT' ? 'CREDIT' : 'COMPTANT';
    
    if (this.salePaymentType === 'CREDIT') {
      // For credit sales, we need a client
      if (!this.selectedClient) {
        this.showAlertMessage('Un client est requis pour les ventes à crédit', 'warning');
        this.salePaymentType = 'COMPTANT'; // Revert back
        return;
      }
      this.showAlertMessage('Mode Crédit activé - Le client devra payer plus tard', 'info');
    } else {
      this.showAlertMessage('Mode Comptant activé - Paiement immédiat', 'info');
    }
  }

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

  // Drag and Drop
  private destroy$ = new Subject<void>();
  isDragMode = false;
  dragGhostPosition: { x: number; y: number } | null = null;
  draggedProduct: Product | null = null;
  currentTouchProduct: Product | null = null;
  currentTouchStartPosition: { x: number; y: number } | null = null;
  dragDetectionStarted: boolean = false;

  @ViewChild('productGrid') productGrid!: ElementRef;

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
      label: 'Demander facture',
      icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586l6.414 6.414V19a2 2 0 01-2 2z',
      color: '#666683', // Blue-600: professional
      action: () => this.showInvoiceMenu()
    },
    {
      id: 'client',
      label: 'Client',
      icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
      color: '#8483ff', // Purple-600: identity/people
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
      id: 'wholesale',
      label: 'Gros',
      icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
      color: '#ff80b0', // Violet-500: wholesale
      action: () => this.toggleWholesaleMode()
    }
    // {
    //   id: 'validate',
    //   label: 'Régler',
    //   icon: 'M4 6h16M4 10h16M4 14h10', // credit card
    //   color: '#10b981', // Green-500: confirm/positive
    //   action: () => this.validateSale()
    // }
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
      color: '#fdc54e', // Yellow-500: discount
      action: () => this.openRemisePaymentPopup()
    }
  ];

  // Credit button that appears when client is selected
  creditButton = {
    id: 'credit',
    label: 'Créditer',
    icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1', // credit card icon
    color: '#f59e0b', // Amber-500: credit
    action: () => this.validateCredit()
  };

  constructor(
    private router: Router,
    private http: HttpClient,
    private productsService: ProductsService,
    private salesService: SalesService,
    private clientsService: ClientsService,
    private stockDocumentsService: StockDocumentsService,
    private reportsService: ReportsService,
    private settingsService: SettingsService,
    private sessionsService: SessionsService,
    private dailyExtractService: DailyExtractService,
    private printService: PrintService,
    private dragDropService: DragDropService,
    private wholesaleRulesService: WholesaleRulesService,
    private authService: AuthService,
    private depotsService: DepotsService,
    private returnsService: ReturnsService
  ) {}

  ngOnInit(): void {
    // Ensure user is logged in (do not override role)
    
    // Set depot ID from user account
    this.currentShopDepotId = this.authService.currentUser()?.depotId || 0;
    
    this.loadTicketState(); // Initialize ticket number system
    this.initializeMultiClientSystem();
    this.loadProducts();
    this.loadPendingTemporarySalesCount();
    this.loadPendingGiftSalesCount();
    this.loadInvoiceRequests(); // Load existing invoice requests
    this.loadShopInventory();
    this.loadShopName();
    this.loadSettings();
    
    this.loadCurrentSession();
    this.initializeDragDrop();
    this.setupTouchEventListeners();
    this.loadWholesaleRules();
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
      this.isWholesaleMode = false;
    }
    
    // Auto-remove the client if it's not Client 1
    if (cartId !== 1) {
      this.removeClientDirectly(cartId);
      this.showAlertMessage(`${cart.clientName} supprimé (panier vidé)`, 'info');
    } else {
      // For Client 1, also clear the customer selection
      this.clearClientSelection();
      this.showAlertMessage(`Panier de ${cart.clientName} vidé`, 'info');
    }
  }

  getCartItemCount(cartId: number): number {
    const cart = this.getCartById(cartId);
    return cart ? cart.items.length : 0;
  }

  clearReceipt(): void {
    this.clearCart(this.activeCartId);
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
    const baseClass = 'relative px-2 py-1 rounded border transition-all duration-200 hover:scale-95 min-w-0 flex-shrink-0';
    
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
      cart.client = undefined;
      cart.clientId = undefined;
      cart.clientName = `Client ${cartId}`;
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
        // Sort products by displayIndex (null values go to end)
        this.allProducts = products.sort((a, b) => {
          if ((a.displayIndex === null || a.displayIndex === undefined) && (b.displayIndex === null || b.displayIndex === undefined)) return 0;
          if (a.displayIndex === null || a.displayIndex === undefined) return 1;
          if (b.displayIndex === null || b.displayIndex === undefined) return -1;
          return a.displayIndex! - b.displayIndex!;
        });
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

    // Keep original products order as fetched; no reordering by sales/date
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
    
    // If wholesale mode is enabled, show only wholesale-capable products (fradeau/bundle)
    if (this.isWholesaleMode) {
      filtered = filtered.filter(p => p.isWholesale && Number(p.bundleSize) > 0 && Number(p.bundlePrice) > 0);
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

  @HostListener('keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      if (this.isDragMode) {
        this.dragDropService.cancelDrag();
      } else if (this.showPaymentConfirmationDialog) {
        this.cancelClientPaymentConfirmation();
      } else if (this.showClientSearchPopup) {
        this.closeClientSearch();
      }
    } else if (event.key === 'ArrowLeft') {
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
    
    // Check if product supports wholesale and we're in wholesale mode
    if (this.isWholesaleMode && product.isWholesale && product.bundleSize && product.bundlePrice) {
      this.addWholesaleProductToReceipt(product);
      return;
    }
    
    const existingItem = activeCart.items.find(item => item.product.id === product.id && !item.isWholesale);
    
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
      const isWholesaleContext = this.isWholesaleMode || this.selectedClient?.clientType === 'WHOLESALE';
      const newItem = {
        product,
        quantity: isWholesaleContext && product.isWholesale && product.bundleSize ? product.bundleSize : 1,
        unitPrice: this.getEffectiveUnitPrice(product),
        total: this.getEffectiveUnitPrice(product),
        isGift: false,
        isWholesale: isWholesaleContext && product.isWholesale,
        bundleQuantity: isWholesaleContext && product.isWholesale ? 1 : undefined,
        bundleSize: isWholesaleContext && product.isWholesale ? product.bundleSize : undefined,
        bundlePrice: isWholesaleContext && product.isWholesale ? product.bundlePrice : undefined
      };
      if ((this.isWholesaleMode || this.selectedClient?.clientType === 'WHOLESALE') && product.bundleSize) {
        (newItem as any).displayName = `${product.name} (fradeau x${product.bundleSize})`;
      }
      activeCart.items.unshift(newItem as any);
      this.selectedReceiptItem = newItem as any;
      this.selectedReceiptItemIndex = 0;
    }
    this.calculateTotals();
  }

  addWholesaleProductToReceipt(product: Product, bundleCount: number = 1): void {
    const activeCart = this.getActiveCart();
    if (!activeCart) return;
    
    const existingItem = activeCart.items.find(item => item.product.id === product.id && item.isWholesale);
    
    if (existingItem) {
      existingItem.bundleQuantity = (existingItem.bundleQuantity || 0) + Number(bundleCount || 0);
      existingItem.quantity = existingItem.bundleQuantity * (product.bundleSize || 1);
      existingItem.total = Number(existingItem.bundleQuantity) * Number(product.bundlePrice);
      // Ensure designation shows fradeau info
      const label = `${product.name} (fradeau x${product.bundleSize || 1})`;
      (existingItem as any).displayName = label;
      (existingItem as any).productName = label;
      
      // Select the existing item
      this.selectedReceiptItem = existingItem;
      this.selectedReceiptItemIndex = activeCart.items.indexOf(existingItem);
    } else {
      const newItem = {
        product,
        quantity: (product.bundleSize || 1) * Number(bundleCount || 1),
        unitPrice: Number(product.bundlePrice),
        total: Number(product.bundlePrice) * Number(bundleCount || 1),
        isGift: false,
        isWholesale: true,
        bundleQuantity: Number(bundleCount || 1),
        bundleSize: product.bundleSize,
        bundlePrice: product.bundlePrice,
        isApproved: false
      };
      const label = `${product.name} (fradeau x${product.bundleSize || 1})`;
      (newItem as any).displayName = label;
      (newItem as any).productName = label;
      activeCart.items.unshift(newItem);
      
      // Select the newly added item at the top
      this.selectedReceiptItem = newItem;
      this.selectedReceiptItemIndex = 0;
    }
    
    this.calculateTotals();
  }

  openProductDialog(product: Product, event: MouseEvent): void {
    event.preventDefault();
    // TODO: Implement product dialog for quantity/discount
  }

  toggleWholesaleMode(): void {
    // If trying to enable wholesale mode, check if client is selected
    if (!this.isWholesaleMode) {
      if (!this.selectedClient) {
        // No client selected, open client dialog first
        this.pendingWholesaleToggle = true;
        this.openClientSearch();
        return;
      }
    }
    
    // Toggle wholesale mode
    this.isWholesaleMode = !this.isWholesaleMode;
    this.pendingWholesaleToggle = false;
    // Clear current cart when switching modes
    this.clearReceipt();
    // Refresh product listing to reflect mode change (show all when off)
    this.filterProducts();
  }

  isWholesaleSale(): boolean {
    const activeCart = this.getActiveCart();
    if (!activeCart) return false;
    
    // Check if we're in wholesale mode or have a wholesale client
    if (this.isWholesaleMode || this.selectedClient?.clientType === 'WHOLESALE') {
      return true;
    }
    
    // Fallback: check if any items are marked as wholesale
    return activeCart.items.some(item => item.isWholesale);
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

  // Payment confirmation dialog
  showPaymentConfirmationDialog = false;
  pendingPaymentClient: Client | null = null;
  pendingPaymentAmount: number = 0;
  pendingPaymentNotes: string = '';

  // Quick add client functionality
  showQuickAddClientPopup = false;
  quickAddForm = {
    firstName: '',
    lastName: '',
    phone: '',
    city: 'Tunis',
    clientType: 'INDIVIDUAL' as 'INDIVIDUAL' | 'BUSINESS' | 'WHOLESALE',
    allowDebt: true
  };

  // Invoice request functionality
  showInvoiceRequestModal = false;
  selectedSaleForInvoice: any = null;
  submittingInvoiceRequest = false;
  invoiceRequestData = {
    notes: ''
  };
  invoiceRequests: any[] = [];
  
  // Pending invoice request state (for cart-based requests to be created after sale)
  private isInvoiceRequestPending: boolean = false;
  private pendingInvoiceRequestNotes: string = '';
  
  // Invoice menu functionality
  showInvoiceMenuModal = false;
  approvedInvoices: any[] = [];
  unprintedInvoicesCount = 0;
  
  // Approved invoices modal
  showApprovedInvoicesModal = false;
  currentDate = new Date();

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

  closeClientSearch(): void {
    this.showClientSearchPopup = false;
    // If we were waiting for client selection to enable wholesale mode, cancel it
    if (this.pendingWholesaleToggle) {
      this.pendingWholesaleToggle = false;
      this.showAlertMessage('Sélection de client annulée - Mode Gros non activé', 'info');
    }
  }

  fetchAllClients(): void {
    this.searchingClients = true;
    // Load first 200 active clients for quick local filtering
    this.clientsService.getClients(1, 200, undefined, '', true).subscribe({
      next: (response: any) => {
        // Filter clients to only show those assigned to shops or with "any" access
        // This ensures caisse only shows customers who can make purchases at shops
        const allClients = response.clients || [];
        this.allClientsCache = allClients.filter((client: any) => {
          // Include clients with "any" access (depotId = -1) - can shop anywhere
          if (client.depotId === -1) {
            return true;
          }
          // Include clients assigned to shops (depot.type = 'SHOP') - can shop at their assigned shop
          if (client.depot && client.depot.type === 'SHOP') {
            return true;
          }
          // Exclude all other clients:
          // - Invoicing-only clients (depotId = null)
          // - Warehouse clients (depot.type = 'WAREHOUSE', 'MAIN', 'BRANCH')
          return false;
        });
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
    
    // If we were waiting for client selection to enable wholesale mode, do it now
    if (this.pendingWholesaleToggle) {
      this.isWholesaleMode = true;
      this.pendingWholesaleToggle = false;
      this.showAlertMessage(`Client sélectionné: ${client.firstName} ${client.lastName} - Mode Gros activé`, 'success');
    } else {
      // Set wholesale mode according to client type (without clearing cart)
      this.isWholesaleMode = client.clientType === 'WHOLESALE';
      this.showAlertMessage(`Client sélectionné: ${client.firstName} ${client.lastName}` + (this.isWholesaleMode ? ' - Mode Gros activé' : ''), 'success');
    }
    
    this.showClientSearchPopup = false;
    // Refresh product list according to mode
    this.filterProducts();
  }

  clearSelectedClient(): void {
    this.clearClientSelection();
    
    // If in wholesale mode, disable it when client is cleared
    if (this.isWholesaleMode) {
      this.isWholesaleMode = false;
      this.showAlertMessage('Client effacé - Mode Gros désactivé', 'info');
    }
  }

  private clearClientSelection(): void {
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

  // Quick add client methods
  openQuickAddClient(): void {
    this.quickAddForm = {
      firstName: '',
      lastName: '',
      phone: '',
      city: 'Tunis',
      clientType: 'INDIVIDUAL',
      allowDebt: true
    };
    this.showQuickAddClientPopup = true;
  }

  closeQuickAddClient(): void {
    this.showQuickAddClientPopup = false;
  }

  createQuickClient(): void {
    if (!this.quickAddForm.firstName || !this.quickAddForm.lastName) {
      this.showAlertMessage('Le prénom et le nom sont obligatoires', 'error');
      return;
    }

    const createRequest = {
      firstName: this.quickAddForm.firstName,
      lastName: this.quickAddForm.lastName,
      phone: this.quickAddForm.phone || '',
      city: this.quickAddForm.city,
      address: '',
      clientType: this.quickAddForm.clientType,
      notes: '',
      allowDebt: this.quickAddForm.allowDebt,
      maxDebt: null
    };

    this.clientsService.createClient(createRequest).subscribe({
      next: (newClient) => {
        this.showAlertMessage(`Client ${newClient.firstName} ${newClient.lastName} créé avec succès`, 'success');
        this.closeQuickAddClient();
        
        // Refresh the client cache and search results
        this.allClientsCache = [];
        this.fetchAllClients();
        
        // Auto-select the newly created client
        setTimeout(() => {
          this.selectClient(newClient);
        }, 500);
      },
      error: (error) => {
        this.showAlertMessage('Erreur lors de la création du client', 'error');
        console.error('Error creating client:', error);
      }
    });
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
    
    // For credit sales, we need a client
    if (this.salePaymentType === 'CREDIT' && !this.selectedClient) {
      this.showAlertMessage('Un client est requis pour les ventes à crédit', 'error');
      return;
    }
    
    this.showPaymentPopup = true;
    this.paymentType = undefined;
    this.amountPaid = undefined;
    this.calculatedChange = 0;
  }

  private getClientRemainingCredit(): number {
    const client = this.selectedClient;
    if (!client) return 0;
    const maxDebt = Number(client.maxDebt ?? 0);
    const currentDebt = Number(client.currentDebt ?? 0);
    const remaining = maxDebt - currentDebt;
    return remaining > 0 ? this.roundToTenthAsThreeDecimals(remaining) : 0;
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
    
    if (this.salePaymentType === 'CREDIT') {
      if (!this.selectedClient) {
        this.showAlertMessage('Un client est requis pour les ventes à crédit', 'error');
        return;
      }
      if (this.selectedClient.allowDebt === false) {
        this.showAlertMessage('Ce client n\'est pas autorisé à faire du crédit', 'error');
        return;
      }
      const remainingCredit = this.getClientRemainingCredit();
      const outstanding = this.roundToTenthAsThreeDecimals(Number(activeCart.netTotal) - Number(this.amountPaid || 0));
      if (outstanding > remainingCredit) {
        this.showAlertMessage(`Crédit dépassé. Reste autorisé: ${remainingCredit.toFixed(3)} dt`, 'error');
        return;
      }
    }

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
    this.isWholesaleMode = false;
    this.filterProducts();
    this.processPayment(true);
  }

  // Process payment without receipt printing
  processPaymentWithoutReceipt(): void {
    this.showPaymentConfirmation = false;
    this.isWholesaleMode = false;
    this.filterProducts();
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
    
    // For credit sales, preserve any entered advance payment and method
    // so they are recorded as advancePayment instead of clearing them.
    
    const saleData: CreateSaleRequest = {
      items: activeCart.items.map(item => ({
        productId: item.product.id,
        productName: item.product.name,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        total: Number(item.total),
        discount: 0,
        // Wholesale fields
        isWholesale: item.isWholesale || false,
        bundleQuantity: item.bundleQuantity || undefined,
        bundleSize: item.bundleSize || undefined,
        bundlePrice: item.bundlePrice || undefined,
        // Advance payment fields for credit
        advancePayment: this.salePaymentType === 'CREDIT' ? (Number(this.amountPaid || 0)) : undefined,
        advancePaymentMethod: this.salePaymentType === 'CREDIT' ? this.paymentType as any : undefined
      })),
      total: Number(activeCart.subtotal),
      discount: Number(activeCart.discount),
      finalTotal: Number(activeCart.netTotal),
      paymentMethodId: this.salePaymentType === 'CREDIT'
        ? (this.amountPaid ? paymentMethodMap[this.paymentType!] : undefined as any)
        : (paymentMethodMap[this.paymentType!] || 1),
      clientId: activeCart.clientId || undefined,
      amountPaid: this.amountPaid !== undefined ? Number(this.amountPaid) : Number(activeCart.netTotal),
      isWholesale: this.isWholesaleSale(),
      paymentType: this.salePaymentType
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
        
        // Refresh clients list to update debt information
        this.fetchAllClients();
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

        // If an invoice request from cart was pending, create it now from the saved sale
        this.maybeCreateInvoiceForSale(savedSale?.id);
      },
      error: (error) => {
        this.showAlertMessage(error?.error?.error || 'Erreur lors de la sauvegarde de la vente. Veuillez réessayer.', 'error');
      }
    });
  }

  private maybeCreateInvoiceForSale(saleId?: number): void {
    if (!this.isInvoiceRequestPending || !saleId) {
      return;
    }

    const requestData = {
      saleId: saleId,
      requestNotes: this.pendingInvoiceRequestNotes
    };

    this.http.post(`${environment.apiUrl}/invoices/request-from-ticket`, requestData).subscribe({
      next: () => {
        this.showAlertMessage('Demande de facture envoyée avec succès!', 'success');
      },
      error: (error) => {
        console.error('Error requesting invoice after sale:', error);
        this.showAlertMessage('Erreur lors de l\'envoi de la demande de facture', 'error');
      },
      complete: () => {
        this.isInvoiceRequestPending = false;
        this.pendingInvoiceRequestNotes = '';
      }
    });
  }

  printReceiptWithClient(loyaltyEarned: number): void {
    const sale = this.buildSaleForPrinting();
    if (sale && this.selectedClient) {
      sale.client = {
        firstName: this.selectedClient.firstName,
        lastName: this.selectedClient.lastName,
        code: this.selectedClient.code || ''
      };
    }
    this.printService.printSaleReceipt(sale);
    this.showAlertMessage('Reçu imprimé avec succès!', 'success');
  }

  printReceipt(): void {
    // Use unified receipt printing (same as Historique)
    const sale = this.buildSaleForPrinting();
    this.printService.printSaleReceipt(sale);
    this.showAlertMessage('Reçu imprimé avec succès!', 'success');
  }

  // Legacy thermal helpers below remain for other layouts, but are no longer used for sale printing

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
    this.selectedClient = null;
    this.selectedClientId = null;
    this.currentCustomer = 'PASSAGER';
    this.invoiceMode = false;
    this.isWholesaleMode = false;
    this.currentInput = '';
    this.pendingProduct = null;
    this.lastEnteredValue = '';
    this.inputMode = 'quantity';
  }

  openSettings(): void {
    // TODO: Implement settings functionality
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
    if (!this.paymentType || 
        (this.paymentType === 'cash' && (!this.amountPaid || this.calculatedChange < 0)) ||
        (this.paymentType === 'check' && (!this.chequeId.trim() || !this.encaissementDate)) ||
        (this.paymentType === 'virement' && !this.virementNumber.trim())) {
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
        if (!session) {
          this.autoOpenSession();
        }
      },
      error: (error) => {
        console.error('Error loading current session:', error);
        this.autoOpenSession();
      }
    });
  }

  autoOpenSession(): void {
    const defaultSession = {
      openingFund: 0,
      posId: 1,
      note: 'Session automatique'
    };
    this.sessionsService.openSession(defaultSession).subscribe({
      next: (session) => {
        this.currentSession = session;
        this.isShiftOpen = true;
      },
      error: (error) => {
        console.error('Erreur lors de l\'ouverture automatique de la session:', error);
        this.showAlertMessage('Impossible d\'ouvrir la session de caisse', 'error');
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
    this.router.navigate(['/stock/produits']);
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
    if (this.inputMode === 'quantity') {
      this.inputMode = 'price';
    } else {
      this.inputMode = 'quantity';
    }
    this.currentInput = '';
  }

  addDecimal(): void {
    // Add . as per requirement
    this.currentInput += '.';
  }

  enterValue(): void {
    
    // Priority 1: If a receipt item is selected, modify its quantity
    if (this.selectedReceiptItem && this.selectedReceiptItemIndex !== -1) {
      const quantity = parseFloat(this.currentInput);
      
      if (!isNaN(quantity) && quantity > 0) {
        // Update the quantity of the selected item
        if (this.selectedReceiptItem.isWholesale && this.selectedReceiptItem.bundleSize) {
          // For wholesale items, update bundle quantity
          this.selectedReceiptItem.bundleQuantity = quantity;
          this.selectedReceiptItem.quantity = quantity * this.selectedReceiptItem.bundleSize;
          this.selectedReceiptItem.total = quantity * (this.selectedReceiptItem.bundlePrice || 0);
        } else {
          // For regular items, update quantity directly
          this.selectedReceiptItem.quantity = quantity;
          this.selectedReceiptItem.total = quantity * this.selectedReceiptItem.unitPrice;
        }
        
        this.calculateTotals();
        this.currentInput = '';
        return;
      }
    }
    
    // Priority 2: Check if we have a selected client and no pending product/receipt item
    // This means the user wants to make a client payment
    // BUT only if cart has 1 or fewer items, otherwise treat as quantity for last product
    const activeCart = this.getActiveCart();
    const hasMultipleItems = activeCart && activeCart.items.length > 1;
    
    if (this.selectedClient && !this.selectedReceiptItem && !this.pendingProduct && this.currentInput.trim() && !hasMultipleItems) {
      const paymentAmount = parseFloat(this.currentInput);
      
      if (!isNaN(paymentAmount) && paymentAmount > 0) {
        this.processAutomaticClientPayment(paymentAmount);
        this.currentInput = '';
        return;
      }
    }
    
    // Priority 3: If cart has multiple items and no product is selected, modify the last product's quantity
    if (hasMultipleItems && !this.selectedReceiptItem && !this.pendingProduct && this.currentInput.trim()) {
      const lastItem = activeCart.items[activeCart.items.length - 1];
      const quantity = parseFloat(this.currentInput);
      
      if (!isNaN(quantity) && quantity > 0) {
        // Select the last item and modify its quantity
        this.selectedReceiptItem = lastItem;
        this.selectedReceiptItemIndex = activeCart.items.length - 1;
        
        // Update the quantity
        if (lastItem.isWholesale && lastItem.bundleSize) {
          // For wholesale items, update bundle quantity
          lastItem.bundleQuantity = quantity;
          lastItem.quantity = quantity * lastItem.bundleSize;
          lastItem.total = quantity * (lastItem.bundlePrice || 0);
        } else {
          // For regular items, update quantity directly
          lastItem.quantity = quantity;
          lastItem.total = quantity * lastItem.unitPrice;
        }
        
        this.calculateTotals();
        this.currentInput = '';
        return;
      }
    }
    
    // Handle price mode for selected receipt item (if not handled above)
    if (this.selectedReceiptItem && this.selectedReceiptItemIndex !== -1 && this.inputMode === 'price') {
      let value = parseFloat(this.currentInput);
      
      if (isNaN(value) || value < 0.001) {
        this.showAlertMessage('Valeur invalide (minimum 0.001)', 'error');
        return;
      }
      
      // Update total price and calculate quantity based on unit price
      this.selectedReceiptItem.total = value;
      this.selectedReceiptItem.quantity = value / Number(this.selectedReceiptItem.unitPrice);
      this.selectedReceiptItem.hasCustomTotal = true; // Mark as custom price
      this.calculateTotals();
      
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
      this.inputMode = 'quantity';
    }

    this.inputMode = 'quantity';
  }

  // ⌫ button - backspace (delete one character)
  clearDisplay(): void {
    if (this.currentInput.length > 0) {
      this.currentInput = this.currentInput.slice(0, -1);
    }
  }

  // Process automatic client payment when client is selected and amount is entered
  processAutomaticClientPayment(amount: number): void {
    if (!this.selectedClient) {
      this.showAlertMessage('Aucun client sélectionné', 'error');
      return;
    }

    if (amount <= 0) {
      this.showAlertMessage('Le montant doit être supérieur à 0', 'error');
      return;
    }

    // Set up the payment confirmation dialog
    this.pendingPaymentClient = this.selectedClient;
    this.pendingPaymentAmount = amount;
    this.pendingPaymentNotes = `Encaissement automatique depuis la caisse - ${new Date().toLocaleString('fr-FR')}`;
    this.showPaymentConfirmationDialog = true;
  }

  // Submit client payment to the API
  submitClientPayment(amount: number, notes?: string): void {
    if (!this.selectedClient) return;

    const paymentData = {
      clientId: this.selectedClient.id,
      amount: amount,
      notes: notes || `Encaissement automatique depuis la caisse - ${new Date().toLocaleString('fr-FR')}`
    };

    this.http.post(`${environment.apiUrl}/client-payments`, paymentData).subscribe({
      next: (response) => {
        this.showAlertMessage(
          `Encaissement de ${new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'TND' }).format(amount)} enregistré avec succès pour ${this.selectedClient?.firstName} ${this.selectedClient?.lastName}`,
          'success'
        );
        
        // Refresh client data to update current debt
        this.refreshSelectedClientData();
      },
      error: (error) => {
        console.error('Error creating client payment:', error);
        this.showAlertMessage('Erreur lors de l\'enregistrement de l\'encaissement', 'error');
      }
    });
  }

  // Refresh selected client data to get updated debt information
  refreshSelectedClientData(): void {
    if (!this.selectedClient) return;

    this.clientsService.getClient(this.selectedClient.id).subscribe({
      next: (updatedClient) => {
        this.selectedClient = updatedClient;
        // Update the client in the active cart as well
        const activeCart = this.getActiveCart();
        if (activeCart && activeCart.clientId === updatedClient.id) {
          activeCart.client = updatedClient;
        }
      },
      error: (error) => {
        console.error('Error refreshing client data:', error);
      }
    });
  }

  // Payment confirmation dialog methods
  cancelClientPaymentConfirmation(): void {
    this.showPaymentConfirmationDialog = false;
    this.pendingPaymentClient = null;
    this.pendingPaymentAmount = 0;
    this.pendingPaymentNotes = '';
  }

  confirmPaymentConfirmation(): void {
    if (!this.pendingPaymentClient) return;

    this.showPaymentConfirmationDialog = false;
    this.submitClientPayment(this.pendingPaymentAmount, this.pendingPaymentNotes);
    
    // Clear pending data
    this.pendingPaymentClient = null;
    this.pendingPaymentAmount = 0;
    this.pendingPaymentNotes = '';
  }

  // Helper methods for the dialog
  getRemainingDebt(): number {
    if (!this.pendingPaymentClient) return 0;
    const currentDebt = this.pendingPaymentClient.currentDebt || 0;
    return Math.max(0, currentDebt - this.pendingPaymentAmount);
  }

  getRemainingDebtClass(): string {
    const remaining = this.getRemainingDebt();
    if (remaining === 0) return 'text-green-600';
    if (remaining < (this.pendingPaymentClient?.currentDebt || 0) * 0.5) return 'text-yellow-600';
    return 'text-red-600';
  }

  formatAmount(amount: number): string {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'TND'
    }).format(amount);
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
    const activeCart = this.getActiveCart();
    if (!activeCart) return;
    
    const isWholesaleContext = this.isWholesaleMode || this.selectedClient?.clientType === 'WHOLESALE';
    const existingItem = activeCart.items.find(item => item.product.id === product.id && item.isWholesale === (isWholesaleContext && product.isWholesale));
    if (existingItem) {
      if (isWholesaleContext && product.isWholesale && product.bundleSize) {
        // For wholesale items, update bundle quantity
        existingItem.bundleQuantity = (existingItem.bundleQuantity || 0) + Number(quantity);
        existingItem.quantity = existingItem.bundleQuantity * product.bundleSize;
        existingItem.total = existingItem.bundleQuantity * (product.bundlePrice || 0);
      } else {
        // For regular items, update quantity directly
        existingItem.quantity = Number(existingItem.quantity) + Number(quantity);
        const unit = this.getEffectiveUnitPrice(product);
        existingItem.unitPrice = unit;
        existingItem.total = Number(existingItem.quantity) * unit;
      }
      // Append fradeau info to designation if in wholesale context
      if (isWholesaleContext && product.bundleSize) {
        (existingItem as any).displayName = `${product.name} (fradeau x${product.bundleSize})`;
      }
      // Select the existing item
      this.selectedReceiptItem = existingItem;
      this.selectedReceiptItemIndex = activeCart.items.indexOf(existingItem);
    } else {
      const unitPrice = this.getEffectiveUnitPrice(product);
      const isWholesaleContext = this.isWholesaleMode || this.selectedClient?.clientType === 'WHOLESALE';
      const newItem = {
        product,
        quantity: isWholesaleContext && product.isWholesale && product.bundleSize ? Number(quantity) * product.bundleSize : Number(quantity),
        unitPrice: Number(unitPrice),
        total: Number(quantity) * Number(unitPrice),
        isGift: false,
        isWholesale: isWholesaleContext && product.isWholesale,
        bundleQuantity: isWholesaleContext && product.isWholesale ? Number(quantity) : undefined,
        bundleSize: isWholesaleContext && product.isWholesale ? product.bundleSize : undefined,
        bundlePrice: isWholesaleContext && product.isWholesale ? product.bundlePrice : undefined
      };
      // designation override
      if ((this.isWholesaleMode || this.selectedClient?.clientType === 'WHOLESALE') && product.bundleSize) {
        (newItem as any).displayName = `${product.name} (fradeau x${product.bundleSize})`;
      }
      activeCart.items.unshift(newItem as any);
      this.selectedReceiptItem = newItem as any;
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
    const originalPrice = this.getEffectiveUnitPrice(product);
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
    const activeCart = this.getActiveCart();
    if (!activeCart) return;
    
    const existingItem = activeCart.items.find(item => item.product.id === product.id && !item.isWholesale);
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
      const unitPrice = this.getEffectiveUnitPrice(product);
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

  validateCredit(): void {
    this.openCreditModal();
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
    if (!this.currentShopDepotId || this.currentShopDepotId === 0) {
      console.warn('No depot ID available for user, cannot load shop inventory');
      this.shopInventory = [];
      return;
    }

    this.stockDocumentsService.getInventory(this.currentShopDepotId).subscribe({
      next: (inventory) => {
        this.shopInventory = inventory;
      },
      error: (error) => {
        console.error('Error loading shop inventory:', error);
        this.showAlertMessage(`Erreur lors du chargement de l'inventaire du magasin`, 'error');
      }
    });
  }

  getShopStock(productId: number): number {
    const inventoryItem = this.shopInventory.find(item => item.productId === productId);
    return inventoryItem ? parseFloat(inventoryItem.quantity) : 0;
  }

  getRemainingStock(productId: number): number {
    const currentStock = this.getShopStock(productId);
    const activeCart = this.getActiveCart();
    
    if (!activeCart) return currentStock;
    
    // Calculate total quantity of this product in the current cart
    const cartQuantity = activeCart.items
      .filter(item => item.product.id === productId)
      .reduce((total, item) => total + item.quantity, 0);
    
    return currentStock - cartQuantity;
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

  handleProductClick(product: Product): void {
    // Check if shop inventory is loaded
    if (this.shopInventory.length === 0) {
      console.warn('Shop inventory not loaded yet, skipping stock check');
      // Still allow the click but without stock validation
      // For wholesale items, add 1 bundle, for regular items add 1 unit
      const quantityToAdd = (this.isWholesaleMode || this.selectedClient?.clientType === 'WHOLESALE') && product.isWholesale
        ? 1  // 1 bundle for wholesale
        : 1; // 1 unit for regular
      this.addProductToReceiptWithQuantity(product, quantityToAdd);
      return;
    }
    
    const currentStock = this.getShopStock(product.id);
    
    // For wholesale items, calculate the actual quantity needed (1 bundle * bundle size)
    const requestedQuantity = (this.isWholesaleMode || this.selectedClient?.clientType === 'WHOLESALE') && product.isWholesale && product.bundleSize
      ? 1 * product.bundleSize  // 1 bundle * bundle size
      : 1;  // Regular items: 1 unit
    
    // Check if product already exists in receipt with custom price
    const activeCart = this.getActiveCart();
    if (!activeCart) return;
    
    const existingItem = activeCart.items.find(item => item.product.id === product.id);
    
    if (existingItem) {
      // Check if the existing item has a custom total price
      let hasCustomPrice = existingItem.hasCustomTotal === true;
      
      // If the flag is not set, try to detect custom price by checking if the total doesn't match expected calculation
      if (!hasCustomPrice) {
        let expectedTotal;
        
        if (existingItem.isWholesale && existingItem.bundlePrice && existingItem.bundleQuantity) {
          // For wholesale items, calculate expected total using bundle price
          expectedTotal = Math.round(existingItem.bundleQuantity * existingItem.bundlePrice * 100) / 100;
        } else {
          // For regular items, calculate expected total using unit price
          const defaultPrice = this.getEffectiveUnitPrice(product);
          expectedTotal = Math.round(existingItem.quantity * defaultPrice * 100) / 100;
        }
        
        const totalMatches = Math.abs(existingItem.total - expectedTotal) <= 0.01;
        
        // If the total doesn't match the expected calculation, it's likely a custom price
        hasCustomPrice = !totalMatches;
        
        // Fix the flag if we detect a custom price
        if (hasCustomPrice) {
          existingItem.hasCustomTotal = true;
        }
      }
      
      
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
        return;
      } else {
        // Product exists without custom price - increment quantity instead of adding new item
        const isWholesaleContext = this.isWholesaleMode || this.selectedClient?.clientType === 'WHOLESALE';
        
        if (isWholesaleContext && product.isWholesale && product.bundleSize) {
          // For wholesale items, increment bundle quantity
          existingItem.bundleQuantity = (existingItem.bundleQuantity || 0) + 1;
          existingItem.quantity = existingItem.bundleQuantity * product.bundleSize;
          existingItem.total = existingItem.bundleQuantity * (product.bundlePrice || 0);
        } else {
          // For regular items, increment quantity directly
          existingItem.quantity = Number(existingItem.quantity) + 1;
          const unitPrice = this.getEffectiveUnitPrice(product);
          existingItem.unitPrice = unitPrice;
          existingItem.total = Number(existingItem.quantity) * unitPrice;
        }
        
        // Move to top and recalculate totals
        this.moveItemToTop(existingItem);
        this.calculateTotals();
        
        this.showAlertMessage(
          `${product.name} quantité augmentée`, 
          'success'
        );
        return;
      }
    }
    
    // Check if adding this product would result in negative stock
    if (currentStock < requestedQuantity && !product.name.toLowerCase().includes('vrac')) {
      this.showStockWarning(product, requestedQuantity, currentStock);
      return; // Don't add the product yet - wait for user confirmation
    }
    
    if (this.inputMode === 'quantity') {
      // In quantity mode: automatically add +1, but allow custom quantity input
      this.addProductToReceiptWithQuantity(product, 1);
      this.pendingProduct = product;
      this.currentInput = ''; // Don't show "1" in input
    } else if (this.inputMode === 'price') {
      // In price mode: set pending product for price input (PU)
      this.pendingProduct = product;
      this.currentInput = '';
    }
  }

  showStockWarning(product: Product, quantity: number, currentStock: number): void {
    
    // First close any existing modals that might interfere
    this.showProductModal = false;
    this.showDiscountPopup = false;
    this.showPaymentPopup = false;
    this.closeClientSearch();
    
    // Set stock warning modal properties
    this.stockWarningProduct = product;
    this.stockWarningQuantity = quantity;
    this.stockWarningCurrentStock = currentStock;
    this.showStockWarningModal = true;
    
  }

  closeStockWarning(): void {
    this.showStockWarningModal = false;
    this.stockWarningProduct = null;
    this.stockWarningQuantity = 0;
    this.stockWarningCurrentStock = 0;
  }

  proceedWithNegativeStock(): void {
    if (this.stockWarningProduct) {
      // For wholesale items, add 1 bundle (not the total units)
      // For regular items, add 1 unit
      const quantityToAdd = (this.isWholesaleMode || this.selectedClient?.clientType === 'WHOLESALE') && this.stockWarningProduct.isWholesale
        ? 1  // 1 bundle for wholesale
        : 1; // 1 unit for regular
      
      this.addProductToReceiptWithQuantity(this.stockWarningProduct, quantityToAdd);
      
      // Show a brief success message
      this.showAlertMessage(`Produit ajouté avec stock négatif: ${this.stockWarningProduct.name}`, 'warning');
    }
    this.closeStockWarning();
  }

  confirmProductModal(): void {
    if (this.selectedProduct && this.productModalQuantity > 0) {
      const currentStock = this.getShopStock(this.selectedProduct.id);
      
      // Check if adding this quantity would result in negative stock
      if (currentStock < this.productModalQuantity) {
        this.showStockWarning(this.selectedProduct, this.productModalQuantity, currentStock);
        // Don't return - allow the user to proceed after seeing the warning
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

  // Refresh shop inventory
  refreshShopInventory(): void {
    this.loadShopInventory();
    this.loadShopName();
  }

  // Load shop name from backend
  loadShopName(): void {
    if (!this.currentShopDepotId || this.currentShopDepotId === 0) {
      this.currentShopName = 'Dépôt non assigné';
      return;
    }

    this.depotsService.get(this.currentShopDepotId).subscribe({
      next: (depot) => {
        this.currentShopName = depot.name;
      },
      error: (error) => {
        console.error('Error loading shop name:', error);
        this.currentShopName = 'Dépôt inconnu';
      }
    });
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
    const sale = this.buildSaleForPrinting(true);
    this.printService.printSaleReceipt(sale);
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

  // Build a Sale-like object for unified printing
  private buildSaleForPrinting(useLast: boolean = false): Sale {
    const now = new Date();
    const source = useLast && this.lastValidatedSale ? this.lastValidatedSale : null;
    const itemsSource = source ? source.receiptItems : this.getActiveCart()?.items || [];

    const items = (itemsSource || []).map((it: any) => ({
      id: 0,
      saleId: 0,
      productId: it.product?.id ?? it.productId ?? 0,
      productName: it.product?.name ?? it.productName ?? '',
      quantity: Number(it.quantity || 0),
      unitPrice: Number(it.unitPrice || 0),
      total: Number(it.total || (Number(it.quantity || 0) * Number(it.unitPrice || 0))),
      discount: Number(it.discount || 0)
    }));

    // Totals
    const subtotal = items.reduce((sum: number, item: { total: number }) => sum + Number(item.total || 0), 0);
    const discount = source ? Number(source.discount || 0) : Number(this.getActiveCart()?.discount || 0);
    const finalTotal = source ? Number(source.netTotal || subtotal - discount) : Number(this.getActiveCart()?.netTotal || subtotal - discount);

    // Payment
    const paymentMethodName = source
      ? (source.paymentType ? this.mapPaymentTypeToName(source.paymentType) : (source.paymentMethod?.name || ''))
      : (this.paymentType ? this.mapPaymentTypeToName(this.paymentType) : '');

    const client = source?.selectedClient || this.selectedClient || null;

    const sale: Sale = {
      id: source?.id || 0,
      items,
      total: subtotal,
      tax: 0,
      discount,
      finalTotal,
      paymentMethod: paymentMethodName ? { id: 0, name: paymentMethodName, type: 'CASH', isActive: true } : undefined,
      status: 'COMPLETED',
      cashierId: 0,
      customerId: client?.id,
      expectedDate: undefined,
      notes: undefined,
      createdAt: source?.createdAt || now,
      updatedAt: now,
      client: client ? { firstName: client.firstName, lastName: client.lastName, code: client.code || '' } : undefined,
      user: undefined,
      loyaltyPointsEarned: source?.loyaltyEarned
    };

    return sale;
  }

  private mapPaymentTypeToName(type: string): string {
    const t = (type || '').toLowerCase();
    if (t === 'cash' || t === 'especes') return 'ESPECES';
    if (t === 'card' || t === 'carte') return 'CARTE';
    if (t === 'check' || t === 'cheque') return 'CHEQUE';
    if (t === 'virement' || t === 'transfer' || t === 'bank_transfer') return 'VIREMENT';
    return type?.toUpperCase() || '';
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

  // Ticket menu methods
  onTicketIdClick(): void {
    if (this.showTicketMenu) {
      this.showTicketMenu = false;
      return;
    }
    
    this.loadTodaysTickets();
    this.showTicketMenu = true;
  }

  loadTodaysTickets(): void {
    this.loadingTodaysTickets = true;
    this.salesService.getTodaysSales().subscribe({
      next: (tickets) => {
        this.todaysTickets = tickets;
        this.loadingTodaysTickets = false;
      },
      error: (error) => {
        console.error('Error loading today\'s tickets:', error);
        this.loadingTodaysTickets = false;
      }
    });
  }

  onTicketSelect(ticket: Sale): void {
    this.showTicketMenu = false;
    this.openReturnExchangeDialog(ticket);
  }

  openReturnExchangeDialog(ticket: Sale): void {
    // Navigate to historique with the selected ticket
    this.router.navigate(['/historique'], { 
      queryParams: { 
        openReturnDialog: 'true', 
        ticketId: ticket.id 
      } 
    });
  }

  closeTicketMenu(): void {
    this.showTicketMenu = false;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    const target = event.target as HTMLElement;
    const ticketMenu = target.closest('.ticket-menu-container');
    if (!ticketMenu && this.showTicketMenu) {
      this.closeTicketMenu();
    }
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

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.removeTouchEventListeners();
  }

  // Drag and Drop Methods
  private initializeDragDrop(): void {
    // Subscribe to drag state changes
    this.dragDropService.dragState$
      .pipe(takeUntil(this.destroy$))
      .subscribe(state => {
        this.isDragMode = state.isDragging;
        this.dragGhostPosition = state.dragPosition;
        this.draggedProduct = state.draggedProduct;
      });

    // Subscribe to page change requests
    this.dragDropService.onPageChange
      .pipe(takeUntil(this.destroy$))
      .subscribe(({ direction, currentPage }) => {
        if (direction === 'prev' && this.currentPage > 0) {
          this.currentPage--;
        } else if (direction === 'next' && this.currentPage < this.totalPages - 1) {
          this.currentPage++;
        }
      });


    // Subscribe to order changes
    this.dragDropService.onOrderChange
      .pipe(takeUntil(this.destroy$))
      .subscribe(({ fromIndex, toIndex, products }) => {
        this.allProducts = products;
        this.filterProducts(); // Refresh the filtered products
        this.persistProductOrder(products);
      });
  }

  onProductMouseDown(event: MouseEvent, product: Product): void {
    if (event.button !== 0) return; // Only left mouse button

    const globalIndex = this.allProducts.findIndex(p => p.id === product.id);
    if (globalIndex === -1) return;


    // Record the product and position for potential drag detection
    this.currentTouchProduct = product;
    this.currentTouchStartPosition = { x: event.clientX, y: event.clientY };
    this.dragDetectionStarted = false; // Reset drag detection flag

    // Prevent default to avoid text selection
    event.preventDefault();
  }

  onProductMouseMove(event: MouseEvent): void {
    if (!this.isDragMode) {
      // Check if we have a current touch product and start position
      if (this.currentTouchProduct && this.currentTouchStartPosition && !this.dragDetectionStarted) {
        // Check if there's been any movement from initial position
        const deltaX = Math.abs(event.clientX - this.currentTouchStartPosition.x);
        const deltaY = Math.abs(event.clientY - this.currentTouchStartPosition.y);
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        
        if (distance > 0) {
          // Movement detected - start drag detection (only once)
          const globalIndex = this.allProducts.findIndex(p => p.id === this.currentTouchProduct!.id);
          this.dragDropService.recordInitialPosition(this.currentTouchProduct, globalIndex, this.currentTouchStartPosition.x, this.currentTouchStartPosition.y);
          this.dragDropService.startDragDetection();
          this.dragDetectionStarted = true;
        }
      }
      
      // Check if we should start dragging (only if there's significant movement)
      const dragState = this.dragDropService.getCurrentDragState();
      if (dragState.draggedProduct && !dragState.isDragging) {
        if (this.dragDropService.hasSignificantMovement(event.clientX, event.clientY)) {
          // Cancel drag detection and start drag
          this.dragDropService.cancelDragDetection();
          const globalIndex = this.allProducts.findIndex(p => p.id === dragState.draggedProduct!.id);
          if (globalIndex !== -1) {
            this.dragDropService.startDrag(dragState.draggedProduct, globalIndex, this.currentPage);
          }
        }
      }
      return;
    }

    // Update drag position
    const container = event.currentTarget as HTMLElement;
    const containerRect = container.getBoundingClientRect();
    
    this.dragDropService.updateDragPosition(
      event.clientX,
      event.clientY,
      containerRect,
      this.allProducts,
      this.currentPage,
      this.productsPerPage
    );
  }


  onProductMouseUp(event: MouseEvent, product: Product): void {
    if (this.isDragMode) {
      // Handle drag end
      const dragState = this.dragDropService.getCurrentDragState();
      if (dragState.targetGlobalIndex !== null) {
        this.dragDropService.drop(
          dragState.fromGlobalIndex,
          dragState.targetGlobalIndex,
          this.allProducts
        );
      } else {
        this.dragDropService.cancelDrag();
      }
    } else {
      // Not in drag mode - check if this was a single click
      if (this.currentTouchProduct && this.currentTouchProduct.id === product.id) {
        // This was a single click - handle product click logic
        this.handleProductClick(product);
      }
      
      // Cancel any drag detection and clear touch state
      this.dragDropService.cancelDragDetection();
      this.currentTouchProduct = null;
      this.currentTouchStartPosition = null;
      this.dragDetectionStarted = false;
    }
  }

  onProductTouchStart(event: TouchEvent, product: Product): void {
    if (event.touches.length !== 1) return;

    const globalIndex = this.allProducts.findIndex(p => p.id === product.id);
    if (globalIndex === -1) return;


    // Record the product and position for potential drag detection
    const touch = event.touches[0];
    this.currentTouchProduct = product;
    this.currentTouchStartPosition = { x: touch.clientX, y: touch.clientY };
    this.dragDetectionStarted = false; // Reset drag detection flag

    // Prevent default to avoid scrolling
    event.preventDefault();
  }

  onProductTouchMove(event: TouchEvent): void {
    if (event.touches.length !== 1) return;

    if (!this.isDragMode) {
      // Check if we have a current touch product and start position
      if (this.currentTouchProduct && this.currentTouchStartPosition && !this.dragDetectionStarted) {
        const touch = event.touches[0];
        
        // Check if there's been any movement from initial position
        const deltaX = Math.abs(touch.clientX - this.currentTouchStartPosition.x);
        const deltaY = Math.abs(touch.clientY - this.currentTouchStartPosition.y);
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        
        if (distance > 0) {
          // Movement detected - start drag detection (only once)
          const globalIndex = this.allProducts.findIndex(p => p.id === this.currentTouchProduct!.id);
          this.dragDropService.recordInitialPosition(this.currentTouchProduct, globalIndex, this.currentTouchStartPosition.x, this.currentTouchStartPosition.y);
          this.dragDropService.startDragDetection();
          this.dragDetectionStarted = true;
        }
      }
      
      // Check if we should start dragging (only if there's significant movement)
      const dragState = this.dragDropService.getCurrentDragState();
      if (dragState.draggedProduct && !dragState.isDragging) {
        const touch = event.touches[0];
        if (this.dragDropService.hasSignificantMovement(touch.clientX, touch.clientY)) {
          // Cancel drag detection and start drag
          this.dragDropService.cancelDragDetection();
          const globalIndex = this.allProducts.findIndex(p => p.id === dragState.draggedProduct!.id);
          if (globalIndex !== -1) {
            this.dragDropService.startDrag(dragState.draggedProduct, globalIndex, this.currentPage);
          }
        }
      }
      return;
    }

    // Update drag position using the main product grid container
    const container = this.productGrid?.nativeElement;
    if (!container) return;
    
    const containerRect = container.getBoundingClientRect();
    const touch = event.touches[0];
    
    this.dragDropService.updateDragPosition(
      touch.clientX,
      touch.clientY,
      containerRect,
      this.allProducts,
      this.currentPage,
      this.productsPerPage
    );
  }

  onProductTouchEnd(event: TouchEvent, product: Product): void {
    if (this.isDragMode) {
      // Handle drag end
      const dragState = this.dragDropService.getCurrentDragState();
      if (dragState.targetGlobalIndex !== null) {
        this.dragDropService.drop(
          dragState.fromGlobalIndex,
          dragState.targetGlobalIndex,
          this.allProducts
        );
      } else {
        this.dragDropService.cancelDrag();
      }
    } else {
      // Not in drag mode - check if this was a single tap
      if (this.currentTouchProduct && this.currentTouchProduct.id === product.id) {
        // This was a single tap - handle product click logic
        this.handleProductClick(product);
      }
      
      // Cancel any drag detection and clear touch state
      this.dragDropService.cancelDragDetection();
      this.currentTouchProduct = null;
      this.currentTouchStartPosition = null;
      this.dragDetectionStarted = false;
    }
  }



  @HostListener('document:mouseleave', ['$event'])
  onDocumentMouseLeave(event: MouseEvent): void {
    if (this.isDragMode) {
      this.dragDropService.cancelDrag();
    }
  }



  private persistProductOrder(products: Product[]): void {
    const updates = products
      .filter(product => product.displayIndex !== null && product.displayIndex !== undefined)
      .map(product => ({
        id: product.id,
        displayIndex: product.displayIndex!
      }));

    if (updates.length === 0) return;

    // Call API to persist order
    this.productsService.updateProductOrder(updates).subscribe({
      next: () => {
      },
      error: (error) => {
        console.error('Error persisting product order:', error);
        // Optionally show error message to user
      }
    });
  }

  // Touch Event Listeners (with passive: false)
  private touchEventListeners: { element: EventTarget; event: string; listener: (event: Event) => void }[] = [];

  private setupTouchEventListeners(): void {
    // Add touch event listeners with passive: false to allow preventDefault
    const touchMoveListener = (event: Event) => this.onGlobalTouchMove(event as TouchEvent);
    const touchEndListener = (event: Event) => this.onGlobalTouchEnd(event as TouchEvent);

    document.addEventListener('touchmove', touchMoveListener, { passive: false });
    document.addEventListener('touchend', touchEndListener, { passive: false });

    // Store references for cleanup
    this.touchEventListeners = [
      { element: document, event: 'touchmove', listener: touchMoveListener },
      { element: document, event: 'touchend', listener: touchEndListener }
    ];
  }

  private removeTouchEventListeners(): void {
    this.touchEventListeners.forEach(({ element, event, listener }) => {
      element.removeEventListener(event, listener);
    });
    this.touchEventListeners = [];
  }

  private onGlobalTouchMove(event: TouchEvent): void {
    if (!this.isDragMode) return;
    
    // Only handle single touch
    if (event.touches.length !== 1) return;
    
    // Update drag position using the main product grid container
    const container = this.productGrid?.nativeElement;
    if (!container) return;
    
    const containerRect = container.getBoundingClientRect();
    const touch = event.touches[0];
    
    this.dragDropService.updateDragPosition(
      touch.clientX,
      touch.clientY,
      containerRect,
      this.allProducts,
      this.currentPage,
      this.productsPerPage
    );
    
    // Prevent default to avoid scrolling
    event.preventDefault();
  }

  private onGlobalTouchEnd(event: TouchEvent): void {
    if (!this.isDragMode) return;
    
    // Handle drag end
    const dragState = this.dragDropService.getCurrentDragState();
    if (dragState.targetGlobalIndex !== null) {
      this.dragDropService.drop(
        dragState.fromGlobalIndex,
        dragState.targetGlobalIndex,
        this.allProducts
      );
    } else {
      this.dragDropService.cancelDrag();
    }
  }

  // Wholesale rules
  activeWholesaleRules: WholesaleRule[] = [];

  loadWholesaleRules(): void {
    this.wholesaleRulesService.getWholesaleRules().subscribe({
      next: (rules: WholesaleRule[]) => {
        this.activeWholesaleRules = (rules || []).filter(r => !r.isArchived);
      },
      error: () => {
        this.activeWholesaleRules = [];
      }
    });
  }

  findRuleForProduct(productId: number): WholesaleRule | null {
    if (!this.activeWholesaleRules || this.activeWholesaleRules.length === 0) return null;
    const match = this.activeWholesaleRules.find(r => Array.isArray((r as any).productIds) && (r as any).productIds.includes(productId));
    return match || null;
  }

  getWholesaleUnitPrice(product: any): number {
    const baseUnit = Number(product.prix_vente_TTC) || 0;
    const bundlePrice = Number(product.bundlePrice) || 0;
    const bundleSize = Number(product.bundleSize) || 0;

    // If product is wholesale-capable, we sell by bundle: unit price represents one bundle price
    const baseForWholesale = (product.isWholesale && bundlePrice > 0 && bundleSize > 0)
      ? bundlePrice
      : baseUnit;

    const rule = this.findRuleForProduct(product.id);
    if (rule) {
      const val = Number(rule.value) || 0;
      if (rule.ruleType === 'percentage') return baseForWholesale * (1 - val / 100);
      if (rule.ruleType === 'fixed') return val;
      if (rule.ruleType === 'discount') return Math.max(0, baseForWholesale - val);
    }

    return baseForWholesale;
  }

  getEffectiveUnitPrice(product: any): number {
    const isWholesaleContext = this.isWholesaleMode || (this.selectedClient?.clientType === 'WHOLESALE');
    return isWholesaleContext ? this.getWholesaleUnitPrice(product) : (Number(product.prix_vente_TTC) || 0);
  }

  getItemDisplayName(item: any): string {
    return (item && item.displayName) ? String(item.displayName) : (item?.product?.name || '');
  }

  // Credit modal UI state
  showCreditModal = false;
  creditInput = '';

  openCreditModal(): void {
    const activeCart = this.getActiveCart();
    if (!activeCart || activeCart.items.length === 0) {
      this.showAlertMessage('Aucun article dans le panier', 'error');
      return;
    }
    if (!this.selectedClient) {
      this.showAlertMessage('Un client doit être sélectionné pour le crédit', 'error');
      return;
    }
    this.creditInput = '';
    this.showCreditModal = true;
  }

  pressKeypad(key: string): void {
    if (key === 'C') {
      this.creditInput = '';
      return;
    }
    if (key === '←') {
      this.creditInput = this.creditInput.slice(0, -1);
      return;
    }
    if (key === '.' && this.creditInput.includes('.')) return;
    this.creditInput += key;
  }

  confirmCreditUI(): void {
    const activeCart = this.getActiveCart();
    if (!activeCart) return;
    const total = Number(activeCart.netTotal) || 0;
    const paidAmount = parseFloat(this.creditInput || '0');
    if (isNaN(paidAmount) || paidAmount < 0) {
      this.showAlertMessage('Montant invalide', 'error');
      return;
    }
    if (paidAmount > total) {
      this.showAlertMessage('Le montant payé ne peut pas dépasser le total', 'error');
      return;
    }
    this.paymentType = 'cash';
    this.amountPaid = paidAmount;
    this.salePaymentType = 'CREDIT';
    this.showCreditModal = false;
    this.confirmPayment();
  }

  openPaymentPopup(): void {
    const activeCart = this.getActiveCart();
    if (!activeCart || activeCart.items.length === 0) {
      this.showAlertMessage('Aucun article dans le panier', 'error');
      return;
    }
    if (this.salePaymentType === 'CREDIT' && !this.selectedClient) {
      this.showAlertMessage('Un client est requis pour les ventes à crédit', 'error');
      return;
    }
    this.showPaymentPopup = true;
    this.paymentType = undefined;
    // Prefill amountPaid with entered advance if credit
    if (this.salePaymentType === 'CREDIT' && this.creditInput) {
      const paid = parseFloat(this.creditInput);
      this.amountPaid = isNaN(paid) ? undefined : paid;
    } else {
      this.amountPaid = undefined;
    }
    this.calculatedChange = 0;
  }

  // Invoice request methods
  loadInvoiceRequests(): void {
    this.http.get(`${environment.apiUrl}/invoices/requests`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    }).subscribe({
      next: (response: any) => {
        this.invoiceRequests = response.requests || [];
      },
      error: (error) => {
        console.error('Error loading invoice requests:', error);
        this.invoiceRequests = [];
      }
    });
  }

  hasInvoiceRequest(saleId: number): boolean {
    return this.invoiceRequests.some(request => request.saleId === saleId);
  }

  showInvoiceRequestFromCart(): void {
    const activeCart = this.getActiveCart();
    if (!activeCart || activeCart.items.length === 0) {
      this.showAlertMessage('Aucun article dans le panier', 'error');
      return;
    }

    // Create a mock sale object from the current cart for the invoice request
    const mockSale = {
      id: 0, // Temporary ID for cart-based requests
      status: 'CART',
      total: activeCart.netTotal,
      items: activeCart.items.map(item => ({
        ...item,
        product: item.product,
        productName: item.product?.name || '',
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: item.total
      })),
      createdAt: new Date(),
      client: activeCart.client,
      user: { firstName: 'Utilisateur', lastName: 'Actuel' }
    };

    this.selectedSaleForInvoice = mockSale;
    this.invoiceRequestData.notes = '';
    this.showInvoiceRequestModal = true;
  }

  requestInvoiceFromSale(sale: any): void {
    
    // Load full sale details with items and product information
    this.salesService.getSale(sale.id).subscribe({
      next: (fullSale: any) => {
        this.selectedSaleForInvoice = fullSale;
        this.invoiceRequestData.notes = '';
        this.showInvoiceRequestModal = true;
      },
      error: (error) => {
        console.error('Error loading sale details:', error);
        this.showAlertMessage('Erreur lors du chargement des détails de la vente', 'error');
      }
    });
  }

  closeInvoiceRequestModal(): void {
    this.showInvoiceRequestModal = false;
    this.selectedSaleForInvoice = null;
    this.invoiceRequestData.notes = '';
  }

  submitInvoiceRequest(): void {
    if (!this.selectedSaleForInvoice) return;

    this.submittingInvoiceRequest = true;

    // Check if this is a cart-based request (sale ID = 0)
    if (this.selectedSaleForInvoice.id === 0) {
      // New logic: defer invoice creation until after the normal sale is processed
      this.isInvoiceRequestPending = true;
      this.pendingInvoiceRequestNotes = this.invoiceRequestData.notes || '';

      // Close modal and inform the user to validate the sale normally
      this.closeInvoiceRequestModal();
      this.showAlertMessage('Demande de facture enregistrée. Validez la vente, la facture sera demandée automatiquement.', 'info');
      this.submittingInvoiceRequest = false;
    } else {
      // For existing sales, create the invoice request directly
      this.createInvoiceRequestFromSale();
    }
  }

  private createSaleFromCart(): void {
    const activeCart = this.getActiveCart();
    if (!activeCart || activeCart.items.length === 0) {
      this.showAlertMessage('Aucun article dans le panier', 'error');
      this.submittingInvoiceRequest = false;
      return;
    }

    // Create sale data from cart
    const saleData = {
      items: activeCart.items.map(item => ({
        productId: item.product.id,
        productName: item.product.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: item.total
      })),
      total: activeCart.netTotal,
      discount: activeCart.discount,
      finalTotal: activeCart.netTotal,
      clientId: activeCart.client?.id || undefined,
      notes: this.invoiceRequestData.notes,
      paymentMethodId: 1, // Default to cash payment
      status: 'COMPLETED' // Mark as completed since we're requesting an invoice
    };

    this.salesService.createSale(saleData).subscribe({
      next: (newSale) => {
        // Now create the invoice request for the new sale
        const requestData = {
          saleId: newSale.id,
          requestNotes: this.invoiceRequestData.notes
        };

        this.http.post(`${environment.apiUrl}/invoices/request-from-ticket`, requestData).subscribe({
          next: (response: any) => {
            this.showAlertMessage('Demande de facture envoyée avec succès!', 'success');
            this.closeInvoiceRequestModal();
            this.loadInvoiceRequests();
            // Clear the cart since the sale is now completed
            this.clearCart(this.activeCartId);
          },
          error: (error) => {
            console.error('Error requesting invoice:', error);
            this.showAlertMessage('Erreur lors de l\'envoi de la demande de facture', 'error');
          },
          complete: () => {
            this.submittingInvoiceRequest = false;
          }
        });
      },
      error: (error) => {
        console.error('Error creating sale:', error);
        this.showAlertMessage('Erreur lors de la création de la vente', 'error');
        this.submittingInvoiceRequest = false;
      }
    });
  }

  private createInvoiceRequestFromSale(): void {
    const requestData = {
      saleId: this.selectedSaleForInvoice.id,
      requestNotes: this.invoiceRequestData.notes
    };

    this.http.post(`${environment.apiUrl}/invoices/request-from-ticket`, requestData).subscribe({
      next: (response: any) => {
        this.showAlertMessage('Demande de facture envoyée avec succès!', 'success');
        this.closeInvoiceRequestModal();
        this.loadInvoiceRequests(); // Refresh the list
      },
      error: (error) => {
        console.error('Error submitting invoice request:', error);
        this.showAlertMessage('Erreur lors de l\'envoi de la demande', 'error');
        this.submittingInvoiceRequest = false;
      }
    });
  }

  // Invoice menu functionality
  showInvoiceMenu(): void {
    this.loadApprovedInvoices();
    this.showInvoiceMenuModal = true;
  }

  closeInvoiceMenu(): void {
    this.showInvoiceMenuModal = false;
  }

  loadApprovedInvoices(): void {
    this.http.get(`${environment.apiUrl}/invoices?status=ISSUED&limit=50`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    }).subscribe({
      next: (response: any) => {
        this.approvedInvoices = response.invoices || [];
        this.unprintedInvoicesCount = this.approvedInvoices.filter(invoice => !invoice.printedAt).length;
      },
      error: (error) => {
        console.error('Error loading approved invoices:', error);
        this.approvedInvoices = [];
        this.unprintedInvoicesCount = 0;
      }
    });
  }

  requestNewInvoice(): void {
    this.closeInvoiceMenu();
    this.showInvoiceRequestFromCart();
  }

  viewApprovedInvoices(): void {
    this.closeInvoiceMenu();
    this.showApprovedInvoicesModal = true;
  }

  closeApprovedInvoicesModal(): void {
    this.showApprovedInvoicesModal = false;
  }

  printApprovedInvoice(invoice: any): void {
    // Debug: Log invoice data
    
    // Validate invoice data before printing
    if (!invoice) {
      this.showAlertMessage('Erreur: Aucune facture sélectionnée', 'error');
      return;
    }

    if (!invoice.lines || !Array.isArray(invoice.lines) || invoice.lines.length === 0) {
      this.showAlertMessage('Erreur: Aucune ligne de facture trouvée', 'error');
      return;
    }

    // Open print dialog for the approved invoice
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      try {
        const htmlContent = this.generateInvoiceHTML(invoice);
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
        printWindow.close();
        
        // Mark as printed
        this.markInvoiceAsPrinted(invoice.id);
      } catch (error) {
        console.error('Error generating invoice HTML:', error);
        this.showAlertMessage('Erreur lors de la génération de la facture', 'error');
        printWindow.close();
      }
    } else {
      this.showAlertMessage('Erreur: Impossible d\'ouvrir la fenêtre d\'impression', 'error');
    }
  }

  private markInvoiceAsPrinted(invoiceId: number): void {
    this.http.patch(`${environment.apiUrl}/invoices/${invoiceId}/mark-printed`, {}, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    }).subscribe({
      next: () => {
        this.loadApprovedInvoices(); // Refresh the count
        this.showAlertMessage('Facture marquée comme imprimée', 'success');
      },
      error: (error) => {
        console.error('Error marking invoice as printed:', error);
      }
    });
  }

  private generateInvoiceHTML(invoice: any): string {
    const now = new Date();
    const invoiceDate = invoice.createdAt ? new Date(invoice.createdAt).toLocaleDateString('fr-FR') : 'N/A';
    const invoiceTime = invoice.createdAt ? new Date(invoice.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : 'N/A';
    
    // Calculate totals
    let totalHTVA = 0;
    let totalTVA = 0;
    let totalTTC = 0;

    // VAT breakdown by rate
    const vatBreakdown: { [key: number]: { baseHT: number; montantTVA: number } } = {};

    // Ensure lines exist and is an array
    const lines = invoice.lines || [];
    const linesHTML = lines.map((line: any) => {
      // Validate line data - use the correct field names from the backend
      const prixVenteTTC = Number(line.prixVenteTTC) || 0;
      const prixVenteHTVA = Number(line.prixVenteHTVA) || 0;
      const montantTVA = Number(line.montantTVA) || 0;
      const quantity = Number(line.quantity) || 0;
      const tvaPercent = Number(line.tvaPercent) || 0;
      const sousTotalTTC = Number(line.sousTotalTTC) || 0;
      
      const baseHT = quantity * prixVenteHTVA;
      const montantTVAForLine = quantity * montantTVA;
      
      totalHTVA += baseHT;
      totalTVA += montantTVAForLine;
      totalTTC += sousTotalTTC;

      // Add to VAT breakdown
      if (!vatBreakdown[tvaPercent]) {
        vatBreakdown[tvaPercent] = { baseHT: 0, montantTVA: 0 };
      }
      vatBreakdown[tvaPercent].baseHT += baseHT;
      vatBreakdown[tvaPercent].montantTVA += montantTVAForLine;

      return `
        <tr>
          <td>${line.product?.famille?.name || line.familleName || 'N/A'}</td>
          <td>${line.product?.designation_legale || line.legalDesignation || line.product?.name || line.productName || 'Produit inconnu'}</td>
          <td class="text-right">${quantity}</td>
          <td class="text-right">${prixVenteHTVA.toFixed(3)} dt</td>
          <td class="text-right">${tvaPercent}%</td>
          <td class="text-right">${montantTVAForLine.toFixed(3)} dt</td>
          <td class="text-right">${prixVenteTTC.toFixed(3)} dt</td>
          <td class="text-right">${sousTotalTTC.toFixed(3)} dt</td>
        </tr>
      `;
    }).join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Facture ${invoice.invoiceNumber}</title>
        <style>
          body { 
            font-family: Arial, sans-serif; 
            margin: 0; 
            padding: 20px; 
            color: #333;
            font-size: 12px;
          }
          .container { 
            max-width: 800px; 
            margin: 0 auto; 
            border: 1px solid #ddd;
            padding: 20px;
          }
          .header { 
            display: flex; 
            justify-content: space-between; 
            align-items: flex-start; 
            margin-bottom: 30px;
            border-bottom: 2px solid #333;
            padding-bottom: 20px;
          }
          .company-info {
            flex: 1;
          }
          .invoice-info {
            text-align: right;
            flex: 1;
          }
          .title { 
            font-size: 24px; 
            font-weight: bold; 
            margin-bottom: 10px;
          }
          .subtitle {
            font-size: 18px;
            color: #666;
            margin-bottom: 20px;
          }
          .info-row {
            margin: 5px 0;
          }
          .label {
            font-weight: bold;
            display: inline-block;
            width: 120px;
          }
          .customer-section {
            margin: 20px 0;
            padding: 15px;
            background-color: #f9f9f9;
            border-left: 4px solid #007bff;
          }
          .customer-title {
            font-weight: bold;
            margin-bottom: 10px;
            color: #007bff;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
          }
          th, td {
            border: 1px solid #ddd;
            padding: 8px;
            text-align: left;
          }
          th {
            background-color: #f5f5f5;
            font-weight: bold;
            text-align: center;
          }
          .text-right {
            text-align: right;
          }
          .totals {
            margin-top: 20px;
            text-align: right;
          }
          .total-row {
            margin: 5px 0;
            font-size: 14px;
          }
          .total-final {
            font-weight: bold;
            font-size: 16px;
            border-top: 2px solid #333;
            padding-top: 10px;
            margin-top: 10px;
          }
          .footer {
            margin-top: 40px;
            text-align: center;
            font-size: 10px;
            color: #666;
            border-top: 1px solid #ddd;
            padding-top: 20px;
          }
          @media print {
            body { margin: 0; padding: 0; }
            .container { border: none; padding: 0; }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="company-info">
              <div class="title">PÂTISSERIE DELICE</div>
              <div class="info-row"><span class="label">Adresse:</span> 123 Rue de la Patisserie, Tunis, Tunisie</div>
              <div class="info-row"><span class="label">Téléphone:</span> +216 71 123 456</div>
              <div class="info-row"><span class="label">Email:</span> contact@patisseriedelice.tn</div>
              <div class="info-row"><span class="label">Matricule Fiscal:</span> 12345678/A/M/000</div>
            </div>
            <div class="invoice-info">
              <div class="subtitle">FACTURE</div>
              <div class="info-row"><span class="label">N° Facture:</span> ${invoice.invoiceNumber}</div>
              <div class="info-row"><span class="label">Date:</span> ${invoiceDate}</div>
              <div class="info-row"><span class="label">Heure:</span> ${invoiceTime}</div>
              <div class="info-row"><span class="label">Mode de paiement:</span> ${invoice.paymentMethod || 'Non spécifié'}</div>
            </div>
          </div>

          <div class="customer-section">
            <div class="customer-title">INFORMATIONS CLIENT</div>
            <div class="info-row"><span class="label">Nom:</span> ${invoice.client?.firstName || ''} ${invoice.client?.lastName || 'Client anonyme'}</div>
            <div class="info-row"><span class="label">Adresse:</span> ${invoice.client?.address || 'Non spécifiée'}</div>
            <div class="info-row"><span class="label">Téléphone:</span> ${invoice.client?.phone || 'Non spécifié'}</div>
            ${invoice.client?.matriculeFiscal ? `<div class="info-row"><span class="label">Matricule Fiscal:</span> ${invoice.client.matriculeFiscal}</div>` : ''}
          </div>

          <table>
            <thead>
              <tr>
                <th>Famille</th>
                <th>Article</th>
                <th>Qté</th>
                <th>PV HTVA</th>
                <th>TVA %</th>
                <th>Montant TVA</th>
                <th>PV TTC</th>
                <th>Sous-total TTC</th>
              </tr>
            </thead>
            <tbody>
              ${linesHTML || '<tr><td colspan="8" class="text-center">Aucune ligne de facture trouvée</td></tr>'}
            </tbody>
          </table>

          <!-- Footer with two columns: VAT breakdown on left, totals on right -->
          <div style="display: flex; gap: 30px; margin-top: 30px;">
            <!-- Left column: VAT Breakdown -->
            <div style="flex: 1;">
              <h4 style="font-size: 14px; font-weight: bold; margin: 0 0 10px 0; text-align: left;">RÉCAPITULATIF TVA</h4>
              <table style="width: 100%; border-collapse: collapse;">
                <thead>
                  <tr style="background-color: #f5f5f5;">
                    <th style="border: 1px solid #ddd; padding: 8px; text-align: center; font-weight: bold;">Base HT</th>
                    <th style="border: 1px solid #ddd; padding: 8px; text-align: center; font-weight: bold;">% TVA</th>
                    <th style="border: 1px solid #ddd; padding: 8px; text-align: center; font-weight: bold;">Montant TVA</th>
                  </tr>
                </thead>
                <tbody>
                  ${Object.keys(vatBreakdown).map(rate => {
                    const rateNum = Number(rate);
                    const breakdown = vatBreakdown[rateNum];
                    return `
                      <tr>
                        <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${breakdown.baseHT.toFixed(2)} dt</td>
                        <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${rateNum}%</td>
                        <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${breakdown.montantTVA.toFixed(2)} dt</td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>

            <!-- Right column: Totals -->
            <div style="flex: 1; text-align: right;">
              <h4 style="font-size: 14px; font-weight: bold; margin: 0 0 10px 0; text-align: right;">TOTAUX</h4>
              <div style="background-color: #f9f9f9; padding: 15px; border: 1px solid #ddd;">
                <div style="margin: 8px 0; font-size: 14px;">
                  <span style="font-weight: bold;">Total HTVA:</span> 
                  <span style="float: right; font-weight: bold;">${totalHTVA.toFixed(3)} dt</span>
                </div>
                <div style="margin: 8px 0; font-size: 14px;">
                  <span style="font-weight: bold;">Total TVA:</span> 
                  <span style="float: right; font-weight: bold;">${totalTVA.toFixed(3)} dt</span>
                </div>
                <div style="margin: 8px 0; font-size: 14px;">
                  <span style="font-weight: bold;">Remise:</span> 
                  <span style="float: right; font-weight: bold;">0,000 dt</span>
                </div>
                <div style="margin: 8px 0; font-size: 16px; border-top: 2px solid #333; padding-top: 8px;">
                  <span style="font-weight: bold;">Total TTC:</span> 
                  <span style="float: right; font-weight: bold;">${totalTTC.toFixed(3)} dt</span>
                </div>
              </div>
            </div>
          </div>

          <div class="footer">
            <p>Merci pour votre achat!</p>
            <p>Cette facture a été générée le ${now.toLocaleDateString('fr-FR')} à ${now.toLocaleTimeString('fr-FR')}</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

} 