import { Component, Input, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogComponent, DialogConfig } from '../../shared/dialog/dialog.component';
import { Salon, Table } from '../../core/services/salon.service';

const COLOR_PALETTE = [
  '#3B82F6', // Blue
  '#EF4444', // Red
  '#10B981', // Green
  '#F59E0B', // Yellow
  '#8B5CF6', // Purple
  '#F97316', // Orange
  '#06B6D4', // Cyan
  '#84CC16', // Lime
  '#EC4899', // Pink
  '#6B7280', // Gray
  '#14B8A6', // Teal
  '#F43F5E'  // Rose
];

@Component({
  selector: 'app-add-table-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, DialogComponent],
  template: `
    <app-dialog [config]="dialogConfig" 
                (close)="onClose()" 
                (cancel)="onClose()" 
                (confirm)="onAdd()">
      
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Salon *</label>
          <select [(ngModel)]="newTable.salonId" 
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500">
            @for (salon of salons; track salon.id) {
              <option [value]="salon.id">{{ salon.name }} ({{ getTablesCountBySalon(salon.id) }}/{{ salon.maxTables }})</option>
            }
          </select>
        </div>
        
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Nom de la table *</label>
          <input type="text" [(ngModel)]="newTable.name" 
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            placeholder="Ex: Table VIP, Table Terrasse">
        </div>
        
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Numéro de table *</label>
          <input type="text" [(ngModel)]="newTable.number" 
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            placeholder="Ex: T7, Table 1, VIP-1">
        </div>
        
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Couleur de la table</label>
          <div class="grid grid-cols-6 gap-2">
            @for (color of colorPalette; track color) {
              <button type="button" 
                (click)="selectColor(color)"
                class="w-8 h-8 rounded-full border-2 transition-all duration-200"
                [class]="newTable.color === color ? 'border-gray-800 scale-110' : 'border-gray-300 hover:border-gray-500'"
                [style.background-color]="color"
                [title]="color">
              </button>
            }
          </div>
        </div>
        
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Notes (optionnel)</label>
          <textarea [(ngModel)]="newTable.notes" rows="3"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            placeholder="Notes sur cette table..."></textarea>
        </div>
      </div>
    </app-dialog>
  `
})
export class AddTableDialogComponent {
  @Input() salons: Salon[] = [];
  @Input() getTablesCountBySalon: (salonId: number) => number = () => 0;
  @Output() close = new EventEmitter<void>();
  @Output() add = new EventEmitter<Partial<Table>>();

  colorPalette = COLOR_PALETTE;
  
  newTable = {
    name: '',
    number: '',
    color: COLOR_PALETTE[0],
    salonId: 1,
    notes: ''
  };

  dialogConfig = signal<DialogConfig>({
    title: 'Ajouter une Table',
    showCancelButton: true,
    showConfirmButton: true,
    cancelText: 'Annuler',
    confirmText: 'Ajouter',
    confirmColor: 'success',
    size: 'md',
    preventBodyScroll: true
  });

  selectColor(color: string): void {
    this.newTable.color = color;
  }

  onClose(): void {
    this.close.emit();
  }

  onAdd(): void {
    if (this.newTable.name && this.newTable.number && this.newTable.salonId) {
      this.add.emit(this.newTable);
    }
  }
}
