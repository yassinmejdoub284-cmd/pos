import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StockDocumentsService } from '../../../core/services/stock-documents.service';
import { StockDocument } from '../../../core/models/stock-document.model';
import { ProduitsDeCaisseService } from '../../../core/services/produits-de-caisse.service';
import { ProductsService } from '../../../core/services/products.service';

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
  
  // Caches for products and produits de caisse
  productsCache = new Map<number, any>();
  produitsDeCaisseCache = new Map<number, any>();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private stockDocumentsService: StockDocumentsService,
    private produitsDeCaisseService: ProduitsDeCaisseService,
    private productsService: ProductsService
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
        this.documents = Array.isArray(documents) ? documents : [];
        this.filterDocuments();
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading documents:', error);
        this.error = 'Erreur lors du chargement des documents: ' + (error?.message || 'Erreur inconnue');
        this.documents = []; // Ensure documents is always an array
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
    
    console.log('Generating invoice for document:', this.selectedDocument.id);
    console.log('Using invoice number:', this.invoiceNumber);
    
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

      console.log('Product caches loaded:', {
        products: this.productsCache.size,
        produitsDeCaisse: this.produitsDeCaisseCache.size
      });
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
          const montantHT = montantTTC / (1 + tva / 100);
          const montantTVA = montantTTC - montantHT;
          
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

    console.log('Invoice data with real products:', invoiceData);
    console.log('Original document clientId:', this.selectedDocument.clientId);
    console.log('Original document client:', this.selectedDocument.client);
    console.log('Final clientId being sent:', invoiceData.clientId);

    // Create the invoice document
    this.stockDocumentsService.createDocument(invoiceData).subscribe({
      next: (createdInvoice) => {
        console.log('Invoice created successfully:', createdInvoice);
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

  goBack(): void {
    this.router.navigate(['/stock']);
  }
}