import { Component, Input, Output, EventEmitter, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { VehicleBrand } from '../../core/models/vehicle.model';
import { VehiclesService } from '../../core/services/vehicles.service';

@Component({
  selector: 'app-brand-selector',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="space-y-4">
      <label class="block text-sm font-semibold text-slate-700">
        {{ label }}
        <span *ngIf="required" class="text-red-500">*</span>
      </label>
      
      <!-- Selected Brand Display -->
      <div *ngIf="selectedBrand()" class="bg-white border border-slate-300 rounded-xl p-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <!-- Brand Logo -->
            <div class="w-12 h-12 rounded-lg flex items-center justify-center overflow-hidden"
                 [class]="getBrandLogo(selectedBrand()!) ? 'bg-white border border-slate-200' : 'bg-gradient-to-br from-purple-500 to-indigo-600'">
              <img 
                *ngIf="getBrandLogo(selectedBrand()!)" 
                [src]="getBrandLogo(selectedBrand()!)" 
                [alt]="selectedBrand()!.name + ' logo'"
                title="Logo de {{ selectedBrand()!.name }}"
                class="w-full h-full object-contain p-1"
                (error)="onImageError($event)">
              <svg 
                *ngIf="!getBrandLogo(selectedBrand()!)" 
                class="w-6 h-6 text-white" 
                fill="currentColor" 
                viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clip-rule="evenodd"></path>
              </svg>
            </div>
            
            <!-- Brand Info -->
            <div>
              <h3 class="font-semibold text-slate-800">{{ selectedBrand()!.name }}</h3>
              <p class="text-sm text-slate-600">{{ selectedBrand()!.models.length }} modèle(s)</p>
            </div>
          </div>
          
          <!-- Change Button -->
          <button 
            type="button"
            (click)="showBrandSelection = true"
            class="px-3 py-1 text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors">
            Changer
          </button>
        </div>
      </div>
      
      <!-- Select Brand Button -->
      <button 
        *ngIf="!selectedBrand()"
        type="button"
        (click)="showBrandSelection = true"
        class="w-full p-4 border-2 border-dashed border-slate-300 rounded-xl hover:border-purple-400 hover:bg-purple-50 transition-all duration-200 text-center">
        <div class="flex flex-col items-center gap-2">
          <svg class="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
          </svg>
          <span class="text-slate-600 font-medium">Sélectionner une marque</span>
        </div>
      </button>
    </div>

    <!-- Brand Selection Modal -->
    <div *ngIf="showBrandSelection" class="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-6">
      <div class="bg-white rounded-3xl max-w-6xl w-full max-h-[90vh] overflow-hidden shadow-2xl">
        <!-- Modal Header -->
        <div class="p-8 border-b border-slate-200">
          <div class="flex items-center justify-between">
            <h3 class="text-3xl font-bold text-slate-800">Sélectionner une marque</h3>
            <button 
              type="button"
              (click)="closeBrandSelection()"
              class="p-3 hover:bg-slate-100 rounded-xl transition-colors"
              title="Fermer">
              <svg class="w-6 h-6 text-slate-600" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
              </svg>
            </button>
          </div>
        </div>

        <!-- Search -->
        <div class="p-8 border-b border-slate-200">
          <div class="relative">
            <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <svg class="h-6 w-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
              </svg>
            </div>
            <input 
              type="text" 
              [(ngModel)]="searchQuery"
              (input)="filterBrands()"
              placeholder="Rechercher une marque..."
              class="block w-full pl-12 pr-4 py-4 text-lg border border-slate-300 rounded-xl leading-5 bg-white placeholder-slate-500 focus:outline-none focus:placeholder-slate-400 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-slate-900">
          </div>
        </div>

        <!-- Brands Grid -->
        <div class="p-8 overflow-y-auto max-h-[60vh]">
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div *ngFor="let brand of filteredBrands" 
                 (click)="selectBrand(brand)"
                 class="cursor-pointer p-6 border border-slate-200 rounded-xl hover:border-purple-400 hover:bg-purple-50 transition-all duration-200"
                 [class]="getBrandCardClasses(brand)">
              
              <!-- Brand Logo -->
              <div class="w-20 h-20 rounded-xl flex items-center justify-center mx-auto mb-4 overflow-hidden"
                   [class]="getBrandLogo(brand) ? 'bg-white border border-slate-200' : 'bg-gradient-to-br from-purple-500 to-indigo-600'">
                <img 
                  *ngIf="getBrandLogo(brand)" 
                  [src]="getBrandLogo(brand)" 
                  [alt]="brand.name + ' logo'"  
                  title="Logo de {{ brand.name }}"
                  class="w-full h-full object-contain p-2"
                  (error)="onImageError($event)">
                <svg 
                  *ngIf="!getBrandLogo(brand)" 
                  class="w-8 h-8 text-white" 
                  fill="currentColor" 
                  viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clip-rule="evenodd"></path>
                </svg>
              </div>

              <!-- Brand Info -->
              <div class="text-center">
                <h4 class="font-semibold text-slate-800 mb-2 text-lg">{{ brand.name }}</h4>
                <p class="text-base text-slate-600">{{ brand.models.length }} modèle(s)</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
})
export class BrandSelectorComponent implements OnInit {
  @Input() selectedBrandId: number | null = null;
  @Input() required = false;
  @Input() label = 'Marque';
  @Output() brandSelected = new EventEmitter<VehicleBrand | null>();

  selectedBrand = signal<VehicleBrand | null>(null);
  showBrandSelection = false;
  allBrands: VehicleBrand[] = [];
  filteredBrands: VehicleBrand[] = [];
  searchQuery = '';
  loading = false;

  constructor(private vehiclesService: VehiclesService) {}

  ngOnInit(): void {
    this.loadBrands();
  }

  private loadBrands(): void {
    this.loading = true;
    this.vehiclesService.getVehicleBrands().subscribe({
      next: (brands) => {
        this.allBrands = brands;
        this.filteredBrands = brands;
        this.loading = false;
        
        // Set selected brand if ID is provided
        if (this.selectedBrandId) {
          const brand = brands.find(b => b.id === this.selectedBrandId);
          if (brand) {
            this.selectedBrand.set(brand);
          }
        }
      },
      error: (error) => {
        console.error('Error loading brands:', error);
        this.loading = false;
      }
    });
  }

  selectBrand(brand: VehicleBrand): void {
    this.selectedBrand.set(brand);
    this.brandSelected.emit(brand);
    this.closeBrandSelection();
  }

  closeBrandSelection(): void {
    this.showBrandSelection = false;
    this.searchQuery = '';
    this.filteredBrands = this.allBrands;
  }

  filterBrands(): void {
    if (!this.searchQuery.trim()) {
      this.filteredBrands = this.allBrands;
      return;
    }

    const query = this.searchQuery.toLowerCase();
    this.filteredBrands = this.allBrands.filter(brand =>
      brand.name.toLowerCase().includes(query)
    );
  }

  getBrandLogo(brand: VehicleBrand): string | null {
    return brand.logoUrl || null;
  }

  onImageError(event: any): void {
    event.target.style.display = 'none';
  }

  getBrandCardClasses(brand: VehicleBrand): string {
    const isSelected = this.selectedBrand()?.id === brand.id;
    return isSelected 
      ? 'border-purple-500 bg-purple-50' 
      : 'border-slate-200 hover:border-purple-400 hover:bg-purple-50';
  }
}
