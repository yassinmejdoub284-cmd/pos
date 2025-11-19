import { Component, OnInit, ChangeDetectionStrategy, OnDestroy, ChangeDetectorRef, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../core/services/auth.service';
import { SalesService } from '../core/services/sales.service';
import { ExpenseService } from '../core/services/expense.service';
import { ApprovalsService } from '../core/services/approvals.service';
import { SessionsService } from '../core/services/sessions.service';
import { DepotsService } from '../core/services/depots.service';
import { EnterpriseService } from '../core/services/enterprise.service';
import { SettingsService, AppSettings } from '../core/services/settings.service';
import { FullscreenService } from '../core/services/fullscreen.service';
import { Subject, forkJoin, timer, of } from 'rxjs';
import { takeUntil, catchError, shareReplay, debounceTime } from 'rxjs/operators';
import { environment } from '../../environments/environment';

interface DashboardStats {
  todaySales: number;
  todayTransactions: number;
  pendingApprovals: number;
  activeSession: boolean;
}

interface QuickAction {
  id: string;
  title: string;
  description?: string;
  route: string;
  icon: string;
  color: string;
  gradient: string;
  roles: string[];
}

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HomeComponent implements OnInit, OnDestroy {
  // Signals for reactive state management
  currentUser = signal<any>(null);
  dashboardStats = signal<DashboardStats>({
    todaySales: 0,
    todayTransactions: 0,
    pendingApprovals: 0,
    activeSession: false
  });
  
  loading = signal(true);
  currentTime = signal(new Date());
  greeting = signal('');
  
  // Dialog states
  showExpenseActionDialog = signal(false);
  showClientActionDialog = signal(false);
  showApprovalsActionDialog = signal(false);
  showSupplierActionDialog = signal(false);
  showSettingsActionDialog = signal(false);
  showEnterpriseActionDialog = signal(false);
  showHistoriqueChoiceDialog = signal(false);
  showCompanySwitchDialog = signal(false);
  companySwitchData = signal<{ companyName: string; logoUrl?: string | null } | null>(null);
  showExtraitDepotDialog = signal(false);
  
  // Settings
  appSettings = signal<AppSettings | null>(null);
  companyName = signal('PoS Pâtisserie');
  companyLogo = signal('');
  logoLoadError = signal(false);
  
  // Pending breakdown
  private pendingGiftCount = 0;
  private pendingExpenseCount = 0;
  private pendingClotureCount = 0;

  // Day-over-day deltas
  salesVsYesterdayPct: number = 0;
  transactionsVsYesterdayPct: number = 0;

  // Invoiced sales
  invoicedSales = signal<any[]>([]);
  loadingInvoices = signal(false);
  
  // Performance optimization
  private destroy$ = new Subject<void>();
  private timeInterval: any;
  
  // Cached filtered actions to avoid repeated computation
  private _cachedFilteredActions: QuickAction[] = [];
  private _lastUserRole: string | null = null;

  quickActions: QuickAction[] = [
    {
      id: 'caisse',
      title: 'Caisse',
      description: 'Point de vente',
      route: '/caisse',
      icon: 'M472 96c13.232 0 24-10.768 24-24V24c0-13.232-10.768-24-24-24H312c-13.232 0-24 10.768-24 24v48c0 13.232 10.768 24 24 24h48v240h-16V152c0-22.056-17.944-40-40-40H192V0H48v112h-8c-22.056 0-40 17.944-40 40v184v8v152h496V336h-72V96H472zM64 16h16v16h16V16h16v16h16V16h16v16h16V16h16v144H64V16zM16 152c0-13.232 10.768-24 24-24h8v32H32v16h176v-16h-16v-32h112c13.232 0 24 10.768 24 24v184H16V152zM480 352v128H16V352H480zM376 336V96h32v240H376zM312 80c-4.416 0-8-3.584-8-8V24c0-4.416 3.584-8 8-8h160c4.416 0 8 3.584 8 8v48c0 4.416-3.584 8-8 8H312z',
      color: 'from-emerald-500 to-green-600',
      gradient: 'from-emerald-50 to-green-100',
      roles: ['ADMIN', 'MANAGER', 'CASHIER']
    },
    {
      id: 'historique-ventes',
      title: 'Historique Ventes',
      description: 'Transactions',
      route: '/historique',
      icon: 'M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01',
      color: 'from-sky-500 to-cyan-600',
      gradient: 'from-sky-50 to-cyan-100',
      roles: ['ADMIN', 'MANAGER', 'CASHIER']
    },
    {
      id: 'cloture',
      title: 'Clôture',
      description: 'Fin journée',
      route: '/cloture',
      icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
      color: 'from-rose-500 to-pink-600',
      gradient: 'from-rose-50 to-pink-100',
      roles: ['ADMIN', 'MANAGER', 'CASHIER']
    },
    {
      id: 'stock',
      title: 'Stock',
      description: 'Stock',
      route: '/stock',
      icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
      color: 'from-orange-500 to-amber-600',
      gradient: 'from-orange-50 to-amber-100',
      roles: ['ADMIN', 'MANAGER', 'STOCK_MANAGER']
    },
    {
      id: 'bon-entree',
      title: 'Bon d\'entrée',
      description: 'Bon d\'entrée',
      route: '/stock/documents/bon-entree/' + this.currentUser()?.depotId,
      icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
      color: 'from-emerald-500 to-green-600',
      gradient: 'from-emerald-50 to-green-100',
      roles: ['CASHIER']
    },
    {
      id: 'bon-entree',
      title: 'Bon d\'entrée',
      description: 'Bon d\'entrée',
      route: '/stock/documents/bon-entree/' + this.currentUser()?.depotId,
      icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
      color: 'from-emerald-500 to-green-600',
      gradient: 'from-emerald-50 to-green-100',
      roles: ['CASHIER']
    },
    {
      id: 'bon-retour',
      title: 'Bon de retour',
      description: 'Bon de retour',
      route: '/stock/documents/bon-retour/' + this.currentUser()?.depotId,
      icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
      color: 'from-rose-500 to-pink-600',
      gradient: 'from-rose-50 to-pink-100',
      roles: ['CASHIER']
    },
    {
      id: 'Produits de Caisse',
      title: 'Produits de Caisse',
      description: 'Produits de Caisse',
      route: '/stock/produits',
      icon: 'M16 11V7a4 4 0 10-8 0v4M5 8h14l-1 10H6L5 8z',
      color: 'from-indigo-500 to-purple-600',
      gradient: 'from-indigo-50 to-purple-100',
      roles: ['CASHIER']
    },
    {
      id: 'parametres',
      title: 'Paramètres',
      route: '/parametres',
      icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
      color: 'from-yellow-500 to-amber-600',
      gradient: 'from-yellow-50 to-amber-100',
      roles: ['ADMIN', 'MANAGER']
    },
    {
      id: 'rapports',
      title: 'Rapports',
      description: 'Analyses',
      route: '/rapports',
      icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
      color: 'from-blue-500 to-indigo-600',
      gradient: 'from-blue-50 to-indigo-100',
      roles: ['ADMIN', 'MANAGER']
    },
    {
      id: 'vente-tables',
      title: 'Vente Tables',
      description: 'Ventes par table',
      route: '/vente-tables',
      icon: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z',
      color: 'from-purple-500 to-pink-600',
      gradient: 'from-purple-50 to-pink-100',
      roles: ['ADMIN', 'MANAGER', 'CASHIER']
    },
    {
      id: 'approvals',
      title: 'Centre d\'approbation',
      route: '/approvals',
      icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
      color: 'from-purple-500 to-violet-600',
      gradient: 'from-purple-50 to-violet-100',
      roles: ['ADMIN', 'MANAGER']
    },
    {
      id: 'reminders-admin',
      title: 'Rappels (Administration)',
      description: 'Créer et gérer les rappels',
      route: '/reminders',
      icon: 'M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
      color: 'from-emerald-500 to-cyan-600',
      gradient: 'from-emerald-50 to-cyan-100',
      roles: ['ADMIN', 'MANAGER']
    },
    {
      id: 'charges',
      title: 'Dépenses',
      route: '/charges',
      icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
      color: 'from-red-500 to-rose-600',
      gradient: 'from-red-50 to-rose-100',
      roles: ['ADMIN', 'MANAGER', 'CASHIER']
    },
    {
      id: 'clients',
      title: 'Clients',
      route: '/clients',
      icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
      color: 'from-lime-500 to-green-600',
      gradient: 'from-lime-50 to-green-100',
      roles: ['ADMIN', 'MANAGER', 'CASHIER']
    },
    {
      id: 'suppliers',
      title: 'Fournisseurs',
      route: '/suppliers',
      icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
      color: 'from-indigo-500 to-purple-600',
      gradient: 'from-indigo-50 to-purple-100',
      roles: ['ADMIN', 'MANAGER', 'CASHIER']
    },
    {
      id: 'historique-pointage',
      title: 'Historique Pointage',
      description: 'Entrée/Sortie',
      route: '/pointage',
      icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
      color: 'from-slate-500 to-gray-600',
      gradient: 'from-slate-50 to-gray-100',
      roles: ['ADMIN', 'MANAGER', 'CASHIER']
    },
    {
      id: 'factures',
      title: 'Factures',
      description: 'Ventes facturées',
      route: '/factures',
      icon: 'M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z',
      color: 'from-indigo-500 to-blue-600',
      gradient: 'from-indigo-50 to-blue-100',
      roles: ['ADMIN', 'MANAGER', 'CASHIER']
    },
    {
      id: 'extrait-par-article',
      title: 'Extrait par Article',
      description: 'Rapport par article',
      route: '/extrait-par-article',
      icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
      color: 'from-teal-500 to-cyan-600',
      gradient: 'from-teal-50 to-cyan-100',
      roles: ['ADMIN', 'MANAGER']
    },
    // {
    //   id: 'stock-management',
    //   title: 'Gestion de Stock',
    //   description: 'Gérer les entrées de stock pour tous les dépôts',
    //   route: '/stock-management',
    //   icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
    //   color: 'from-emerald-500 to-teal-600',
    //   gradient: 'from-emerald-50 to-teal-100',
    //   roles: ['ADMIN', 'MANAGER']
    // }
  ];

  constructor(
    private authService: AuthService,
    private salesService: SalesService,
    private sessionsService: SessionsService,
    private expenseService: ExpenseService,
    private approvalsService: ApprovalsService,
    private settingsService: SettingsService,
    private depotsService: DepotsService,
    private enterpriseService: EnterpriseService,
    private fullscreenService: FullscreenService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    this.currentUser.set(this.authService.currentUser());
    try {
      const u: any = this.currentUser();
      const roleKey = u?.roleKey || u?.role;
    } catch {}
    // Clear cached actions on init to ensure fresh filtering
    this._cachedFilteredActions = [];
    this._lastUserRole = null;
    this.updateGreeting();
    this.loadDashboardStats();
    this.loadSettings();
    this.checkCompanySwitchInfo();
    
    // Update time every minute - optimized with proper cleanup
    this.timeInterval = setInterval(() => {
      this.currentTime.set(new Date());
      this.updateGreeting();
    }, 60000);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.timeInterval) {
      clearInterval(this.timeInterval);
    }
  }

  updateGreeting(): void {
    const hour = this.currentTime().getHours();
    if (hour < 12) {
      this.greeting.set('Bonjour');
    } else if (hour < 18) {
      this.greeting.set('Bon après-midi');
    } else {
      this.greeting.set('Bonsoir');
    }
  }

  loadDashboardStats(): void {
    this.loading.set(true);
    
    // Optimize: Load critical data first, then non-critical data
    const criticalData$ = forkJoin({
      sales: this.salesService.getSales().pipe(
        takeUntil(this.destroy$),
        catchError(error => {
          console.error('Error loading sales:', error);
          return of([]);
        })
      ),
      session: this.sessionsService.getActiveSessionByDepot().pipe(
        takeUntil(this.destroy$),
        catchError(error => {
          console.error('Error loading session:', error);
          return of(null);
        })
      )
    });

    // Load critical data first
    criticalData$.subscribe({
      next: (data) => {
        this.processCriticalData(data);
        this.loading.set(false);
        // Load non-critical data in background
        this.loadNonCriticalData();
      },
      error: (error) => {
        console.error('Error loading critical dashboard data:', error);
        this.loading.set(false);
        this.loadNonCriticalData();
      }
    });
  }

  private loadNonCriticalData(): void {
    // Load non-critical data in background without blocking UI
    forkJoin({
      expenses: this.expenseService.getExpenses().pipe(
        takeUntil(this.destroy$),
        catchError(error => {
          console.error('Error loading expenses:', error);
          return of([]);
        })
      ),
      varianceRequests: this.approvalsService.getVarianceChangeRequests('PENDING').pipe(
        takeUntil(this.destroy$),
        catchError(error => {
          console.error('Error loading variance requests:', error);
          return of([]);
        })
      )
    }).subscribe({
      next: (data) => {
        this.processNonCriticalData(data);
      },
      error: (error) => {
        console.error('Error loading non-critical dashboard data:', error);
      }
    });
  }

  private processCriticalData(data: any): void {
    const { sales, session } = data;
    
    // Process sales data
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    
    const userDepotId = this.currentUser()?.depotId;
    const filteredSales = userDepotId ? sales.filter((sale: any) => sale.depotId === userDepotId) : sales;
    
    const todaySales = filteredSales.filter((sale: any) => {
      const saleDate = new Date(sale.createdAt);
      saleDate.setHours(0, 0, 0, 0);
      return saleDate.getTime() === today.getTime() && sale.status === 'COMPLETED';
    });

    const todaySalesTotal = todaySales.reduce((sum: number, sale: any) => sum + Number(sale.finalTotal), 0);
    const todayTransactions = todaySales.length;

    // Compute yesterday metrics
    const yesterdaySales = filteredSales.filter((sale: any) => {
      const saleDate = new Date(sale.createdAt);
      saleDate.setHours(0, 0, 0, 0);
      return saleDate.getTime() === yesterday.getTime() && sale.status === 'COMPLETED';
    });

    const yesterdaySalesTotal = yesterdaySales.reduce((sum: number, sale: any) => sum + Number(sale.finalTotal), 0);
    const yesterdayTransactions = yesterdaySales.length;

    this.salesVsYesterdayPct = this.computePercentageChange(todaySalesTotal, yesterdaySalesTotal);
    this.transactionsVsYesterdayPct = this.computePercentageChange(todayTransactions, yesterdayTransactions);
    
    // Count pending approvals from sales
    this.pendingGiftCount = filteredSales.filter((sale: any) => sale.status === 'PENDING_ADMIN').length;
    
    // Update dashboard stats with critical data
    this.dashboardStats.update(stats => ({
      ...stats,
      todaySales: todaySalesTotal,
      todayTransactions: todayTransactions,
      activeSession: !!session
    }));
    
    this.updatePendingApprovals();
  }

  loadInvoicedSales(): void {
    this.loadingInvoices.set(true);
    const userDepotId = this.currentUser()?.depotId;
    const url = `${environment.apiUrl}/invoices?status=ISSUED&limit=10${userDepotId ? '&depotId=' + userDepotId : ''}`;
    
    this.http.get(url, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    }).pipe(
      takeUntil(this.destroy$),
      catchError(error => {
        console.error('Error loading invoiced sales:', error);
        return of({ invoices: [] });
      })
    ).subscribe({
      next: (response: any) => {
        this.invoicedSales.set(response.invoices || []);
        this.loadingInvoices.set(false);
        this.cdr.markForCheck();
      },
      error: () => {
        this.invoicedSales.set([]);
        this.loadingInvoices.set(false);
        this.cdr.markForCheck();
      }
    });
  }

  formatInvoiceDate(date: string | Date): string {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  private processNonCriticalData(data: any): void {
    const { expenses, varianceRequests } = data;
    
    const userDepotId = this.currentUser()?.depotId;
    
    const filteredExpenses = userDepotId ? (expenses || []).filter((e: any) => e.depotId === userDepotId) : (expenses || []);
    this.pendingExpenseCount = filteredExpenses.filter((e: any) => !e.isApproved).length;
    
    const filteredRequests = userDepotId ? (varianceRequests || []).filter((r: any) => r.session?.depot?.id === userDepotId) : (varianceRequests || []);
    this.pendingClotureCount = filteredRequests.length;
    
    this.updatePendingApprovals();
  }

  private updatePendingApprovals(): void {
    this.dashboardStats.update(stats => ({
      ...stats,
      pendingApprovals: this.pendingGiftCount + this.pendingExpenseCount + this.pendingClotureCount
    }));
  }

  getFilteredActions(): QuickAction[] {
    const currentUser = this.currentUser();
    if (!currentUser) return [];

    const effectiveRoleKey = this.getEffectiveRoleKey();
    if (this._lastUserRole !== effectiveRoleKey) {
      this._lastUserRole = effectiveRoleKey || null;
      this._cachedFilteredActions = [];
    }

    if (this._cachedFilteredActions.length === 0) {
      const settings = this.appSettings();
      const access = (settings?.roleAccessConfig || {}) as any;
      const roleAccessBlocks = effectiveRoleKey ? (access?.[effectiveRoleKey]?.blocks || {}) : {};

      if (roleAccessBlocks && Object.keys(roleAccessBlocks).length > 0) {
        // Strict: only show modules explicitly marked visible for this role key
        const visibleIds = Object.keys(roleAccessBlocks).filter(k => roleAccessBlocks[k]?.visible === true);
        // If extrait-par-article is not in visibleIds but user has ADMIN/MANAGER role, include it
        const userRole = currentUser?.role || '';
        const shouldIncludeExtrait = (userRole === 'ADMIN' || userRole === 'MANAGER') && 
                                     !visibleIds.includes('extrait-par-article') &&
                                     this.quickActions.find(a => a.id === 'extrait-par-article');
        
        if (shouldIncludeExtrait) {
          visibleIds.push('extrait-par-article');
          console.log('Adding extrait-par-article to visible modules for', userRole);
        }
        
        this._cachedFilteredActions = this.quickActions.filter(a => visibleIds.includes(a.id));
        console.log('Filtered actions (roleAccessConfig):', this._cachedFilteredActions.map(a => a.id), 'visibleIds:', visibleIds);
        console.log('All quickActions IDs:', this.quickActions.map(a => a.id));
        console.log('extrait-par-article in quickActions:', this.quickActions.find(a => a.id === 'extrait-par-article'));
      } else {
        // Fallback: filter by roles defined in each action
        const userRole = currentUser?.role || '';
        this._cachedFilteredActions = this.quickActions.filter(a => {
          if (!a.roles || a.roles.length === 0) return true;
          return a.roles.includes(userRole);
        });
        console.log('Filtered actions (fallback):', this._cachedFilteredActions.map(a => a.id));
        console.log('User role:', userRole);
        console.log('extrait-par-article module:', this.quickActions.find(a => a.id === 'extrait-par-article'));
      }
    }

    return this._cachedFilteredActions;
  }

  private getEffectiveRoleKey(): string | null {
    const user: any = this.currentUser();
    if (!user) return null;
    // Prefer explicit roleKey when present
    if (user.roleKey && typeof user.roleKey === 'string') return user.roleKey;
    const raw = String(user.role || '').trim();
    if (!raw) return null;
    const access: any = this.appSettings()?.roleAccessConfig;
    if (access && access[raw]) return raw;
    if (access && typeof access === 'object') {
      const match = Object.keys(access).find(k => (access[k]?.meta?.label || '').toLowerCase() === raw.toLowerCase());
      if (match) return match;
    }
    // Fallback normalization
    return raw.toUpperCase().replace(/\s+/g, '_');
  }

  navigateTo(route: string): void {
    if (route === '/charges') {
      const allowed = this.getAllowedSubmodules('charges');
      const actionToSub: Record<string, string> = {
        consult: 'depenses-consulter',
        add: 'depenses-ajouter',
        'add-category': 'depenses-categorie',
        statistics: 'depenses-statistiques'
      };
      const allowedActions = Object.keys(actionToSub).filter(a => allowed.has(actionToSub[a]));
      if (allowedActions.length === 0) return;
      if (allowedActions.length === 1) { this.onExpenseActionSelected(allowedActions[0]); return; }
      this.showExpenseActionDialog.set(true);
      this.cdr.detectChanges();
    } else if (route === '/clients') {
      const allowed = this.getAllowedSubmodules('clients');
      const actionToSub: Record<string, string> = {
        consult: 'clients-consulter',
        add: 'clients-ajouter',
        statement: 'clients-releve',
        payment: 'clients-reglement'
      };
      const allowedActions = Object.keys(actionToSub).filter(a => allowed.has(actionToSub[a]));
      if (allowedActions.length === 0) return;
      if (allowedActions.length === 1) { this.onClientActionSelected(allowedActions[0]); return; }
      this.showClientActionDialog.set(true);
      this.cdr.detectChanges();
    } else if (route === '/suppliers') {
      const allowed = this.getAllowedSubmodules('suppliers');
      const actionToSub: Record<string, string> = {
        consult: 'fournisseurs-consulter',
        add: 'fournisseurs-ajouter',
        statement: 'fournisseurs-releve',
        payment: 'fournisseurs-reglement'
      };
      const allowedActions = Object.keys(actionToSub).filter(a => allowed.has(actionToSub[a]));
      if (allowedActions.length === 0) return;
      if (allowedActions.length === 1) { this.onSupplierActionSelected(allowedActions[0]); return; }
      this.showSupplierActionDialog.set(true);
      this.cdr.detectChanges();
    } else if (route === '/parametres') {
      this.showSettingsActionDialog.set(true);
      this.cdr.detectChanges();
    } else if (route === '/historique') {
      // Direct navigation to historique ventes (no dialog)
      this.router.navigate(['/historique']);
    } else if (route === '/pointage') {
      // Direct navigation to historique pointage (no dialog)
      this.router.navigate(['/pointage']);
    } else if (route === '/extrait-par-article') {
      // Show depot selection dialog for extrait par article
      this.showExtraitDepotDialog.set(true);
      this.cdr.detectChanges();
    } else {
      this.router.navigate([route]);
    }
  }

  onHistoriqueChoiceSelected(choice: 'VENTES' | 'POINTAGE'): void {
    this.showHistoriqueChoiceDialog.set(false);
    if (choice === 'VENTES') {
      this.router.navigate(['/historique']);
    } else if (choice === 'POINTAGE') {
      this.router.navigate(['/pointage']);
    }
  }

  onHistoriqueChoiceClosed(): void {
    this.showHistoriqueChoiceDialog.set(false);
  }

  onExtraitDepotSelected(depotId: string): void {
    // If user is super admin, store the selected depot ID in sessionStorage
    // This will filter all sessions by this depot ID via the X-Depot-Id header
    if (this.authService.isSuperAdmin()) {
      sessionStorage.setItem('visitingDepotId', depotId);
      localStorage.setItem('visitingDepotId', depotId);
      console.log('Super admin selected depot for session filtering:', depotId);
    }
    this.showExtraitDepotDialog.set(false);
    this.router.navigate(['/extrait-par-article', depotId]);
  }

  onExtraitDepotDialogClosed(): void {
    this.showExtraitDepotDialog.set(false);
  }

  onExpenseActionSelected(actionId: string): void {
    this.showExpenseActionDialog.set(false);
    
    switch (actionId) {
      case 'consult':
        this.router.navigate(['/charges']);
        break;
      case 'add':
        this.router.navigate(['/charges'], { queryParams: { action: 'add' } });
        break;
      case 'add-category':
        this.router.navigate(['/charges'], { queryParams: { action: 'add-category' } });
        break;
      case 'statistics':
        this.router.navigate(['/charges'], { queryParams: { action: 'statistics' } });
        break;
    }
  }

  onExpenseDialogClosed(): void {
    this.showExpenseActionDialog.set(false);
  }

  onClientActionSelected(actionId: string): void {
    this.showClientActionDialog.set(false);
    
    switch (actionId) {
      case 'consult':
        this.router.navigate(['/clients']);
        break;
      case 'add':
        this.router.navigate(['/clients'], { queryParams: { action: 'add' } });
        break;
      case 'wholesale':
        this.router.navigate(['/client-gros']);
        break;
      case 'statement':
        this.router.navigate(['/client-statement']);
        break;
      case 'payment':
        this.router.navigate(['/client-payments']);
        break;
    }
  }

  onClientDialogClosed(): void {
    this.showClientActionDialog.set(false);
  }

  onApprovalsActionSelected(actionId: string): void {
    this.showApprovalsActionDialog.set(false);
    if (actionId === 'pending') {
      this.router.navigate(['/approvals'], { queryParams: { tab: 'EXPENSES' } });
    } else {
      this.router.navigate(['/approvals/history']);
    }
  }

  onApprovalsDialogClosed(): void {
    this.showApprovalsActionDialog.set(false);
  }

  onSupplierActionSelected(actionId: string): void {
    this.showSupplierActionDialog.set(false);
    
    switch (actionId) {
      case 'consult':
        this.router.navigate(['/suppliers']);
        break;
      case 'add':
        this.router.navigate(['/suppliers'], { queryParams: { action: 'add' } });
        break;
      case 'statement':
        this.router.navigate(['/supplier-statement']);
        break;
      case 'payment':
        this.router.navigate(['/supplier-payments']);
        break;
    }
  }

  onSupplierDialogClosed(): void {
    this.showSupplierActionDialog.set(false);
  }


  onSettingsActionSelected(actionId: string): void {
    this.showSettingsActionDialog.set(false);
    
    switch (actionId) {
      case 'general':
        this.router.navigate(['/parametres']);
        break;
      case 'users':
        this.router.navigate(['/auth/users']);
        break;
      case 'access':
        this.router.navigate(['/parametres/access']);
        break;
      case 'tables-salon':
        this.router.navigate(['/tables-salon']);
        break;
      case 'enterprise':
        this.showEnterpriseActionDialog.set(true);
        break;
      case 'reminders':
        this.router.navigate(['/reminders']);
        break;
    }
  }

  onSettingsDialogClosed(): void {
    this.showSettingsActionDialog.set(false);
  }

  onEnterpriseActionSelected(actionId: string): void {
    this.showEnterpriseActionDialog.set(false);
    if (actionId === 'enterprises') {
      this.router.navigate(['/enterprise/companies']);
    } else if (actionId === 'depots-shops') {
      this.router.navigate(['/enterprise/depots-shops']);
    }
  }

  onEnterpriseDialogClosed(): void {
    this.showEnterpriseActionDialog.set(false);
  }

  private checkCompanySwitchInfo(): void {
    try {
      const infoRaw = sessionStorage.getItem('companySwitchInfo');
      if (!infoRaw) return;
      sessionStorage.removeItem('companySwitchInfo');
      const info = JSON.parse(infoRaw);
      this.companySwitchData.set({ companyName: info.companyName || 'Entreprise', logoUrl: info.logoUrl || null });
      this.showCompanySwitchDialog.set(true);
      this.cdr.markForCheck();
    } catch {}
  }




  getRoleDisplayName(): string {
    const u: any = this.currentUser();
    if (!u) return '';
    // Prefer explicit roleKey if present
    if (u.roleKey && typeof u.roleKey === 'string') return u.roleKey;
    // Try to resolve key by matching settings meta.label to user.role (e.g., 'Administrateur' -> 'ADMIN')
    const access: any = this.appSettings()?.roleAccessConfig;
    if (access && typeof access === 'object') {
      const match = Object.keys(access).find(k => (access[k]?.meta?.label || '').toLowerCase() === String(u.role || '').toLowerCase());
      if (match) return match;
    }
    // Fallback: show raw role
    return String(u.role || '');
  }

  isAdmin(): boolean {
    return this.currentUser()?.role === 'ADMIN';
  }

  logout(): void {
    // Stop all pending API calls
    this.destroy$.next();
    this.destroy$.complete();
    
    // Clear session and redirect
    this.authService.logout();
    
    // Navigate immediately - auth service will handle session clearing
    this.router.navigate(['/auth/login']);
  }

  async toggleFullscreen(): Promise<void> {
    try {
      await this.fullscreenService.toggleFullscreen();
    } catch (error) {
      console.error('Error toggling fullscreen:', error);
    }
  }

  get isFullscreen(): boolean {
    return this.fullscreenService.isFullscreen();
  }

  get isFullscreenSupported(): boolean {
    return this.fullscreenService.isSupported();
  }

  // Access-control helpers for sub-modules
  private getAllowedSubmodules(blockId: string): Set<string> {
    const effectiveRoleKey = this.getEffectiveRoleKey();
    const access: any = this.appSettings() || {};
    const subs = effectiveRoleKey ? (access?.roleAccessConfig?.[effectiveRoleKey]?.blocks?.[blockId]?.submodules || {}) : {};
    return new Set(Object.keys(subs).filter(k => subs[k] === true));
  }

  private isSubAllowed(blockId: string, subId: string): boolean {
    return this.getAllowedSubmodules(blockId).has(subId);
  }

  loadSettings(): void {
    this.settingsService.getSettings().pipe(
      takeUntil(this.destroy$),
      catchError(error => {
        console.error('Error loading settings:', error);
        return of(null);
      })
    ).subscribe(settings => {
      if (settings) {
        this.appSettings.set(settings);
        console.log('settings', settings);
        this.companyName.set(settings.companyName || 'PoS Pâtisserie');
        this.companyLogo.set(settings.logoUrl ? this.settingsService.getAbsoluteLogoUrl(settings.logoUrl) : '');
        this.logoLoadError.set(false); // Reset error state when loading new settings
        // Invalidate cached actions so filtering re-evaluates with fresh settings
        this._cachedFilteredActions = [];
        this._lastUserRole = null; // Also reset role to force re-evaluation
        this.cdr.markForCheck();

        // Attempt to enrich with enterprise (company) data of the user's depot
        this.loadEnterpriseFromUserDepot(settings);
      }
    });
  }

  private loadEnterpriseFromUserDepot(baseSettings: AppSettings): void {
    // If admin, prefer depot chosen at login (visitingDepotId); otherwise use user's depotId
    const isAdmin = this.authService.isAdmin();
    const visitingDepotIdStr = isAdmin ? sessionStorage.getItem('visitingDepotId') : null;
    const visitingDepotId = visitingDepotIdStr ? Number(visitingDepotIdStr) : undefined;
    const depotId = (isAdmin ? (visitingDepotId || this.currentUser()?.depotId) : this.currentUser()?.depotId) as number | undefined;
    if (!depotId) return;

    this.depotsService.get(depotId).pipe(
      takeUntil(this.destroy$),
      catchError(err => {
        console.error('Error fetching depot for enterprise settings:', err);
        return of(null);
      })
    ).subscribe(depot => {
      if (!depot) return;
      const companyId = (depot as any).companyId ?? (depot as any).company?.id;
      if (!companyId) return;

      this.enterpriseService.getCompany(Number(companyId)).pipe(
        takeUntil(this.destroy$),
        catchError(err => {
          console.error('Error fetching enterprise company:', err);
          return of(null);
        })
      ).subscribe(company => {
        if (!company) return;

        // Merge company info into settings display
        const merged: AppSettings = {
          ...baseSettings,
          companyName: company.raisonSociale || baseSettings.companyName,
          logoUrl: company.logoUrl || baseSettings.logoUrl,
          companyAddress: company.adresse || baseSettings.companyAddress,
          companyPhone: company.telephone || baseSettings.companyPhone,
          companyEmail: company.email || baseSettings.companyEmail,
        };

        this.appSettings.set(merged);
        this.companyName.set(merged.companyName || 'PoS Pâtisserie');
        this.companyLogo.set(merged.logoUrl ? this.settingsService.getAbsoluteLogoUrl(merged.logoUrl) : '');
        this.logoLoadError.set(false);
        this._cachedFilteredActions = [];
        this.cdr.markForCheck();
      });
    });
  }

  onLogoError(): void {
    this.logoLoadError.set(true);
    this.companyLogo.set(''); // Clear the logo URL to ensure fallback shows
  }

  private computePercentageChange(currentValue: number, previousValue: number): number {
    if (previousValue === 0) {
      if (currentValue === 0) return 0;
      // Define 100% growth from zero to positive; could be Infinity, use 100 as a sensible cap
      return 100;
    }
    const delta = ((currentValue - previousValue) / previousValue) * 100;
    return delta;
  }

  getDeltaLabel(delta: number): string {
    if (delta === undefined || delta === null || isNaN(delta)) return '0.0%';
    const sign = delta > 0 ? '+' : delta < 0 ? '' : '';
    // Show with one decimal, clamp extreme values for readability
    const value = Math.abs(delta) > 9999 ? 9999 : delta;
    return `${sign}${value.toFixed(1)}%`;
  }

  // Compute grid column class based on number of visible modules
  getGridColsClass(): string {
    const count = this.getFilteredActions().length;
    if (count === 2) return 'grid-cols-2';
    if (count === 3) return 'grid-cols-3';
    if (count === 4) return 'grid-cols-3'; // 4–6 => 3 cols
    if (count <= 6) return 'grid-cols-3';
    return 'grid-cols-4';
  }
} 