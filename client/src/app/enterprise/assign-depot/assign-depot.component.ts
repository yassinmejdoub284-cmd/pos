import { Component, EventEmitter, Input, Output } from '@angular/core';
import { EnterpriseService } from '../../core/services/enterprise.service';

interface Depot {
  id: number;
  name: string;
  code: string;
  ville: string;
  statut: 'Actif' | 'Inactif';
  companyId?: number;
}

@Component({
  selector: 'app-assign-depot',
  standalone: false,
  template: `
    <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        <!-- Header -->
        <div class="p-6 border-b border-gray-200">
          <div class="flex items-center justify-between">
            <div class="flex items-center space-x-3">
              <div class="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path>
                </svg>
              </div>
              <div>
                <h2 class="text-xl font-semibold text-gray-800">Assigner des Entrepôts</h2>
                <p class="text-sm text-gray-600">Sélectionnez des entrepôts à assigner à cette société</p>
              </div>
            </div>
            <button 
              (click)="closeDialog()"
              class="p-2 bg-gray-100 rounded-xl text-gray-600 hover:bg-gray-200 transition-colors">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>
        </div>
        
        <!-- Recherche et Filtres -->
        <div class="p-6 border-b border-gray-200 bg-gray-50/50">
          <div class="flex items-center space-x-4">
            <div class="flex-1 relative">
              <input 
                type="text" 
                placeholder="Rechercher des entrepôts..."
                [(ngModel)]="searchTerm"
                class="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300">
              <svg class="absolute left-3 top-3.5 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
              </svg>
            </div>
            <select 
              [(ngModel)]="statusFilter"
              class="px-4 py-3 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300">
              <option value="">Tous les statuts</option>
              <option value="Actif">Actif</option>
              <option value="Inactif">Inactif</option>
            </select>
          </div>
        </div>
        
        <!-- Liste des Entrepôts -->
        <div class="p-6 max-h-96 overflow-y-auto">
          <div *ngIf="filteredDepots.length === 0" class="text-center py-8">
            <svg class="w-12 h-12 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path>
            </svg>
            <h3 class="text-lg font-semibold text-gray-600 mb-2">Aucun entrepôt disponible</h3>
            <p class="text-gray-500">Tous les entrepôts sont déjà assignés à des sociétés</p>
          </div>
          
          <div *ngIf="filteredDepots.length > 0" class="space-y-3">
            <div 
              *ngFor="let depot of filteredDepots" 
              class="bg-white border border-gray-200 rounded-xl p-4 hover:border-blue-300 transition-colors cursor-pointer"
              [class.border-blue-500]="selectedDepots.includes(depot.id)"
              (click)="toggleDepot(depot.id)">
              
              <div class="flex items-center space-x-4">
                <div class="flex items-center">
                  <input 
                    type="checkbox" 
                    [checked]="selectedDepots.includes(depot.id)"
                    (change)="toggleDepot(depot.id)"
                    class="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500">
                </div>
                
                <div class="flex-1">
                  <div class="flex items-center justify-between">
                    <h3 class="font-semibold text-gray-800">{{ depot.name }}</h3>
                    <span class="bg-white/80 backdrop-blur-sm px-2 py-1 rounded-lg text-xs font-medium"
                          [class]="depot.statut === 'Actif' ? 'text-green-600' : 'text-gray-500'">
                      {{ depot.statut }}
                    </span>
                  </div>
                  <div class="flex items-center space-x-4 mt-1 text-sm text-gray-600">
                    <div class="flex items-center space-x-1">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"></path>
                      </svg>
                      <span>{{ depot.code }}</span>
                    </div>
                    <div class="flex items-center space-x-1">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
                      </svg>
                      <span>{{ depot.ville }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Pied de page -->
        <div class="p-6 border-t border-gray-200 bg-gray-50/50">
          <div class="flex items-center justify-between">
            <div class="text-sm text-gray-600">
              <span *ngIf="selectedDepots.length > 0">{{ selectedDepots.length }} entrepôt(s) sélectionné(s)</span>
            </div>
            <div class="flex items-center space-x-3">
              <button 
                (click)="closeDialog()"
                class="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors">
                Annuler
              </button>
              <button 
                (click)="assignSelectedDepots()"
                [disabled]="selectedDepots.length === 0"
                class="px-6 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl font-medium shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed">
                Assigner {{ selectedDepots.length }} entrepôt(s)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
})
export class AssignDepotComponent {
  @Input() companyId: number = 0;
  @Output() depotsAssigned = new EventEmitter<number[]>();
  @Output() dialogClosed = new EventEmitter<void>();
  
  searchTerm = '';
  statusFilter = '';
  selectedDepots: number[] = [];
  
  availableDepots: Depot[] = [];

  constructor(private enterpriseService: EnterpriseService) {}

  ngOnInit(): void {
    this.enterpriseService.listUnassignedDepots(this.companyId).subscribe((depots: any[]) => {
      this.availableDepots = depots.map(d => ({
        id: d.id,
        name: d.name,
        code: d.code,
        ville: d.city,
        statut: d.isActive ? 'Actif' : 'Inactif'
      }));
    });
  }
  
  get filteredDepots(): Depot[] {
    let filtered = this.availableDepots;
    
    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(depot => 
        depot.name.toLowerCase().includes(term) ||
        depot.code.toLowerCase().includes(term) ||
        depot.ville.toLowerCase().includes(term)
      );
    }
    
    if (this.statusFilter) {
      filtered = filtered.filter(depot => depot.statut === this.statusFilter);
    }
    
    return filtered;
  }
  
  toggleDepot(depotId: number): void {
    const index = this.selectedDepots.indexOf(depotId);
    if (index > -1) {
      this.selectedDepots.splice(index, 1);
    } else {
      this.selectedDepots.push(depotId);
    }
  }
  
  assignSelectedDepots(): void {
    if (this.selectedDepots.length > 0) {
      this.enterpriseService.assignDepots(this.companyId, this.selectedDepots).subscribe(() => {
        this.depotsAssigned.emit(this.selectedDepots);
        this.closeDialog();
      });
    }
  }
  
  closeDialog(): void {
    this.dialogClosed.emit();
  }
}
