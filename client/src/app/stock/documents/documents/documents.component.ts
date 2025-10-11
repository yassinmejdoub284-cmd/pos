import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StockDocumentsService } from '../../../core/services/stock-documents.service';
import { StockDocument } from '../../../core/models/stock-document.model';

@Component({
  selector: 'app-documents',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './documents.component.html',
  styleUrls: ['./documents.component.css']
})
export class DocumentsListComponent implements OnInit {
  documents: StockDocument[] = [];
  filteredDocuments: StockDocument[] = [];
  loading = true;
  error = '';
  
  // Filters
  selectedType = '';
  selectedStatus = '';
  searchTerm = '';
  
  // Invoice modal
  showInvoiceModal = false;
  selectedDocument: StockDocument | null = null;
  invoiceNumber = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private stockDocumentsService: StockDocumentsService
  ) {}

  ngOnInit(): void {
    // Check for type filter in query params
    this.route.queryParams.subscribe(params => {
      if (params['type']) {
        this.selectedType = params['type'];
      }
      this.loadDocuments();
    });
  }

  loadDocuments(): void {
    this.loading = true;
    this.error = '';
    
    this.stockDocumentsService.getAllDocuments().subscribe({
      next: (documents) => {
        this.documents = documents;
        this.filterDocuments();
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading documents:', error);
        this.error = 'Erreur lors du chargement des documents: ' + (error?.message || 'Erreur inconnue');
        this.loading = false;
      }
    });
  }

  filterDocuments(): void {
    let filtered = [...this.documents];

    // Filter by type
    if (this.selectedType) {
      filtered = filtered.filter(doc => doc.type === this.selectedType);
    }

    // Filter by status
    if (this.selectedStatus) {
      filtered = filtered.filter(doc => doc.status === this.selectedStatus);
    }

    // Filter by search term
    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(doc => 
        doc.numero.toLowerCase().includes(term) ||
        (doc.client && (
          doc.client.firstName?.toLowerCase().includes(term) ||
          doc.client.lastName?.toLowerCase().includes(term) ||
          doc.client.code?.toLowerCase().includes(term)
        )) ||
        (doc.emetteur && doc.emetteur.name?.toLowerCase().includes(term)) ||
        (doc.destinataire && doc.destinataire.name?.toLowerCase().includes(term))
      );
    }

    this.filteredDocuments = filtered;
  }

  clearFilters(): void {
    this.selectedType = '';
    this.selectedStatus = '';
    this.searchTerm = '';
    this.filterDocuments();
  }

  getTypeLabel(type: string): string {
    switch (type) {
      case 'BON_ENTREE_MAGASIN':
        return 'Bon de Livraison';
      case 'BON_EXPEDITION':
        return 'Bon de Sortie';
      case 'BON_TRANSFERT':
        return 'Bon de Transfert';
      case 'FACTURE':
        return 'Facture';
      default:
        return type;
    }
  }

  getTypeClass(type: string): string {
    switch (type) {
      case 'BON_ENTREE_MAGASIN':
        return 'bg-orange-100 text-orange-800';
      case 'BON_EXPEDITION':
        return 'bg-blue-100 text-blue-800';
      case 'BON_TRANSFERT':
        return 'bg-purple-100 text-purple-800';
      case 'FACTURE':
        return 'bg-emerald-100 text-emerald-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'PREPARED':
        return 'Préparé';
      case 'SENT':
        return 'Envoyé';
      case 'RECEIVED':
        return 'Reçu';
      case 'CANCELLED':
        return 'Annulé';
      case 'COMPLETED':
        return 'Terminé';
      default:
        return status;
    }
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'PREPARED':
        return 'bg-yellow-100 text-yellow-800';
      case 'SENT':
        return 'bg-blue-100 text-blue-800';
      case 'RECEIVED':
        return 'bg-green-100 text-green-800';
      case 'CANCELLED':
        return 'bg-red-100 text-red-800';
      case 'COMPLETED':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }

  canGenerateInvoice(document: StockDocument): boolean {
    return document.type === 'BON_ENTREE_MAGASIN' || document.type === 'FACTURE';
  }

  formatDate(date: string | Date): string {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  viewDocument(document: StockDocument): void {
    this.router.navigate(['/stock/documents', document.id]);
  }

  printDocument(document: StockDocument): void {
    // Open document in new tab for printing
    const url = `/stock/documents/${document.id}`;
    window.open(url, '_blank');
  }

  openInvoiceModal(document: StockDocument): void {
    this.selectedDocument = document;
    this.showInvoiceModal = true;
    this.invoiceNumber = '';
  }

  cancelInvoice(): void {
    this.showInvoiceModal = false;
    this.selectedDocument = null;
    this.invoiceNumber = '';
  }

  confirmGenerateInvoice(): void {
    if (!this.invoiceNumber || !this.selectedDocument) return;
    
    // TODO: Implement invoice generation logic
    console.log('Generating invoice:', this.invoiceNumber, 'for document:', this.selectedDocument.id);
    
    this.cancelInvoice();
  }

  goToScan(): void {
    this.router.navigate(['/scanning']);
  }

  goBack(): void {
    this.router.navigate(['/stock']);
  }
}