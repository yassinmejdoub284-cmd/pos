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
  filtered = computed(() => this.documents());

  // View state
  view = signal<'pending' | 'history'>('pending');

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

  // Numpad state
  showNumpad = false;
  numpadValue = '';
  numpadTarget: any = null;

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

    // Prefer session depot when available as a fallback
    const session = this.sessionsService.currentSession?.();
    if (session?.depotId) {
      this.currentDepotId = session.depotId;
    } else {
      this.currentDepotId = user?.depotId ?? null;
    }

    // Check if depotId is provided in route params - this takes precedence
    this.route.params.subscribe(params => {
      const depotIdFromRoute = params['depotId'];
      if (depotIdFromRoute && !isNaN(Number(depotIdFromRoute))) {
        this.currentDepotId = Number(depotIdFromRoute);
        // Mark as manual selection so session changes don't override it immediately
        this.manualDepotSelection = true;
        
        // Load documents with the depot ID from route
        this.loadDocuments();
      } else if (this.currentDepotId) {
        // If no route param but we have a fallback ID, load it once
        if (this.documents().length === 0 && !this.loading) {
          this.loadDocuments();
        }
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
        // Only update if not a manual/route selection and we have a new session depot
        if (!this.manualDepotSelection && sess?.depotId && this.currentDepotId !== sess.depotId) {
          this.currentDepotId = sess.depotId;
          this.loadDocuments();
        }
      }
    });

    // Final fallback: if nothing else triggered a load but we have a depot
    if (this.currentDepotId && this.documents().length === 0 && !this.loading) {
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
    if (!this.currentDepotId) {
      this.documents.set([]);
      return;
    }

    this.loading = true;
    this.error = '';
    const depotId = this.currentDepotId;
    const status = this.view() === 'pending' ? 'SENT' : 'RECEIVED';

    // Fetch documents specifically for this depot and status
    this.stockDocs.getDocuments(1, 50, undefined, status, depotId, undefined, undefined, false, true).subscribe({
      next: (res) => {
        const data = Array.isArray(res) ? res : (res?.data ?? []);
        
        // Final sanity check filtering
        const filteredData = data.filter((doc: any) => {
          const isCorrectStatus = doc.status === status;
          const hasItems = doc.items && doc.items.length > 0;
          return isCorrectStatus && hasItems;
        });

        this.documents.set(filteredData);
        this.loading = false;
      },
      error: (err) => {
        this.error = err?.error?.error || 'Erreur lors du chargement des documents';
        this.loading = false;
      }
    });
  }

  setView(newView: 'pending' | 'history'): void {
    this.view.set(newView);
    this.loadDocuments();
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
      const childName = item.childProductName || item.product?.name || `Produit ${item.productId}`;
      const colisCount = item.colisCount || item.count || 1;
      const productKey = `${item.productId}_${item.quantity}_${colisCount}`;
      
      if (!acc[parentName]) {
        acc[parentName] = {
          parentName,
          children: [],
          totalQuantity: 0,
          totalColis: 0
        };
      }
      
      acc[parentName].children.push({
        ...item,
        childName,
        productKey,
        colisCount,
        receivedQuantity: item.receivedQuantity || item.quantity,
        validated: this.validatedProducts.has(productKey)
      });
      
      // Add to parent total quantity and colis
      acc[parentName].totalQuantity += parseFloat(item.receivedQuantity || item.quantity) || 0;
      acc[parentName].totalColis += colisCount;
      
      return acc;
    }, {});

    this.groupedProducts.set(Object.values(grouped));
  }

  updateHistory(doc: StockDocument): void {
    const depotId = this.currentDepotId;
    if (!depotId) return;

    // Prepare items for update
    const items: any[] = [];
    this.groupedProducts().forEach(group => {
      group.children.forEach((child: any) => {
        items.push({
          ...child,
          quantity: child.receivedQuantity // Send the modified quantity as the new source of truth
        });
      });
    });

    this.loading = true;
    this.stockDocs.updateDocument(doc.id, { items }).subscribe({
      next: () => {
        this.loading = false;
        this.closeDetailsModal();
        this.loadDocuments();
        // Show success message or something?
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.error || 'Erreur lors de la mise à jour';
      }
    });
  }

  onQuantityChange(child: any, newQty: any): void {
    const qty = this.parseQty(newQty);
    
    // Update the source of truth (the actual item in the selected document)
    // Child is a copy created by updateGroupedProducts, so we must find the original
    const doc = this.selectedDocument();
    if (doc?.items) {
      const originalItem = doc.items.find((i: any) => i.id === child.id);
      if (originalItem) {
        (originalItem as any).receivedQuantity = qty;
      }
    }

    // Maintain validation state
    if (!this.validatedProducts.has(child.productKey)) {
      this.validatedProducts.add(child.productKey);
    }
    
    // Recalculate everything to update Totals and UI
    this.updateGroupedProducts();
  }

  private parseQty(val: any): number {
    if (val === null || val === undefined || val === '') return 0;
    const parsed = parseFloat(String(val).replace(',', '.'));
    return isNaN(parsed) ? 0 : parsed;
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

  // Numpad methods
  openNumpad(child: any): void {
    this.numpadTarget = child;
    this.numpadValue = child.receivedQuantity?.toString() || '';
    this.showNumpad = true;
  }

  onNumpadClick(key: string): void {
    if (key === '.') {
      if (!this.numpadValue.includes('.')) {
        this.numpadValue += '.';
      }
    } else {
      this.numpadValue += key;
    }
  }

  clearNumpad(): void {
    this.numpadValue = '';
  }

  confirmNumpad(): void {
    if (this.numpadTarget) {
      this.onQuantityChange(this.numpadTarget, this.numpadValue);
    }
    this.closeNumpad();
  }

  closeNumpad(): void {
    this.showNumpad = false;
    this.numpadTarget = null;
    this.numpadValue = '';
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
    
    // Get validated items with their potentially modified quantities
    const validatedItems: any[] = [];
    this.groupedProducts().forEach(group => {
      group.children.forEach((child: any) => {
        if (child.validated) {
          validatedItems.push({
            id: child.id,
            quantity: child.receivedQuantity
          });
        }
      });
    });
    
    // Require at least one validated product
    if (validatedItems.length === 0) {
      this.error = 'Veuillez valider au moins un produit avant d\'approuver le document. Cliquez sur chaque produit pour le valider.';
      return;
    }
    
    this.loading = true;
    this.stockDocs.approveReceipt(doc.id, depotId, validatedItems).subscribe({
      next: (updated) => {
        this.loading = false;
        // Clear validated products
        this.validatedProducts.clear();
        // Refresh the documents list
        this.loadDocuments();
        // Wait a moment for backend transaction to complete, then navigate
        setTimeout(() => {
          // Navigate to shop-transfer page to see the updated inventory with entries
          // Add a timestamp query param to force reload
          this.router.navigate(['/stock/shop-transfer', String(depotId)], {
            queryParams: { refresh: Date.now() },
            onSameUrlNavigation: 'reload'
          });
        }, 300); // 300ms delay to ensure backend transaction is complete
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.error || 'Erreur lors de l\'approbation';
      }
    });
  }
}


