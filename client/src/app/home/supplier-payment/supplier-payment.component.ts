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

interface SupplierPayment {
  id: number;
  supplierId: number;
  amount: number;
  paymentDate: string;
  paymentMethod: string;
  reference?: string;
  notes?: string;
  supplier: Supplier;
  user: {
    id: number;
    firstName: string;
    lastName: string;
  };
}

@Component({
  selector: 'app-supplier-payment',
  templateUrl: './supplier-payment.component.html',
  standalone: true,
  imports: [CommonModule, FormsModule]
})
export class SupplierPaymentComponent implements OnInit {
  suppliers: Supplier[] = [];
  payments: SupplierPayment[] = [];
  selectedSupplier: Supplier | null = null;
  showPaymentForm = false;
  loading = false;
  
  // Form data
  paymentForm = {
    supplierId: null as number | null,
    amount: null as number | null,
    paymentDate: new Date().toISOString().split('T')[0],
    paymentMethod: 'CASH',
    reference: '',
    notes: ''
  };

  // Filters
  filters = {
    supplierId: null as number | null,
    startDate: '',
    endDate: ''
  };

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadSuppliers();
    this.loadPayments();
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

  loadPayments(): void {
    this.loading = true;
    let url = `${environment.apiUrl}/supplier-payments?`;
    const params = new URLSearchParams();
    
    if (this.filters.supplierId) {
      params.append('supplierId', this.filters.supplierId.toString());
    }
    if (this.filters.startDate) {
      params.append('startDate', this.filters.startDate);
    }
    if (this.filters.endDate) {
      params.append('endDate', this.filters.endDate);
    }
    
    url += params.toString();

    this.http.get<SupplierPayment[]>(url).subscribe({
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

  openPaymentForm(supplier?: Supplier): void {
    if (supplier) {
      this.selectedSupplier = supplier;
      this.paymentForm.supplierId = supplier.id;
    } else {
      this.selectedSupplier = null;
      this.paymentForm.supplierId = null;
    }
    this.showPaymentForm = true;
  }

  closePaymentForm(): void {
    this.showPaymentForm = false;
    this.selectedSupplier = null;
    this.resetForm();
  }

  resetForm(): void {
    this.paymentForm = {
      supplierId: null,
      amount: null,
      paymentDate: new Date().toISOString().split('T')[0],
      paymentMethod: 'CASH',
      reference: '',
      notes: ''
    };
  }

  submitPayment(): void {
    if (!this.paymentForm.supplierId || !this.paymentForm.amount || !this.paymentForm.paymentDate) {
      alert('Veuillez remplir tous les champs obligatoires');
      return;
    }

    this.loading = true;
    this.http.post<SupplierPayment>(`${environment.apiUrl}/supplier-payments`, this.paymentForm).subscribe({
      next: (payment) => {
        this.payments.unshift(payment);
        this.closePaymentForm();
        this.loading = false;
        alert('Paiement enregistré avec succès');
      },
      error: (error) => {
        console.error('Error creating payment:', error);
        this.loading = false;
        alert('Erreur lors de l\'enregistrement du paiement');
      }
    });
  }

  applyFilters(): void {
    this.loadPayments();
  }

  clearFilters(): void {
    this.filters = {
      supplierId: null,
      startDate: '',
      endDate: ''
    };
    this.loadPayments();
  }

  getPaymentMethodLabel(method: string): string {
    const methods: { [key: string]: string } = {
      'CASH': 'Espèces',
      'CHECK': 'Chèque',
      'BANK_TRANSFER': 'Virement',
      'WIRE_TRANSFER': 'Virement bancaire'
    };
    return methods[method] || method;
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
}
