import { Component, OnInit, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import Chart from 'chart.js/auto';

interface DashboardData {
  sales: {
    daily: number;
    monthly: number;
    yearly: number;
  };
  purchases: {
    daily: number;
    monthly: number;
    yearly: number;
  };
  indicators: {
    newClients: number;
    newNegotiations: number;
    paymentDelays: number;
  };
  results: {
    daily: number;
    monthly: number;
    yearly: number;
  };
  stockValue: number;
  resultStockOnly?: { daily: number; monthly: number; yearly: number };
  resultTotal?: { daily: number; monthly: number; yearly: number };
  finalResult?: { daily: number; monthly: number; yearly: number };
  discounts?: { daily: number; monthly: number; yearly: number };
  freeItems?: { daily: number; monthly: number; yearly: number };
  expenses?: { daily: number; monthly: number; yearly: number };
}

interface ChartData {
  labels: string[];
  datasets: any[];
}

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  standalone: false
})
export class DashboardComponent implements OnInit, AfterViewInit {
  @ViewChild('salesChart', { static: false }) salesChartCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('resultsChart', { static: false }) resultsChartCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('indicatorsChart', { static: false }) indicatorsChartCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('trendChart', { static: false }) trendChartCanvas!: ElementRef<HTMLCanvasElement>;
  
  loading = false;
  error = '';
  dashboardData: DashboardData = {
    sales: { daily: 0, monthly: 0, yearly: 0 },
    purchases: { daily: 0, monthly: 0, yearly: 0 },
    indicators: { newClients: 0, newNegotiations: 0, paymentDelays: 0 },
    results: { daily: 0, monthly: 0, yearly: 0 },
    stockValue: 0,
    resultStockOnly: { daily: 0, monthly: 0, yearly: 0 },
    resultTotal: { daily: 0, monthly: 0, yearly: 0 },
    finalResult: { daily: 0, monthly: 0, yearly: 0 },
    discounts: { daily: 0, monthly: 0, yearly: 0 },
    freeItems: { daily: 0, monthly: 0, yearly: 0 },
    expenses: { daily: 0, monthly: 0, yearly: 0 }
  };
  
  // Charts
  salesChart: Chart | null = null;
  resultsChart: Chart | null = null;
  indicatorsChart: Chart | null = null;
  trendChart: Chart | null = null;
  
  // Chart visibility
  showCharts = true;
  selectedPeriod = 'monthly'; // daily, monthly, yearly
  startDate: string = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
  endDate: string = new Date().toISOString().split('T')[0];

  constructor(
    private router: Router,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    this.loadDashboardData();
  }

  ngAfterViewInit(): void {
    // Charts will be created after data is loaded
  }

  loadDashboardData(): void {
    this.loading = true;
    this.error = '';

    const params: any = {};
    if (this.startDate) params.startDate = this.startDate;
    if (this.endDate) params.endDate = this.endDate;

    this.http.get<DashboardData>(`${environment.apiUrl}/reports/dashboard`, { params })
      .subscribe({
        next: (data) => {
          // Merge API data over safe defaults to avoid undefined nested objects
          this.dashboardData = {
            ...this.dashboardData,
            ...data,
            sales: { ...(this.dashboardData.sales || { daily: 0, monthly: 0, yearly: 0 }), ...(data?.sales || {}) },
            purchases: { ...(this.dashboardData.purchases || { daily: 0, monthly: 0, yearly: 0 }), ...(data?.purchases || {}) },
            indicators: { ...(this.dashboardData.indicators || { newClients: 0, newNegotiations: 0, paymentDelays: 0 }), ...(data?.indicators || {}) },
            results: { ...(this.dashboardData.results || { daily: 0, monthly: 0, yearly: 0 }), ...(data?.results || {}) },
            stockValue: data?.stockValue || 0,
            resultStockOnly: { ...(this.dashboardData.resultStockOnly || { daily: 0, monthly: 0, yearly: 0 }), ...(data?.resultStockOnly || {}) },
            resultTotal: { ...(this.dashboardData.resultTotal || { daily: 0, monthly: 0, yearly: 0 }), ...(data?.resultTotal || {}) },
            finalResult: { ...(this.dashboardData.finalResult || { daily: 0, monthly: 0, yearly: 0 }), ...(data?.finalResult || {}) },
            discounts: { ...(this.dashboardData.discounts || { daily: 0, monthly: 0, yearly: 0 }), ...(data?.discounts || {}) },
            freeItems: { ...(this.dashboardData.freeItems || { daily: 0, monthly: 0, yearly: 0 }), ...(data?.freeItems || {}) },
            expenses: { ...(this.dashboardData.expenses || { daily: 0, monthly: 0, yearly: 0 }), ...(data?.expenses || {}) }
          };
          this.loading = false;
          if (this.showCharts) {
            setTimeout(() => this.createAllCharts(), 100);
          }
        },
        error: (error) => {
          this.error = 'Erreur lors du chargement du dashboard';
          this.loading = false;
          console.error('Error loading dashboard:', error);
        }
      });
  }

  onDateChange(): void {
    this.loadDashboardData();
  }

  onStartDateChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.startDate = input?.value || this.startDate;
    this.onDateChange();
  }

  onEndDateChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.endDate = input?.value || this.endDate;
    this.onDateChange();
  }

  toggleCharts(): void {
    this.showCharts = !this.showCharts;
    if (this.showCharts) {
      setTimeout(() => this.createAllCharts(), 100);
    } else {
      this.destroyAllCharts();
    }
  }

  onPeriodChange(): void {
    if (this.showCharts) {
      setTimeout(() => this.createAllCharts(), 100);
    }
  }

  createAllCharts(): void {
    if (!this.dashboardData) return;
    
    this.createSalesChart();
    this.createResultsChart();
    this.createIndicatorsChart();
    this.createTrendChart();
  }

  destroyAllCharts(): void {
    if (this.salesChart) {
      this.salesChart.destroy();
      this.salesChart = null;
    }
    if (this.resultsChart) {
      this.resultsChart.destroy();
      this.resultsChart = null;
    }
    if (this.indicatorsChart) {
      this.indicatorsChart.destroy();
      this.indicatorsChart = null;
    }
    if (this.trendChart) {
      this.trendChart.destroy();
      this.trendChart = null;
    }
  }

  createSalesChart(): void {
    if (!this.salesChartCanvas || !this.dashboardData) return;

    if (this.salesChart) {
      this.salesChart.destroy();
    }

    const ctx = this.salesChartCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    if (!this.dashboardData?.sales) return;
    const data = this.dashboardData.sales;
    const labels = ['Journalier', 'Mensuel', 'Annuel'];
    const values = [data.daily, data.monthly, data.yearly];

    this.salesChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Ventes (dt)',
          data: values,
          backgroundColor: [
            'rgba(59, 130, 246, 0.8)',
            'rgba(16, 185, 129, 0.8)',
            'rgba(245, 158, 11, 0.8)'
          ],
          borderColor: [
            'rgb(59, 130, 246)',
            'rgb(16, 185, 129)',
            'rgb(245, 158, 11)'
          ],
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: 'Ventes par Période'
          },
          legend: {
            display: false
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: function(value) {
                return value + ' dt';
              }
            }
          }
        }
      }
    });
  }

  createResultsChart(): void {
    if (!this.resultsChartCanvas || !this.dashboardData) return;

    if (this.resultsChart) {
      this.resultsChart.destroy();
    }

    const ctx = this.resultsChartCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    if (!this.dashboardData?.results) return;
    const data = this.dashboardData.results;
    const labels = ['Journalier', 'Mensuel', 'Annuel'];
    const values = [data.daily, data.monthly, data.yearly];

    this.resultsChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: values,
          backgroundColor: [
            'rgba(34, 197, 94, 0.8)',
            'rgba(16, 185, 129, 0.8)',
            'rgba(5, 150, 105, 0.8)'
          ],
          borderColor: [
            'rgb(34, 197, 94)',
            'rgb(16, 185, 129)',
            'rgb(5, 150, 105)'
          ],
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: 'Résultats par Période'
          },
          legend: {
            position: 'bottom'
          }
        }
      }
    });
  }

  createIndicatorsChart(): void {
    if (!this.indicatorsChartCanvas || !this.dashboardData) return;

    if (this.indicatorsChart) {
      this.indicatorsChart.destroy();
    }

    const ctx = this.indicatorsChartCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    if (!this.dashboardData?.indicators) return;
    const data = this.dashboardData.indicators;
    const labels = ['Nouveaux Clients', 'Nouvelles Négociations', 'Retards Paiement'];
    const values = [data.newClients, data.newNegotiations, data.paymentDelays];

    this.indicatorsChart = new Chart(ctx, {
      type: 'polarArea',
      data: {
        labels: labels,
        datasets: [{
          data: values,
          backgroundColor: [
            'rgba(16, 185, 129, 0.8)',
            'rgba(59, 130, 246, 0.8)',
            'rgba(239, 68, 68, 0.8)'
          ],
          borderColor: [
            'rgb(16, 185, 129)',
            'rgb(59, 130, 246)',
            'rgb(239, 68, 68)'
          ],
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: 'Indicateurs Clés'
          },
          legend: {
            position: 'bottom'
          }
        }
      }
    });
  }

  createTrendChart(): void {
    if (!this.trendChartCanvas || !this.dashboardData) return;

    if (this.trendChart) {
      this.trendChart.destroy();
    }

    const ctx = this.trendChartCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    // Generate trend data (last 7 days simulation)
    const labels = [];
    const salesData = [];
    const purchasesData = [];
    const resultsData = [];
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      labels.push(date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }));
      
      // Simulate daily data based on monthly averages
      const dailySales = (this.dashboardData?.sales?.monthly || 0) / 30 + (Math.random() - 0.5) * 100;
      const dailyPurchases = (this.dashboardData?.purchases?.monthly || 0) / 30 + (Math.random() - 0.5) * 50;
      
      salesData.push(Math.max(0, dailySales));
      purchasesData.push(Math.max(0, dailyPurchases));
      resultsData.push(Math.max(0, dailySales - dailyPurchases));
    }

    this.trendChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Ventes',
            data: salesData,
            borderColor: 'rgb(59, 130, 246)',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            tension: 0.4,
            fill: true
          },
          {
            label: 'Achats',
            data: purchasesData,
            borderColor: 'rgb(249, 115, 22)',
            backgroundColor: 'rgba(249, 115, 22, 0.1)',
            tension: 0.4,
            fill: true
          },
          {
            label: 'Résultats',
            data: resultsData,
            borderColor: 'rgb(34, 197, 94)',
            backgroundColor: 'rgba(34, 197, 94, 0.1)',
            tension: 0.4,
            fill: true
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: 'Tendances des 7 Derniers Jours'
          },
          legend: {
            position: 'top'
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: function(value) {
                return value + ' dt';
              }
            }
          }
        }
      }
    });
  }

  getSalesGrowth(): number {
    if (!this.dashboardData?.sales) return 0;
    const monthly = this.dashboardData.sales.monthly;
    const daily = this.dashboardData.sales.daily;
    return monthly > 0 ? ((daily * 30 - monthly) / monthly) * 100 : 0;
  }

  getResultsGrowth(): number {
    if (!this.dashboardData?.results) return 0;
    const monthly = this.dashboardData.results.monthly;
    const daily = this.dashboardData.results.daily;
    return monthly > 0 ? ((daily * 30 - monthly) / monthly) * 100 : 0;
  }

  getGrowthClass(growth: number): string {
    if (growth > 0) return 'text-green-600';
    if (growth < 0) return 'text-red-600';
    return 'text-gray-600';
  }

  getGrowthIcon(growth: number): string {
    if (growth > 0) return 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6';
    if (growth < 0) return 'M13 17h8m0 0V9m0 8l-8-8-4 4-6-6';
    return 'M20 12H4';
  }

  exportDashboard(): void {
    if (!this.dashboardData) return;

    const csvContent = this.generateDashboardCSV();
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `dashboard_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  generateDashboardCSV(): string {
    if (!this.dashboardData) return '';
    
    const headers = ['Métrique', 'Journalier', 'Mensuel', 'Annuel'];
    const rows = [
      ['Ventes (dt)', (this.dashboardData.sales?.daily || 0).toFixed(2), (this.dashboardData.sales?.monthly || 0).toFixed(2), (this.dashboardData.sales?.yearly || 0).toFixed(2)],
      ['Achats (dt)', (this.dashboardData.purchases?.daily || 0).toFixed(2), (this.dashboardData.purchases?.monthly || 0).toFixed(2), (this.dashboardData.purchases?.yearly || 0).toFixed(2)],
      ['Valeur Stock CMUP (dt)', '', '', (this.dashboardData.stockValue || 0).toFixed(2)],
      ['Résultat stock vendu (dt)', (this.dashboardData.resultStockOnly?.daily || 0).toFixed(2), (this.dashboardData.resultStockOnly?.monthly || 0).toFixed(2), (this.dashboardData.resultStockOnly?.yearly || 0).toFixed(2)],
      ['Résultat total (dt)', (this.dashboardData.resultTotal?.daily || 0).toFixed(2), (this.dashboardData.resultTotal?.monthly || 0).toFixed(2), (this.dashboardData.resultTotal?.yearly || 0).toFixed(2)],
      ['Résultat final (dt)', (this.dashboardData.finalResult?.daily || 0).toFixed(2), (this.dashboardData.finalResult?.monthly || 0).toFixed(2), (this.dashboardData.finalResult?.yearly || 0).toFixed(2)],
      ['Remises (dt)', (this.dashboardData.discounts?.daily || 0).toFixed(2), (this.dashboardData.discounts?.monthly || 0).toFixed(2), (this.dashboardData.discounts?.yearly || 0).toFixed(2)],
      ['Gratuits (dt)', (this.dashboardData.freeItems?.daily || 0).toFixed(2), (this.dashboardData.freeItems?.monthly || 0).toFixed(2), (this.dashboardData.freeItems?.yearly || 0).toFixed(2)],
      ['Dépenses (dt)', (this.dashboardData.expenses?.daily || 0).toFixed(2), (this.dashboardData.expenses?.monthly || 0).toFixed(2), (this.dashboardData.expenses?.yearly || 0).toFixed(2)],
      ['Nouveaux Clients', '', (this.dashboardData.indicators?.newClients || 0).toString(), ''],
      ['Nouvelles Négociations', '', (this.dashboardData.indicators?.newNegotiations || 0).toString(), ''],
      ['Retards Paiement', '', (this.dashboardData.indicators?.paymentDelays || 0).toString(), '']
    ];

    return [headers, ...rows].map(row => 
      row.map(field => `"${field}"`).join(',')
    ).join('\n');
  }

  printDashboard(): void {
    window.print();
  }

  goBack(): void {
    this.router.navigate(['/rapports']);
  }
}
