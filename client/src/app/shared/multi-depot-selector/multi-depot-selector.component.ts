import { Component, Input, Output, EventEmitter, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DepotsService } from '../../core/services/depots.service';
import { SettingsService } from '../../core/services/settings.service';
import { Depot, DepotType } from '../../core/models/depot.model';

@Component({
  selector: 'app-multi-depot-selector',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="space-y-3">
      <label class="block text-sm font-medium text-slate-700">
        Sélectionner les dépôts *
      </label>
      
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
        <div 
          *ngFor="let depot of filteredDepots" 
          (click)="toggleDepot(depot)"
          [class]="getDepotCardClasses(depot)"
          class="cursor-pointer transition-all duration-200">
          
          <!-- Depot Logo -->
          <div class="w-10 h-10 mx-auto mb-2 rounded-lg overflow-hidden bg-slate-100 flex items-center justify-center">
            <img 
              *ngIf="getDepotLogo(depot.id)" 
              [src]="getDepotLogo(depot.id)" 
              [alt]="depot.name + ' logo'"
              class="w-full h-full object-cover"
              (error)="onImageError($event)">
            <div 
              *ngIf="!getDepotLogo(depot.id)" 
              [class]="getDepotIconBackgroundClasses(depot.type)">
              <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" [attr.d]="getDepotIcon(depot.type)"></path>
              </svg>
            </div>
          </div>
          
          <!-- Depot Info -->
          <div class="text-center">
            <h3 class="font-semibold text-slate-800 text-xs">{{ depot.name }}</h3>
            <p class="text-xs text-slate-500">{{ depot.code }}</p>
            <span class="inline-block px-1.5 py-0.5 text-xs rounded-full mt-1"
                  [class]="getTypeBadgeClasses(depot.type)">
              {{ getTypeLabel(depot.type) }}
            </span>
          </div>
          
          <!-- Selection Indicator -->
          <div *ngIf="isDepotSelected(depot)" class="absolute top-1.5 right-1.5 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
            <svg class="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
            </svg>
          </div>
        </div>
      </div>
      
      <!-- Selected Depots Display -->
      <div *ngIf="selectedDepots.length > 0" class="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
        <div class="flex items-center justify-between mb-2">
          <span class="text-sm font-medium text-slate-700">Dépôts sélectionnés ({{ selectedDepots.length }})</span>
          <button type="button" (click)="clearAll()" class="text-xs text-red-600">
            Tout désélectionner
          </button>
        </div>
        <div class="flex flex-wrap gap-2">
          <div *ngFor="let depot of selectedDepots" class="flex items-center gap-2 bg-white px-3 py-1 rounded-lg border border-slate-200">
            <div class="w-6 h-6 rounded overflow-hidden bg-slate-100 flex items-center justify-center">
              <img 
                *ngIf="getDepotLogo(depot.id)" 
                [src]="getDepotLogo(depot.id)" 
                [alt]="depot.name + ' logo'"
                class="w-full h-full object-cover"
                (error)="onImageError($event)">
              <div 
                *ngIf="!getDepotLogo(depot.id)" 
                [class]="getDepotIconBackgroundClasses(depot.type)">
                <svg class="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" [attr.d]="getDepotIcon(depot.type)"></path>
                </svg>
              </div>
            </div>
            <span class="text-sm text-slate-800">{{ depot.name }}</span>
            <button type="button" (click)="removeDepot(depot)" class="text-red-500 ">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>
        </div>
      </div>
      
      <!-- Error Message -->
      <div *ngIf="required && selectedDepots.length === 0" class="text-sm text-red-600">
        Veuillez sélectionner au moins un dépôt
      </div>
    </div>
  `,
  styles: []
})
export class MultiDepotSelectorComponent implements OnInit {
  @Input() selectedDepotIds: number[] = [];
  @Input() required = false;
  @Input() allowedDepotTypes: DepotType[] = ['SHOP']; // Default to SHOP, can be overridden
  @Output() depotsSelected = new EventEmitter<number[]>();

  allDepots: Depot[] = [];
  filteredDepots: Depot[] = [];
  selectedDepots: Depot[] = [];
  depotLogos: Map<number, string> = new Map();

  private depotsService = inject(DepotsService);
  private settingsService = inject(SettingsService);

  ngOnInit(): void {
    this.loadDepots();
  }

  private loadDepots(): void {
    this.depotsService.list().subscribe({
      next: (depots) => {
        this.allDepots = depots;
        // Filter depots based on allowed types
        this.filteredDepots = depots.filter(depot => 
          this.allowedDepotTypes.includes(depot.type)
        );
        this.updateSelectedDepots();
        this.loadDepotLogos();
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
        this.filteredDepots.forEach(depot => {
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

  private updateSelectedDepots(): void {
    this.selectedDepots = this.filteredDepots.filter(depot => 
      this.selectedDepotIds.includes(depot.id)
    );
  }

  toggleDepot(depot: Depot): void {
    if (this.isDepotSelected(depot)) {
      this.removeDepot(depot);
    } else {
      this.addDepot(depot);
    }
  }

  addDepot(depot: Depot): void {
    if (!this.isDepotSelected(depot)) {
      this.selectedDepots.push(depot);
      this.emitSelection();
    }
  }

  removeDepot(depot: Depot): void {
    this.selectedDepots = this.selectedDepots.filter(d => d.id !== depot.id);
    this.emitSelection();
  }

  clearAll(): void {
    this.selectedDepots = [];
    this.emitSelection();
  }

  private emitSelection(): void {
    const selectedIds = this.selectedDepots.map(depot => depot.id);
    this.depotsSelected.emit(selectedIds);
  }

  isDepotSelected(depot: Depot): boolean {
    return this.selectedDepots.some(selected => selected.id === depot.id);
  }

  getDepotCardClasses(depot: Depot): string {
    const baseClasses = 'relative p-3 rounded-xl border-2 transition-all duration-200';
    const selectedClasses = this.isDepotSelected(depot) 
      ? 'border-green-500 bg-green-50 shadow-lg' 
      : 'border-slate-200 bg-white';
    
    return `${baseClasses} ${selectedClasses}`;
  }

  getTypeBadgeClasses(type: string): string {
    const typeClasses: { [key: string]: string } = {
      'MAIN': 'bg-blue-100 text-blue-800',
      'BRANCH': 'bg-purple-100 text-purple-800',
      'SHOP': 'bg-green-100 text-green-800',
      'WAREHOUSE': 'bg-orange-100 text-orange-800'
    };
    return typeClasses[type] || 'bg-slate-100 text-slate-800';
  }

  getTypeLabel(type: string): string {
    const typeLabels: { [key: string]: string } = {
      'MAIN': 'Principal',
      'BRANCH': 'Succursale',
      'SHOP': 'Magasin',
      'WAREHOUSE': 'Entrepôt'
    };
    return typeLabels[type] || type;
  }

  getDepotLogo(depotId: number): string | null {
    return this.depotLogos.get(depotId) || null;
  }

  onImageError(event: Event): void {
    const target = event.target as HTMLImageElement;
    target.style.display = 'none';
  }

  getDepotIconBackgroundClasses(type: string): string {
    const bgClasses: { [key: string]: string } = {
      'MAIN': 'w-full h-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center',
      'BRANCH': 'w-full h-full bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center',
      'SHOP': 'w-full h-full bg-gradient-to-br from-green-500 to-green-700 flex items-center justify-center',
      'WAREHOUSE': 'w-full h-full bg-gradient-to-br from-orange-500 to-orange-700 flex items-center justify-center'
    };
    return bgClasses[type] || 'w-full h-full bg-gradient-to-br from-slate-400 to-slate-600 flex items-center justify-center';
  }

  getDepotIcon(type: string): string {
    const icons: { [key: string]: string } = {
      'MAIN': 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6', // Home/Main building
      'BRANCH': 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4', // Building
      'SHOP': 'M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z', // Shopping bag
      'WAREHOUSE': 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4' // Warehouse/Box
    };
    return icons[type] || 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4';
  }
}
