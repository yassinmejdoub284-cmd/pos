import { Component, OnInit, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import Chart from 'chart.js/auto';

interface Expense {
  id: number;
  amount: number;
  description: string;
  date: string;
  isApproved: boolean;
  category: {
    id: number;
    name: string;
  };
  depot: {
    id: number;
    name: string;
  };
  user: {
    id: number;
    firstName: string;
    lastName: string;
  };
  approver?: {
    id: number;
    firstName: string;
    lastName: string;
  };
}

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
  categories: any[] = [];
  depots: any[] = [];
  loading = false;
  error: string | null = null;
  chart: Chart | null = null;
  showChart = false;

  filters: ExpenseFilters = {
    startDate: '',
    endDate: '',
    categoryId: '',
    depotId: '',
    status: ''
  };

  constructor(
    private router: Router,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    this.setDefaultDates();
    this.loadCategories();
    this.loadDepots();
    this.loadExpenses();
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

  loadCategories(): void {
    this.http.get<any[]>(`${environment.apiUrl}/expenses/categories`)
      .subscribe({
        next: (categories) => {
          this.categories = categories;
        },
        error: (error) => {
          console.error('Error loading categories:', error);
        }
      });
  }

  loadDepots(): void {
    this.http.get<any[]>(`${environment.apiUrl}/depots`)
      .subscribe({
        next: (depots) => {
          this.depots = depots;
        },
        error: (error) => {
          console.error('Error loading depots:', error);
        }
      });
  }

  loadExpenses(): void {
    this.loading = true;
    this.error = null;

    const params: any = {};
    if (this.filters.startDate) params.startDate = this.filters.startDate;
    if (this.filters.endDate) params.endDate = this.filters.endDate;
    if (this.filters.categoryId) params.categoryId = this.filters.categoryId;
    if (this.filters.depotId) params.depotId = this.filters.depotId;
    if (this.filters.status) params.status = this.filters.status;

    this.http.get<{expenses: Expense[]}>(`${environment.apiUrl}/expenses`, { params })
      .subscribe({
        next: (response) => {
          this.expenses = response.expenses;
          this.loading = false;
          if (this.showChart) {
            this.createChart();
          }
        },
        error: (error) => {
          console.error('Error loading expenses:', error);
          this.error = 'Erreur lors du chargement des dépenses';
          this.loading = false;
        }
      });
  }

  onFiltersChange(): void {
    this.loadExpenses();
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
      const categoryName = expense.category.name;
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
    return this.expenses.reduce((sum, expense) => sum + expense.amount, 0);
  }

  getApprovedAmount(): number {
    return this.expenses
      .filter(expense => expense.isApproved)
      .reduce((sum, expense) => sum + expense.amount, 0);
  }

  getPendingAmount(): number {
    return this.expenses
      .filter(expense => !expense.isApproved)
      .reduce((sum, expense) => sum + expense.amount, 0);
  }

  getApprovedCount(): number {
    return this.expenses.filter(expense => expense.isApproved).length;
  }

  getPendingCount(): number {
    return this.expenses.filter(expense => !expense.isApproved).length;
  }

  getStatusLabel(isApproved: boolean): string {
    return isApproved ? 'Approuvée' : 'En Attente';
  }

  getStatusClass(isApproved: boolean): string {
    return isApproved 
      ? 'bg-green-100 text-green-800' 
      : 'bg-orange-100 text-orange-800';
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
    const headers = ['Date', 'Description', 'Catégorie', 'Dépôt', 'Montant', 'Statut', 'Utilisateur'];
    const rows = this.expenses.map(expense => [
      new Date(expense.date).toLocaleDateString('fr-FR'),
      expense.description,
      expense.category.name,
      expense.depot.name,
      expense.amount.toFixed(2),
      this.getStatusLabel(expense.isApproved),
      `${expense.user.firstName} ${expense.user.lastName}`
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
              <th>Description</th>
              <th>Catégorie</th>
              <th>Montant</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            ${this.expenses.map(expense => `
              <tr>
                <td>${new Date(expense.date).toLocaleDateString('fr-FR')}</td>
                <td>${expense.description}</td>
                <td>${expense.category.name}</td>
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
