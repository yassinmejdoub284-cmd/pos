import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Sale } from '../../core/models/sale.model';

export interface TicketAction {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  gradient: string;
}

@Component({
  selector: 'app-ticket-action-dialog',
  imports: [CommonModule],
  template: `
    <div class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" (click)="onBackdropClick($event)">
      <div class="bg-white rounded-2xl border border-blue-100/50 max-w-lg w-full shadow-2xl ring-1 ring-blue-50">
        <!-- Header -->
        <div class="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 border-b border-blue-200/60 rounded-t-2xl">
          <div class="flex items-center justify-between">
            <div class="flex items-center space-x-4">
              <div class="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg ring-2 ring-blue-100">
                <svg class="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                </svg>
              </div>
              <div>
                <h2 class="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  Ticket #{{ formatTicketNumber(ticket) }}
                </h2>
                <p class="text-sm text-blue-600/70 font-medium">Que souhaitez-vous faire ?</p>
              </div>
            </div>
            <button (click)="onClose()" 
              title="Fermer"
              class="p-2 text-blue-500  rounded-xl transition-all duration-200">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>
        </div>

        <!-- Ticket Info -->
        <div class="p-4 bg-gray-50 border-b border-gray-200">
          <div class="flex items-center justify-between text-sm">
            <div class="flex items-center space-x-4">
              <span class="font-mono text-lg font-bold text-blue-600">#{{ formatTicketNumber(ticket) }}</span>
              <span class="px-2 py-1 rounded-full text-xs font-medium"
                    [class]="getStatusClass(ticket?.status || '')">
                {{ getStatusText(ticket?.status || '') }}
              </span>
            </div>
            <div class="text-right">
              <div class="font-semibold text-gray-900">{{ ticket?.finalTotal | number:'1.2-2' }} dt</div>
              <div class="text-xs text-gray-500">{{ ticket?.createdAt | date:'short' }}</div>
            </div>
          </div>
        </div>

        <!-- Actions Grid -->
        <div class="p-6">
          <!-- First Row: 3 Actions -->
          <div class="grid grid-cols-3 gap-3 mb-4">
            <div *ngFor="let action of getFirstRowActions()" 
                 (click)="onActionClick(action.id)"
                 class="group cursor-pointer bg-white rounded-xl p-4 shadow-sm border border-blue-100/50 transition-all duration-200 ring-1 ring-blue-50 relative overflow-hidden">
              
              <!-- Icon and Content -->
              <div class="flex flex-col items-center text-center space-y-3">
                <div class="w-10 h-10 bg-gradient-to-br rounded-xl flex items-center justify-center transition-transform duration-200 shadow-sm ring-2 ring-white/50" 
                     [ngClass]="action.color">
                  <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" [attr.d]="action.icon"></path>
                  </svg>
                </div>
                
                <div class="flex-1">
                  <h3 class="text-sm font-semibold text-blue-800 group- transition-colors leading-tight">
                    {{ getActionTitle(action.id, action.title) }}
                  </h3>
                  <p class="text-xs text-blue-600/70 group- transition-colors mt-1 leading-tight">
                    {{ getActionDescription(action.id, action.description) }}
                  </p>
                </div>
              </div>
              
              <!-- Hover Effect -->
              <div class="absolute inset-0 rounded-xl bg-gradient-to-br opacity-0 transition-opacity duration-200" 
                   [ngClass]="action.gradient"></div>
            </div>
          </div>

          <!-- Second Row: 2 Actions (Centered) -->
          <div class="flex justify-center">
            <div class="grid grid-cols-2 gap-3 w-2/3">
            <div *ngFor="let action of getSecondRowActions()" 
                 (click)="isActionDisabled(action.id) ? null : onActionClick(action.id)"
                 [class]="'group rounded-xl p-4 shadow-sm border ring-1 relative overflow-hidden transition-all duration-200 ' +
                          (isActionDisabled(action.id) 
                            ? 'cursor-not-allowed bg-gray-100 border-gray-200 ring-gray-100 opacity-60' 
                            : 'cursor-pointer bg-white border-blue-100/50 ring-blue-50')">
                
                <!-- Icon and Content -->
                <div class="flex flex-col items-center text-center space-y-3">
                  <div class="w-10 h-10 bg-gradient-to-br rounded-xl flex items-center justify-center transition-transform duration-200 shadow-sm ring-2 ring-white/50" 
                       [ngClass]="action.color">
                    <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" [attr.d]="action.icon"></path>
                    </svg>
                  </div>
                  
                  <div class="flex-1">
                    <h3 class="text-sm font-semibold text-blue-800 group- transition-colors leading-tight">
                      {{ getActionTitle(action.id, action.title) }}
                    </h3>
                    <p class="text-xs text-blue-600/70 group- transition-colors mt-1 leading-tight">
                      {{ getActionDescription(action.id, action.description) }}
                    </p>
                  </div>
                </div>
                
                <!-- Hover Effect -->
                <div class="absolute inset-0 rounded-xl bg-gradient-to-br opacity-0 transition-opacity duration-200" 
                     [ngClass]="action.gradient"></div>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="bg-gradient-to-r from-blue-50/50 to-indigo-50/50 p-4 border-t border-blue-200/60 rounded-b-2xl">
          <div class="flex justify-center">
            <button (click)="onClose()" 
              class="px-6 py-2 bg-white/80 text-blue-700 rounded-lg transition-all duration-200 shadow-sm border border-blue-200/50">
              Annuler
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
export class TicketActionDialogComponent {
  @Input() ticket: Sale | null = null;
  @Input() isInvoiceApprovedForTicket: ((ticket: Sale | null) => boolean) | null = null;
  @Input() hasInvoiceRequestForTicket: ((ticket: Sale | null) => boolean) | null = null;
  @Input() hasPendingRefundRequestForTicket: ((ticket: Sale | null) => boolean) | null = null;
  @Output() actionSelected = new EventEmitter<string>();
  @Output() dialogClosed = new EventEmitter<void>();

  ticketActions: TicketAction[] = [
    {
      id: 'print-ticket',
      title: 'Imprimer le ticket',
      description: 'Imprimer le ticket de vente',
      icon: 'M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z',
      color: 'from-emerald-500 to-green-600',
      gradient: 'from-emerald-50 to-green-100'
    },
    {
      id: 'request-invoice',
      title: 'Demander facture',
      description: 'Créer une demande de facture pour ce ticket',
      icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586l6.414 6.414V19a2 2 0 01-2 2z',
      color: 'from-indigo-500 to-blue-600',
      gradient: 'from-indigo-50 to-blue-100'
    },
    {
      id: 'return-exchange',
      title: 'Retour / Échange',
      description: 'Gérer les retours et échanges',
      icon: 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4',
      color: 'from-orange-500 to-red-600',
      gradient: 'from-orange-50 to-red-100'
    },
    {
      id: 'check-details',
      title: 'Voir les détails',
      description: 'Consulter les détails du ticket',
      icon: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z',
      color: 'from-blue-500 to-indigo-600',
      gradient: 'from-blue-50 to-indigo-100'
    },
    {
      id: 'instant-refund',
      title: 'Annuler',
      description: 'Remboursement immédiat et retour des produits en stock',
      icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 16.5c-.77.833.192 2.5 1.732 2.5z',
      color: 'from-red-500 to-red-600',
      gradient: 'from-red-50 to-red-100'
    }
  ];

  onActionClick(actionId: string): void {
    this.actionSelected.emit(actionId);
  }

  onClose(): void {
    this.dialogClosed.emit();
  }

  onBackdropClick(event: Event): void {
    if (event.target === event.currentTarget) {
      this.onClose();
    }
  }

  getVisibleActions(): TicketAction[] {
    return this.ticketActions;
  }

  getFirstRowActions(): TicketAction[] {
    // First row: Print, Invoice, Details
    return this.ticketActions.filter(action =>
      action.id === 'print-ticket' ||
      action.id === 'request-invoice' ||
      action.id === 'check-details'
    );
  }

  getSecondRowActions(): TicketAction[] {
    // Second row: Return/Exchange, Cancel (Instant Refund)
    return this.ticketActions.filter(action =>
      action.id === 'return-exchange' ||
      action.id === 'instant-refund'
    );
  }

  isActionDisabled(actionId: string): boolean {
    if (actionId === 'instant-refund') {
      return this.hasPendingRefundRequestForTicket ? this.hasPendingRefundRequestForTicket(this.ticket) : false;
    }
    return false;
  }

  getActionTitle(actionId: string, fallback: string): string {
    if (actionId === 'request-invoice') {
      if (this.isInvoiceApprovedForTicket && this.isInvoiceApprovedForTicket(this.ticket)) return 'Imprimer la facture';
      if (this.hasInvoiceRequestForTicket && this.hasInvoiceRequestForTicket(this.ticket)) return 'Facture en attente d\'approbation';
    }
    if (actionId === 'instant-refund') {
      if (this.hasPendingRefundRequestForTicket && this.hasPendingRefundRequestForTicket(this.ticket)) return 'Annulation en cours';
    }
    return fallback;
  }

  getActionDescription(actionId: string, fallback: string): string {
    if (actionId === 'request-invoice') {
      if (this.isInvoiceApprovedForTicket && this.isInvoiceApprovedForTicket(this.ticket)) return 'Imprimer la facture approuvée';
      if (this.hasInvoiceRequestForTicket && this.hasInvoiceRequestForTicket(this.ticket)) return 'Demande envoyée, en attente d\'approbation';
    }
    if (actionId === 'instant-refund') {
      if (this.hasPendingRefundRequestForTicket && this.hasPendingRefundRequestForTicket(this.ticket)) return 'Demande de remboursement en attente d\'approbation admin';
    }
    return fallback;
  }

  formatTicketNumber(t: Sale | null): string {
    const raw: string | number | undefined = (t as any)?.dailyTicketNumber;
    if (raw !== undefined && raw !== null) {
      // Convert to string to handle both string and number types
      const rawStr = String(raw);
      if (rawStr.includes('/')) {
        const part = rawStr.split('/')[1];
        return part || rawStr;
      }
      return rawStr;
    }
    // Fallback to sale id if dailyTicketNumber is missing (older sales)
    const idVal = (t as any)?.id;
    return (idVal !== undefined && idVal !== null) ? String(idVal).padStart(4, '0') : '';
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'COMPLETED':
        return 'bg-green-100 text-green-700';
      case 'TEMPORARY':
        return 'bg-yellow-100 text-yellow-700';
      case 'PENDING':
        return 'bg-orange-100 text-orange-700';
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
        return 'Retourné';
      default:
        return status;
    }
  }
}
