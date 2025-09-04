import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ProductsService } from '../core/services/products.service';
import { SalesService, CreateSaleRequest } from '../core/services/sales.service';
import { ClientsService } from '../core/services/clients.service';
import { Product } from '../core/models/product.model';
import { Sale } from '../core/models/sale.model';

import { Client } from '../core/models/client.model';

interface ReceiptItem {
  product: Product;
  quantity: number;
  unitPrice: number;
  total: number;
  isGift: boolean;
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

  // Math reference for template
  Math = Math;

  // Receipt data
  receiptItems: ReceiptItem[] = [];
  subtotal: number = 0;
  discount: number = 0;
  netTotal: number = 0;
  change: number = 0;

  // Product catalog
  allProducts: Product[] = [];
  filteredProducts: Product[] = [];
  productCategories: string[] = ['Tous', 'Pâtisserie', 'Viennoiserie', 'Boulangerie', 'Boissons', 'Vrague'];
  selectedCategory: string = 'Tous';

  // Input handling
  currentInput: string = '';
  isTemporarySale: boolean = false;

  // Articles popup
  showArticlesPopup: boolean = false;
  allMaterials: Product[] = [];
  materialsWithStock: any[] = [];

  // Remise popup
  showDiscountPopup: boolean = false;
  showDiscountTypeSelection = false;
  discountPercent: number | undefined;
  discountAmount: number | undefined;
  discountTarget: string = 'Tous';
  discountType: 'percentage' | 'amount' | undefined;

  // Payment popup
  showPaymentPopup = false;
  invoiceMode = false;
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
  alertType: 'success' | 'error' | 'info' = 'info';

  // Mouse drag scrolling
  isDragging: boolean = false;
  startX: number = 0;
  startScrollLeft: number = 0;
  mouseStartX: number = 0;

  // Action buttons configuration
  actionButtons = [
    {
      id: 'close',
      label: 'Clôturer',
      icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z',
      color: '#e9539a',
      action: () => this.closeShift()
    },
    {
      id: 'invoice',
      label: 'Facture',
      icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
      color: '#3884c2',
      action: () => this.generateInvoice()
    },
    {
      id: 'client',
      label: 'Client',
      icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
      color: '#25496b',
      action: () => this.openClientSearch()
    },
    {
      id: 'discount',
      label: 'Remise',
      icon: 'M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z',
      color: '#dd9830',
      action: () => this.applyDiscount()
    },
    {
      id: 'history',
      label: 'Historique',
      icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
      color: '#16959e',
      action: () => this.showHistory()
    },
    {
      id: 'reset',
      label: 'Reset',
      icon: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15',
      color: '#ba3333',
      action: () => this.resetSale()
    },
    {
      id: 'cancel',
      label: 'Annulation',
      icon: 'M6 18L18 6M6 6l12 12',
      color: '#555',
      action: () => this.cancelLastItem()
    },
    {
      id: 'temporary',
      label: 'Vente temporaire',
      icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
      color: '#766ed0',
      action: () => this.toggleTemporarySale()
    },
    {
      id: 'products',
      label: 'Articles',
      icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
      color: '#bb9999',
      action: () => this.openArticlesPopup()
    },
    {
      id: 'validate',
      label: 'Valider',
      icon: 'M5 13l4 4L19 7',
      color: '#2ca37d',
      action: () => this.validateSale()
    },
    {
      id: 'gift',
      label: 'Cadeau',
      icon: 'M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7',
      color: '#85ba33',
      action: () => this.markAsGift()
    },
    {
      id: 'settings',
      label: 'Paramètres',
      icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
      color: '#3884c2',
      action: () => this.openSettings()
    },
  ];

  constructor(
    private router: Router,
    private productsService: ProductsService,
    private salesService: SalesService,
    private clientsService: ClientsService
  ) {}

  ngOnInit(): void {
    this.loadProducts();
    this.loadMaterialsWithStock();
    this.loadPendingTemporarySalesCount();
    this.loadPendingGiftSalesCount();
  }

  loadProducts(): void {
    this.productsService.getProducts().subscribe({
      next: (products) => {
        this.allProducts = products;
        this.filterProducts();
      },
      error: (error) => {
        console.error('Error loading products:', error);
      }
    });
  }

  selectCategory(category: string): void {
    this.selectedCategory = category;
    this.filterProducts();
  }

  filterProducts(): void {
    let filtered = this.allProducts;
    
    // Filter by category
    if (this.selectedCategory !== 'Tous') {
      filtered = filtered.filter(p => p.famille?.name === this.selectedCategory);
    }
    
    // Store all filtered results
    this.filteredProducts = filtered;
  }


  scrollLeft(): void {
    const container = document.querySelector('.products-scroll-container') as HTMLElement;
    if (container) {
      // Scroll by 5 columns (one full row) plus gap
      container.scrollBy({ left: -640, behavior: 'smooth' });
    }
  }

  scrollRight(): void {
    const container = document.querySelector('.products-scroll-container') as HTMLElement;
    if (container) {
      // Scroll by 5 columns (one full row) plus gap
      container.scrollBy({ left: 640, behavior: 'smooth' });
    }
  }

  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      this.scrollLeft();
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      this.scrollRight();
    }
  }

  onMouseDown(event: MouseEvent): void {
    // Track mouse position for all interactions
    this.mouseStartX = event.pageX;
    
    // Only start dragging if clicking on the container, not on product buttons
    if ((event.target as HTMLElement).closest('button')) {
      return;
    }
    
    this.isDragging = true;
    this.startX = event.pageX;
    const container = event.currentTarget as HTMLElement;
    this.startScrollLeft = container.scrollLeft;
    
    // Force cursor to grabbing state
    container.style.setProperty('cursor', 'grabbing', 'important');
    container.style.setProperty('user-select', 'none', 'important');
    container.style.setProperty('-webkit-user-select', 'none', 'important');
    container.style.setProperty('-moz-user-select', 'none', 'important');
    container.style.setProperty('-ms-user-select', 'none', 'important');
    
    // Prevent text selection globally during drag
    document.body.style.setProperty('user-select', 'none', 'important');
    document.body.style.setProperty('-webkit-user-select', 'none', 'important');
    document.body.style.setProperty('-moz-user-select', 'none', 'important');
    document.body.style.setProperty('-ms-user-select', 'none', 'important');
    
    // Prevent default drag behavior
    event.preventDefault();
    
    // Force cursor update
    setTimeout(() => {
      container.style.setProperty('cursor', 'grabbing', 'important');
    }, 0);
  }

  onMouseMove(event: MouseEvent): void {
    if (!this.isDragging) return;
    
    event.preventDefault();
    const container = event.currentTarget as HTMLElement;
    const x = event.pageX;
    const walk = (x - this.startX) * 1.5;
    
    // Only scroll if we've moved a significant distance (prevents accidental scrolling)
    if (Math.abs(walk) > 5) {
      container.scrollLeft = this.startScrollLeft - walk;
    }
  }

  onMouseUp(event: MouseEvent): void {
    this.isDragging = false;
    const container = event.currentTarget as HTMLElement;
    container.style.setProperty('cursor', 'grab', 'important');
    container.style.setProperty('user-select', 'auto', 'important');
    container.style.setProperty('-webkit-user-select', 'auto', 'important');
    container.style.setProperty('-moz-user-select', 'auto', 'important');
    container.style.setProperty('-ms-user-select', 'auto', 'important');
    
    // Restore global text selection
    document.body.style.setProperty('user-select', 'auto', 'important');
    document.body.style.setProperty('-webkit-user-select', 'auto', 'important');
    document.body.style.setProperty('-moz-user-select', 'auto', 'important');
    document.body.style.setProperty('-ms-user-select', 'auto', 'important');
  }

  onMouseLeave(event: MouseEvent): void {
    this.isDragging = false;
    const container = event.currentTarget as HTMLElement;
    container.style.setProperty('cursor', 'grab', 'important');
    container.style.setProperty('user-select', 'auto', 'important');
    container.style.setProperty('-webkit-user-select', 'auto', 'important');
    container.style.setProperty('-moz-user-select', 'auto', 'important');
    container.style.setProperty('-ms-user-select', 'auto', 'important');
    
    // Restore global text selection
    document.body.style.setProperty('user-select', 'auto', 'important');
    document.body.style.setProperty('-webkit-user-select', 'auto', 'important');
    document.body.style.setProperty('-moz-user-select', 'auto', 'important');
    document.body.style.setProperty('-ms-user-select', 'auto', 'important');
  }

  onProductClick(event: MouseEvent, product: Product): void {
    // If we were dragging, don't add the product
    if (this.isDragging) {
      event.preventDefault();
      return;
    }
    
    // Check if this was a significant movement (drag) or just a click
    const moveDistance = Math.abs(event.pageX - this.mouseStartX);
    if (moveDistance > 10) {
      event.preventDefault();
      return;
    }
    
    this.selectedProduct = product;
    this.showProductModal = true;
    this.productModalMode = 'quantity';
    this.productModalQuantity = 1;
    this.productModalAmount = 0;
    this.productModalCalculatedQuantity = 0;
    this.productModalCalculatedAmount = 0;
  }

  addProductToReceipt(product: Product): void {
    const existingItem = this.receiptItems.find(item => item.product.id === product.id);
    
    if (existingItem) {
      existingItem.quantity += 1;
      existingItem.total = Number(existingItem.quantity) * Number(existingItem.unitPrice);
      // Ensure all values are numbers
      existingItem.quantity = Number(existingItem.quantity);
      existingItem.unitPrice = Number(existingItem.unitPrice);
    } else {
      this.receiptItems.push({
        product,
        quantity: 1,
        unitPrice: Number(product.prix_vente_TTC),
        total: Number(product.prix_vente_TTC),
        isGift: false
      });
    }
    
    this.calculateTotals();
  }

  openProductDialog(product: Product, event: MouseEvent): void {
    event.preventDefault();
    // TODO: Implement product dialog for quantity/discount
    console.log('Open product dialog for:', product.name);
  }

  calculateTotals(): void {
    this.subtotal = this.receiptItems.reduce((sum, item) => sum + Number(item.total), 0);
    this.netTotal = Number(this.subtotal) - Number(this.discount);
    this.total = Number(this.netTotal);
  }

  // Action buttons
  generateInvoice(): void {
    if (this.receiptItems.length === 0) {
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
    this.selectedClient = client;
    this.selectedClientId = client.id;
    this.currentCustomer = `${client.firstName} ${client.lastName}`;
    this.showClientSearchPopup = false;
    this.showAlertMessage(`Client sélectionné: ${client.firstName} ${client.lastName}`, 'success');
  }

  clearSelectedClient(): void {
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
    if (this.receiptItems.length > 0) {
      this.receiptItems.pop();
      this.calculateTotals();
    }
  }

  validateSale(): void {
    if (this.receiptItems.length === 0) {
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
    const total = this.selectedTemporarySale ? this.selectedTemporarySale.finalTotal : this.netTotal;
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
    
    const requiresFullPayment = !this.selectedClientId;
    if (requiresFullPayment && (!this.amountPaid || Number(this.amountPaid) < Number(this.netTotal))) {
      this.showAlertMessage('Montant insuffisant', 'error');
      return;
    }

    const paymentMethodMap: { [key: string]: number } = {
      'cash': 1,
      'card': 2,
      'check': 3,
      'virement': 4
    };

    const saleData: CreateSaleRequest = {
      items: this.receiptItems.map(item => ({
        productId: item.product.id,
        productName: item.product.name,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        total: Number(item.total),
        discount: 0
      })),
      total: Number(this.subtotal),
      discount: Number(this.discount),
      finalTotal: Number(this.netTotal),
      paymentMethodId: paymentMethodMap[this.paymentType] || 1,
      clientId: this.selectedClientId || undefined,
      amountPaid: this.amountPaid !== undefined ? Number(this.amountPaid) : Number(this.netTotal)
    };

    this.salesService.createSale(saleData).subscribe({
      next: (savedSale: any) => {
        const loyaltyEarned = savedSale?.loyaltyPointsEarned || 0;
        if (this.invoiceMode) {
          this.printInvoice();
        } else {
          this.printReceiptWithClient(loyaltyEarned);
        }
        this.receiptItems = [];
        this.discount = 0;
        this.calculateTotals();
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
    const now = new Date();
    return {
      storeName: 'PÂTISSERIE DELICE',
      address: '123 Rue des Gourmandises',
      city: 'Tunis, Tunisie',
      phone: 'Tél: +216 XX XXX XXX',
      date: now.toLocaleDateString('fr-FR'),
      time: now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      items: this.receiptItems,
      subtotal: this.subtotal,
      discount: this.discount,
      netTotal: this.netTotal,
      paymentType: this.paymentType,
      amountPaid: this.amountPaid,
      change: this.calculatedChange
    };
  }

  resetSale(): void {
    this.receiptItems = [];
    this.discount = 0;
    this.calculateTotals();
  }

  openSettings(): void {
    console.log('Open settings');
  }

  toggleTemporarySale(): void {
    this.showTemporarySaleSelectionPopup = true;
  }

  confirmTemporarySale(): void {
    if (!this.temporarySaleExpectedDate || !this.temporarySaleExpectedTime) {
      this.showAlertMessage('Veuillez spécifier la date et l\'heure de vente prévue', 'error');
      return;
    }
    
    // Create temporary sale data
    const tempSaleData = {
      items: this.receiptItems.map(item => ({
        productId: item.product.id,
        productName: item.product.name,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        total: Number(item.total)
      })),
      total: Number(this.subtotal),
      discount: Number(this.discount),
      finalTotal: Number(this.netTotal),
      expectedDate: this.temporarySaleExpectedDate,
      expectedTime: this.temporarySaleExpectedTime,
      notes: this.temporarySaleNotes,
      status: 'TEMPORARY',
      clientId: this.selectedClientId || undefined
    };
    
    // Save temporary sale to backend
    this.salesService.createTemporarySale(tempSaleData).subscribe({
      next: (savedSale) => {
        console.log('Temporary sale saved successfully:', savedSale);
        this.showAlertMessage('Vente temporaire enregistrée avec succès!', 'success');
        
        // Reset everything
        this.receiptItems = [];
        this.discount = 0;
        this.calculateTotals();
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
  }

  getTemporarySaleBadge(): string {
    if (!this.isTemporarySale) return '';
    const itemCount = this.receiptItems.length;
    const totalQuantity = this.receiptItems.reduce((sum, item) => sum + item.quantity, 0);
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
      if (this.receiptItems.length === 0) {
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
    
    // Validate payment details
    if (!this.paymentType || 
        (this.paymentType === 'cash' && (!this.amountPaid || this.amountPaid < this.selectedTemporarySale.finalTotal)) ||
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
        console.log('Temporary sale completed successfully:', completedSale);
        this.showAlertMessage('Vente temporaire finalisée avec succès!', 'success');
        this.closeTemporarySalePayment();
        this.loadPendingTemporarySalesCount(); // Refresh the count
        // Refresh the existing temporary sales list to remove the finalized sale
        if (this.showExistingTemporarySalesPopup) {
          this.loadExistingTemporarySales();
        }
      },
      error: (error) => {
        console.error('Error completing temporary sale:', error);
        this.showAlertMessage('Erreur lors de la finalisation de la vente temporaire. Veuillez réessayer.', 'error');
      }
    });
  }

  markAsGift(): void {
    if (this.receiptItems.length === 0) {
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
    
    // Create gift sale data
    const giftSaleData = {
      items: this.receiptItems.map(item => ({
        productId: item.product.id,
        productName: item.product.name,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        total: Number(item.total)
      })),
      total: Number(this.subtotal),
      discount: Number(this.discount),
      finalTotal: 0, // Gift is free
      reason: this.giftReason,
      recipient: this.giftRecipient,
      status: 'PENDING_ADMIN',
      clientId: this.selectedClientId || undefined
    };
    
    // Save gift sale to backend
    this.salesService.createGiftSale(giftSaleData).subscribe({
      next: (savedSale) => {
        console.log('Gift sale saved successfully:', savedSale);
        this.showAlertMessage('Demande de cadeau envoyée pour approbation!', 'success');
        
        // Reset everything
        this.receiptItems = [];
        this.discount = 0;
        this.calculateTotals();
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

  closeShift(): void {
    if (confirm('Êtes-vous sûr de vouloir clôturer la session ?')) {
      console.log('Close shift');
    }
  }

  openProducts(): void {
    this.router.navigate(['/stock/products']);
  }

  openArticlesPopup(): void {
    this.showArticlesPopup = true;
    this.loadMaterialsWithStock();
  }

  loadMaterialsWithStock(): void {
    this.productsService.getProducts().subscribe({
      next: (products) => {
        this.allMaterials = products;
        this.materialsWithStock = products.map(product => {
          const summary = this.computeConservationSummary(product);
          return {
            ...product,
            stockQuantity: this.getShopStock(product),
            conservationStatus: summary.status,
            daysUntilExpiry: summary.minDaysUntilExpiry,
            batches: summary.batches,
            showDetails: false
          };
        });
      },
      error: (error) => {
        console.error('Error loading materials:', error);
      }
    });
  }

  getShopStock(product: Product): number {
    const batches = product.conservation || [];
    const qty = batches.reduce((sum, b) => sum + Number(b.remainingQuantity || 0), 0);
    return Number(qty);
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

  closeArticlesPopup(): void {
    this.showArticlesPopup = false;
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
    
    if (this.discountType === 'percentage') {
      const percent = Number(this.discountPercent) || 0;
      const raw = (targetTotal * percent) / 100;
      amount = this.roundToTenthAsThreeDecimals(raw);
    } else {
      amount = this.roundToTenthAsThreeDecimals(Number(this.discountAmount) || 0);
    }
    
    this.discount = amount;
    this.calculateTotals();
    this.showDiscountPopup = false;
    this.showDiscountTypeSelection = false;
  }

  getTargetedTotal(): number {
    if (!this.receiptItems || this.receiptItems.length === 0) return 0;
    if (this.discountTarget === 'Tous') {
      return this.receiptItems.reduce((sum, item) => sum + Number(item.total || 0), 0);
    }
    return this.receiptItems
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
    this.currentInput += value;
  }

  clearInput(): void {
    this.currentInput = '';
  }

  addDecimal(): void {
    if (!this.currentInput.includes('.')) {
      this.currentInput += '.';
    }
  }

  enterValue(): void {
    const value = parseFloat(this.currentInput);
    if (!isNaN(value)) {
      // TODO: Apply value (quantity, price, etc.)
      console.log('Entered value:', value);
    }
    this.currentInput = '';
  }

  // Utility function to truncate text
  truncate(text: string, limit: number): string {
    if (!text) return '-';
    return text.length > limit ? text.substring(0, limit) + '...' : text;
  }

  showAlertMessage(message: string, type: 'success' | 'error' | 'info' = 'info'): void {
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
      return !this.selectedTemporarySale?.client && (!this.amountPaid || this.amountPaid < (this.selectedTemporarySale?.finalTotal || 0));
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
    const now = new Date();
    const lines = this.receiptItems.map(item => `
      <tr>
        <td style=\"padding:6px;border:1px solid #ddd;\">${this.truncate(item.product.name, 40)}</td>
        <td style=\"padding:6px;border:1px solid #ddd;text-align:center;\">${item.quantity}</td>
        <td style=\"padding:6px;border:1px solid #ddd;text-align:right;\">${Number(item.unitPrice).toFixed(3)}</td>
        <td style=\"padding:6px;border:1px solid #ddd;text-align:right;\">${Number(item.total).toFixed(3)}</td>
      </tr>
    `).join('');

    const customer = this.selectedClient ? `${this.selectedClient.firstName} ${this.selectedClient.lastName}` : 'PASSAGER';

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
            <tr><td>Sous-total:</td><td class=\"right\">${Number(this.subtotal).toFixed(3)} dt</td></tr>
            ${Number(this.discount) > 0 ? `<tr><td>Remise:</td><td class=\"right\">-${Number(this.discount).toFixed(3)} dt</td></tr>` : ''}
            <tr><td style=\"font-weight:700\">TOTAL:</td><td class=\"right\" style=\"font-weight:700\">${Number(this.netTotal).toFixed(3)} dt</td></tr>
            <tr><td>Paiement:</td><td class=\"right\">${this.paymentType?.toUpperCase() || ''}</td></tr>
            ${this.selectedClient && this.amountPaid !== undefined && Number(this.amountPaid) < Number(this.netTotal) ? `<tr><td>Crédit client:</td><td class=\"right\">${(Number(this.netTotal)-Number(this.amountPaid)).toFixed(3)} dt</td></tr>` : ''}
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

  confirmProductModal(): void {
    if (this.selectedProduct && this.productModalQuantity > 0) {
      this.addProductToReceiptWithQuantity(this.selectedProduct, this.productModalQuantity);
      this.closeProductModal();
    }
  }

  addProductToReceiptWithQuantity(product: Product, quantity: number): void {
    const existingItem = this.receiptItems.find(item => item.product.id === product.id);
    
    if (existingItem) {
      existingItem.quantity += quantity;
      existingItem.total = Number(existingItem.quantity) * Number(existingItem.unitPrice);
      existingItem.quantity = Number(existingItem.quantity);
      existingItem.unitPrice = Number(existingItem.unitPrice);
    } else {
      this.receiptItems.push({
        product,
        quantity: quantity,
        unitPrice: Number(product.prix_vente_TTC),
        total: quantity * Number(product.prix_vente_TTC),
        isGift: false
      });
    }
    
    this.calculateTotals();
  }

  closeProductModal(): void {
    this.showProductModal = false;
    this.selectedProduct = null;
    this.productModalQuantity = 1;
    this.productModalAmount = 0;
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
} 