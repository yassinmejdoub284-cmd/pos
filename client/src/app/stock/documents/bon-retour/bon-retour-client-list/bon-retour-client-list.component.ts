import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { StockDocumentsService } from '../../../../core/services/stock-documents.service';
import { StockDocument } from '../../../../core/models/stock-document.model';

@Component({
    selector: 'app-bon-retour-client-list',
    templateUrl: './bon-retour-client-list.component.html',
    standalone: false
})
export class BonRetourClientListComponent implements OnInit {
    documents: StockDocument[] = [];
    loading = false;
    error = '';
    page = 1;
    limit = 20;
    total = 0;

    constructor(
        private stockDocsService: StockDocumentsService,
        private router: Router
    ) { }

    ngOnInit(): void {
        this.loadDocuments();
    }

    loadDocuments(): void {
        this.loading = true;
        this.stockDocsService.getDocuments(
            this.page,
            this.limit,
            'BON_EXPEDITION',
            undefined,
            undefined,
            undefined,
            undefined,
            false,
            false,
            true // hasClient = true
        ).subscribe({
            next: (response) => {
                this.documents = response.data || [];
                if (response.pagination) {
                    this.total = response.pagination.total;
                }
                this.loading = false;
            },
            error: (err) => {
                this.error = 'Erreur lors du chargement des documents';
                this.loading = false;
            }
        });
    }

    createNew(): void {
        this.router.navigate(['/stock/documents/bon-retour/client-return/new']);
    }

    editDocument(doc: StockDocument): void {
        this.router.navigate(['/stock/documents/bon-retour/client-return/edit', doc.id]);
    }

    viewDocument(doc: StockDocument): void {
        this.editDocument(doc); // reusing edit route which loads document
    }

    getStatusLabel(status: string): string {
        switch (status) {
            case 'PREPARED': return 'Préparé';
            case 'SENT': return 'Envoyé';
            case 'RECEIVED': return 'Reçu';
            case 'CANCELLED': return 'Annulé';
            case 'COMPLETED': return 'Complété';
            default: return status;
        }
    }

    formatDate(date: string | Date): string {
        if (!date) return '-';
        return new Date(date).toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    goBack(): void {
        this.router.navigate(['/stock']);
    }
}
