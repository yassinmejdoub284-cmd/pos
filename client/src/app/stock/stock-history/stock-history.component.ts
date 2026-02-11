import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, takeUntil, combineLatest, forkJoin } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { DepotsService } from '../../core/services/depots.service';
import { StockDocumentsService } from '../../core/services/stock-documents.service';
import { StockAnalyticsService, StockKPIData, StockChartData, TopProduct, TopClient, StockDocument, ProductAnalytics } from '../../core/services/stock-analytics.service';
import { PrintService } from '../../core/services/print.service';
import { SettingsService } from '../../core/services/settings.service';
import { Depot } from '../../core/models/depot.model';

interface StockHistoryFilters {
  dateFrom: string;
  dateTo: string;
  productId?: string;
  familyId?: string;
  clientId?: string;
  documentType?: string;
  userId?: string;
  status?: string;
  depotSourceId?: string;
  depotDestinationId?: string;
}

interface KPICard {
  title: string;
  value: string | number;
  change: number;
  changeType: 'increase' | 'decrease' | 'neutral';
  icon: string;
  color: string;
}

@Component({
  selector: 'app-stock-history',
  templateUrl: './stock-history.component.html',
  styleUrls: ['./stock-history.component.css'],
  standalone: false
})
export class StockHistoryComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  // Depot and user management
  selectedDepot: Depot | null = null;
  availableDepots: Depot[] = [];
  isAdmin = false;
  showDepotSelector = false;

  // UI state
  activeTab: 'dashboard' | 'archives' | 'analytics' = 'dashboard';
  activeArchiveTab: 'entry' | 'sortie' | 'transfert' | 'livraison' = 'entry';
  loading = false;
  error = '';

  // Filters
  filters: StockHistoryFilters = {
    dateFrom: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    dateTo: new Date().toISOString().split('T')[0]
  };

  // Dashboard data
  kpiCards: KPICard[] = [];
  salesChartData: StockChartData[] = [];
  movementsChartData: StockChartData[] = [];
  topProductsData: TopProduct[] = [];
  topClientsData: TopClient[] = [];

  // Archive data
  archiveData: StockDocument[] = [];
  selectedDocument: StockDocument | null = null;
  showDocumentDetails = false;

  // Analytics data
  productAnalytics: ProductAnalytics[] = [];
  selectedProducts: ProductAnalytics[] = [];
  maxSelectedProducts = 3;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService,
    private depotsService: DepotsService,
    private stockDocsService: StockDocumentsService,
    private stockAnalyticsService: StockAnalyticsService,
    private printService: PrintService,
    private settingsService: SettingsService
  ) { }

  ngOnInit(): void {
    this.initializeComponent();
    this.debugDesktopDetection();
  }

  private debugDesktopDetection(): void {




  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializeComponent(): void {
    const currentUser = this.authService.currentUser();
    this.isAdmin = currentUser?.role === 'ADMIN';

    // Get depotId from route parameters
    this.route.params
      .pipe(takeUntil(this.destroy$))
      .subscribe(params => {
        const depotId = params['depotId'];
        if (depotId) {
          this.loadDepotById(depotId);
        } else {
          this.loadAvailableDepots();
        }
      });
  }

  private loadDepotById(depotId: string): void {
    this.loading = true;
    this.error = '';

    this.depotsService.list()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (depots) => {
          this.availableDepots = depots.filter(d => d.isActive && d.type !== 'SHOP');
          const depot = this.availableDepots.find(d => d.id === parseInt(depotId, 10));

          if (depot) {
            this.selectedDepot = depot;
            this.loadDashboardData();
          } else {
            this.error = 'Dépôt non trouvé ou non accessible';
            this.loading = false;
          }
        },
        error: (error) => {
          console.error('Error loading depots:', error);
          this.error = 'Erreur lors du chargement des dépôts';
          this.loading = false;
        }
      });
  }

  private loadAvailableDepots(): void {
    const currentUser = this.authService.currentUser();
    this.loading = true;
    this.error = '';

    // Load available depots
    this.depotsService.list()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (depots) => {
          this.availableDepots = depots.filter(d => d.isActive && d.type !== 'SHOP');

          if (this.isAdmin) {
            // Show depot selector for admin users
            this.showDepotSelector = true;
            this.loading = false;
          } else {
            // Auto-select user's assigned depot
            const userDepot = this.availableDepots.find(d => d.id === currentUser?.depotId);
            if (userDepot) {
              this.selectedDepot = userDepot;
              this.loadDashboardData();
            } else {
              this.error = 'Aucun dépôt assigné trouvé pour cet utilisateur';
              this.loading = false;
            }
          }
        },
        error: (error) => {
          console.error('Error loading depots:', error);
          this.error = 'Erreur lors du chargement des dépôts';
          this.loading = false;
        }
      });
  }

  selectDepot(depot: Depot | string): void {
    if (typeof depot === 'string') {
      const foundDepot = this.availableDepots.find(d => d.id === parseInt(depot, 10));
      if (foundDepot) {
        this.selectedDepot = foundDepot;
        this.showDepotSelector = false;
        this.loadDashboardData();
      }
    } else {
      this.selectedDepot = depot;
      this.showDepotSelector = false;
      this.loadDashboardData();
    }
  }

  private loadDashboardData(): void {
    if (!this.selectedDepot) return;

    this.loading = true;
    this.error = '';

    // Simulate async loading for better UX
    setTimeout(() => {
      // Load KPI data
      this.loadKPIData();

      // Load chart data
      this.loadChartData();

      // Load archive data for current tab
      this.loadArchiveData();

      // Reset loading state
      this.loading = false;
    }, 500);
  }

  private loadKPIData(): void {
    if (!this.selectedDepot) return;

    this.stockAnalyticsService.getKPIData(
      this.selectedDepot.id,
      this.filters.dateFrom,
      this.filters.dateTo
    ).pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (kpiData: StockKPIData) => {
          this.kpiCards = [
            {
              title: 'Ventes (aujourd\'hui)',
              value: this.formatCurrency(kpiData.todaySales || 0),
              change: kpiData.todaySalesChange || 0,
              changeType: (kpiData.todaySalesChange || 0) >= 0 ? 'increase' : 'decrease',
              icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1',
              color: 'from-emerald-500 to-green-600'
            },
            {
              title: 'Ventes (7 jours)',
              value: this.formatCurrency(kpiData.weekSales || 0),
              change: kpiData.weekSalesChange || 0,
              changeType: (kpiData.weekSalesChange || 0) >= 0 ? 'increase' : 'decrease',
              icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
              color: 'from-blue-500 to-cyan-600'
            },
            {
              title: 'Quantités sorties',
              value: (kpiData.totalExits || 0).toString(),
              change: kpiData.exitsChange || 0,
              changeType: (kpiData.exitsChange || 0) >= 0 ? 'increase' : 'decrease',
              icon: 'M20 12H4m16 0l-4-4m4 4l-4 4',
              color: 'from-red-500 to-pink-600'
            },
            {
              title: 'Quantités entrées',
              value: (kpiData.totalEntries || 0).toString(),
              change: kpiData.entriesChange || 0,
              changeType: (kpiData.entriesChange || 0) >= 0 ? 'increase' : 'decrease',
              icon: 'M12 4v16m8-8H4',
              color: 'from-amber-500 to-yellow-600'
            },
            {
              title: 'Taux de rotation',
              value: ((kpiData.turnoverRate || 0).toFixed(1)) + 'x',
              change: kpiData.turnoverChange || 0,
              changeType: (kpiData.turnoverChange || 0) >= 0 ? 'increase' : 'decrease',
              icon: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15',
              color: 'from-purple-500 to-violet-600'
            }
          ];
        },
        error: (error) => {
          console.error('Error loading KPI data:', error);
          this.error = 'Erreur lors du chargement des indicateurs';
        }
      });
  }

  private loadChartData(): void {
    if (!this.selectedDepot) return;

    // Load sales chart data
    this.stockAnalyticsService.getSalesChartData(
      this.selectedDepot.id,
      this.filters.dateFrom,
      this.filters.dateTo
    ).pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data: StockChartData[]) => {
          this.salesChartData = data;
        },
        error: (error) => {
          console.error('Error loading sales chart data:', error);
        }
      });

    // Load stock movements data
    this.stockAnalyticsService.getStockMovements(
      this.selectedDepot.id,
      this.filters.dateFrom,
      this.filters.dateTo
    ).pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data: StockChartData[]) => {
          this.movementsChartData = data;
        },
        error: (error) => {
          console.error('Error loading movements chart data:', error);
        }
      });

    // Load top products data
    this.stockAnalyticsService.getTopProducts(
      this.selectedDepot.id,
      this.filters.dateFrom,
      this.filters.dateTo,
      10
    ).pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data: TopProduct[]) => {
          this.topProductsData = data;
        },
        error: (error) => {
          console.error('Error loading top products data:', error);
        }
      });

    // Load top clients data
    this.stockAnalyticsService.getTopClients(
      this.selectedDepot.id,
      this.filters.dateFrom,
      this.filters.dateTo,
      10
    ).pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data: TopClient[]) => {
          this.topClientsData = data;
        },
        error: (error) => {
          console.error('Error loading top clients data:', error);
        }
      });
  }

  private loadArchiveData(): void {
    if (!this.selectedDepot) return;

    this.stockAnalyticsService.getStockDocuments(
      this.selectedDepot.id,
      this.activeArchiveTab,
      undefined, // status
      this.filters.dateFrom,
      this.filters.dateTo,
      1, // page
      50 // limit
    ).pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.archiveData = response.documents;
        },
        error: (error) => {
          console.error('Error loading archive data:', error);
          this.error = 'Erreur lors du chargement des archives';
        }
      });
  }

  // Tab management
  setActiveTab(tab: 'dashboard' | 'archives' | 'analytics'): void {
    this.activeTab = tab;
    if (tab === 'archives') {
      this.loadArchiveData();
    } else if (tab === 'analytics') {
      this.loadProductAnalytics();
    }
  }

  setActiveArchiveTab(tab: 'entry' | 'sortie' | 'transfert' | 'livraison'): void {
    this.activeArchiveTab = tab;
    this.loadArchiveData();
  }

  // Filter management
  updateFilters(newFilters: Partial<StockHistoryFilters>): void {
    this.filters = { ...this.filters, ...newFilters };
    this.loadDashboardData();
  }

  // Document management
  viewDocument(document: StockDocument): void {
    this.selectedDocument = document;
    this.showDocumentDetails = true;
  }

  closeDocumentDetails(): void {
    this.selectedDocument = null;
    this.showDocumentDetails = false;
  }

  printDocument(document: StockDocument): void {
    // Implement print functionality

  }

  exportDocument(document: StockDocument, format: 'pdf' | 'csv'): void {
    // Implement export functionality

  }

  // Analytics management
  private loadProductAnalytics(): void {
    if (!this.selectedDepot) return;

    this.stockAnalyticsService.getProductAnalytics(
      this.selectedDepot.id,
      this.filters.dateFrom,
      this.filters.dateTo
    ).pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data: ProductAnalytics[]) => {
          this.productAnalytics = data;
        },
        error: (error) => {
          console.error('Error loading product analytics:', error);
          this.error = 'Erreur lors du chargement des analyses de produits';
        }
      });
  }

  selectProductForComparison(product: ProductAnalytics): void {
    if (this.selectedProducts.length < this.maxSelectedProducts &&
      !this.selectedProducts.find(p => p.id === product.id)) {
      this.selectedProducts.push(product);
    }
  }

  removeProductFromComparison(product: ProductAnalytics): void {
    this.selectedProducts = this.selectedProducts.filter(p => p.id !== product.id);
  }

  // Utility methods
  getDocumentTypeLabel(type: string): string {
    switch (type) {
      case 'entry': return 'Bon d\'entrée';
      case 'sortie': return 'Bon de sortie';
      case 'transfert': return 'Bon de transfert';
      case 'livraison': return 'Bon de livraison';
      default: return type;
    }
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'completed': return 'Terminé';
      case 'pending': return 'En attente';
      case 'cancelled': return 'Annulé';
      default: return status;
    }
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-100';
      case 'pending': return 'text-yellow-600 bg-yellow-100';
      case 'cancelled': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('fr-TN', {
      style: 'currency',
      currency: 'TND'
    }).format(value);
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleDateString('fr-FR');
  }

  getAbsoluteValue(value: number): number {
    return Math.abs(value);
  }

  getMaxValue(value: number, min: number = 5): number {
    return Math.max(value, min);
  }

  goBack(): void {
    this.router.navigate(['/stock']);
  }

  // Debug method to force desktop mode (for testing)
  forceDesktopMode(): void {

    this.printService.setDesktopMode(true);

    alert('Desktop mode forced to true');
  }

  // Debug method to force web mode (for testing)
  forceWebMode(): void {

    this.printService.setDesktopMode(false);

    alert('Desktop mode forced to false');
  }

  // Test print method
  testPrint(): void {


    // Check settings before printing
    this.settingsService.getSettings().subscribe({
      next: (settings: any) => {





        const testText = 'Test print from Stock History Module\nDesktop mode: ' + this.printService.getDesktopMode() + '\nSettings isDesktopVersion: ' + settings?.isDesktopVersion;

        this.printService.printPlainText(testText);
        alert('Test print sent!\nSettings isDesktopVersion: ' + settings?.isDesktopVersion);
      },
      error: (error: any) => {
        console.error('Error getting settings for test print:', error);
        alert('Error getting settings: ' + error);
      }
    });
  }

  // Check Tauri status method
  async checkTauriStatus(): Promise<void> {

    try {
      // Check current settings
      this.settingsService.getSettings().subscribe({
        next: (settings: any) => {




        },
        error: (error: any) => {
          console.error('Error getting settings:', error);
        }
      });

      const status = await this.printService.checkTauriStatus();


      // Get settings for the alert
      this.settingsService.getSettings().subscribe({
        next: (settings: any) => {
          const fullStatus = `Tauri Status:\n${status}\n\nSettings:\nisDesktopVersion: ${settings?.isDesktopVersion}`;
          alert(fullStatus);
        },
        error: () => {
          alert('Tauri Status:\n' + status + '\n\nSettings: Error loading');
        }
      });
    } catch (error) {
      console.error('Error checking Tauri status:', error);
      alert('Error checking Tauri status: ' + error);
    }
  }

  // Simple test method
  testSimpleClick(): void {

    alert('Button click works!');
  }
}
