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
  selector: 'app-bon-entree',
  templateUrl: './bon-entree.component.html',
  styleUrls: ['./bon-entree.component.css'],
  standalone: false
})
export class BonEntreeComponent implements OnInit {
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
  isReturnsMode = false;

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
    // Distinguish params based on route configuration
    this.depotId = this.route.snapshot.paramMap.get('depotId');
    this.documentId = this.route.snapshot.paramMap.get('documentId');
    // Returns mode: when navigating via /stock/documents/bon-retour/:depotId
    const path = this.router.url;
    const showReturnsOnly = path.includes('/stock/documents/bon-retour/');
    this.isReturnsMode = showReturnsOnly;
    this.loadInitialData();

    const url = this.router.url;
    this.isEditMode = url.includes('/edit/');

    if (this.isEditMode && this.documentId) {
      this.loadDocument();
    } else if (this.depotId) {
      this.loadDocumentsForDepot(showReturnsOnly);
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
      this.loading = false;
    }).catch(error => {
      this.error = 'Erreur lors du chargement des données';
      this.loading = false;
    });
  }

  loadDocument(): void {
    if (!this.documentId) return;
    
    this.loading = true;
    this.stockDocsService.getDocument(parseInt(this.documentId)).subscribe({
      next: (doc) => {
        this.document = doc;
        this.selectedDepot = doc.destinataire || null;
        this.selectedSupplier = doc.supplier || null;
        this.items = doc.items || [];
        this.notes = doc.notes || '';
        
        // Load parent products for items that have parentProductId
        this.loadParentProductsForItems();
        
        this.loading = false;
      },
      error: (error) => {
        this.error = 'Erreur lors du chargement du document';
        this.loading = false;
      }
    });
  }

  private loadParentProductsForItems(): void {
    if (!this.items || this.items.length === 0) return;
    
    // Get unique parent product IDs
    const parentProductIds = [...new Set(this.items
      .filter(item => (item as any).parentProductId)
      .map(item => (item as any).parentProductId)
    )];
    
    if (parentProductIds.length === 0) return;
    
    // Load parent products
    this.productsService.getProducts().subscribe({
      next: (allProducts) => {
        const parentProducts = allProducts.filter(p => parentProductIds.includes(p.id));
        
        // Update items to use parent product data
        this.items.forEach(item => {
          const parentProductId = (item as any).parentProductId;
          if (parentProductId) {
            const parentProduct = parentProducts.find(p => p.id === parentProductId);
            if (parentProduct) {
              // Replace the child product with parent product for display
              (item as any).product = parentProduct;
              (item as any).productId = parentProductId; // Update productId to parent ID for consistency
            }
          }
        });
      },
      error: (error) => {
        console.error('Error loading parent products:', error);
      }
    });
  }

  loadDocumentsForDepot(returnsOnly: boolean = false): void {
    if (!this.depotId) return;
    this.loading = true;
    
    // Load all document types for this depot with RECEIVED status
    this.stockDocsService.getDocuments(1, 50, undefined, 'RECEIVED', parseInt(this.depotId)).subscribe({
      next: (response) => {
        const allDocs = response?.data || [];
        
        this.documents = returnsOnly
          ? allDocs.filter((d: StockDocument) => this.isReturnDocument(d))
          : allDocs.filter((d: StockDocument) => !this.isReturnDocument(d));
        
        // Load parent products for all document items
        this.loadParentProductsForAllDocuments();
        
        this.loading = false;
      },
      error: (error) => {
        this.error = 'Erreur lors du chargement des documents';
        this.loading = false;
      }
    });
  }

  private loadParentProductsForAllDocuments(): void {
    if (!this.documents || this.documents.length === 0) return;
    
    // Get unique parent product IDs from all documents
    const parentProductIds = new Set<number>();
    this.documents.forEach(doc => {
      if (doc.items) {
        doc.items.forEach(item => {
          const parentProductId = (item as any).parentProductId;
          if (parentProductId) {
            parentProductIds.add(parentProductId);
          }
        });
      }
    });
    
    if (parentProductIds.size === 0) return;
    
    // Load parent products
    this.productsService.getProducts().subscribe({
      next: (allProducts) => {
        const parentProducts = allProducts.filter(p => parentProductIds.has(p.id));
        
        // Update all document items to use parent product data
        this.documents.forEach(doc => {
          if (doc.items) {
            doc.items.forEach(item => {
              const parentProductId = (item as any).parentProductId;
              if (parentProductId) {
                const parentProduct = parentProducts.find(p => p.id === parentProductId);
                if (parentProduct) {
                  // Replace the child product with parent product for display
                  (item as any).product = parentProduct;
                  (item as any).productId = parentProductId; // Update productId to parent ID for consistency
                }
              }
            });
          }
        });
      },
      error: (error) => {
        console.error('Error loading parent products for documents:', error);
      }
    });
  }

  editDocumentFromList(document: StockDocument): void {
    this.router.navigate(['/stock/documents/bon-entree/edit', document.id]);
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
    this.isEditMode = true;
    this.documentId = 'new';
    this.document = null;
    this.selectedDepot = null;
    this.selectedSupplier = null;
    this.items = [];
    this.notes = '';
    this.error = '';
    this.success = '';
  }

  cancelCreate(): void {
    this.isEditMode = false;
    this.error = '';
    this.success = '';
  }

  addItem(): void {
    this.items.push({
      id: 0,
      documentId: 0,
      productId: 0,
      famille: '',
      quantity: 1,
      purchasePrice: 0,
      batch: '',
      notes: '',
      barcode: undefined
    });
  }

  removeItem(index: number): void {
    this.items.splice(index, 1);
  }

  selectProduct(item: StockDocumentItem, product: Product): void {
    item.productId = product.id;
    item.famille = typeof product.famille === 'string' ? product.famille : product.famille?.name || '';
    item.product = product as any; // Cast to avoid type mismatch
    this.showProductModal = false;
  }

  selectSupplier(supplier: Supplier): void {
    this.selectedSupplier = supplier;
    this.showSupplierModal = false;
  }

  selectDepot(depot: Depot): void {
    this.selectedDepot = depot;
    this.showDepotModal = false;
  }

  saveDocument(): void {
    if (!this.selectedDepot || this.items.length === 0) {
      this.error = 'Veuillez sélectionner un dépôt et ajouter au moins un article';
      return;
    }

    this.loading = true;
    this.error = '';

    const documentData = {
      depotId: this.selectedDepot.id,
      supplierId: this.selectedSupplier?.id || null,
      items: this.items.map(item => ({
        productId: item.productId,
        famille: item.famille,
        quantity: item.quantity,
        purchasePrice: item.purchasePrice,
        batch: item.batch,
        notes: item.notes
      })),
      notes: this.notes
    };

    if (this.documentId && this.documentId !== 'new') {
      // Update existing document
      this.stockDocsService.updateDocument(parseInt(this.documentId), documentData).subscribe({
        next: (doc) => {
          this.document = doc;
          this.success = 'Document mis à jour avec succès';
          this.loading = false;
          setTimeout(() => this.success = '', 3000);
        },
        error: (error) => {
          this.error = error.error?.error || 'Erreur lors de la mise à jour du document';
          this.loading = false;
          // Auto-dismiss error message after 5 seconds
          setTimeout(() => this.error = '', 5000);
        }
      });
    } else {
      // Create new document
      this.stockDocsService.createEntry(
        documentData.depotId,
        documentData.supplierId,
        documentData.items,
        documentData.notes
      ).subscribe({
        next: (doc) => {
          this.document = doc;
          this.success = 'Document créé avec succès';
          this.loading = false;
          // Auto-dismiss success message after 3 seconds
          setTimeout(() => this.success = '', 3000);
          // Navigate to the new document edit view to avoid param confusion
          this.router.navigate(['/stock/documents/bon-entree/edit', doc.id]);
        },
        error: (error) => {
          this.error = error.error?.error || 'Erreur lors de la création du document';
          this.loading = false;
          // Auto-dismiss error message after 5 seconds
          setTimeout(() => this.error = '', 5000);
        }
      });
    }
  }

  printDocument(doc?: StockDocument): void {
    const target = doc || this.document;
    if (!target) return;
    // Show as "Bon d'entrée" from recipient's perspective
    const printContent = buildScanLikeDocumentHtmlFromDocument(target, 'livraison', null);
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      this.error = 'Impossible d\'ouvrir la fenêtre d\'impression';
      return;
    }
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Bon d'Entrée - ${target.numero}</title>
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

  goBack(): void {
    this.router.navigate(['/stock']);
  }

  getTotalQuantity(items?: any[] | undefined): number {
    const source = items ?? this.items;
    if (!source || source.length === 0) return 0;
    const total = source.reduce((sum, item: any) => {
      const quantity = Number(item.quantity) || 0;
      return sum + quantity;
    }, 0);
    return Math.round(total * 1000) / 1000;
  }

  getTotalCount(items?: any[] | undefined): number {
    const source = items ?? this.items;
    if (!source || source.length === 0) return 0;
    return source.reduce((sum, item: any) => {
      const count = Number(item['count']) || 0;
      return sum + count;
    }, 0);
  }

  getTotalValue(): number {
    return this.items.reduce((total, item) => {
      const quantity = item.quantity || 0;
      const price = item.purchasePrice || 0;
      return total + (quantity * price);
    }, 0);
  }

  getProductFamille(product: Product): string {
    return typeof product.famille === 'string' ? product.famille : product.famille?.name || 'N/A';
  }

  formatDate(date: string | Date): string {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleDateString('fr-FR');
  }

  // Helpers to distinguish returns vs entries
  isReturnDocument(doc: StockDocument): boolean {
    // Check if it's a BON_EXPEDITION type (which is used for returns in the backend)
    return doc.type === 'BON_EXPEDITION';
  }

  getDocumentTypeLabel(doc: StockDocument): string {
    if (this.isReturnDocument(doc)) return 'Bon de Retour';
    switch (doc.type) {
      case 'BON_ENTREE_DEPOT':
        return 'Bon d\'Entrée';
      case 'BON_ENTREE_MAGASIN':
        return 'Bon d\'Entrée magasin';
      case 'BON_EXPEDITION':
        return 'Bon d\'expédition';
      case 'BON_TRANSFERT':
        return 'Bon de transfert';
      case 'FACTURE':
        return 'Facture approuvée';
      default:
        return doc.type as any;
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

  // Group items by parent product for display
  getGroupedItems(items: any[]): any[] {
    if (!items || items.length === 0) return [];
    
    const grouped = new Map<number, any>();
    
    items.forEach(item => {
      const parentProductId = (item as any).parentProductId || item.productId;
      const parentProduct = (item as any).product;
      
      if (grouped.has(parentProductId)) {
        // Add to existing group
        const group = grouped.get(parentProductId);
        group.quantity += parseFloat(item.quantity) || 0;
        group.count += parseInt(item.count) || 1;
        group.childItems.push(item);
      } else {
        // Create new group
        grouped.set(parentProductId, {
          productId: parentProductId,
          product: parentProduct,
          quantity: parseFloat(item.quantity) || 0,
          count: parseInt(item.count) || 1,
          childItems: [item]
        });
      }
    });
    
    return Array.from(grouped.values());
  }
}
