import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

export interface SettingsAction {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  gradient: string;
}

@Component({
  selector: 'app-settings-action-dialog',
  imports: [CommonModule],
  template: `
    <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-xl border border-amber-100/50">
        <!-- Header -->
        <div class="p-6 border-b border-amber-100/50">
          <div class="flex items-center space-x-3">
            <div class="w-12 h-12 bg-gradient-to-br from-yellow-500 to-amber-600 rounded-xl flex items-center justify-center shadow-lg ring-2 ring-yellow-100">
              <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
              </svg>
            </div>
            <div>
              <h2 class="text-xl font-bold text-amber-800">Paramètres</h2>
              <p class="text-sm text-amber-600/70">Que souhaitez-vous gérer ?</p>
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div class="p-6">
          <div class="grid grid-cols-3 gap-4 justify-items-center" style="grid-template-rows: auto auto;">
            <!-- First row: Paramètres Généraux spans 2 columns, then Utilisateurs -->
            <button 
              (click)="selectAction(actions[0].id)"
              class="group cursor-pointer bg-white rounded-xl p-4 shadow-sm border border-amber-100/50 transition-all duration-300 ring-1 ring-amber-50 relative overflow-hidden w-full max-w-[300px] col-span-2">
              
              <div class="flex items-center space-x-4">
                <!-- Icon Container -->
                <div class="w-12 h-12 bg-gradient-to-br rounded-xl flex items-center justify-center transition-transform duration-300 shadow-lg ring-2 ring-white/50 flex-shrink-0" 
                     [ngClass]="actions[0].color">
                  <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" [attr.d]="actions[0].icon"></path>
                  </svg>
                </div>
                
                <!-- Content -->
                <div class="text-left">
                  <h3 class="font-bold text-amber-800 text-base group-hover:text-amber-900 transition-colors duration-300 leading-tight">
                    {{ actions[0].title }}
                  </h3>
                  <p class="text-sm text-amber-600/70 group-hover:text-amber-700 transition-colors duration-300 mt-1 leading-tight">
                    {{ actions[0].description }}
                  </p>
                </div>
              </div>
              
              <!-- Hover Effect -->
              <div class="absolute inset-0 bg-gradient-to-br from-amber-50/50 to-yellow-50/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl"></div>
            </button>

            <button 
              (click)="selectAction(actions[1].id)"
              class="group cursor-pointer bg-white rounded-xl p-4 shadow-sm border border-amber-100/50 transition-all duration-300 ring-1 ring-amber-50 relative overflow-hidden w-full">
              
              <div class="flex flex-col items-center space-y-3">
                <!-- Icon Container -->
                <div class="w-12 h-12 bg-gradient-to-br rounded-xl flex items-center justify-center transition-transform duration-300 shadow-lg ring-2 ring-white/50" 
                     [ngClass]="actions[1].color">
                  <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" [attr.d]="actions[1].icon"></path>
                  </svg>
                </div>
                
                <!-- Content -->
                <div class="text-center">
                  <h3 class="font-bold text-amber-800 text-sm group-hover:text-amber-900 transition-colors duration-300 leading-tight">
                    {{ actions[1].title }}
                  </h3>
                  <p class="text-xs text-amber-600/70 group-hover:text-amber-700 transition-colors duration-300 mt-1 leading-tight">
                    {{ actions[1].description }}
                  </p>
                </div>
              </div>
              
              <!-- Hover Effect -->
              <div class="absolute inset-0 bg-gradient-to-br from-amber-50/50 to-yellow-50/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl"></div>
            </button>

            <!-- Second row: 3 items centered -->
            <button 
              *ngFor="let action of actions.slice(2, 5); let i = index" 
              (click)="selectAction(action.id)"
              class="group cursor-pointer bg-white rounded-xl p-4 shadow-sm border border-amber-100/50 transition-all duration-300 ring-1 ring-amber-50 relative overflow-hidden w-full"
              [style.grid-column]="i === 0 ? '1' : i === 1 ? '2' : '3'">
              
              <div class="flex flex-col items-center space-y-3">
                <!-- Icon Container -->
                <div class="w-12 h-12 bg-gradient-to-br rounded-xl flex items-center justify-center transition-transform duration-300 shadow-lg ring-2 ring-white/50" 
                     [ngClass]="action.color">
                  <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" [attr.d]="action.icon"></path>
                  </svg>
                </div>
                
                <!-- Content -->
                <div class="text-center">
                  <h3 class="font-bold text-amber-800 text-sm group-hover:text-amber-900 transition-colors duration-300 leading-tight">
                    {{ action.title }}
                  </h3>
                  <p class="text-xs text-amber-600/70 group-hover:text-amber-700 transition-colors duration-300 mt-1 leading-tight">
                    {{ action.description }}
                  </p>
                </div>
              </div>
              
              <!-- Hover Effect -->
              <div class="absolute inset-0 bg-gradient-to-br from-amber-50/50 to-yellow-50/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl"></div>
            </button>
          </div>
        </div>

        <!-- Footer -->
        <div class="p-6 border-t border-amber-100/50">
          <button 
            (click)="closeDialog()"
            class="w-full bg-gradient-to-r from-amber-100 to-yellow-100 text-amber-700 font-semibold py-3 px-4 rounded-xl transition-all duration-300 shadow-sm">
            Annuler
          </button>
        </div>
      </div>
    </div>
  `,
  standalone: true
})
export class SettingsActionDialogComponent {
  @Output() actionSelected = new EventEmitter<string>();
  @Output() dialogClosed = new EventEmitter<void>();
  
  constructor(private router: Router) {}

  actions: SettingsAction[] = [
    {
      id: 'general',
      title: 'Paramètres Généraux',
      description: 'Configuration système et préférences',
      icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
      color: 'from-yellow-500 to-amber-600',
      gradient: 'from-yellow-50 to-amber-100'
    },
    {
      id: 'users',
      title: 'Gestion des Utilisateurs',
      description: 'Créer et gérer les comptes utilisateurs',
      icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z',
      color: 'from-blue-500 to-indigo-600',
      gradient: 'from-blue-50 to-indigo-100'
    },
    {
      id: 'access',
      title: 'Gestion des Accès',
      description: 'Afficher/masquer les blocs d\'accueil par rôle',
      icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z',
      color: 'from-emerald-500 to-green-600',
      gradient: 'from-emerald-50 to-green-100'
    },
    {
      id: 'tables-salon',
      title: 'Gestion des Tables de Salon',
      description: 'Gérer les tables et l\'espace salon',
      icon: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z',
      color: 'from-emerald-500 to-teal-600',
      gradient: 'from-emerald-50 to-teal-100'
    },
    {
      id: 'enterprise',
      title: 'Gestion d\'Entreprise',
      description: 'Gérer les entreprises et leurs entrepôts',
      icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
      color: 'from-indigo-500 to-purple-600',
      gradient: 'from-indigo-50 to-purple-100'
    },
    {
      id: 'reminders',
      title: 'Rappels',
      description: 'Créer et gérer les rappels',
      icon: 'M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
      color: 'from-emerald-500 to-cyan-600',
      gradient: 'from-emerald-50 to-cyan-100'
    }
  ];

  selectAction(actionId: string): void {
    this.actionSelected.emit(actionId);
  }

  closeDialog(): void {
    this.dialogClosed.emit();
  }
}
