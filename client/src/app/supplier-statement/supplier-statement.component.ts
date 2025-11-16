import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router, RouterModule } from '@angular/router';
import { environment } from '../../environments/environment';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupplierService } from '../core/services/supplier.service';
import { PrintService } from '../core/services/print.service';
import { AuthService } from '../core/services/auth.service';
import { ExpenseService } from '../core/services/expense.service';
import { 
  Supplier, 
  SupplierStatement, 
  SupplierSummary, 
  SupplierStatementItem 
} from '../core/models/supplier.model';

@Component({
  selector: 'app-supplier-statement',
  templateUrl: './supplier-statement.component.html',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule]
})
export class SupplierStatementComponent implements OnInit {
  suppliers: Supplier[] = [];
  supplierSummaries: SupplierSummary[] = [];
  selectedSupplier: Supplier | null = null;
  statement: SupplierStatement | null = null;
  loading = false;
  showSummary = true;
  isAdmin = false;
  
  // Filters
  filters = {
    supplierId: null as number | null,
    startDate: '',
    endDate: ''
  };

  constructor(
    private http: HttpClient, 
    private router: Router,
    private supplierService: SupplierService,
    private printService: PrintService,
    private authService: AuthService,
    private expenseService: ExpenseService
  ) {}

  ngOnInit(): void {
    this.isAdmin = this.authService.isAdmin();
    this.loadSuppliers();
    this.loadSupplierSummaries();
  }

  loadSuppliers(): void {
    this.supplierService.getSuppliers().subscribe({
      next: (suppliers) => {
        this.suppliers = suppliers;
      },
      error: (error) => {
        console.error('Error loading suppliers:', error);
      }
    });
  }

  loadSupplierSummaries(): void {
    this.loading = true;
    this.supplierService.getSupplierSummaries(this.filters.startDate, this.filters.endDate).subscribe({
      next: (summaries) => {
        this.supplierSummaries = summaries;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading supplier summaries:', error);
        this.loading = false;
      }
    });
  }

  loadStatement(): void {
    if (!this.filters.supplierId) {
      alert('Veuillez sélectionner un fournisseur');
      return;
    }

    this.loading = true;
    this.supplierService.getSupplierStatement(
      this.filters.supplierId, 
      this.filters.startDate, 
      this.filters.endDate
    ).subscribe({
      next: (statement) => {
        this.statement = statement;
        this.selectedSupplier = statement.supplier;
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

  onSupplierChange(): void {
    this.statement = null;
    this.selectedSupplier = this.suppliers.find(s => s.id === this.filters.supplierId) || null;
  }

  clearFilters(): void {
    this.filters = {
      supplierId: null,
      startDate: '',
      endDate: ''
    };
    this.statement = null;
    this.selectedSupplier = null;
    this.showSummary = true;
  }

  backToSummary(): void {
    this.showSummary = true;
    this.statement = null;
    this.selectedSupplier = null;
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
      'expense': 'Dépense',
      'payment': 'Règlement',
      'bon_entree': 'Bon d\'entrée',
      'bon_retour': 'Bon de retour',
      'credit': 'Crédit'
    };
    return types[type] || type;
  }

  getTransactionTypeColor(type: string): string {
    const colors: { [key: string]: string } = {
      'expense': 'text-red-600 bg-red-50',
      'payment': 'text-green-600 bg-green-50',
      'bon_entree': 'text-blue-600 bg-blue-50',
      'bon_retour': 'text-purple-600 bg-purple-50',
      'credit': 'text-orange-600 bg-orange-50'
    };
    return colors[type] || 'text-gray-600 bg-gray-50';
  }

  onReferenceClick(item: SupplierStatementItem): void {
    if (item.clickable) {
      // If it's a bon d'entrée or bon de retour, navigate to the document edit page
      if (item.bonId) {
        // Check if it's a bon de retour (type is 'bon_retour' or documentType is 'BON_EXPEDITION')
        const isBonRetour = item.type === 'bon_retour' || (item as any).documentType === 'BON_EXPEDITION';
        
        if (isBonRetour) {
          // Navigate to bon de retour document edit page
          this.router.navigate(['/stock/documents/bon-retour/edit', item.bonId]);
        } else {
          // Navigate to bon d'entrée document edit page
          this.router.navigate(['/stock/documents/bon-entree/edit', item.bonId]);
        }
      } else {
        // For other references, show an alert for now
        alert(`Détails de ${item.reference}`);
      }
    }
  }

  exportStatement(): void {
    if (!this.statement || !this.selectedSupplier) {
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
    link.setAttribute('download', `releve_fournisseur_${this.selectedSupplier.name}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  printStatementA4(): void {
    if (!this.filters.supplierId) {
      alert('Veuillez sélectionner un fournisseur');
      return;
    }

    const useCurrent = this.statement && this.selectedSupplier && this.selectedSupplier.id === this.filters.supplierId;
    if (useCurrent) {
      this.openPrintWindow();
      return;
    }

    this.loading = true;
    this.supplierService.getSupplierStatement(
      this.filters.supplierId,
      this.filters.startDate,
      this.filters.endDate
    ).subscribe({
      next: (statement) => {
        this.statement = statement;
        this.selectedSupplier = statement.supplier;
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

  printStatementThermal(): void {
    if (!this.filters.supplierId) {
      alert('Veuillez sélectionner un fournisseur');
      return;
    }

    const useCurrent = this.statement && this.selectedSupplier && this.selectedSupplier.id === this.filters.supplierId;
    if (useCurrent) {
      this.printThermalStatement();
      return;
    }

    this.loading = true;
    this.supplierService.getSupplierStatement(
      this.filters.supplierId,
      this.filters.startDate,
      this.filters.endDate
    ).subscribe({
      next: (statement) => {
        this.statement = statement;
        this.selectedSupplier = statement.supplier;
        this.loading = false;
        this.printThermalStatement();
      },
      error: (error) => {
        console.error('Error loading statement for print:', error);
        this.loading = false;
        alert('Erreur lors du chargement du relevé pour impression');
      }
    });
  }

  private printThermalStatement(): void {
    if (!this.statement || !this.selectedSupplier) {
      alert('Aucun relevé à imprimer');
      return;
    }

    const text = this.printService.buildSupplierStatementText(
      this.statement,
      this.selectedSupplier,
      this.filters.startDate,
      this.filters.endDate
    );

    this.printService.printPlainText(text).catch(error => {
      console.error('Error printing statement:', error);
      alert('Erreur lors de l\'impression: ' + (error.message || 'Erreur inconnue'));
    });
  }

  private openPrintWindow(): void {
    if (!this.statement || !this.selectedSupplier) {
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
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
      printWindow.close();
    }, 250);
  }

  private buildA4Html(): string {
    const supplier = this.selectedSupplier!;
    const statement = this.statement!;
    const periodStart = this.filters.startDate ? this.formatDate(this.filters.startDate) : 'Début';
    const periodEnd = this.filters.endDate ? this.formatDate(this.filters.endDate) : 'Aujourd\'hui';

    const rows = statement.statement.map(item => `
      <tr>
        <td>${this.escapeHtml(new Date(item.date).toLocaleDateString('fr-FR'))}</td>
        <td><span class=\"badge ${this.badgeClass(item.type)}\">${this.escapeHtml(this.getTransactionTypeLabel(item.type))}</span></td>
        <td>${this.escapeHtml(item.reference)}</td>
        <td class=\"num debit\">${item.debit > 0 ? this.formatNumber3(item.debit) : ''}</td>
        <td class=\"num credit\">${item.credit > 0 ? this.formatNumber3(item.credit) : ''}</td>
        <td class=\"num ${item.balance >= 0 ? 'balance-pos' : 'balance-neg'}\">${this.formatNumber3(item.balance)}</td>
      </tr>
    `).join('');

    return `<!doctype html>
<html lang=\"fr\">
<head>
  <meta charset=\"utf-8\" />
  <title>Relevé Fournisseur - ${this.escapeHtml(supplier.name)}</title>
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
    .val.debit { color: #16a34a; }
    .val.credit { color: #b91c1c; }
    .val.balance-pos { color: #16a34a; }
    .val.balance-neg { color: #b91c1c; }
    table { width: 100%; border-collapse: collapse; }
    thead { display: table-header-group; }
    thead th { background: #fff7ed; color: #9a3412; font-size: 12px; text-align: left; padding: 3mm; border: 1px solid #e2e8f0; }
    tbody td { font-size: 12px; padding: 3mm; border: 1px solid #e2e8f0; }
    tbody tr:nth-child(odd) { background: #fafafa; }
    td.num { text-align: right; font-variant-numeric: tabular-nums; }
    td.debit { color: #16a34a; font-weight: 600; }
    td.credit { color: #b91c1c; font-weight: 600; }
    td.balance-pos { color: #16a34a; font-weight: 700; }
    td.balance-neg { color: #b91c1c; font-weight: 700; }
    .badge { display: inline-block; padding: 2px 6px; border-radius: 9999px; font-size: 11px; font-weight: 600; border: 1px solid transparent; }
    .badge-expense { color: #b91c1c; background: #fee2e2; border-color: #fca5a5; }
    .badge-payment { color: #065f46; background: #d1fae5; border-color: #34d399; }
    .badge-bon_entree { color: #1d4ed8; background: #dbeafe; border-color: #93c5fd; }
    .badge-bon_retour { color: #7c3aed; background: #ede9fe; border-color: #a78bfa; }
    .badge-credit { color: #9a3412; background: #ffedd5; border-color: #fdba74; }
    tr { page-break-inside: avoid; }
    .footer { position: fixed; bottom: 8mm; left: 12mm; right: 12mm; font-size: 11px; color: #64748b; display: flex; justify-content: space-between; }
    @media print { .no-print { display: none; } }
  </style>
</head>
<body>
  <div class=\"sheet\">
    <div class=\"header\">
      <div>
        <div class=\"company\">POS Pâtisserie</div>
        <h1>Relevé Fournisseur</h1>
        <div class=\"muted\">${this.escapeHtml(supplier.name)}</div>
      </div>
      <div class=\"muted\">Période: ${this.escapeHtml(periodStart)} - ${this.escapeHtml(periodEnd)}</div>
    </div>

    <div class=\"summary\">
      <div class=\"card\"><h4>Total Débit</h4><div class=\"val debit\">${this.formatNumber3(statement.totalDebit)}</div></div>
      <div class=\"card\"><h4>Total Crédit</h4><div class=\"val credit\">${this.formatNumber3(statement.totalCredit)}</div></div>
      <div class=\"card\"><h4>Solde Actuel</h4><div class=\"val ${statement.currentBalance >= 0 ? 'balance-pos' : 'balance-neg'}\">${this.formatNumber3(statement.currentBalance)}</div></div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Type</th>
          <th>Référence</th>
          <th class=\"num\">Débit</th>
          <th class=\"num\">Crédit</th>
          <th class=\"num\">Solde</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  </div>

  <div class=\"footer\">
    <div>Généré le ${this.escapeHtml(new Date().toLocaleString('fr-FR'))}</div>
    <div class=\"muted\">Relevé fournisseur • POS Pâtisserie</div>
  </div>
</body>
</html>`;
  }

  private escapeHtml(input: string): string {
    return String(input)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  private badgeClass(type: string): string {
    if (type === 'expense') return 'badge-expense';
    if (type === 'payment') return 'badge-payment';
    if (type === 'bon_entree') return 'badge-bon_entree';
    if (type === 'bon_retour') return 'badge-bon_retour';
    if (type === 'credit') return 'badge-credit';
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

  getBalanceColor(balance: number): string {
    if (balance > 0) return 'text-red-600'; // We owe money to supplier
    if (balance < 0) return 'text-green-600'; // We have credit with supplier
    return 'text-gray-600';
  }

  canDeleteOperation(item: SupplierStatementItem): boolean {
    // Only admin can delete operations
    if (!this.isAdmin) return false;
    
    // Can delete payments (supplier payments) and expenses
    // Check by type and reference pattern
    const isPayment = item.type === 'payment' && item.reference.startsWith('PAYMENT-');
    const isExpense = (item.type === 'expense' || 
                      item.type === 'advance' || 
                      item.type === 'paid' || 
                      item.type === 'unpaid') && 
                      item.reference.startsWith('EXPENSE-');
    
    return isPayment || isExpense;
  }

  deleteOperation(item: SupplierStatementItem): void {
    if (!this.canDeleteOperation(item)) {
      return;
    }

    const operationType = this.getTransactionTypeLabel(item.type);
    if (!confirm(`Êtes-vous sûr de vouloir supprimer cette opération : ${operationType} - ${item.reference} ?`)) {
      return;
    }

    this.loading = true;

    // Check by reference pattern to determine the type
    if (item.reference.startsWith('PAYMENT-')) {
      // Delete supplier payment
      this.supplierService.deleteSupplierPayment(item.id).subscribe({
        next: () => {
          alert('Règlement supprimé avec succès');
          this.loadStatement(); // Reload statement
        },
        error: (error) => {
          console.error('Error deleting payment:', error);
          this.loading = false;
          alert('Erreur lors de la suppression du règlement');
        }
      });
    } else if (item.reference.startsWith('EXPENSE-')) {
      // Delete expense
      this.expenseService.deleteExpense(item.id).subscribe({
        next: () => {
          alert('Dépense supprimée avec succès');
          this.loadStatement(); // Reload statement
        },
        error: (error) => {
          console.error('Error deleting expense:', error);
          this.loading = false;
          alert('Erreur lors de la suppression de la dépense');
        }
      });
    } else {
      this.loading = false;
      alert('Cette opération ne peut pas être supprimée');
    }
  }
}
