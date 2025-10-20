import { Component, Input, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogComponent, DialogConfig } from '../../shared/dialog/dialog.component';
import { Table } from '../../core/services/salon.service';

@Component({
  selector: 'app-duplicate-table-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, DialogComponent],
  template: `
    <app-dialog [config]="dialogConfig" 
                (close)="onClose()" 
                (cancel)="onClose()" 
                (confirm)="onDuplicate()">
      
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Nombre de copies à créer</label>
          <input type="number" [(ngModel)]="duplicateCount" min="1" max="50"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Ex: 20">
          <p class="text-xs text-gray-500 mt-1">Les tables seront numérotées automatiquement (ex: Table 2, Table 3, etc.)</p>
        </div>
        
        <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 class="text-sm font-medium text-blue-900 mb-2">Aperçu de la duplication :</h4>
          <div class="text-sm text-blue-800">
            <p>Table originale : <span class="font-medium">{{ table?.name }} ({{ table?.number }})</span></p>
            <p>Nouvelles tables : 
              @for (name of getPreviewNames(); track name) {
                <span class="font-medium">{{ name }}</span>
                @if (!$last) {, }
              }
              @if (getRemainingCount() > 0) {
                <span class="text-blue-600">... et {{ getRemainingCount() }} autres</span>
              }
            </p>
          </div>
        </div>
      </div>
    </app-dialog>
  `
})
export class DuplicateTableDialogComponent {
  @Input() table: Table | null = null;
  @Input() getPreviewNames: () => string[] = () => [];
  @Input() getRemainingCount: () => number = () => 0;
  @Output() close = new EventEmitter<void>();
  @Output() duplicate = new EventEmitter<number>();

  duplicateCount = 1;

  dialogConfig = signal<DialogConfig>({
    title: 'Dupliquer la Table',
    subtitle: '',
    showCancelButton: true,
    showConfirmButton: true,
    cancelText: 'Annuler',
    confirmText: 'Dupliquer',
    confirmColor: 'primary',
    size: 'md',
    preventBodyScroll: true
  });

  ngOnInit() {
    if (this.table) {
      this.dialogConfig.update(config => ({
        ...config,
        subtitle: `Table: ${this.table!.name} (${this.table!.number})`
      }));
    }
  }

  onClose(): void {
    this.close.emit();
  }

  onDuplicate(): void {
    this.duplicate.emit(this.duplicateCount);
  }
}
