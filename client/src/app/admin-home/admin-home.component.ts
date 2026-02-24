import { Component, OnInit, ChangeDetectionStrategy, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { forkJoin, map } from 'rxjs';
import { ChartConfiguration, ChartData, ChartType } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';

import { AuthService } from '../core/services/auth.service';
import { SalesService } from '../core/services/sales.service';
import { DepotsService } from '../core/services/depots.service';
import { SuppliersService } from '../core/services/suppliers.service';
import { ExpenseService } from '../core/services/expense.service';
import { ProduitsDeCaisseService } from '../core/services/produits-de-caisse.service';
import { ClientsService } from '../core/services/clients.service';

import {
  DashboardStats,
  BoutiqueRevenue,
  DepotRevenue,
  SupplierCredit,
  ClientCredit,
  BoutiqueExpense
} from '../core/models/dashboard.model';

@Component({
  selector: 'app-admin-home',
  templateUrl: './admin-home.component.html',
  styleUrls: ['./admin-home.component.css'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminHomeComponent implements OnInit {
  loading = signal(true);
  error = signal<string | null>(null);

  // Time filters
  timeFilter = signal<'today' | 'month' | 'year'>('today');

  // Dashboard Data
  stats = signal<DashboardStats>({
    totalRevenue: 0,
    totalExpenses: 0,
    totalNet: 0,
    totalSupplierCredit: 0,
    totalClientCredit: 0,
    revenueByBoutique: [],
    revenueByDepot: [],
    supplierCreditByDepot: [],
    clientCreditByDepot: [],
    expensesByBoutique: []
  });

  // Chart Data Signals
  revenueByBoutiqueChartData = signal<ChartConfiguration['data']>({ datasets: [], labels: [] });
  revenueByDepotChartData = signal<ChartConfiguration['data']>({ datasets: [], labels: [] });
  expensesByBoutiqueChartData = signal<ChartConfiguration['data']>({ datasets: [], labels: [] });
  supplierCreditChartData = signal<ChartConfiguration['data']>({ datasets: [], labels: [] });
  clientCreditChartData = signal<ChartConfiguration['data']>({ datasets: [], labels: [] });

  // Collapsible states
  showSupplierDetails = signal(false);
  showClientDetails = signal(false);
  expandedRevenueDepots = signal<Set<number>>(new Set());
  expandedExpenseDepots = signal<Set<number>>(new Set());

  // Detailed lists
  suppliersList = signal<Array<{ name: string; debt: number; depotName: string }>>([]);
  clientsList = signal<Array<{ name: string; debt: number; depotName: string }>>([]);
  
  // Sales details by depot
  salesByDepot = signal<Map<number, Array<{ date: string; ticketNumber: string; amount: number; items: number }>>>(new Map());
  expensesByDepot = signal<Map<number, Array<{ date: string; category: string; amount: number; description: string }>>>(new Map());

  // Chart Options
  barChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    indexAxis: 'y', // Horizontal bars
    scales: {
      x: {},
      y: { min: 0 }
    },
    plugins: {
      legend: { display: false },
    }
  };

  pieChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    plugins: {
      legend: { position: 'top' },
    }
  };

  currentUser = signal<any>(null);

  constructor(
    private authService: AuthService,
    private salesService: SalesService,
    private depotsService: DepotsService,
    private suppliersService: SuppliersService,
    private clientsService: ClientsService,
    private expenseService: ExpenseService,
    private produitsDeCaisseService: ProduitsDeCaisseService,
    private router: Router
  ) {
    this.currentUser = this.authService.currentUser;
  }

  ngOnInit(): void {
    if (!this.authService.isAdmin() && !this.authService.isSuperAdmin()) {
      this.router.navigate(['/unauthorized']);
      return;
    }
    
    this.loadDashboardData();
  }

  ngOnDestroy(): void {
    // Component cleanup if needed
  }

  setTimeFilter(filter: 'today' | 'month' | 'year'): void {
    this.timeFilter.set(filter);
    this.loadDashboardData();
  }

  loadDashboardData(): void {
    this.loading.set(true);
    this.error.set(null);

    // Temporarily clear visiting depot for this request only
    const savedVisitingDepotId = sessionStorage.getItem('visitingDepotId');
    sessionStorage.removeItem('visitingDepotId');

    const filter = this.timeFilter();
    const now = new Date();
    let startDate = new Date();

    // Set start date based on filter
    if (filter === 'today') {
      startDate.setHours(0, 0, 0, 0);
    } else if (filter === 'month') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (filter === 'year') {
      startDate = new Date(now.getFullYear(), 0, 1);
    }

    const startDateStr = startDate.toISOString();

    forkJoin({
      sales: this.salesService.getSales({ startDate: startDateStr, status: 'COMPLETED', limit: 10000 }),
      depots: this.depotsService.list(),
      suppliers: this.suppliersService.list(),
      // We still fetch expenses for reference or drill-down if needed, but main stat comes from cashFlow
      expenses: this.expenseService.getExpenses({ startDate: startDateStr, limit: 1000 }),
      // Fetch verified cash outflows (Sortie de Caisse)
      cashFlow: this.expenseService.getCashFlowStats({ startDate: startDateStr }),
      clients: this.clientsService.getClients(1, 1000, '', '', true) // Fetch active clients to calculate current debt
    }).subscribe({
      next: (data: any) => {
        const clientsList = data.clients?.clients || data.clients || [];
        this.processData(data.sales, data.depots, data.suppliers, data.expenses, data.cashFlow, clientsList);
        
        // Restore visiting depot after data is loaded
        if (savedVisitingDepotId) {
          sessionStorage.setItem('visitingDepotId', savedVisitingDepotId);
        }
      },
      error: (err) => {
        console.error('Dashboard load error', err);
        this.error.set('Erreur lors du chargement des données. Veuillez réessayer.');
        this.loading.set(false);
        
        // Restore visiting depot even on error
        if (savedVisitingDepotId) {
          sessionStorage.setItem('visitingDepotId', savedVisitingDepotId);
        }
      }
    });
  }

  async processData(sales: any[], depots: any[], suppliers: any[], expenses: any[], cashFlow: any[] = [], clients: any[] = []) {
    try {
      // 1. Map Depots
      const depotMap = new Map(depots.map((d: any) => [d.id, d]));

      const isWarehouseLike = (d: any) => {
        const type = (d.type || '').toUpperCase();
        const name = (d.name || '').toLowerCase();
        return type === 'WAREHOUSE' || type === 'MAIN' || type === 'DEPOT' || type === 'ATELIER' ||
          name.includes('dépôt') || name.includes('depot') || name.includes('atelier');
      };

      const shopDepots = depots.filter((d: any) => !isWarehouseLike(d));
      const warehouseDepots = depots.filter((d: any) => isWarehouseLike(d));

      // --- Section 1: Revenue by Boutique ---
      const revenueByBoutique: BoutiqueRevenue[] = [];

      // Initialize with 0
      shopDepots.forEach((d: any) => {
        revenueByBoutique.push({ depotId: d.id, depotName: d.name, revenue: 0 });
      });

      // Fill from sales - gather all sales regardless of depot type
      let totalRevenue = 0;
      const salesDetailsByDepot = new Map<number, Array<{ date: string; ticketNumber: string; amount: number; items: number }>>();
      
      sales.forEach(sale => {
        const depot = depotMap.get(sale.depotId);
        if (depot) {
          let entry = revenueByBoutique.find(r => r.depotId === sale.depotId);
          if (!entry) {
            // Add depot if not already in list
            entry = { depotId: sale.depotId, depotName: depot.name, revenue: 0 };
            revenueByBoutique.push(entry);
          }
          entry.revenue += parseFloat(sale.finalTotal || 0);
          totalRevenue += parseFloat(sale.finalTotal || 0);
          
          // Store sale details
          if (!salesDetailsByDepot.has(sale.depotId)) {
            salesDetailsByDepot.set(sale.depotId, []);
          }
          salesDetailsByDepot.get(sale.depotId)!.push({
            date: new Date(sale.createdAt).toLocaleDateString('fr-FR'),
            ticketNumber: sale.dailyTicketNumber || sale.id.toString(),
            amount: parseFloat(sale.finalTotal || 0),
            items: sale.items?.length || 0
          });
        }
      });
      
      this.salesByDepot.set(salesDetailsByDepot);
      
      // Sort by revenue desc
      revenueByBoutique.sort((a, b) => b.revenue - a.revenue);


      // --- Section 4: Expenses by Boutique (Using Cash Flow / Sortie Caisse) ---
      const expensesByBoutique: BoutiqueExpense[] = [];
      // Initialize all depots for expenses
      depots.forEach((d: any) => {
        expensesByBoutique.push({ depotId: d.id, depotName: d.name, totalExpense: 0 });
      });

      let totalExpenses = 0;
      const expensesDetailsByDepot = new Map<number, Array<{ date: string; category: string; amount: number; description: string }>>();

      // Use CashFlow data (Sortie Caisse) as the source of truth for expenses
      if (cashFlow && cashFlow.length > 0) {
        cashFlow.forEach((cf: any) => {
          if (cf.depotId) {
            const entry = expensesByBoutique.find(e => e.depotId === cf.depotId);
            if (entry) {
              entry.totalExpense += parseFloat(cf.totalOutflow || 0);
            }
            totalExpenses += parseFloat(cf.totalOutflow || 0);
          }
        });
      }
      
      // Store expense details from the expenses array
      expenses.forEach((exp: any) => {
        if (exp.depotId) {
          if (!expensesDetailsByDepot.has(exp.depotId)) {
            expensesDetailsByDepot.set(exp.depotId, []);
          }
          expensesDetailsByDepot.get(exp.depotId)!.push({
            date: new Date(exp.date || exp.createdAt).toLocaleDateString('fr-FR'),
            category: exp.category?.name || 'Non catégorisé',
            amount: parseFloat(exp.amount || 0),
            description: exp.description || exp.notes || ''
          });
        }
      });
      
      this.expensesByDepot.set(expensesDetailsByDepot);

      expensesByBoutique.sort((a, b) => b.totalExpense - a.totalExpense);


      // --- Section 3: Supplier Credit ---
      const supplierCreditByDepot: SupplierCredit[] = [];
      // Helper to find or create entry
      const getCreditEntry = (depotId: number | 'unassigned', name: string) => {
        let entry = supplierCreditByDepot.find(s => s.depotId === depotId);
        if (!entry) {
          entry = { depotId, depotName: name, totalCredit: 0 };
          supplierCreditByDepot.push(entry);
        }
        return entry;
      };

      let totalSupplierCredit = 0;
      const suppliersWithDebt: Array<{ name: string; debt: number; depotName: string }> = [];

      suppliers.forEach((sup: any) => {
        const debt = parseFloat(sup.currentDebt || 0);
        if (debt > 0) {
          totalSupplierCredit += debt;
          const depot = sup.depotId ? depotMap.get(sup.depotId) : null;
          const depotName = depot ? depot.name : 'Non assigné';
          
          suppliersWithDebt.push({
            name: sup.name,
            debt: debt,
            depotName: depotName
          });

          if (sup.depotId) {
            getCreditEntry(sup.depotId, depotName).totalCredit += debt;
          } else {
            getCreditEntry('unassigned', 'Non assigné').totalCredit += debt;
          }
        }
      });
      
      // Sort suppliers by debt descending
      suppliersWithDebt.sort((a, b) => b.debt - a.debt);
      this.suppliersList.set(suppliersWithDebt);
      
      supplierCreditByDepot.sort((a, b) => b.totalCredit - a.totalCredit);

      // --- Section 5: Client Credit ---
      const clientCreditByDepot: ClientCredit[] = [];
      const getClientCreditEntry = (depotId: number | 'unassigned', name: string) => {
        let entry = clientCreditByDepot.find(s => s.depotId === depotId);
        if (!entry) {
          entry = { depotId, depotName: name, totalCredit: 0 };
          clientCreditByDepot.push(entry);
        }
        return entry;
      };

      let totalClientCredit = 0;
      const clientsWithDebt: Array<{ name: string; debt: number; depotName: string }> = [];

      clients.forEach((cli: any) => {
        const debt = parseFloat(cli.currentDebt || 0);
        if (debt > 0) {
          totalClientCredit += debt;
          const depot = cli.depotId ? depotMap.get(cli.depotId) : null;
          const depotName = depot ? depot.name : 'Non assigné';
          
          clientsWithDebt.push({
            name: `${cli.firstName || ''} ${cli.lastName || ''}`.trim() || cli.code || 'Client',
            debt: debt,
            depotName: depotName
          });

          if (cli.depotId) {
            getClientCreditEntry(cli.depotId, depotName).totalCredit += debt;
          } else {
            getClientCreditEntry('unassigned', 'Non assigné').totalCredit += debt;
          }
        }
      });
      
      // Sort clients by debt descending
      clientsWithDebt.sort((a, b) => b.debt - a.debt);
      this.clientsList.set(clientsWithDebt);
      
      clientCreditByDepot.sort((a, b) => b.totalCredit - a.totalCredit);


      // --- Section 2: Revenue by Depot (Source/Atelier) ---

      const revenueByDepot: DepotRevenue[] = [];
      const atelierMap = new Map<number, number>(); // ProductID -> DepotID

      // Fetch products - we try to fetch from a main depot to get the catalog
      // We prioritize WAREHOUSE or MAIN type depots to fetch the catalog
      const refDepotId = (warehouseDepots[0]?.id || depots[0]?.id);

      if (refDepotId) {
        try {
          const products = await new Promise<any[]>((resolve) => {
            // Use getActiveProduitsDeCaisse to fetch products
            this.produitsDeCaisseService.getActiveProduitsDeCaisse(refDepotId).subscribe({
              next: (res) => resolve(res),
              error: () => resolve([])
            });
          });

          products.forEach(p => {
            // Check assignments. 
            if (p.assignedDepots && p.assignedDepots.length > 0) {
              // Prefer Warehouse/Main as source
              const source = p.assignedDepots.find((d: any) => d.type === 'WAREHOUSE' || d.type === 'MAIN');
              if (source) {
                atelierMap.set(p.id, source.id);
              } else {
                // Fallback: assigned only to shops? use the first one
                atelierMap.set(p.id, p.assignedDepots[0].id);
              }
            }
          });
        } catch (e) {
          console.warn('Could not fetch products for atelier mapping', e);
        }
      }

      // Initialize Depot Revenue container for Warehouses/Main
      warehouseDepots.forEach((d: any) => {
        revenueByDepot.push({ depotId: d.id, depotName: d.name, revenue: 0 });
      });

      // Iterate Sales Items
      sales.forEach(sale => {
        if (sale.items) {
          sale.items.forEach((item: any) => {
            const sourceDepotId = atelierMap.get(item.productId);
            if (sourceDepotId) {
              let entry = revenueByDepot.find(r => r.depotId === sourceDepotId);
              if (!entry) {
                // Try finding and adding if not initialized (e.g. if source is a SHOP)
                const depot = depotMap.get(sourceDepotId);
                if (depot) {
                  entry = { depotId: sourceDepotId, depotName: depot.name, revenue: 0 };
                  revenueByDepot.push(entry);
                }
              }

              if (entry) {
                entry.revenue += parseFloat(item.total || 0);
              }
            }
          });
        }
      });
      revenueByDepot.sort((a, b) => b.revenue - a.revenue);


      // Final Updates
      this.stats.set({
        totalRevenue,
        totalExpenses,
        totalNet: totalRevenue - totalExpenses,
        totalSupplierCredit,
        totalClientCredit,
        revenueByBoutique,
        revenueByDepot,
        supplierCreditByDepot,
        clientCreditByDepot,
        expensesByBoutique
      });

      this.updateCharts();
      this.loading.set(false);

    } catch (err) {
      console.error('Error processing dashboard data', err);
      this.error.set('Erreur de traitement des données');
      this.loading.set(false);
    }
  }

  updateCharts(): void {
    const stats = this.stats();

    // 1. Revenue by Boutique (Bar)
    this.revenueByBoutiqueChartData.set({
      labels: stats.revenueByBoutique.map(i => i.depotName),
      datasets: [
        { data: stats.revenueByBoutique.map(i => i.revenue), label: 'Chiffre d\'Affaire', backgroundColor: '#4ade80', borderRadius: 4 }
      ]
    });

    // 2. Revenue by Depot (Bar)
    this.revenueByDepotChartData.set({
      labels: stats.revenueByDepot.map(i => i.depotName),
      datasets: [
        { data: stats.revenueByDepot.map(i => i.revenue), label: 'Production Atelier', backgroundColor: '#3b82f6', borderRadius: 4 }
      ]
    });

    // 3. Expenses (Bar)
    this.expensesByBoutiqueChartData.set({
      labels: stats.expensesByBoutique.filter(x => x.totalExpense > 0).map(i => i.depotName),
      datasets: [
        { data: stats.expensesByBoutique.filter(x => x.totalExpense > 0).map(i => i.totalExpense), label: 'Dépenses', backgroundColor: '#f87171', borderRadius: 4 }
      ]
    });

    // 4. Supplier Credit (Pie)
    this.supplierCreditChartData.set({
      labels: stats.supplierCreditByDepot.map(i => i.depotName),
      datasets: [
        {
          data: stats.supplierCreditByDepot.map(i => i.totalCredit),
          backgroundColor: ['#fca5a5', '#fdba74', '#fcd34d', '#86efac', '#93c5fd', '#c4b5fd', '#f9a8d4'],
          hoverOffset: 4
        }
      ]
    });

    // 5. Client Credit (Pie)
    this.clientCreditChartData.set({
      labels: stats.clientCreditByDepot.map(i => i.depotName),
      datasets: [
        {
          data: stats.clientCreditByDepot.map(i => i.totalCredit),
          backgroundColor: ['#93c5fd', '#c4b5fd', '#f9a8d4', '#fca5a5', '#fdba74', '#fcd34d', '#86efac'],
          hoverOffset: 4
        }
      ]
    });
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('fr-TN', {
      style: 'currency',
      currency: 'TND',
      minimumFractionDigits: 3
    }).format(value);
  }

  goToHome(): void {
    this.router.navigate(['/home']);
  }

  goToCaisse(): void {
    this.router.navigate(['/caisse']);
  }

  toggleRevenueDepot(depotId: number): void {
    const expanded = new Set(this.expandedRevenueDepots());
    if (expanded.has(depotId)) {
      expanded.delete(depotId);
    } else {
      expanded.add(depotId);
    }
    this.expandedRevenueDepots.set(expanded);
  }

  toggleExpenseDepot(depotId: number): void {
    const expanded = new Set(this.expandedExpenseDepots());
    if (expanded.has(depotId)) {
      expanded.delete(depotId);
    } else {
      expanded.add(depotId);
    }
    this.expandedExpenseDepots.set(expanded);
  }

  isRevenueDepotExpanded(depotId: number): boolean {
    return this.expandedRevenueDepots().has(depotId);
  }

  isExpenseDepotExpanded(depotId: number): boolean {
    return this.expandedExpenseDepots().has(depotId);
  }
}
