import { Component, OnInit, computed, signal, effect } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { StockDocumentsService } from '../core/services/stock-documents.service';
import { AuthService } from '../core/services/auth.service';
import { SessionsService } from '../core/services/sessions.service';
import { DepotsService } from '../core/services/depots.service';
import { StockDocument } from '../core/models/stock-document.model';

@Component({
  selector: 'app-documents-reception',
  templateUrl: './documents-reception.component.html',
  styleUrls: ['./documents-reception.component.css'],
  standalone: false
})
export class DocumentsReceptionComponent implements OnInit {
  loading = false;
  error = '';

  documents = signal<StockDocument[]>([]);
  filtered = computed(() => {
    const list = this.documents();
    // Show all destinataire documents (all statuses)
    return list;
  });

  // Depot scoping
  currentDepotId: number | null = null;
  depots: any[] = [];
  isAdmin = false;
  showDepotSelector = false;
  manualDepotSelection = false;

  // Details modal
  showDetailsModal = false;
  selectedDocument = signal<StockDocument | null>(null);
  validatedProducts = new Set<string>();
  groupedProducts = signal<any[]>([]);

  constructor(
    private stockDocs: StockDocumentsService,
    private auth: AuthService,
    private depotsService: DepotsService,
    private router: Router,
    private route: ActivatedRoute,
    private sessionsService: SessionsService
  ) {}

  ngOnInit(): void {
    const user = this.auth.currentUser();
    this.isAdmin = (user?.role === 'ADMIN');

    // Prefer session depot when available
    const session = this.sessionsService.currentSession?.();
    if (session?.depotId) {
      this.currentDepotId = session.depotId;
    } else {
      this.currentDepotId = user?.depotId ?? null;
    }

    // Check if depotId is provided in route params
    this.route.params.subscribe(params => {
      const depotIdFromRoute = params['depotId'];
      if (depotIdFromRoute && !isNaN(Number(depotIdFromRoute))) {
        this.currentDepotId = Number(depotIdFromRoute);
        console.log('Depot ID from route:', this.currentDepotId);
        // Load documents with the depot ID from route
        this.loadDocuments();
      }
    });

    if (this.isAdmin) {
      this.loadDepots();
      // If admin and no specific depot selected, show depot selector
      if (!this.currentDepotId) {
        this.showDepotSelector = true;
      }
    }

    // Watch for session depot changes
    this.sessionsService.currentSession$?.subscribe({
      next: (sess: any) => {
        if (!this.manualDepotSelection && sess?.depotId && this.currentDepotId !== sess.depotId) {
          this.currentDepotId = sess.depotId;
          this.loadDocuments();
        }
      }
    });

    // Load documents only if no depot ID from route (fallback)
    // The route params subscription will handle loading when depot ID is in URL
    if (!this.currentDepotId) {
      this.loadDocuments();
    }
  }

  private loadDepots(): void {
    this.depotsService.list().subscribe({
      next: (depots) => { this.depots = depots || []; },
      error: () => {}
    });
  }

  private getScopedDepotId(): number | undefined {
    return this.currentDepotId ?? undefined;
  }

  loadDocuments(): void {
    this.loading = true;
    this.error = '';
    const depotId = this.getScopedDepotId();
    console.log('Loading documents for depot ID:', depotId);
    // Load all document types (filter statuses client-side)
    this.stockDocs.getDocuments(1, 50, undefined, undefined, depotId, undefined, undefined, false, true).subscribe({
      next: (res) => {
        const data = Array.isArray(res) ? res : (res?.data ?? []);
        console.log('Raw documents loaded:', data.length);
        const selectedDepotName = this.getCurrentDepotName();
        // Filter for documents destined to this depot (all types)
        const filteredData = data.filter((doc: any) => {
          const byId = doc?.destinataireId === depotId || doc?.destinataire?.id === depotId;
          const byName = !!selectedDepotName && (doc?.destinataire?.name === selectedDepotName);
          return byId || byName;
        });
        console.log('Filtered documents for depot', depotId, ':', filteredData.length);
        this.documents.set(filteredData);
        this.loading = false;
      },
      error: (err) => {
        this.error = err?.error?.error || 'Erreur lors du chargement des documents';
        this.loading = false;
      }
    });
  }

  openDepotSelector(): void {
    if (this.isAdmin) {
      this.showDepotSelector = true;
    }
  }

  closeDepotSelector(): void {
    this.showDepotSelector = false;
  }

  selectDepot(depotId: number): void {
    this.manualDepotSelection = true;
    this.currentDepotId = depotId;
    this.showDepotSelector = false;
    // Reflect selection in URL so route guard/subscriptions re-load properly
    this.router.navigate(['/documents-reception', depotId]);
  }

  getDocumentTypeLabel(type: string): string {
    switch (type) {
      case 'BON_ENTREE_MAGASIN':
        return 'Bon d\'entrée magasin';
      case 'BON_ENTREE_DEPOT':
        return 'Bon d\'entrée dépôt';
      case 'BON_EXPEDITION':
        return 'Bon de sortie';
      case 'BON_TRANSFERT':
        return 'Bon de transfert';
      case 'FACTURE':
        return 'Facture';
      default:
        return type;
    }
  }

  getCurrentDepotName(): string {
    if (!this.currentDepotId) return 'Aucun dépôt sélectionné';
    const depot = this.depots.find(d => d.id === this.currentDepotId);
    return depot ? depot.name : `Dépôt ${this.currentDepotId}`;
  }

  goHome(): void {
    this.router.navigate(['/home']);
  }

  openDetails(document: StockDocument): void {
    this.selectedDocument.set(document);
    this.validatedProducts.clear(); // Reset validation state
    this.updateGroupedProducts();
    this.showDetailsModal = true;
  }

  closeDetailsModal(): void {
    this.showDetailsModal = false;
    this.selectedDocument.set(null);
    this.validatedProducts.clear(); // Clear validation state
    this.groupedProducts.set([]);
  }

  private updateGroupedProducts(): void {
    const document = this.selectedDocument();
    if (!document?.items) {
      this.groupedProducts.set([]);
      return;
    }

    const grouped = document.items.reduce((acc: any, item: any) => {
      const parentName = item.product?.famille?.name || item.famille || item.parentProductName || 'Produit';
      const childName = item.product?.name || item.childProductName || `Produit ${item.productId}`;
      const productKey = `${item.productId}_${item.quantity}_${item.count}`;
      
      if (!acc[parentName]) {
        acc[parentName] = {
          parentName,
          children: [],
          totalQuantity: 0
        };
      }
      
      acc[parentName].children.push({
        ...item,
        childName,
        productKey,
        validated: this.validatedProducts.has(productKey)
      });
      
      // Add to parent total quantity
      acc[parentName].totalQuantity += parseFloat(item.quantity) || 0;
      
      return acc;
    }, {});

    this.groupedProducts.set(Object.values(grouped));
  }

  toggleProductValidation(child: any): void {
    const productKey = child.productKey;
    if (this.validatedProducts.has(productKey)) {
      this.validatedProducts.delete(productKey);
    } else {
      this.validatedProducts.add(productKey);
    }
    // Update the grouped products to reflect the change
    this.updateGroupedProducts();
  }

  getValidatedCount(): number {
    return this.validatedProducts.size;
  }

  getTotalProductCount(): number {
    const groups = this.groupedProducts();
    return groups.reduce((total, group: any) => {
      return total + group.children.length;
    }, 0);
  }

  getValidationProgress(): number {
    const total = this.getTotalProductCount();
    if (total === 0) return 0;
    return (this.getValidatedCount() / total) * 100;
  }

  approve(doc: StockDocument): void {
    const depotId = this.getScopedDepotId();
    if (!depotId) {
      this.error = 'Dépôt cible introuvable';
      return;
    }
    if (doc.status !== 'SENT') {
      this.error = `Le document ${doc.numero} n'est pas prêt pour approbation (statut: ${doc.status}).`;
      return;
    }
    this.loading = true;
    this.stockDocs.approveReceipt(doc.id, depotId).subscribe({
      next: (updated) => {
        this.loading = false;
        // Refresh the documents list
        this.loadDocuments();
        this.router.navigate(['/stock/documents/bon-entree', String(depotId)]);
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.error || 'Erreur lors de l\'approbation';
      }
    });
  }
}


