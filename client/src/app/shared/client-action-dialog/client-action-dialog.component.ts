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
      id: 'statement',
      title: 'Relevé Client',
      description: 'Consulter les relevés clients',
      icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
      color: 'from-amber-500 to-orange-600',
      gradient: 'from-amber-50 to-orange-100'
    },
    {
      id: 'payment',
      title: 'Règlement Client',
      description: 'Gérer les règlements clients',
      icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
      color: 'from-green-500 to-emerald-600',
      gradient: 'from-green-50 to-emerald-100'
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
