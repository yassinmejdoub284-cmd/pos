import { Component, inject } from '@angular/core';
import { LoadingService } from '../../core/services/loading.service';

@Component({
  selector: 'app-loading-overlay',
  standalone: true,
  template: `
    @if (loadingService.isLoading()) {
      <div class="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-[9999]">
        <div class="bg-white rounded-2xl p-8 shadow-xl border border-gray-200/50 max-w-sm mx-4">
          <div class="flex flex-col items-center space-y-4">
            <!-- Spinner -->
            <div class="relative">
              <div class="loading-spinner rounded-full h-12 w-12 border-4 border-gray-300 border-t-amber-500 animate-spin"></div>
              <div class="absolute inset-0 rounded-full h-12 w-12 border-4 border-transparent border-r-amber-300 animate-pulse"></div>
            </div>
            
            <!-- Loading text -->
            <div class="text-center">
              <span class="text-gray-800 font-semibold text-lg block">Chargement...</span>
              @if (loadingService.activeRequestCount() > 1) {
                <span class="text-gray-500 text-sm">
                  {{ loadingService.activeRequestCount() }} requêtes en cours
                </span>
              }
            </div>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .loading-spinner {
      animation: spin 1s linear infinite;
    }
    
    @keyframes spin {
      from {
        transform: rotate(0deg);
      }
      to {
        transform: rotate(360deg);
      }
    }
  `]
})
export class LoadingOverlayComponent {
  protected readonly loadingService = inject(LoadingService);
}


