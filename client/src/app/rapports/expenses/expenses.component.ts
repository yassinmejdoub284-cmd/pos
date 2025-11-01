import { Component, OnInit, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { Router } from '@angular/router';
import { ExpenseService, Expense, ExpenseCategory, ExpenseStats } from '../../core/services/expense.service';
import { AuthService } from '../../core/services/auth.service';
import Chart from 'chart.js/auto';

interface ExpenseFilters {
  startDate: string;
  endDate: string;
  categoryId: string;
  depotId: string;
  status: string;
}

@Component({
  selector: 'app-expenses',
  templateUrl: './expenses.component.html',
  standalone: false
})
export class ExpensesComponent implements OnInit, AfterViewInit {
  @ViewChild('chartCanvas', { static: false }) chartCanvas!: ElementRef<HTMLCanvasElement>;
  
  expenses: Expense[] = [];
  categories: ExpenseCategory[] = [];
  depots: any[] = [];
  stats: ExpenseStats | null = null;
  loading = false;
  error: string | null = null;
  chart: Chart | null = null;
  showChart = false;
  currentUser: any = null;

  filters: ExpenseFilters = {
    startDate: '',
    endDate: '',
    categoryId: '',
    depotId: '',
    status: ''
  };

  constructor(
    private router: Router,
    private expenseService: ExpenseService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.setDefaultDates();
    this.loadCurrentUser();
    this.loadData();
  }

  loadCurrentUser() {
    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
    });
  }

  ngAfterViewInit(): void {
    // Chart will be created after data is loaded
  }

  setDefaultDates(): void {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    
    this.filters.startDate = firstDay.toISOString().split('T')[0];
    this.filters.endDate = today.toISOString().split('T')[0];
  }

  loadData() {
    this.loading = true;
    this.error = null;

    const params: any = {};
    if (this.filters.startDate) params.startDate = this.filters.startDate;
    if (this.filters.endDate) params.endDate = this.filters.endDate;
    if (this.filters.categoryId) params.categoryId = this.filters.categoryId;
    if (this.filters.depotId) params.depotId = this.filters.depotId;
    if (this.filters.status) params.status = this.filters.status;

    Promise.all([
      this.expenseService.getCategories().toPromise(),
      this.expenseService.getExpenses(params).toPromise(),
      this.expenseService.getStats(params).toPromise(),
      this.loadDepots()
    ]).then(([categories, expenses, stats, depots]) => {
      this.categories = categories || [];
      this.expenses = expenses || [];
      this.stats = stats || null;
      this.depots = depots || [];
      this.loading = false;
      if (this.showChart) {
        this.createChart();
      }
    }).catch(error => {
      console.error('Error loading data:', error);
      this.error = 'Erreur lors du chargement des données';
      this.loading = false;
    });
  }

  loadDepots(): Promise<any[]> {
    return new Promise((resolve, reject) => {
      // Use a simple HTTP call since we can't access protected methods
      fetch('/api/depots', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      })
      .then(response => response.json())
      .then(depots => resolve(depots))
      .catch(error => {
        console.error('Error loading depots:', error);
        resolve([]);
      });
    });
  }

  onFiltersChange(): void {
    this.loadData();
  }

  toggleChart(): void {
    this.showChart = !this.showChart;
    if (this.showChart) {
      setTimeout(() => this.createChart(), 100);
    } else if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }
  }

  createChart(): void {
    if (!this.chartCanvas || this.expenses.length === 0) return;

    // Destroy existing chart
    if (this.chart) {
      this.chart.destroy();
    }

    const ctx = this.chartCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    // Group expenses by category
    const categoryData = this.expenses.reduce((acc, expense) => {
      const categoryName = expense.category?.name || 'Inconnu';
      if (!acc[categoryName]) {
        acc[categoryName] = { total: 0, count: 0, approved: 0, pending: 0 };
      }
      acc[categoryName].total += expense.amount;
      acc[categoryName].count += 1;
      if (expense.isApproved) {
        acc[categoryName].approved += expense.amount;
      } else {
        acc[categoryName].pending += expense.amount;
      }
      return acc;
    }, {} as any);

    const categories = Object.keys(categoryData);
    const approvedAmounts = categories.map(cat => categoryData[cat].approved);
    const pendingAmounts = categories.map(cat => categoryData[cat].pending);

    this.chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: categories,
        datasets: [
          {
            label: 'Approuvées',
            data: approvedAmounts,
            backgroundColor: 'rgba(34, 197, 94, 0.8)',
            borderColor: 'rgb(34, 197, 94)',
            borderWidth: 1
          },
          {
            label: 'En Attente',
            data: pendingAmounts,
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
            text: 'Dépenses par Catégorie - Statut'
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

  getTotalAmount(): number {
    return this.stats?.total.amount || 0;
  }

  getApprovedAmount(): number {
    return this.stats?.approved.amount || 0;
  }

  getPendingAmount(): number {
    return this.stats?.pending.amount || 0;
  }

  getApprovedCount(): number {
    return this.stats?.approved.count || 0;
  }

  getPendingCount(): number {
    return this.stats?.pending.count || 0;
  }

  getStatusLabel(isApproved: boolean): string {
    return isApproved ? 'Approuvée' : 'En Attente';
  }

  getStatusClass(isApproved: boolean): string {
    return isApproved 
      ? 'bg-green-100 text-green-800' 
      : 'bg-orange-100 text-orange-800';
  }

  payExpense(expense: Expense): void {
    if (!expense || expense.isPaid) { return; }
    this.expenseService.updateExpense(expense.id, { isPaid: true })
      .subscribe({
        next: () => this.loadData(),
        error: (error) => {
          console.error('Error paying expense:', error);
          this.error = error?.error?.error || 'Erreur lors du paiement de la dépense';
        }
      });
  }

  exportToExcel(): void {
    const csvContent = this.generateCSV();
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `etat_depenses_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  generateCSV(): string {
    const headers = ['Date', 'Catégorie', 'Dépôt', 'Montant', 'Statut', 'Utilisateur'];
    const rows = this.expenses.map(expense => [
      new Date(expense.date).toLocaleDateString('fr-FR'),
      expense.category?.name || 'Inconnu',
      expense.depot?.name || 'Inconnu',
      expense.amount.toFixed(2),
      this.getStatusLabel(expense.isApproved),
      `${expense.user?.firstName || ''} ${expense.user?.lastName || ''}`
    ]);

    return [headers, ...rows].map(row => 
      row.map(field => `"${field}"`).join(',')
    ).join('\n');
  }

  printA4(): void {
    window.print();
  }

  print80mm(): void {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      const printContent = this.generatePrintContent();
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.print();
    }
  }

  generatePrintContent(): string {
    const totalAmount = this.getTotalAmount();
    const approvedAmount = this.getApprovedAmount();
    const pendingAmount = this.getPendingAmount();

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>État Dépenses - ${new Date().toLocaleDateString('fr-FR')}</title>
        <style>
          body { font-family: monospace; font-size: 12px; margin: 0; padding: 10px; }
          .header { text-align: center; margin-bottom: 20px; }
          .summary { margin-bottom: 20px; }
          .table { width: 100%; border-collapse: collapse; }
          .table th, .table td { border: 1px solid #000; padding: 4px; text-align: left; }
          .table th { background-color: #f0f0f0; }
          .total { font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="header">
          <h2>ÉTAT DÉPENSES</h2>
          <p>Période: ${this.filters.startDate} au ${this.filters.endDate}</p>
        </div>
        
        <div class="summary">
          <p><strong>Total Dépenses:</strong> ${totalAmount.toFixed(2)} dt</p>
          <p><strong>Approuvées:</strong> ${approvedAmount.toFixed(2)} dt (${this.getApprovedCount()})</p>
          <p><strong>En Attente:</strong> ${pendingAmount.toFixed(2)} dt (${this.getPendingCount()})</p>
        </div>

        <table class="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Catégorie</th>
              <th>Montant</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            ${this.expenses.map(expense => `
              <tr>
                <td>${new Date(expense.date).toLocaleDateString('fr-FR')}</td>
                <td>${expense.category?.name || 'Inconnu'}</td>
                <td>${expense.amount.toFixed(2)}</td>
                <td>${this.getStatusLabel(expense.isApproved)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </body>
      </html>
    `;
  }

  goBack(): void {
    this.router.navigate(['/rapports']);
  }
}
