import { Component, Input, Output, EventEmitter, OnInit, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

interface PaymentDetails {
  id: number;
  amount: number;
  notes: string;
  createdAt: string;
  client: {
    id: number;
    code: string;
    firstName: string;
    lastName: string;
  };
  user: {
    id: number;
    firstName: string;
    lastName: string;
  };
}

@Component({
  selector: 'app-payment-dialog',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div *ngIf="isVisible" class="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" (click)="onBackdropClick($event)">
      <div class="bg-white rounded-2xl shadow-xl w-full max-w-2xl border border-amber-100/60 max-h-[90vh] overflow-y-auto" (click)="$event.stopPropagation()">
        <!-- Header -->
        <div class="p-6 border-b border-amber-100 bg-gradient-to-r from-green-50 to-emerald-50">
          <div class="flex items-center justify-between">
            <div class="flex items-center space-x-3">
              <div class="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg">
                <svg class="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
              </div>
              <div>
                <h3 class="text-xl font-bold text-green-800">Détails du Règlement</h3>
                <p class="text-sm text-green-600/70">Informations complètes du règlement client</p>
              </div>
            </div>
            <button (click)="close.emit()" 
                    class="p-2 hover:bg-white/50 rounded-lg transition-colors">
              <svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>
        </div>

        <!-- Loading State -->
        <div *ngIf="loading" class="p-8 text-center">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500 mx-auto"></div>
          <p class="text-green-600 mt-2">Chargement des détails...</p>
        </div>

        <!-- Error State -->
        <div *ngIf="error && !loading" class="p-8 text-center">
          <svg class="w-16 h-16 text-red-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
          </svg>
          <p class="text-red-600 mb-4">Erreur lors du chargement des détails</p>
          <button (click)="loadPaymentDetails()" 
                  class="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors">
            Réessayer
          </button>
        </div>

        <!-- Payment Details -->
        <div *ngIf="payment && !loading && !error" class="p-6 space-y-6">
          <!-- Payment Info Card -->
          <div class="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-6 border border-green-200">
            <div class="flex items-center justify-between mb-4">
              <h4 class="text-lg font-semibold text-green-800">Informations du Règlement</h4>
              <span class="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                Règlement #{{ payment.id }}
              </span>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-green-700 mb-1">Montant</label>
                <div class="text-2xl font-bold text-green-800">{{ formatAmount(payment.amount) }}</div>
              </div>
              <div>
                <label class="block text-sm font-medium text-green-700 mb-1">Date</label>
                <div class="text-lg font-semibold text-green-800">{{ formatDate(payment.createdAt) }}</div>
              </div>
            </div>
          </div>

          <!-- User Info Card -->
          <div class="bg-amber-50 rounded-xl p-6 border border-amber-200">
            <h4 class="text-lg font-semibold text-amber-800 mb-4">Enregistré par</h4>
            <div class="flex items-center space-x-3">
              <div class="w-10 h-10 bg-amber-500 rounded-full flex items-center justify-center">
                <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                </svg>
              </div>
              <div>
                <div class="text-lg font-semibold text-amber-800">
                  {{ payment.user.firstName }} {{ payment.user.lastName }}
                </div>
                <div class="text-sm text-amber-600">Utilisateur ID: {{ payment.user.id }}</div>
              </div>
            </div>
          </div>

          <!-- Notes Card -->
          <div *ngIf="payment.notes" class="flex gap-2 items-center bg-gray-50 rounded-xl p-6 border border-gray-200">
            <span class="text-lg font-semibold text-gray-800">Notes</span>
            <div class="text-gray-700">
              {{ payment.notes }}
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="p-6 border-t border-amber-100 bg-gray-50">
          <div class="flex justify-end space-x-3">
            <button (click)="close.emit()" 
                    class="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors">
              Fermer
            </button>
          </div>
        </div>
      </div>
    </div>
  `
})
export class PaymentDialogComponent implements OnInit, OnChanges {
  @Input() paymentId: number | null = null;
  @Input() isVisible = false;
  @Output() close = new EventEmitter<void>();

  payment: PaymentDetails | null = null;
  loading = false;
  error = false;

  constructor(private http: HttpClient) {}

  onBackdropClick(event: Event): void {
    if (event.target === event.currentTarget) {
      this.close.emit();
    }
  }

  ngOnInit(): void {
    if (this.paymentId && this.isVisible) {
      this.loadPaymentDetails();
    }
  }

  ngOnChanges(): void {
    if (this.paymentId && this.isVisible) {
      this.loadPaymentDetails();
    }
  }

  loadPaymentDetails(): void {
    if (!this.paymentId) return;

    this.loading = true;
    this.error = false;

    this.http.get<PaymentDetails>(`${environment.apiUrl}/client-payments/${this.paymentId}`).subscribe({
      next: (payment) => {
        this.payment = payment;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading payment details:', error);
        this.error = true;
        this.loading = false;
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
