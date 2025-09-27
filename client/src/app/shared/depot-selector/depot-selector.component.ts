import { Component, Input, Output, EventEmitter, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DepotsService } from '../../core/services/depots.service';
import { SettingsService } from '../../core/services/settings.service';
import { Depot } from '../../core/models/depot.model';

@Component({
  selector: 'app-depot-selector',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="space-y-3">
      <label class="block text-sm font-medium text-slate-700">
        Sélectionner le dépôt
      </label>
      
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <div 
          *ngFor="let depot of depots" 
          (click)="selectDepot(depot)"
          [class]="getDepotCardClasses(depot)"
          class="cursor-pointer transition-all duration-200 hover:scale-105">
          
          <!-- Depot Logo -->
          <div class="w-12 h-12 mx-auto mb-3 rounded-lg overflow-hidden bg-slate-100 flex items-center justify-center">
            <img 
              *ngIf="getDepotLogo(depot.id)" 
              [src]="getDepotLogo(depot.id)" 
              [alt]="depot.name + ' logo'"
              class="w-full h-full object-cover"
              (error)="onImageError($event)">
            <div 
              *ngIf="!getDepotLogo(depot.id)" 
              class="w-full h-full bg-gradient-to-br from-slate-400 to-slate-600 flex items-center justify-center">
              <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path>
              </svg>
            </div>
          </div>
          
          <!-- Depot Info -->
          <div class="text-center">
            <h3 class="font-semibold text-slate-800 text-sm">{{ depot.name }}</h3>
            <p class="text-xs text-slate-500">{{ depot.code }}</p>
            <span class="inline-block px-2 py-1 text-xs rounded-full mt-1"
                  [class]="getTypeBadgeClasses(depot.type)">
              {{ getTypeLabel(depot.type) }}
            </span>
          </div>
        </div>
      </div>
      
      <!-- Selected Depot Display -->
      <div *ngIf="selectedDepot" class="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-lg overflow-hidden bg-slate-100 flex items-center justify-center">
            <img 
              *ngIf="getDepotLogo(selectedDepot.id)" 
              [src]="getDepotLogo(selectedDepot.id)" 
              [alt]="selectedDepot.name + ' logo'"
              class="w-full h-full object-cover"
              (error)="onImageError($event)">
            <div 
              *ngIf="!getDepotLogo(selectedDepot.id)" 
              class="w-full h-full bg-gradient-to-br from-slate-400 to-slate-600 flex items-center justify-center">
              <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path>
              </svg>
            </div>
          </div>
          <div>
            <span class="font-medium text-slate-800">{{ selectedDepot.name }}</span>
            <span class="text-sm text-slate-500 ml-2">{{ selectedDepot.code }}</span>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: []
})
export class DepotSelectorComponent implements OnInit {
  @Input() selectedDepotId: number | null = null;
  @Input() required = false;
  @Output() depotSelected = new EventEmitter<Depot | null>();

  depots: Depot[] = [];
  selectedDepot: Depot | null = null;
  depotLogos: Map<number, string> = new Map();

  private depotsService = inject(DepotsService);
  private settingsService = inject(SettingsService);

  ngOnInit(): void {
    this.loadDepots();
    this.loadDepotLogos();
  }

  private loadDepots(): void {
    this.depotsService.list().subscribe({
      next: (depots) => {
        this.depots = depots.filter(depot => depot.isActive);
        
        // Set selected depot if depotId is provided
        if (this.selectedDepotId) {
          this.selectedDepot = this.depots.find(d => d.id === this.selectedDepotId) || null;
        }
      },
      error: (error) => {
        console.error('Error loading depots:', error);
      }
    });
  }

  private loadDepotLogos(): void {
    // Load logos from settings for each depot
    this.settingsService.getSettings().subscribe({
      next: (settings: any) => {
        this.depots.forEach(depot => {
          const logoUrl = this.getDepotLogoFromSettings(depot.id, settings);
          if (logoUrl) {
            this.depotLogos.set(depot.id, logoUrl);
          }
        });
      },
      error: (error) => {
        console.error('Error loading depot logos from settings:', error);
      }
    });
  }

  private getDepotLogoFromSettings(depotId: number, settings: any): string | null {
    // Get depot-specific settings
    const depotSettings = settings[depotId.toString()];
    if (depotSettings && depotSettings.logoUrl) {
      // Convert relative URL to absolute URL
      return this.settingsService.getAbsoluteLogoUrl(depotSettings.logoUrl);
    }
    
    // Fallback to default settings
    const defaultSettings = settings['default'];
    if (defaultSettings && defaultSettings.logoUrl) {
      return this.settingsService.getAbsoluteLogoUrl(defaultSettings.logoUrl);
    }
    
    return null;
  }

  selectDepot(depot: Depot): void {
    this.selectedDepot = depot;
    this.depotSelected.emit(depot);
  }

  getDepotCardClasses(depot: Depot): string {
    const isSelected = this.selectedDepot?.id === depot.id;
    const baseClasses = 'p-4 rounded-xl border-2 transition-all duration-200';
    
    if (isSelected) {
      return `${baseClasses} border-fuchsia-500 bg-fuchsia-50 shadow-md`;
    }
    
    return `${baseClasses} border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm`;
  }

  getTypeBadgeClasses(type: string): string {
    switch (type) {
      case 'MAIN':
        return 'bg-blue-100 text-blue-700';
      case 'BRANCH':
        return 'bg-green-100 text-green-700';
      case 'SHOP':
        return 'bg-purple-100 text-purple-700';
      case 'WAREHOUSE':
        return 'bg-orange-100 text-orange-700';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  }

  getTypeLabel(type: string): string {
    switch (type) {
      case 'MAIN':
        return 'Principal';
      case 'BRANCH':
        return 'Succursale';
      case 'SHOP':
        return 'Magasin';
      case 'WAREHOUSE':
        return 'Entrepôt';
      default:
        return type;
    }
  }

  getDepotLogo(depotId: number): string | null {
    return this.depotLogos.get(depotId) || null;
  }

  onImageError(event: any): void {
    // Hide broken images
    event.target.style.display = 'none';
  }
}
