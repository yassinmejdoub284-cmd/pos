import { Component, OnInit, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import * as Chart from 'chart.js/auto';

interface DailyMonthlyReport {
  date: string;
  caVente: number;
  prixAchat: number;
  resultat: number;
  depotName: string;
}

interface ReportFilters {
  startDate: string;
  endDate: string;
  depotId: string;
  reportType: 'daily' | 'monthly';
}

@Component({
  selector: 'app-daily-monthly',
  templateUrl: './daily-monthly.component.html',
  standalone: false
})
export class DailyMonthlyComponent implements OnInit, AfterViewInit {
  @ViewChild('chartCanvas', { static: false }) chartCanvas!: ElementRef<HTMLCanvasElement>;
  
  loading = false;
  error = '';
  reports: DailyMonthlyReport[] = [];
  chart: Chart.Chart | null = null;
  showChart = false;
  filters: ReportFilters = {
    startDate: '',
    endDate: '',
    depotId: 'all',
    reportType: 'daily'
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
    
    const params = {
      startDate: this.filters.startDate,
      endDate: this.filters.endDate,
      depotId: this.filters.depotId === 'all' ? '' : this.filters.depotId,
      reportType: this.filters.reportType
    };

    this.http.get<DailyMonthlyReport[]>(`${environment.apiUrl}/reports/daily-monthly`, { params })
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
          console.error('Error loading daily-monthly report:', error);
        }
      });
  }

  onFiltersChange(): void {
    this.loadReports();
  }

  goBack(): void {
    this.router.navigate(['/rapports']);
  }

  getTotalCA(): number {
    return this.reports.reduce((sum, report) => sum + report.caVente, 0);
  }

  getTotalAchat(): number {
    return this.reports.reduce((sum, report) => sum + report.prixAchat, 0);
  }

  getTotalResultat(): number {
    return this.reports.reduce((sum, report) => sum + report.resultat, 0);
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

    const labels = this.reports.map(r => {
      const date = new Date(r.date);
      return this.filters.reportType === 'monthly' 
        ? date.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })
        : date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
    });

    this.chart = new Chart.Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'CA Vente',
            data: this.reports.map(r => r.caVente),
            borderColor: 'rgb(59, 130, 246)',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            tension: 0.4,
            fill: true
          },
          {
            label: 'Prix Achat',
            data: this.reports.map(r => r.prixAchat),
            borderColor: 'rgb(249, 115, 22)',
            backgroundColor: 'rgba(249, 115, 22, 0.1)',
            tension: 0.4,
            fill: true
          },
          {
            label: 'Résultat',
            data: this.reports.map(r => r.resultat),
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
            text: `Rapport ${this.filters.reportType === 'daily' ? 'Journalier' : 'Mensuel'} - CA Vente vs Prix Achat vs Résultat`
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

  exportToExcel(): void {
    // Create CSV content
    const headers = ['Date', 'Site', 'CA Vente (dt)', 'Prix Achat (dt)', 'Résultat (dt)'];
    const csvContent = [
      headers.join(','),
      ...this.reports.map(r => [
        r.date,
        r.depotName,
        r.caVente.toFixed(3),
        r.prixAchat.toFixed(3),
        r.resultat.toFixed(3)
      ].join(','))
    ].join('\n');

    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `rapport_${this.filters.reportType}_${this.filters.startDate}_${this.filters.endDate}.csv`);
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
            <title>Rapport ${this.filters.reportType === 'daily' ? 'Journalier' : 'Mensuel'}</title>
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
            <div class="header">Rapport ${this.filters.reportType === 'daily' ? 'Journalier' : 'Mensuel'}</div>
            <div class="summary">
              Période: ${this.filters.startDate} au ${this.filters.endDate}<br>
              Site: ${this.depots.find(d => d.id === this.filters.depotId)?.name || 'Tous'}
            </div>
            <table>
              <tr>
                <th>Date</th>
                <th>CA Vente</th>
                <th>Prix Achat</th>
                <th>Résultat</th>
              </tr>
              ${this.reports.map(r => `
                <tr>
                  <td>${new Date(r.date).toLocaleDateString('fr-FR')}</td>
                  <td>${r.caVente.toFixed(3)}</td>
                  <td>${r.prixAchat.toFixed(3)}</td>
                  <td>${r.resultat.toFixed(3)}</td>
                </tr>
              `).join('')}
              <tr class="total">
                <td>TOTAL</td>
                <td>${this.getTotalCA().toFixed(3)}</td>
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
