import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router, RouterModule } from '@angular/router';
import { environment } from '../../../environments/environment';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface CashMovement {
  id: number;
  sessionId: number;
  type: string;
  amount: number;
  reason: string;
  ticketId?: number;
  createdAt: string;
  session: {
    id: number;
    openedAt: string;
    closedAt?: string;
    openingFund: number;
    expectedCash: number;
    countedCash?: number;
    variance?: number;
    status: string;
  };
  createdBy: {
    id: number;
    firstName: string;
    lastName: string;
  };
}

interface Sale {
  id: number;
  total: number;
  finalTotal: number;
  createdAt: string;
  sessionId?: number;
  paymentMethod: {
    name: string;
    type: string;
  };
  user: {
    id: number;
    firstName: string;
    lastName: string;
  };
}

interface StatementItem {
  type: string;
  date: string;
  reference: string;
  debit: number;
  credit: number;
  balance: number;
  description: string;
  id: number;
  clickable: boolean;
  movementType?: string;
  sessionId?: number;
}

interface CashStatement {
  statement: StatementItem[];
  summary: {
    totalEntries: number;
    totalExits: number;
    currentBalance: number;
    totalCashSales: number;
    totalNonCashSales: number;
    totalSales: number;
  };
  period: {
    startDate?: string;
    endDate?: string;
    sessionId?: number;
  };
}

interface DailySummary {
  date: string;
  cashEntries: number;
  cashExits: number;
  cashSales: number;
  nonCashSales: number;
  totalSales: number;
  sessions: number;
  netCashFlow: number;
}

@Component({
  selector: 'app-cash-statement',
  templateUrl: './cash-statement.component.html',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule]
})
export class CashStatementComponent implements OnInit {
  statement: CashStatement | null = null;
  dailySummaries: DailySummary[] = [];
  loading = false;
  showSummary = true;
  
  // Filters
  filters = {
    startDate: '',
    endDate: '',
    sessionId: null as number | null
  };

  constructor(private http: HttpClient, private router: Router) {}

  ngOnInit(): void {
    this.loadDailySummary();
  }

  loadStatement(): void {
    this.loading = true;
    let url = `${environment.apiUrl}/cash-statements/statement?`;
    const params = new URLSearchParams();
    
    if (this.filters.startDate) {
      params.append('startDate', this.filters.startDate);
    }
    if (this.filters.endDate) {
      params.append('endDate', this.filters.endDate);
    }
    if (this.filters.sessionId) {
      params.append('sessionId', this.filters.sessionId.toString());
    }
    
    url += params.toString();

    this.http.get<CashStatement>(url).subscribe({
      next: (statement) => {
        this.statement = statement;
        this.showSummary = false;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading statement:', error);
        this.loading = false;
        alert('Erreur lors du chargement du relevé');
      }
    });
  }

  loadDailySummary(): void {
    if (!this.filters.startDate || !this.filters.endDate) {
      return;
    }

    this.loading = true;
    let url = `${environment.apiUrl}/cash-statements/summary?`;
    const params = new URLSearchParams();
    
    params.append('startDate', this.filters.startDate);
    params.append('endDate', this.filters.endDate);
    
    url += params.toString();

    this.http.get<DailySummary[]>(url).subscribe({
      next: (summaries) => {
        this.dailySummaries = summaries;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading daily summary:', error);
        this.loading = false;
      }
    });
  }

  clearFilters(): void {
    this.filters = {
      startDate: '',
      endDate: '',
      sessionId: null
    };
    this.statement = null;
    this.dailySummaries = [];
    this.showSummary = true;
  }

  backToSummary(): void {
    this.showSummary = true;
    this.statement = null;
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('fr-FR');
  }

  formatAmount(amount: number): string {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'TND'
    }).format(amount);
  }

  getMovementTypeLabel(type: string): string {
    const types: { [key: string]: string } = {
      'ENTREE': 'Entrée',
      'SORTIE': 'Sortie',
      'DEPOT_COFFRE': 'Dépôt coffre',
      'RETRAIT_CENTRALE': 'Retrait centrale',
      'AJUSTEMENT': 'Ajustement',
      'cash_movement': 'Mouvement caisse',
      'sale': 'Vente'
    };
    return types[type] || type;
  }

  getMovementTypeColor(type: string): string {
    const colors: { [key: string]: string } = {
      'ENTREE': 'text-green-600 bg-green-50',
      'SORTIE': 'text-red-600 bg-red-50',
      'DEPOT_COFFRE': 'text-blue-600 bg-blue-50',
      'RETRAIT_CENTRALE': 'text-purple-600 bg-purple-50',
      'AJUSTEMENT': 'text-orange-600 bg-orange-50',
      'cash_movement': 'text-indigo-600 bg-indigo-50',
      'sale': 'text-emerald-600 bg-emerald-50'
    };
    return colors[type] || 'text-gray-600 bg-gray-50';
  }

  onReferenceClick(item: StatementItem): void {
    if (item.clickable) {
      if (item.type === 'sale') {
        // Navigate to sale details
        this.router.navigate(['/historique'], { queryParams: { saleId: item.id } });
      }
    }
  }

  exportStatement(): void {
    if (!this.statement) {
      alert('Aucun relevé à exporter');
      return;
    }

    // Create CSV content
    const csvContent = this.generateCSV();
    
    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `releve_caisse_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  private generateCSV(): string {
    if (!this.statement) return '';

    const headers = ['Date', 'Type', 'Référence', 'Description', 'Débit', 'Crédit', 'Solde'];
    const rows = this.statement.statement.map(item => [
      this.formatDate(item.date),
      this.getMovementTypeLabel(item.movementType || item.type),
      item.reference,
      item.description,
      item.debit > 0 ? item.debit.toFixed(3) : '',
      item.credit > 0 ? item.credit.toFixed(3) : '',
      item.balance.toFixed(3)
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    return csvContent;
  }

  getBalanceColor(balance: number): string {
    if (balance > 0) return 'text-green-600';
    if (balance < 0) return 'text-red-600';
    return 'text-gray-600';
  }

  getCashFlowColor(flow: number): string {
    if (flow > 0) return 'text-green-600';
    if (flow < 0) return 'text-red-600';
    return 'text-gray-600';
  }
}
