import { Component, OnInit, ViewChild, ElementRef, AfterViewInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import * as Chart from 'chart.js/auto';
import { PrintService } from '../../core/services/print.service';

interface CreditSale {
  clientId: number;
  clientName: string;
  clientCode: string;
  clientPhone: string;
  clientEmail: string;
  totalAmount: number;
  totalPaid: number;
  totalDue: number;
  salesCount: number;
  lastSaleDate: string;
  isOverdue: boolean;
  sales: Array<{
    id: number;
    date: string;
    amount: number;
    depotName: string;
  }>;
}

interface ReportFilters {
  startDate: string;
  endDate: string;
  depotId: string;
  status: 'all' | 'pending' | 'overdue' | 'paid';
}

@Component({
  selector: 'app-credit-sales',
  templateUrl: './credit-sales.component.html',
  standalone: false
})
export class CreditSalesComponent implements OnInit, AfterViewInit {
  @ViewChild('chartCanvas', { static: false }) chartCanvas!: ElementRef<HTMLCanvasElement>;
  
  loading = false;
  error = '';
  reports: CreditSale[] = [];
  chart: Chart.Chart | null = null;
  showChart = false;
  selectedClient: CreditSale | null = null;
  showClientDetails = false;
  filters: ReportFilters = {
    startDate: '',
    endDate: '',
    depotId: 'all',
    status: 'all'
  };
  
  depots = [
    { id: 'all', name: 'Tous' },
    { id: '1', name: 'Pt Vte Sfax' },
    { id: '2', name: 'Pt Vte Tunis' },
    { id: '3', name: 'Atelier' },
    { id: '4', name: 'Dépôt Tunis' }
  ];

  private readonly printService = inject(PrintService);

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
      status: this.filters.status
    };

    this.http.get<CreditSale[]>(`${environment.apiUrl}/reports/credit-sales`, { params })
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
          console.error('Error loading credit sales report:', error);
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

  showClientDetail(client: CreditSale): void {
    this.selectedClient = client;
    this.showClientDetails = true;
  }

  closeClientDetails(): void {
    this.showClientDetails = false;
    this.selectedClient = null;
  }

  createChart(): void {
    if (!this.chartCanvas || this.reports.length === 0) return;

    // Destroy existing chart
    if (this.chart) {
      this.chart.destroy();
    }

    const ctx = this.chartCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    // Take top 10 clients for better visualization
    const topClients = this.reports.slice(0, 10);
    const labels = topClients.map(r => r.clientName.length > 15 ? r.clientName.substring(0, 15) + '...' : r.clientName);

    this.chart = new Chart.Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Montant Dû',
            data: topClients.map(r => r.totalDue),
            backgroundColor: [
              'rgba(239, 68, 68, 0.8)',   // Red for overdue
              'rgba(245, 158, 11, 0.8)',  // Yellow for pending
              'rgba(34, 197, 94, 0.8)',   // Green for paid
              'rgba(59, 130, 246, 0.8)',  // Blue
              'rgba(147, 51, 234, 0.8)',  // Purple
              'rgba(236, 72, 153, 0.8)',  // Pink
              'rgba(14, 165, 233, 0.8)',  // Sky blue
              'rgba(16, 185, 129, 0.8)',  // Emerald
              'rgba(251, 146, 60, 0.8)',  // Orange
              'rgba(139, 92, 246, 0.8)'   // Violet
            ],
            borderColor: [
              'rgb(239, 68, 68)',
              'rgb(245, 158, 11)',
              'rgb(34, 197, 94)',
              'rgb(59, 130, 246)',
              'rgb(147, 51, 234)',
              'rgb(236, 72, 153)',
              'rgb(14, 165, 233)',
              'rgb(16, 185, 129)',
              'rgb(251, 146, 60)',
              'rgb(139, 92, 246)'
            ],
            borderWidth: 2
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: 'Top 10 Clients - Montants Dus'
          },
          legend: {
            position: 'bottom',
          }
        }
      }
    });
  }

  getTotalAmount(): number {
    return this.reports.reduce((sum, report) => sum + report.totalAmount, 0);
  }

  getTotalPaid(): number {
    return this.reports.reduce((sum, report) => sum + report.totalPaid, 0);
  }

  getTotalDue(): number {
    return this.reports.reduce((sum, report) => sum + report.totalDue, 0);
  }

  getOverdueCount(): number {
    return this.reports.filter(r => r.isOverdue).length;
  }

  getPendingCount(): number {
    return this.reports.filter(r => r.totalDue > 0 && !r.isOverdue).length;
  }

  getPaidCount(): number {
    return this.reports.filter(r => r.totalDue <= 0).length;
  }

  exportToExcel(): void {
    const headers = [
      'Code Client',
      'Nom Client',
      'Téléphone',
      'Email',
      'Montant Total',
      'Montant Payé',
      'Montant Dû',
      'Nb Ventes',
      'Dernière Vente',
      'Statut'
    ];
    
    const csvContent = [
      headers.join(','),
      ...this.reports.map(r => [
        r.clientCode,
        r.clientName,
        r.clientPhone || '',
        r.clientEmail || '',
        r.totalAmount.toFixed(3),
        r.totalPaid.toFixed(3),
        r.totalDue.toFixed(3),
        r.salesCount,
        new Date(r.lastSaleDate).toLocaleDateString('fr-FR'),
        r.isOverdue ? 'En Retard' : (r.totalDue > 0 ? 'En Attente' : 'Payé')
      ].join(','))
    ].join('\n');

    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `rapport_ventes_credit_${this.filters.startDate}_${this.filters.endDate}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  printA4(): void {
    const depotName = this.depots.find(d => d.id === this.filters.depotId)?.name || 'Tous';
    const title = 'Rapport Ventes à Crédit';
    
    const htmlContent = `
      <div class="header">
        <div class="title">${title}</div>
        <div class="subtitle">Période: ${this.filters.startDate} au ${this.filters.endDate} | Site: ${depotName}</div>
      </div>
      
      <div class="summary">
        <p><strong>Total Dû:</strong> ${this.getTotalDue().toFixed(3)} dt</p>
        <p><strong>Nombre de Clients:</strong> ${this.reports.length}</p>
      </div>
      
      <table>
        <thead>
          <tr>
            <th>Client</th>
            <th style="text-align: right;">Montant Dû</th>
            <th>Statut</th>
          </tr>
        </thead>
        <tbody>
          ${this.reports.map(r => `
            <tr>
              <td>${r.clientName}</td>
              <td style="text-align: right;">${r.totalDue.toFixed(3)}</td>
              <td>${r.isOverdue ? 'En Retard' : (r.totalDue > 0 ? 'En Attente' : 'Payé')}</td>
            </tr>
          `).join('')}
          <tr class="total-row">
            <td><strong>TOTAL</strong></td>
            <td style="text-align: right;"><strong>${this.getTotalDue().toFixed(3)}</strong></td>
            <td></td>
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
            <title>Rapport Ventes à Crédit</title>
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
            <div class="header">Rapport Ventes à Crédit</div>
            <div class="summary">
              Période: ${this.filters.startDate} au ${this.filters.endDate}<br>
              Site: ${this.depots.find(d => d.id === this.filters.depotId)?.name || 'Tous'}
            </div>
            <table>
              <tr>
                <th>Client</th>
                <th>Montant Dû</th>
                <th>Statut</th>
              </tr>
              ${this.reports.map(r => `
                <tr>
                  <td>${r.clientName}</td>
                  <td>${r.totalDue.toFixed(3)}</td>
                  <td>${r.isOverdue ? 'En Retard' : (r.totalDue > 0 ? 'En Attente' : 'Payé')}</td>
                </tr>
              `).join('')}
              <tr class="total">
                <td>TOTAL</td>
                <td>${this.getTotalDue().toFixed(3)}</td>
                <td></td>
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
