import { Component, Input, Output, EventEmitter, signal, OnInit } from '@angular/core';
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
  selector: 'app-edit-table-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, DialogComponent],
  template: `
    <app-dialog [config]="dialogConfig" 
                (close)="onClose()" 
                (cancel)="onClose()" 
                (confirm)="onUpdate()">
      
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Salon *</label>
          <select [(ngModel)]="editTable.salonId" 
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500">
            @for (salon of salons; track salon.id) {
              <option [value]="salon.id">{{ salon.name }} ({{ getTablesCountBySalon(salon.id) }}/{{ salon.maxTables }})</option>
            }
          </select>
        </div>
        
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Nom de la table *</label>
          <input type="text" [(ngModel)]="editTable.name" 
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            placeholder="Ex: Table VIP, Table Terrasse">
        </div>
        
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Numéro de table *</label>
          <input type="text" [(ngModel)]="editTable.number" 
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
                [class]="editTable.color === color ? 'border-gray-800 scale-110' : 'border-gray-300 hover:border-gray-500'"
                [style.background-color]="color"
                [title]="color">
              </button>
            }
          </div>
        </div>
        
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Notes (optionnel)</label>
          <textarea [(ngModel)]="editTable.notes" rows="3"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            placeholder="Notes sur cette table..."></textarea>
        </div>
      </div>
    </app-dialog>
  `
})
export class EditTableDialogComponent implements OnInit {
  @Input() table: Table | null = null;
  @Input() salons: Salon[] = [];
  @Input() getTablesCountBySalon: (salonId: number) => number = () => 0;
  @Output() close = new EventEmitter<void>();
  @Output() update = new EventEmitter<Partial<Table>>();
  @Output() delete = new EventEmitter<void>();

  colorPalette = COLOR_PALETTE;
  
  editTable = {
    name: '',
    number: '',
    color: COLOR_PALETTE[0],
    salonId: 1,
    notes: ''
  };

  dialogConfig = signal<DialogConfig>({
    title: 'Modifier la Table',
    subtitle: '',
    showCancelButton: true,
    showConfirmButton: true,
    cancelText: 'Annuler',
    confirmText: 'Modifier',
    confirmColor: 'success',
    size: 'md',
    preventBodyScroll: true
  });

  ngOnInit() {
    if (this.table) {
      this.editTable = {
        name: this.table.name,
        number: this.table.number,
        color: this.table.color,
        salonId: this.table.salonId,
        notes: this.table.notes || ''
      };
      this.dialogConfig.update(config => ({
        ...config,
        subtitle: `Table: ${this.table!.name} (${this.table!.number})`
      }));
    }
  }

  selectColor(color: string): void {
    this.editTable.color = color;
  }

  onClose(): void {
    this.close.emit();
  }

  onUpdate(): void {
    if (this.editTable.name && this.editTable.number) {
      this.update.emit(this.editTable);
    }
  }

  onDelete(): void {
    if (confirm(`Êtes-vous sûr de vouloir supprimer la table "${this.table?.name}" ?`)) {
      this.delete.emit();
    }
  }
}
