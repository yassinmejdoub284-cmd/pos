import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProductsService } from '../../../core/services/products.service';
import { ProductConservation } from '../../../core/models/product.model';

@Component({
  selector: 'app-conservation-warnings',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div *ngIf="warnings.length > 0" class="bg-yellow-900/30 border border-yellow-500/50 rounded-xl p-4 mb-4">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-lg font-semibold text-yellow-400 flex items-center">
          <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
          </svg>
          Avertissements de Conservation
        </h3>
        <button (click)="dismissAll()" class="text-yellow-400 hover:text-yellow-300 text-sm">
          Ignorer tout
        </button>
      </div>
      
      <div class="space-y-2 max-h-60 overflow-y-auto">
        <div *ngFor="let warning of warnings" class="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-3">
          <div class="flex items-center justify-between">
            <div class="flex-1">
              <div class="flex items-center space-x-2">
                <span class="font-medium text-yellow-300">{{ warning.product?.name }}</span>
                <span class="text-yellow-400 text-sm">{{ warning.depot?.name }}</span>
              </div>
              <div class="text-yellow-400 text-sm mt-1">
                <span *ngIf="isExpired(warning)" class="text-red-400 font-medium">EXPIRÉ</span>
                <span *ngIf="!isExpired(warning)" class="text-yellow-400 font-medium">Expire bientôt</span>
                <span class="ml-2">
                  {{ warning.remainingQuantity }} {{ warning.product?.unite }} restant(s)
                </span>
              </div>
              <div class="text-yellow-500 text-xs mt-1">
                Production: {{ warning.productionDate | date:'dd/MM/yyyy' }} | 
                Expiration: {{ warning.expirationDate | date:'dd/MM/yyyy' }}
              </div>
            </div>
            <button (click)="dismissWarning(warning.id)" 
              class="text-yellow-400 hover:text-yellow-300 ml-2">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  `
})
export class ConservationWarningsComponent implements OnInit {
  @Input() show = true;
  @Output() warningsUpdated = new EventEmitter<void>();

  warnings: ProductConservation[] = [];

  constructor(private productsService: ProductsService) {}

  ngOnInit(): void {
    if (this.show) {
      this.loadWarnings();
    }
  }

  loadWarnings(): void {
    this.productsService.getConservationWarnings().subscribe({
      next: (warnings) => {
        this.warnings = warnings;
      },
      error: (error) => {
        console.error('Error loading conservation warnings:', error);
      }
    });
  }

  dismissWarning(conservationId: number): void {
    this.productsService.dismissConservationWarning(conservationId).subscribe({
      next: () => {
        this.warnings = this.warnings.filter(w => w.id !== conservationId);
        this.warningsUpdated.emit();
      },
      error: (error) => {
        console.error('Error dismissing warning:', error);
      }
    });
  }

  dismissAll(): void {
    const dismissPromises = this.warnings.map(warning => 
      this.productsService.dismissConservationWarning(warning.id).toPromise()
    );
    
    Promise.all(dismissPromises).then(() => {
      this.warnings = [];
      this.warningsUpdated.emit();
    }).catch(error => {
      console.error('Error dismissing all warnings:', error);
    });
  }

  isExpired(warning: ProductConservation): boolean {
    return new Date(warning.expirationDate) <= new Date();
  }
} 