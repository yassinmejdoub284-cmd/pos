import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface ApprovalsAction {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  gradient: string;
}

@Component({
  selector: 'app-approvals-action-dialog',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-amber-100/50">
        <!-- Header -->
        <div class="p-6 border-b border-amber-100/50">
          <div class="flex items-center space-x-3">
            <div class="w-12 h-12 bg-gradient-to-br from-purple-500 to-violet-600 rounded-xl flex items-center justify-center shadow-lg ring-2 ring-purple-100">
              <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path>
              </svg>
            </div>
            <div>
              <h2 class="text-xl font-bold text-amber-800">Centre d'approbation</h2>
              <p class="text-sm text-amber-600/70">Choisissez une action</p>
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div class="p-6 space-y-3">
          <button 
            (click)="selectAction('pending')"
            class="w-full group cursor-pointer bg-white rounded-xl p-4 shadow-sm border border-amber-100/50 hover:shadow-lg hover:scale-[1.02] transition-all duration-300 ring-1 ring-amber-50 relative overflow-hidden">
            <div class="flex items-center space-x-4">
              <div class="w-12 h-12 bg-gradient-to-br from-orange-500 to-amber-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-lg ring-2 ring-white/50">
                <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
              </div>
              <div class="flex-1 text-left">
                <h3 class="text-lg font-semibold text-amber-800 group-hover:text-amber-600 transition-colors">
                  En attente ({{ pendingCount }})
                </h3>
                <p class="text-sm text-amber-600/70 group-hover:text-amber-600 transition-colors font-medium">
                  Demandes en attente d'approbation
                </p>
              </div>
            </div>
            <div class="absolute inset-0 rounded-xl bg-gradient-to-br from-orange-50 to-amber-100 opacity-0 group-hover:opacity-10 transition-opacity duration-300"></div>
          </button>

          <button 
            (click)="selectAction('history')"
            class="w-full group cursor-pointer bg-white rounded-xl p-4 shadow-sm border border-amber-100/50 hover:shadow-lg hover:scale-[1.02] transition-all duration-300 ring-1 ring-amber-50 relative overflow-hidden">
            <div class="flex items-center space-x-4">
              <div class="w-12 h-12 bg-gradient-to-br from-purple-500 to-violet-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-lg ring-2 ring-white/50">
                <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
              </div>
              <div class="flex-1 text-left">
                <h3 class="text-lg font-semibold text-amber-800 group-hover:text-amber-600 transition-colors">
                  Historique d'approbation
                </h3>
                <p class="text-sm text-amber-600/70 group-hover:text-amber-600 transition-colors font-medium">
                  Voir les éléments approuvés
                </p>
              </div>
            </div>
            <div class="absolute inset-0 rounded-xl bg-gradient-to-br from-purple-50 to-violet-100 opacity-0 group-hover:opacity-10 transition-opacity duration-300"></div>
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
    :host { display: block; }
  `]
})
export class ApprovalsActionDialogComponent {
  @Input() pendingCount: number = 0;
  @Output() actionSelected = new EventEmitter<string>();
  @Output() dialogClosed = new EventEmitter<void>();

  selectAction(actionId: string): void {
    this.actionSelected.emit(actionId);
  }

  closeDialog(): void {
    this.dialogClosed.emit();
  }
}


