import { Component, Input, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogComponent, DialogConfig } from '../../shared/dialog/dialog.component';
import { Salon } from '../../core/services/salon.service';

@Component({
  selector: 'app-add-salon-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, DialogComponent],
  template: `
    <app-dialog [config]="dialogConfig" 
                (close)="onClose()" 
                (cancel)="onClose()" 
                (confirm)="onAdd()">
      
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Nom du salon *</label>
          <input type="text" [(ngModel)]="newSalon.name" 
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Ex: Terrasse, Salon VIP, Salle Privée">
        </div>
        
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Capacité maximale (nombre de tables)</label>
          <input type="number" [(ngModel)]="newSalon.maxTables" min="1" max="100"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Ex: 40">
        </div>
        
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Emplacement</label>
          <input type="text" [(ngModel)]="newSalon.location" 
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Ex: Rez-de-chaussée, Étage 1, Extérieur">
        </div>
        
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea [(ngModel)]="newSalon.description" rows="3"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Description du salon..."></textarea>
        </div>
      </div>
    </app-dialog>
  `
})
export class AddSalonDialogComponent {
  @Output() close = new EventEmitter<void>();
  @Output() add = new EventEmitter<Partial<Salon>>();

  newSalon = {
    name: '',
    maxTables: 10,
    location: '',
    description: ''
  };

  dialogConfig = signal<DialogConfig>({
    title: 'Ajouter un Salon',
    showCancelButton: true,
    showConfirmButton: true,
    cancelText: 'Annuler',
    confirmText: 'Ajouter',
    confirmColor: 'primary',
    size: 'md',
    preventBodyScroll: true
  });

  onClose(): void {
    this.close.emit();
  }

  onAdd(): void {
    if (this.newSalon.name) {
      this.add.emit(this.newSalon);
    }
  }
}
