import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

interface Client {
  id: number;
  code: string;
  name: string;
  phone: string;
  email: string;
  currentDebt: number;
}

interface Supplier {
  id: number;
  name: string;
  contactName: string;
  phone: string;
  email: string;
  taxNumber: string;
}

interface ClientStatement {
  client: {
    id: number;
    code: string;
    name: string;
    phone: string;
    email: string;
    address: string;
    currentDebt: number;
  };
  period: {
    startDate: string;
    endDate: string;
  };
  summary: {
    totalSales: number;
    totalPaid: number;
    totalDebt: number;
    balance: number;
  };
  transactions: Array<{
    id: number;
    type: string;
    date: string;
    description: string;
    amount: number;
    depot: string;
    balance: number;
  }>;
}

interface SupplierStatement {
  supplier: {
    id: number;
    name: string;
    contactName: string;
    phone: string;
    email: string;
    address: string;
    taxNumber: string;
  };
  period: {
    startDate: string;
    endDate: string;
  };
  summary: {
    totalExpenses: number;
    totalPaid: number;
    totalUnpaid: number;
    balance: number;
  };
  transactions: Array<{
    id: number;
    type: string;
    date: string;
    description: string;
    amount: number;
    category: string;
    depot: string;
    isPaid: boolean;
    paidAt: string;
    dueDate: string;
  }>;
}

@Component({
  selector: 'app-finance',
  templateUrl: './finance.component.html',
  standalone: false
})
export class FinanceComponent implements OnInit {
  loading = false;
  error = '';
  activeTab: 'client' | 'supplier' = 'client';
  
  // Client statement
  clients: Client[] = [];
  selectedClientId: number | null = null;
  clientStatement: ClientStatement | null = null;
  
  // Supplier statement
  suppliers: Supplier[] = [];
  selectedSupplierId: number | null = null;
  supplierStatement: SupplierStatement | null = null;
  
  // Filters
  startDate = '';
  endDate = '';
  depotId = 'all';
  
  depots = [
    { id: 'all', name: 'Tous' },
    { id: '1', name: 'Pt Vte Sfax' },
    { id: '2', name: 'Pt Vte Tunis' },
    { id: '3', name: 'Atelier' },
    { id: '4', name: 'Dépôt Tunis' }
  ];

  constructor(
    private router: Router,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    // Set default date range (last 30 days)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    
    this.startDate = startDate.toISOString().split('T')[0];
    this.endDate = endDate.toISOString().split('T')[0];
    
    this.loadClients();
    this.loadSuppliers();
  }

  loadClients(): void {
    this.http.get<Client[]>(`${environment.apiUrl}/reports/clients`)
      .subscribe({
        next: (data) => {
          this.clients = data;
        },
        error: (error) => {
          console.error('Error loading clients:', error);
        }
      });
  }

  loadSuppliers(): void {
    this.http.get<Supplier[]>(`${environment.apiUrl}/reports/suppliers`)
      .subscribe({
        next: (data) => {
          this.suppliers = data;
        },
        error: (error) => {
          console.error('Error loading suppliers:', error);
        }
      });
  }

  generateClientStatement(): void {
    if (!this.selectedClientId) {
      this.error = 'Veuillez sélectionner un client';
      return;
    }

    this.loading = true;
    this.error = '';
    
    const params = {
      clientId: this.selectedClientId.toString(),
      startDate: this.startDate,
      endDate: this.endDate,
      depotId: this.depotId === 'all' ? '' : this.depotId
    };

    this.http.get<ClientStatement>(`${environment.apiUrl}/reports/client-statement`, { params })
      .subscribe({
        next: (data) => {
          this.clientStatement = data;
          this.loading = false;
        },
        error: (error) => {
          this.error = 'Erreur lors du chargement du relevé client';
          this.loading = false;
          console.error('Error loading client statement:', error);
        }
      });
  }

  generateSupplierStatement(): void {
    if (!this.selectedSupplierId) {
      this.error = 'Veuillez sélectionner un fournisseur';
      return;
    }

    this.loading = true;
    this.error = '';
    
    const params = {
      supplierId: this.selectedSupplierId.toString(),
      startDate: this.startDate,
      endDate: this.endDate,
      depotId: this.depotId === 'all' ? '' : this.depotId
    };

    this.http.get<SupplierStatement>(`${environment.apiUrl}/reports/supplier-statement`, { params })
      .subscribe({
        next: (data) => {
          this.supplierStatement = data;
          this.loading = false;
        },
        error: (error) => {
          this.error = 'Erreur lors du chargement du relevé fournisseur';
          this.loading = false;
          console.error('Error loading supplier statement:', error);
        }
      });
  }

  onTabChange(tab: 'client' | 'supplier'): void {
    this.activeTab = tab;
    this.error = '';
    this.clientStatement = null;
    this.supplierStatement = null;
  }

  goBack(): void {
    this.router.navigate(['/rapports']);
  }

  printStatement(): void {
    window.print();
  }

  exportToExcel(): void {
    let csvContent = '';
    let filename = '';

    if (this.activeTab === 'client' && this.clientStatement) {
      filename = `releve_client_${this.clientStatement.client.code}_${this.startDate}_${this.endDate}.csv`;
      
      const headers = ['Date', 'Type', 'Description', 'Montant', 'Solde', 'Site'];
      csvContent = [
        headers.join(','),
        ...this.clientStatement.transactions.map(t => [
          new Date(t.date).toLocaleDateString('fr-FR'),
          t.type,
          t.description,
          t.amount.toFixed(3),
          t.balance.toFixed(3),
          t.depot || ''
        ].join(','))
      ].join('\n');
    } else if (this.activeTab === 'supplier' && this.supplierStatement) {
      filename = `releve_fournisseur_${this.supplierStatement.supplier.name.replace(/\s+/g, '_')}_${this.startDate}_${this.endDate}.csv`;
      
      const headers = ['Date', 'Description', 'Catégorie', 'Montant', 'Statut', 'Site', 'Date Échéance'];
      csvContent = [
        headers.join(','),
        ...this.supplierStatement.transactions.map(t => [
          new Date(t.date).toLocaleDateString('fr-FR'),
          t.description,
          t.category,
          t.amount.toFixed(3),
          t.isPaid ? 'Payé' : 'Non Payé',
          t.depot,
          t.dueDate ? new Date(t.dueDate).toLocaleDateString('fr-FR') : ''
        ].join(','))
      ].join('\n');
    }

    if (csvContent) {
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }
}
