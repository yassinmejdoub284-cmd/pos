import { Component, EventEmitter, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-erp-unlock-dialog',
  imports: [CommonModule, FormsModule],
  template: `
    <div class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" (click)="onBackdropClick($event)">
      <div class="bg-white rounded-2xl border border-amber-100/50 max-w-md w-full shadow-2xl ring-1 ring-amber-50">
        <!-- Header -->
        <div class="bg-gradient-to-r from-cyan-50 to-blue-50 p-6 border-b border-cyan-200/60 rounded-t-2xl">
          <div class="flex items-center justify-between">
            <div class="flex items-center space-x-4">
              <div class="w-12 h-12 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg ring-2 ring-cyan-100">
                <svg class="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
                </svg>
              </div>
              <div>
                <h2 class="text-xl font-bold bg-gradient-to-r from-cyan-600 to-blue-600 bg-clip-text text-transparent">
                  Accès ERP de Gestion
                </h2>
                <p class="text-sm text-cyan-600/70 font-medium">Authentification requise</p>
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

        <!-- Content -->
        <div class="p-6">
          <div class="mb-6">
            <p class="text-gray-700 text-center mb-4">
              Débloquer cette fonctionnalité ? Entrez votre jeton.
            </p>
            
            <!-- Error Message -->
            <div *ngIf="errorMessage()" class="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <div class="flex items-center space-x-2">
                <svg class="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                <span class="text-red-700 text-sm font-medium">{{ errorMessage() }}</span>
              </div>
            </div>

            <!-- Token Input -->
            <div class="space-y-2">
              <label for="token" class="block text-sm font-medium text-gray-700">Jeton d'accès</label>
              <input 
                id="token"
                type="password" 
                [(ngModel)]="token"
                (keyup.enter)="onUnlock()"
                placeholder="Entrez votre jeton..."
                class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-colors"
                [class.border-red-300]="errorMessage()"
                [class.focus:ring-red-500]="errorMessage()"
                [class.focus:border-red-500]="errorMessage()">
            </div>
          </div>

          <!-- Actions -->
          <div class="flex space-x-3">
            <button 
              (click)="onClose()"
              class="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg transition-colors font-medium">
              Annuler
            </button>
            <button 
              (click)="onUnlock()"
              [disabled]="!token || loading()"
              class="flex-1 px-4 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-lg transition-all duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed">
              <span *ngIf="!loading()">Débloquer</span>
              <span *ngIf="loading()" class="flex items-center justify-center">
                <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Vérification...
              </span>
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
export class ErpUnlockDialogComponent {
  @Output() tokenValidated = new EventEmitter<boolean>();
  @Output() dialogClosed = new EventEmitter<void>();

  token = '';
  loading = signal(false);
  errorMessage = signal('');

  // Token constant - change this to your desired token
  private readonly VALID_TOKEN = 'ERP2024';

  onUnlock(): void {
    if (!this.token.trim()) {
      this.errorMessage.set('Veuillez entrer un jeton');
      return;
    }

    this.loading.set(true);
    this.errorMessage.set('');

    // Simulate validation delay
    setTimeout(() => {
      if (this.token.trim() === this.VALID_TOKEN) {
        this.tokenValidated.emit(true);
      } else {
        this.errorMessage.set('Jeton invalide. Veuillez réessayer.');
        this.token = '';
      }
      this.loading.set(false);
    }, 500);
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
