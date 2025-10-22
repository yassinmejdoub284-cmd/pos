import { Component, Input, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface DialogConfig {
  title: string;
  subtitle?: string;
  showCloseButton?: boolean;
  showCancelButton?: boolean;
  showConfirmButton?: boolean;
  cancelText?: string;
  confirmText?: string;
  confirmColor?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  preventBodyScroll?: boolean;
}

@Component({
  selector: 'app-dialog',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="dialog-overlay" 
         [class]="config().preventBodyScroll ? 'prevent-scroll' : ''"
         (click)="onOverlayClick($event)">
      <div class="dialog-content" 
           [class]="'dialog-' + (config().size || 'md')"
           (click)="$event.stopPropagation()">
        
        <!-- Header -->
        <div class="dialog-header">
          <div class="dialog-title-section">
            <h2 class="dialog-title">{{ config().title }}</h2>
            @if (config().subtitle) {
              <p class="dialog-subtitle">{{ config().subtitle }}</p>
            }
          </div>
          @if (config().showCloseButton !== false) {
            <button class="dialog-close-btn" (click)="onClose()">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          }
        </div>

        <!-- Content -->
        <div class="dialog-body">
          <ng-content></ng-content>
        </div>

        <!-- Footer -->
        @if (config().showCancelButton || config().showConfirmButton) {
          <div class="dialog-footer">
            @if (config().showCancelButton !== false) {
              <button class="dialog-btn dialog-btn-cancel" (click)="onCancel()">
                {{ config().cancelText || 'Annuler' }}
              </button>
            }
            @if (config().showConfirmButton !== false) {
              <button class="dialog-btn dialog-btn-confirm" 
                      [class]="'dialog-btn-' + (config().confirmColor || 'primary')"
                      (click)="onConfirm()">
                {{ config().confirmText || 'Confirmer' }}
              </button>
            }
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .dialog-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(139, 92, 246, 0.1);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      padding: 1rem;
      overflow: hidden;
    }

    .dialog-overlay.prevent-scroll {
      overflow: hidden;
    }

    .dialog-content {
      background: #ffffff;
      border-radius: 2rem;
      border: 2px solid rgba(139, 92, 246, 0.2);
      width: 100%;
      max-height: calc(100vh - 2rem);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .dialog-sm { max-width: 24rem; }
    .dialog-md { max-width: 28rem; }
    .dialog-lg { max-width: 32rem; }
    .dialog-xl { max-width: 40rem; }

    .dialog-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      padding: 2rem 2rem 0 2rem;
      border-bottom: 2px solid rgba(139, 92, 246, 0.1);
      flex-shrink: 0;
      background: #f8fafc;
    }

    .dialog-title-section {
      flex: 1;
    }

    .dialog-title {
      font-size: 1.5rem;
      font-weight: 800;
      color: #8b5cf6;
      margin: 0;
    }

    .dialog-subtitle {
      font-size: 0.875rem;
      color: #8b5cf6;
      margin: 0.5rem 0 0 0;
      font-weight: 500;
    }

    .dialog-close-btn {
      background: #f3f4f6;
      border: 2px solid rgba(139, 92, 246, 0.1);
      color: #8b5cf6;
      cursor: pointer;
      padding: 0.75rem;
      border-radius: 1rem;
      flex-shrink: 0;
      margin-left: 1rem;
    }

    .dialog-body {
      padding: 2rem;
      overflow-y: auto;
      flex: 1;
      min-height: 0;
      background: #ffffff;
    }

    .dialog-footer {
      display: flex;
      gap: 1rem;
      padding: 0 2rem 2rem 2rem;
      border-top: 2px solid rgba(139, 92, 246, 0.1);
      flex-shrink: 0;
      background: #f8fafc;
    }

    .dialog-btn {
      flex: 1;
      padding: 1rem 1.5rem;
      border-radius: 1rem;
      font-weight: 600;
      cursor: pointer;
      border: 2px solid transparent;
      font-size: 0.95rem;
    }

    .dialog-btn-cancel {
      background: #f3f4f6;
      color: #6b7280;
      border-color: rgba(107, 114, 128, 0.2);
    }

    .dialog-btn-confirm {
      background: #8b5cf6;
      color: white;
      border-color: rgba(139, 92, 246, 0.3);
    }

    .dialog-btn-primary { 
      background: #3b82f6; 
      color: white; 
      border-color: rgba(59, 130, 246, 0.3);
    }

    .dialog-btn-success { 
      background: #10b981; 
      color: white; 
      border-color: rgba(16, 185, 129, 0.3);
    }

    .dialog-btn-danger { 
      background: #ef4444; 
      color: white; 
      border-color: rgba(239, 68, 68, 0.3);
    }

    .dialog-btn-warning { 
      background: #f59e0b; 
      color: white; 
      border-color: rgba(245, 158, 11, 0.3);
    }


    /* Prevent body scroll when dialog is open */
    :host-context(body.dialog-open) {
      overflow: hidden;
    }
  `]
})
export class DialogComponent {
  @Input() config = signal<DialogConfig>({
    title: 'Dialog',
    showCloseButton: true,
    showCancelButton: true,
    showConfirmButton: true,
    size: 'md',
    preventBodyScroll: true
  });

  @Output() close = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();
  @Output() confirm = new EventEmitter<void>();

  ngOnInit() {
    if (this.config().preventBodyScroll) {
      document.body.classList.add('dialog-open');
    }
  }

  ngOnDestroy() {
    if (this.config().preventBodyScroll) {
      document.body.classList.remove('dialog-open');
    }
  }

  onOverlayClick(event: Event) {
    if (event.target === event.currentTarget) {
      this.onClose();
    }
  }

  onClose() {
    this.close.emit();
  }

  onCancel() {
    this.cancel.emit();
  }

  onConfirm() {
    this.confirm.emit();
  }
}
