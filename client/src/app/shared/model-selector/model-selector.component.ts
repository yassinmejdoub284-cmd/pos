import { Component, Input, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-model-selector',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="space-y-4">
      <label class="block text-sm font-semibold text-slate-700">
        {{ label }}
        <span *ngIf="required" class="text-red-500">*</span>
      </label>
      
      <!-- Selected Model Display -->
      <div *ngIf="selectedModel()" class="bg-white border border-slate-300 rounded-xl p-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <!-- Model Icon -->
            <div class="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
              <svg class="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clip-rule="evenodd"></path>
              </svg>
            </div>
            
            <!-- Model Info -->
            <div>
              <h3 class="font-semibold text-slate-800">{{ selectedModel() }}</h3>
              <p class="text-sm text-slate-600">Modèle sélectionné</p>
            </div>
          </div>
          
          <!-- Change Button -->
          <button 
            type="button"
            (click)="showModelSelection = true"
            class="px-3 py-1 text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors">
            Changer
          </button>
        </div>
      </div>
      
      <!-- Select Model Button -->
      <button 
        *ngIf="!selectedModel()"
        type="button"
        (click)="showModelSelection = true"
        [disabled]="!availableModels.length"
        class="w-full p-4 border-2 border-dashed border-slate-300 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-all duration-200 text-center disabled:opacity-50 disabled:cursor-not-allowed">
        <div class="flex flex-col items-center gap-2">
          <svg class="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
          </svg>
          <span class="text-slate-600 font-medium">
            {{ availableModels.length ? 'Sélectionner un modèle' : 'Aucun modèle disponible' }}
          </span>
        </div>
      </button>
    </div>

    <!-- Model Selection Modal -->
    <div *ngIf="showModelSelection" class="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-6">
      <div class="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl">
        <!-- Modal Header -->
        <div class="p-8 border-b border-slate-200">
          <div class="flex items-center justify-between">
            <h3 class="text-3xl font-bold text-slate-800">Sélectionner un modèle</h3>
            <button 
              type="button"
              (click)="closeModelSelection()"
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
            <div class="absolute inset-y-0 right-0 pl-4 flex items-center pointer-events-none">
              <svg class="h-6 w-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
              </svg>
            </div>
            <input 
              type="text" 
              [(ngModel)]="searchQuery"
              (input)="filterModels()"
              placeholder="Rechercher un modèle..."
              class="block w-full pl-12 pr-4 py-4 text-lg border border-slate-300 rounded-xl leading-5 bg-white placeholder-slate-500 focus:outline-none focus:placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900">
          </div>
        </div>

        <!-- Models Grid -->
        <div class="p-8 overflow-y-auto max-h-[60vh]">
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div *ngFor="let model of filteredModels" 
                 (click)="selectModel(model)"
                 class="cursor-pointer p-6 border border-slate-200 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-all duration-200"
                 [class]="getModelCardClasses(model)">
              
              <!-- Model Icon -->
              <div class="w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center mx-auto mb-4">
                <svg class="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clip-rule="evenodd"></path>
                </svg>
              </div>

              <!-- Model Name -->
              <div class="text-center">
                <h4 class="font-semibold text-slate-800 text-lg">{{ model }}</h4>
              </div>
            </div>
          </div>
          
          <!-- No Models Message -->
          <div *ngIf="!filteredModels.length" class="text-center py-8">
            <svg class="w-12 h-12 text-slate-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
            </svg>
            <p class="text-slate-500">Aucun modèle trouvé</p>
          </div>
        </div>
      </div>
    </div>
  `
})
export class ModelSelectorComponent {
  @Input() availableModels: string[] = [];
  @Input() selectedModelValue: string | null = null;
  @Input() required = false;
  @Input() label = 'Modèle';
  @Output() modelSelected = new EventEmitter<string | null>();

  selectedModel = signal<string | null>(null);
  showModelSelection = false;
  filteredModels: string[] = [];
  searchQuery = '';

  ngOnInit(): void {
    this.filteredModels = this.availableModels;
    if (this.selectedModelValue) {
      this.selectedModel.set(this.selectedModelValue);
    }
  }

  ngOnChanges(): void {
    this.filteredModels = this.availableModels;
    if (this.selectedModelValue) {
      this.selectedModel.set(this.selectedModelValue);
    }
  }

  selectModel(model: string): void {
    this.selectedModel.set(model);
    this.modelSelected.emit(model);
    this.closeModelSelection();
  }

  closeModelSelection(): void {
    this.showModelSelection = false;
    this.searchQuery = '';
    this.filteredModels = this.availableModels;
  }

  filterModels(): void {
    if (!this.searchQuery.trim()) {
      this.filteredModels = this.availableModels;
      return;
    }

    const query = this.searchQuery.toLowerCase();
    this.filteredModels = this.availableModels.filter(model =>
      model.toLowerCase().includes(query)
    );
  }

  getModelCardClasses(model: string): string {
    const isSelected = this.selectedModel() === model;
    return isSelected 
      ? 'border-blue-500 bg-blue-50' 
      : 'border-slate-200 hover:border-blue-400 hover:bg-blue-50';
  }
}
