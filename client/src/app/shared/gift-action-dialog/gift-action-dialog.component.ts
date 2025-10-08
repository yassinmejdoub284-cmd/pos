import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface GiftAction {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  gradient: string;
}

@Component({
  selector: 'app-gift-action-dialog',
  imports: [CommonModule],
  template: `
    <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-amber-100/50">
        <!-- Header -->
        <div class="p-6 border-b border-amber-100/50">
          <div class="flex items-center space-x-3">
            <div class="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center shadow-lg ring-2 ring-purple-100">
              <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v13m0-13V6a2 2 0 112 2h-2zM5 12h14M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7"></path>
              </svg>
            </div>
            <div>
              <h2 class="text-xl font-bold text-purple-800">Gestion des Cadeaux</h2>
              <p class="text-sm text-purple-600/70">Que souhaitez-vous faire ?</p>
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div class="p-6 space-y-3">
          <button 
            *ngFor="let action of actions" 
            (click)="selectAction(action.id)"
            class="w-full group cursor-pointer bg-white rounded-xl p-4 shadow-sm border border-purple-100/50 hover:shadow-lg hover:scale-[1.02] transition-all duration-300 ring-1 ring-purple-50 relative overflow-hidden">
            
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
                <h3 class="text-lg font-semibold text-purple-800 group-hover:text-purple-600 transition-colors">
                  {{ action.title }}
                </h3>
                <p class="text-sm text-purple-600/70 group-hover:text-purple-600 transition-colors font-medium">
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
        <div class="p-6 border-t border-purple-100/50 bg-purple-50/30">
          <button 
            (click)="closeDialog()"
            class="w-full bg-purple-100 text-purple-800 font-semibold py-3 px-4 rounded-xl hover:bg-purple-200 transition-all duration-200">
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
export class GiftActionDialogComponent {
  @Output() actionSelected = new EventEmitter<string>();
  @Output() dialogClosed = new EventEmitter<void>();

  actions: GiftAction[] = [
    {
      id: 'consult-approved',
      title: 'Cadeaux Approuvés',
      description: 'Consulter les cadeaux approuvés',
      icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
      color: 'from-green-500 to-emerald-600',
      gradient: 'from-green-50 to-emerald-100'
    },
    {
      id: 'consult-pending',
      title: 'Cadeaux en Attente',
      description: 'Consulter les cadeaux en attente d\'approbation',
      icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
      color: 'from-amber-500 to-orange-600',
      gradient: 'from-amber-50 to-orange-100'
    },
    {
      id: 'add-from-cart',
      title: 'Ajouter Cadeau',
      description: 'Créer un nouveau cadeau depuis le panier',
      icon: 'M12 6v6m0 0v6m0-6h6m-6 0H6',
      color: 'from-purple-500 to-pink-600',
      gradient: 'from-purple-50 to-pink-100'
    }
  ];

  selectAction(actionId: string): void {
    this.actionSelected.emit(actionId);
  }

  closeDialog(): void {
    this.dialogClosed.emit();
  }
}



