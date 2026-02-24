import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StockDocumentsService } from '../../../core/services/stock-documents.service';
import { StockDocument } from '../../../core/models/stock-document.model';
import { ProduitsDeCaisseService } from '../../../core/services/produits-de-caisse.service';
import { ProductsService } from '../../../core/services/products.service';
import { StockDocumentActionDialogComponent } from '../../../shared/stock-document-action-dialog/stock-document-action-dialog.component';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-documents',
  standalone: true,
  imports: [CommonModule, FormsModule, StockDocumentActionDialogComponent],
  templateUrl: './documents.component.html',
  styleUrls: ['./documents.component.css']
})
export class DocumentsListComponent implements OnInit {
  documents: StockDocument[] = [];
  filteredDocuments: StockDocument[] = [];
  loading = true;
  error = '';
  
  // View mode
  viewMode: 'grid' | 'table' = 'grid';
  
  // Filters
  selectedType = '';
  selectedStatus = '';
  searchTerm = '';

  // Dialog
  showTypeDialog = false;
  
  // Invoice modal
  showInvoiceModal = false;
  selectedDocument: StockDocument | null = null;
  invoiceNumber = '';
  
  // Caches for products and produits de caisse
  productsCache = new Map<number, any>();
  produitsDeCaisseCache = new Map<number, any>();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private stockDocumentsService: StockDocumentsService,
    private produitsDeCaisseService: ProduitsDeCaisseService,
    private productsService: ProductsService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    // Check for type filter in query params
    this.route.queryParams.subscribe(params => {
      if (params['type']) {
        this.selectedType = params['type'];
      }
      const depotIdParam = params['depotId'] ? Number(params['depotId']) : undefined;
      this.loadDocuments(depotIdParam);
    });
  }

  openTypeDialog(): void {
    this.showTypeDialog = true;
  }

  closeTypeDialog(): void {
    this.showTypeDialog = false;
  }

  handleTypeSelected(actionId: 'all' | 'factures' | 'bon-livraison' | 'bon-expedition' | 'bon-transfert'): void {
    this.onTypeSelected(actionId);
  }

  onTypeSelected(actionId: 'all' | 'factures' | 'bon-livraison' | 'bon-expedition' | 'bon-transfert'): void {
    // Map dialog choice to backend type values
    const map: Record<string, string> = {
      'all': ''
    };
    if (actionId === 'factures') {
      this.selectedType = 'FACTURE';
    } else if (actionId === 'bon-livraison') {
      this.selectedType = 'BON_ENTREE_MAGASIN';
    } else if (actionId === 'bon-expedition') {
      this.selectedType = 'BON_EXPEDITION';
    } else if (actionId === 'bon-transfert') {
      this.selectedType = 'BON_TRANSFERT';
    } else {
      this.selectedType = '';
    }
    this.filterDocuments();
    this.closeTypeDialog();
  }

  loadDocuments(explicitDepotId?: number): void {
    this.loading = true;
    this.error = '';
    
    // Get current user's depot ID to filter documents sent from this depot
    const currentUser = this.authService.currentUser();
    const currentDepotId = explicitDepotId ?? currentUser?.depotId;
    
    this.stockDocumentsService.getDocuments(1, 50, this.selectedType || undefined, this.selectedStatus || undefined, currentDepotId, undefined, undefined, true).subscribe({
      next: (response) => {
        const docs = Array.isArray(response) ? response : (response?.data ?? response ?? []);
        this.documents = Array.isArray(docs) ? docs : [];
        this.filterDocuments();
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading documents:', error);
        this.error = 'Erreur lors du chargement des documents: ' + (error?.message || 'Erreur inconnue');
        this.documents = [];
        this.filteredDocuments = [];
        this.loading = false;
      }
    });
  }

  filterDocuments(): void {
    if (!this.documents || !Array.isArray(this.documents)) {
      this.filteredDocuments = [];
      return;
    }
    
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

  setViewMode(mode: 'grid' | 'table'): void {
    this.viewMode = mode;
  }

  trackByDocumentId(index: number, doc: StockDocument): number | string {
    return doc.id ?? doc.numero;
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
    // Suggest next invoice number
    this.suggestNextInvoiceNumber();
  }

  private suggestNextInvoiceNumber(): void {
    const today = new Date();
    const year = today.getFullYear().toString().slice(-2);
    const month = (today.getMonth() + 1).toString().padStart(2, '0');
    const day = today.getDate().toString().padStart(2, '0');
    
    // Generate a suggested number like FAC-251011-0001
    this.invoiceNumber = `FAC-${year}${month}${day}-0001`;
  }

  cancelInvoice(): void {
    this.showInvoiceModal = false;
    this.selectedDocument = null;
    this.invoiceNumber = '';
  }

  confirmGenerateInvoice(): void {
    if (!this.selectedDocument) return;
    
    if (!this.invoiceNumber || this.invoiceNumber.trim() === '') {
      this.error = 'Veuillez saisir un numéro de facture';
      return;
    }
    


    
    // Load caches first, then generate invoice
    this.loadProductCaches().then(() => {
      this.generateInvoiceWithRealProducts();
    });
  }

  private async loadProductCaches(): Promise<void> {
    try {
      // Load all products
      const products = await this.productsService.getProducts().toPromise();
      if (products) {
        products.forEach((product: any) => {
          this.productsCache.set(product.id, product);
        });
      }

      // Load all produits de caisse
      const produitsDeCaisse = await this.produitsDeCaisseService.getProduitsDeCaisse().toPromise();
      if (produitsDeCaisse) {
        produitsDeCaisse.forEach((produit: any) => {
          this.produitsDeCaisseCache.set(produit.id, produit);
        });
      }

    } catch (error) {
      console.error('Error loading product caches:', error);
    }
  }

  private generateInvoiceWithRealProducts(): void {
    if (!this.selectedDocument) return;

    // Prepare invoice document data similar to scanning
    const invoiceData = {
      type: 'FACTURE',
      numero: this.invoiceNumber, // Use the manual invoice number from the modal
      fromDepotId: this.selectedDocument.emetteurId || 1,
      destinationDepotId: this.selectedDocument.destinataireId || this.selectedDocument.emetteurId || 1,
      clientId: this.selectedDocument.clientId || this.selectedDocument.client?.id,
      status: 'COMPLETED',
      items: this.selectedDocument.items?.map(item => {
        // Get the actual sub-product (produit de caisse) details
        const produit = this.produitsDeCaisseCache.get(item.productId);
        const parentProductId = produit?.parentProductId || item.productId;
        const parentProduct = this.productsCache.get(parentProductId);
        
        const baseItem = {
          productId: item.productId, // Keep the actual scanned sub-product ID
          quantity: item.quantity,
          count: item.count || 1,
          famille: parentProduct?.famille || parentProduct?.name || item.famille || 'Produit scanné',
          parentProductId: parentProductId,
          childProductName: produit?.name || `CHILDREN ${item.productId}`
        };
        
        // Use the actual sub-product pricing if available
        if (produit) {
          const prixUnitaire = produit.prix_vente_TTC || item.prixUnitaire || 0;
          const tva = produit.tva || item.tva || 19;
          const quantite = item.quantity;
          const montantTTC = prixUnitaire * quantite;
          // Correct TVA calculation: HT = TTC / (1 + TVA), TVA = TTC - HT
          const tvaFraction = tva <= 1 ? tva : tva / 100;
          const montantHT = Math.round((montantTTC / (1 + tvaFraction)) * 1000) / 1000;
          const montantTVA = Math.round((montantTTC - montantHT) * 1000) / 1000;
          
          return {
            ...baseItem,
            prixUnitaire: prixUnitaire,
            tva: tva,
            montantHT: montantHT,
            montantTVA: montantTVA,
            montantTTC: montantTTC,
            batch: item.batch,
            notes: item.notes,
            barcode: item.barcode
          };
        }
        
        // Fallback to stored values if produit not found
        return {
          ...baseItem,
          prixUnitaire: item.prixUnitaire || 0,
          tva: item.tva || 19,
          montantHT: item.montantHT || 0,
          montantTVA: item.montantTVA || 0,
          montantTTC: item.montantTTC || 0,
          batch: item.batch,
          notes: item.notes,
          barcode: item.barcode
        };
      }) || [],
      notes: `Facture générée automatiquement à partir du document ${this.selectedDocument.numero}`,
      // Include client details
      client: this.selectedDocument.client ? {
        id: this.selectedDocument.client.id,
        code: this.selectedDocument.client.code,
        firstName: this.selectedDocument.client.firstName,
        lastName: this.selectedDocument.client.lastName,
        email: this.selectedDocument.client.email,
        phone: this.selectedDocument.client.phone,
        address: this.selectedDocument.client.address,
        city: this.selectedDocument.client.city,
        matriculeFiscal: this.selectedDocument.client.matriculeFiscal,
        postalCode: this.selectedDocument.client.postalCode,
        clientType: this.selectedDocument.client.clientType
      } : null
    };






    // Create the invoice document
    this.stockDocumentsService.createDocument(invoiceData).subscribe({
      next: (createdInvoice) => {

        this.cancelInvoice();
        
        // Navigate to the new invoice document
        this.router.navigate(['/stock/documents', createdInvoice.id]);
      },
      error: (error) => {
        console.error('Error creating invoice:', error);
        const errorMessage = error?.error?.error || error?.message || 'Erreur inconnue';
        this.error = 'Erreur lors de la création de la facture: ' + errorMessage;
      }
    });
  }

  goToScan(): void {
    this.router.navigate(['/scanning']);
  }

  modifyDocument(document: StockDocument): void {
    // Navigate to document edit page or open edit modal
    this.router.navigate(['/stock/documents', document.id, 'edit']);
  }

  goBack(): void {
    this.router.navigate(['/stock']);
  }
}