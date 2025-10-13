import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router, NavigationEnd } from '@angular/router';
import { filter, takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { SalesService } from '../core/services/sales.service';
import { Sale } from '../core/models/sale.model';
import { PrintService } from '../core/services/print.service';
import { HttpClient } from '@angular/common/http';
import { ReturnsService, ReturnRequestCreatePayload } from '../core/services/returns.service';
import { AuthService } from '../core/services/auth.service';
import { SettingsService, AppSettings } from '../core/services/settings.service';
import { SessionsService } from '../core/services/sessions.service';
import { environment } from '../../environments/environment';

type ReturnTypeOption = 'RETURN' | 'EXCHANGE_CASH' | 'EXCHANGE_PRODUCTS' | 'EXCHANGE_NOTHING';

@Component({
  selector: 'app-historique',
  templateUrl: './historique.component.html',
  standalone: false
})
export class HistoriqueComponent implements OnInit {
  sales: Sale[] = [];
  filteredSales: Sale[] = [];
  loading = false;
  error = '';

  // Filters
  searchQuery = '';
  selectedStatus = '';
  selectedPaymentMethod = '';
  selectedSaleType = '';
  startDate = '';
  endDate = '';

  // Session-based pagination
  currentSessionPage = 1;
  sessionsPerPage = 1; // Show one session per page
  totalSessions = 0;
  totalItems = 0;

  // Payment methods for filter
  paymentMethods: any[] = [];

  // Alert system
  showAlert = false;
  alertMessage = '';
  alertType: 'success' | 'error' | 'info' = 'info';

  // UI state
  showFilters = false;
  showGridView = false;

  // Receipt preview modal
  showReceiptModal = false;
  selectedSaleForReceipt: Sale | null = null;
  receiptHtmlPreview = '';

  // Settings
  appSettings: AppSettings | null = null;
  
  // Session-based filtering
  sessionIds: number[] = [];
  allSessions: any[] = []; // Store all sessions for pagination

  // Invoice request modal
  showInvoiceRequestModal = false;
  selectedSaleForInvoice: Sale | null = null;
  submittingInvoiceRequest = false;
  invoiceRequestData = {
    notes: ''
  };
  invoiceRequests: any[] = [];

  // Return/Exchange request modal state
  showReturnRequestModal = false;
  returnItems: { productId: number; productName: string; quantity: number; unitPrice: number }[] = [];
  returnNotes = '';
  submittingReturnRequest = false;
  selectedSaleForReturn: Sale | null = null;
  returnCashAmount: number | string = 0;
  returnType: ReturnTypeOption | null = null;
  exchangeProducts: { productId: number; productName: string; quantity: number; unitPrice: number }[] = [];
  allProducts: any[] = [];
  showReturnPicker = false;
  showAddItemPicker = false;

  // Collapsible session groups state
  private collapsedSessionKeys = new Set<string>();

  private destroy$ = new Subject<void>();

  constructor(
    private salesService: SalesService, 
    private printService: PrintService,
    private http: HttpClient,
    private returnsService: ReturnsService,
    private authService: AuthService,
    private settingsService: SettingsService,
    private sessionsService: SessionsService,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    // Initialize with empty arrays to prevent undefined errors
    this.sales = [];
    this.filteredSales = [];
    this.totalItems = 0;
    
    // Load settings first to get retention days, then load sales within that window
    this.loadSettings(() => {
      this.loadSales();
    });
    this.loadPaymentMethods();
    this.loadInvoiceRequests();
    this.loadProducts();
    
    // Check for query parameters to open return dialog
    this.route.queryParams
      .pipe(takeUntil(this.destroy$))
      .subscribe((params: any) => {
        if (params['openReturnDialog'] === 'true' && params['ticketId']) {
          const ticketId = parseInt(params['ticketId']);
          this.openReturnDialogForTicket(ticketId);
        }
      });

    // Handle hot reload scenarios - reload data when window regains focus
    // This helps with development rebuilds
    window.addEventListener('focus', this.handleWindowFocus.bind(this));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    // Clean up event listener
    window.removeEventListener('focus', this.handleWindowFocus.bind(this));
  }

  private handleWindowFocus(): void {
    // Reload data when window regains focus (helps with hot reloads)
    // Only reload if we don't have data or if there's an error
    if (this.sales.length === 0 || this.error) {
      this.loadSales();
    }
  }

  // Public method to force reload (useful for debugging)
  public forceReload(): void {
    this.sales = [];
    this.filteredSales = [];
    this.totalItems = 0;
    this.error = '';
    this.sessionIds = [];
    this.allSessions = [];
    this.totalSessions = 0;
    this.currentSessionPage = 1;
    // Reload settings and sessions first, then sales
    this.loadSettings(() => {
      this.loadSales();
    });
  }

  loadSales(): void {
    this.loading = true;
    this.error = '';

    // Use session-based filtering if we have sessions, otherwise fallback to date filtering
    const params: any = {};
    
    if (this.allSessions.length > 0) {
      // Get current session's ID for pagination
      const currentSession = this.allSessions[this.currentSessionPage - 1];
      if (currentSession) {
        params.sessionIds = [currentSession.id];
      }
    } else if (this.startDate && this.endDate) {
      // Fallback to date filtering
      params.startDate = `${this.startDate}T00:00:00.000`;
      params.endDate = `${this.endDate}T23:59:59.999`;
    }

    this.salesService.getSales(params)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (sales: any) => {
          this.sales = sales || [];
          this.filteredSales = this.sales;
          this.totalItems = this.sales.length;
          this.loading = false;
          
          // Apply any existing filters after loading
          if (this.searchQuery || this.selectedStatus || this.selectedPaymentMethod || 
              this.selectedSaleType || this.startDate || this.endDate) {
            this.applyFilters();
          }
        },
        error: (error) => {
          console.error('Error loading sales:', error);
          this.error = 'Erreur lors du chargement des ventes';
          this.sales = [];
          this.filteredSales = [];
          this.totalItems = 0;
          this.loading = false;
        }
      });
  }

  loadPaymentMethods(): void {
    this.salesService.getPaymentMethods()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (methods: any) => {
          this.paymentMethods = methods;
        },
        error: (error) => {
          console.error('Error loading payment methods:', error);
        }
      });
  }

  loadSettings(after?: () => void): void {
    this.settingsService.getSettings()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (settings: any) => {
          this.appSettings = settings;
          // Load sessions based on historyRetentionDays setting
          const sessionLimit = Number((settings as any).historyRetentionDays || 10);
          this.loadRecentSessions(sessionLimit, after);
        },
        error: (error) => {
          console.error('Error loading settings:', error);
          // Fallback to default session limit
          this.loadRecentSessions(10, after);
        }
      });
  }

  loadRecentSessions(limit: number, after?: () => void): void {
    this.sessionsService.getSessions({ 
      limit: limit
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (sessions: any) => {
          // Sort sessions by openedAt/createdAt (newest first) and keep only last N
          const sorted = (sessions || [])
            .slice()
            .sort((a: any, b: any) => {
              const aTime = new Date(a.openedAt ?? a.createdAt).getTime();
              const bTime = new Date(b.openedAt ?? b.createdAt).getTime();
              return bTime - aTime;
            })
            .slice(0, limit);

          this.allSessions = sorted;
          this.sessionIds = sorted.map((s: any) => s.id);
          this.totalSessions = this.allSessions.length;
          this.currentSessionPage = 1; // Page 1 = most recent session
          if (after) after();
        },
        error: (error) => {
          console.error('Error loading recent sessions:', error);
          // Fallback to date-based filtering
          const days = limit;
          const end = new Date();
          const start = new Date();
          start.setDate(end.getDate() - (days - 1));
          const toIso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          this.startDate = toIso(start);
          this.endDate = toIso(end);
          
          // Reset session-based pagination
          this.allSessions = [];
          this.sessionIds = [];
          this.totalSessions = 0;
          this.currentSessionPage = 1;
          
          if (after) after();
        }
      });
  }

  applyFilters(): void {
    // Ensure we have sales data before filtering
    if (!this.sales || this.sales.length === 0) {
      this.filteredSales = [];
      this.totalItems = 0;
      return;
    }

    // Debug logging
    console.log('Applying filters:', {
      totalSales: this.sales.length,
      searchQuery: this.searchQuery,
      selectedStatus: this.selectedStatus,
      selectedPaymentMethod: this.selectedPaymentMethod,
      selectedSaleType: this.selectedSaleType,
      startDate: this.startDate,
      endDate: this.endDate
    });

    this.filteredSales = this.sales.filter(sale => {
      // Search query
      if (this.searchQuery && this.searchQuery.trim()) {
        const query = this.searchQuery.toLowerCase().trim();
        const formattedTicketNumber = this.getFormattedTicketNumber(sale);
        const matchesSearch = 
          sale.id.toString().includes(query) ||
          formattedTicketNumber.toLowerCase().includes(query) ||
          (sale.items && sale.items.some(item => item.productName.toLowerCase().includes(query))) ||
          (sale.paymentMethod && sale.paymentMethod.name.toLowerCase().includes(query));
        if (!matchesSearch) {
          console.log('Sale filtered out by search:', sale.id, query);
          return false;
        }
      }

      // Status filter
      if (this.selectedStatus && sale.status !== this.selectedStatus) {
        console.log('Sale filtered out by status:', sale.id, sale.status, this.selectedStatus);
        return false;
      }

      // Payment method filter
      if (this.selectedPaymentMethod && sale.paymentMethod && sale.paymentMethod.id.toString() !== this.selectedPaymentMethod) {
        console.log('Sale filtered out by payment method:', sale.id, sale.paymentMethod?.id, this.selectedPaymentMethod);
        return false;
      }

      // Sale type filter
      if (this.selectedSaleType) {
        const isWholesale = this.isWholesaleSale(sale);
        if (this.selectedSaleType === 'wholesale' && !isWholesale) {
          console.log('Sale filtered out by sale type (wholesale):', sale.id, isWholesale);
          return false;
        }
        if (this.selectedSaleType === 'retail' && isWholesale) {
          console.log('Sale filtered out by sale type (retail):', sale.id, isWholesale);
          return false;
        }
      }

      // Date range filter
      if (this.startDate || this.endDate) {
        const saleDate = new Date(sale.createdAt);
        const saleDateOnly = new Date(saleDate.getFullYear(), saleDate.getMonth(), saleDate.getDate());
        
        if (this.startDate) {
          const startDateOnly = new Date(this.startDate);
          if (saleDateOnly < startDateOnly) {
            console.log('Sale filtered out by start date:', sale.id, saleDateOnly, startDateOnly);
            return false;
          }
        }
        if (this.endDate) {
          const endDateOnly = new Date(this.endDate);
          if (saleDateOnly > endDateOnly) {
            console.log('Sale filtered out by end date:', sale.id, saleDateOnly, endDateOnly);
            return false;
          }
        }
      }

      return true;
    });

    this.totalItems = this.filteredSales.length;
    this.currentSessionPage = 1;
    
    console.log('Filter result:', {
      originalCount: this.sales.length,
      filteredCount: this.filteredSales.length,
      totalItems: this.totalItems
    });
  }

  clearFilters(): void {
    this.searchQuery = '';
    this.selectedStatus = '';
    this.selectedPaymentMethod = '';
    this.selectedSaleType = '';
    this.startDate = '';
    this.endDate = '';
    this.sessionIds = []; // Clear session-based filtering
    this.allSessions = [];
    this.totalSessions = 0;
    this.currentSessionPage = 1;
    this.filteredSales = this.sales;
    this.totalItems = this.sales.length;
  }

  isWholesaleSale(sale: Sale): boolean {
    return sale.items && sale.items.some(item => item.isWholesale);
  }

  // Current session helper
  private getCurrentSessionId(): number | null {
    const current = this.allSessions[this.currentSessionPage - 1];
    return current ? Number(current.id) : null;
  }

  get paginatedSales(): Sale[] {
    // Ensure we only show sales belonging to the currently selected session
    const currentSessionId = this.getCurrentSessionId();
    if (currentSessionId == null) {
      return this.filteredSales;
    }
    return this.filteredSales.filter((sale: any) => {
      const sid = (sale?.session?.id ?? null);
      return sid === currentSessionId;
    });
  }

  // Group by session for multigrid sections (fallback to 'Sans session')
  get groupedSalesBySession(): { sessionKey: string; sessionLabel: string; sessionDateLabel?: string; sessionSuffix?: string; sales: Sale[] }[] {
    // Build groups by session id
    const bySession = new Map<string, Sale[]>();
    for (const sale of this.paginatedSales) {
      const sessionId = (sale as any)?.session?.id ?? null;
      const key = sessionId ? String(sessionId) : 'none';
      if (!bySession.has(key)) bySession.set(key, []);
      bySession.get(key)!.push(sale);
    }

    // Derive a date/time label per session based on the last sale's date (closure time)
    const sessionDateLabel = new Map<string, string>();
    const sessionTimeLabel = new Map<string, string>();
    const dateCounts = new Map<string, number>();
    for (const [key, sales] of bySession.entries()) {
      if (key === 'none') {
        sessionDateLabel.set(key, 'Sans session');
        sessionTimeLabel.set(key, '');
        continue;
      }
      // Use last sale date/time in the group as closure time
      const lastTimestamp = Math.max(
        ...sales.map(s => new Date((s as any).createdAt as any).getTime())
      );
      const lastDate = new Date(lastTimestamp);
      const dateLabel = lastDate.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
      const timeLabel = lastDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      sessionDateLabel.set(key, dateLabel);
      sessionTimeLabel.set(key, timeLabel);
      dateCounts.set(dateLabel, (dateCounts.get(dateLabel) || 0) + 1);
    }

    // Sort groups: by date desc (using the first sale date), then by session id desc, with 'none' last
    const groups = Array.from(bySession.entries())
      .sort((a, b) => {
        const [aKey, aSales] = a;
        const [bKey, bSales] = b;
        if (aKey === 'none' && bKey !== 'none') return 1;
        if (bKey === 'none' && aKey !== 'none') return -1;
        const aDate = new Date(aSales[0].createdAt as any).getTime();
        const bDate = new Date(bSales[0].createdAt as any).getTime();
        if (bDate !== aDate) return bDate - aDate; // desc by date
        const aNum = aKey === 'none' ? -Infinity : parseInt(aKey, 10);
        const bNum = bKey === 'none' ? -Infinity : parseInt(bKey, 10);
        return bNum - aNum; // desc by session id
      })
      .map(([key, sales]) => {
        if (key === 'none') {
          return { sessionKey: key, sessionLabel: 'Sans session', sales };
        }
        const dateLabel = sessionDateLabel.get(key) || '';
        const timeLabel = sessionTimeLabel.get(key) || '';
        const countForDate = dateCounts.get(dateLabel) || 0;
        const suffix = countForDate > 1 ? `(#${key})` : '';
        return {
          sessionKey: key,
          sessionLabel: `Clotûre Caisse ${dateLabel} ${timeLabel}`,
          sessionDateLabel: dateLabel,
          sessionSuffix: suffix,
          sales
        };
      });
    return groups;
  }

  // Collapsible helpers
  isGroupCollapsed(key: string): boolean {
    return this.collapsedSessionKeys.has(key);
  }

  toggleGroup(key: string): void {
    if (this.collapsedSessionKeys.has(key)) {
      this.collapsedSessionKeys.delete(key);
    } else {
      this.collapsedSessionKeys.add(key);
    }
  }

  trackBySaleId(_index: number, sale: Sale): number { return sale.id; }

  // Board column getters to keep templates simple and fast
  get pendingSales(): Sale[] {
    return this.paginatedSales.filter((sale: Sale) => sale.status === 'PENDING');
  }

  get temporarySales(): Sale[] {
    return this.paginatedSales.filter((sale: Sale) => sale.status === 'TEMPORARY');
  }

  get completedSales(): Sale[] {
    return this.paginatedSales.filter((sale: Sale) => sale.status === 'COMPLETED');
  }

  get cancelledSales(): Sale[] {
    return this.paginatedSales.filter((sale: Sale) => sale.status === 'CANCELLED');
  }

  get totalPages(): number {
    return this.totalSessions;
  }

  changePage(page: number): void {
    if (page >= 1 && page <= this.totalSessions) {
      this.currentSessionPage = page;
      // Reload sales for the new session
      this.loadSales();
    }
  }

  toggleFilters(): void {
    this.showFilters = !this.showFilters;
  }

  toggleView(): void {
    this.showGridView = !this.showGridView;
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'COMPLETED':
        return 'bg-green-500/20 text-green-400';
      case 'PENDING':
        return 'bg-yellow-500/20 text-yellow-400';
      case 'CANCELLED':
        return 'bg-red-500/20 text-red-400';
      case 'TEMPORARY':
        return 'bg-yellow-500/20 text-yellow-400';
      case 'PENDING_ADMIN':
        return 'bg-orange-500/20 text-orange-400';
      case 'CADEAU':
        return 'bg-purple-500/20 text-purple-400';
      case 'REFUNDED':
        return 'bg-red-500/20 text-red-400';
      default:
        return 'bg-gray-500/20 text-gray-400';
    }
  }

  getStatusText(status: string): string {
    switch (status) {
      case 'COMPLETED':
        return 'Terminé';
      case 'PENDING':
        return 'En attente';
      case 'CANCELLED':
        return 'Annulé';
      case 'TEMPORARY':
        return 'Temporaire';
      case 'PENDING_ADMIN':
        return 'En attente Admin';
      case 'CADEAU':
        return 'Cadeau';
      case 'REFUNDED':
        return 'Retourné';
      default:
        return status;
    }
  }

  formatDate(date: string | Date): string {
    return new Date(date).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  getProductNames(items: any[]): string {
    return items.slice(0, 2).map(item => item.productName).join(', ');
  }

  showSaleDetails(sale: Sale): void {
    let details = `Vente #${this.getFormattedTicketNumber(sale)}\n`;
    details += `Date: ${this.formatDate(sale.createdAt)}\n`;
    details += `Statut: ${this.getStatusText(sale.status)}\n`;
   
   if (sale.status === 'TEMPORARY' && (sale as any).expectedDate) {
     details += `Date prévue: ${this.formatDate((sale as any).expectedDate)}\n`;
   }
   
   details += `Total: ${sale.finalTotal} dt\n`;
   details += `Remise: ${sale.discount} dt\n`;
   
   if ((sale as any).notes) {
     details += `Notes: ${(sale as any).notes}\n`;
   }
   
   details += '\nArticles:\n';
   
   if (sale.items && sale.items.length > 0) {
     sale.items.forEach((item, index) => {
       details += `${index + 1}. ${item.productName} - ${item.quantity}x ${item.unitPrice} dt = ${item.total} dt\n`;
     });
   } else {
     details += 'Aucun article';
   }
   
   this.showAlertMessage(details, 'info');
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

  getSaleSummary(sale: Sale): string {
    if (!sale.items || sale.items.length === 0) {
      return 'Aucun article';
    }
    
    const itemCount = sale.items.length;
    const firstItems = sale.items.slice(0, 2).map(item => item.productName).join(', ');
    
    return `${itemCount} article${itemCount > 1 ? 's' : ''} - ${firstItems}${sale.items.length > 2 ? '...' : ''}`;
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

  openReceiptPreview(sale: Sale): void {
    this.selectedSaleForReceipt = sale;
    this.receiptHtmlPreview = this.printService.buildSaleReceiptHtml(sale, this.appSettings);
    this.showReceiptModal = true;
  }

  closeReceiptPreview(): void {
    this.showReceiptModal = false;
    this.selectedSaleForReceipt = null;
    this.receiptHtmlPreview = '';
  }

  printReceipt(sale: Sale): void {
    this.printService.printSaleReceipt(sale);
    this.salesService.markPrinted(sale.id).subscribe({
      next: () => {
        (sale as any).isPrinted = true;
        this.showAlertMessage('Reçu envoyé à l\'imprimante', 'success');
      },
      error: () => {
        // Even if marking fails, don't block UI
        this.showAlertMessage('Reçu envoyé. Statut imprimé non mis à jour.', 'error');
      }
    });
  }

  // Invoice request methods
  loadInvoiceRequests(): void {
    // This would load existing invoice requests to check which sales already have requests
    // For now, we'll implement a simple check
  }

  hasInvoiceRequest(saleId: number): boolean {
    // Check if this sale already has an invoice request
    return this.invoiceRequests.some(request => request.saleId === saleId);
  }

  loadProducts(): void {
    this.http.get(`${environment.apiUrl}/products`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (products: any) => {
          this.allProducts = products;
        },
        error: (error) => {
          console.error('Error loading products:', error);
        }
      });
  }

  requestInvoice(sale: Sale): void {
    this.selectedSaleForInvoice = sale;
    this.invoiceRequestData = {
      notes: ''
    };
    this.showInvoiceRequestModal = true;
  }

  closeInvoiceRequestModal(): void {
    this.showInvoiceRequestModal = false;
    this.selectedSaleForInvoice = null;
    this.invoiceRequestData = {
      notes: ''
    };
  }

  submitInvoiceRequest(): void {
    if (!this.selectedSaleForInvoice) return;

    this.submittingInvoiceRequest = true;

    const requestPayload = {
      saleId: this.selectedSaleForInvoice.id,
      requestNotes: this.invoiceRequestData.notes
    };

    this.http.post(`${environment.apiUrl}/invoices/request-from-ticket`, requestPayload).subscribe({
      next: (response: any) => {
        this.submittingInvoiceRequest = false;
        this.closeInvoiceRequestModal();
        this.showAlertMessage('Demande de facture envoyée avec succès!', 'success');
        // Reload sales to update the UI
        this.loadSales();
      },
      error: (error) => {
        this.submittingInvoiceRequest = false;
        console.error('Error submitting invoice request:', error);
        if ((error as any).error?.error) {
          this.showAlertMessage(`Erreur: ${(error as any).error.error}`, 'error');
        } else {
          this.showAlertMessage('Erreur lors de l\'envoi de la demande', 'error');
        }
      }
    });
  }

  // Return/Exchange UI methods
  openReturnRequestModal(sale?: Sale): void {
    this.showReturnRequestModal = true;
    this.returnItems = [];
    this.returnNotes = '';
    this.selectedSaleForReturn = sale || null;
    this.returnCashAmount = 0;
    this.returnType = null;
    this.exchangeProducts = [];
    this.showReturnPicker = false;
    // Start with no rows; user will add items explicitly
  }

  openReturnDialogForTicket(ticketId: number): void {
    // Find the sale by ID
    const sale = this.sales.find(s => s.id === ticketId);
    if (sale) {
      this.openReturnRequestModal(sale);
    } else {
      // If sale not found in current list, try to load it
      this.salesService.getSale(ticketId).subscribe({
        next: (sale) => {
          this.openReturnRequestModal(sale);
        },
        error: (error) => {
          console.error('Error loading sale:', error);
          this.showAlertMessage('Erreur lors du chargement du ticket', 'error');
        }
      });
    }
  }

  closeReturnRequestModal(): void {
    this.showReturnRequestModal = false;
    this.selectedSaleForReturn = null;
    this.returnCashAmount = 0;
    this.exchangeProducts = [];
  }


  removeReturnItem(index: number): void {
    this.returnItems.splice(index, 1);
    this.recalcReturnCash();
  }

  addReturnItemRow(): void {
    this.returnItems.push({ productId: 0, productName: '', quantity: 1, unitPrice: 0 });
  }

  // Modern per-item quantity management
  getReturnQty(productId: number): number {
    const found = this.returnItems.find(it => it.productId === productId);
    return Number(found?.quantity || 0);
  }

  private ensureReturnItemFromSale(productId: number): { productId: number; productName: string; unitPrice: number } | null {
    const saleItem: any | undefined = this.selectedSaleForReturn?.items?.find((it: any) => (it.productId ?? it.id) === productId);
    if (!saleItem) return null;
    return {
      productId: saleItem.productId ?? saleItem.id,
      productName: saleItem.productName ?? '',
      unitPrice: Number(saleItem.unitPrice ?? 0)
    };
  }

  setReturnQty(productId: number, qty: number): void {
    const quantity = Math.max(0, Number(qty) || 0);
    const meta = this.ensureReturnItemFromSale(productId);
    if (!meta) return;
    const idx = this.returnItems.findIndex(it => it.productId === productId);
    if (quantity === 0) {
      if (idx >= 0) this.returnItems.splice(idx, 1);
    } else {
      if (idx >= 0) {
        this.returnItems[idx].quantity = quantity;
        this.returnItems[idx].unitPrice = meta.unitPrice;
        this.returnItems[idx].productName = meta.productName;
      } else {
        this.returnItems.push({ productId: meta.productId, productName: meta.productName, quantity, unitPrice: meta.unitPrice });
      }
    }
    this.recalcReturnCash();
  }

  incrementReturnQty(productId: number): void {
    const soldQty = this.getSoldQty(productId);
    const next = Math.min(soldQty, this.getReturnQty(productId) + 1);
    this.setReturnQty(productId, next);
  }

  decrementReturnQty(productId: number): void {
    const next = Math.max(0, this.getReturnQty(productId) - 1);
    this.setReturnQty(productId, next);
  }

  getSoldQty(productId: number): number {
    const saleItem: any | undefined = this.selectedSaleForReturn?.items?.find((it: any) => (it.productId ?? it.id) === productId);
    return Number(saleItem?.quantity || 0);
  }

  addFirstUnselected(): void {
    // Open picker instead of auto-picking, to let user choose explicitly
    this.showReturnPicker = true;
    this.showAddItemPicker = true;
  }

  openAddItemPicker(): void {
    this.showReturnPicker = true;
    this.showAddItemPicker = true;
  }

  closeAddItemPicker(): void {
    this.showAddItemPicker = false;
  }

  addSpecificItem(productId: number | string): void {
    const pid = Number(productId);
    const saleItem: any | undefined = this.selectedSaleForReturn?.items?.find((it: any) => (it.productId ?? it.id) === pid);
    if (!saleItem) return;
    const initial = Math.min(1, Number(saleItem.quantity || 0));
    this.setReturnQty(pid, initial);
    this.showReturnPicker = true;
    this.showAddItemPicker = false;
  }

  get remainingReturnableItems(): any[] {
    const items: any[] = this.selectedSaleForReturn?.items || [];
    return items.filter((it: any) => !this.returnItems.some(r => r.productId === (it.productId ?? it.id)));
  }

  get remainingReturnableCount(): number {
    return this.remainingReturnableItems.length;
  }

  get remainingReturnableQty(): number {
    return this.remainingReturnableItems.reduce((sum: number, it: any) => sum + Number(it.quantity || 0), 0);
  }

  get selectedReturnViewItems(): Array<{ productId: number; productName: string; quantity: number; unitPrice: number; soldQty: number }> {
    const saleItems: any[] = this.selectedSaleForReturn?.items || [];
    return this.returnItems
      .filter(ri => Number(ri.quantity) > 0)
      .map(ri => {
        const src = saleItems.find((it: any) => (it.productId ?? it.id) === ri.productId);
        const soldQty = Number(src?.quantity || 0);
        const name = ri.productName || src?.productName || '';
        const unitPrice = Number(ri.unitPrice || src?.unitPrice || 0);
        return { productId: ri.productId, productName: name, quantity: Number(ri.quantity || 0), unitPrice, soldQty };
      });
  }

  returnAll(): void {
    const items: any[] = this.selectedSaleForReturn?.items || [];
    for (const it of items) {
      const pid = it.productId ?? it.id;
      const qty = Number(it.quantity || 0);
      if (qty > 0) this.setReturnQty(pid, qty);
    }
    this.showReturnPicker = true;
    this.recalcReturnCash();
  }

  onSelectReturnItem(index: number, productId: number | string): void {
    const pid = Number(productId);
    const sale = this.selectedSaleForReturn;
    const sourceItems = sale?.items ?? [];
    const src = sourceItems.find((it: any) => (it.productId ?? it.id) === pid);
    if (src) {
      this.returnItems[index].productId = src.productId ?? src.id;
      this.returnItems[index].productName = src.productName ?? '';
      this.returnItems[index].unitPrice = Number(src.unitPrice ?? 0);
    } else {
      this.returnItems[index].productId = 0;
      this.returnItems[index].productName = '';
      this.returnItems[index].unitPrice = 0;
    }
    this.recalcReturnCash();
  }

  onChangeReturnQty(index: number, qty: number | string): void {
    this.returnItems[index].quantity = Number(qty) || 0;
    this.recalcReturnCash();
  }

  recalcReturnCash(): void {
    // Only for RETURN and EXCHANGE_CASH types
    if (this.returnType === 'RETURN' || this.returnType === 'EXCHANGE_CASH') {
      const total = this.returnItems.reduce((sum, it) => sum + (Number(it.quantity || 0) * Number(it.unitPrice || 0)), 0);
      const max = this.selectedSaleForReturn?.finalTotal ?? total;
      const value = Math.min(total, max);
      this.returnCashAmount = Number(value.toFixed(2));
    } else {
      this.returnCashAmount = 0;
    }
  }

  onChangeRefund(value: number | string): void {
    this.returnCashAmount = Number(value) || 0;
  }

  setReturnType(type: ReturnTypeOption): void {
    this.returnType = type;
    this.recalcReturnCash();
  }

  get returnedItemsTotal(): number {
    return this.returnItems.reduce((sum, it) => sum + (Number(it.quantity || 0) * Number(it.unitPrice || 0)), 0);
  }

  get exchangeItemsTotal(): number {
    return this.exchangeProducts.reduce((sum, it) => sum + (Number(it.quantity || 0) * Number(it.unitPrice || 0)), 0);
  }

  get settlementDifference(): number {
    const refund = (this.returnType === 'RETURN' || this.returnType === 'EXCHANGE_CASH') ? Number(this.returnCashAmount || 0) : 0;
    const diff = this.returnedItemsTotal - (this.exchangeItemsTotal + refund);
    return Number(diff.toFixed(2));
  }

  get suggestedCashBackForExchangeProducts(): number {
    if (this.returnType !== 'EXCHANGE_PRODUCTS') return 0;
    const diff = this.returnedItemsTotal - this.exchangeItemsTotal;
    return diff > 0 ? Number(diff.toFixed(2)) : 0;
  }

  get cashRefundDue(): number {
    if (this.returnType === 'RETURN' || this.returnType === 'EXCHANGE_CASH') {
      return Number(this.returnCashAmount || 0);
    }
    if (this.returnType === 'EXCHANGE_PRODUCTS') {
      return this.suggestedCashBackForExchangeProducts;
    }
    return 0;
  }

  getDifferenceClass(): string {
    if (this.settlementDifference > 0.005) return 'text-emerald-600';
    if (this.settlementDifference < -0.005) return 'text-rose-600';
    return 'text-slate-600';
  }

  isReturnFormValid(): boolean {
    const hasItems = this.returnItems.length > 0 && this.returnItems.some(i => i.productId && i.quantity > 0);
    const hasType = !!this.returnType;
    return hasItems && hasType;
  }

  submitReturnRequest(): void {
    const currentUser = this.authService.currentUser();
    const depotId = currentUser?.depotId ?? 0;
    if (!depotId) {
      this.showAlertMessage('Depot introuvable pour utilisateur', 'error');
      return;
    }

    if (!this.isReturnFormValid()) return;
    this.submittingReturnRequest = true;
    
    // Build detailed notes based on return type
    let notes = this.returnNotes || '';
    let typeDetails = '';
    
    const refundAmount = Number(this.returnCashAmount || 0);
    
    switch (this.returnType) {
      case 'RETURN':
        typeDetails = 'Type: Retour simple (remboursement en espèces)';
        if (refundAmount > 0) {
          typeDetails += `\nRemboursement en espèces: ${refundAmount.toFixed(2)} DT`;
        }
        break;
      case 'EXCHANGE_CASH':
        typeDetails = 'Type: Échange avec remboursement en espèces';
        if (refundAmount > 0) {
          typeDetails += `\nRemboursement en espèces: ${refundAmount.toFixed(2)} DT`;
        }
        break;
      case 'EXCHANGE_PRODUCTS':
        typeDetails = 'Type: Échange contre d\'autres produits';
        if (this.exchangeProducts.length > 0) {
          typeDetails += '\nProduits d\'échange:';
          this.exchangeProducts.forEach((item, index) => {
            typeDetails += `\n${index + 1}. ${item.productName} - ${item.quantity}x ${item.unitPrice.toFixed(2)} DT = ${(item.quantity * item.unitPrice).toFixed(2)} DT`;
          });
          const suggest = this.suggestedCashBackForExchangeProducts;
          if (suggest > 0) {
            typeDetails += `\nÀ rendre au client: ${suggest.toFixed(2)} DT`;
          }
          typeDetails += `\nTotal échange: ${this.getExchangeTotal().toFixed(2)} DT`;
        }
        break;
      case 'EXCHANGE_NOTHING':
        typeDetails = 'Type: Échange gratuit (aucun remboursement)';
        break;
      default:
        break;
    }
    
    const finalNotes = notes ? `${notes}\n\n${typeDetails}` : typeDetails;

    const payload: ReturnRequestCreatePayload = {
      depotId,
      items: this.returnItems.map(i => ({ productId: i.productId, quantity: Number(i.quantity || 0) })),
      notes: finalNotes,
      originalSaleId: this.selectedSaleForReturn?.id || null,
      originalSaleTotal: this.selectedSaleForReturn?.finalTotal || null
    };

    this.returnsService.createReturnRequest(payload).subscribe({
      next: () => {
        this.submittingReturnRequest = false;
        this.showReturnRequestModal = false;
        this.showAlertMessage('Demande créée et envoyée pour approbation', 'success');
      },
      error: (err) => {
        this.submittingReturnRequest = false;
        console.error('Return request error', err);
        this.showAlertMessage("Erreur lors de la création de la demande", 'error');
      }
    });
  }

  // Exchange product methods (for the unified form)
  addExchangeProduct(): void {
    this.exchangeProducts.push({
      productId: 0,
      productName: '',
      quantity: 1,
      unitPrice: 0
    });
  }

  removeExchangeProduct(index: number): void {
    this.exchangeProducts.splice(index, 1);
  }

  onExchangeProductSelect(index: number, productId: number): void {
    const product = this.allProducts.find(p => p.id === Number(productId));
    if (product) {
      this.exchangeProducts[index].productId = product.id;
      this.exchangeProducts[index].productName = product.name;
      this.exchangeProducts[index].unitPrice = product.prix_vente_TTC;
    }
  }

  getExchangeTotal(): number {
    return this.exchangeProducts.reduce((total, item) => total + (item.quantity * item.unitPrice), 0);
  }

  onExchangeQtyChange(index: number, value: number | string): void {
    const qty = Number(value) || 0;
    if (qty <= 0) {
      this.exchangeProducts.splice(index, 1);
    } else {
      this.exchangeProducts[index].quantity = qty;
    }
  }
} 