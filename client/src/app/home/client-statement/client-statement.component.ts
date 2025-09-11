import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface Client {
  id: number;
  code: string;
  firstName: string;
  lastName: string;
  currentDebt: number;
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
  saleId?: number;
}

interface ClientStatement {
  client: Client;
  statement: StatementItem[];
  totalDebit: number;
  totalCredit: number;
  currentBalance: number;
}

interface ClientSummary {
  id: number;
  code: string;
  firstName: string;
  lastName: string;
  currentDebt: number;
  totalSpent: number;
  periodSales: number;
  periodPayments: number;
  periodDebts: number;
  periodBalance: number;
  _count: {
    sales: number;
  };
}

@Component({
  selector: 'app-client-statement',
  templateUrl: './client-statement.component.html',
  standalone: true,
  imports: [CommonModule, FormsModule]
})
export class ClientStatementComponent implements OnInit {
  clients: Client[] = [];
  clientSummaries: ClientSummary[] = [];
  selectedClient: Client | null = null;
  statement: ClientStatement | null = null;
  loading = false;
  showSummary = true;
  
  // Filters
  filters = {
    clientId: null as number | null,
    startDate: '',
    endDate: ''
  };

  constructor(private http: HttpClient, private router: Router) {}

  ngOnInit(): void {
    this.loadClientSummaries();
  }

  loadClientSummaries(): void {
    this.loading = true;
    let url = `${environment.apiUrl}/client-statements/statements/summary?`;
    const params = new URLSearchParams();
    
    if (this.filters.startDate) {
      params.append('startDate', this.filters.startDate);
    }
    if (this.filters.endDate) {
      params.append('endDate', this.filters.endDate);
    }
    
    url += params.toString();

    this.http.get<ClientSummary[]>(url).subscribe({
      next: (summaries) => {
        this.clientSummaries = summaries;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading client summaries:', error);
        this.loading = false;
      }
    });
  }

  loadStatement(): void {
    if (!this.filters.clientId) {
      alert('Veuillez sélectionner un client');
      return;
    }

    this.loading = true;
    let url = `${environment.apiUrl}/client-statements/${this.filters.clientId}/statement?`;
    const params = new URLSearchParams();
    
    if (this.filters.startDate) {
      params.append('startDate', this.filters.startDate);
    }
    if (this.filters.endDate) {
      params.append('endDate', this.filters.endDate);
    }
    
    url += params.toString();

    this.http.get<ClientStatement>(url).subscribe({
      next: (statement) => {
        this.statement = statement;
        this.selectedClient = statement.client;
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

  onClientChange(): void {
    this.statement = null;
    this.selectedClient = this.clients.find(c => c.id === this.filters.clientId) || null;
  }

  clearFilters(): void {
    this.filters = {
      clientId: null,
      startDate: '',
      endDate: ''
    };
    this.statement = null;
    this.selectedClient = null;
    this.showSummary = true;
  }

  backToSummary(): void {
    this.showSummary = true;
    this.statement = null;
    this.selectedClient = null;
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

  getTransactionTypeLabel(type: string): string {
    const types: { [key: string]: string } = {
      'sale': 'Vente',
      'debt': 'Créance',
      'payment': 'Paiement'
    };
    return types[type] || type;
  }

  getTransactionTypeColor(type: string): string {
    const colors: { [key: string]: string } = {
      'sale': 'text-blue-600 bg-blue-50',
      'debt': 'text-red-600 bg-red-50',
      'payment': 'text-green-600 bg-green-50'
    };
    return colors[type] || 'text-gray-600 bg-gray-50';
  }

  onReferenceClick(item: StatementItem): void {
    if (item.clickable) {
      if (item.type === 'sale' || item.saleId) {
        // Navigate to sale details
        this.router.navigate(['/historique'], { queryParams: { saleId: item.id } });
      }
    }
  }

  exportStatement(): void {
    if (!this.statement || !this.selectedClient) {
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
    link.setAttribute('download', `releve_client_${this.selectedClient.code}_${new Date().toISOString().split('T')[0]}.csv`);
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
      this.getTransactionTypeLabel(item.type),
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

  getClientFullName(client: ClientSummary | Client): string {
    return `${client.firstName} ${client.lastName}`;
  }

  getBalanceColor(balance: number): string {
    if (balance > 0) return 'text-red-600';
    if (balance < 0) return 'text-green-600';
    return 'text-gray-600';
  }
}
