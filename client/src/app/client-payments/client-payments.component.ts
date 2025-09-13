import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { environment } from '../../environments/environment';

interface Client {
  id: number;
  code: string;
  firstName: string;
  lastName: string;
  currentDebt?: number;
}

interface ClientForPayment {
  id: number;
  code: string;
  firstName: string;
  lastName: string;
}

interface ClientPayment {
  id: number;
  amount: number;
  notes: string;
  createdAt: string;
  client: ClientForPayment;
  user: {
    id: number;
    firstName: string;
    lastName: string;
  };
}

@Component({
  selector: 'app-client-payments',
  templateUrl: './client-payments.component.html',
  standalone: true, 
  imports: [CommonModule, FormsModule]
})
export class ClientPaymentsComponent implements OnInit {
  clients: Client[] = [];
  payments: ClientPayment[] = [];
  selectedClient: Client | null = null;
  showPaymentForm = false;
  loading = false;
  
  // Form data
  paymentForm = {
    clientId: null as number | null,
    amount: null as number | null,
    notes: ''
  };

  // Filters
  filters = {
    clientId: null as number | null,
    startDate: '',
    endDate: ''
  };

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadClients();
    this.loadPayments();
  }

  loadClients(): void {
    this.http.get<{clients: Client[]}>(`${environment.apiUrl}/clients`).subscribe({
      next: (response) => {
        this.clients = response.clients;
      },
      error: (error) => {
        console.error('Error loading clients:', error);
      }
    });
  }

  loadPayments(): void {
    this.loading = true;
    let url = `${environment.apiUrl}/client-payments?`;
    const params = new URLSearchParams();
    
    if (this.filters.clientId) {
      params.append('clientId', this.filters.clientId.toString());
    }
    if (this.filters.startDate) {
      params.append('startDate', this.filters.startDate);
    }
    if (this.filters.endDate) {
      params.append('endDate', this.filters.endDate);
    }
    
    url += params.toString();

    this.http.get<ClientPayment[]>(url).subscribe({
      next: (payments) => {
        this.payments = payments;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading payments:', error);
        this.loading = false;
      }
    });
  }

  onClientChange(): void {
    this.selectedClient = this.clients.find(c => c.id === this.filters.clientId) || null;
  }

  clearFilters(): void {
    this.filters = {
      clientId: null,
      startDate: '',
      endDate: ''
    };
    this.selectedClient = null;
    this.loadPayments();
  }

  showAddPaymentForm(): void {
    this.showPaymentForm = true;
    this.paymentForm = {
      clientId: null,
      amount: null,
      notes: ''
    };
  }

  hidePaymentForm(): void {
    this.showPaymentForm = false;
  }

  submitPayment(): void {
    if (!this.paymentForm.clientId || !this.paymentForm.amount) {
      alert('Veuillez sélectionner un client et saisir un montant');
      return;
    }

    this.loading = true;
    this.http.post(`${environment.apiUrl}/client-payments`, this.paymentForm).subscribe({
      next: () => {
        this.loadPayments();
        this.hidePaymentForm();
        this.loading = false;
        alert('Règlement enregistré avec succès');
      },
      error: (error) => {
        console.error('Error creating payment:', error);
        this.loading = false;
        alert('Erreur lors de l\'enregistrement du règlement');
      }
    });
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleString('fr-FR');
  }

  formatAmount(amount: number): string {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'TND'
    }).format(amount);
  }

  getClientFullName(client: Client | ClientForPayment): string {
    return `${client.firstName} ${client.lastName}`;
  }
}
