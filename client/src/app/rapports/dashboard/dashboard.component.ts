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
  dashboardData: DashboardData | null = null;
  
  // Charts
  salesChart: Chart | null = null;
  resultsChart: Chart | null = null;
  indicatorsChart: Chart | null = null;
  trendChart: Chart | null = null;
  
  // Chart visibility
  showCharts = true;
  selectedPeriod = 'monthly'; // daily, monthly, yearly

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

    this.http.get<DashboardData>(`${environment.apiUrl}/reports/dashboard`)
      .subscribe({
        next: (data) => {
          this.dashboardData = data;
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
      const dailySales = this.dashboardData.sales.monthly / 30 + (Math.random() - 0.5) * 100;
      const dailyPurchases = this.dashboardData.purchases.monthly / 30 + (Math.random() - 0.5) * 50;
      
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
    if (!this.dashboardData) return 0;
    const monthly = this.dashboardData.sales.monthly;
    const daily = this.dashboardData.sales.daily;
    return monthly > 0 ? ((daily * 30 - monthly) / monthly) * 100 : 0;
  }

  getResultsGrowth(): number {
    if (!this.dashboardData) return 0;
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
      ['Ventes (dt)', this.dashboardData.sales.daily.toFixed(2), this.dashboardData.sales.monthly.toFixed(2), this.dashboardData.sales.yearly.toFixed(2)],
      ['Achats (dt)', this.dashboardData.purchases.daily.toFixed(2), this.dashboardData.purchases.monthly.toFixed(2), this.dashboardData.purchases.yearly.toFixed(2)],
      ['Résultats (dt)', this.dashboardData.results.daily.toFixed(2), this.dashboardData.results.monthly.toFixed(2), this.dashboardData.results.yearly.toFixed(2)],
      ['Nouveaux Clients', '', this.dashboardData.indicators.newClients.toString(), ''],
      ['Nouvelles Négociations', '', this.dashboardData.indicators.newNegotiations.toString(), ''],
      ['Retards Paiement', '', this.dashboardData.indicators.paymentDelays.toString(), '']
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
