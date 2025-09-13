import { Component, EventEmitter, Output } from '@angular/core';

export interface SupplierAction {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  gradient: string;
}

@Component({
  selector: 'app-supplier-action-dialog',
  templateUrl: './supplier-action-dialog.component.html',
  standalone: false
})
export class SupplierActionDialogComponent {
  @Output() actionSelected = new EventEmitter<string>();
  @Output() dialogClosed = new EventEmitter<void>();

  supplierActions: SupplierAction[] = [
    {
      id: 'consult',
      title: 'Consulter Fournisseurs',
      description: 'Voir la liste des fournisseurs',
      icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
      color: 'from-blue-500 to-indigo-600',
      gradient: 'from-blue-50 to-indigo-100'
    },
    {
      id: 'add',
      title: 'Ajouter Fournisseur',
      description: 'Créer un nouveau fournisseur',
      icon: 'M12 6v6m0 0v6m0-6h6m-6 0H6',
      color: 'from-emerald-500 to-green-600',
      gradient: 'from-emerald-50 to-green-100'
    },
    {
      id: 'statement',
      title: 'Relevé Fournisseur',
      description: 'Consulter les relevés fournisseurs',
      icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
      color: 'from-amber-500 to-orange-600',
      gradient: 'from-amber-50 to-orange-100'
    },
    {
      id: 'payment',
      title: 'Règlement Fournisseur',
      description: 'Gérer les règlements fournisseurs',
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
