import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { environment } from '../../environments/environment';
import { SupplierService } from '../core/services/supplier.service';
import { Supplier, SupplierPayment } from '../core/models/supplier.model';

@Component({
  selector: 'app-supplier-payments',
  templateUrl: './supplier-payments.component.html',
  standalone: true, 
  imports: [CommonModule, FormsModule, RouterModule]
})
export class SupplierPaymentsComponent implements OnInit {
  suppliers: Supplier[] = [];
  payments: SupplierPayment[] = [];
  selectedSupplier: Supplier | null = null;
  showPaymentForm = false;
  loading = false;
  
  // Form data
  paymentForm = {
    supplierId: null as number | null,
    amount: null as number | null,
    notes: ''
  };

  // Filters
  filters = {
    supplierId: null as number | null,
    startDate: '',
    endDate: ''
  };

  constructor(
    private http: HttpClient,
    private supplierService: SupplierService
  ) {}

  ngOnInit(): void {
    this.loadSuppliers();
    this.loadPayments();
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

  loadPayments(): void {
    this.loading = true;
    this.supplierService.getSupplierPayments(
      this.filters.supplierId || undefined,
      this.filters.startDate || undefined,
      this.filters.endDate || undefined
    ).subscribe({
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

  onSupplierChange(): void {
    this.selectedSupplier = this.suppliers.find(s => s.id === this.filters.supplierId) || null;
  }

  clearFilters(): void {
    this.filters = {
      supplierId: null,
      startDate: '',
      endDate: ''
    };
    this.selectedSupplier = null;
    this.loadPayments();
  }

  showAddPaymentForm(): void {
    this.showPaymentForm = true;
    this.paymentForm = {
      supplierId: null,
      amount: null,
      notes: ''
    };
  }

  hidePaymentForm(): void {
    this.showPaymentForm = false;
  }

  submitPayment(): void {
    if (!this.paymentForm.supplierId || !this.paymentForm.amount) {
      alert('Veuillez sélectionner un fournisseur et saisir un montant');
      return;
    }

    this.loading = true;
    this.supplierService.createSupplierPayment({
      supplierId: this.paymentForm.supplierId,
      amount: this.paymentForm.amount,
      notes: this.paymentForm.notes
    }).subscribe({
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
}
