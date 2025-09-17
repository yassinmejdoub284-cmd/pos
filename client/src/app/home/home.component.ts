import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../core/services/auth.service';
import { SalesService } from '../core/services/sales.service';
import { ExpenseService } from '../core/services/expense.service';
import { ApprovalsService } from '../core/services/approvals.service';
import { SessionsService } from '../core/services/sessions.service';

interface DashboardStats {
  todaySales: number;
  todayTransactions: number;
  pendingApprovals: number;
  activeSession: boolean;
}

interface QuickAction {
  id: string;
  title: string;
  description: string;
  route: string;
  icon: string;
  color: string;
  gradient: string;
  roles: string[];
}

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  standalone: false,
})
export class HomeComponent implements OnInit {
  currentUser: any = null;
  dashboardStats: DashboardStats = {
    todaySales: 0,
    todayTransactions: 0,
    pendingApprovals: 0,
    activeSession: false
  };
  
  loading = true;
  currentTime = new Date();
  greeting = '';
  showExpenseActionDialog = false;
  showClientActionDialog = false;
  showApprovalsActionDialog = false;
  showSupplierActionDialog = false;
  showBillingCenterActionDialog = false;
  // Pending breakdown
  private pendingGiftCount = 0;
  private pendingExpenseCount = 0;
  private pendingClotureCount = 0;

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
      id: 'historique',
      title: 'Historique',
      description: 'Transactions',
      route: '/historique',
      icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
      color: 'from-amber-500 to-orange-600',
      gradient: 'from-amber-50 to-orange-100',
      roles: ['ADMIN', 'MANAGER', 'CASHIER']
    },
    {
      id: 'cloture',
      title: 'Clôture',
      description: 'Fin de journée',
      route: '/cloture',
      icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
      color: 'from-rose-500 to-pink-600',
      gradient: 'from-rose-50 to-pink-100',
      roles: ['ADMIN', 'MANAGER', 'CASHIER']
    },
    {
      id: 'stock',
      title: 'Stock',
      description: 'Inventaire',
      route: '/stock',
      icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
      color: 'from-orange-500 to-amber-600',
      gradient: 'from-orange-50 to-amber-100',
      roles: ['ADMIN', 'MANAGER', 'STOCK_MANAGER']
    },
    {
      id: 'parametres',
      title: 'Paramètres',
      description: 'Configuration',
      route: '/parametres',
      icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
      color: 'from-amber-600 to-orange-700',
      gradient: 'from-amber-50 to-orange-100',
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
      id: 'invoices',
      title: 'Factures',
      description: 'Gestion factures',
      route: '/invoices',
      icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
      color: 'from-emerald-500 to-teal-600',
      gradient: 'from-emerald-50 to-teal-100',
      roles: ['ADMIN', 'MANAGER', 'CASHIER']
    },
    {
      id: 'approvals',
      title: 'Validations',
      description: 'Centre d\'approbation',
      route: '/approvals',
      icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
      color: 'from-purple-500 to-violet-600',
      gradient: 'from-purple-50 to-violet-100',
      roles: ['ADMIN', 'MANAGER']
    },
    {
      id: 'charges',
      title: 'Dépenses',
      description: 'Gestion des charges',
      route: '/charges',
      icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
      color: 'from-red-500 to-rose-600',
      gradient: 'from-red-50 to-rose-100',
      roles: ['ADMIN', 'MANAGER']
    },
    {
      id: 'clients',
      title: 'Clients',
      description: 'Gestion clients',
      route: '/clients',
      icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
      color: 'from-teal-500 to-cyan-600',
      gradient: 'from-teal-50 to-cyan-100',
      roles: ['ADMIN', 'MANAGER', 'CASHIER']
    },
    {
      id: 'suppliers',
      title: 'Fournisseurs',
      description: 'Gestion fournisseurs',
      route: '/suppliers',
      icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
      color: 'from-indigo-500 to-purple-600',
      gradient: 'from-indigo-50 to-purple-100',
      roles: ['ADMIN', 'MANAGER']
    },
    {
      id: 'billing-center',
      title: 'Centre de facturation',
      description: 'Gestion des factures',
      route: '/billing-center',
      icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
      color: 'from-cyan-500 to-blue-600',
      gradient: 'from-cyan-50 to-blue-100',
      roles: ['ADMIN', 'MANAGER', 'CASHIER']
    }
  ];

  constructor(
    private authService: AuthService,
    private salesService: SalesService,
    private sessionsService: SessionsService,
    private expenseService: ExpenseService,
    private approvalsService: ApprovalsService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.currentUser = this.authService.currentUser();
    this.updateGreeting();
    this.loadDashboardStats();
    
    // Update time every minute
    setInterval(() => {
      this.currentTime = new Date();
      this.updateGreeting();
    }, 60000);
  }

  updateGreeting(): void {
    const hour = this.currentTime.getHours();
    if (hour < 12) {
      this.greeting = 'Bonjour';
    } else if (hour < 18) {
      this.greeting = 'Bon après-midi';
    } else {
      this.greeting = 'Bonsoir';
    }
  }

  loadDashboardStats(): void {
    this.loading = true;
    
    // Load today's sales
    this.salesService.getSales().subscribe({
      next: (sales) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const todaySales = sales.filter(sale => {
          const saleDate = new Date(sale.createdAt);
          saleDate.setHours(0, 0, 0, 0);
          return saleDate.getTime() === today.getTime() && sale.status === 'COMPLETED';
        });

        this.dashboardStats.todaySales = todaySales.reduce((sum, sale) => sum + Number(sale.finalTotal), 0);
        this.dashboardStats.todayTransactions = todaySales.length;
        
        // Count pending gift approvals (gifts awaiting admin)
        this.pendingGiftCount = sales.filter(sale => sale.status === 'PENDING_ADMIN').length;
        this.updatePendingApprovals();
        
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading sales:', error);
        this.loading = false;
      }
    });

    // Count pending expenses (not approved)
    this.expenseService.getExpenses().subscribe({
      next: (expenses) => {
        this.pendingExpenseCount = (expenses || []).filter((e: any) => !e.isApproved).length;
        this.updatePendingApprovals();
      },
      error: (error) => {
        console.error('Error loading expenses:', error);
      }
    });

    // Count pending clôture change requests
    this.approvalsService.getVarianceChangeRequests('PENDING').subscribe({
      next: (requests) => {
        this.pendingClotureCount = (requests || []).length;
        this.updatePendingApprovals();
      },
      error: (error) => {
        console.error('Error loading variance requests:', error);
      }
    });

    // Check for active session
    this.sessionsService.getActiveSession().subscribe({
      next: (session) => {
        this.dashboardStats.activeSession = !!session;
      },
      error: (error) => {
        console.error('Error loading session:', error);
      }
    });
  }

  private updatePendingApprovals(): void {
    this.dashboardStats.pendingApprovals = this.pendingGiftCount + this.pendingExpenseCount + this.pendingClotureCount;
  }

  getFilteredActions(): QuickAction[] {
    if (!this.currentUser) return [];
    
    return this.quickActions.filter(action => 
      action.roles.includes(this.currentUser.role)
    );
  }

  navigateTo(route: string): void {
    if (route === '/charges') {
      this.showExpenseActionDialog = true;
    } else if (route === '/clients') {
      this.showClientActionDialog = true;
    } else if (route === '/approvals') {
      this.showApprovalsActionDialog = true;
    } else if (route === '/suppliers') {
      this.showSupplierActionDialog = true;
    } else if (route === '/billing-center') {
      this.showBillingCenterActionDialog = true;
    } else {
      this.router.navigate([route]);
    }
  }

  onExpenseActionSelected(actionId: string): void {
    this.showExpenseActionDialog = false;
    
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
    this.showExpenseActionDialog = false;
  }

  onClientActionSelected(actionId: string): void {
    this.showClientActionDialog = false;
    
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
    this.showClientActionDialog = false;
  }

  onApprovalsActionSelected(actionId: string): void {
    this.showApprovalsActionDialog = false;
    if (actionId === 'pending') {
      this.router.navigate(['/approvals'], { queryParams: { tab: 'EXPENSES' } });
    } else {
      this.router.navigate(['/approvals/history']);
    }
  }

  onApprovalsDialogClosed(): void {
    this.showApprovalsActionDialog = false;
  }

  onSupplierActionSelected(actionId: string): void {
    this.showSupplierActionDialog = false;
    
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
    this.showSupplierActionDialog = false;
  }

  onBillingCenterActionSelected(actionId: string): void {
    this.showBillingCenterActionDialog = false;
    
    switch (actionId) {
      case 'add-invoice':
        this.router.navigate(['/invoices'], { queryParams: { action: 'add' } });
        break;
      case 'manage-invoices':
        this.router.navigate(['/invoices']);
        break;
    }
  }

  onBillingCenterDialogClosed(): void {
    this.showBillingCenterActionDialog = false;
  }


  getRoleDisplayName(): string {
    if (!this.currentUser) return '';
    
    switch (this.currentUser.role) {
      case 'ADMIN': return 'Administrateur';
      case 'MANAGER': return 'Responsable Magasin';
      case 'CASHIER': return 'Caissier';
      case 'STOCK_MANAGER': return 'Gestionnaire Stock';
      default: return this.currentUser.role;
    }
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/auth/login']);
  }
} 