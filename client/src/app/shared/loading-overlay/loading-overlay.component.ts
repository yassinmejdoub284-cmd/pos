import { Component, inject, computed, signal, effect, OnDestroy } from '@angular/core';
import { LoadingService } from '../../core/services/loading.service';

@Component({
  selector: 'app-loading-overlay',
  standalone: true,
  template: `
    @if (showOverlay()) {
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
              @if (displayCount() > 1) {
                <span class="text-gray-500 text-sm">
                  {{ displayCount() }} requêtes en cours
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
export class LoadingOverlayComponent implements OnDestroy {
  protected readonly loadingService = inject(LoadingService);
  private showTimeout: any = null;
  private hideTimeout: any = null;
  
  // Debounced display state to prevent flickering
  showOverlay = signal(false);
  displayCount = signal(0);
  
  // Track loading state with debounce
  private isLoading = computed(() => this.loadingService.isLoading());
  private requestCount = computed(() => this.loadingService.activeRequestCount());

  constructor() {
    // Debounce showing overlay (wait 300ms before showing to avoid flicker on fast requests)
    // Also add minimum display duration to prevent rapid flickering
    let minDisplayEndTime = 0;
    
    effect(() => {
      const loading = this.isLoading();
      const count = this.requestCount();
      
      if (loading) {
        // Clear any pending hide
        if (this.hideTimeout) {
          clearTimeout(this.hideTimeout);
          this.hideTimeout = null;
        }
        
        // Show overlay after delay (only if not already showing)
        if (!this.showOverlay() && !this.showTimeout) {
          this.showTimeout = setTimeout(() => {
            if (this.isLoading()) {
              this.showOverlay.set(true);
              this.displayCount.set(count);
              // Set minimum display time (at least 300ms visible)
              minDisplayEndTime = Date.now() + 300;
            }
            this.showTimeout = null;
          }, 300);
        } else if (this.showOverlay()) {
          // Update count immediately if already showing
          this.displayCount.set(count);
        }
      } else {
        // Clear any pending show
        if (this.showTimeout) {
          clearTimeout(this.showTimeout);
          this.showTimeout = null;
        }
        
        // Hide overlay only after minimum display time has passed
        if (this.showOverlay()) {
          const remainingTime = Math.max(0, minDisplayEndTime - Date.now());
          if (remainingTime > 0) {
            this.hideTimeout = setTimeout(() => {
              this.showOverlay.set(false);
              this.displayCount.set(0);
              this.hideTimeout = null;
            }, remainingTime);
          } else {
            this.showOverlay.set(false);
            this.displayCount.set(0);
          }
        }
      }
    });
  }

  ngOnDestroy(): void {
    if (this.showTimeout) {
      clearTimeout(this.showTimeout);
    }
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
    }
  }
}


