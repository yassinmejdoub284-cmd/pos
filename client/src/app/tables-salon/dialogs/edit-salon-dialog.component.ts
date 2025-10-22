import { Component, Input, Output, EventEmitter, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogComponent, DialogConfig } from '../../shared/dialog/dialog.component';
import { Salon } from '../../core/services/salon.service';

@Component({
  selector: 'app-edit-salon-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, DialogComponent],
  template: `
    <app-dialog [config]="dialogConfig" 
                (close)="onClose()" 
                (cancel)="onClose()" 
                (confirm)="onUpdate()">
      
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Nom du salon *</label>
          <input type="text" [(ngModel)]="editSalon.name" 
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Ex: Terrasse, Salon VIP, Salle Privée">
        </div>
        
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Capacité maximale (nombre de tables)</label>
          <input type="number" [(ngModel)]="editSalon.maxTables" min="1" max="100"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Ex: 40">
        </div>
        
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Emplacement</label>
          <input type="text" [(ngModel)]="editSalon.location" 
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Ex: Rez-de-chaussée, Étage 1, Extérieur">
        </div>
        
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea [(ngModel)]="editSalon.description" rows="3"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Description du salon..."></textarea>
        </div>
      </div>
    </app-dialog>
  `
})
export class EditSalonDialogComponent implements OnInit {
  @Input() salon: Salon | null = null;
  @Output() close = new EventEmitter<void>();
  @Output() update = new EventEmitter<Partial<Salon>>();
  @Output() delete = new EventEmitter<void>();

  editSalon = {
    name: '',
    maxTables: 10,
    location: '',
    description: ''
  };

  dialogConfig = signal<DialogConfig>({
    title: 'Modifier le Salon',
    subtitle: '',
    showCancelButton: true,
    showConfirmButton: true,
    cancelText: 'Annuler',
    confirmText: 'Modifier',
    confirmColor: 'primary',
    size: 'md',
    preventBodyScroll: true
  });

  ngOnInit() {
    if (this.salon) {
      this.editSalon = {
        name: this.salon.name,
        maxTables: this.salon.maxTables,
        location: this.salon.location || '',
        description: this.salon.description || ''
      };
      this.dialogConfig.update(config => ({
        ...config,
        subtitle: `Salon: ${this.salon!.name}`
      }));
    }
  }

  onClose(): void {
    this.close.emit();
  }

  onUpdate(): void {
    if (this.editSalon.name) {
      this.update.emit(this.editSalon);
    }
  }

  onDelete(): void {
    if (confirm(`Êtes-vous sûr de vouloir supprimer le salon "${this.salon?.name}" ?`)) {
      this.delete.emit();
    }
  }
}
