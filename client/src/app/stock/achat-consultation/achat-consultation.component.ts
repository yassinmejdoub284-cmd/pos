import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { StockDocumentsService } from '../../core/services/stock-documents.service';
import { CookieService } from '../../core/services/cookie.service';
import { StockDocument } from '../../core/models/stock-document.model';

@Component({
  selector: 'app-achat-consultation',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './achat-consultation.component.html'
})
export class AchatConsultationComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private documentsService = inject(StockDocumentsService);
  private cookieService = inject(CookieService);

  actionType = signal<'entry' | 'bon-retour'>('entry');
  depotId = signal<number | null>(null);
  documents = signal<StockDocument[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);

  isCompactMode = signal(false);
  isGridView = signal(false);

  displayedDocuments = computed(() => {
    return this.documents();
  });

  ngOnInit(): void {
    const actionTypeParam = this.route.snapshot.paramMap.get('actionType');
    const depotIdParam = this.route.snapshot.paramMap.get('depotId');

    if (actionTypeParam === 'entry' || actionTypeParam === 'bon-retour') {
      this.actionType.set(actionTypeParam);
    }

    if (depotIdParam) {
      this.depotId.set(parseInt(depotIdParam, 10));
    }

    const compactPref = this.cookieService.getCookie('consult_achat_compact');
    const gridPref = this.cookieService.getCookie('consult_achat_grid');

    if (compactPref === 'true') {
      this.isCompactMode.set(true);
    }

    if (gridPref === 'true') {
      this.isGridView.set(true);
    }

    this.loadDocuments();
  }

  loadDocuments(): void {
    const depotId = this.depotId();
    if (!depotId) {
      this.error.set('Dépôt non spécifié');
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    const documentType = this.actionType() === 'entry' ? 'BON_ENTREE_MAGASIN' : 'BON_EXPEDITION';

    this.documentsService.getDocuments(1, 1000, documentType, undefined, depotId).subscribe({
      next: (response) => {
        const docs = Array.isArray(response) ? response : (response?.data ?? []);
        this.documents.set(docs);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.error?.error || 'Erreur lors du chargement des documents');
        this.loading.set(false);
      }
    });
  }

  toggleCompactMode(): void {
    const newValue = !this.isCompactMode();
    this.isCompactMode.set(newValue);
    this.cookieService.setCookie('consult_achat_compact', newValue.toString(), 30);
  }

  toggleGridView(): void {
    const newValue = !this.isGridView();
    this.isGridView.set(newValue);
    this.cookieService.setCookie('consult_achat_grid', newValue.toString(), 30);
  }

  formatDate(date: string | Date): string {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  getStatusLabel(status: string): string {
    const statusLabels: { [key: string]: string } = {
      'PREPARED': 'Préparé',
      'SENT': 'Envoyé',
      'RECEIVED': 'Reçu',
      'CANCELLED': 'Annulé',
      'COMPLETED': 'Terminé'
    };
    return statusLabels[status] || status;
  }

  getStatusClass(status: string): string {
    const classes: { [key: string]: string } = {
      'PREPARED': 'bg-yellow-100 text-yellow-700',
      'SENT': 'bg-blue-100 text-blue-700',
      'RECEIVED': 'bg-green-100 text-green-700',
      'CANCELLED': 'bg-pink-100 text-pink-700',
      'COMPLETED': 'bg-emerald-100 text-emerald-700'
    };
    return classes[status] || 'bg-purple-100 text-purple-700';
  }

  getDocumentTotal(document: StockDocument): number {
    if (!document.items || document.items.length === 0) {
      return 0;
    }
    return document.items.reduce((sum, item) => {
      return sum + Math.abs(item.quantity * (item.purchasePrice || 0));
    }, 0);
  }

  goBack(): void {
    this.router.navigate(['/stock']);
  }

  createNew(): void {
    const depotId = this.depotId();
    if (!depotId) return;

    if (this.actionType() === 'entry') {
      this.router.navigate(['/stock/documents/bon-entree', depotId.toString()]);
    } else {
      this.router.navigate(['/stock/documents/bon-retour', depotId.toString()]);
    }
  }

  viewDocument(documentId: number): void {
    this.editDocument(documentId);
  }

  editDocument(documentId: number): void {
    if (this.actionType() === 'entry') {
      this.router.navigate(['/stock/documents/bon-entree/edit', documentId.toString()]);
    } else {
      this.router.navigate(['/stock/documents/bon-retour/edit', documentId.toString()]);
    }
  }

  deleteDocument(documentId: number): void {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce document ?')) {
      return;
    }

    this.documentsService.deleteDocument(documentId).subscribe({
      next: () => {
        this.loadDocuments();
      },
      error: (err) => {
        this.error.set(err.error?.error || 'Erreur lors de la suppression du document');
      }
    });
  }
}
