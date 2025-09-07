import { Component, OnInit, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import * as Chart from 'chart.js/auto';

interface CategoryReport {
  id: number;
  name: string;
  type: 'family' | 'product' | 'category';
  quantity: number;
  totalTTC: number;
  prixAchat: number;
  resultat: number;
  supplierCount?: number;
}

interface ReportFilters {
  startDate: string;
  endDate: string;
  filterType: 'family' | 'product' | 'category';
  depotId: string;
  reportType: 'sales' | 'purchases';
}

@Component({
  selector: 'app-sales-by-category',
  templateUrl: './sales-by-category.component.html',
  standalone: false
})
export class SalesByCategoryComponent implements OnInit, AfterViewInit {
  @ViewChild('chartCanvas', { static: false }) chartCanvas!: ElementRef<HTMLCanvasElement>;
  
  loading = false;
  error = '';
  reports: CategoryReport[] = [];
  chart: Chart.Chart | null = null;
  showChart = false;
  filters: ReportFilters = {
    startDate: '',
    endDate: '',
    filterType: 'family',
    depotId: 'all',
    reportType: 'sales'
  };
  
  depots = [
    { id: 'all', name: 'Tous' },
    { id: '1', name: 'Pt Vte Sfax' },
    { id: '2', name: 'Pt Vte Tunis' },
    { id: '3', name: 'Atelier' },
    { id: '4', name: 'Dépôt Tunis' }
  ];

  constructor(
    private router: Router,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    // Set default date range (last 30 days)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    
    this.filters.startDate = startDate.toISOString().split('T')[0];
    this.filters.endDate = endDate.toISOString().split('T')[0];
    
    this.loadReports();
  }

  ngAfterViewInit(): void {
    // Chart will be initialized after data is loaded
  }

  loadReports(): void {
    this.loading = true;
    this.error = '';
    
    const endpoint = this.filters.reportType === 'sales' 
      ? 'sales-by-category' 
      : 'purchases-by-category';
    
    const params = {
      startDate: this.filters.startDate,
      endDate: this.filters.endDate,
      filterType: this.filters.filterType,
      depotId: this.filters.depotId === 'all' ? '' : this.filters.depotId
    };

    this.http.get<CategoryReport[]>(`${environment.apiUrl}/reports/${endpoint}`, { params })
      .subscribe({
        next: (data) => {
          this.reports = data;
          this.loading = false;
          if (this.reports.length > 0) {
            this.createChart();
          }
        },
        error: (error) => {
          this.error = 'Erreur lors du chargement du rapport';
          this.loading = false;
          console.error('Error loading category report:', error);
        }
      });
  }

  onFiltersChange(): void {
    this.loadReports();
  }

  goBack(): void {
    this.router.navigate(['/rapports']);
  }

  toggleChart(): void {
    this.showChart = !this.showChart;
    if (this.showChart && this.reports.length > 0) {
      setTimeout(() => this.createChart(), 100);
    }
  }

  createChart(): void {
    if (!this.chartCanvas || this.reports.length === 0) return;

    // Destroy existing chart
    if (this.chart) {
      this.chart.destroy();
    }

    const ctx = this.chartCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    // Take top 10 items for better visualization
    const topItems = this.reports.slice(0, 10);
    const labels = topItems.map(r => r.name.length > 15 ? r.name.substring(0, 15) + '...' : r.name);

    this.chart = new Chart.Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Total TTC',
            data: topItems.map(r => r.totalTTC),
            backgroundColor: 'rgba(59, 130, 246, 0.8)',
            borderColor: 'rgb(59, 130, 246)',
            borderWidth: 1
          },
          {
            label: 'Prix Achat',
            data: topItems.map(r => r.prixAchat),
            backgroundColor: 'rgba(249, 115, 22, 0.8)',
            borderColor: 'rgb(249, 115, 22)',
            borderWidth: 1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: `Top 10 ${this.filters.reportType === 'sales' ? 'Ventes' : 'Achats'} par ${this.getFilterTypeLabel()}`
          },
          legend: {
            position: 'top',
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

  getFilterTypeLabel(): string {
    switch (this.filters.filterType) {
      case 'family': return 'Famille';
      case 'product': return 'Article';
      case 'category': return 'Catégorie';
      default: return 'Famille';
    }
  }

  getTotalQuantity(): number {
    return this.reports.reduce((sum, report) => sum + report.quantity, 0);
  }

  getTotalTTC(): number {
    return this.reports.reduce((sum, report) => sum + report.totalTTC, 0);
  }

  getTotalAchat(): number {
    return this.reports.reduce((sum, report) => sum + report.prixAchat, 0);
  }

  getTotalResultat(): number {
    return this.reports.reduce((sum, report) => sum + report.resultat, 0);
  }

  exportToExcel(): void {
    const headers = [
      this.getFilterTypeLabel(),
      'Qté',
      'Total TTC (dt)',
      'Prix Achat (dt)',
      'Résultat (dt)'
    ];
    
    if (this.filters.reportType === 'purchases') {
      headers.splice(1, 0, 'Nb Fournisseurs');
    }
    
    const csvContent = [
      headers.join(','),
      ...this.reports.map(r => {
        const row = [
          r.name,
          r.quantity.toFixed(3),
          r.totalTTC.toFixed(3),
          r.prixAchat.toFixed(3),
          r.resultat.toFixed(3)
        ];
        
        if (this.filters.reportType === 'purchases' && r.supplierCount !== undefined) {
          row.splice(1, 0, r.supplierCount.toString());
        }
        
        return row.join(',');
      })
    ].join('\n');

    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `rapport_${this.filters.reportType}_${this.filters.filterType}_${this.filters.startDate}_${this.filters.endDate}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  printA4(): void {
    window.print();
  }

  print80mm(): void {
    // Create a simplified version for 80mm printing
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      const printContent = `
        <html>
          <head>
            <title>Rapport ${this.filters.reportType === 'sales' ? 'Ventes' : 'Achats'} par ${this.getFilterTypeLabel()}</title>
            <style>
              body { font-family: monospace; font-size: 12px; margin: 0; padding: 10px; }
              .header { text-align: center; font-weight: bold; margin-bottom: 10px; }
              .summary { margin-bottom: 10px; }
              table { width: 100%; border-collapse: collapse; }
              th, td { border: 1px solid #000; padding: 2px; text-align: right; }
              th { background-color: #f0f0f0; }
              .total { font-weight: bold; }
            </style>
          </head>
          <body>
            <div class="header">Rapport ${this.filters.reportType === 'sales' ? 'Ventes' : 'Achats'} par ${this.getFilterTypeLabel()}</div>
            <div class="summary">
              Période: ${this.filters.startDate} au ${this.filters.endDate}<br>
              Site: ${this.depots.find(d => d.id === this.filters.depotId)?.name || 'Tous'}
            </div>
            <table>
              <tr>
                <th>${this.getFilterTypeLabel()}</th>
                <th>Qté</th>
                <th>Total TTC</th>
                <th>Prix Achat</th>
                <th>Résultat</th>
              </tr>
              ${this.reports.map(r => `
                <tr>
                  <td>${r.name}</td>
                  <td>${r.quantity.toFixed(3)}</td>
                  <td>${r.totalTTC.toFixed(3)}</td>
                  <td>${r.prixAchat.toFixed(3)}</td>
                  <td>${r.resultat.toFixed(3)}</td>
                </tr>
              `).join('')}
              <tr class="total">
                <td>TOTAL</td>
                <td>${this.getTotalQuantity().toFixed(3)}</td>
                <td>${this.getTotalTTC().toFixed(3)}</td>
                <td>${this.getTotalAchat().toFixed(3)}</td>
                <td>${this.getTotalResultat().toFixed(3)}</td>
              </tr>
            </table>
          </body>
        </html>
      `;
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.print();
    }
  }
}
