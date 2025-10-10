import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface EnterpriseAction {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
}

@Component({
  selector: 'app-enterprise-action-dialog',
  imports: [CommonModule],
  standalone: true,
  template: `
    <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-indigo-100/50">
        <!-- Header -->
        <div class="p-6 border-b border-indigo-100/50">
          <div class="flex items-center space-x-3">
            <div class="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg ring-2 ring-indigo-100">
              <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path>
              </svg>
            </div>
            <div>
              <h2 class="text-xl font-bold text-indigo-800">Gestion d'Entreprise</h2>
              <p class="text-sm text-indigo-600/70">Que souhaitez-vous gérer ?</p>
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div class="p-6 space-y-3">
          <button
            *ngFor="let action of actions"
            (click)="selectAction(action.id)"
            class="w-full group cursor-pointer bg-white rounded-xl p-4 shadow-sm border border-indigo-100/50 transition-all duration-300 ring-1 ring-indigo-50 relative overflow-hidden">
            <div class="flex items-center space-x-4">
              <div class="w-12 h-12 bg-gradient-to-br rounded-xl flex items-center justify-center transition-transform duration-300 shadow-lg ring-2 ring-white/50"
                   [ngClass]="action.color">
                <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" [attr.d]="action.icon"></path>
                </svg>
              </div>
              <div class="flex-1 text-left">
                <h3 class="font-bold text-indigo-800 group- transition-colors duration-300">{{ action.title }}</h3>
                <p class="text-sm text-indigo-600/70 group- transition-colors duration-300">{{ action.description }}</p>
              </div>
              <div class="w-8 h-8 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-lg flex items-center justify-center transition-all duration-300">
                <svg class="w-4 h-4 text-indigo-600 group- transition-colors duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                </svg>
              </div>
            </div>
            <div class="absolute inset-0 bg-gradient-to-r from-indigo-50/50 to-purple-50/50 opacity-0 transition-opacity duration-300 rounded-xl"></div>
          </button>
        </div>

        <!-- Footer -->
        <div class="p-6 border-t border-indigo-100/50">
          <button (click)="closeDialog()" class="w-full bg-gradient-to-r from-indigo-100 to-purple-100 text-indigo-700 font-semibold py-3 px-4 rounded-xl transition-all duration-300 shadow-sm">Annuler</button>
        </div>
      </div>
    </div>
  `
})
export class EnterpriseActionDialogComponent {
  @Output() actionSelected = new EventEmitter<string>();
  @Output() dialogClosed = new EventEmitter<void>();

  actions: EnterpriseAction[] = [
    {
      id: 'enterprises',
      title: "Entreprises",
      description: "Créer et gérer les sociétés",
      icon: 'M3 7h18M3 12h18M3 17h18',
      color: 'from-indigo-500 to-purple-600'
    },
    {
      id: 'depots-shops',
      title: "Entrepôts & Magasins",
      description: "Gérer les dépôts, magasins et affectations",
      icon: 'M20 7l-8-4-8 4m16 0l-8 4m-8-4v10l8 4 8-4V7',
      color: 'from-blue-500 to-cyan-600'
    }
  ];

  selectAction(actionId: string): void {
    this.actionSelected.emit(actionId);
  }

  closeDialog(): void {
    this.dialogClosed.emit();
  }
}


