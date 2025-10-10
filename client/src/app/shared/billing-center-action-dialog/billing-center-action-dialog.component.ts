import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface BillingCenterAction {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  gradient: string;
}

@Component({
  selector: 'app-billing-center-action-dialog',
  imports: [CommonModule],
  template: `
    <div class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" (click)="onBackdropClick($event)">
      <div class="bg-white rounded-2xl border border-amber-100/50 max-w-2xl w-full shadow-2xl ring-1 ring-amber-50">
        <!-- Header -->
        <div class="bg-gradient-to-r from-cyan-50 to-blue-50 p-6 border-b border-cyan-200/60 rounded-t-2xl">
          <div class="flex items-center justify-between">
            <div class="flex items-center space-x-4">
              <div class="w-12 h-12 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg ring-2 ring-cyan-100">
                <svg class="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                </svg>
              </div>
              <div>
                <h2 class="text-2xl font-bold bg-gradient-to-r from-cyan-600 to-blue-600 bg-clip-text text-transparent">
                  Centre de facturation
                </h2>
                <p class="text-sm text-cyan-600/70 font-medium">Que souhaitez-vous faire ?</p>
              </div>
            </div>
            <button (click)="onClose()" 
              title="Fermer"
              class="p-2 text-cyan-500  rounded-xl transition-all duration-200">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>
        </div>

        <!-- Actions Grid -->
        <div class="p-6">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div *ngFor="let action of billingCenterActions" 
                 (click)="onActionClick(action.id)"
                 class="group cursor-pointer bg-white rounded-2xl p-6 shadow-lg border border-cyan-100/50 transition-all duration-300 ring-1 ring-cyan-50 relative overflow-hidden">
              
              <!-- Icon Container -->
              <div class="w-16 h-16 bg-gradient-to-br rounded-2xl flex items-center justify-center mx-auto mb-4 transition-transform duration-300 shadow-lg ring-2 ring-white/50" 
                   [ngClass]="action.color">
                <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" [attr.d]="action.icon"></path>
                </svg>
              </div>
              
              <!-- Title and Description -->
              <h3 class="text-lg font-semibold text-cyan-800 mb-2 text-center group- transition-colors">
                {{ action.title }}
              </h3>
              <p class="text-sm text-cyan-600/70 text-center group- transition-colors font-medium">
                {{ action.description }}
              </p>
              
              <!-- Hover Effect -->
              <div class="absolute inset-0 rounded-2xl bg-gradient-to-br opacity-0 transition-opacity duration-300" 
                   [ngClass]="action.gradient"></div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="bg-gradient-to-r from-cyan-50/50 to-blue-50/50 p-4 border-t border-cyan-200/60 rounded-b-2xl">
          <div class="flex justify-center">
            <button (click)="onClose()" 
              class="px-6 py-2 bg-white/80 text-cyan-700 rounded-lg transition-all duration-200 shadow-sm border border-cyan-200/50">
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
export class BillingCenterActionDialogComponent {
  @Output() actionSelected = new EventEmitter<string>();
  @Output() dialogClosed = new EventEmitter<void>();

  billingCenterActions: BillingCenterAction[] = [
    {
      id: 'add-invoice',
      title: 'Ajouter nouvelle facture',
      description: 'Créer une nouvelle facture',
      icon: 'M12 6v6m0 0v6m0-6h6m-6 0H6',
      color: 'from-emerald-500 to-green-600',
      gradient: 'from-emerald-50 to-green-100'
    },
    {
      id: 'manage-invoices',
      title: 'Gérer les factures',
      description: 'Consulter et gérer les factures',
      icon: 'M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01',
      color: 'from-blue-500 to-indigo-600',
      gradient: 'from-blue-50 to-indigo-100'
    },
    {
      id: 'invoice-extracts',
      title: 'Extraits facturés',
      description: 'Voir les extraits journaliers avec quantités facturées',
      icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
      color: 'from-purple-500 to-pink-600',
      gradient: 'from-purple-50 to-pink-100'
    },
    {
      id: 'stock-management',
      title: 'Gestion de Stock',
      description: 'Gérer les entrées de stock pour tous les dépôts',
      icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
      color: 'from-emerald-500 to-teal-600',
      gradient: 'from-emerald-50 to-teal-100'
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
}


