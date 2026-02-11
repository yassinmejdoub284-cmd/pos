import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { environment } from '../../environments/environment';
import { SupplierService } from '../core/services/supplier.service';
import { SessionsService, SessionCaisse } from '../core/services/sessions.service';
import { Supplier, SupplierPayment } from '../core/models/supplier.model';
import { ErrorDialogComponent } from '../shared/components/error-dialog/error-dialog.component';
import { ErrorDialogData } from '../core/services/error-handling.service';

@Component({
  selector: 'app-supplier-payments',
  templateUrl: './supplier-payments.component.html',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, ErrorDialogComponent]
})
export class SupplierPaymentsComponent implements OnInit {
  suppliers: Supplier[] = [];
  payments: SupplierPayment[] = [];
  selectedSupplier: Supplier | null = null;
  showPaymentForm = false;
  loading = false;
  currentSession: SessionCaisse | null = null;
  remainingCash: number | null = null;
  showErrorDialog = false;
  errorDialogData: ErrorDialogData | null = null;
  // Keep a local, always-fresh map of supplier debts sourced from summaries
  private supplierDebtMap: Record<number, number> = {};

  // Form data
  paymentForm = {
    supplierId: null as number | null,
    amount: null as number | null,
    notes: '',
    paymentMethod: 'CASH' as 'CASH' | 'CARD' | 'CHECK' | 'BANK_TRANSFER'
  };

  // Filters
  filters = {
    supplierId: null as number | null,
    startDate: '',
    endDate: '',
    showOnlyWithDebt: false
  };

  constructor(
    private http: HttpClient,
    private supplierService: SupplierService,
    private sessionsService: SessionsService
  ) { }

  ngOnInit(): void {
    this.loadSuppliers();
    this.loadSupplierDebts();
    this.loadPayments();
    this.sessionsService.getActiveSessionByDepot().subscribe(session => {
      this.currentSession = session;
      this.updateRemainingCash();
    });
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

  private loadSupplierDebts(): void {
    this.supplierService.getSupplierSummaries('', '').subscribe({
      next: (summaries) => {
        const map: Record<number, number> = {};
        for (const s of summaries) {
          map[s.id] = s.currentDebt ?? s.closingBalance ?? 0;
        }
        this.supplierDebtMap = map;
      },
      error: (error) => {
        console.error('Error loading supplier debts:', error);
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
      endDate: '',
      showOnlyWithDebt: false
    };
    this.selectedSupplier = null;
    this.loadPayments();
  }

  showAddPaymentForm(): void {
    this.showPaymentForm = true;
    this.paymentForm = {
      supplierId: null,
      amount: null,
      notes: '',
      paymentMethod: 'CASH'
    };
    this.updateRemainingCash();
  }

  hidePaymentForm(): void {
    this.showPaymentForm = false;
  }

  submitPayment(): void {
    if (!this.paymentForm.supplierId || !this.paymentForm.amount) {
      this.showError({
        title: 'Données manquantes',
        message: 'Veuillez sélectionner un fournisseur et saisir un montant',
        type: 'error'
      });
      return;
    }

    // Check if payment method is CASH and amount exceeds available cash
    if (this.paymentForm.paymentMethod === 'CASH' && this.currentSession) {
      const availableCash = this.currentSession.summary?.expectedCash || this.currentSession.expectedCash || 0;
      if (this.paymentForm.amount > availableCash) {
        this.showError({
          title: 'Montant insuffisant',
          message: `Montant insuffisant en caisse. Espèces disponibles: ${this.formatAmount(availableCash)}`,
          type: 'error'
        });
        return;
      }
    }

    this.loading = true;
    this.supplierService.createSupplierPayment({
      supplierId: this.paymentForm.supplierId,
      amount: this.paymentForm.amount,
      notes: this.paymentForm.notes,
      paymentMethod: this.paymentForm.paymentMethod
    }).subscribe({
      next: () => {
        this.loadPayments();
        this.loadSupplierDebts();
        this.hidePaymentForm();
        this.loading = false;
        this.showError({
          title: 'Succès',
          message: 'Règlement enregistré avec succès',
          type: 'info'
        });
        this.sessionsService.refreshCurrentSession();
      },
      error: (error) => {
        console.error('Error creating payment:', error);
        this.loading = false;
        this.showError({
          title: 'Erreur',
          message: 'Erreur lors de l\'enregistrement du règlement',
          type: 'error'
        });
      }
    });
  }

  updateRemainingCash(): void {
    if (this.currentSession?.summary) {
      this.remainingCash = this.currentSession.summary.expectedCash - (this.paymentForm.amount || 0);
    } else if (this.currentSession) {
      this.remainingCash = (this.currentSession.expectedCash || 0) - (this.paymentForm.amount || 0);
    } else {
      this.remainingCash = null;
    }
  }

  formatDate(date: Date | string): string {
    return new Date(date).toLocaleString('fr-FR');
  }

  formatAmount(amount: number): string {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'TND'
    }).format(amount);
  }

  showError(data: ErrorDialogData): void {
    this.errorDialogData = data;
    this.showErrorDialog = true;
  }

  closeErrorDialog(): void {
    this.showErrorDialog = false;
    this.errorDialogData = null;
  }

  get filteredSuppliers(): Supplier[] {
    const source = this.suppliers;
    if (this.filters.showOnlyWithDebt) {
      return source.filter(supplier => this.getSupplierDebt(supplier) > 0);
    }
    return source;
  }

  getSupplierDebt(supplier: Supplier): number {
    const computed = this.supplierDebtMap[supplier.id];
    if (typeof computed === 'number') {
      return computed;
    }
    return supplier.currentDebt ?? 0;
  }
}
