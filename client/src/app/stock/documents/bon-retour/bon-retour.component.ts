import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { StockDocumentsService } from '../../../core/services/stock-documents.service';
import { DepotsService } from '../../../core/services/depots.service';
import { ProductsService } from '../../../core/services/products.service';
import { SuppliersService } from '../../../core/services/suppliers.service';
import { StockDocument, StockDocumentItem } from '../../../core/models/stock-document.model';
import { buildScanLikeDocumentHtmlFromDocument, getScanPrintStyles } from '../../shared/print-templates';
import { Depot } from '../../../core/models/stock-document.model';
import { Product } from '../../../core/models/product.model';
import { Supplier } from '../../../core/models/stock-document.model';

@Component({
  selector: 'app-bon-retour',
  templateUrl: './bon-retour.component.html',
  styleUrls: ['./bon-retour.component.css'],
  standalone: false
})
export class BonRetourComponent implements OnInit {
  depotId: string | null = null;
  documentId: string | null = null;
  document: StockDocument | null = null;
  documents: StockDocument[] = [];
  selectedDocument: StockDocument | null = null;
  loading = false;
  error = '';
  success = '';
  isEditMode = false;
  showDocumentDetails = false;

  // Form data
  selectedDepot: Depot | null = null;
  selectedSupplier: Supplier | null = null;
  items: StockDocumentItem[] = [];
  notes = '';

  // Available options
  depots: Depot[] = [];
  suppliers: Supplier[] = [];
  products: Product[] = [];

  // UI state
  showSupplierModal = false;
  showProductModal = false;
  showDepotModal = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private stockDocsService: StockDocumentsService,
    private depotsService: DepotsService,
    private productsService: ProductsService,
    private suppliersService: SuppliersService
  ) {}

  ngOnInit(): void {
    // Get depot ID from route
    this.depotId = this.route.snapshot.paramMap.get('depotId');
    this.documentId = this.route.snapshot.paramMap.get('documentId');
    
    this.loadInitialData();

    const url = this.router.url;
    this.isEditMode = url.includes('/edit/');

    if (this.isEditMode && this.documentId) {
      this.loadDocument();
    } else if (this.depotId) {
      this.loadDocumentsForDepot();
    }
  }

  loadInitialData(): void {
    this.loading = true;
    
    const depotFilter = this.depotId ? parseInt(this.depotId, 10) : undefined as any;
    Promise.all([
      this.depotsService.list().toPromise(),
      this.suppliersService.list().toPromise(),
      this.productsService.getProducts(depotFilter).toPromise()
    ]).then(([depots, suppliers, products]) => {
      this.depots = depots || [];
      this.suppliers = suppliers || [];
      this.products = products || [];
      
      if (this.depotId) {
        this.selectedDepot = this.depots.find(d => d.id.toString() === this.depotId) || null;
      }
      
      this.loading = false;
    }).catch(error => {
      this.error = 'Erreur lors du chargement des données';
      this.loading = false;
    });
  }

  loadDocumentsForDepot(): void {
    if (!this.depotId) return;
    this.loading = true;
    
    // Load only BON_EXPEDITION documents for this depot
    this.stockDocsService.getDocuments(1, 50, 'BON_EXPEDITION', 'RECEIVED', parseInt(this.depotId)).subscribe({
      next: (response) => {
        const allDocs = response?.data || [];
        
        // Filter for BON_EXPEDITION documents only (returns)
        this.documents = allDocs.filter((d: StockDocument) => d.type === 'BON_EXPEDITION');
        
        this.loading = false;
      },
      error: (error) => {
        this.error = 'Erreur lors du chargement des documents de retour';
        this.loading = false;
      }
    });
  }

  loadDocument(): void {
    if (!this.documentId) return;
    
    this.loading = true;
    this.stockDocsService.getDocument(parseInt(this.documentId)).subscribe({
      next: (doc) => {
        this.document = doc;
        this.items = doc.items || [];
        this.notes = doc.notes || '';
        
        if (doc.emetteur) {
          this.selectedSupplier = doc.emetteur;
        }
        
        this.loading = false;
      },
      error: (error) => {
        this.error = 'Erreur lors du chargement du document';
        this.loading = false;
      }
    });
  }

  addItem(): void {
    this.items.push({
      id: 0,
      documentId: 0,
      productId: 0,
      famille: '',
      quantity: 0,
      purchasePrice: 0,
      batch: '',
      notes: '',
      product: undefined
    });
  }

  removeItem(index: number): void {
    this.items.splice(index, 1);
  }

  onProductSelect(item: StockDocumentItem, product: Product | null): void {
    if (product) {
      item.productId = product.id;
      item.famille = product.famille?.name || 'Divers';
      item.purchasePrice = product.prix_achat || 0;
      item.product = product as any; // Type assertion for compatibility
    }
  }

  getProductById(productId: number): Product | null {
    return this.products.find(p => p.id === productId) || null;
  }

  getAbsQuantity(quantity: number): number {
    return Math.abs(quantity);
  }

  calculateTotal(): number {
    return this.items.reduce((total, item) => {
      return total + (item.quantity * (item.purchasePrice || 0));
    }, 0);
  }

  getTotalQuantity(): number {
    return this.items.reduce((total, item) => {
      return total + Math.abs(item.quantity);
    }, 0);
  }

  saveDocument(): void {
    if (!this.selectedDepot) {
      this.error = 'Veuillez sélectionner un dépôt';
      return;
    }

    if (this.items.length === 0) {
      this.error = 'Veuillez ajouter au moins un article';
      return;
    }

    // Validate items
    const invalidItems = this.items.filter(item => 
      !item.productId || item.quantity <= 0
    );

    if (invalidItems.length > 0) {
      this.error = 'Tous les articles doivent avoir un produit et une quantité valide';
      return;
    }

    this.loading = true;
    this.error = '';

    const documentData = {
      type: 'BON_EXPEDITION',
      depotId: parseInt(this.depotId!),
      supplierId: this.selectedSupplier?.id || null,
      items: this.items.map(item => ({
        productId: item.productId,
        famille: item.famille,
        quantity: -Math.abs(item.quantity), // Negative quantity for returns
        purchasePrice: item.purchasePrice,
        batch: item.batch,
        notes: item.notes
      })),
      notes: this.notes
    };

    if (this.isEditMode && this.documentId) {
      // Update existing document
      this.stockDocsService.updateDocument(parseInt(this.documentId), documentData).subscribe({
        next: () => {
          this.success = 'Bon de retour modifié avec succès - Stock mis à jour';
          this.loading = false;
          this.loadDocumentsForDepot();
        },
        error: (error) => {
          this.error = 'Erreur lors de la modification du bon de retour';
          this.loading = false;
        }
      });
    } else {
      // Create new document
      this.stockDocsService.createReturnDocument(documentData).subscribe({
        next: () => {
          this.success = 'Bon de retour créé avec succès - Les quantités ont été soustraites de l\'inventaire';
          this.loading = false;
          this.loadDocumentsForDepot();
          this.resetForm();
        },
        error: (error) => {
          this.error = 'Erreur lors de la création du bon de retour';
          this.loading = false;
        }
      });
    }
  }

  resetForm(): void {
    this.items = [];
    this.notes = '';
    this.selectedSupplier = null;
    this.error = '';
    this.success = '';
  }

  editDocumentFromList(document: StockDocument): void {
    this.router.navigate(['/stock/documents/bon-retour/edit', document.id]);
  }

  viewDocument(document: StockDocument): void {
    this.selectedDocument = document;
    this.showDocumentDetails = true;
  }

  closeDocumentDetails(): void {
    this.showDocumentDetails = false;
    this.selectedDocument = null;
  }

  startCreate(): void {
    this.resetForm();
    this.isEditMode = false;
  }

  goBack(): void {
    this.router.navigate(['/stock/documents']);
  }

  printDocument(document: StockDocument): void {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      const html = buildScanLikeDocumentHtmlFromDocument(document, 'BON_EXPEDITION' as any);
      printWindow.document.write(html);
      printWindow.document.write(`<style>${getScanPrintStyles()}</style>`);
      printWindow.document.close();
      printWindow.print();
    }
  }

  formatDate(date: string | Date): string {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleDateString('fr-FR');
  }

  getDocumentTypeLabel(doc: StockDocument): string {
    return 'Bon de Retour';
  }

  getStatusLabel(status: string): string {
    const statusLabels: { [key: string]: string } = {
      'DRAFT': 'Brouillon',
      'PREPARED': 'Préparé',
      'RECEIVED': 'Reçu',
      'CANCELLED': 'Annulé'
    };
    return statusLabels[status] || status;
  }
}

