import { Component, EventEmitter, Output } from '@angular/core';

export interface DocumentType {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  gradient: string;
  route: string;
}

@Component({
  selector: 'app-document-selection-dialog',
  templateUrl: './document-selection-dialog.component.html',
  styleUrls: ['./document-selection-dialog.component.css'],
  standalone: false
})
export class DocumentSelectionDialogComponent {
  @Output() documentSelected = new EventEmitter<string>();
  @Output() dialogClosed = new EventEmitter<void>();

  documentTypes: DocumentType[] = [
    {
      id: 'bon-entree',
      title: 'Bon d\'entrée',
      description: 'Documents d\'entrée de stock',
      icon: 'M12 4v16m8-8H4',
      color: 'from-emerald-500 to-green-600',
      gradient: 'from-emerald-50 to-green-100',
      route: '/stock/documents/bon-entree/new'
    },
    {
      id: 'bon-sortie',
      title: 'Bon de sortie',
      description: 'Documents de sortie de stock',
      icon: 'M20 12H4m8-8v16',
      color: 'from-red-500 to-rose-600',
      gradient: 'from-red-50 to-rose-100',
      route: '/stock/documents/bon-sortie/new'
    },
    {
      id: 'bon-transfert',
      title: 'Bon de transfert',
      description: 'Transferts entre dépôts',
      icon: 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4',
      color: 'from-blue-500 to-indigo-600',
      gradient: 'from-blue-50 to-indigo-100',
      route: '/stock/documents/bon-transfert/new'
    },
    {
      id: 'bon-livraison',
      title: 'Bon de livraison',
      description: 'Documents de livraison',
      icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
      color: 'from-purple-500 to-violet-600',
      gradient: 'from-purple-50 to-violet-100',
      route: '/stock/documents/bon-livraison/new'
    }
  ];

  onDocumentSelected(documentType: DocumentType): void {
    this.documentSelected.emit(documentType.id);
  }

  onClose(): void {
    this.dialogClosed.emit();
  }
}
