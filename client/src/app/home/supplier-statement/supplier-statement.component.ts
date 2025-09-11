import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface Supplier {
  id: number;
  name: string;
  contactName?: string;
  phone?: string;
  email?: string;
  isActive: boolean;
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
  clickable?: boolean;
}

interface SupplierStatement {
  supplierId: number;
  statement: StatementItem[];
  totalDebit: number;
  totalCredit: number;
  currentBalance: number;
}

@Component({
  selector: 'app-supplier-statement',
  templateUrl: './supplier-statement.component.html',
  standalone: true,
  imports: [CommonModule, FormsModule]
})
export class SupplierStatementComponent implements OnInit {
  suppliers: Supplier[] = [];
  selectedSupplier: Supplier | null = null;
  statement: SupplierStatement | null = null;
  loading = false;
  
  // Filters
  filters = {
    supplierId: null as number | null,
    startDate: '',
    endDate: ''
  };

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadSuppliers();
  }

  loadSuppliers(): void {
    this.http.get<Supplier[]>(`${environment.apiUrl}/suppliers`).subscribe({
      next: (suppliers) => {
        this.suppliers = suppliers.filter(s => s.isActive);
      },
      error: (error) => {
        console.error('Error loading suppliers:', error);
      }
    });
  }

  loadStatement(): void {
    if (!this.filters.supplierId) {
      alert('Veuillez sélectionner un fournisseur');
      return;
    }

    this.loading = true;
    let url = `${environment.apiUrl}/supplier-payments/supplier/${this.filters.supplierId}/statement?`;
    const params = new URLSearchParams();
    
    if (this.filters.startDate) {
      params.append('startDate', this.filters.startDate);
    }
    if (this.filters.endDate) {
      params.append('endDate', this.filters.endDate);
    }
    
    url += params.toString();

    this.http.get<SupplierStatement>(url).subscribe({
      next: (statement) => {
        this.statement = statement;
        this.selectedSupplier = this.suppliers.find(s => s.id === this.filters.supplierId) || null;
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
      'expense': 'Dépense',
      'payment': 'Paiement'
    };
    return types[type] || type;
  }

  getTransactionTypeColor(type: string): string {
    const colors: { [key: string]: string } = {
      'expense': 'text-red-600 bg-red-50',
      'payment': 'text-green-600 bg-green-50'
    };
    return colors[type] || 'text-gray-600 bg-gray-50';
  }

  onReferenceClick(item: StatementItem): void {
    if (item.clickable && item.type === 'expense') {
      // Navigate to expense details or open modal
      console.log('Navigate to expense:', item.id);
      // You can implement navigation to expense details here
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
}
