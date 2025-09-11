import { Component, EventEmitter, Output } from '@angular/core';

export interface ClientAction {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  gradient: string;
}

@Component({
  selector: 'app-client-action-dialog',
  templateUrl: './client-action-dialog.component.html',
  standalone: false
})
export class ClientActionDialogComponent {
  @Output() actionSelected = new EventEmitter<string>();
  @Output() dialogClosed = new EventEmitter<void>();

  clientActions: ClientAction[] = [
    {
      id: 'consult',
      title: 'Consulter Clients',
      description: 'Voir la liste des clients',
      icon: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z',
      color: 'from-blue-500 to-indigo-600',
      gradient: 'from-blue-50 to-indigo-100'
    },
    {
      id: 'add',
      title: 'Ajouter Client',
      description: 'Créer un nouveau client',
      icon: 'M12 6v6m0 0v6m0-6h6m-6 0H6',
      color: 'from-emerald-500 to-green-600',
      gradient: 'from-emerald-50 to-green-100'
    },
    {
      id: 'wholesale',
      title: 'Achat en Gros',
      description: 'Configuration des ventes en gros',
      icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
      color: 'from-purple-500 to-violet-600',
      gradient: 'from-purple-50 to-violet-100'
    }
  ];

  onActionClick(actionId: string): void {
    this.actionSelected.emit(actionId);
  }

  onClose(): void {
    this.dialogClosed.emit();
  }

  onBackdropClick(event: Event): void {
    if (event.target === event.currentTarget) {
      this.onClose();
    }
  }
}
