import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Sale } from '../../core/models/sale.model';

@Component({
  selector: 'app-ticket-details-modal',
  imports: [CommonModule],
  template: `
    <div class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" (click)="onBackdropClick($event)">
      <div class="bg-white rounded-2xl border border-blue-100/50 max-w-4xl w-full max-h-[90vh] shadow-2xl ring-1 ring-blue-50 overflow-hidden">
        <!-- Header -->
        <div class="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 border-b border-blue-200/60">
          <div class="flex items-center justify-between">
            <div class="flex items-center space-x-4">
              <div class="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg ring-2 ring-blue-100">
                <svg class="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                </svg>
              </div>
              <div>
                <h2 class="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  Détails du Ticket #{{ getDisplayTicketNumber() }}
                </h2>
                <p class="text-sm text-blue-600/70 font-medium">{{ ticket?.createdAt | date:'medium' }}</p>
              </div>
            </div>
            <button (click)="onClose()" 
              title="Fermer"
              class="p-2 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-xl transition-all duration-200 hover:scale-95">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>
        </div>

        <!-- Content -->
        <div class="overflow-y-auto max-h-[calc(90vh-200px)]">
          <!-- Ticket Info -->
          <div class="p-6 bg-gray-50 border-b border-gray-200">
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
              <!-- Ticket Number & Status -->
              <div class="space-y-2">
                <div class="text-sm font-medium text-gray-500">Numéro de Ticket</div>
                <div class="font-mono text-2xl font-bold text-blue-600">#{{ getDisplayTicketNumber() }}</div>
                <div class="flex items-center space-x-2">
                  <span class="px-3 py-1 rounded-full text-sm font-medium"
                        [class]="getStatusClass(ticket?.status || '')">
                    {{ getStatusText(ticket?.status || '') }}
                  </span>
                  <span *ngIf="ticket?.dailyTicketNumber" class="text-sm text-gray-500">
                    ({{ ticket?.dailyTicketNumber }})
                  </span>
                </div>
              </div>

              <!-- Customer Info -->
              <div class="space-y-2">
                <div class="text-sm font-medium text-gray-500">Client</div>
                <div *ngIf="ticket?.client" class="font-semibold text-gray-900">
                  {{ ticket?.client?.firstName }} {{ ticket?.client?.lastName }}
                </div>
                <div *ngIf="ticket?.client?.code" class="text-sm text-gray-600">
                  Code: {{ ticket?.client?.code }}
                </div>
                <div *ngIf="!ticket?.client" class="text-gray-500 italic">
                  Passager
                </div>
              </div>

              <!-- Cashier Info -->
              <div class="space-y-2">
                <div class="text-sm font-medium text-gray-500">Caissier</div>
                <div *ngIf="ticket?.user" class="font-semibold text-gray-900">
                  {{ ticket?.user?.firstName }} {{ ticket?.user?.lastName }}
                </div>
                <div class="text-sm text-gray-600">
                  {{ ticket?.createdAt | date:'short' }}
                </div>
              </div>
            </div>
          </div>

          <!-- Items -->
          <div class="p-6">
            <h3 class="text-lg font-semibold text-gray-900 mb-4">Articles</h3>
            <div class="space-y-3">
              <div *ngFor="let item of ticket?.items" 
                   class="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                <div class="flex justify-between items-start">
                  <div class="flex-1">
                    <div class="font-semibold text-gray-900">{{ item.productName }}</div>
                    <div class="text-sm text-gray-600 mt-1">
                      <span>{{ item.quantity }} × {{ item.unitPrice | number:'1.2-2' }} dt</span>
                      <span *ngIf="item.isWholesale" class="ml-2 px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                        Gros
                      </span>
                      <span *ngIf="item.isApproved" class="ml-2 px-2 py-1 bg-green-100 text-green-700 rounded text-xs">
                        Approuvé
                      </span>
                    </div>
                    <div *ngIf="item.bundleQuantity && item.bundleSize" class="text-xs text-gray-500 mt-1">
                      Lot: {{ item.bundleQuantity }} × {{ item.bundleSize }} = {{ item.bundleQuantity * item.bundleSize }} unités
                    </div>
                    <div *ngIf="item.marginPercent" class="text-xs text-gray-500">
                      Marge: {{ item.marginPercent }}%
                    </div>
                  </div>
                  <div class="text-right">
                    <div class="font-semibold text-gray-900">{{ item.total | number:'1.2-2' }} dt</div>
                    <div *ngIf="item.discount > 0" class="text-sm text-red-600">
                      -{{ item.discount | number:'1.2-2' }} dt
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Payment Info -->
          <div class="p-6 bg-gray-50 border-t border-gray-200">
            <h3 class="text-lg font-semibold text-gray-900 mb-4">Paiement</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <!-- Payment Method -->
              <div class="space-y-3">
                <div class="flex justify-between">
                  <span class="text-gray-600">Type de paiement:</span>
                  <span class="font-semibold" [class]="getPaymentTypeClass(ticket?.paymentType)">
                    {{ getPaymentTypeText(ticket?.paymentType) }}
                  </span>
                </div>
                <div *ngIf="ticket?.paymentMethod" class="flex justify-between">
                  <span class="text-gray-600">Méthode:</span>
                  <span class="font-semibold">{{ ticket?.paymentMethod?.name }}</span>
                </div>
                <div *ngIf="ticket?.advancePayment && (ticket?.advancePayment ?? 0) > 0" class="flex justify-between">
                  <span class="text-gray-600">Acompte:</span>
                  <span class="font-semibold text-blue-600">{{ ticket?.advancePayment | number:'1.2-2' }} dt</span>
                </div>
                <div *ngIf="ticket?.advancePaymentMethod" class="flex justify-between">
                  <span class="text-gray-600">Méthode acompte:</span>
                  <span class="font-semibold">{{ ticket?.advancePaymentMethod?.name }}</span>
                </div>
              </div>

              <!-- Totals -->
              <div class="space-y-3">
                <div class="flex justify-between">
                  <span class="text-gray-600">Sous-total:</span>
                  <span class="font-semibold">{{ ticket?.total | number:'1.2-2' }} dt</span>
                </div>
                <div *ngIf="ticket?.discount && (ticket?.discount ?? 0) > 0" class="flex justify-between">
                  <span class="text-gray-600">Remise:</span>
                  <span class="font-semibold text-red-600">-{{ ticket?.discount | number:'1.2-2' }} dt</span>
                </div>
                <div *ngIf="ticket?.tax && (ticket?.tax ?? 0) > 0" class="flex justify-between">
                  <span class="text-gray-600">TVA:</span>
                  <span class="font-semibold">{{ ticket?.tax | number:'1.2-2' }} dt</span>
                </div>
                <div class="flex justify-between text-lg font-bold border-t border-gray-300 pt-2">
                  <span>Total:</span>
                  <span class="text-blue-600">{{ ticket?.finalTotal | number:'1.2-2' }} dt</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Additional Info -->
          <div *ngIf="ticket?.notes || ticket?.expectedDate || ticket?.loyaltyPointsEarned" class="p-6 border-t border-gray-200">
            <h3 class="text-lg font-semibold text-gray-900 mb-4">Informations supplémentaires</h3>
            <div class="space-y-3">
              <div *ngIf="ticket?.notes" class="flex justify-between">
                <span class="text-gray-600">Notes:</span>
                <span class="font-semibold text-right max-w-md">{{ ticket?.notes }}</span>
              </div>
              <div *ngIf="ticket?.expectedDate" class="flex justify-between">
                <span class="text-gray-600">Date prévue:</span>
                <span class="font-semibold">{{ ticket?.expectedDate | date:'medium' }}</span>
              </div>
              <div *ngIf="ticket?.loyaltyPointsEarned && (ticket?.loyaltyPointsEarned ?? 0) > 0" class="flex justify-between">
                <span class="text-gray-600">Points de fidélité:</span>
                <span class="font-semibold text-green-600">+{{ ticket?.loyaltyPointsEarned }} pts</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Sticky Footer -->
        <div class="sticky bottom-0 bg-gradient-to-r from-blue-50/95 to-indigo-50/95 backdrop-blur-sm p-4 border-t border-blue-200/60 shadow-lg">
          <div class="flex justify-center space-x-3">
            <button (click)="onPrint()" 
              class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all duration-200 hover:scale-95 shadow-sm text-sm">
              <svg class="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path>
              </svg>
              Imprimer
            </button>
            <button (click)="onReturnExchange()" 
              class="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-all duration-200 hover:scale-95 shadow-sm text-sm">
              <svg class="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"></path>
              </svg>
              Retour / Échange
            </button>
            <button (click)="onClose()" 
              class="px-4 py-2 bg-white/90 hover:bg-white text-blue-700 rounded-lg transition-all duration-200 hover:scale-95 shadow-sm border border-blue-200/50 text-sm">
              Fermer
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }
  `],
  standalone: true
})
export class TicketDetailsModalComponent {
  @Input() ticket: Sale | null = null;
  @Output() closed = new EventEmitter<void>();
  @Output() printRequested = new EventEmitter<Sale>();
  @Output() returnExchangeRequested = new EventEmitter<Sale>();

  onClose(): void {
    this.closed.emit();
  }

  onPrint(): void {
    if (this.ticket) {
      this.printRequested.emit(this.ticket);
    }
  }

  onReturnExchange(): void {
    if (this.ticket) {
      this.returnExchangeRequested.emit(this.ticket);
    }
  }


  onBackdropClick(event: Event): void {
    if (event.target === event.currentTarget) {
      this.onClose();
    }
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'COMPLETED':
        return 'bg-green-100 text-green-700';
      case 'TEMPORARY':
        return 'bg-yellow-100 text-yellow-700';
      case 'PENDING':
        return 'bg-orange-100 text-orange-700';
      case 'CANCELLED':
        return 'bg-red-100 text-red-700';
      case 'REFUNDED':
        return 'bg-purple-100 text-purple-700';
      case 'PENDING_ADMIN':
        return 'bg-blue-100 text-blue-700';
      case 'CADEAU':
        return 'bg-pink-100 text-pink-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  }

  getStatusText(status: string): string {
    switch (status) {
      case 'COMPLETED':
        return 'Terminé';
      case 'TEMPORARY':
        return 'Temporaire';
      case 'PENDING':
        return 'En attente';
      case 'CANCELLED':
        return 'Annulé';
      case 'REFUNDED':
        return 'Remboursé';
      case 'PENDING_ADMIN':
        return 'En attente admin';
      case 'CADEAU':
        return 'Cadeau';
      default:
        return status;
    }
  }

  getPaymentTypeClass(paymentType?: string): string {
    switch (paymentType) {
      case 'COMPTANT':
        return 'text-green-600';
      case 'CREDIT':
        return 'text-orange-600';
      default:
        return 'text-gray-600';
    }
  }

  getPaymentTypeText(paymentType?: string): string {
    switch (paymentType) {
      case 'COMPTANT':
        return 'Comptant';
      case 'CREDIT':
        return 'Crédit';
      default:
        return 'Non spécifié';
    }
  }

  getDisplayTicketNumber(): string {
    if (!this.ticket) return 'N/A';
    
    // Use dailyTicketNumber if available, otherwise use session ID
    if (this.ticket.dailyTicketNumber) {
      return this.ticket.dailyTicketNumber;
    }
    
    // Fallback to session ID if available
    if (this.ticket.sessionId) {
      return this.ticket.sessionId.toString();
    }
    
    // Last resort: use the private ID (but this shouldn't be displayed normally)
    return this.ticket.id.toString();
  }
}
