import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router, RouterModule } from '@angular/router';
import { environment } from '../../environments/environment';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupplierService } from '../core/services/supplier.service';
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
  
  // Filters
  filters = {
    supplierId: null as number | null,
    startDate: '',
    endDate: ''
  };

  constructor(
    private http: HttpClient, 
    private router: Router,
    private supplierService: SupplierService
  ) {}

  ngOnInit(): void {
    this.loadSupplierSummaries();
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
      'payment': 'Règlement'
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

  onReferenceClick(item: SupplierStatementItem): void {
    if (item.clickable) {
      // For now, just show an alert. Later we can add expense detail dialog
      alert(`Détails de ${item.reference}`);
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

  getBalanceColor(balance: number): string {
    if (balance > 0) return 'text-red-600'; // We owe money to supplier
    if (balance < 0) return 'text-green-600'; // We have credit with supplier
    return 'text-gray-600';
  }
}
