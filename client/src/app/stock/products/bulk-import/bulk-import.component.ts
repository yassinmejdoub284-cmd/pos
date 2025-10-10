import { Component, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-bulk-import',
  template: `
    <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2">
      <div class="bg-white rounded-xl border border-gray-200 w-full max-w-md shadow-2xl">
        <div class="flex justify-between items-center p-4 border-b border-gray-200">
          <h3 class="text-lg font-semibold text-gray-800">Import CSV</h3>
          <button (click)="onCancel()" class="text-gray-500">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>
        
        <div class="p-4">
          <p class="text-gray-600 mb-4">Fonctionnalité d'import en cours de développement...</p>
        </div>
        
        <div class="flex space-x-3 p-4 border-t border-gray-200 bg-gray-50">
          <button (click)="onCancel()" class="flex-1 bg-gray-200 text-gray-800 font-semibold py-3 px-4 rounded-xl transition-all">
            Fermer
          </button>
        </div>
      </div>
    </div>
  `,
  standalone: false
})
export class BulkImportComponent {
  @Output() completed = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

  onCancel(): void {
    this.cancelled.emit();
  }
} 