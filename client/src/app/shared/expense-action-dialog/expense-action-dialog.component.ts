import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface ExpenseAction {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  gradient: string;
}

@Component({
  selector: 'app-expense-action-dialog',
  imports: [CommonModule],
  template: `
    <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-amber-100/50">
        <!-- Header -->
        <div class="p-6 border-b border-amber-100/50">
          <div class="flex items-center space-x-3">
            <div class="w-12 h-12 bg-gradient-to-br from-red-500 to-rose-600 rounded-xl flex items-center justify-center shadow-lg ring-2 ring-red-100">
              <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
            </div>
            <div>
              <h2 class="text-xl font-bold text-amber-800">Gestion des Dépenses</h2>
              <p class="text-sm text-amber-600/70">Que souhaitez-vous faire ?</p>
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div class="p-6 space-y-3">
          <button 
            *ngFor="let action of actions" 
            (click)="selectAction(action.id)"
            class="w-full group cursor-pointer bg-white rounded-xl p-4 shadow-sm border border-amber-100/50 hover:shadow-lg hover:scale-[1.02] transition-all duration-300 ring-1 ring-amber-50 relative overflow-hidden">
            
            <div class="flex items-center space-x-4">
              <!-- Icon Container -->
              <div class="w-12 h-12 bg-gradient-to-br rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-lg ring-2 ring-white/50" 
                   [ngClass]="action.color">
                <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" [attr.d]="action.icon"></path>
                </svg>
              </div>
              
              <!-- Content -->
              <div class="flex-1 text-left">
                <h3 class="text-lg font-semibold text-amber-800 group-hover:text-amber-600 transition-colors">
                  {{ action.title }}
                </h3>
                <p class="text-sm text-amber-600/70 group-hover:text-amber-600 transition-colors font-medium">
                  {{ action.description }}
                </p>
              </div>
            </div>
            
            <!-- Hover Effect -->
            <div class="absolute inset-0 rounded-xl bg-gradient-to-br opacity-0 group-hover:opacity-10 transition-opacity duration-300" 
                 [ngClass]="action.gradient"></div>
          </button>
        </div>

        <!-- Footer -->
        <div class="p-6 border-t border-amber-100/50 bg-amber-50/30">
          <button 
            (click)="closeDialog()"
            class="w-full bg-amber-100 text-amber-800 font-semibold py-3 px-4 rounded-xl hover:bg-amber-200 transition-all duration-200">
            Annuler
          </button>
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
export class ExpenseActionDialogComponent {
  @Output() actionSelected = new EventEmitter<string>();
  @Output() dialogClosed = new EventEmitter<void>();

  actions: ExpenseAction[] = [
    {
      id: 'consult',
      title: 'Consulter Dépenses',
      description: 'Voir toutes les dépenses',
      icon: 'M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01',
      color: 'from-blue-500 to-indigo-600',
      gradient: 'from-blue-50 to-indigo-100'
    },
    {
      id: 'add',
      title: 'Ajouter Dépense',
      description: 'Créer une nouvelle dépense',
      icon: 'M12 6v6m0 0v6m0-6h6m-6 0H6',
      color: 'from-emerald-500 to-green-600',
      gradient: 'from-emerald-50 to-green-100'
    },
    {
      id: 'add-category',
      title: 'Ajouter Catégorie',
      description: 'Créer une nouvelle catégorie',
      icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10',
      color: 'from-purple-500 to-violet-600',
      gradient: 'from-purple-50 to-violet-100'
    },
    {
      id: 'statistics',
      title: 'Voir Statistiques',
      description: 'Analyser les données de dépenses',
      icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
      color: 'from-orange-500 to-amber-600',
      gradient: 'from-orange-50 to-amber-100'
    }
  ];

  selectAction(actionId: string): void {
    this.actionSelected.emit(actionId);
  }

  closeDialog(): void {
    this.dialogClosed.emit();
  }
}
