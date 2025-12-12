import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-message-dialog',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" (click)="onOverlayClick($event)">
      <div class="bg-white rounded-2xl border border-slate-200 max-w-md w-full shadow-2xl" (click)="$event.stopPropagation()">
        <div [class]="'p-6 flex justify-between items-center rounded-t-2xl ' + getHeaderClasses()">
          <div class="flex items-center gap-3">
            <div [class]="'w-10 h-10 rounded-xl flex items-center justify-center ' + getIconClasses()">
              <svg *ngIf="type === 'error'" class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              <svg *ngIf="type === 'success'" class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              <svg *ngIf="type === 'warning'" class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
              </svg>
              <svg *ngIf="type === 'info'" class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
            </div>
            <h2 class="text-xl font-bold text-white">{{ title }}</h2>
          </div>
          <button (click)="close()" class="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center transition-colors hover:bg-white/30">
            <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>
        <div class="p-6">
          <p class="text-slate-700 mb-6 whitespace-pre-line">{{ message }}</p>
          <div class="flex justify-end">
            <button (click)="close()" class="px-6 py-2 bg-slate-800 text-white rounded-lg transition-colors hover:bg-slate-700">
              Fermer
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
  `]
})
export class MessageDialogComponent {
  @Input() title: string = 'Message';
  @Input() message: string = '';
  @Input() type: 'error' | 'success' | 'warning' | 'info' = 'info';
  @Output() closeEvent = new EventEmitter<void>();

  close(): void {
    this.closeEvent.emit();
  }

  onOverlayClick(event: Event): void {
    if (event.target === event.currentTarget) {
      this.close();
    }
  }

  getHeaderClasses(): string {
    switch (this.type) {
      case 'error':
        return 'bg-red-500';
      case 'success':
        return 'bg-green-500';
      case 'warning':
        return 'bg-amber-500';
      case 'info':
        return 'bg-blue-500';
      default:
        return 'bg-slate-500';
    }
  }

  getIconClasses(): string {
    return 'bg-white/20';
  }
}

