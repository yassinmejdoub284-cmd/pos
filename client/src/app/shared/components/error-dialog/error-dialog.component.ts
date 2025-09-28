import { Component, Input, OnInit, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ErrorDialogData } from '../../../core/services/error-handling.service';

@Component({
  selector: 'app-error-dialog',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
      <div class="bg-white/95 backdrop-blur-sm rounded-3xl border border-gray-200/50 max-w-md w-full shadow-2xl transform animate-scale-in">
        <!-- Header -->
        <div [class]="'p-6 flex justify-between items-center ' + getHeaderClasses()">
          <div class="flex items-center gap-3">
            <div [class]="'w-10 h-10 rounded-2xl flex items-center justify-center ' + getIconClasses()">
              <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path *ngIf="data.type === 'error'" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                <path *ngIf="data.type === 'warning'" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
                <path *ngIf="data.type === 'info'" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
            </div>
            <h2 class="text-xl font-bold text-white">{{ data.title }}</h2>
          </div>
          <button (click)="closeDialog()" title="Fermer"
            class="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center hover:bg-white/30 transition-colors">
            <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>

        <!-- Content -->
        <div class="p-6">
          <p class="text-slate-700 mb-4">{{ data.message }}</p>
          
          <!-- Dependents Section -->
          <div *ngIf="data.showDependents && data.dependents && data.dependents.length > 0" 
               class="mb-6 p-4 bg-slate-50 rounded-xl border border-slate-200">
            <h3 class="text-sm font-semibold text-slate-800 mb-3">Éléments liés :</h3>
            <div class="space-y-2">
              <div *ngFor="let dependent of data.dependents" 
                   class="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-100">
                <div class="flex items-center gap-3">
                  <div class="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                    <svg class="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                    </svg>
                  </div>
                  <div>
                    <span class="text-sm font-medium text-slate-800">{{ dependent.table }}</span>
                    <span class="text-xs text-slate-500 ml-2">({{ dependent.count }} élément{{ dependent.count > 1 ? 's' : '' }})</span>
                  </div>
                </div>
                <button *ngIf="dependent.link" 
                        (click)="navigateToDependent(dependent.link)"
                        class="text-blue-600 hover:text-blue-800 text-sm font-medium transition-colors">
                  Voir
                </button>
              </div>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex justify-end gap-3">
            <button *ngIf="data.secondaryAction" 
                    (click)="data.secondaryAction.action()"
                    class="px-4 py-2 bg-slate-200 text-slate-800 rounded-lg hover:bg-slate-300 transition-colors">
              {{ data.secondaryAction.label }}
            </button>
            <button (click)="closeDialog()"
                    class="px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition-colors">
              {{ data.primaryAction?.label || 'Fermer' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .animate-fade-in {
      animation: fadeIn 0.3s ease-out;
    }
    
    .animate-scale-in {
      animation: scaleIn 0.3s ease-out;
    }
    
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    
    @keyframes scaleIn {
      from { 
        opacity: 0;
        transform: scale(0.9);
      }
      to { 
        opacity: 1;
        transform: scale(1);
      }
    }
  `]
})
export class ErrorDialogComponent implements OnInit {
  @Input() data!: ErrorDialogData;
  @Output() close = new EventEmitter<void>();

  constructor(private router: Router) {}

  ngOnInit(): void {}

  closeDialog(): void {
    if (this.data.primaryAction) {
      this.data.primaryAction.action();
    }
    this.close.emit();
  }

  navigateToDependent(link: string): void {
    this.router.navigate([link]);
    this.closeDialog();
  }

  getHeaderClasses(): string {
    switch (this.data.type) {
      case 'error':
        return 'bg-gradient-to-r from-red-500 to-pink-500';
      case 'warning':
        return 'bg-gradient-to-r from-amber-500 to-yellow-500';
      case 'info':
        return 'bg-gradient-to-r from-blue-500 to-indigo-500';
      default:
        return 'bg-gradient-to-r from-slate-500 to-gray-500';
    }
  }

  getIconClasses(): string {
    switch (this.data.type) {
      case 'error':
        return 'bg-white/20';
      case 'warning':
        return 'bg-white/20';
      case 'info':
        return 'bg-white/20';
      default:
        return 'bg-white/20';
    }
  }
}
