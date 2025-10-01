import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { StockDocumentsService } from '../../../core/services/stock-documents.service';
import { DepotsService } from '../../../core/services/depots.service';
import { ProductsService } from '../../../core/services/products.service';
import { SuppliersService } from '../../../core/services/suppliers.service';
import { StockDocument, StockDocumentItem } from '../../../core/models/stock-document.model';
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
  documentId: string | null = null;
  document: StockDocument | null = null;
  loading = false;
  error = '';
  success = '';

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
    this.documentId = this.route.snapshot.paramMap.get('id');
    this.loadInitialData();
    
    if (this.documentId && this.documentId !== 'new') {
      this.loadDocument();
    }
  }

  loadInitialData(): void {
    this.loading = true;
    
    Promise.all([
      this.depotsService.list().toPromise(),
      this.suppliersService.list().toPromise(),
      this.productsService.getProducts().toPromise()
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
          // Navigate to the new document
          this.router.navigate(['/stock/documents/bon-entree', doc.id]);
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

  printDocument(): void {
    if (!this.document) return;
    // Implement print functionality
    window.print();
  }

  goBack(): void {
    this.router.navigate(['/stock']);
  }

  getTotalQuantity(): number {
    if (!this.items || this.items.length === 0) return 0;
    const total = this.items.reduce((total, item) => {
      const quantity = Number(item.quantity) || 0;
      return total + quantity;
    }, 0);
    return Math.round(total * 1000) / 1000; // Round to 3 decimal places
  }

  getTotalCount(): number {
    if (!this.items || this.items.length === 0) return 0;
    return this.items.reduce((total, item) => {
      const count = Number(item['count']) || 0;
      return total + count;
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
}
