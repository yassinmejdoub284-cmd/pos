import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { StockDocumentsService } from '../../../core/services/stock-documents.service';
import { DepotsService } from '../../../core/services/depots.service';
import { ProductsService } from '../../../core/services/products.service';
import { StockDocument, StockDocumentItem } from '../../../core/models/stock-document.model';
import { Depot } from '../../../core/models/stock-document.model';
import { Product } from '../../../core/models/product.model';

@Component({
  selector: 'app-bon-sortie',
  templateUrl: './bon-sortie.component.html',
  styleUrls: ['./bon-sortie.component.css'],
  standalone: false
})
export class BonSortieComponent implements OnInit {
  documentId: string | null = null;
  document: StockDocument | null = null;
  loading = false;
  error = '';
  success = '';

  // Form data
  selectedFromDepot: Depot | null = null;
  selectedToDepot: Depot | null = null;
  items: StockDocumentItem[] = [];
  notes = '';

  // Available options
  depots: Depot[] = [];
  products: Product[] = [];

  // UI state
  showProductModal = false;
  showDepotModal = false;
  currentDepotType: 'from' | 'to' = 'from';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private stockDocsService: StockDocumentsService,
    private depotsService: DepotsService,
    private productsService: ProductsService
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
      this.productsService.getProducts().toPromise()
    ]).then(([depots, products]) => {
      this.depots = depots || [];
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
        this.selectedFromDepot = doc.emetteur || null;
        this.selectedToDepot = doc.destinataire || null;
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

  selectDepot(depot: Depot): void {
    if (this.currentDepotType === 'from') {
      this.selectedFromDepot = depot;
    } else {
      this.selectedToDepot = depot;
    }
    this.showDepotModal = false;
  }

  openDepotModal(type: 'from' | 'to'): void {
    this.currentDepotType = type;
    this.showDepotModal = true;
  }

  saveDocument(): void {
    if (!this.selectedFromDepot || !this.selectedToDepot || this.items.length === 0) {
      this.error = 'Veuillez sélectionner les dépôts et ajouter au moins un article';
      return;
    }

    this.loading = true;
    this.error = '';

    const documentData = {
      emetteurId: this.selectedFromDepot.id,
      destinataireId: this.selectedToDepot.id,
      items: this.items.map(item => ({
        productId: item.productId,
        famille: item.famille,
        quantity: item.quantity,
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
          this.error = 'Erreur lors de la mise à jour du document';
          this.loading = false;
        }
      });
    } else {
      // Create new document
      this.stockDocsService.createExpedition(
        documentData.emetteurId,
        documentData.destinataireId,
        documentData.items,
        documentData.notes
      ).subscribe({
        next: (doc) => {
          this.document = doc;
          this.success = 'Document créé avec succès';
          this.loading = false;
          // Navigate to the new document
          this.router.navigate(['/stock/documents/bon-sortie', doc.id]);
        },
        error: (error) => {
          this.error = 'Erreur lors de la création du document';
          this.loading = false;
        }
      });
    }
  }

  printDocument(): void {
    if (!this.document) return;
    window.print();
  }

  goBack(): void {
    this.router.navigate(['/stock']);
  }

  getTotalQuantity(): number {
    return this.items.reduce((total, item) => total + (item.quantity || 0), 0);
  }

  getProductFamille(product: Product): string {
    return typeof product.famille === 'string' ? product.famille : product.famille?.name || 'N/A';
  }
}
