import { Component, OnInit, ViewChild, ElementRef, AfterViewInit, inject, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import * as Chart from 'chart.js/auto';
import { PrintService } from '../../core/services/print.service';
import { DepotsService } from '../../core/services/depots.service';

interface DailyMonthlyReport {
  date: string;
  caVente: number;
  prixAchat: number;
  resultat: number;
  depotName: string;
  sessionId?: number;
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
export class DailyMonthlyComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('chartCanvas', { static: false }) chartCanvas!: ElementRef<HTMLCanvasElement>;
  
  loading = false;
  error = '';
  reports: DailyMonthlyReport[] = [];
  reportsByDate: Array<{ date: string; reports: DailyMonthlyReport[]; totals: { caVente: number; prixAchat: number; resultat: number } }> = [];
  chart: Chart.Chart | null = null;
  startDate: string = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
  endDate: string = new Date().toISOString().split('T')[0];
  filters: ReportFilters = {
    startDate: '',
    endDate: '',
    depotId: 'all',
    reportType: 'daily'
  };
  
  depots: Array<{ id: string; name: string }> = [];

  private readonly printService = inject(PrintService);

  constructor(
    private router: Router,
    private http: HttpClient,
    private depotsService: DepotsService
  ) {}

  ngOnInit(): void {
    // Initialize filters with default date range (current month)
    this.filters.startDate = this.startDate;
    this.filters.endDate = this.endDate;
    
    // Load depots dynamically
    this.depotsService.list().subscribe({
      next: (depots) => {
        this.depots = [
          { id: 'all', name: 'Tous' },
          ...depots.map(d => ({ id: d.id.toString(), name: d.name }))
        ];
      },
      error: (error) => {
        console.error('Error loading depots:', error);
        // Fallback to empty array if loading fails
        this.depots = [{ id: 'all', name: 'Tous' }];
      }
    });
    
    this.loadReports();
  }

  ngAfterViewInit(): void {
    // Chart will be initialized after data is loaded in loadReports()
    // If data is already loaded, create chart now
    if (this.reports.length > 0 && this.chartCanvas) {
      setTimeout(() => this.createChart(), 150);
    }
  }

  ngOnDestroy(): void {
    // Clean up chart on component destroy
    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }
  }

  loadReports(): void {
    this.loading = true;
    this.error = '';
    
    // Use startDate and endDate properties (synced with filters)
    const params: any = {};
    if (this.startDate) params.startDate = this.startDate;
    if (this.endDate) params.endDate = this.endDate;
    if (this.filters.depotId !== 'all') params.depotId = this.filters.depotId;
    params.reportType = this.filters.reportType;

    this.http.get<DailyMonthlyReport[]>(`${environment.apiUrl}/reports/daily-monthly`, { params })
      .subscribe({
        next: (data) => {
          this.reports = data;
          this.processReportsByDate(); // Process and cache the grouped data
          this.loading = false;
          if (this.reports.length > 0) {
            // Delay chart creation to ensure canvas is rendered
            setTimeout(() => {
              if (this.chartCanvas) {
                this.createChart();
              }
            }, 150);
          }
        },
        error: (error) => {
          this.error = 'Erreur lors du chargement du rapport';
          this.loading = false;
          console.error('Error loading daily-monthly report:', error);
        }
      });
  }

  onDateChange(): void {
    this.filters.startDate = this.startDate;
    this.filters.endDate = this.endDate;
    this.loadReports();
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

  getMarginPercentage(resultat: number, caVente: number): number {
    return caVente > 0 ? (resultat / caVente) * 100 : 0;
  }

  getTotalMarginPercentage(): number {
    const totalCA = this.getTotalCA();
    return totalCA > 0 ? (this.getTotalResultat() / totalCA) * 100 : 0;
  }

  // Process and cache reports grouped by date with pre-calculated totals
  processReportsByDate(): void {
    const grouped = new Map<string, DailyMonthlyReport[]>();
    
    this.reports.forEach(report => {
      if (!grouped.has(report.date)) {
        grouped.set(report.date, []);
      }
      grouped.get(report.date)!.push(report);
    });
    
    // Convert to array with pre-calculated totals and sort by date
    this.reportsByDate = Array.from(grouped.entries())
      .map(([date, reports]) => {
        const totals = {
          caVente: reports.reduce((sum, r) => sum + r.caVente, 0),
          prixAchat: reports.reduce((sum, r) => sum + r.prixAchat, 0),
          resultat: reports.reduce((sum, r) => sum + r.resultat, 0)
        };
        return { date, reports, totals };
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  // Group reports by date for display (deprecated - use reportsByDate instead)
  getReportsByDate(): Array<{ date: string; reports: DailyMonthlyReport[] }> {
    const grouped = new Map<string, DailyMonthlyReport[]>();
    
    this.reports.forEach(report => {
      if (!grouped.has(report.date)) {
        grouped.set(report.date, []);
      }
      grouped.get(report.date)!.push(report);
    });
    
    // Convert to array and sort by date
    return Array.from(grouped.entries())
      .map(([date, reports]) => ({ date, reports }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  // Get totals for a specific date
  getDateTotals(reports: DailyMonthlyReport[]): { caVente: number; prixAchat: number; resultat: number } {
    return {
      caVente: reports.reduce((sum, r) => sum + r.caVente, 0),
      prixAchat: reports.reduce((sum, r) => sum + r.prixAchat, 0),
      resultat: reports.reduce((sum, r) => sum + r.resultat, 0)
    };
  }

  createChart(): void {
    if (!this.chartCanvas || this.reports.length === 0) {
      console.warn('Chart canvas not available or no data');
      return;
    }

    const canvas = this.chartCanvas.nativeElement;
    if (!canvas) {
      console.warn('Canvas element not found');
      return;
    }

    // Destroy existing chart
    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.warn('Could not get canvas context');
      return;
    }

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
    const depotName = this.depots.find(d => d.id === this.filters.depotId)?.name || 'Tous';
    const reportType = this.filters.reportType === 'daily' ? 'Journalier' : 'Mensuel';
    const title = `Rapport ${reportType}`;
    
    const htmlContent = `
      <div class="header">
        <div class="title">${title}</div>
        <div class="subtitle">Période: ${this.filters.startDate} au ${this.filters.endDate} | Site: ${depotName}</div>
      </div>
      
      <div class="summary">
        <p><strong>CA Vente Total:</strong> ${this.getTotalCA().toFixed(3)} dt</p>
        <p><strong>Prix Achat Total:</strong> ${this.getTotalAchat().toFixed(3)} dt</p>
        <p><strong>Résultat Total:</strong> ${this.getTotalResultat().toFixed(3)} dt</p>
      </div>
      
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Site</th>
            <th style="text-align: right;">CA Vente</th>
            <th style="text-align: right;">Prix Achat</th>
            <th style="text-align: right;">Résultat</th>
          </tr>
        </thead>
        <tbody>
          ${this.reports.map(r => `
            <tr>
              <td>${new Date(r.date).toLocaleDateString('fr-FR')}</td>
              <td>${r.depotName}</td>
              <td style="text-align: right;">${r.caVente.toFixed(3)}</td>
              <td style="text-align: right;">${r.prixAchat.toFixed(3)}</td>
              <td style="text-align: right;">${r.resultat.toFixed(3)}</td>
            </tr>
          `).join('')}
          <tr class="total-row">
            <td colspan="2"><strong>TOTAL</strong></td>
            <td style="text-align: right;"><strong>${this.getTotalCA().toFixed(3)}</strong></td>
            <td style="text-align: right;"><strong>${this.getTotalAchat().toFixed(3)}</strong></td>
            <td style="text-align: right;"><strong>${this.getTotalResultat().toFixed(3)}</strong></td>
          </tr>
        </tbody>
      </table>
    `;
    
    this.printService.printA4Report(htmlContent, title);
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
