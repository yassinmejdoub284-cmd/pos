import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { combineLatest } from 'rxjs';
import { SupplierService } from '../../core/services/supplier.service';
import { PrintService } from '../../core/services/print.service';
import { AuthService } from '../../core/services/auth.service';
import { 
  Supplier, 
  SupplierStatement, 
  SupplierStatementItem 
} from '../../core/models/supplier.model';

@Component({
  selector: 'app-supplier-statement-detail',
  templateUrl: './supplier-statement-detail.component.html',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule]
})
export class SupplierStatementDetailComponent implements OnInit {
  selectedSupplier: Supplier | null = null;
  statement: SupplierStatement | null = null;
  loading = false;
  isAdmin = false;
  
  // Filters
  filters = {
    supplierId: null as number | null,
    startDate: '',
    endDate: ''
  };

  constructor(
    private route: ActivatedRoute,
    public router: Router,
    private supplierService: SupplierService,
    private printService: PrintService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.isAdmin = this.authService.isAdmin();
    
    // Combine route params and query params
    combineLatest([this.route.params, this.route.queryParams]).subscribe(([routeParams, queryParams]) => {
      const supplierId = routeParams['id'];
      if (supplierId) {
        const id = parseInt(supplierId, 10);
        if (!isNaN(id)) {
          this.filters.supplierId = id;
        }
      }
      
      if (queryParams['startDate']) {
        this.filters.startDate = queryParams['startDate'];
      }
      if (queryParams['endDate']) {
        this.filters.endDate = queryParams['endDate'];
      }
      
      // Load statement and check for print parameter
      if (this.filters.supplierId) {
        this.loadStatement(queryParams['print']);
      }
    });
  }

  loadStatement(printType?: string): void {
    if (!this.filters.supplierId) {
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
        
        // Auto-print if requested
        if (printType) {
          setTimeout(() => {
            if (printType === 'a4') {
              this.printStatementA4();
            } else if (printType === 'thermal') {
              this.printStatementThermal();
            }
          }, 500);
        }
      },
      error: (error) => {
        console.error('Error loading statement:', error);
        this.loading = false;
        alert('Erreur lors du chargement du relevé');
        // Navigate back to summary if error
        this.router.navigate(['/supplier-statement']);
      }
    });
  }

  backToSummary(): void {
    this.router.navigate(['/supplier-statement']);
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
      'credit': 'Crédit',
      'debt': 'Dette initiale'
    };
    return types[type] || type;
  }

  getTransactionTypeColor(type: string): string {
    const colors: { [key: string]: string } = {
      'expense': 'text-red-600 bg-red-50',
      'payment': 'text-green-600 bg-green-50',
      'bon_entree': 'text-blue-600 bg-blue-50',
      'bon_retour': 'text-purple-600 bg-purple-50',
      'credit': 'text-orange-600 bg-orange-50',
      'debt': 'text-yellow-600 bg-yellow-50'
    };
    return colors[type] || 'text-gray-600 bg-gray-50';
  }

  onReferenceClick(item: SupplierStatementItem): void {
    if (item.clickable) {
      let bonId = item.bonId;
      
      if (!bonId && item.reference && item.reference.startsWith('Bon d\'entrée #')) {
        const match = item.reference.match(/Bon d'entrée #(\d+)/);
        if (match) {
          bonId = parseInt(match[1], 10);
        }
      }
      
      if (bonId) {
        const isBonRetour = item.type === 'bon_retour' || (item as any).documentType === 'BON_EXPEDITION';
        
        if (isBonRetour) {
          this.router.navigate(['/stock/documents/bon-retour/edit', bonId]);
        } else {
          this.router.navigate(['/stock/documents/bon-entree/edit', bonId]);
        }
      } else {
        alert(`Détails de ${item.reference}`);
      }
    }
  }

  printStatementA4(): void {
    if (!this.statement || !this.selectedSupplier) {
      alert('Aucun relevé à imprimer');
      return;
    }

    this.openPrintWindow();
  }

  printStatementThermal(): void {
    if (!this.statement || !this.selectedSupplier) {
      alert('Aucun relevé à imprimer');
      return;
    }

    this.printThermalStatement();
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
        <td><span class="badge ${this.badgeClass(item.type)}">${this.escapeHtml(this.getTransactionTypeLabel(item.type))}</span></td>
        <td>${this.escapeHtml(item.reference)}</td>
        <td class="num debit">${item.debit > 0 ? this.formatNumber3(item.debit) : ''}</td>
        <td class="num credit">${item.credit > 0 ? this.formatNumber3(item.credit) : ''}</td>
        <td class="num balance">${this.formatNumber3(item.balance)}</td>
      </tr>
    `).join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Relevé Fournisseur - ${this.escapeHtml(supplier.name)}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .header { text-align: center; margin-bottom: 30px; }
          .supplier-info { margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; font-weight: bold; }
          .num { text-align: right; }
          .debit { color: green; }
          .credit { color: red; }
          .balance { font-weight: bold; }
          .badge { padding: 2px 8px; border-radius: 4px; font-size: 0.85em; }
          .summary { margin-top: 30px; display: flex; justify-content: space-around; }
          .summary-item { text-align: center; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Relevé Fournisseur</h1>
          <p>Période: ${periodStart} - ${periodEnd}</p>
        </div>
        <div class="supplier-info">
          <h2>${this.escapeHtml(supplier.name)}</h2>
          ${supplier.phone ? `<p>Téléphone: ${this.escapeHtml(supplier.phone)}</p>` : ''}
          ${supplier.email ? `<p>Email: ${this.escapeHtml(supplier.email)}</p>` : ''}
        </div>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Référence</th>
              <th>Débit</th>
              <th>Crédit</th>
              <th>Solde</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
        <div class="summary">
          <div class="summary-item">
            <strong>Total Débit:</strong> ${this.formatNumber3(statement.totalDebit)} TND
          </div>
          <div class="summary-item">
            <strong>Total Crédit:</strong> ${this.formatNumber3(statement.totalCredit)} TND
          </div>
          <div class="summary-item">
            <strong>Solde Actuel:</strong> ${this.formatNumber3(statement.currentBalance)} TND
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  private formatNumber3(num: number): string {
    return num.toFixed(3);
  }

  private badgeClass(type: string): string {
    const classes: { [key: string]: string } = {
      'expense': 'badge-red',
      'payment': 'badge-green',
      'bon_entree': 'badge-blue',
      'bon_retour': 'badge-purple',
      'credit': 'badge-orange',
      'debt': 'badge-yellow'
    };
    return classes[type] || 'badge-gray';
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

  private generateCSV(): string {
    if (!this.statement) return '';

    const headers = ['Date', 'Type', 'Référence', 'Description', 'Débit', 'Crédit', 'Solde'];
    const rows = this.statement.statement.map(item => [
      this.formatDate(item.date),
      this.getTransactionTypeLabel(item.type),
      item.reference,
      item.description || '',
      item.debit > 0 ? item.debit.toFixed(3) : '',
      item.credit > 0 ? item.credit.toFixed(3) : '',
      item.balance.toFixed(3)
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    return csvContent;
  }

  canDeleteOperation(item: SupplierStatementItem): boolean {
    // Only allow deletion of certain operation types
    return item.type === 'payment' || item.type === 'expense';
  }

  deleteOperation(item: SupplierStatementItem): void {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer cette opération: ${item.reference}?`)) {
      return;
    }

    // Implement deletion logic here
    alert('Fonctionnalité de suppression à implémenter');
  }
}
