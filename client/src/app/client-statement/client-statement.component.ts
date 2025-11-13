import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router, RouterModule } from '@angular/router';
import { environment } from '../../environments/environment';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TicketDialogComponent } from '../shared/ticket-dialog/ticket-dialog.component';
import { PaymentDialogComponent } from '../shared/payment-dialog/payment-dialog.component';

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
  totalDebit: number;
  totalCredit: number;
  currentBalance: number;
  operationCount: number;
  _count: {
    sales: number;
    debtTransactions: number;
  };
}

@Component({
  selector: 'app-client-statement',
  templateUrl: './client-statement.component.html',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, TicketDialogComponent, PaymentDialogComponent]
})
export class ClientStatementComponent implements OnInit {
  clients: Client[] = [];
  clientSummaries: ClientSummary[] = [];
  selectedClient: Client | null = null;
  statement: ClientStatement | null = null;
  loading = false;
  showSummary = true;
  
  // Ticket Dialog
  showTicketDialog = false;
  selectedTicketId: number | null = null;
  
  // Payment Dialog
  showPaymentDialog = false;
  selectedPaymentId: number | null = null;
  
  
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
    return new Date(dateString).toUTCString();
  }

  formatAmount(amount: number): string {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'TND'
    }).format(amount);
  }

  getTransactionTypeLabel(type: string): string {
    const types: { [key: string]: string } = {
      'credit': 'Crédit',
      'debt': 'Crédit',
      'payment': 'Débit'
    };
    return types[type] || type;
  }

  getTransactionTypeColor(type: string): string {
    const colors: { [key: string]: string } = {
      'credit': 'text-orange-600 bg-orange-50',
      'debt': 'text-orange-600 bg-orange-50',
      'payment': 'text-green-600 bg-green-50'
    };
    return colors[type] || 'text-gray-600 bg-gray-50';
  }

  onReferenceClick(item: StatementItem): void {
    if (item.clickable) {
      // Check if it's a payment reference
      if (item.type === 'payment') {
        // Open payment dialog with payment details
        this.selectedPaymentId = item.id;
        this.showPaymentDialog = true;
      }
      // Check if it's a ticket reference (TICKET-XXX format)
      else if (item.reference.startsWith('TICKET-') || item.type === 'credit' || item.type === 'cash') {
        // Open ticket dialog with sale details
        this.selectedTicketId = item.id;
        this.showTicketDialog = true;
      }
    }
  }

  closeTicketDialog(): void {
    this.showTicketDialog = false;
    this.selectedTicketId = null;
  }

  closePaymentDialog(): void {
    this.showPaymentDialog = false;
    this.selectedPaymentId = null;
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

  printStatementA4(): void {
    if (!this.filters.clientId) {
      alert('Veuillez sélectionner un client');
      return;
    }

    const useCurrent = this.statement && this.selectedClient && this.selectedClient.id === this.filters.clientId;

    if (useCurrent) {
      this.openPrintWindow();
      return;
    }

    this.loading = true;
    let url = `${environment.apiUrl}/client-statements/${this.filters.clientId}/statement?`;
    const params = new URLSearchParams();
    if (this.filters.startDate) params.append('startDate', this.filters.startDate);
    if (this.filters.endDate) params.append('endDate', this.filters.endDate);
    url += params.toString();

    this.http.get<ClientStatement>(url).subscribe({
      next: (statement) => {
        this.statement = statement;
        this.selectedClient = statement.client;
        this.loading = false;
        this.openPrintWindow();
      },
      error: (error) => {
        console.error('Error loading statement for print:', error);
        this.loading = false;
        alert('Erreur lors du chargement du relevé pour impression');
      }
    });
  }

  private openPrintWindow(): void {
    if (!this.statement || !this.selectedClient) {
      alert('Aucun relevé à imprimer');
      return;
    }

    const html = this.buildA4Html();
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Impossible d\'ouvrir la fenêtre d\'impression. Vérifiez le bloqueur de pop-ups.');
      return;
    }
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    // Give the browser a tick to render before printing
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
      printWindow.close();
    }, 250);
  }

  private buildA4Html(): string {
    const client = this.selectedClient!;
    const statement = this.statement!;
    const periodStart = this.filters.startDate ? this.formatDate(this.filters.startDate) : 'Début';
    const periodEnd = this.filters.endDate ? this.formatDate(this.filters.endDate) : 'Aujourd\'hui';

    const rows = statement.statement.map(item => `
      <tr>
        <td>${this.escapeHtml(new Date(item.date).toLocaleDateString('fr-FR'))}</td>
        <td><span class="badge ${this.badgeClass(item.type)}">${this.escapeHtml(this.getTransactionTypeLabel(item.type))}</span></td>
        <td>${this.escapeHtml(item.reference)}</td>
        <td class="num debit">${item.debit > 0 ? this.formatNumber3(item.debit) : ''}</td>
        <td class="num credit">${item.credit > 0 ? this.formatNumber3(item.credit) : ''}</td>
        <td class="num ${item.balance >= 0 ? 'balance-pos' : 'balance-neg'}">${this.formatNumber3(item.balance)}</td>
      </tr>
    `).join('');

    return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>Relevé - ${this.escapeHtml(client.code)}</title>
  <style>
    @page { size: A4; margin: 0; }
    html, body { height: 100%; }
    body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #0f172a; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .sheet { padding-top: 5mm; }
    h1 { font-size: 22px; margin: 0 0 2mm 0; letter-spacing: .2px; }
    .muted { color: #64748b; font-size: 12px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6mm; }
    .company { font-weight: 700; color: #b45309; letter-spacing: .3px; }
    .summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4mm; margin: 3mm 0 6mm; }
    .card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 4mm; background: #ffffff; }
    .card h4 { margin: 0; font-size: 12px; color: #334155; font-weight: 600; }
    .card .val { margin-top: 2mm; font-weight: 700; font-size: 18px; font-variant-numeric: tabular-nums; }
    .val.debit { color: #b91c1c; }
    .val.credit { color: #065f46; }
    .val.balance-pos { color: #1e40af; }
    .val.balance-neg { color: #b91c1c; }
    table { width: 100%; border-collapse: collapse; }
    thead { display: table-header-group; }
    thead th { background: #fff7ed; color: #9a3412; font-size: 12px; text-align: left; padding: 3mm; border: 1px solid #e2e8f0; }
    tbody td { font-size: 12px; padding: 3mm; border: 1px solid #e2e8f0; }
    tbody tr:nth-child(odd) { background: #fafafa; }
    td.num { text-align: right; font-variant-numeric: tabular-nums; }
    td.debit { color: #b91c1c; font-weight: 600; }
    td.credit { color: #065f46; font-weight: 600; }
    td.balance-pos { color: #1e40af; font-weight: 700; }
    td.balance-neg { color: #b91c1c; font-weight: 700; }
    .badge { display: inline-block; padding: 2px 6px; border-radius: 9999px; font-size: 11px; font-weight: 600; border: 1px solid transparent; }
    .badge-credit { color: #9a3412; background: #ffedd5; border-color: #fdba74; }
    .badge-debt { color: #9a3412; background: #ffedd5; border-color: #fdba74; }
    .badge-payment { color: #065f46; background: #d1fae5; border-color: #34d399; }
    tr { page-break-inside: avoid; }
    .footer { position: fixed; bottom: 8mm; left: 12mm; right: 12mm; font-size: 11px; color: #64748b; display: flex; justify-content: space-between; }
    @media print { .no-print { display: none; } }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="header">
      <div>
        <div class="company">POS Pâtisserie</div>
        <h1>Relevé Client</h1>
        <div class="muted">${this.escapeHtml(client.firstName + ' ' + client.lastName)} (${this.escapeHtml(client.code)})</div>
      </div>
      <div class="muted">Période: ${this.escapeHtml(periodStart)} - ${this.escapeHtml(periodEnd)}</div>
    </div>

    <div class="summary">
      <div class="card"><h4>Total Débit</h4><div class="val debit">${this.formatNumber3(statement.totalDebit)}</div></div>
      <div class="card"><h4>Total Crédit</h4><div class="val credit">${this.formatNumber3(statement.totalCredit)}</div></div>
      <div class="card"><h4>Solde Actuel</h4><div class="val ${statement.currentBalance >= 0 ? 'balance-pos' : 'balance-neg'}">${this.formatNumber3(statement.currentBalance)}</div></div>
    </div>

    <table>
    <thead>
      <tr>
        <th>Date</th>
        <th>Type</th>
        <th>Référence</th>
        <th class="num">Débit</th>
        <th class="num">Crédit</th>
        <th class="num">Solde</th>
      </tr>
    </thead>
    <tbody>
        ${rows}
    </tbody>
    </table>
  </div>

  <div class="footer">
    <div>Généré le ${this.escapeHtml(new Date().toLocaleString('fr-FR'))}</div>
    <div class="muted">Relevé client • POS Pâtisserie</div>
  </div>
</body>
</html>`;
  }

  private escapeHtml(input: string): string {
    return String(input)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  private badgeClass(type: string): string {
    if (type === 'payment') return 'badge-payment';
    if (type === 'credit' || type === 'debt' || type === 'cash') return 'badge-credit';
    return 'badge';
  }

  private formatNumber3(value: number): string {
    return Number(value).toLocaleString('fr-FR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
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
    if (balance > 0) return 'text-green-600'; // Client has paid in advance
    if (balance < 0) return 'text-red-600';   // Client still owes money
    return 'text-gray-600';
  }

}
