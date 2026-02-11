import { Component, OnInit, OnDestroy } from '@angular/core';
import { Location } from '@angular/common';
import { ActivatedRoute, Router, NavigationEnd } from '@angular/router';
import { filter, takeUntil, catchError } from 'rxjs/operators';
import { Subject, forkJoin, of } from 'rxjs';
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
  groupedSales: { sessionKey: string; sessionLabel: string; sessionDateLabel?: string; sessionSuffix?: string; sales: Sale[] }[] = [];

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

  // Cancel ticket modal state
  showCancelTicketModal = false;
  ticketToCancel: Sale | null = null;
  showReturnActionMenu = false;
  selectedSaleForAction: Sale | null = null;

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
    private route: ActivatedRoute,
    private location: Location
  ) {}

  goBack(): void {
    this.location.back();
  }

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

  // Get current user's history limit for display purposes
  getCurrentUserHistoryLimit(): number {
    if (!this.appSettings) {
      return 10; // Default fallback
    }
    return this.getHistoryLimitForCurrentUser(this.appSettings);
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
        params.limit = 50; // Reduced limit per session to prevent memory issues
      } else {
        // If current session page is out of bounds, load all sales with a wide date range
        const endDate = new Date();
        const startDate = new Date();
        startDate.setFullYear(endDate.getFullYear() - 1); // Load last year of data
        params.startDate = startDate.toISOString();
        params.endDate = endDate.toISOString();
      }
    } else if (this.startDate && this.endDate) {
      // Fallback to date filtering if user has set dates
      params.startDate = `${this.startDate}T00:00:00.000`;
      params.endDate = `${this.endDate}T23:59:59.999`;
    } else {
      // If no sessions and no date range, load sales with a wide date range (last 2 years)
      // This ensures we get all recent data when sessions are not available
      const endDate = new Date();
      const startDate = new Date();
      startDate.setFullYear(endDate.getFullYear() - 2); // Load last 2 years of data
      params.startDate = startDate.toISOString();
      params.endDate = endDate.toISOString();
      params.limit = 100; // Use a reasonable limit to prevent memory issues

    }



    this.salesService.getSales(params)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (sales: any) => {

          this.sales = sales || [];
          this.totalItems = this.sales.length;
          this.applyFilters(); // This will update filteredSales and groupedSales
          this.loading = false;
          
          if (this.sales.length === 0) {
            console.warn('No sales returned. Check if sessions are loading correctly.');
          }
          
          // Apply any existing filters after loading
          if (this.searchQuery || this.selectedStatus || this.selectedPaymentMethod || 
              this.selectedSaleType || this.startDate || this.endDate) {
            this.applyFilters();
          }
        },
        error: (error) => {
          console.error('Error loading sales:', error);
          this.error = `Erreur lors du chargement des ventes: ${error?.error?.error || error?.message || 'Erreur inconnue'}`;
          this.sales = [];
          this.filteredSales = [];
          this.totalItems = 0;
          this.loading = false;
          
          // Try to load without filters as fallback
          if (Object.keys(params).length > 0) {

            setTimeout(() => {
              this.salesService.getSales({})
                .pipe(takeUntil(this.destroy$))
                .subscribe({
                  next: (sales: any) => {

                    this.sales = sales || [];
                    this.filteredSales = this.sales;
                    this.totalItems = this.sales.length;
                    this.error = '';
                  },
                  error: (fallbackError) => {
                    console.error('Fallback also failed:', fallbackError);
                  }
                });
            }, 1000);
          }
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
          // Check if user is admin
          if (this.authService.isAdmin()) {
            // Admin: load all sessions
            const sessionLimit = this.getHistoryLimitForCurrentUser(settings);
            this.loadRecentSessions(sessionLimit, after);
          } else {
            // Non-admin: only load current and last session
            this.loadCurrentAndLastSession(after);
          }
        },
        error: (error) => {
          console.error('Error loading settings:', error);
          // Fallback based on role
          if (this.authService.isAdmin()) {
            this.loadRecentSessions(10, after);
          } else {
            this.loadCurrentAndLastSession(after);
          }
        }
      });
  }

  private getHistoryLimitForCurrentUser(settings: any): number {
    const currentUser = this.authService.currentUser();
    if (!currentUser || !settings.roleHistoryLimits) {
      // Fallback to legacy setting or default
      return Number(settings.historyRetentionDays || 10);
    }

    const roleLimit = settings.roleHistoryLimits[currentUser.role];
    if (roleLimit !== undefined && roleLimit !== null) {
      return Number(roleLimit);
    }

    // Fallback to legacy setting or default
    return Number(settings.historyRetentionDays || 10);
  }

  loadRecentSessions(limit: number, after?: () => void): void {
    // Calculate date range based on role-based history limit
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - (limit - 1));
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);
    

    
    this.sessionsService.getSessions({ 
      limit: limit,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString()
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
          
          if (this.allSessions.length === 0) {
            console.warn('No sessions found. Sales will be loaded without session filter.');
          }
          
          if (after) after();
        },
        error: (error) => {
          console.error('Error loading recent sessions:', error);
          // Don't set date filters - let loadSales() handle loading all sales
          // Reset session-based pagination
          this.allSessions = [];
          this.sessionIds = [];
          this.totalSessions = 0;
          this.currentSessionPage = 1;
          

          if (after) after();
        }
      });
  }

  loadCurrentAndLastSession(after?: () => void): void {
    const currentUser = this.authService.currentUser();
    const depotId = currentUser?.depotId;
    
    if (!depotId) {
      console.error('No depot ID found for user');
      this.allSessions = [];
      this.sessionIds = [];
      this.totalSessions = 0;
      this.currentSessionPage = 1;

      if (after) after();
      return;
    }



    // Get current session (OPEN) - handle null case
    const currentSession$ = this.sessionsService.getActiveSessionByDepot(1, depotId).pipe(
      catchError((error) => {
        console.warn('Error loading current session:', error);
        return of(null);
      })
    );
    
    // Get last closed session
    const lastClosedSession$ = this.sessionsService.getSessions({
      depotId: depotId,
      status: 'CLOSED',
      limit: 1
    }).pipe(
      catchError((error) => {
        console.warn('Error loading closed sessions:', error);
        return of([]);
      })
    );

    // Combine both requests
    forkJoin({
      currentSession: currentSession$,
      closedSessions: lastClosedSession$
    }).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: ({ currentSession, closedSessions }) => {
        const sessions: any[] = [];
        
        // Add current session if exists
        if (currentSession) {
          sessions.push(currentSession);
        }
        
        // Add last closed session if exists and different from current
        if (closedSessions && closedSessions.length > 0) {
          const lastClosed = closedSessions[0];
          // Only add if it's different from current session
          if (!currentSession || currentSession.id !== lastClosed.id) {
            sessions.push(lastClosed);
          }
        }
        
        // Sort by openedAt/createdAt (newest first)
        const sorted = sessions.sort((a: any, b: any) => {
          const aTime = new Date(a.openedAt ?? a.createdAt).getTime();
          const bTime = new Date(b.openedAt ?? b.createdAt).getTime();
          return bTime - aTime;
        });

        this.allSessions = sorted;
        this.sessionIds = sorted.map((s: any) => s.id);
        this.totalSessions = this.allSessions.length;
        this.currentSessionPage = 1;
        

        
        if (this.allSessions.length === 0) {
          console.warn('No sessions found. Sales will be loaded without session filter.');
        }
        
        if (after) after();
      },
      error: (error) => {
        console.error('Error loading sessions:', error);
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

          return false;
        }
      }

      // Status filter
      if (this.selectedStatus && sale.status !== this.selectedStatus) {

        return false;
      }

      // Payment method filter
      if (this.selectedPaymentMethod && sale.paymentMethod && sale.paymentMethod.id.toString() !== this.selectedPaymentMethod) {

        return false;
      }

      // Sale type filter
      if (this.selectedSaleType) {
        const isWholesale = this.isWholesaleSale(sale);
        const isTable = this.isTableSale(sale);
        
        if (this.selectedSaleType === 'wholesale' && !isWholesale) {

          return false;
        }
        if (this.selectedSaleType === 'retail' && (isWholesale || isTable)) {

          return false;
        }
        if (this.selectedSaleType === 'table' && !isTable) {

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

            return false;
          }
        }
        if (this.endDate) {
          const endDateOnly = new Date(this.endDate);
          if (saleDateOnly > endDateOnly) {

            return false;
          }
        }
      }

      return true;
    });

    this.totalItems = this.filteredSales.length;
    this.currentSessionPage = 1;
    this.updateGroupedSales();
    
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

  isTableSale(sale: Sale): boolean {
    return !!(sale && sale.tableInfo && typeof sale.id === 'number' && sale.id >= 9000000);
  }

  // Current session helper
  private getCurrentSessionId(): number | null {
    const current = this.allSessions[this.currentSessionPage - 1];
    return current ? Number(current.id) : null;
  }

  // Group by session for multigrid sections (fallback to 'Sans session')
  updateGroupedSales(): void {
    const paginated = this.getPaginatedSalesInternal();
    
    // Build groups by session id
    const bySession = new Map<string, Sale[]>();
    for (const sale of paginated) {
      const sessionId = (sale as any)?.session?.id ?? null;
      const key = sessionId ? String(sessionId) : 'none';
      if (!bySession.has(key)) bySession.set(key, []);
      bySession.get(key)!.push(sale);
    }

    // Derive a date/time label per session based on the last sale's date (closure time)
    const sessionDateLabels = new Map<string, string>();
    const sessionTimeLabels = new Map<string, string>();
    const dateCounts = new Map<string, number>();
    for (const [key, sales] of bySession.entries()) {
      if (key === 'none') {
        sessionDateLabels.set(key, 'Sans session');
        sessionTimeLabels.set(key, '');
        continue;
      }
      // Use last sale date/time in the group as closure time
      const lastTimestamp = Math.max(
        ...sales.map(s => new Date((s as any).createdAt as any).getTime())
      );
      const lastDate = new Date(lastTimestamp);
      const dateLabel = lastDate.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
      const timeLabel = lastDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      sessionDateLabels.set(key, dateLabel);
      sessionTimeLabels.set(key, timeLabel);
      dateCounts.set(dateLabel, (dateCounts.get(dateLabel) || 0) + 1);
    }

    // Sort groups: by date desc (using the first sale date), then by session id desc, with 'none' last
    this.groupedSales = Array.from(bySession.entries())
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
        const dateLabel = sessionDateLabels.get(key) || '';
        const timeLabel = sessionTimeLabels.get(key) || '';
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
  }

  getPaginatedSalesInternal(): Sale[] {
    // Ensure we only show sales belonging to the currently selected session
    const currentSessionId = this.getCurrentSessionId();
    if (currentSessionId == null) {
      return this.filteredSales;
    }
    return this.filteredSales.filter((sale: Sale) => {
      const sid = (sale?.session?.id ?? null);
      return sid === currentSessionId;
    });
  }

  get paginatedSales(): Sale[] {
    const currentSessionId = this.getCurrentSessionId();
    if (currentSessionId == null) {
      return this.filteredSales;
    }
    return this.filteredSales.filter((sale: Sale) => {
      const sid = (sale?.session?.id ?? null);
      return sid === currentSessionId;
    });
  }

  // Getter for template to maintain compatibility, but it just returns the precomputed value
  get groupedSalesBySession(): { sessionKey: string; sessionLabel: string; sessionDateLabel?: string; sessionSuffix?: string; sales: Sale[] }[] {
    return this.groupedSales;
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

  // Get visible page numbers for pagination (max 7 pages around current)
  getVisiblePages(): (number | string)[] {
    const total = this.totalSessions;
    const current = this.currentSessionPage;
    const pages: (number | string)[] = [];
    const maxVisible = 7; // Show max 7 page numbers
    
    if (total <= maxVisible) {
      // If total pages <= maxVisible, show all
      for (let i = 1; i <= total; i++) {
        pages.push(i);
      }
    } else {
      // Calculate start and end
      let start = Math.max(1, current - Math.floor(maxVisible / 2));
      let end = Math.min(total, start + maxVisible - 1);
      
      // Adjust if we're near the end
      if (end - start < maxVisible - 1) {
        start = Math.max(1, end - maxVisible + 1);
      }
      
      // Add first page and ellipsis if needed
      if (start > 1) {
        pages.push(1);
        if (start > 2) {
          pages.push('...');
        }
      }
      
      // Add visible pages
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
      
      // Add ellipsis and last page if needed
      if (end < total) {
        if (end < total - 1) {
          pages.push('...');
        }
        pages.push(total);
      }
    }
    
    return pages;
  }

  changePage(page: number): void {
    if (page >= 1 && page <= this.totalSessions) {
      this.currentSessionPage = page;
      // Reload sales for the new session
      this.loadSales();
    }
  }

  // Helper method for template to handle page navigation
  onPageClick(page: number | string): void {
    if (typeof page === 'number') {
      this.changePage(page);
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
    // Only mark printed for regular sales, not table sales
    if (!this.isTableSale(sale)) {
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
  }

  loadProducts(): void {
    this.http.get(`${environment.apiUrl}/products`, { params: { minimal: 'true', limit: '500' } })
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

  // Return/Exchange action menu
  openReturnActionMenu(sale: Sale): void {
    this.selectedSaleForAction = sale;
    this.showReturnActionMenu = true;
  }

  closeReturnActionMenu(): void {
    this.showReturnActionMenu = false;
    this.selectedSaleForAction = null;
  }

  selectAnnulation(): void {
    if (!this.selectedSaleForAction) return;
    const ticket = this.selectedSaleForAction; // Save reference before closing menu
    this.closeReturnActionMenu();
    this.openCancelTicketModal(ticket);
  }

  selectRetourEchange(): void {
    if (!this.selectedSaleForAction) return;
    const ticket = this.selectedSaleForAction; // Save reference before closing menu
    this.closeReturnActionMenu();
    this.openReturnRequestModal(ticket);
  }

  // Cancel ticket methods (copied from caisse.component.ts)
  openCancelTicketModal(ticket: Sale): void {
    if (!ticket) {
      console.error('openCancelTicketModal: No ticket provided');
      return;
    }
    console.log('Opening cancel modal for ticket:', ticket);
    const st = (ticket as any)?.status ? String((ticket as any).status).toUpperCase() : '';
    if (st === 'CANCELLED' || st === 'REFUNDED') {
      this.showAlertMessage('Ticket déjà annulé', 'info');
      return;
    }
    this.ticketToCancel = ticket;
    this.showCancelTicketModal = true;
    console.log('Cancel modal opened, ticketToCancel:', this.ticketToCancel);
  }

  closeCancelTicketModal(): void {
    this.showCancelTicketModal = false;
    this.ticketToCancel = null;
  }

  confirmCancelTicket(): void {
    if (!this.ticketToCancel) {
      console.error('Confirm cancel: No ticket to cancel');
      this.showAlertMessage('Erreur: Aucun ticket sélectionné', 'error');
      return;
    }
    console.log('Confirming cancellation for ticket:', this.ticketToCancel.id);
    this.cancelTicket(this.ticketToCancel);
  }

  cancelTicket(ticket: Sale): void {
    if (!ticket?.id) {
      console.error('Cancel ticket: No ticket ID');
      this.showAlertMessage('Erreur: Aucun ticket sélectionné', 'error');
      return;
    }
    const status = (ticket as any)?.status ? String((ticket as any).status).toUpperCase() : '';
    if (status === 'CANCELLED' || status === 'REFUNDED') {
      this.showAlertMessage('Ticket déjà annulé', 'info');
      return;
    }
    
    console.log('Cancelling ticket:', ticket.id);
    this.http.put(`${environment.apiUrl}/sales/${ticket.id}/status`, { status: 'CANCELLED' }, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    }).subscribe({
      next: (response) => {
        console.log('Ticket cancelled successfully:', response);
        this.showAlertMessage('Ticket annulé', 'success');
        this.loadSales();
        this.closeCancelTicketModal();
      },
      error: (error) => {
        console.error('Error cancelling ticket:', error);
        const errorMessage = error?.error?.error || error?.message || 'Erreur lors de l\'annulation du ticket';
        this.showAlertMessage(`Erreur: ${errorMessage}`, 'error');
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
      originalSaleId: this.selectedSaleForReturn && !this.isTableSale(this.selectedSaleForReturn) ? this.selectedSaleForReturn.id : null,
      originalSaleTotal: this.selectedSaleForReturn?.finalTotal || null
    };

    this.returnsService.createReturnRequest(payload).subscribe({
      next: () => {
        this.submittingReturnRequest = false;
        this.showReturnRequestModal = false;
        
        // Check if it's a simple return (processed immediately)
        const isSimpleReturn = this.returnType === 'RETURN';
        if (isSimpleReturn) {
          this.showAlertMessage('Retour traité immédiatement: stock restauré et montant retiré de la caisse', 'success');
          // Reload sales to reflect changes
          this.loadSales();
        } else {
          this.showAlertMessage('Demande créée et envoyée pour approbation', 'success');
        }
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