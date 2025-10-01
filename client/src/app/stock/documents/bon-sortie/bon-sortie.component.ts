import { Component, OnInit, HostListener } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { StockDocumentsService } from '../../../core/services/stock-documents.service';
import { DepotsService } from '../../../core/services/depots.service';
import { ProductsService } from '../../../core/services/products.service';
import { ProduitsDeCaisseService } from '../../../core/services/produits-de-caisse.service';
import { SettingsService, AppSettings } from '../../../core/services/settings.service';
import { StockDocument } from '../../../core/models/stock-document.model';
import { buildScanLikeDocumentHtmlFromDocument, getScanPrintStyles } from '../../shared/print-templates';
import { Depot } from '../../../core/models/stock-document.model';

@Component({
  selector: 'app-bon-sortie',
  templateUrl: './bon-sortie.component.html',
  styleUrls: ['./bon-sortie.component.css'],
  standalone: false
})
export class BonSortieComponent implements OnInit {
  depotId: string | null = null;
  documents: StockDocument[] = [];
  selectedDocument: StockDocument | null = null;
  loading = false;
  error = '';
  success = '';

  // Available options
  depots: Depot[] = [];
  settings: AppSettings | null = null;

  // UI state
  showDocumentDetails = false;
  isEditMode = false;
  
  // Edit mode properties
  documentToEdit: StockDocument | null = null;
  editForm = {
    destination: '',
    validationFromDate: '',
    validationToDate: '',
    notes: ''
  };
  
  // Product management
  availableProducts: any[] = [];
  showProductModal = false;
  editingProduct: any = null;
  newProduct = {
    productId: null as string | null,
    quantity: 0,
    count: 1,
    notes: ''
  };

  // Confirmation dialog
  showConfirmDialog = false;
  confirmDialog = {
    title: '',
    message: '',
    confirmText: 'Confirmer',
    cancelText: 'Annuler',
    onConfirm: () => {},
    type: 'warning' // 'warning', 'danger', 'info'
  };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private stockDocsService: StockDocumentsService,
    private depotsService: DepotsService,
    private productsService: ProductsService,
    private produitsDeCaisseService: ProduitsDeCaisseService,
    private settingsService: SettingsService
  ) {}

  ngOnInit(): void {
    this.depotId = this.route.snapshot.paramMap.get('id');
    this.loadInitialData();
    
    // Check if we're in edit mode
    const url = this.router.url;
    this.isEditMode = url.includes('/edit/');
    
    if (this.isEditMode && this.depotId) {
      // In edit mode, load the specific document
      this.loadDocumentForEdit(parseInt(this.depotId));
    } else if (this.depotId) {
      // In view mode, load all documents for the depot
      this.loadDocumentsForDepot();
    }
  }

  loadInitialData(): void {
    this.loading = true;
    
    Promise.all([
      this.depotsService.list().toPromise(),
      // Load sous-produits for selection instead of main products
      this.produitsDeCaisseService.getActiveProduitsDeCaisse().toPromise(),
      this.settingsService.getSettings().toPromise()
    ]).then(([depots, products, settings]) => {
      this.depots = depots || [];
      this.availableProducts = products || [];
      this.settings = settings || null;
      this.loading = false;
    }).catch(error => {
      this.error = 'Erreur lors du chargement des données';
      this.loading = false;
    });
  }

  loadDocumentsForDepot(): void {
    if (!this.depotId) return;
    
    this.loading = true;
    this.stockDocsService.getDocuments(1, 50, 'BON_EXPEDITION', undefined, parseInt(this.depotId)).subscribe({
      next: (response) => {
        this.documents = response.data || [];
        this.loading = false;
      },
      error: (error) => {
        this.error = 'Erreur lors du chargement des documents';
        this.loading = false;
      }
    });
  }

  viewDocument(document: StockDocument): void {
    this.selectedDocument = document;
    this.showDocumentDetails = true;
  }

  closeDocumentDetails(): void {
    this.showDocumentDetails = false;
    this.selectedDocument = null;
  }

  editDocument(): void {
    if (this.selectedDocument) {
      // Navigate to the edit page for this document
      this.router.navigate(['/stock/documents/bon-sortie/edit', this.selectedDocument.id]);
    }
  }

  convertToDelivery(): void {
    if (!this.selectedDocument) return;
    
    this.showConfirmDialog = true;
    this.confirmDialog = {
      title: 'Convertir en Bon de Livraison',
      message: `Êtes-vous sûr de vouloir convertir le bon de sortie "${this.selectedDocument.numero}" en bon de livraison ?\n\nCette action changera le type de document et ne peut pas être annulée.`,
      confirmText: 'Convertir',
      cancelText: 'Annuler',
      type: 'warning',
      onConfirm: () => {
        this.performConversion(this.selectedDocument!.id);
        this.closeDocumentDetails();
      }
    };
  }

  editDocumentFromList(document: StockDocument): void {
    // Navigate to the edit page for this document
    this.router.navigate(['/stock/documents/bon-sortie/edit', document.id]);
  }

  convertToDeliveryFromList(document: StockDocument): void {
    this.showConfirmDialog = true;
    this.confirmDialog = {
      title: 'Convertir en Bon de Livraison',
      message: `Êtes-vous sûr de vouloir convertir le bon de sortie "${document.numero}" en bon de livraison ?\n\nCette action changera le type de document et ne peut pas être annulée.`,
      confirmText: 'Convertir',
      cancelText: 'Annuler',
      type: 'warning',
      onConfirm: () => {
        this.performConversion(document.id);
      }
    };
  }

  loadDocumentForEdit(documentId: number): void {
    this.loading = true;
    this.error = '';
    
    this.stockDocsService.getDocument(documentId).subscribe({
      next: (document) => {
        this.documentToEdit = document;
        this.editForm = {
          destination: document.destination || '',
          validationFromDate: document.validationFromDate ? new Date(document.validationFromDate).toISOString().split('T')[0] : '',
          validationToDate: document.validationToDate ? new Date(document.validationToDate).toISOString().split('T')[0] : '',
          notes: document.notes || ''
        };
        this.loading = false;
      },
      error: (error) => {
        this.error = 'Erreur lors du chargement du document';
        this.loading = false;
      }
    });
  }

  saveDocument(): void {
    if (!this.documentToEdit) return;
    
    this.loading = true;
    this.error = '';
    
    const updateData = {
      destination: this.editForm.destination,
      validationFromDate: this.editForm.validationFromDate,
      validationToDate: this.editForm.validationToDate,
      notes: this.editForm.notes,
      items: this.documentToEdit.items?.map(item => ({
        id: item.id,
        productId: item.productId,
        famille: item.famille,
        quantity: item.quantity,
        count: item.count,
        notes: item.notes
      })) || []
    };
    
    this.stockDocsService.updateDocument(this.documentToEdit.id, updateData).subscribe({
      next: (updatedDocument) => {
        this.documentToEdit = updatedDocument;
        this.success = 'Document mis à jour avec succès';
        this.loading = false;
        setTimeout(() => this.success = '', 3000);
      },
      error: (error) => {
        this.error = 'Erreur lors de la mise à jour du document';
        this.loading = false;
        setTimeout(() => this.error = '', 5000);
      }
    });
  }

  cancelEdit(): void {
    this.router.navigate(['/stock/documents/bon-sortie', this.documentToEdit?.id]);
  }

  // Product management methods
  addProduct(): void {
    this.editingProduct = null;
    this.newProduct = {
      productId: '',
      quantity: 0,
      count: 1,
      notes: ''
    };
    this.showProductModal = true;
  }

  editProduct(item: any): void {
    this.editingProduct = item;
    this.newProduct = {
      productId: item.productId || '',
      quantity: Number(item.quantity),
      count: Number(item.count || 1),
      notes: item.notes || ''
    };
    this.showProductModal = true;
  }

  removeProduct(item: any): void {
    if (!this.documentToEdit || !this.documentToEdit.items) return;
    
    const index = this.documentToEdit.items.findIndex(i => i.id === item.id);
    if (index > -1) {
      this.documentToEdit.items.splice(index, 1);
    }
  }

  saveProduct(): void {
    if (!this.documentToEdit) return;

    if (!this.newProduct.productId || this.newProduct.productId === '') return;

    if (!this.documentToEdit.items) {
      this.documentToEdit.items = [];
    }

    const product: any = this.availableProducts.find((p: any) => p.id === Number(this.newProduct.productId));
    if (!product) return;

    if (this.editingProduct) {
      // Update existing product
      const index = this.documentToEdit.items.findIndex(i => i.id === this.editingProduct.id);
        if (index > -1) {
          this.documentToEdit.items[index] = {
            ...this.documentToEdit.items[index],
            productId: Number(this.newProduct.productId),
            famille: (product.famille?.name) || (product.parentProduct?.famille?.name) || '',
            quantity: this.newProduct.quantity,
            count: this.newProduct.count,
            notes: this.newProduct.notes,
            product: product
          };
        }
    } else {
        // Add new product
        const newItem: any = {
          id: Date.now(), // Temporary ID
          documentId: this.documentToEdit.id,
          productId: Number(this.newProduct.productId),
          famille: (product.famille?.name) || (product.parentProduct?.famille?.name) || '',
          quantity: this.newProduct.quantity,
          count: this.newProduct.count,
          notes: this.newProduct.notes,
          product: product
        };
      this.documentToEdit.items.push(newItem);
    }

    this.showProductModal = false;
    this.editingProduct = null;
  }

  cancelProductEdit(): void {
    this.showProductModal = false;
    this.editingProduct = null;
  }

  getProductName(productId: number): string {
    const product: any = this.availableProducts.find((p: any) => p.id === productId);
    if (!product) return `Produit ${productId}`;
    return product.name || product.parentProduct?.name || `Produit ${productId}`;
  }

  // Confirmation dialog methods
  performConversion(documentId: number): void {
    this.loading = true;
    this.error = '';
    this.showConfirmDialog = false;
    
    this.stockDocsService.convertToDelivery(documentId).subscribe({
      next: (convertedDocument) => {
        this.success = 'Document converti en bon de livraison avec succès';
        this.loading = false;
        // Reload documents to show the updated list
        this.loadDocumentsForDepot();
        setTimeout(() => this.success = '', 3000);
      },
      error: (error) => {
        this.error = 'Erreur lors de la conversion du document';
        this.loading = false;
        setTimeout(() => this.error = '', 5000);
      }
    });
  }

  confirmAction(): void {
    this.confirmDialog.onConfirm();
  }

  cancelAction(): void {
    this.showConfirmDialog = false;
  }

  // Handle keyboard events
  @HostListener('document:keydown.escape', ['$event'])
  onEscapeKey(event: KeyboardEvent): void {
    if (this.showConfirmDialog) {
      this.cancelAction();
    }
  }

  getDepotName(depotId: number): string {
    const depot = this.depots.find(d => d.id === depotId);
    return depot ? depot.name : `Dépôt ${depotId}`;
  }

  formatDate(date: string | Date): string {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleDateString('fr-FR');
  }

  getTotalQuantity(items: any[] | undefined): number {
    if (!items || items.length === 0) return 0;
    const total = items.reduce((sum, item) => {
      const quantity = Number(item.quantity) || 0;
      return sum + quantity;
    }, 0);
    return Math.round(total * 1000) / 1000; // Round to 3 decimal places
  }

  getTotalCount(items: any[] | undefined): number {
    if (!items || items.length === 0) return 0;
    return items.reduce((sum, item) => {
      const count = Number(item['count']) || 0;
      return sum + count;
    }, 0);
  }

  goBack(): void {
    this.router.navigate(['/stock']);
  }

  goToScan(): void {
    if (this.depotId) {
      this.router.navigate(['/stock/scan', this.depotId], { queryParams: { type: 'sortie' } });
    }
  }

  printDocument(document: StockDocument): void {
    const printContent = buildScanLikeDocumentHtmlFromDocument(document, 'sortie', this.settings);
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      this.error = 'Impossible d\'ouvrir la fenêtre d\'impression';
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Bon de Sortie - ${document.numero}</title>
        <style>${getScanPrintStyles()}</style>
      </head>
      <body>
        ${printContent}
      </body>
      </html>
    `);
    
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
  }

}