import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface StockDocumentAction {
  id: 'all' | 'factures' | 'bon-livraison' | 'bon-expedition' | 'bon-transfert';
  title: string;
  description: string;
  icon: string;
  color: string;
}

@Component({
  selector: 'app-stock-document-action-dialog',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-2xl border border-slate-200/70">
        <div class="p-6 border-b border-slate-200/70">
          <div class="flex items-center gap-3">
            <div class="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg ring-2 ring-indigo-100">
              <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
              </svg>
            </div>
            <div>
              <h2 class="text-xl font-bold text-slate-800">Choisir le type</h2>
              <span class="text-sm text-slate-600">Quel document souhaitez-vous consulter ?</span>
            </div>
          </div>
        </div>

        <div class="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            *ngFor="let action of actions"
            (click)="selectAction(action.id)"
            class="group cursor-pointer bg-white rounded-2xl p-5 shadow-sm border border-slate-200/70 transition-all duration-200 ring-1 ring-slate-50 relative overflow-hidden text-left h-full">
            <div class="flex items-start gap-4">
              <div class="w-12 h-12 bg-gradient-to-br rounded-xl flex items-center justify-center transition-transform duration-200 shadow-lg ring-2 ring-white/50"
                   [ngClass]="action.color">
                <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" [attr.d]="action.icon"></path>
                </svg>
              </div>
              <div class="flex-1">
                <div class="font-bold text-slate-800 mb-1">{{ action.title }}</div>
                <div class="text-sm text-slate-600">{{ action.description }}</div>
              </div>
              <div class="w-8 h-8 bg-gradient-to-br from-slate-100 to-indigo-100 rounded-lg flex items-center justify-center">
                <svg class="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                </svg>
              </div>
            </div>
          </button>
        </div>

        <div class="p-6 border-t border-slate-200/70">
          <button (click)="closeDialog()" class="w-full bg-slate-100 text-slate-800 font-semibold py-3 px-4 rounded-xl transition-all duration-200">
            Annuler
          </button>
        </div>
      </div>
    </div>
  `
})
export class StockDocumentActionDialogComponent {
  @Output() actionSelected = new EventEmitter<'all' | 'factures' | 'bon-livraison' | 'bon-expedition' | 'bon-transfert'>();
  @Output() dialogClosed = new EventEmitter<void>();

  actions: StockDocumentAction[] = [
    {
      id: 'factures',
      title: 'Factures',
      description: 'Consulter les factures',
      icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
      color: 'from-emerald-500 to-green-600'
    },
    {
      id: 'bon-livraison',
      title: 'Bons de livraisons',
      description: 'Entrées en magasin',
      icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
      color: 'from-orange-500 to-amber-600'
    },
    {
      id: 'bon-expedition',
      title: 'Bons de sorties',
      description: 'Sorties de stock',
      icon: 'M20 12H4m16 0l-4-4m4 4l-4 4',
      color: 'from-blue-500 to-indigo-600'
    },
    {
      id: 'bon-transfert',
      title: 'Bons de transfert',
      description: 'Transferts entre dépôts',
      icon: 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4',
      color: 'from-purple-500 to-violet-600'
    },
    {
      id: 'all',
      title: 'Tous les documents',
      description: 'Voir tous les types',
      icon: 'M3 7h18M3 12h18M3 17h18',
      color: 'from-slate-400 to-slate-600'
    }
  ];

  selectAction(actionId: 'all' | 'factures' | 'bon-livraison' | 'bon-expedition' | 'bon-transfert'): void {
    this.actionSelected.emit(actionId);
  }

  closeDialog(): void {
    this.dialogClosed.emit();
  }
}
