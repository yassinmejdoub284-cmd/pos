import { Component, OnInit, OnDestroy, HostListener, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
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
import { SupplierService } from '../core/services/supplier.service';
import { ExpenseService } from '../core/services/expense.service';
import { ImagePreloadService } from '../core/services/image-preload.service';
import { TicketCounterService } from '../core/services/ticket-counter.service';
import { SocketService } from '../core/services/socket.service';
import { InventoryService } from '../core/services/inventory.service';
import { Product } from '../core/models/product.model';
import { Sale } from '../core/models/sale.model';
import { Client } from '../core/models/client.model';
import { Subject, takeUntil, forkJoin, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { TicketActionDialogComponent } from '../shared/ticket-action-dialog/ticket-action-dialog.component';

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

  // Depot selection for admins
  showDepotSelection = false;
  depots: any[] = [];
  selectedDepot: any = null;

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

  // Ticket action dialog
  showTicketActionDialog = false;
  selectedTicket: Sale | null = null;

  // Gift action dialog
  showGiftActionDialog = false;

  // Ticket details modal
  showTicketDetailsModal = false;

  // Product catalog
  allProducts: Product[] = [];
  filteredProducts: Product[] = [];
  productCategories: string[] = ['Tous'];
  selectedCategory: string = 'Tous';
  searchQuery: string = '';
  productFamilies: any[] = [];

  // Sales data for ordering
  productSalesData: ProductSalesData[] = [];

  // Pagination
  currentPage: number = 0;
  productsPerPage: number = 20; // Adjust based on screen size
  totalPages: number = 0;
  showProductsPerPageMenu: boolean = false;
  productsPerPageOptions: number[] = [5, 10, 15, 20];

  // Products selection per page
  pageProductsMap: Map<number, number[]> = new Map(); // Map<pageNumber, productIds[]>
  showProductSelectorModal: boolean = false;
  selectedProductsForPage: number[] = []; // Product IDs selected for current page
  shuffledProductsForWholesale: Product[] = []; // Shuffled products for wholesale mode

  // Shop inventory
  shopInventory: any[] = [];
  currentShopDepotId: number = 0; // Will be set from user account
  currentShopName: string = ''; // Will be fetched from user's depot

  // Input handling
  currentInput: string = '';
  isTemporarySale: boolean = false;
  isWholesaleMode: boolean = false;
  pendingWholesaleToggle: boolean = false; // Track if we're waiting for client selection to enable wholesale
  isReturnMode: boolean = false;

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
  isProcessingPayment = false; // Prevent double-click on payment buttons

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
  remisePaymentInput: string = '';

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
  // Fast-food : le stock negatif est autorise par defaut, donc l'alerte de
  // stock insuffisant ne s'affiche plus et la vente n'est jamais bloquee.
  allowNegativeStock: boolean = true;

  // Drag and Drop
  private destroy$ = new Subject<void>();
  isDragMode = false;
  dragModeEnabled = false; // User-controlled toggle for drag functionality
  dragGhostPosition: { x: number; y: number } | null = null;
  draggedProduct: Product | null = null;
  currentTouchProduct: Product | null = null;
  currentTouchStartPosition: { x: number; y: number } | null = null;
  dragDetectionStarted: boolean = false;
  private lastClickTime: number = 0;
  private lastClickedProductId: number | null = null;
  private clickCooldown: number = 300; // 300ms cooldown to prevent double clicks

  @ViewChild('productGrid') productGrid!: ElementRef;
  @ViewChild('mainContainer') mainContainer!: ElementRef;

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
    '🎂 Anniversaire',
    '💒 Mariage',
    '🎉 Événement spécial',
    '⭐ Client fidèle',
    '🎯 Promotion',
    '👔 Visite officielle',
    '🍰 Dégustation',
    '📝 Autre'
  ];

  // Quick amount buttons for cash payments
  paymentQuickAmounts = [0, 0.5, 1, 5, 10];

  // Alert system
  showAlert = false;
  alertMessage = '';
  alertType: 'success' | 'error' | 'info' | 'warning' = 'info';

  // Input warning modal
  showInputWarningModal = false;

  // Instant refund modal
  showInstantRefundModal = false;
  instantRefundTicket: Sale | null = null;

  // Return mode confirmation dialog
  showReturnConfirmationDialog = false;

  // Return type selection
  showReturnTypeDialog = false;
  returnType: 'client' | 'passenger' | null = null;
  returnClient: Client | null = null;
  isClientReturnMode: boolean = false;
  showReturnClientSelectionDialog = false;

  // Barcode scanner
  barcodeBuffer: string = '';
  barcodeTimeout: any = null;
  private invoiceRefreshInterval: any;


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
      id: 'supplier',
      label: 'Fournisseur',
      icon: 'M3 7h18M3 12h18M3 17h18', // list/building icon
      color: '#0ea5e9', // Cyan-500
      action: () => this.openSupplierQuickActions()
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
      action: () => this.showGiftActionDialog = true
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
  ];

  commandButtons = [
    {
      id: 'validate-esp-print',
      label: 'ESPÈCE',
      icon: 'M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6v-8z', // actual printer icon
      color: '#22c55e', // Green-500: cash OK
      action: () => this.validateESPWithPrint()
    },
    {
      id: 'validate-esp-no-print',
      label: 'ESPÈCE',
      icon: 'M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6', // dollar sign
      color: '#16a34a', // Green-600: cash OK without print
      action: () => this.validateESPWithoutPrint()
    },
    {
      id: 'retour-article',
      label: 'Retour Article',
      icon: 'M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6', // return arrow icon
      color: '#dc2626', // Red-600: rouge
      action: () => this.handleRetourArticle()
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
    private returnsService: ReturnsService,
    private supplierService: SupplierService,
    private expenseService: ExpenseService,
    private imagePreloadService: ImagePreloadService,
    private ticketCounterService: TicketCounterService,
    private socketService: SocketService,
    private inventoryService: InventoryService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    // Ensure user is logged in (do not override role)

    // Set depot ID from user account or visiting depot
    const userDepotId = this.authService.currentUser()?.depotId;
    const visitingDepotId = sessionStorage.getItem('visitingDepotId');

    // Use visiting depot if available, otherwise use user's depot
    this.currentShopDepotId = visitingDepotId ? parseInt(visitingDepotId) : (userDepotId || 0);

    // Set depot ID in ticket counter service for isolation
    if (this.currentShopDepotId) {
      this.ticketCounterService.setDepotId(this.currentShopDepotId);
      // Join depot room for real-time synchronization (guarded by env flag)
      if (environment.enableRealtime) {
        this.socketService.connect();
        this.socketService.joinDepot(this.currentShopDepotId);
      }
    }

    // If user has no depot ID, show depot selection or use first available depot
    if (!this.currentShopDepotId || this.currentShopDepotId === 0) {
      if (this.authService.isAdmin()) {
        // Admin can select depot
        this.showDepotSelection = true;
        this.loadDepots();
        this.currentShopName = 'Sélection du dépôt...';
      } else {
        // Non-admin without depot: try to find first available shop depot
        this.depotsService.list().subscribe({
          next: (depots) => {
            const shopDepot = depots.find((d: any) => d.isActive && (d.type === 'SHOP' || d.type === 'MAIN'));
            if (shopDepot) {
              this.currentShopDepotId = shopDepot.id;
              sessionStorage.setItem('visitingDepotId', shopDepot.id.toString());
              this.ticketCounterService.setDepotId(this.currentShopDepotId);
              if (environment.enableRealtime) {
                this.socketService.connect();
                this.socketService.joinDepot(this.currentShopDepotId);
              }
              this.loadShopName();
              this.loadShopInventory();
            } else {
              this.currentShopName = 'Aucun dépôt disponible';
              this.showAlertMessage('Aucun dépôt disponible. Veuillez contacter un administrateur.', 'error');
            }
          },
          error: () => {
            this.currentShopName = 'Erreur de chargement';
            this.showAlertMessage('Erreur lors du chargement des dépôts', 'error');
          }
        });
      }
    } else {
      // For users with depot, load normally
      this.loadShopName();
      this.loadShopInventory();
    }

    // Subscribe to ticket counter service
    this.ticketCounterService.ticketState$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(ticketState => {
      this.currentTicketNumber = ticketState.currentTicketNumber;
      this.lastTicketDate = ticketState.lastTicketDate;
      this.isShiftOpen = ticketState.isShiftOpen;
    });

    this.initializeMultiClientSystem();
    this.loadProducts();
    this.loadPendingTemporarySalesCount();
    this.loadPendingGiftSalesCount();
    this.loadPendingReturnRequests(); // Load pending return requests
    this.loadSettings();

    // Load products per page preference
    this.loadProductsPerPagePreference();

    // Load page products map
    this.loadPageProductsMap();

    // Load session state and auto-open if none exists
    this.loadCurrentSession();
    // Sync ticket counter from today's history once at startup to avoid accidental resets
    this.syncTicketCounterFromTodaySales();
    this.initializeDragDrop();
    this.setupTouchEventListeners();
    this.loadWholesaleRules();

    // Initial load for approved invoices and requests
    this.loadApprovedInvoices();
    this.loadPendingInvoiceRequests();

    // Set up periodic refresh for unprinted invoices and requests (every 30 seconds)
    this.invoiceRefreshInterval = setInterval(() => {
      this.loadApprovedInvoices();
      this.loadPendingInvoiceRequests();
    }, 30000);
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
    if (!cart || !cart.items) return 0;

    // Sum up the quantities of all items in the cart
    return cart.items.reduce((total, item) => {
      const quantity = Number(item.quantity) || 0;
      return total + quantity;
    }, 0);
  }

  getTotalItemCount(): number {
    const activeCart = this.getActiveCart();
    if (!activeCart || !activeCart.items) return 0;

    // Sum up the quantities of all items in the active cart
    return activeCart.items.reduce((total, item) => {
      const quantity = Number(item.quantity) || 0;
      return total + quantity;
    }, 0);
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
    const baseClass = 'relative px-2 py-1 rounded border transition-all duration-200 min-w-0 flex-shrink-0';

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
    // Only load products if we have a depot ID
    if (!this.currentShopDepotId) {
      console.warn('No depot ID available, skipping product loading');
      return;
    }

    // If wholesale mode is enabled and a client is selected, load all products (including variants) like client-gros
    if (this.isWholesaleMode && this.selectedClient) {
      this.loadAllProductsForWholesale();
    } else {
      // Load products filtered by current depot (parent products only)
      this.productsService.getProducts(this.currentShopDepotId).subscribe({
        next: (products) => {
          // Sort products by displayIndex (null values go to end)
          this.allProducts = products.sort((a, b) => {
            if ((a.displayIndex === null || a.displayIndex === undefined) && (b.displayIndex === null || b.displayIndex === undefined)) return 0;
            if (a.displayIndex === null || a.displayIndex === undefined) return 1;
            if (b.displayIndex === null || b.displayIndex === undefined) return -1;
            return a.displayIndex! - b.displayIndex!;
          });

          this.loadProductSalesData();
          // Load families after products are loaded so we can filter by product count
          this.loadProductFamilies();
        },
        error: (error) => {
          console.error('Error loading products:', error);
        }
      });
    }
  }

  loadAllProductsForWholesale(): void {
    // Load all products (including variants) from inventory service, same as client-gros
    this.inventoryService.getProductsForDepot(this.currentShopDepotId, 'NOT_SHOP').subscribe({
      next: (subProducts) => {
        // Map sub-products to Product format
        const allProducts: Product[] = subProducts.map((sp: any) => ({
          id: sp.id,
          name: sp.name,
          prix_vente_TTC: Number(sp.prix_vente_TTC) || 0,
          familleId: sp.familleId || sp.famille?.id || 0,
          famille: sp.famille,
          barcode: sp.barcode || null,
          photo: sp.photo || null,
          unite: sp.unite || 'unité',
          tva: sp.tva || 0,
          createdAt: sp.createdAt || new Date(),
          updatedAt: sp.updatedAt || new Date(),
          parentProductId: sp.parentProductId ?? null,
          isWholesale: (sp as any).isWholesale || false,
          bundleSize: (sp as any).bundleSize || null,
          bundlePrice: (sp as any).bundlePrice || null,
          displayIndex: (sp as any).displayIndex || null,
          depotPrices: (sp as any).depotPrices || []
        } as Product));

        // Also load parent products to ensure we have all products
        this.productsService.getProducts(this.currentShopDepotId).subscribe({
          next: (parentProducts) => {
            // Merge parent products with sub-products, avoiding duplicates
            const parentIds = new Set(allProducts.map(p => p.id));
            const additionalParents = parentProducts.filter(p => !parentIds.has(p.id));
            const mergedProducts = [...allProducts, ...additionalParents];

            // Sort products by displayIndex (null values go to end)
            this.allProducts = mergedProducts.sort((a, b) => {
              if ((a.displayIndex === null || a.displayIndex === undefined) && (b.displayIndex === null || b.displayIndex === undefined)) return 0;
              if (a.displayIndex === null || a.displayIndex === undefined) return 1;
              if (b.displayIndex === null || b.displayIndex === undefined) return -1;
              return a.displayIndex! - b.displayIndex!;
            });

            this.loadProductSalesData();
            // Load families after products are loaded so we can filter by product count
            this.loadProductFamilies();
          },
          error: (error) => {
            console.error('Error loading parent products:', error);
            // Use sub-products only if parent load fails
            this.allProducts = allProducts.sort((a, b) => {
              if ((a.displayIndex === null || a.displayIndex === undefined) && (b.displayIndex === null || b.displayIndex === undefined)) return 0;
              if (a.displayIndex === null || a.displayIndex === undefined) return 1;
              if (b.displayIndex === null || b.displayIndex === undefined) return -1;
              return a.displayIndex! - b.displayIndex!;
            });
            this.loadProductSalesData();
            this.loadProductFamilies();
          }
        });
      },
      error: (error) => {
        console.error('Error loading all products for wholesale:', error);
        // Fallback to regular product loading
        this.productsService.getProducts(this.currentShopDepotId).subscribe({
          next: (products) => {
            this.allProducts = products.sort((a, b) => {
              if ((a.displayIndex === null || a.displayIndex === undefined) && (b.displayIndex === null || b.displayIndex === undefined)) return 0;
              if (a.displayIndex === null || a.displayIndex === undefined) return 1;
              if (b.displayIndex === null || b.displayIndex === undefined) return -1;
              return a.displayIndex! - b.displayIndex!;
            });
            this.loadProductSalesData();
            this.loadProductFamilies();
          },
          error: (err) => {
            console.error('Error loading products (fallback):', err);
          }
        });
      }
    });
  }

  loadProductFamilies(): void {
    this.productsService.getFamilles().subscribe({
      next: (families) => {
        this.productFamilies = families;

        // Filter families to only include those that have products in allProducts
        const familiesWithProducts = families.filter(family =>
          this.allProducts.some(product => {
            if (!product.famille || !product.famille.name) {
              return false;
            }
            const productFamilleName = product.famille.name.trim().toLowerCase();
            const familyName = family.name?.trim()?.toLowerCase();
            return productFamilleName === familyName;
          })
        );

        // Sort family names alphabetically
        const sortedFamilyNames = familiesWithProducts
          .map(family => family.name)
          .sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));

        // Build categories: "Tous" first, then sorted family names
        const categories = ['Tous', ...sortedFamilyNames];

        this.productCategories = categories;

        // Reset to "Tous" if current selection is no longer valid
        if (!this.productCategories.includes(this.selectedCategory)) {
          this.selectedCategory = 'Tous';
        }
        // Apply current filter
        this.filterProducts();
      },
      error: (error) => {
        console.error('Error loading product families:', error);
        // Fallback to default categories if API fails
        this.productCategories = ['Tous'];
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

    // Filter by famille only
    if (this.selectedCategory !== 'Tous') {
      // Filter products by their famille name (case-insensitive, trimmed)
      const categoryName = this.selectedCategory.trim().toLowerCase();

      // Find the famille ID from productFamilies for fallback matching
      const selectedFamille = this.productFamilies.find(f =>
        (f.name || '').trim().toLowerCase() === categoryName
      );

      filtered = filtered.filter(p => {
        // Try matching by famille name first
        if (p.famille && p.famille.name) {
          const familleName = (p.famille.name || '').trim().toLowerCase();
          if (familleName === categoryName) {
            return true;
          }
        }

        // Fallback: match by familleId if famille object doesn't have name or name doesn't match
        if (selectedFamille && p.familleId && p.familleId === selectedFamille.id) {
          return true;
        }

        return false;
      });
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
      filtered = filtered.filter(p => {
        // Check if product itself is wholesale-capable
        if (p.isWholesale && Number(p.bundleSize) > 0 && Number(p.bundlePrice) > 0) {
          return true;
        }

        // For sub-products (variants), check parent product
        const parentProductId = (p as any).parentProductId;
        if (parentProductId) {
          const parentProduct = this.allProducts.find(pp => pp.id === parentProductId);
          if (parentProduct && parentProduct.isWholesale && Number(parentProduct.bundleSize) > 0 && Number(parentProduct.bundlePrice) > 0) {
            return true;
          }
        }

        // Also check if product has wholesale rules (alternative way to be wholesale)
        const rule = this.findRuleForProduct(p.id);
        if (rule) {
          return true;
        }

        return false;
      });
    }

    // Store all filtered results
    this.filteredProducts = filtered;

    // Reset shuffled products for wholesale mode when products are filtered
    if (this.isWholesaleMode) {
      this.shuffledProductsForWholesale = [];
    }

    // Update pagination
    this.updatePagination();

    // Preload images for current page and next page
    this.preloadCurrentPageImages();
  }

  onSearchChange(): void {
    this.filterProducts();
  }

  preloadCurrentPageImages(): void {
    // Preload images for current page
    const currentPageProducts = this.getCurrentPageProducts();
    const currentPageImageSrcs = currentPageProducts
      .filter(product => product.photo)
      .map(product => product.photo!)
      .filter((src): src is string => src !== undefined);

    if (currentPageImageSrcs.length > 0) {
      this.imagePreloadService.preloadImages(currentPageImageSrcs);
    }

    // Preload images for next page (only if not already preloaded)
    if (this.currentPage < this.totalPages - 1) {
      this.imagePreloadService.preloadNextPageImages(this.filteredProducts, this.currentPage, this.productsPerPage);
    }
  }

  // Pagination methods
  updatePagination(): void {
    this.totalPages = Math.ceil(this.filteredProducts.length / this.productsPerPage);
    if (this.currentPage >= this.totalPages) {
      this.currentPage = Math.max(0, this.totalPages - 1);
    }
  }

  getCurrentPageProducts(): Product[] {
    // In wholesale mode, ignore product selection per page and use random order
    if (this.isWholesaleMode) {
      // Use shuffled products for wholesale mode
      if (this.shuffledProductsForWholesale.length === 0 || this.shuffledProductsForWholesale.length !== this.filteredProducts.length) {
        // Shuffle filtered products for wholesale mode
        this.shuffledProductsForWholesale = this.shuffleArray([...this.filteredProducts]);
      }

      // Use pagination on shuffled products
      const startIndex = this.currentPage * this.productsPerPage;
      const endIndex = startIndex + this.productsPerPage;
      return this.shuffledProductsForWholesale.slice(startIndex, endIndex);
    }

    // When filtering by famille (not "Tous"), ignore custom page product selection
    // and use normal pagination to show all products from the selected famille
    if (this.selectedCategory !== 'Tous') {
      const startIndex = this.currentPage * this.productsPerPage;
      const endIndex = startIndex + this.productsPerPage;
      return this.filteredProducts.slice(startIndex, endIndex);
    }

    // Normal mode (no famille filter): check if this page has custom product selection
    const pageProductIds = this.pageProductsMap.get(this.currentPage);

    if (pageProductIds && pageProductIds.length > 0) {
      // Get selected products from filteredProducts to respect current filter (search, etc.)
      const selectedProducts = this.filteredProducts.filter(p => pageProductIds.includes(p.id));
      // Show all selected products that match the current filter
      return selectedProducts;
    }

    // Default: use pagination
    const startIndex = this.currentPage * this.productsPerPage;
    const endIndex = startIndex + this.productsPerPage;
    return this.filteredProducts.slice(startIndex, endIndex);
  }

  shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  loadProductsPerPagePreference(): void {
    const saved = localStorage.getItem('caisse_productsPerPage');
    if (saved) {
      const value = parseInt(saved, 10);
      if (value >= 5 && value <= 20) {
        this.productsPerPage = value;
        this.updatePagination();
      }
    }
  }

  toggleProductsPerPageMenu(): void {
    this.showProductsPerPageMenu = !this.showProductsPerPageMenu;
  }

  closeProductsPerPageMenu(): void {
    this.showProductsPerPageMenu = false;
  }

  setProductsPerPage(value: number): void {
    if (value >= 5 && value <= 20) {
      this.productsPerPage = value;
      localStorage.setItem('caisse_productsPerPage', value.toString());
      this.updatePagination();
      this.closeProductsPerPageMenu();
      this.showAlertMessage(`${value} produits par page`, 'success');
    }
  }

  openProductSelectorForPage(): void {
    // Load current page's selected products
    const currentPageProducts = this.pageProductsMap.get(this.currentPage) || [];
    this.selectedProductsForPage = [...currentPageProducts];
    this.showProductSelectorModal = true;
  }

  closeProductSelectorModal(): void {
    this.showProductSelectorModal = false;
    this.selectedProductsForPage = [];
  }

  toggleProductSelection(productId: number): void {
    const index = this.selectedProductsForPage.indexOf(productId);
    if (index > -1) {
      // Remove if already selected for current page
      this.selectedProductsForPage.splice(index, 1);
    } else {
      // Check if product is already used in another page
      const usedInOtherPage = this.isProductUsedInOtherPage(productId);
      if (usedInOtherPage) {
        this.showAlertMessage('Ce produit est déjà sélectionné pour une autre page', 'warning');
        return;
      }

      // Add if not selected and under limit
      if (this.selectedProductsForPage.length < 20) {
        this.selectedProductsForPage.push(productId);
      } else {
        this.showAlertMessage('Maximum 20 produits par page', 'warning');
      }
    }
  }

  isProductSelected(productId: number): boolean {
    return this.selectedProductsForPage.includes(productId);
  }

  isProductUsedInOtherPage(productId: number): boolean {
    // Check if product is selected in any other page (not current page)
    for (const [pageNumber, productIds] of this.pageProductsMap.entries()) {
      if (pageNumber !== this.currentPage && productIds.includes(productId)) {
        return true;
      }
    }
    return false;
  }

  getProductUsedInPage(productId: number): number | null {
    // Return the page number where this product is used, or null if not used
    for (const [pageNumber, productIds] of this.pageProductsMap.entries()) {
      if (pageNumber !== this.currentPage && productIds.includes(productId)) {
        return pageNumber;
      }
    }
    return null;
  }

  isProductAvailableInCurrentMode(product: Product): boolean {
    // Check if product is available in current mode (wholesale or normal)
    if (this.isWholesaleMode) {
      // Check if product itself is wholesale-capable
      if (product.isWholesale && Number(product.bundleSize) > 0 && Number(product.bundlePrice) > 0) {
        return true;
      }

      // For sub-products (variants), check parent product
      const parentProductId = (product as any).parentProductId;
      if (parentProductId) {
        const parentProduct = this.allProducts.find(pp => pp.id === parentProductId);
        if (parentProduct && parentProduct.isWholesale && Number(parentProduct.bundleSize) > 0 && Number(parentProduct.bundlePrice) > 0) {
          return true;
        }
      }

      // Also check if product has wholesale rules
      const rule = this.findRuleForProduct(product.id);
      if (rule) {
        return true;
      }

      return false;
    }
    return true; // All products available in normal mode
  }

  saveProductsForCurrentPage(): void {
    if (this.selectedProductsForPage.length === 0) {
      // Remove page selection if empty
      this.pageProductsMap.delete(this.currentPage);
    } else {
      // Remove products from other pages if they were moved to current page
      const previousPageProducts = this.pageProductsMap.get(this.currentPage) || [];
      const newProducts = this.selectedProductsForPage.filter(id => !previousPageProducts.includes(id));

      // Remove new products from all other pages
      for (const [pageNumber, productIds] of this.pageProductsMap.entries()) {
        if (pageNumber !== this.currentPage) {
          const filteredIds = productIds.filter(id => !newProducts.includes(id));
          if (filteredIds.length === 0) {
            this.pageProductsMap.delete(pageNumber);
          } else {
            this.pageProductsMap.set(pageNumber, filteredIds);
          }
        }
      }

      // Save selected products for current page (max 20)
      const productsToSave = this.selectedProductsForPage.slice(0, 20);
      this.pageProductsMap.set(this.currentPage, productsToSave);
    }

    // Save to localStorage
    this.savePageProductsMap();

    this.closeProductSelectorModal();
    this.showAlertMessage(`${this.selectedProductsForPage.length} produit(s) sélectionné(s) pour cette page`, 'success');
  }

  clearProductsForCurrentPage(): void {
    this.pageProductsMap.delete(this.currentPage);
    this.savePageProductsMap();
    this.closeProductSelectorModal();
    this.showAlertMessage('Sélection de produits effacée pour cette page', 'info');
  }

  savePageProductsMap(): void {
    const mapData: { [key: number]: number[] } = {};
    this.pageProductsMap.forEach((productIds, pageNumber) => {
      mapData[pageNumber] = productIds;
    });
    localStorage.setItem('caisse_pageProductsMap', JSON.stringify(mapData));
  }

  loadPageProductsMap(): void {
    const saved = localStorage.getItem('caisse_pageProductsMap');
    if (saved) {
      try {
        const mapData: { [key: number]: number[] } = JSON.parse(saved);
        this.pageProductsMap.clear();
        Object.keys(mapData).forEach(key => {
          const pageNumber = parseInt(key, 10);
          this.pageProductsMap.set(pageNumber, mapData[pageNumber]);
        });
      } catch (error) {
        console.error('Error loading page products map:', error);
      }
    }
  }

  trackByProduct(index: number, product: Product): number {
    return product.id;
  }

  goToNextPage(): void {
    if (this.currentPage < this.totalPages - 1) {
      this.currentPage++;
      // Preload images for the next page (only if there's a next page)
      if (this.currentPage < this.totalPages - 1) {
        this.imagePreloadService.preloadNextPageImages(this.filteredProducts, this.currentPage, this.productsPerPage);
      }
    }
  }

  goToPreviousPage(): void {
    if (this.currentPage > 0) {
      this.currentPage--;
      // Preload images for the previous page (only if there's a previous page)
      if (this.currentPage > 0) {
        this.imagePreloadService.preloadPreviousPageImages(this.filteredProducts, this.currentPage, this.productsPerPage);
      }
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

  @HostListener('document:keypress', ['$event'])
  onBarcodeScanned(event: KeyboardEvent): void {
    // Ignore if user is typing in an input field
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
      return;
    }

    // Ignore if a modal/popup is open
    if (this.showPaymentConfirmationDialog || this.showClientSearchPopup ||
      this.showDiscountTypeSelection || this.showTemporarySalePopup ||
      this.showGiftPopup || this.showProductModal) {
      return;
    }

    // Handle Enter key as scan completion
    if (event.key === 'Enter') {
      if (this.barcodeBuffer.trim().length > 0) {
        this.processBarcodeInput(this.barcodeBuffer.trim());
        this.barcodeBuffer = '';
      }
      return;
    }

    // Accumulate characters
    this.barcodeBuffer += event.key;

    // Clear any existing timeout
    if (this.barcodeTimeout) {
      clearTimeout(this.barcodeTimeout);
    }

    // Set timeout to auto-process after 100ms of no input (typical for barcode scanners)
    this.barcodeTimeout = setTimeout(() => {
      if (this.barcodeBuffer.trim().length > 0) {
        this.processBarcodeInput(this.barcodeBuffer.trim());
        this.barcodeBuffer = '';
      }
    }, 100);
  }

  processBarcodeInput(barcode: string): void {
    // Look up product by barcode
    const product = this.allProducts.find(p => p.barcode === barcode);

    if (product) {
      // Add product to cart
      this.addProductToReceipt(product);
      this.showAlertMessage(`Produit scanné: ${product.name}`, 'success');
    } else {
      // Product not found
      this.showAlertMessage(`Code-barres non trouvé: ${barcode}`, 'error');
    }
  }




  addProductToReceipt(product: any): void {
    const activeCart = this.getActiveCart();
    if (!activeCart) return;

    if (this.isReturnMode) {
      this.addReturnProductToReceipt(product);
      return;
    }

    // Check if product supports wholesale and we're in wholesale mode
    if (this.isWholesaleMode && product.isWholesale && product.bundleSize && product.bundlePrice) {
      this.addWholesaleProductToReceipt(product);
      return;
    }

    const existingItem = activeCart.items.find(item => item.product.id === product.id && !item.isWholesale);

    if (existingItem) {
      existingItem.quantity = this.roundQuantity(Number(existingItem.quantity) + 1);
      // Update unitPrice to current effective price (client-specific if available)
      existingItem.unitPrice = this.getEffectiveUnitPrice(product);
      existingItem.total = Number(existingItem.quantity) * Number(existingItem.unitPrice);
      // Ensure all values are numbers
      existingItem.unitPrice = Number(existingItem.unitPrice);

      // Select the existing item
      this.selectedReceiptItem = existingItem;
      this.selectedReceiptItemIndex = activeCart.items.indexOf(existingItem);
    } else {
      const isWholesaleContext = this.isWholesaleMode || this.selectedClient?.clientType === 'WHOLESALE';
      const effectiveUnitPrice = this.getEffectiveUnitPrice(product);
      const bundleQuantity = isWholesaleContext && product.isWholesale ? 1 : undefined;
      const bundleSize = isWholesaleContext && product.isWholesale ? product.bundleSize : undefined;
      // For wholesale items, calculate effective bundle price and total
      const effectiveBundlePrice = (isWholesaleContext && product.isWholesale && bundleSize)
        ? effectiveUnitPrice * bundleSize
        : undefined;
      const total = (isWholesaleContext && product.isWholesale && effectiveBundlePrice && bundleQuantity)
        ? effectiveBundlePrice * bundleQuantity
        : effectiveUnitPrice;

      const newItem = {
        product,
        quantity: this.roundQuantity(isWholesaleContext && product.isWholesale && product.bundleSize ? product.bundleSize : 1),
        unitPrice: effectiveUnitPrice,
        total: total,
        isGift: false,
        isWholesale: isWholesaleContext && product.isWholesale,
        bundleQuantity: bundleQuantity,
        bundleSize: bundleSize,
        bundlePrice: effectiveBundlePrice
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

    // Get the effective unit price (client-specific price if available)
    const effectiveUnitPrice = this.getEffectiveUnitPrice(product);
    const bundleSize = product.bundleSize || 1;
    // Calculate bundle price based on effective unit price (client-specific if available)
    const effectiveBundlePrice = effectiveUnitPrice * bundleSize;

    const existingItem = activeCart.items.find(item => item.product.id === product.id && item.isWholesale);

    if (existingItem) {
      existingItem.bundleQuantity = (existingItem.bundleQuantity || 0) + Number(bundleCount || 0);
      existingItem.quantity = this.roundQuantity(existingItem.bundleQuantity * bundleSize);
      // Update bundlePrice to use effective price (client-specific if available)
      existingItem.bundlePrice = effectiveBundlePrice;
      existingItem.total = Number(existingItem.bundleQuantity) * Number(effectiveBundlePrice);
      // Ensure designation shows fradeau info
      const label = `${product.name} (fradeau x${bundleSize})`;
      (existingItem as any).displayName = label;
      (existingItem as any).productName = label;

      // Select the existing item
      this.selectedReceiptItem = existingItem;
      this.selectedReceiptItemIndex = activeCart.items.indexOf(existingItem);
    } else {
      const newItem = {
        product,
        quantity: this.roundQuantity(bundleSize * Number(bundleCount || 1)),
        unitPrice: effectiveUnitPrice,
        total: effectiveBundlePrice * Number(bundleCount || 1),
        isGift: false,
        isWholesale: true,
        bundleQuantity: Number(bundleCount || 1),
        bundleSize: bundleSize,
        bundlePrice: effectiveBundlePrice, // Use effective bundle price (client-specific if available)
        isApproved: false
      };
      const label = `${product.name} (fradeau x${bundleSize})`;
      (newItem as any).displayName = label;
      (newItem as any).productName = label;
      activeCart.items.unshift(newItem);

      // Select the newly added item at the top
      this.selectedReceiptItem = newItem;
      this.selectedReceiptItemIndex = 0;
    }

    this.calculateTotals();
  }

  addReturnProductToReceipt(product: Product): void {
    const activeCart = this.getActiveCart();
    if (!activeCart) return;

    // For client returns, use the same effective price logic as regular sales
    // This ensures wholesale (gros) clients get their correct prices for returns
    let effectiveUnitPrice = this.getEffectiveUnitPrice(product);

    const existingItem = activeCart.items.find(item => item.product.id === product.id && !item.isWholesale);

    if (existingItem) {
      existingItem.quantity = this.roundQuantity(Number(existingItem.quantity) + 1);
      existingItem.unitPrice = effectiveUnitPrice;
      existingItem.total = Number(existingItem.quantity) * Number(existingItem.unitPrice);
      existingItem.unitPrice = Number(existingItem.unitPrice);

      this.selectedReceiptItem = existingItem;
      this.selectedReceiptItemIndex = activeCart.items.indexOf(existingItem);
    } else {
      const newItem = {
        product,
        quantity: this.roundQuantity(1),
        unitPrice: effectiveUnitPrice,
        total: effectiveUnitPrice,
        isGift: false,
        isWholesale: false
      };
      activeCart.items.unshift(newItem as any);
      this.selectedReceiptItem = newItem as any;
      this.selectedReceiptItemIndex = 0;
    }
    this.calculateTotals();
  }

  openProductDialog(product: Product, event: MouseEvent): void {
    event.preventDefault();
    // TODO: Implement product dialog for quantity/discount
  }

  toggleWholesaleMode(): void {
    if (this.isReturnMode) {
      this.isReturnMode = false;
      this.isClientReturnMode = false;
      this.returnType = null;
      this.returnClient = null;
    }

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
    // Reset shuffled products when switching modes
    this.shuffledProductsForWholesale = [];

    // When enabling wholesale mode with a client selected, reload client prices first
    if (this.isWholesaleMode && this.selectedClient) {
      this.loadClientPrices(this.selectedClient.id);
    } else {
      // Refresh product listing to reflect mode change (show all when off)
      this.filterProducts();
    }
  }

  toggleDragMode(): void {
    // If currently enabled and we're about to disable, complete any active drag operation
    if (this.dragModeEnabled && this.isDragMode) {
      const dragState = this.dragDropService.getCurrentDragState();
      if (dragState.targetGlobalIndex !== null && dragState.targetGlobalIndex !== dragState.fromGlobalIndex) {
        // Calculate source and destination pages
        const fromPage = Math.floor(dragState.fromGlobalIndex / this.productsPerPage);
        const toPage = Math.floor(dragState.targetGlobalIndex / this.productsPerPage);

        // Show confirmation notification if moving to a different page
        if (fromPage !== toPage) {
          const productName = dragState.draggedProduct?.name || 'Produit';
          setTimeout(() => {
            this.showAlertMessage(
              `${productName} déplacé de la page ${fromPage + 1} vers la page ${toPage + 1}`,
              'success'
            );
          }, 600);
        }

        // Complete the drop operation to save the new position
        this.dragDropService.drop(
          dragState.fromGlobalIndex,
          dragState.targetGlobalIndex,
          this.allProducts
        );
      } else {
        // No valid target, just cancel the drag
        this.dragDropService.cancelDrag();
      }
    }

    this.dragModeEnabled = !this.dragModeEnabled;

    // Show feedback message
    const message = this.dragModeEnabled ? 'Mode modification activé' : 'Mode modification désactivé';
    this.showAlertMessage(message, 'info');
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

  // Client selection dialog
  showClientSelectionDialog = false;
  clientViewMode: 'grid' | 'table' = 'grid'; // Default to grid view
  allClientsCache: any[] = [];
  selectedClient: Client | null = null;
  selectedClientId: number | null = null;
  searchingClients = false;

  // Client-specific prices cache (from client-gros)
  clientPrices: Map<number, number> = new Map(); // Map<productId, prix_vente_TTC>

  // Payment confirmation dialog
  showPaymentConfirmationDialog = false;
  pendingPaymentClient: Client | null = null;
  pendingPaymentAmount: number = 0;
  pendingPaymentNotes: string = '';

  // Quick add client functionality
  showQuickAddClientPopup = false;
  showAddDebtModal = false;
  debtAmount: number | undefined;
  debtNotes: string = '';
  quickAddForm = {
    firstName: '',
    lastName: '',
    phone: '',
    city: 'Tunis',
    address: '',
    matriculeFiscal: '',
    clientType: 'INDIVIDUAL' as 'INDIVIDUAL' | 'BUSINESS' | 'WHOLESALE',
    depotId: 0, // Will be set to currentShopDepotId when form opens
    notes: '',
    allowDebt: true,
    maxDebt: null
  };

  // Quick add supplier functionality
  showQuickAddSupplierPopup = false;
  quickAddSupplierForm = {
    name: '',
    contactName: '',
    email: '',
    phone: '',
    address: '',
    city: 'Tunis',
    postalCode: '',
    taxNumber: '',
    paymentTerms: '',
    notes: ''
  };

  // Tunisian governorates (24)
  tunisianCities: string[] = [
    'Tunis', 'Ariana', 'Ben Arous', 'Manouba', 'Nabeul', 'Zaghouan', 'Bizerte', 'Beja', 'Jendouba',
    'Kef', 'Siliana', 'Kairouan', 'Kasserine', 'Sidi Bouzid', 'Sfax', 'Mahdia', 'Monastir',
    'Sousse', 'Gabes', 'Medenine', 'Tataouine', 'Gafsa', 'Tozeur', 'Kebili'
  ];

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
  // Fast lookup for approved invoices by saleId
  private approvedInvoicesSet: Set<number> = new Set<number>();
  private printedInvoicesSet: Set<number> = new Set<number>();
  private pendingInvoiceRequestsSet: Set<number> = new Set<number>();

  // Return requests for pending refunds
  pendingReturnRequests: any[] = [];
  // Fast lookup for pending return requests by saleId
  private pendingReturnRequestsSet: Set<number> = new Set<number>();

  // Approved invoices modal
  showApprovedInvoicesModal = false;
  currentDate = new Date();

  // Supplier quick actions state
  showSupplierActionsModal = false;
  supplierSearch = '';
  supplierResults: any[] = [];
  selectedSupplierForAction: any = null;
  loadingSuppliers = false;
  supplierAction: 'regler' | 'depense' | null = null;
  // Payment form
  showSupplierPaymentForm = false;
  supplierPaymentAmount: string = '';
  supplierPaymentMethod: 'CASH' | 'CARD' | 'CHECK' | 'BANK_TRANSFER' = 'CASH';
  supplierPaymentNotes: string = '';
  remainingCashAfterSupplier: number | null = null;
  // Expense form
  showExpenseForm = false;
  expenseStep: 'category' | 'payment' | 'supplier' | 'notes' = 'category';
  expensePayNow = true;
  expenseTotalAmount: string = '';
  expensePaidAmount: string = '';
  expenseDescription: string = '';
  expensePaymentType: 'CASH' | 'CHECK' | 'BANK_TRANSFER' | 'WIRE_TRANSFER' = 'CASH';
  expenseNotes: string = '';
  expenseSupplierSearch = '';
  expenseSupplierId: number | undefined = undefined;
  expenseCollectionDate = new Date().toISOString().split('T')[0];
  expenseCategories: any[] = [];
  selectedExpenseCategory: any = null;
  filteredExpenseSuppliers: any[] = [];
  submittingSupplierAction = false;
  remainingCashAfterExpense: number | null = null;
  editingExpenseField: 'total' | 'paid' | null = null;

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
    // Load first 500 active clients for quick local filtering (increased to ensure all clients are loaded)
    this.clientsService.getClients(1, 500, undefined, '', true).subscribe({
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
          // Include clients with no depot assignment (null) - allow them to be shown
          // This ensures clients like CLI0001 are not excluded
          if (!client.depotId && !client.depot) {
            return true;
          }
          // Exclude warehouse clients (depot.type = 'WAREHOUSE', 'MAIN', 'BRANCH')
          return false;
        }).map((client: any) => {
          client.statementBalance = undefined;
          return client;
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
      // Show first 100 clients when no search query
      this.searchResults = this.allClientsCache.slice(0, 100);
      this.fetchClientStatementBalances(this.searchResults);
      return;
    }

    // Handle special search terms for client types
    let filteredClients = this.allClientsCache;

    if (q === 'tous' || q === 'all') {
      // Show all clients
      filteredClients = this.allClientsCache;
    } else if (q === 'gros' || q === 'wholesale') {
      // Filter wholesale clients
      filteredClients = this.allClientsCache.filter(c => c.clientType === 'WHOLESALE');
    } else if (q === 'détail' || q === 'detail' || q === 'individual' || q === 'individuel') {
      // Filter individual clients
      filteredClients = this.allClientsCache.filter(c => c.clientType === 'INDIVIDUAL');
    } else if (q === 'business' || q === 'entreprise' || q === 'société' || q === 'societe') {
      // Filter business clients
      filteredClients = this.allClientsCache.filter(c => c.clientType === 'BUSINESS');
    } else {
      // Regular search in name, code, phone, email, and client type
      // Normalize code search to handle variations like "cli001" matching "CLI0001"
      filteredClients = this.allClientsCache.filter(c => {
        const name = `${c.firstName || ''} ${c.lastName || ''}`.toLowerCase();
        const code = (c.code || '').toLowerCase();
        const phone = (c.phone || '').toLowerCase();
        const email = (c.email || '').toLowerCase();
        const clientType = (c.clientType || '').toLowerCase();

        // Check if query matches code (handles partial matches like "cli001" for "CLI0001")
        const codeMatch = code.includes(q) || code.replace(/^cli0*/, '').includes(q.replace(/^cli0*/, ''));

        return name.includes(q) ||
          codeMatch ||
          phone.includes(q) ||
          email.includes(q) ||
          clientType.includes(q);
      });
    }

    // Show up to 200 results to ensure all matching clients are visible
    this.searchResults = filteredClients.slice(0, 200);
    this.fetchClientStatementBalances(this.searchResults);
  }

  fetchClientStatementBalances(clients: any[]): void {
    if (!clients || clients.length === 0) return;

    const clientsToFetch = clients.filter(client => client.statementBalance === undefined || client.statementBalance === null);

    if (clientsToFetch.length === 0) return;

    const statementRequests = clientsToFetch.map(client =>
      this.http.get<any>(`${environment.apiUrl}/client-statements/${client.id}/statement`, { withCredentials: true }).pipe(
        map(response => ({ clientId: client.id, balance: response.currentBalance || 0 })),
        catchError(() => of({ clientId: client.id, balance: 0 }))
      )
    );

    forkJoin(statementRequests).subscribe({
      next: (results: any[]) => {
        results.forEach(result => {
          const cachedClient = this.allClientsCache.find(c => c.id === result.clientId);
          if (cachedClient) {
            cachedClient.statementBalance = result.balance;
          }
        });
        this.searchResults = this.searchResults.map(client => {
          const updatedClient = this.allClientsCache.find(c => c.id === client.id);
          return updatedClient || client;
        });
        this.cdr.detectChanges();
      },
      error: () => {
        this.cdr.detectChanges();
      }
    });
  }

  searchClients(): void {
    // Deprecated backend search: switch to local filtering only
    this.filterClients();
  }

  selectClient(client: any): void {
    // Don't interfere with return client selection - it has its own dialog

    const activeCart = this.getActiveCart();
    if (!activeCart) return;

    // Clear existing client prices first
    this.clientPrices.clear();

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

    // Load client-specific prices from client-gros endpoint first, then reload products
    // This ensures products are loaded with the correct fixed prices for the client
    this.loadClientPrices(client.id);
  }

  loadClientPrices(clientId: number): void {
    // Load client-specific prices from client-gros endpoint
    this.http.get<any[]>(`${environment.apiUrl}/clients/${clientId}/product-prices`, { withCredentials: true }).subscribe({
      next: (clientPrices: any[]) => {
        // Load client prices into cache
        this.clientPrices.clear();
        clientPrices.forEach((cp: any) => {
          // Use productId from the product relation if available, otherwise from direct field
          const productId = cp.product?.id || cp.productId;
          const price = Number(cp.prix_vente_TTC);
          if (productId && price > 0) {
            this.clientPrices.set(productId, price);
          }
        });

        // Reload products to get all products (including variants) with fixed prices when in wholesale mode
        if (this.isWholesaleMode && (this.selectedClient || this.returnClient)) {
          this.loadProducts();
        } else {
          // Refresh product list according to mode
          this.filterProducts();
        }

        // Refresh product prices display in cart
        this.calculateTotals();
      },
      error: (error: any) => {
        // If endpoint doesn't exist yet or no prices found, just clear the cache
        // This means we'll use default/wholesale prices
        this.clientPrices.clear();

        // Still reload products even if prices failed to load
        if (this.isWholesaleMode && this.selectedClient) {
          this.loadProducts();
        } else {
          this.filterProducts();
        }
      }
    });
  }

  // Client selection dialog methods
  openClientSelectionDialog(): void {
    this.showClientSelectionDialog = true;
  }

  closeClientSelectionDialog(): void {
    this.showClientSelectionDialog = false;
  }

  // Return type selection methods
  selectReturnType(type: 'client' | 'passenger'): void {
    this.returnType = type;
    this.showReturnTypeDialog = false;

    if (type === 'passenger') {
      // Passenger return: toggle return mode
      this.isReturnMode = !this.isReturnMode;
      if (this.isReturnMode) {
        this.isClientReturnMode = false;
        this.returnClient = null;
        this.isWholesaleMode = false;
        this.showAlertMessage('Mode retour article (Passager) activé', 'info');
        this.filterProducts();
      } else {
        this.showAlertMessage('Mode retour article désactivé', 'info');
        this.filterProducts();
      }
    } else {
      // Client return: show dedicated client selection dialog for returns
      this.showReturnClientSelectionDialog = true;
      // Fetch clients if not already loaded
      if (this.allClientsCache.length === 0) {
        this.fetchAllClients();
      }
    }
  }

  closeReturnTypeDialog(): void {
    this.showReturnTypeDialog = false;
  }

  openReturnClientSelection(): void {
    this.showReturnClientSelectionDialog = true;
    // Fetch clients if not already loaded
    if (this.allClientsCache.length === 0) {
      this.fetchAllClients();
    }
  }

  closeReturnClientSelection(): void {
    this.showReturnClientSelectionDialog = false;
  }

  selectClientForReturn(client: Client): void {
    this.returnClient = client;
    this.isReturnMode = true;
    this.isClientReturnMode = true;
    this.showReturnClientSelectionDialog = false;

    // Toggle wholesale mode if client is wholesale
    const isWholesaleClient = client.clientType === 'WHOLESALE';
    this.isWholesaleMode = isWholesaleClient;

    // Load client prices for return
    this.loadClientPrices(client.id);

    // Reload products to show wholesale products if needed
    if (isWholesaleClient) {
      this.loadProducts();
    } else {
      this.filterProducts();
    }

    this.showAlertMessage(`Mode retour article (Client: ${client.firstName} ${client.lastName})${isWholesaleClient ? ' - Mode Gros activé' : ''} activé`, 'info');
  }

  // Helper method for return client selection
  filteredClients(): any[] {
    return this.searchResults || [];
  }

  trackByClientId(index: number, client: any): number {
    return client.id;
  }

  selectCustomerOption(): void {
    this.closeClientSelectionDialog();
    this.openClientSearch();
  }

  selectWholesaleOption(): void {
    this.closeClientSelectionDialog();
    this.toggleWholesaleMode();
  }

  selectPassagerOption(): void {
    this.closeClientSelectionDialog();
    this.clearSelectedClient();
    this.showAlertMessage('Mode Passager activé', 'info');
  }

  // Client type helper methods
  getClientTypeLabel(clientType: string): string {
    switch (clientType) {
      case 'WHOLESALE':
        return 'Gros';
      case 'INDIVIDUAL':
        return 'Détail';
      case 'BUSINESS':
        return 'Business';
      default:
        return 'Inconnu';
    }
  }

  getClientTypeClass(clientType: string): string {
    switch (clientType) {
      case 'WHOLESALE':
        return 'bg-purple-100 text-purple-700';
      case 'INDIVIDUAL':
        return 'bg-orange-100 text-orange-700';
      case 'BUSINESS':
        return 'bg-blue-100 text-blue-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  }

  getClientTypeDotClass(clientType: string): string {
    switch (clientType) {
      case 'WHOLESALE':
        return 'bg-purple-500';
      case 'INDIVIDUAL':
        return 'bg-orange-500';
      case 'BUSINESS':
        return 'bg-blue-500';
      default:
        return 'bg-gray-500';
    }
  }

  // Toggle between grid and table view
  toggleClientViewMode(): void {
    this.clientViewMode = this.clientViewMode === 'grid' ? 'table' : 'grid';
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
    // Clear client prices cache
    this.clientPrices.clear();

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
      address: '',
      matriculeFiscal: '',
      clientType: 'INDIVIDUAL',
      depotId: this.currentShopDepotId, // Use current depot ID
      notes: '',
      allowDebt: true,
      maxDebt: null
    };
    this.showQuickAddClientPopup = true;
  }

  closeQuickAddClient(): void {
    this.showQuickAddClientPopup = false;
  }

  // Add debt to client relevé
  openAddDebtModal(): void {
    if (!this.selectedClient) {
      this.showAlertMessage('Aucun client sélectionné', 'error');
      return;
    }
    this.debtAmount = undefined;
    this.debtNotes = '';
    this.showAddDebtModal = true;
  }

  closeAddDebtModal(): void {
    this.showAddDebtModal = false;
    this.debtAmount = undefined;
    this.debtNotes = '';
  }

  addDebtToClient(): void {
    if (!this.selectedClient || !this.selectedClient.id) {
      this.showAlertMessage('Aucun client sélectionné', 'error');
      return;
    }

    if (!this.debtAmount || this.debtAmount <= 0) {
      this.showAlertMessage('Veuillez entrer un montant valide', 'error');
      return;
    }

    const amount = this.debtAmount; // Store in variable to satisfy TypeScript
    this.clientsService.addDebtTransaction(
      this.selectedClient.id,
      amount,
      this.debtNotes || undefined
    ).subscribe({
      next: (updatedClient) => {
        // Update the selected client with new debt amount
        if (this.selectedClient) {
          this.selectedClient.currentDebt = updatedClient.currentDebt;
        }
        this.showAlertMessage(
          `Débit de ${amount.toFixed(3)} DT ajouté au relevé de ${this.selectedClient?.firstName} ${this.selectedClient?.lastName}`,
          'success'
        );
        this.closeAddDebtModal();
      },
      error: (error) => {
        console.error('Error adding debt transaction:', error);
        this.showAlertMessage(
          error.error?.error || 'Erreur lors de l\'ajout du débit au relevé',
          'error'
        );
      }
    });
  }

  validateQuickClientForm(): { isValid: boolean; missingFields: string[] } {
    const missingFields: string[] = [];

    // Check required fields
    if (!this.quickAddForm.firstName || this.quickAddForm.firstName.trim().length === 0) {
      missingFields.push('Prénom');
    }

    if (!this.quickAddForm.lastName || this.quickAddForm.lastName.trim().length === 0) {
      missingFields.push('Nom');
    }

    // Validate client type
    if (!this.quickAddForm.clientType || !['INDIVIDUAL', 'BUSINESS', 'WHOLESALE'].includes(this.quickAddForm.clientType)) {
      missingFields.push('Type de client');
    }

    // Validate depotId - must be a specific depot (not 0, null, or undefined)
    if (!this.quickAddForm.depotId || this.quickAddForm.depotId === 0 || this.quickAddForm.depotId === null || this.quickAddForm.depotId === undefined) {
      missingFields.push('Point de vente (vous devez sélectionner un point de vente spécifique)');
    }

    // Validate maxDebt if allowDebt is true
    if (this.quickAddForm.allowDebt && this.quickAddForm.maxDebt !== null && this.quickAddForm.maxDebt !== undefined) {
      const maxDebtValue = parseFloat(String(this.quickAddForm.maxDebt));
      if (isNaN(maxDebtValue) || maxDebtValue < 0) {
        missingFields.push('Plafond de crédit (doit être un nombre positif)');
      }
    }

    return {
      isValid: missingFields.length === 0,
      missingFields
    };
  }

  createQuickClient(): void {
    // Smart validation with detailed feedback
    const validation = this.validateQuickClientForm();

    if (!validation.isValid) {
      let errorMessage = '⚠️ Formulaire incomplet. Veuillez remplir les champs suivants :\n\n';
      validation.missingFields.forEach((field, index) => {
        errorMessage += `${index + 1}. ${field}\n`;
      });
      errorMessage += '\nTous les champs marqués (*) sont obligatoires.';
      this.showAlertMessage(errorMessage, 'error');
      return;
    }

    const createRequest = {
      firstName: this.quickAddForm.firstName.trim(),
      lastName: this.quickAddForm.lastName.trim(),
      phone: this.quickAddForm.phone?.trim() || '',
      city: this.quickAddForm.city || '',
      address: this.quickAddForm.address?.trim() || '',
      matriculeFiscal: this.quickAddForm.matriculeFiscal?.trim() || '',
      clientType: this.quickAddForm.clientType,
      depotId: this.quickAddForm.depotId,
      notes: this.quickAddForm.notes?.trim() || '',
      allowDebt: this.quickAddForm.allowDebt,
      maxDebt: this.quickAddForm.maxDebt
    };

    this.clientsService.createClient(createRequest).subscribe({
      next: (newClient) => {
        this.showAlertMessage(`Client ${newClient.firstName} ${newClient.lastName} créé avec succès`, 'success');
        this.closeQuickAddClient();

        // Add the new client directly to cache if it matches shop criteria
        const shouldShowInShop = !newClient.depotId || newClient.depotId === -1 ||
          (newClient.depot && newClient.depot.type === 'SHOP');

        if (shouldShowInShop) {
          // Add to cache if not already present
          const exists = this.allClientsCache.find(c => c.id === newClient.id);
          if (!exists) {
            this.allClientsCache.unshift(newClient); // Add at the beginning
          }
        }

        // Refresh the full client list in background
        this.fetchAllClients();

        // Auto-select the newly created client immediately
        setTimeout(() => {
          this.selectClient(newClient);
        }, 100);
      },
      error: (error) => {
        const errorMessage = error?.error?.error || 'Erreur lors de la création du client';
        this.showAlertMessage(errorMessage, 'error');
      }
    });
  }

  // Quick add supplier methods
  openQuickAddSupplier(): void {
    this.quickAddSupplierForm = {
      name: '',
      contactName: '',
      email: '',
      phone: '',
      address: '',
      city: 'Tunis',
      postalCode: '',
      taxNumber: '',
      paymentTerms: '',
      notes: ''
    };
    this.showQuickAddSupplierPopup = true;
  }

  closeQuickAddSupplier(): void {
    this.showQuickAddSupplierPopup = false;
  }

  createQuickSupplier(): void {
    if (!this.quickAddSupplierForm.name.trim()) {
      this.showAlertMessage('Le nom du fournisseur est obligatoire', 'error');
      return;
    }

    const createRequest = {
      name: this.quickAddSupplierForm.name.trim(),
      contactName: this.quickAddSupplierForm.contactName.trim() || undefined,
      email: this.quickAddSupplierForm.email.trim() || undefined,
      phone: this.quickAddSupplierForm.phone.trim() || undefined,
      address: this.quickAddSupplierForm.address.trim() || undefined,
      city: this.quickAddSupplierForm.city,
      postalCode: this.quickAddSupplierForm.postalCode.trim() || undefined,
      taxNumber: this.quickAddSupplierForm.taxNumber.trim() || undefined,
      paymentTerms: this.quickAddSupplierForm.paymentTerms.trim() || undefined,
      notes: this.quickAddSupplierForm.notes.trim() || undefined
    };

    this.supplierService.createSupplier(createRequest).subscribe({
      next: (newSupplier) => {
        this.showAlertMessage(`Fournisseur ${newSupplier.name} créé avec succès`, 'success');
        this.closeQuickAddSupplier();

        // Refresh the supplier cache and search results
        this.loadSuppliersForQuickActions();
        this.loadExpenseSuppliers();
      },
      error: (error) => {
        this.showAlertMessage('Erreur lors de la création du fournisseur', 'error');
        console.error('Error creating supplier:', error);
      }
    });
  }

  trackByCity(index: number, city: string): string {
    return city;
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

    if (this.isReturnMode) {
      this.showReturnConfirmationDialog = true;
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
      const outstanding = this.roundToTenthAsThreeDecimals(Number(activeCart.netTotal) - Number(this.amountPaid || 0));
      const currentDebt = Number(this.selectedClient.currentDebt ?? 0);

      // If credit amount is less than or equal to client's balance (solde), approve it
      if (outstanding <= currentDebt) {
        // Allow the sale - client has enough balance to cover it
      } else {
        // Otherwise, check against the remaining credit limit (maxDebt - currentDebt)
        const remainingCredit = this.getClientRemainingCredit();
        if (outstanding > remainingCredit) {
          this.showAlertMessage(`Crédit dépassé. Reste autorisé: ${remainingCredit.toFixed(3)} dt`, 'error');
          return;
        }
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
    this.remisePaymentInput = '';
  }

  handleRetourArticle(): void {
    const activeCart = this.getActiveCart();

    if (!this.isReturnMode) {
      // Show return type selection dialog
      this.showReturnTypeDialog = true;
    } else {
      if (activeCart && activeCart.items.length > 0) {
        this.validateSale();
      } else {
        // Reset return mode
        this.isReturnMode = false;
        this.isClientReturnMode = false;
        this.returnType = null;
        this.returnClient = null;
        this.showAlertMessage('Mode retour article désactivé', 'info');
        this.filterProducts();
      }
    }
  }

  private createRetourRefundOnly(totalAmount: number, itemsCount: number, cartId: number): void {
    if (!this.currentSession || !this.currentSession.id) {
      this.sessionsService.getActiveSessionByDepot(undefined, this.currentShopDepotId).subscribe({
        next: (session: any) => {
          if (!session || !session.id) {
            this.showAlertMessage('Aucune session active trouvée', 'error');
            this.clearCart(cartId);
            return;
          }
          this.createRefundMovementForSession(session.id, totalAmount, itemsCount, cartId);
        },
        error: (error: any) => {
          console.error('Error getting current session:', error);
          this.showAlertMessage('Erreur lors de la récupération de la session', 'error');
          this.clearCart(cartId);
        }
      });
    } else {
      this.createRefundMovementForSession(this.currentSession.id, totalAmount, itemsCount, cartId);
    }
  }

  private createRefundMovementForSession(sessionId: number, totalAmount: number, itemsCount: number, cartId: number): void {
    this.sessionsService.addCashMovement(sessionId, {
      type: 'SORTIE',
      amount: totalAmount,
      reason: `Remboursement retour article - ${itemsCount} article(s)`
    }).subscribe({
      next: () => {
        this.showAlertMessage(`Retour article effectué: ${totalAmount.toFixed(3)} dt remboursé`, 'success');
        this.clearCart(cartId);
      },
      error: (error: any) => {
        console.error('Error creating refund movement:', error);
        this.showAlertMessage('Erreur lors de la création du remboursement', 'error');
        this.clearCart(cartId);
      }
    });
  }

  cancelRemisePayment(): void {
    this.showRemisePaymentPopup = false;
    this.remisePaymentAmount = undefined;
    this.remisePaymentInput = '';
  }

  pressRemiseKeypad(key: string): void {
    if (key === 'C') {
      this.remisePaymentInput = '';
      this.remisePaymentAmount = undefined;
      return;
    }
    if (key === '←') {
      this.remisePaymentInput = this.remisePaymentInput.slice(0, -1);
      this.remisePaymentAmount = this.remisePaymentInput === '' ? undefined : parseFloat(this.remisePaymentInput);
      return;
    }
    if (key === '.' && this.remisePaymentInput.includes('.')) {
      return; // Don't add decimal if one already exists
    }

    this.remisePaymentInput += key;
    this.remisePaymentAmount = parseFloat(this.remisePaymentInput);
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
    this.salesService.getSales({ status: 'TEMPORARY' }).subscribe({
      next: (sales: any) => {
        // All returned sales will have status TEMPORARY
        this.allTemporarySales = sales;
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

    // Set focus back to the main container for keyboard input
    this.setFocusAfterPayment();
  }

  // Process payment without receipt printing
  processPaymentWithoutReceipt(): void {
    this.showPaymentConfirmation = false;
    this.isWholesaleMode = false;
    this.filterProducts();
    this.processPayment(false, true); // Pass true to indicate no alert should be shown

    // Open cash drawer after completing sale without printing
    this.printService.openCashDrawer();

    // Set focus back to the main container for keyboard input
    this.setFocusAfterPayment();
  }

  // Set focus after payment completion
  private setFocusAfterPayment(): void {
    // Use setTimeout to ensure the DOM has been updated
    setTimeout(() => {
      if (this.productGrid && this.productGrid.nativeElement) {
        // Focus on the product grid container which has tabindex="0"
        const container = this.productGrid.nativeElement.closest('[tabindex="0"]');
        if (container) {
          container.focus();
        }
      }
    }, 100);
  }

  confirmReturnSale(): void {
    const activeCart = this.getActiveCart();
    if (!activeCart || activeCart.items.length === 0) {
      this.showAlertMessage('Aucun article dans le panier', 'error');
      return;
    }

    if (!this.currentShopDepotId || this.currentShopDepotId === 0) {
      this.showAlertMessage('Dépôt non défini', 'error');
      return;
    }

    // Check if this is a client return or passenger return
    if (this.isClientReturnMode && this.returnClient) {
      // Client return: use stock-documents return endpoint
      if (!this.returnClient.id) {
        this.showAlertMessage('Client non sélectionné', 'error');
        return;
      }

      const items = activeCart.items.map(item => ({
        productId: item.product.id,
        famille: item.product.famille?.name || 'Divers',
        quantity: Math.abs(Number(item.quantity)),
        purchasePrice: Number(item.unitPrice), // Return value
        batch: null,
        notes: null
      }));

      const data = {
        depotId: this.currentShopDepotId,
        clientId: this.returnClient.id,
        items: items,
        notes: ''
      };

      this.stockDocumentsService.createReturnDocument(data).subscribe({
        next: (doc: any) => {
          this.showAlertMessage(`Retour client effectué: ${activeCart.netTotal.toFixed(3)} dt crédité au client`, 'success');
          this.showReturnConfirmationDialog = false;
          this.isReturnMode = false;
          this.isClientReturnMode = false;
          this.returnType = null;
          this.returnClient = null;
          this.clearReceipt();
          this.loadShopInventory();
        },
        error: (error: any) => {
          console.error('Error processing client return:', error);
          this.showAlertMessage(error?.error?.error || 'Erreur lors du retour client', 'error');
        }
      });
    } else {
      // Passenger return: use sales return endpoint (existing flow)
      const items = activeCart.items.map(item => ({
        productId: item.product.id,
        productName: item.product.name,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        total: Number(item.total)
      }));

      const totalAmount = activeCart.netTotal;

      this.salesService.createReturnSale({
        depotId: this.currentShopDepotId,
        items: items,
        total: activeCart.subtotal,
        discount: activeCart.discount,
        finalTotal: totalAmount
      }).subscribe({
        next: () => {
          this.showAlertMessage(`Retour effectué: ${totalAmount.toFixed(3)} dt remboursé`, 'success');
          this.showReturnConfirmationDialog = false;
          this.isReturnMode = false;
          this.isClientReturnMode = false;
          this.returnType = null;
          this.returnClient = null;
          this.clearReceipt();
          this.loadShopInventory();
          this.sessionsService.getActiveSessionByDepot().subscribe();
        },
        error: (error: any) => {
          console.error('Error processing return sale:', error);
          this.showAlertMessage(error?.error?.error || 'Erreur lors du retour des articles', 'error');
        }
      });
    }
  }

  cancelReturnConfirmation(): void {
    this.showReturnConfirmationDialog = false;
  }

  // Main payment processing method
  private processPayment(shouldPrintReceipt: boolean, suppressAlert: boolean = false): void {
    // Prevent double-click/double-processing
    if (this.isProcessingPayment) {
      return;
    }
    this.isProcessingPayment = true;

    const paymentMethodMap: { [key: string]: number } = {
      'cash': 1,
      'card': 2,
      'check': 3,
      'virement': 4
    };

    const activeCart = this.getActiveCart();
    if (!activeCart) {
      this.isProcessingPayment = false;
      return;
    }

    // For credit sales, preserve any entered advance payment and method
    // so they are recorded as advancePayment instead of clearing them.

    const saleData: CreateSaleRequest = {
      items: activeCart.items.map(item => {
        // For wholesale items, ensure unitPrice uses bundlePrice if available
        const isWholesale = item.isWholesale || false;
        const effectiveUnitPrice = isWholesale && item.bundlePrice
          ? Number(item.bundlePrice)
          : (Number(item.unitPrice) || 0);

        // For wholesale items, ensure quantity is valid
        // Server accepts either quantity (total units) or bundleQuantity (number of bundles)
        let effectiveQuantity = item.quantity;
        if (isWholesale) {
          // If quantity is invalid/zero but we have bundleQuantity and bundleSize, calculate total units
          if ((!effectiveQuantity || effectiveQuantity === 0) && item.bundleQuantity && item.bundleSize) {
            effectiveQuantity = Number(item.bundleQuantity) * Number(item.bundleSize);
          }
          // If still invalid, use bundleQuantity as fallback (server will accept it)
          if ((!effectiveQuantity || effectiveQuantity === 0) && item.bundleQuantity) {
            effectiveQuantity = Number(item.bundleQuantity);
          }
        }

        return {
          productId: item.product.id,
          productName: item.product.name,
          quantity: effectiveQuantity,
          unitPrice: effectiveUnitPrice,
          total: Number(item.total),
          discount: 0,
          // Wholesale fields
          isWholesale: isWholesale,
          bundleQuantity: item.bundleQuantity || undefined,
          bundleSize: item.bundleSize || undefined,
          bundlePrice: item.bundlePrice || undefined,
          // Advance payment fields for credit
          advancePayment: this.salePaymentType === 'CREDIT' ? (Number(this.amountPaid || 0)) : undefined,
          advancePaymentMethod: this.salePaymentType === 'CREDIT' ? this.paymentType as any : undefined
        };
      }),
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

        // Open cash drawer for cash payments (espèces)
        if (this.paymentType === 'cash' && this.salePaymentType === 'COMPTANT') {
          this.printService.openCashDrawer();
        }

        // Update ticket counter with actual ticket number from server
        this.updateTicketCounterFromSale(savedSale);

        // Refresh shop inventory to show updated stock quantities
        this.loadShopInventory();

        // Refresh session data to update sales totals
        this.sessionsService.getActiveSessionByDepot().subscribe();

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

        // Reset filter to "Tous" after successful sale
        this.selectedCategory = 'Tous';
        this.filterProducts();

        // Only show success alert if not suppressed
        if (!suppressAlert) {
          this.showAlertMessage('Vente validée avec succès!', 'success');
        }

        // If an invoice request from cart was pending, create it now from the saved sale
        this.maybeCreateInvoiceForSale(savedSale?.id);

        // Reset processing flag after successful payment
        this.isProcessingPayment = false;
      },
      error: (error) => {
        this.showAlertMessage(error?.error?.error || 'Erreur lors de la sauvegarde de la vente. Veuillez réessayer.', 'error');
        // Reset processing flag on error
        this.isProcessingPayment = false;
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
        this.loadPendingInvoiceRequests(); // Immediate refresh
      },
      error: (error) => {
        console.error('Error requesting invoice after sale:', error);
        const errorMsg = error.error?.error || 'Erreur lors de l\'envoi de la demande de facture';
        this.showAlertMessage(errorMsg, 'error');
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
    // Mark printed if sale has id
    if (sale && (sale as any).id) {
      this.salesService.markPrinted((sale as any).id).subscribe({
        next: () => { },
        error: () => { }
      });
    }
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

  validateTemporarySaleNewCustomerForm(): { isValid: boolean; missingFields: string[] } {
    const missingFields: string[] = [];

    if (!this.temporarySaleNewCustomer.firstName || this.temporarySaleNewCustomer.firstName.trim().length === 0) {
      missingFields.push('Prénom');
    }

    if (!this.temporarySaleNewCustomer.lastName || this.temporarySaleNewCustomer.lastName.trim().length === 0) {
      missingFields.push('Nom');
    }

    return {
      isValid: missingFields.length === 0,
      missingFields
    };
  }

  createTemporarySaleNewCustomer(): void {
    // Smart validation with detailed feedback
    const validation = this.validateTemporarySaleNewCustomerForm();

    if (!validation.isValid) {
      let errorMessage = '⚠️ Formulaire incomplet. Veuillez remplir les champs suivants :\n\n';
      validation.missingFields.forEach((field, index) => {
        errorMessage += `${index + 1}. ${field}\n`;
      });
      errorMessage += '\nTous les champs marqués (*) sont obligatoires.';
      this.showAlertMessage(errorMessage, 'error');
      return;
    }

    const newCustomerData = {
      firstName: this.temporarySaleNewCustomer.firstName.trim(),
      lastName: this.temporarySaleNewCustomer.lastName.trim(),
      phone: this.temporarySaleNewCustomer.phone?.trim() || undefined,
      email: this.temporarySaleNewCustomer.email?.trim() || undefined,
      clientType: 'INDIVIDUAL' as const
    };

    this.clientsService.createClient(newCustomerData).subscribe({
      next: (newCustomer) => {
        this.temporarySaleSelectedCustomer = newCustomer;
        this.showAlertMessage(`Nouveau client créé: ${newCustomer.firstName} ${newCustomer.lastName}`, 'success');

        // Add the new client directly to cache if it matches shop criteria
        const shouldShowInShop = !newCustomer.depotId || newCustomer.depotId === -1 ||
          (newCustomer.depot && newCustomer.depot.type === 'SHOP');

        if (shouldShowInShop) {
          // Add to cache if not already present
          const exists = this.allClientsCache.find(c => c.id === newCustomer.id);
          if (!exists) {
            this.allClientsCache.unshift(newCustomer); // Add at the beginning
          }
        }

        // Refresh the full client list in background
        this.fetchAllClients();

        this.resetTemporarySaleNewCustomerForm();
      },
      error: (error) => {
        const errorMessage = error?.error?.error || 'Erreur lors de la création du client';
        this.showAlertMessage(errorMessage, 'error');
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
    // If we're adding an advance for a temporary sale, compute against its remaining
    if (this.selectedTemporarySale) {
      const finalTotal = Number(this.selectedTemporarySale.finalTotal || 0);
      const alreadyAdvanced = Math.abs(Number(this.selectedTemporarySale.advancePayment || 0));
      const newAdvance = Number(this.advancePaymentAmount || 0);
      return this.roundToTenthAsThreeDecimals(Math.max(0, finalTotal - alreadyAdvanced - (isNaN(newAdvance) ? 0 : newAdvance)));
    }

    // Fallback: use active cart totals
    const activeCart = this.getActiveCart();
    if (!activeCart) return 0;
    const newAdvance = Number(this.advancePaymentAmount || 0);
    return this.roundToTenthAsThreeDecimals(Math.max(0, Number(activeCart.netTotal || 0) - (isNaN(newAdvance) ? 0 : newAdvance)));
  }

  getRemainingBeforeNewAdvance(): number {
    if (this.selectedTemporarySale) {
      const finalTotal = Number(this.selectedTemporarySale.finalTotal || 0);
      const alreadyAdvanced = Math.abs(Number(this.selectedTemporarySale.advancePayment || 0));
      return this.roundToTenthAsThreeDecimals(Math.max(0, finalTotal - alreadyAdvanced));
    }
    const activeCart = this.getActiveCart();
    return this.roundToTenthAsThreeDecimals(Number(activeCart?.netTotal || 0));
  }

  hasAdvancePayment(): boolean {
    return !!(this.advancePaymentAmount && this.advancePaymentAmount > 0);
  }

  getTemporarySaleBadge(): string {
    if (!this.isTemporarySale) return '';
    return this.getCartBadge();
  }

  getCartBadge(): string {
    const activeCart = this.getActiveCart();
    if (!activeCart || activeCart.items.length === 0) return 'Aucun article';

    const itemCount = activeCart.items.length;
    const totalQuantity = activeCart.items.reduce((sum, item) => sum + item.quantity, 0);

    // Show individual products with quantities
    const productList = activeCart.items.map(item => {
      const productName = item.product?.name || `Produit #${item.product?.id || 'N/A'}`;
      return `${productName} (x${item.quantity})`;
    }).join(', ');

    return `${itemCount} article${itemCount > 1 ? 's' : ''} (${totalQuantity} unités): ${productList}`;
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
    this.salesService.getSales({ status: 'TEMPORARY' }).subscribe({
      next: (sales) => {
        this.existingTemporarySales = sales;
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

        // Update ticket counter with actual ticket number from server
        this.updateTicketCounterFromSale(completedSale);

        // Refresh shop inventory to show updated stock quantities
        this.loadShopInventory();

        // Reset filter to "Tous" after finalizing temporary sale
        this.selectedCategory = 'Tous';
        this.filterProducts();

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

  // Add advance directly from payment popup without opening a separate dialog
  addAdvanceToTemporarySale(): void {
    if (!this.selectedTemporarySale) return;
    const newAdvance = Number(this.amountPaid || 0);
    if (!this.paymentType || isNaN(newAdvance) || newAdvance <= 0) {
      this.showAlertMessage('Veuillez saisir un montant et une méthode', 'error');
      return;
    }

    const remainingBefore = Math.max(0, Number(this.selectedTemporarySale.finalTotal || 0) - Math.abs(Number(this.selectedTemporarySale.advancePayment || 0)));
    if (newAdvance > remainingBefore) {
      this.showAlertMessage('Montant supérieur au reste', 'error');
      return;
    }

    const payload = {
      amount: this.roundToFiftyMillimes(newAdvance),
      method: this.paymentType as any,
      notes: this.advancePaymentNotes || ''
    };

    this.salesService.addAdvanceToTemporarySale(this.selectedTemporarySale.id, payload).subscribe({
      next: (updated) => {
        // Update local selected sale state
        this.selectedTemporarySale = { ...this.selectedTemporarySale!, advancePayment: updated.advancePayment } as any;
        this.amountPaid = undefined;
        this.paymentType = undefined;
        this.calculatedChange = 0;
        this.advancePaymentNotes = '';
        this.showAlertMessage('Avance ajoutée avec succès', 'success');
        // Refresh pending count/list if popup open
        this.loadPendingTemporarySalesCount();
      },
      error: () => {
        this.showAlertMessage('Erreur lors de l\'ajout de l\'avance', 'error');
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

  isQuickReasonSelected(reason: string): boolean {
    return this.giftReason.trim() == reason.trim();
  }

  isOtherReasonSelected(): boolean {
    return this.giftReason.trim().toLowerCase().includes('autre');
  }

  confirmGift(): void {
    if (!this.giftReason.trim()) {
      this.showAlertMessage('Veuillez sélectionner une raison du cadeau', 'error');
      return;
    }

    // If "Autre" is selected, require detailed reason (more than just "Autre")
    if (this.giftReason.trim() === 'Autre') {
      this.showAlertMessage('Veuillez spécifier la raison détaillée du cadeau', 'error');
      return;
    }

    const activeCart = this.getActiveCart();
    if (!activeCart) return;

    // Create gift sale data
    // Use currentShopDepotId to ensure stock is removed from the correct depot
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
      status: 'PENDING_ADMIN', // Send for approval - stock will be removed only after approval
      clientId: activeCart.clientId || undefined,
      depotId: this.currentShopDepotId || undefined // Pass depotId to ensure stock is removed from correct depot
    };

    // Save gift sale to backend
    this.salesService.createGiftSale(giftSaleData).subscribe({
      next: (savedSale) => {
        this.showAlertMessage('Demande de cadeau envoyée pour approbation! Le stock a été retiré.', 'success');

        // Auto-remove client after successful gift sale (except Client 1)
        this.autoRemoveClientAfterPayment(activeCart.id);
        this.showGiftPopup = false;
        this.giftReason = '';
        this.giftRecipient = '';
        this.loadPendingGiftSalesCount(); // Refresh the count

        // Refresh shop inventory to show updated stock quantities
        this.loadShopInventory();

        // Reset filter to "Tous" after successful gift sale
        this.selectedCategory = 'Tous';
        this.filterProducts();
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

  loadApprovedGiftSales(): void {
    this.salesService.getSales().subscribe({
      next: (sales) => {
        this.existingGiftSales = sales.filter(sale => sale.status === 'CADEAU');
        this.showExistingGiftSalesPopup = true;
      },
      error: (error) => {
        console.error('Error loading approved gift sales:', error);
        this.showAlertMessage('Erreur lors du chargement des cadeaux approuvés', 'error');
      }
    });
  }

  loadPendingGiftSales(): void {
    this.salesService.getSales().subscribe({
      next: (sales) => {
        this.existingGiftSales = sales.filter(sale => sale.status === 'PENDING_ADMIN');
        this.showExistingGiftSalesPopup = true;
      },
      error: (error) => {
        console.error('Error loading pending gift sales:', error);
        this.showAlertMessage('Erreur lors du chargement des cadeaux en attente', 'error');
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

        // Refresh shop inventory to show updated stock quantities after approval
        this.loadShopInventory();
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

  /** Parametres de l'entreprise, utilises pour l'en-tete des factures imprimees. */
  appSettings: any = null;

  loadSettings(): void {
    this.settingsService.getSettings().subscribe({
      next: (settings) => {
        this.appSettings = settings || null;
        if (settings?.maxDiscountPercent) {
          this.maxDiscountPercent = settings.maxDiscountPercent;
        }
        // Reste a true sauf si le reglage vaut explicitement false.
        this.allowNegativeStock = settings?.allowNegativeStock !== false;
      },
      error: (error) => {
        console.error('Error loading settings:', error);
      }
    });
  }

  loadCurrentSession(): void {
    // Always pass the current depot ID to ensure isolation
    this.sessionsService.getActiveSessionByDepot(1, this.currentShopDepotId).subscribe({
      next: (session) => {
        this.currentSession = session;
        this.isShiftOpen = !!session;
        if (session) {
          // Ensure depot ID is set first, then session ID
          this.ticketCounterService.setDepotId(session.depotId || this.currentShopDepotId);
          this.ticketCounterService.setSessionId(session.id);
        } else {
          // No session found, automatically open one
          this.autoOpenSession();
        }
      },
      error: (error) => {
        console.error('Error loading current session:', error);
        // Ensure depot ID is set even on error and try to open session
        this.ticketCounterService.setDepotId(this.currentShopDepotId);
        this.autoOpenSession();
      }
    });
  }

  autoOpenSession(): void {
    const defaultSession = {
      openingFund: 0,
      posId: 1,
      depotId: this.currentShopDepotId, // Ensure depot isolation
      note: 'Session automatique'
    };
    this.sessionsService.openSessionByDepot(defaultSession).subscribe({
      next: (session) => {
        this.currentSession = session;
        this.isShiftOpen = true;
        if (session) {
          this.ticketCounterService.setSessionId(session.id);
          this.ticketCounterService.setDepotId(session.depotId || this.currentShopDepotId);
        }
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
        this.showAlertMessage(`Extrait journalière imprimé - Retrait: ${this.closureForm.retraitCentrale} DT`, 'success');
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

  // Switch to price mode when PRIX button is clicked
  handleMultiply(): void {
    // Only switch to price mode when clicked, don't toggle back
    this.inputMode = 'price';
    this.currentInput = '';
  }

  addDecimal(): void {
    // Add . as per requirement
    this.currentInput += '.';
  }

  enterValue(): void {

    // Priority 1: If a receipt item is selected, modify its quantity (only in quantity mode)
    if (this.selectedReceiptItem && this.selectedReceiptItemIndex !== -1 && this.inputMode === 'quantity') {
      const quantity = parseFloat(this.currentInput);

      if (!isNaN(quantity) && quantity > 0) {
        // Update the quantity of the selected item
        if (this.selectedReceiptItem.isWholesale && this.selectedReceiptItem.bundleSize) {
          // For wholesale items, update bundle quantity
          this.selectedReceiptItem.bundleQuantity = quantity;
          this.selectedReceiptItem.quantity = this.roundQuantity(quantity * this.selectedReceiptItem.bundleSize);
          // Update to use current effective price (client-specific if available)
          const effectiveUnitPrice = this.getEffectiveUnitPrice(this.selectedReceiptItem.product);
          const effectiveBundlePrice = effectiveUnitPrice * this.selectedReceiptItem.bundleSize;
          this.selectedReceiptItem.bundlePrice = effectiveBundlePrice;
          this.selectedReceiptItem.unitPrice = effectiveUnitPrice;
          this.selectedReceiptItem.total = quantity * effectiveBundlePrice;
        } else {
          // For regular items, update quantity directly
          this.selectedReceiptItem.quantity = this.roundQuantity(quantity);
          // Update unitPrice to current effective price (client-specific if available)
          this.selectedReceiptItem.unitPrice = this.getEffectiveUnitPrice(this.selectedReceiptItem.product);
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
          lastItem.quantity = this.roundQuantity(quantity * lastItem.bundleSize);
          // Update to use current effective price (client-specific if available)
          const effectiveUnitPrice = this.getEffectiveUnitPrice(lastItem.product);
          const effectiveBundlePrice = effectiveUnitPrice * lastItem.bundleSize;
          lastItem.bundlePrice = effectiveBundlePrice;
          lastItem.unitPrice = effectiveUnitPrice;
          lastItem.total = quantity * effectiveBundlePrice;
        } else {
          // For regular items, update quantity directly
          lastItem.quantity = this.roundQuantity(quantity);
          // Update unitPrice to current effective price (client-specific if available)
          lastItem.unitPrice = this.getEffectiveUnitPrice(lastItem.product);
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
      this.selectedReceiptItem.quantity = this.roundQuantity(value / Number(this.selectedReceiptItem.unitPrice));
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
          value = this.getEffectiveUnitPrice(this.pendingProduct); // Default price
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

    // Reset to quantity mode after entering a price
    if (this.inputMode === 'price') {
      this.inputMode = 'quantity';
    }
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
    this.pendingPaymentNotes = `Encaissement caisse - ${new Date().toLocaleString('fr-FR')}`;
    this.showPaymentConfirmationDialog = true;
  }

  // Submit client payment to the API
  submitClientPayment(amount: number, notes?: string): void {
    // Use pendingPaymentClient if available (from search), otherwise use selectedClient
    const client = this.pendingPaymentClient || this.selectedClient;
    if (!client || !client.id) {
      this.showAlertMessage('Aucun client sélectionné', 'error');
      return;
    }

    const paymentData = {
      clientId: client.id,
      amount: amount,
      notes: notes || `Encaissement caisse - ${new Date().toLocaleString('fr-FR')}`
    };

    this.http.post(`${environment.apiUrl}/client-payments`, paymentData).subscribe({
      next: (response) => {
        const clientName = `${client.firstName} ${client.lastName}`;
        this.showAlertMessage(
          `Encaissement de ${new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'TND' }).format(amount)} enregistré avec succès pour ${clientName}`,
          'success'
        );

        // Refresh client data to update current debt
        if (this.pendingPaymentClient) {
          // Update pendingPaymentClient with new debt
          this.clientsService.getClient(client.id).subscribe({
            next: (updatedClient) => {
              this.pendingPaymentClient = updatedClient;
            },
            error: (error) => {
              console.error('Error refreshing client data:', error);
            }
          });
        } else {
          this.refreshSelectedClientData();
        }
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

  // Open client payment from search results
  openClientPaymentFromSearch(client: any): void {
    // Set the pending payment client
    this.pendingPaymentClient = client;
    // Set default amount to current debt if available, otherwise 0
    this.pendingPaymentAmount = parseFloat(client.currentDebt || 0);
    this.pendingPaymentNotes = '';

    // Open the payment confirmation dialog
    this.showPaymentConfirmationDialog = true;

    // Optionally close the client search popup
    // this.showClientSearchPopup = false;
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

    // Refresh the client search results to show updated debt
    if (this.clientSearchQuery) {
      this.searchClients();
    }
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

  // Input warning modal methods
  closeInputWarningModal(): void {
    this.showInputWarningModal = false;
  }

  proceedWithInput(): void {
    // Close the warning modal
    this.showInputWarningModal = false;

    // Show confirmation message
    this.showAlertMessage('Procéder avec la saisie en cours', 'info');

    // Process the current input first, then proceed with the sale
    this.enterValue();
    // Small delay to ensure input is processed before proceeding
    setTimeout(() => {
      this.validateESP();
    }, 100);
  }

  confirmInputWarningAndProceed(): void {
    // Clear the pending input
    this.currentInput = '';
    this.lastEnteredValue = '';
    this.pendingProduct = null;

    // Close the warning modal
    this.showInputWarningModal = false;

    // Show confirmation message
    this.showAlertMessage('Saisie effacée - Procéder à la vente', 'info');

    // Proceed with the sale
    this.validateESP();
  }

  loadPendingTemporarySalesCount(): void {
    this.salesService.getSales({ status: 'TEMPORARY' }).subscribe({
      next: (sales) => {
        this.pendingTemporarySalesCount = sales.length;
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
        <td style=\"padding:6px;border:1px solid #ddd;text-align:center;\">${Number(item.quantity).toFixed(3)}</td>
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
              <div class=\"muted\">Date: ${now.toLocaleDateString('fr-FR')} ${now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</div>
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
            ${activeCart.client && this.amountPaid !== undefined && Number(this.amountPaid) < Number(activeCart.netTotal) ? `<tr><td>Crédit client:</td><td class=\"right\">${(Number(activeCart.netTotal) - Number(this.amountPaid)).toFixed(3)} dt</td></tr>` : ''}
          </table>
        </div>
        <script>window.onload = function(){ window.print(); setTimeout(()=>window.close(), 400); };</script>
      </body>
      </html>
    `;

    // Desktop print via Tauri backend
    void this.printService.printHtml(html);
    this.invoiceMode = false;
  }

  // Product Modal Methods
  onProductModalModeChange(): void {
    if (this.productModalMode === 'quantity') {
      const unitPrice = this.selectedProduct ? this.getEffectiveUnitPrice(this.selectedProduct) : 0;
      this.productModalAmount = this.productModalQuantity * unitPrice;
    } else {
      const unitPrice = this.selectedProduct ? this.getEffectiveUnitPrice(this.selectedProduct) : 1;
      this.productModalQuantity = this.productModalAmount / unitPrice;
    }
  }

  onProductModalQuantityChange(): void {
    if (this.selectedProduct) {
      const unitPrice = this.getEffectiveUnitPrice(this.selectedProduct);
      this.productModalAmount = this.productModalQuantity * unitPrice;
    }
  }

  onProductModalAmountChange(): void {
    if (this.selectedProduct) {
      const unitPrice = this.getEffectiveUnitPrice(this.selectedProduct);
      if (unitPrice > 0) {
        this.productModalQuantity = this.productModalAmount / unitPrice;
      }
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
        const effectiveUnitPrice = this.getEffectiveUnitPrice(product);
        const effectiveBundlePrice = effectiveUnitPrice * product.bundleSize;
        existingItem.bundleQuantity = (existingItem.bundleQuantity || 0) + Number(quantity);
        existingItem.quantity = this.roundQuantity(existingItem.bundleQuantity * product.bundleSize);
        existingItem.bundlePrice = effectiveBundlePrice; // Update to use effective price (client-specific if available)
        existingItem.total = existingItem.bundleQuantity * effectiveBundlePrice;
      } else {
        // For regular items, update quantity directly
        existingItem.quantity = this.roundQuantity(Number(existingItem.quantity) + Number(quantity));
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
      // Calculate effective bundle price for wholesale items
      const effectiveBundlePrice = isWholesaleContext && product.isWholesale && product.bundleSize
        ? unitPrice * product.bundleSize
        : undefined;
      const bundleQuantity = isWholesaleContext && product.isWholesale ? Number(quantity) : undefined;
      // For wholesale items, total = bundleQuantity * effectiveBundlePrice
      // For regular items, total = quantity * unitPrice
      const total = (isWholesaleContext && product.isWholesale && effectiveBundlePrice && bundleQuantity)
        ? bundleQuantity * effectiveBundlePrice
        : Number(quantity) * Number(unitPrice);

      const newItem = {
        product,
        quantity: this.roundQuantity(isWholesaleContext && product.isWholesale && product.bundleSize ? Number(quantity) * product.bundleSize : Number(quantity)),
        unitPrice: Number(unitPrice),
        total: total,
        isGift: false,
        isWholesale: isWholesaleContext && product.isWholesale,
        bundleQuantity: bundleQuantity,
        bundleSize: isWholesaleContext && product.isWholesale ? product.bundleSize : undefined,
        bundlePrice: effectiveBundlePrice // Use effective bundle price (client-specific if available)
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
      existingItem.quantity = this.roundQuantity(Number(existingItem.quantity) + 1);
      existingItem.total = customTotal; // Use the custom total directly
      existingItem.unitPrice = customTotal; // Set unit price to the total (since quantity is 1)

      // Select the existing item
      this.selectedReceiptItem = existingItem;
      this.selectedReceiptItemIndex = activeCart.items.indexOf(existingItem);
    } else {
      const newItem = {
        product,
        quantity: this.roundQuantity(1),
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
      existingItem.quantity = this.roundQuantity(newQuantity);
      existingItem.total = Number(existingItem.quantity) * Number(existingItem.unitPrice);
      existingItem.quantity = this.roundQuantity(Number(existingItem.quantity));
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
      this.roundQuantity(roundedTotalAmount / originalPrice) : 1;

    const activeCart = this.getActiveCart();
    if (!activeCart) return;

    const existingItem = activeCart.items.find(item => item.product.id === product.id);

    if (existingItem) {
      // Replace the existing item with new calculated values
      existingItem.quantity = this.roundQuantity(calculatedQuantity);
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
        quantity: this.roundQuantity(calculatedQuantity), // Calculated: montant / unit_price
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
      existingItem.quantity = this.roundQuantity(customTotalPrice / Number(existingItem.unitPrice));
      existingItem.hasCustomTotal = true;

      // Select the existing item
      this.selectedReceiptItem = existingItem;
      this.selectedReceiptItemIndex = activeCart.items.indexOf(existingItem);
    } else {
      // Add new item with custom total price and calculate quantity
      const unitPrice = this.getEffectiveUnitPrice(product);
      const calculatedQuantity = this.roundQuantity(customTotalPrice / unitPrice);

      const newItem = {
        product,
        quantity: this.roundQuantity(calculatedQuantity),
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

  // Round quantity to 3 decimal places
  roundQuantity(quantity: number): number {
    return Math.round(quantity * 1000) / 1000;
  }

  closeProductModal(): void {
    this.showProductModal = false;
    this.selectedProduct = null;
    this.productModalQuantity = 1;
    this.productModalAmount = 0;
  }

  validateESP(): void {
    if (this.isReturnMode) {
      return;
    }

    // Check if there's pending input that needs to be handled first
    if (this.currentInput && this.currentInput !== '0' && !this.lastEnteredValue) {
      this.showInputWarningModal = true;
      return;
    }

    const activeCart = this.getActiveCart();
    if (!activeCart || activeCart.items.length === 0) {
      this.showAlertMessage('Aucun article dans le panier', 'error');
      return;
    }

    // Auto-submit the sale with ESP payment method and exact pricing
    this.paymentType = 'cash';
    this.amountPaid = activeCart.netTotal;
    this.salePaymentType = 'COMPTANT'; // Explicitly set to cash payment
    this.confirmPayment();
  }

  validateESPWithPrint(): void {
    if (this.isReturnMode) {
      return;
    }

    // Prevent double-click
    if (this.isProcessingPayment) {
      return;
    }

    // Check if there's pending input that needs to be handled first
    if (this.currentInput && this.currentInput !== '0' && !this.lastEnteredValue) {
      this.showInputWarningModal = true;
      return;
    }

    const activeCart = this.getActiveCart();
    if (!activeCart || activeCart.items.length === 0) {
      this.showAlertMessage('Aucun article dans le panier', 'error');
      return;
    }

    // Auto-submit the sale with ESP payment method and exact pricing, with print
    this.paymentType = 'cash';
    this.amountPaid = activeCart.netTotal;
    this.salePaymentType = 'COMPTANT'; // Explicitly set to cash payment
    this.processPaymentWithReceipt();
  }

  validateESPWithoutPrint(): void {
    if (this.isReturnMode) {
      return;
    }

    // Prevent double-click
    if (this.isProcessingPayment) {
      return;
    }

    // Check if there's pending input that needs to be handled first
    if (this.currentInput && this.currentInput !== '0' && !this.lastEnteredValue) {
      this.showInputWarningModal = true;
      return;
    }

    const activeCart = this.getActiveCart();
    if (!activeCart || activeCart.items.length === 0) {
      this.showAlertMessage('Aucun article dans le panier', 'error');
      return;
    }

    // Auto-submit the sale with ESP payment method and exact pricing, without print
    this.paymentType = 'cash';
    this.amountPaid = activeCart.netTotal;
    this.salePaymentType = 'COMPTANT'; // Explicitly set to cash payment
    this.processPaymentWithoutReceipt();
  }

  validateCredit(): void {
    this.openCreditModal();
  }

  getProductModalCalculatedAmount(): number {
    if (this.selectedProduct && this.productModalMode === 'quantity') {
      const unitPrice = this.getEffectiveUnitPrice(this.selectedProduct);
      return this.productModalQuantity * unitPrice;
    }
    return this.productModalAmount;
  }

  getProductModalCalculatedQuantity(): number {
    if (this.selectedProduct && this.productModalMode === 'amount') {
      const unitPrice = this.getEffectiveUnitPrice(this.selectedProduct);
      if (unitPrice > 0) {
        return this.productModalAmount / unitPrice;
      }
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
    return inventoryItem ? this.roundQuantity(parseFloat(inventoryItem.quantity)) : 0;
  }

  getRemainingStock(productId: number): number {
    const currentStock = this.getShopStock(productId);
    const activeCart = this.getActiveCart();

    if (!activeCart) return currentStock;

    // Calculate total quantity of this product in the current cart
    const cartQuantity = activeCart.items
      .filter(item => item.product.id === productId)
      .reduce((total, item) => total + item.quantity, 0);

    if (this.isReturnMode) {
      return this.roundQuantity(currentStock + cartQuantity);
    }

    return this.roundQuantity(currentStock - cartQuantity);
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
    // Prevent double clicks by implementing a cooldown
    const currentTime = Date.now();
    if (currentTime - this.lastClickTime < this.clickCooldown &&
      this.lastClickedProductId === product.id) {
      return;
    }
    this.lastClickTime = currentTime;
    this.lastClickedProductId = product.id;

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
        // Keep quantity mode - user can click PRIX button if they want to edit price
        this.inputMode = 'quantity';
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
          const effectiveUnitPrice = this.getEffectiveUnitPrice(product);
          const effectiveBundlePrice = effectiveUnitPrice * product.bundleSize;
          existingItem.bundleQuantity = (existingItem.bundleQuantity || 0) + 1;
          existingItem.quantity = this.roundQuantity(existingItem.bundleQuantity * product.bundleSize);
          existingItem.bundlePrice = effectiveBundlePrice; // Update to use effective price (client-specific if available)
          existingItem.total = existingItem.bundleQuantity * effectiveBundlePrice;
        } else {
          // For regular items, increment quantity directly
          existingItem.quantity = this.roundQuantity(Number(existingItem.quantity) + 1);
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

    // Le stock negatif n'interrompt jamais la vente : aucun controle ici.
    // (Le blocage precedent renvoyait sans rien ajouter une fois l'alerte
    // supprimee, ce qui rendait le clic sur un produit sans effet.)

    // Always default to quantity mode when selecting a new product
    // User must explicitly click PRIX button to enter price mode
    this.inputMode = 'quantity';

    // In quantity mode: automatically add +1, but allow custom quantity input
    this.addProductToReceiptWithQuantity(product, 1);
    this.pendingProduct = product;
    this.currentInput = ''; // Don't show "1" in input
  }

  showStockWarning(product: Product, quantity: number, currentStock: number): void {
    // Alerte de stock insuffisant supprimee : en fast-food la vente ne doit
    // jamais etre interrompue. Le stock peut devenir negatif sans avertir.
    return;

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
      // Aucun controle de stock : la quantite saisie est toujours acceptee.
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
    if (sale && (sale as any).id) {
      this.salesService.markPrinted((sale as any).id).subscribe({ next: () => { }, error: () => { } });
    }
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
              <div class="muted">Date: ${now.toLocaleDateString('fr-FR')} ${now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</div>
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
            ${this.lastValidatedSale.selectedClient && this.lastValidatedSale.amountPaid !== undefined && Number(this.lastValidatedSale.amountPaid) < Number(this.lastValidatedSale.netTotal) ? `<tr><td>Crédit client:</td><td class="right">${(Number(this.lastValidatedSale.netTotal) - Number(this.lastValidatedSale.amountPaid)).toFixed(3)} dt</td></tr>` : ''}
          </table>
        </div>
        <script>window.onload = function(){ window.print(); setTimeout(()=>window.close(), 400); };</script>
      </body>
      </html>
    `;

    // Desktop print via Tauri backend
    void this.printService.printHtml(html);
    this.invoiceMode = false;
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
      discount: Number(it.discount || 0),
      isWholesale: it.isWholesale || false,
      bundleQuantity: it.bundleQuantity || undefined,
      bundleSize: it.bundleSize || undefined,
      bundlePrice: it.bundlePrice || undefined
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
      id: source?.id || this.lastValidatedSale?.id || Date.now(),
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
      loyaltyPointsEarned: source?.loyaltyEarned,
      // Add daily ticket number for printing: prefer lastValidatedSale or ticket from server
      dailyTicketNumber: source?.dailyTicketNumber || this.lastValidatedSale?.dailyTicketNumber || undefined
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
      if (this.selectedReceiptItem.isWholesale && this.selectedReceiptItem.bundleSize) {
        // For wholesale items, update bundle quantity
        const bundleQuantity = this.roundQuantity(newQuantity / this.selectedReceiptItem.bundleSize);
        this.selectedReceiptItem.bundleQuantity = bundleQuantity;
        this.selectedReceiptItem.quantity = this.roundQuantity(newQuantity);
        // Update to use current effective price (client-specific if available)
        const effectiveUnitPrice = this.getEffectiveUnitPrice(this.selectedReceiptItem.product);
        const effectiveBundlePrice = effectiveUnitPrice * this.selectedReceiptItem.bundleSize;
        this.selectedReceiptItem.bundlePrice = effectiveBundlePrice;
        this.selectedReceiptItem.unitPrice = effectiveUnitPrice;
        this.selectedReceiptItem.total = bundleQuantity * effectiveBundlePrice;
      } else {
        // For regular items, update quantity and ensure unitPrice is current
        this.selectedReceiptItem.quantity = this.roundQuantity(newQuantity);
        // Update unitPrice to current effective price (client-specific if available)
        this.selectedReceiptItem.unitPrice = this.getEffectiveUnitPrice(this.selectedReceiptItem.product);
        this.selectedReceiptItem.total = Number(this.selectedReceiptItem.quantity) * Number(this.selectedReceiptItem.unitPrice);
      }
      this.currentInput = newQuantity.toString();
      // this.showAlertMessage(`Quantité mise à jour: ${newQuantity}`, 'info');
    }

    this.calculateTotals();
  }

  // Ticket number management methods
  getCurrentTicketNumber(): string {
    return this.currentTicketNumber.toString().padStart(4, '0');
  }

  getFormattedTicketNumber(ticket: Sale): string {
    // If we have a stored daily ticket number, extract just the ticket number part
    if (ticket.dailyTicketNumber) {
      // Check if it contains a slash (old format: "sessionId/ticketNumber")
      if (ticket.dailyTicketNumber.includes('/')) {
        return ticket.dailyTicketNumber.split('/')[1];
      }
      // If no slash, it's already just the ticket number
      return ticket.dailyTicketNumber;
    }

    // For existing sales without dailyTicketNumber, use the sale ID
    return ticket.id.toString().padStart(4, '0');
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
    // Load current session tickets instead of today's
    this.loadSessionTickets();
    this.showTicketMenu = true;
  }

  loadTodaysTickets(): void { this.loadSessionTickets(); }

  private loadSessionTickets(): void {
    this.loadingTodaysTickets = true;
    this.salesService.getCurrentSessionTickets().subscribe({
      next: (tickets) => {
        // Sort by session ticket number descending to keep sequence consistent
        const extractNumber = (t: any): number => {
          const raw = (t?.dailyTicketNumber || '').toString();
          if (raw && raw.includes('/')) {
            const part = raw.split('/')[1];
            const n = parseInt(part, 10);
            return isNaN(n) ? 0 : n;
          }
          if (raw) {
            const n = parseInt(raw, 10);
            if (!isNaN(n)) return n;
          }
          return 0;
        };
        this.todaysTickets = (tickets || []).slice().sort((a: any, b: any) => extractNumber(b) - extractNumber(a));
        // Also load approved invoices to decorate tickets
        this.http.get(`${environment.apiUrl}/invoices?status=ISSUED&limit=200`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }).subscribe({
          next: (response: any) => {
            this.approvedInvoices = response.invoices || [];
            this.unprintedInvoicesCount = this.approvedInvoices.filter((inv: any) => !inv.printedAt).length;
            this.approvedInvoicesSet = new Set<number>(
              this.approvedInvoices
                .map((inv: any) => inv.saleId)
                .filter((id: any) => typeof id === 'number')
            );
            this.loadingTodaysTickets = false;
            // Also load pending requests to ensure "Facture Envoyé" status is up to date
            this.loadPendingInvoiceRequests();
          },
          error: () => {
            this.approvedInvoices = [];
            this.approvedInvoicesSet.clear();
            this.unprintedInvoicesCount = 0;
            this.loadingTodaysTickets = false;
          }
        });
      },
      error: (error) => {
        console.error('Error loading session tickets:', error);
        this.loadingTodaysTickets = false;
      }
    });
  }

  isTicketInvoiceApproved(ticket: any): boolean {
    return this.approvedInvoicesSet.has(ticket?.id);
  }

  isTicketInvoicePrinted(ticket: any): boolean {
    return this.printedInvoicesSet.has(ticket?.id);
  }

  isTicketWholesale(ticket: any): boolean {
    return ticket?.isWholesale || (ticket?.items && ticket.items.some((item: any) => item.isWholesale));
  }

  getTicketStatusClass(ticket: any): string {
    if (this.isTicketPendingRefund(ticket)) {
      return 'bg-orange-100 text-orange-700';
    }
    if (ticket.status === 'COMPLETED') {
      return this.isTicketWholesale(ticket) ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700';
    }
    if (ticket.status === 'TEMPORARY') {
      return 'bg-yellow-100 text-yellow-700';
    }
    if (ticket.status === 'PENDING') {
      return 'bg-orange-100 text-orange-700';
    }
    if (ticket.status === 'REFUNDED') {
      return 'bg-red-100 text-red-700';
    }
    if (ticket.status === 'CANCELLED') {
      return 'bg-gray-200 text-gray-700';
    }
    return 'bg-gray-100 text-gray-700';
  }

  getTicketStatusText(ticket: any): string {
    if (this.isTicketPendingRefund(ticket)) {
      return 'Annulation en cours';
    }

    // Check for invoice status before other statuses
    if (this.isTicketInvoiceApproved(ticket)) {
      return 'Facture';
    }
    if (this.hasPendingInvoiceRequest(ticket)) {
      return 'Facture Envoyé';
    }

    if (ticket.status === 'COMPLETED') {
      return this.isTicketWholesale(ticket) ? 'Gros' : 'Terminé';
    }
    if (ticket.status === 'TEMPORARY') {
      return 'Temporaire';
    }
    if (ticket.status === 'PENDING') {
      return 'En attente';
    }
    if (ticket.status === 'REFUNDED') {
      return 'Retourné';
    }
    if (ticket.status === 'CANCELLED') {
      return 'Annulé';
    }
    return ticket.status || '';
  }

  onTicketSelect(ticket: Sale): void {
    this.showTicketMenu = false;
    this.selectedTicket = ticket;
    this.showTicketActionDialog = true;
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

  // Ticket action dialog methods
  onTicketActionSelected(actionId: string): void {
    if (!this.selectedTicket) return;

    const ticket = this.selectedTicket; // Store reference before closing dialog

    switch (actionId) {
      case 'print-ticket':
        this.printTicket(ticket);
        this.closeTicketActionDialog();
        break;
      case 'request-invoice':
        // If approved, print invoice instead
        if (this.isTicketInvoiceApproved(ticket)) {
          const match = this.approvedInvoices.find(inv => inv.saleId === ticket.id);
          if (match) {
            this.printApprovedInvoice(match);
            this.closeTicketActionDialog();
            return;
          }
        }
        // If pending, warn the user but still allow action
        if (this.hasPendingInvoiceRequest(ticket)) {
          this.showAlertMessage('Facture déjà demandée: en attente d\'approbation admin', 'warning');
          return;
        }
        // Otherwise open request modal for this sale
        this.requestInvoiceFromSale(ticket);
        this.closeTicketActionDialog();
        break;
      case 'return-exchange':
        this.openReturnExchangeDialog(ticket);
        this.closeTicketActionDialog();
        break;
      case 'check-details':
        this.showTicketDetails(ticket);
        this.closeTicketActionDialog();
        break;
      case 'instant-refund':
        // Open confirmation modal before cancelling
        this.openCancelTicketModal(ticket);
        this.closeTicketActionDialog();
        break;
    }
  }
  // Simple ticket cancel (no refund, just subtract from caisse and strike ticket)
  cancelTicket(ticket: Sale): void {
    if (!ticket?.id) return;
    // Guard: avoid duplicate cancel if already cancelled/refunded
    const status = (ticket as any)?.status ? String((ticket as any).status).toUpperCase() : '';
    if (status === 'CANCELLED' || status === 'REFUNDED') {
      this.showAlertMessage('Ticket déjà annulé', 'info');
      return;
    }
    this.http.put(`${environment.apiUrl}/sales/${ticket.id}/status`, { status: 'CANCELLED' }, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    }).subscribe({
      next: () => {
        this.showAlertMessage('Ticket annulé', 'success');
        // Refresh session tickets and summary
        this.loadTodaysTickets();
        this.sessionsService.getActiveSessionByDepot().subscribe();
        this.closeCancelTicketModal();
      },
      error: () => {
        this.showAlertMessage('Erreur lors de l\'annulation du ticket', 'error');
      }
    });
  }

  // Cancel ticket confirmation modal state
  showCancelTicketModal = false;
  ticketToCancel: Sale | null = null;

  openCancelTicketModal(ticket: Sale): void {
    // Prevent opening if already finalised
    const st = (ticket as any)?.status ? String((ticket as any).status).toUpperCase() : '';
    if (st === 'CANCELLED' || st === 'REFUNDED') {
      this.showAlertMessage('Ticket déjà annulé', 'info');
      return;
    }
    this.ticketToCancel = ticket;
    this.showCancelTicketModal = true;
  }

  closeCancelTicketModal(): void {
    this.showCancelTicketModal = false;
    this.ticketToCancel = null;
  }

  confirmCancelTicket(): void {
    if (!this.ticketToCancel) return;
    this.cancelTicket(this.ticketToCancel);
  }

  closeTicketActionDialog(): void {
    this.showTicketActionDialog = false;
    // Don't clear selectedTicket if we're showing the details modal
    if (!this.showTicketDetailsModal) {
      this.selectedTicket = null;
    }
  }

  // Gift action dialog methods
  onGiftActionSelected(actionId: string): void {
    switch (actionId) {
      case 'consult-approved':
        this.loadApprovedGiftSales();
        this.closeGiftActionDialog();
        break;
      case 'consult-pending':
        this.loadPendingGiftSales();
        this.closeGiftActionDialog();
        break;
      case 'add-from-cart':
        this.markAsGift();
        this.closeGiftActionDialog();
        break;
    }
  }

  closeGiftActionDialog(): void {
    this.showGiftActionDialog = false;
  }

  private loadFullSaleIfNeeded(ticket: Sale): Promise<Sale> {
    if (ticket && Array.isArray(ticket.items) && ticket.items.length > 0 && ticket.items[0]?.productName) {
      return Promise.resolve(ticket);
    }
    return new Promise((resolve, reject) => {
      if (!ticket?.id) {
        resolve(ticket);
        return;
      }
      this.salesService.getSale(ticket.id).subscribe({
        next: (full) => resolve(full),
        error: () => reject(new Error('Failed to load full sale'))
      });
    });
  }

  printTicket(ticket: Sale): void {
    // Ensure we have full items before printing
    this.loadFullSaleIfNeeded(ticket)
      .then((full) => {
        try {
          this.printService.printSaleReceipt(full);
          this.showAlertMessage('Ticket imprimé avec succès', 'success');
        } catch (error) {
          this.showAlertMessage('Erreur lors de l\'impression du ticket', 'error');
        }
      })
      .catch(() => this.showAlertMessage('Impossible de charger les articles du ticket', 'error'));
  }

  showTicketDetails(ticket: Sale): void {
    // Load full sale if needed, then show details
    this.loadFullSaleIfNeeded(ticket)
      .then((full) => {
        this.selectedTicket = full;
        this.showTicketDetailsModal = true;
      })
      .catch(() => this.showAlertMessage('Impossible de charger les détails du ticket', 'error'));
  }

  closeTicketMenu(): void {
    this.showTicketMenu = false;
  }

  closeTicketDetailsModal(): void {
    this.showTicketDetailsModal = false;
    this.selectedTicket = null;
  }

  onTicketDetailsPrintRequested(ticket: Sale): void {
    this.printTicket(ticket);
    this.closeTicketDetailsModal();
  }

  onTicketDetailsReturnExchangeRequested(ticket: Sale): void {
    this.openReturnExchangeDialog(ticket);
    this.closeTicketDetailsModal();
  }

  // Open ticket action dialog for the last validated sale from the top bar shortcut
  openLastSaleMenu(): void {
    if (!this.lastValidatedSale) return;
    // lastValidatedSale is built for printing; ensure we at least have an id
    const ticket = (this.lastValidatedSale as any).id ? (this.lastValidatedSale as any) : null;
    if (ticket) {
      this.selectedTicket = ticket as Sale;
      this.showTicketActionDialog = true;
    }
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
    this.ticketCounterService.incrementTicketNumber();
  }

  resetTicketNumber(): void {
    this.ticketCounterService.resetTicketCounter();
  }

  updateTicketCounterFromSale(sale: any): void {
    if (sale && sale.dailyTicketNumber) {
      // Extract ticket number from the dailyTicketNumber field
      const extractNumber = (ticketNumber: string): number => {
        if (!ticketNumber) return 0;
        const s = String(ticketNumber);
        if (s.includes('/')) {
          const part = s.split('/')[1];
          const n = parseInt(part, 10);
          return isNaN(n) ? 0 : n;
        }
        const n = parseInt(s, 10);
        return isNaN(n) ? 0 : n;
      };

      const ticketNumber = extractNumber(sale.dailyTicketNumber);

      // Update ticket counter to be the next number after this sale
      if (ticketNumber > 0) {
        this.ticketCounterService.setCurrentTicketNumberIfHigher(ticketNumber + 1);
      } else {
        // Fallback to increment if we can't extract the number
        this.ticketCounterService.incrementTicketNumber();
      }
    } else {
      // Fallback to increment if no ticket number is available
      this.ticketCounterService.incrementTicketNumber();
    }
  }

  // Ensure we never go backwards on ticket numbering during this session
  private syncTicketCounterFromTodaySales(): void {
    // Only attempt after depot/session wiring is done; harmless if called early
    this.salesService.getCurrentSessionTickets().subscribe({
      next: (tickets) => {
        if (!Array.isArray(tickets) || tickets.length === 0) {
          // No tickets found for this session, reset to 1
          this.ticketCounterService.setCurrentTicketNumber(1);
          return;
        }
        // Determine the highest ticket number among current session tickets
        const extractNumber = (t: any): number => {
          const raw = (t?.dailyTicketNumber || '').toString();
          if (raw && raw.includes('/')) {
            const part = raw.split('/')[1];
            const n = parseInt(part, 10);
            return isNaN(n) ? 0 : n;
          }
          if (raw) {
            const n = parseInt(raw, 10);
            if (!isNaN(n)) return n;
          }
          // Fallback: derive from sale id order if needed
          return 0;
        };
        const maxSession = tickets.reduce((max: number, t: any) => Math.max(max, extractNumber(t)), 0);
        if (maxSession > 0) {
          // Next ticket to issue is max + 1 (align exactly with server session)
          this.ticketCounterService.setCurrentTicketNumber(maxSession + 1);
        } else {
          // No valid ticket numbers found, reset to 1
          this.ticketCounterService.setCurrentTicketNumber(1);
        }
      },
      error: () => {
        // On error, reset to 1 to be safe
        this.ticketCounterService.setCurrentTicketNumber(1);
      }
    });
  }


  ngOnDestroy(): void {
    // Clean up barcode scanner timeout
    if (this.barcodeTimeout) {
      clearTimeout(this.barcodeTimeout);
    }

    if (this.invoiceRefreshInterval) {
      clearInterval(this.invoiceRefreshInterval);
    }

    this.destroy$.next();
    this.destroy$.complete();
    this.removeTouchEventListeners();

    // Clear image cache to prevent memory leaks
    this.imagePreloadService.clearCache();

    // Leave depot room and disconnect socket
    if (this.currentShopDepotId) {
      if (environment.enableRealtime) {
        this.socketService.leaveDepot(this.currentShopDepotId);
      }
    }
    if (environment.enableRealtime) {
      this.socketService.disconnect();
    }
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
        // Prevent page changes when drag mode (Modifier) is enabled
        if (this.dragModeEnabled) {
          return;
        }
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

    // Always record the product and position for click detection
    this.currentTouchProduct = product;
    this.currentTouchStartPosition = { x: event.clientX, y: event.clientY };
    this.dragDetectionStarted = false; // Reset drag detection flag

    // Only allow drag detection if drag mode is enabled
    if (!this.dragModeEnabled) {
      return;
    }

    // Prevent default to avoid text selection
    event.preventDefault();
  }

  onProductMouseMove(event: MouseEvent): void {
    if (!this.isDragMode && this.dragModeEnabled) {
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
    if (this.isDragMode && this.dragModeEnabled) {
      // Handle drag end
      const dragState = this.dragDropService.getCurrentDragState();
      if (dragState.targetGlobalIndex !== null) {
        // Calculate source and destination pages
        const fromPage = Math.floor(dragState.fromGlobalIndex / this.productsPerPage);
        const toPage = Math.floor(dragState.targetGlobalIndex / this.productsPerPage);

        // Show confirmation notification if moving to a different page
        if (fromPage !== toPage) {
          const productName = dragState.draggedProduct?.name || 'Produit';
          this.showAlertMessage(
            `${productName} déplacé de la page ${fromPage + 1} vers la page ${toPage + 1}`,
            'success'
          );
        }

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

    // Always record the product and position for click detection
    const touch = event.touches[0];
    this.currentTouchProduct = product;
    this.currentTouchStartPosition = { x: touch.clientX, y: touch.clientY };
    this.dragDetectionStarted = false; // Reset drag detection flag

    // Only allow drag detection if drag mode is enabled
    if (!this.dragModeEnabled) {
      return;
    }

    // Prevent default to avoid scrolling
    event.preventDefault();
  }

  onProductTouchMove(event: TouchEvent): void {
    if (event.touches.length !== 1) return;

    if (!this.isDragMode && this.dragModeEnabled) {
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
    if (this.isDragMode && this.dragModeEnabled) {
      // Handle drag end
      const dragState = this.dragDropService.getCurrentDragState();
      if (dragState.targetGlobalIndex !== null) {
        // Calculate source and destination pages
        const fromPage = Math.floor(dragState.fromGlobalIndex / this.productsPerPage);
        const toPage = Math.floor(dragState.targetGlobalIndex / this.productsPerPage);

        // Show confirmation notification if moving to a different page
        if (fromPage !== toPage) {
          const productName = dragState.draggedProduct?.name || 'Produit';
          this.showAlertMessage(
            `${productName} déplacé de la page ${fromPage + 1} vers la page ${toPage + 1}`,
            'success'
          );
        }

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
    if (!this.isDragMode || !this.dragModeEnabled) return;

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
    if (!this.isDragMode || !this.dragModeEnabled) return;

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
    // First check if there's a client-specific price for the selected client
    // This should match the logic in client-gros getWholesalePrice method
    if (this.selectedClient) {
      // Check for direct product ID match
      if (this.clientPrices.has(product.id)) {
        const clientPrice = this.clientPrices.get(product.id)!;
        // Apply wholesale rules if any
        const rule = this.findRuleForProduct(product.id);
        if (rule) {
          const val = Number(rule.value) || 0;
          if (rule.ruleType === 'percentage') return clientPrice * (1 - val / 100);
          if (rule.ruleType === 'fixed') return val;
          if (rule.ruleType === 'discount') return Math.max(0, clientPrice - val);
        }
        return clientPrice;
      }

      // Also check for parent product ID if this is a variant
      const parentProductId = product.parentProductId;
      if (parentProductId && parentProductId > 0 && this.clientPrices.has(parentProductId)) {
        const clientPrice = this.clientPrices.get(parentProductId)!;
        // Apply wholesale rules if any (check both product.id and parentProductId)
        const rule = this.findRuleForProduct(product.id) || this.findRuleForProduct(parentProductId);
        if (rule) {
          const val = Number(rule.value) || 0;
          if (rule.ruleType === 'percentage') return clientPrice * (1 - val / 100);
          if (rule.ruleType === 'fixed') return val;
          if (rule.ruleType === 'discount') return Math.max(0, clientPrice - val);
        }
        return clientPrice;
      }
    }

    // Use depot-specific price if available, otherwise use default price
    const depotId = this.currentShopDepotId;
    let baseUnit = Number(product.prix_vente_TTC) || 0;

    if (depotId && product.depotPrices && product.depotPrices.length > 0) {
      const depotPrice = product.depotPrices.find((dp: any) => dp.depotId === depotId);
      if (depotPrice) {
        baseUnit = Number(depotPrice.prix_vente_TTC) || 0;
      }
    }

    // Get bundle config - check parent product if this is a variant (matches client-gros logic)
    let bundlePrice = Number(product.bundlePrice) || 0;
    let bundleSize = Number(product.bundleSize) || 0;
    const parentProductId = product.parentProductId;

    // If no bundle config on current product and it's a variant, check parent product
    if ((bundlePrice === 0 || bundleSize === 0) && parentProductId && parentProductId > 0) {
      const parentProduct = this.allProducts.find(p => p.id === parentProductId);
      if (parentProduct) {
        bundlePrice = Number(parentProduct.bundlePrice) || 0;
        bundleSize = Number(parentProduct.bundleSize) || 0;
      }
    }

    // If product is wholesale-capable, calculate unit price per item (bundlePrice / bundleSize)
    // This matches the logic in client-gros getBaseWholesalePrice method
    const baseForWholesale = (product.isWholesale && bundlePrice > 0 && bundleSize > 0)
      ? bundlePrice / bundleSize
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
    // First check if there's a client-specific price (from client-gros)
    // This should match the logic in client-gros getWholesalePrice method
    // Check both selectedClient (for regular sales) and returnClient (for returns)
    const activeClient = this.selectedClient || this.returnClient;
    if (activeClient) {
      // Check for direct product ID match
      if (this.clientPrices.has(product.id)) {
        return this.clientPrices.get(product.id)!;
      }

      // Also check for parent product ID if this is a variant
      const parentProductId = product.parentProductId;
      if (parentProductId && parentProductId > 0 && this.clientPrices.has(parentProductId)) {
        return this.clientPrices.get(parentProductId)!;
      }
    }

    const isWholesaleContext = this.isWholesaleMode || (this.selectedClient?.clientType === 'WHOLESALE') || (this.returnClient?.clientType === 'WHOLESALE');
    if (isWholesaleContext) {
      return this.getWholesaleUnitPrice(product);
    }

    // Use depot-specific price if available
    const depotId = this.currentShopDepotId;
    if (depotId && product.depotPrices && product.depotPrices.length > 0) {
      const depotPrice = product.depotPrices.find((dp: any) => dp.depotId === depotId);
      if (depotPrice) {
        return Number(depotPrice.prix_vente_TTC) || 0;
      }
    }

    // Fallback to default price
    return Number(product.prix_vente_TTC) || 0;
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

  loadPendingReturnRequests(): void {
    this.returnsService.listReturnRequests('PENDING').subscribe({
      next: (requests) => {
        this.pendingReturnRequests = requests;
        // Update the fast lookup set
        this.pendingReturnRequestsSet.clear();
        requests.forEach(request => {
          if (request.originalSaleId) {
            this.pendingReturnRequestsSet.add(request.originalSaleId);
          }
        });
      },
      error: (error) => {
        console.error('Error loading pending return requests:', error);
        this.pendingReturnRequests = [];
        this.pendingReturnRequestsSet.clear();
      }
    });
  }

  hasPendingInvoiceRequest(ticket: any): boolean {
    if (!ticket || !ticket.id) return false;
    return this.pendingInvoiceRequestsSet.has(Number(ticket.id));
  }

  hasPendingRefundRequest(ticket: any): boolean {
    if (!ticket) return false;
    return this.pendingReturnRequestsSet.has(ticket.id);
  }

  isTicketPendingRefund(ticket: any): boolean {
    if (!ticket) return false;
    return (ticket as any).isPendingRefund || this.hasPendingRefundRequest(ticket);
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
      status: 'COMPLETED', // Mark as completed since we're requesting an invoice
      dailyTicketNumber: this.getCurrentTicketNumber()
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
            // Clear the cart since the sale is now completed
            this.clearCart(this.activeCartId);
            // Reset filter to "Tous" after successful sale
            this.selectedCategory = 'Tous';
            this.filterProducts();
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
        this.loadPendingInvoiceRequests(); // Immediate refresh
        this.closeInvoiceRequestModal();
      },
      error: (error) => {
        console.error('Error submitting invoice request:', error);
        const errorMsg = error.error?.error || 'Erreur lors de l\'envoi de la demande';
        this.showAlertMessage(errorMsg, 'error');
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

  // Supplier quick actions
  openSupplierQuickActions(): void {
    this.showSupplierActionsModal = true;
    this.supplierSearch = '';
    this.selectedSupplierForAction = null;
    this.supplierAction = null;
    this.supplierPaymentAmount = '';
    this.supplierPaymentNotes = '';
    this.expenseTotalAmount = '';
    this.expensePaidAmount = '';
    this.expenseDescription = '';
    this.expenseNotes = '';
    this.loadSuppliersForQuickActions();
  }

  closeSupplierQuickActions(): void {
    this.showSupplierActionsModal = false;
    this.supplierResults = [];
    this.selectedSupplierForAction = null;
    this.supplierAction = null;
    
    // Reset payment form
    this.showSupplierPaymentForm = false;
    this.supplierPaymentAmount = '';
    this.supplierPaymentMethod = 'CASH';
    this.supplierPaymentNotes = '';
    this.remainingCashAfterSupplier = null;
    
    // Reset expense form
    this.showExpenseForm = false;
    this.expenseTotalAmount = '';
    this.expensePaidAmount = '';
    this.expenseDescription = '';
    this.expenseNotes = '';
    this.expensePaymentType = 'CASH';
    this.expensePayNow = true;
    this.expenseStep = 'category';
    this.selectedExpenseCategory = null;
    this.expenseSupplierId = undefined;
    this.remainingCashAfterExpense = null;
    this.editingExpenseField = null;
    this.currentInput = '';
  }

  loadSuppliersForQuickActions(): void {
    this.loadingSuppliers = true;
    this.supplierService.getSuppliers().subscribe({
      next: (suppliers: any[]) => {
        const activeSuppliers = (suppliers || []).filter((s: any) => s.isActive !== false);

        // Fetch statement for each supplier to get balance from relvee fournisseur
        if (activeSuppliers.length === 0) {
          this.supplierResults = [];
          this.loadingSuppliers = false;
          return;
        }

        // Create observables for fetching statements (with wide date range to get all transactions)
        // Use a date 10 years ago to ensure we get all transactions
        const startDate = new Date();
        startDate.setFullYear(startDate.getFullYear() - 10);
        const endDate = new Date().toISOString().split('T')[0];
        const startDateStr = startDate.toISOString().split('T')[0];

        const statementObservables = activeSuppliers.map(supplier =>
          this.supplierService.getSupplierStatement(supplier.id, startDateStr, endDate).pipe(
            map(statement => ({ supplier, balance: statement.currentBalance })),
            catchError(() => of({ supplier, balance: supplier.currentDebt || 0 })) // Fallback to currentDebt if statement fails
          )
        );

        // Fetch all statements in parallel
        forkJoin(statementObservables).subscribe({
          next: (results) => {
            // Map suppliers with their statement balances
            this.supplierResults = results.map(result => ({
              ...result.supplier,
              currentDebt: result.balance // Use balance from statement instead of currentDebt
            }));
            this.loadingSuppliers = false;
          },
          error: () => {
            // Fallback: use currentDebt if all statements fail
            this.supplierResults = activeSuppliers;
            this.loadingSuppliers = false;
          }
        });
      },
      error: () => {
        this.supplierResults = [];
        this.loadingSuppliers = false;
      }
    });
  }

  filterSuppliersQuick(): any[] {
    const q = (this.supplierSearch || '').trim().toLowerCase();
    if (!q) return this.supplierResults.slice(0, 20);
    return this.supplierResults.filter(s =>
      (s.name || '').toLowerCase().includes(q) ||
      (s.code || '').toLowerCase().includes(q) ||
      (s.phone || '').toLowerCase().includes(q)
    ).slice(0, 20);
  }

  pickSupplierForAction(s: any): void {
    this.selectedSupplierForAction = s;
  }

  proceedSupplierAction(action: 'regler' | 'depense'): void {
    if (!this.selectedSupplierForAction) {
      this.showAlertMessage('Veuillez sélectionner un fournisseur', 'error');
      return;
    }

    this.supplierAction = action;

    if (action === 'regler') {
      // Open payment form for supplier
      this.showSupplierPaymentForm = true;
      this.supplierPaymentAmount = '';
      this.supplierPaymentMethod = 'CASH';
      this.supplierPaymentNotes = `Règlement fournisseur depuis la caisse pour ${this.selectedSupplierForAction.name}`;
      this.updateRemainingCashSupplier();
    } else if (action === 'depense') {
      // Open expense form for supplier
      this.showExpenseForm = true;
      this.expenseStep = 'category';
      this.expenseTotalAmount = '';
      this.expensePaidAmount = '';
      this.expenseDescription = `Dépense liée au fournisseur ${this.selectedSupplierForAction.name}`;
      this.expensePaymentType = 'CASH';
      this.expenseNotes = '';
      this.expenseSupplierId = this.selectedSupplierForAction.id;
      this.expensePayNow = false; // Default to credit (unchecked)
      this.expenseCollectionDate = new Date().toISOString().split('T')[0];
      this.editingExpenseField = 'total'; // Auto-focus on total amount
      this.currentInput = '';
      this.loadExpenseCategories();
      this.updateRemainingCashExpense();
    }
  }

  submitSupplierPayment(): void {
    if (!this.selectedSupplierForAction) return;
    const amount = Number(this.supplierPaymentAmount || 0);
    if (amount <= 0) {
      this.showAlertMessage('Montant invalide', 'error'); return;
    }
    this.submittingSupplierAction = true;
    this.supplierService.createSupplierPayment({
      supplierId: this.selectedSupplierForAction.id,
      amount,
      paymentMethod: this.supplierPaymentMethod,
      notes: this.supplierPaymentNotes || 'Règlement via caisse'
    }).subscribe({
      next: () => {
        this.showAlertMessage('Règlement fournisseur enregistré', 'success');
        this.submittingSupplierAction = false;
        this.showSupplierPaymentForm = false;
        this.closeSupplierQuickActions();
      },
      error: () => {
        this.submittingSupplierAction = false;
        this.showAlertMessage('Erreur lors de l\'enregistrement du règlement', 'error');
      }
    });
  }

  private getSessionExpectedCash(): number {
    const exp = (this.currentSession?.summary?.expectedCash ?? this.currentSession?.expectedCash ?? 0);
    return Number(exp) || 0;
  }

  updateRemainingCashSupplier(): void {
    if (this.supplierPaymentMethod !== 'CASH') {
      this.remainingCashAfterSupplier = null;
      return;
    }
    const base = this.getSessionExpectedCash();
    const amt = Number(this.supplierPaymentAmount || 0);
    this.remainingCashAfterSupplier = this.roundToTenthAsThreeDecimals(base - (isNaN(amt) ? 0 : amt));
  }

  updateRemainingCashExpense(): void {
    if (this.expensePaymentType !== 'CASH') {
      this.remainingCashAfterExpense = null;
      return;
    }
    const base = this.getSessionExpectedCash();
    const amt = Number(this.expenseTotalAmount || 0);
    this.remainingCashAfterExpense = this.roundToTenthAsThreeDecimals(base - (isNaN(amt) ? 0 : amt));
  }

  submitSupplierExpense(): void {
    if (!this.selectedSupplierForAction) return;
    const amount = Number(this.expenseTotalAmount || 0);
    if (amount <= 0) { this.showAlertMessage('Montant invalide', 'error'); return; }
    
    // Determine if expense is paid based on the checkbox
    const isPaid = this.expensePayNow;
    const paidAmount = isPaid ? Number(this.expensePaidAmount || amount) : 0;
    
    // Get current date in YYYY-MM-DD format (local timezone)
    const now = new Date();
    const dateStr = now.getFullYear() + '-' + 
                    String(now.getMonth() + 1).padStart(2, '0') + '-' + 
                    String(now.getDate()).padStart(2, '0');
    
    const payload: any = {
      amount,
      description: this.expenseDescription || 'Dépense fournisseur (caisse)',
      categoryId: 1, // default/misc category; adjust as needed
      supplierId: this.selectedSupplierForAction.id,
      depotId: this.currentShopDepotId,
      date: dateStr,
      paymentType: 'CASH', // Always CASH for supplier expenses from caisse
      collectionDate: dateStr,
      notes: this.expenseNotes || '',
      isPaid: paidAmount >= amount, // Fully paid if paid amount equals or exceeds total
      isAdvance: paidAmount > 0 && paidAmount < amount, // Partial payment
      payNow: paidAmount > 0, // Only create cash movement if actually paying something
      paidAmount: paidAmount
    };
    this.submittingSupplierAction = true;
    this.expenseService.createExpense(payload).subscribe({
      next: () => {
        this.showAlertMessage('Dépense fournisseur enregistrée', 'success');
        this.submittingSupplierAction = false;
        this.closeSupplierQuickActions();
      },
      error: () => {
        this.submittingSupplierAction = false;
        this.showAlertMessage('Erreur lors de l\'enregistrement de la dépense', 'error');
      }
    });
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

        // Update fast lookup set for ticket menu highlighting
        this.approvedInvoicesSet.clear();
        this.printedInvoicesSet.clear();
        this.approvedInvoices.forEach(inv => {
          if (inv.saleId) {
            this.approvedInvoicesSet.add(inv.saleId);
            if (inv.printedAt) {
              this.printedInvoicesSet.add(inv.saleId);
            }
          }
        });
      },
      error: (error) => {
        console.error('Error loading approved invoices:', error);
        this.approvedInvoices = [];
        this.unprintedInvoicesCount = 0;
      }
    });
  }

  loadPendingInvoiceRequests(): void {
    this.http.get(`${environment.apiUrl}/invoices/requests/pending`).subscribe({
      next: (response: any) => {
        this.invoiceRequests = response.data || [];
        // Update fast lookup set
        this.pendingInvoiceRequestsSet.clear();
        this.invoiceRequests.forEach(req => {
          if (req.saleId) {
            this.pendingInvoiceRequestsSet.add(Number(req.saleId));
          }
        });
      },
      error: (error) => {
        console.error('Error loading pending invoice requests:', error);
        this.invoiceRequests = [];
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

    try {
      // Use the new invoice printing method instead of converting to sale
      this.printService.printInvoice(invoice);
      this.showAlertMessage('Facture imprimée avec succès!', 'success');

      // Mark as printed
      this.markInvoiceAsPrinted(invoice.id);
    } catch (error) {
      console.error('Error printing invoice:', error);
      this.showAlertMessage('Erreur lors de l\'impression de la facture', 'error');
    }
  }

  private convertInvoiceToSale(invoice: any): any {
    // Convert invoice to sale format for printing
    return {
      id: invoice.id,
      createdAt: invoice.createdAt || new Date().toISOString(),
      total: invoice.total || 0,
      items: (invoice.lines || []).map((line: any) => ({
        productName: line.productName || line.name || 'Produit',
        quantity: line.quantity || 1,
        unitPrice: line.unitPrice || line.price || 0,
        total: line.total || line.amount || 0
      })),
      paymentMethod: invoice.paymentMethod || 'ESPÈCES',
      client: invoice.client ? {
        firstName: invoice.client.firstName || '',
        lastName: invoice.client.lastName || '',
        code: invoice.client.code || ''
      } : null,
      discount: invoice.discount || 0,
      tax: invoice.tax || 0
    };
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
    // En-tete pris dans Parametres > Entreprise : plus aucun nom code en dur.
    const st = this.appSettings;
    const companyName = st?.printSettings?.receiptCompanyName || st?.companyName || 'Samurai Food';
    const companyAddress = st?.companyAddress || '';
    const companyPhone = st?.companyPhone || '';
    const companyEmail = st?.companyEmail || '';
    const companyMF = st?.companyMF || '';
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
          <td class="text-right">${quantity.toFixed(3)}</td>
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
              <div class="title">${companyName}</div>
              ${companyAddress ? `<div class="info-row"><span class="label">Adresse:</span> ${companyAddress}</div>` : ''}
              ${companyPhone ? `<div class="info-row"><span class="label">Téléphone:</span> ${companyPhone}</div>` : ''}
              ${companyEmail ? `<div class="info-row"><span class="label">Email:</span> ${companyEmail}</div>` : ''}
              ${companyMF ? `<div class="info-row"><span class="label">Matricule Fiscal:</span> ${companyMF}</div>` : ''}
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

  // Depot selection methods for admins
  loadDepots(): void {
    this.depotsService.list().subscribe({
      next: (depots: any[]) => {
        this.depots = depots;

      },
      error: (error: any) => {
        console.error('Error loading depots:', error);
      }
    });
  }

  selectDepot(depot: any): void {
    this.selectedDepot = depot;
  }

  confirmDepotSelection(): void {
    if (this.selectedDepot) {
      // Leave previous depot room if any
      if (this.currentShopDepotId && environment.enableRealtime) {
        this.socketService.leaveDepot(this.currentShopDepotId);
      }

      this.currentShopDepotId = this.selectedDepot.id;
      this.currentShopName = this.selectedDepot.name;
      this.showDepotSelection = false;

      // Set depot ID in ticket counter service for isolation
      // This will automatically load the depot-specific ticket state
      this.ticketCounterService.setDepotId(this.currentShopDepotId);

      // Join new depot room for real-time synchronization
      if (environment.enableRealtime) {
        this.socketService.joinDepot(this.currentShopDepotId);
      }

      // Clear current session since we're switching depots
      this.currentSession = null;
      this.isShiftOpen = false;

      // Reload data with the selected depot
      this.loadShopInventory();
      this.loadCurrentSession();
      this.loadProducts(); // Reload products for the selected depot (families will be loaded after products)
      // Note: loadShopName() is not needed here since we already set currentShopName
    }
  }

  closeDepotSelection(): void {
    this.showDepotSelection = false;
    // Redirect back to home if no depot is selected
    this.router.navigate(['/home']);
  }

  // Numpad methods for supplier payment
  addToSupplierPaymentAmount(value: string): void {
    if (value === '.') {
      if (!this.supplierPaymentAmount.includes('.')) {
        this.supplierPaymentAmount += value;
      }
    } else {
      this.supplierPaymentAmount += value;
    }
  }

  clearSupplierPaymentAmount(): void {
    this.supplierPaymentAmount = '';
  }

  // Numpad methods for expense
  addToExpenseAmount(value: string): void {
    // Determine which field we're editing based on tracking variable
    const isEditingTotal = this.editingExpenseField === 'total';
    const currentAmount = isEditingTotal ? this.expenseTotalAmount : this.expensePaidAmount;

    if (value === '.') {
      if (!currentAmount.includes('.')) {
        if (isEditingTotal) {
          this.expenseTotalAmount += value;
          this.currentInput = this.expenseTotalAmount;
          // Auto-sync paid amount with total when payNow is true AND paid amount is empty or equal to previous total
          if (this.expensePayNow && (!this.expensePaidAmount || this.expensePaidAmount === this.currentInput.slice(0, -1))) {
            this.expensePaidAmount = this.expenseTotalAmount;
          }
        } else {
          this.expensePaidAmount += value;
          this.currentInput = this.expensePaidAmount;
        }
      }
    } else {
      if (isEditingTotal) {
        this.expenseTotalAmount += value;
        this.currentInput = this.expenseTotalAmount;
        // Auto-sync paid amount with total when payNow is true AND paid amount is empty or equal to previous total
        // This allows user to manually change paid amount independently
        if (this.expensePayNow && (!this.expensePaidAmount || this.expensePaidAmount === this.currentInput.slice(0, -1))) {
          this.expensePaidAmount = this.expenseTotalAmount;
        }
      } else {
        // When editing paid amount, allow independent modification
        this.expensePaidAmount += value;
        this.currentInput = this.expensePaidAmount;
      }
    }
  }

  clearExpenseAmount(): void {
    // Use tracking variable to determine which field we're editing
    const isEditingTotal = this.editingExpenseField === 'total';
    if (isEditingTotal) {
      // Save total amount before clearing to check if paid was synced
      const totalBeforeClear = this.expenseTotalAmount;
      this.expenseTotalAmount = '';
      this.currentInput = '';
      // Only clear paid amount if payNow is true AND it was auto-synced (equal to total before clearing)
      if (this.expensePayNow && this.expensePaidAmount === totalBeforeClear) {
        this.expensePaidAmount = '';
      }
    } else {
      // When clearing paid amount, just clear it independently
      this.expensePaidAmount = '';
      this.currentInput = '';
    }
  }

  setExpensePayNow(payNow: boolean): void {
    const wasPayNow = this.expensePayNow;
    this.expensePayNow = payNow;

    if (payNow && !wasPayNow) {
      // When checking "Payé", sync paid amount with total amount only if paid is empty
      if (!this.expensePaidAmount || this.expensePaidAmount === '') {
        const totalAmount = this.expenseTotalAmount || '';
        this.expensePaidAmount = totalAmount;
      }
    } else if (!payNow && wasPayNow) {
      // When unchecking "Payé", clear paid amount
      this.expensePaidAmount = '';
    }
    
    // Auto-focus on total amount
    this.editingExpenseField = 'total';
    this.currentInput = this.expenseTotalAmount;
    this.updateRemainingCashExpense();
  }

  onExpensePaidCheckChange(): void {
    // This is called by the checkbox change event
    this.setExpensePayNow(this.expensePayNow);
  }

  // Expense flow methods
  loadExpenseCategories(): void {
    this.expenseService.getCategories().subscribe({
      next: (categories: any[]) => {
        this.expenseCategories = categories;
      },
      error: (error: any) => {
        console.error('Error loading expense categories:', error);
        this.showAlertMessage('Erreur lors du chargement des catégories', 'error');
      }
    });
  }

  selectExpenseCategory(category: any): void {
    this.selectedExpenseCategory = category;
    this.goToNextExpenseStep();
  }

  goToNextExpenseStep(): void {
    switch (this.expenseStep) {
      case 'category':
        this.expenseStep = 'payment';
        break;
      case 'payment':
        // If supplier already chosen from quick action, skip supplier step
        if (this.expenseSupplierId !== undefined && this.expenseSupplierId !== null) {
          this.expenseStep = 'notes';
        } else {
          this.expenseStep = 'supplier';
          this.loadExpenseSuppliers();
        }
        break;
      case 'supplier':
        this.expenseStep = 'notes';
        break;
    }
  }

  goToPrevExpenseStep(): void {
    switch (this.expenseStep) {
      case 'payment':
        this.expenseStep = 'category';
        break;
      case 'supplier':
        this.expenseStep = 'payment';
        break;
      case 'notes':
        this.expenseStep = 'supplier';
        break;
    }
  }

  loadExpenseSuppliers(): void {
    this.supplierService.getSuppliers().subscribe({
      next: (suppliers) => {
        this.filteredExpenseSuppliers = suppliers.filter(s => s.isActive);
      },
      error: (error) => {
        console.error('Error loading suppliers for expense:', error);
      }
    });
  }

  submitExpense(): void {
    if (!this.selectedExpenseCategory) {
      this.showAlertMessage('Veuillez sélectionner une catégorie', 'error');
      return;
    }

    const totalAmount = Number(this.expenseTotalAmount || 0);
    const paidAmount = Number(this.expensePaidAmount || 0);

    if (totalAmount <= 0) {
      this.showAlertMessage('Montant total invalide', 'error');
      return;
    }

    if (paidAmount < 0 || paidAmount > totalAmount) {
      this.showAlertMessage('Montant payé invalide', 'error');
      return;
    }

    this.submittingSupplierAction = true;

    // Determine payment status based on amounts
    const isFullyPaid = paidAmount >= totalAmount;
    const isPartiallyPaid = paidAmount > 0 && paidAmount < totalAmount;
    const isNotPaid = paidAmount === 0;

    // Store payment information in notes if it's a partial payment
    let notes = this.expenseNotes || '';
    if (isPartiallyPaid) {
      const remainingAmount = totalAmount - paidAmount;
      notes = `${notes}${notes ? ' | ' : ''}Paiement partiel: ${paidAmount}dt payé, reste ${remainingAmount}dt`;
    }

    // Get current depot ID
    const currentDepotId = this.currentShopDepotId || this.authService.currentUser()?.depotId;

    if (!currentDepotId) {
      this.showAlertMessage('Aucun dépôt sélectionné. Veuillez sélectionner un dépôt.', 'error');
      this.submittingSupplierAction = false;
      return;
    }

    const payload: any = {
      amount: totalAmount,
      categoryId: this.selectedExpenseCategory.id,
      supplierId: this.expenseSupplierId,
      depotId: currentDepotId, // Include depotId to ensure it's saved correctly
      paymentType: this.expensePaymentType,
      date: new Date().toISOString().split('T')[0],
      collectionDate: this.expensePayNow ? new Date().toISOString().split('T')[0] : this.expenseCollectionDate,
      notes: notes,
      isPaid: isFullyPaid,
      isAdvance: isPartiallyPaid, // Partial payment is treated as advance
      payNow: this.expensePayNow && (isFullyPaid || isPartiallyPaid), // Only create cash movement if paying now and amount > 0
      paidAmount: paidAmount // Pass the actual paid amount for cash movement calculation
    };



    this.expenseService.createExpense(payload).subscribe({
      next: (createdExpense) => {

        this.showAlertMessage('Dépense enregistrée avec succès', 'success');
        this.submittingSupplierAction = false;
        this.showExpenseForm = false;
        this.resetExpenseForm();
        // Refresh expense list if needed (for components that display expenses)
        // Note: The expense is saved in the database and will appear in GET requests
      },
      error: (error) => {
        console.error('Error creating expense:', error);
        this.submittingSupplierAction = false;
        const errorMessage = error?.error?.error || 'Erreur lors de l\'enregistrement de la dépense';
        this.showAlertMessage(errorMessage, 'error');
      }
    });
  }

  resetExpenseForm(): void {
    this.expenseStep = 'category';
    this.expenseTotalAmount = '';
    this.expensePaidAmount = '';
    this.expenseDescription = '';
    this.expensePaymentType = 'CASH';
    this.expenseNotes = '';
    this.expenseSupplierId = undefined;
    this.expensePayNow = true;
    this.expenseCollectionDate = new Date().toISOString().split('T')[0];
    this.selectedExpenseCategory = null;
    this.expenseSupplierSearch = '';
    this.editingExpenseField = null;
  }

  getExpenseRemainingAmount(): number {
    const total = parseFloat(this.expenseTotalAmount || '0');
    const paid = parseFloat(this.expensePaidAmount || '0');
    return Math.max(0, total - paid);
  }

  openAmountInput(type: 'total' | 'paid'): void {
    // Set the current input field for the numpad
    this.pendingProduct = null;
    this.inputMode = 'price'; // Use 'price' mode for amount input
    this.editingExpenseField = type; // Track which field we're editing

    if (type === 'total') {
      this.currentInput = this.expenseTotalAmount;
      // Don't clear - allow continuing to edit existing value or start fresh with numpad
    } else {
      this.currentInput = this.expensePaidAmount;
      // Don't clear - allow editing existing paid amount flexibly
      // User can modify independently from total
    }
  }

  // Instant refund methods
  openInstantRefundModal(ticket: Sale): void {
    this.instantRefundTicket = ticket;
    this.showInstantRefundModal = true;
  }

  closeInstantRefundModal(): void {
    this.showInstantRefundModal = false;
    this.instantRefundTicket = null;
  }

  confirmInstantRefund(): void {


    if (!this.instantRefundTicket) {

      this.showAlertMessage('Erreur: Aucun ticket sélectionné', 'error');
      return;
    }

    const ticket = this.instantRefundTicket;
    const refundAmount = Number(ticket.finalTotal) || 0;
    const productsToReturn = ticket.items || [];



    // Immediately update the UI to show "Annulation en cours"
    this.updateTicketStatusInstantly(ticket.id, 'PENDING_REFUND');

    // Close modal immediately
    this.closeInstantRefundModal();

    // Show pending confirmation message
    this.showAlertMessage(
      `Demande de remboursement créée (${refundAmount.toFixed(2)} dt). En attente de confirmation admin.`,
      'info'
    );

    // Create return request payload
    const returnPayload = {
      depotId: this.currentShopDepotId,
      items: productsToReturn.map((item: any) => ({
        productId: item.productId,
        quantity: item.quantity,
        reason: 'Remboursement immédiat'
      })),
      notes: `Remboursement immédiat du ticket #${this.getFormattedTicketNumber(ticket)}`,
      originalSaleId: ticket.id,
      originalSaleTotal: ticket.finalTotal
    };



    // Create return request in background
    this.returnsService.createReturnRequest(returnPayload).subscribe({
      next: (returnRequest) => {


        // Refresh data to get the actual server state
        this.loadTodaysTickets();
        this.loadPendingReturnRequests();
      },
      error: (error) => {
        console.error('Error creating return request:', error);

        // Revert the status change on error
        this.revertTicketPendingRefund(ticket.id);

        // Show error message
        this.showAlertMessage('Erreur lors de la création de la demande de remboursement', 'error');
      }
    });
  }


  getInstantRefundProducts(): any[] {
    return this.instantRefundTicket?.items || [];
  }

  getInstantRefundAmount(): number {
    return this.instantRefundTicket?.finalTotal || 0;
  }

  private updateTicketStatusInstantly(ticketId: number, newStatus: string): void {
    // Find and update the ticket in the todaysTickets array
    const ticketIndex = this.todaysTickets.findIndex(ticket => ticket.id === ticketId);
    if (ticketIndex !== -1) {
      // Add a custom property to track pending refund state
      (this.todaysTickets[ticketIndex] as any).isPendingRefund = true;
    }
  }

  private revertTicketPendingRefund(ticketId: number): void {
    // Find and revert the ticket in the todaysTickets array
    const ticketIndex = this.todaysTickets.findIndex(ticket => ticket.id === ticketId);
    if (ticketIndex !== -1) {
      // Remove the custom property
      (this.todaysTickets[ticketIndex] as any).isPendingRefund = false;
    }
  }

  // Numpad methods for temporary sale payment dialog
  addToAmountPaid(digit: string): void {
    if (!this.amountPaid) {
      this.amountPaid = 0;
    }
    const currentValue = this.amountPaid.toString();
    const newValue = currentValue === '0' ? digit : currentValue + digit;
    this.amountPaid = parseFloat(newValue);
    this.onAmountPaidChange();
  }

  addDecimalToAmountPaid(): void {
    if (!this.amountPaid) {
      this.amountPaid = 0;
    }
    const currentValue = this.amountPaid.toString();
    if (!currentValue.includes('.')) {
      this.amountPaid = parseFloat(currentValue + '.');
    }
  }

  clearAmountPaid(): void {
    const currentValue = this.amountPaid?.toString() || '0';
    if (currentValue.length > 1) {
      const newValue = currentValue.slice(0, -1);
      this.amountPaid = parseFloat(newValue) || 0;
    } else {
      this.amountPaid = 0;
    }
    this.onAmountPaidChange();
  }
} 