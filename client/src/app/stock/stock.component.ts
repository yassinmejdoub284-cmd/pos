import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { DepotsService } from '../core/services/depots.service';
import { Depot } from '../core/models/depot.model';
import { StockDocumentsService } from '../core/services/stock-documents.service';
import { AuthService } from '../core/services/auth.service';
import { StockDocumentActionDialogComponent } from '../shared/stock-document-action-dialog/stock-document-action-dialog.component';
import { SessionsService } from '../core/services/sessions.service';
import { SettingsService, AppSettings } from '../core/services/settings.service';
import { StockDocument } from '../core/models/stock-document.model';
import { ProductsService } from '../core/services/products.service';
import { InventoryService } from '../core/services/inventory.service';
import { Product } from '../core/models/product.model';
import { MessageDialogComponent } from '../shared/message-dialog/message-dialog.component'; '../shared/message-dialog/message-dialog.component';

@Component({
  selector: 'app-stock',
  templateUrl: './stock.component.html',
  standalone: false
})
export class StockComponent implements OnInit {
  depots: Depot[] = [];
  loading = false;
  error = '';
  pendingDocumentsCount = 0;

  showActionDepotModal = false;
  selectedAction: string | null = null;
  documentsSelectedType: string = '';
  showDocumentsDialog = false;
  showFleetManagementDialog = false;
  showAchatDialog = false;
  showDepotManagementModal = false;
  showDepotProductsModal = false;
  selectedDepot: Depot | null = null;
  depotProducts: any[] = [];
  filteredProducts: any[] = [];
  searchProductTerm = '';
  loadingProducts = false;

  sourceDepotId: number | null = null;
  destinationDepotId: number | null = null;
  sourceDepotProducts: any[] = [];
  destinationDepotProducts: any[] = [];
  sourceSearchTerm = '';
  destinationSearchTerm = '';
  loadingSourceProducts = false;
  loadingDestinationProducts = false;
  droppedSourceProducts: any[] = [];
  droppedDestinationProduct: any | null = null;
  sourceProductsError: string | null = null;
  destinationProductsError: string | null = null;
  savingLinks = false;
  private isLoadingProducts = false;
  private isSettingSourceDepotProgrammatically = false;

  showMessageDialog = false;
  messageDialogTitle = '';
  messageDialogMessage = '';
  messageDialogType: 'error' | 'success' | 'warning' | 'info' = 'info';

  actionCards: Array<{ id: string; title: string; description: string; icon: string; color: string; }> = [];

  private appSettings: AppSettings | null = null;

  constructor(
    private depotsService: DepotsService,
    public router: Router,
    private stockDocs: StockDocumentsService,
    private authService: AuthService,
    private sessionsService: SessionsService,
    private settingsService: SettingsService,
    private productsService: ProductsService,
    private inventoryService: InventoryService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.loadDepots();
    this.loadPendingDocumentsCount();
    this.settingsService.getSettings().subscribe({
      next: (s) => {
        this.appSettings = s;
        this.filterActionCardsByAccess();
      },
      error: () => { }
    });
    this.sessionsService.currentSession$?.subscribe({
      next: (sess: any) => {
        if (sess?.depotId) {
          this.loadPendingDocumentsCount();
        }
      }
    });
  }

  private getEffectiveRoleKey(): string | null {
    const user: any = this.authService.currentUser();
    if (!user) return null;
    if (user.roleKey && typeof user.roleKey === 'string') return user.roleKey;
    const raw = String(user.role || '');
    const access: any = this.appSettings?.roleAccessConfig;
    if (access && access[raw]) return raw;
    if (access && typeof access === 'object') {
      const match = Object.keys(access).find(k => (access[k]?.meta?.label || '').toLowerCase() === raw.toLowerCase());
      if (match) return match;
    }
    return raw.trim().toUpperCase().replace(/\s+/g, '_');
  }

  private getAllowedStockSubmodules(): Set<string> {
    const roleKey = this.getEffectiveRoleKey();
    const subs = roleKey ? (this.appSettings as any)?.roleAccessConfig?.[roleKey]?.blocks?.['stock']?.submodules || {} : {};
    return new Set(Object.keys(subs).filter(k => subs[k] === true));
  }

  private filterActionCardsByAccess(): void {
    const allowed = this.getAllowedStockSubmodules();
    if (!allowed || allowed.size === 0) {
      this.actionCards = [];
      return;
    }
    const allCards: Array<{ id: string; title: string; description: string; icon: string; color: string; }> = [
      { id: 'achat', title: 'Achat', description: 'Créer un bon d\'entrée ou un bon de retour', icon: 'M12 4v16m8-8H4', color: 'from-emerald-500 to-green-600' },
      { id: 'documents-reception', title: 'Centre de Réception', description: 'Réceptionner les documents de stock', icon: 'M9 12l2 2 4-4m2-4h-3.18A2 2 0 0012 2a2 2 0 00-1.82 2H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V6a2 2 0 00-2-2z', color: 'from-teal-500 to-cyan-600' },
      { id: 'documents', title: 'Historique des documents', description: 'Consulter les documents de stock', icon: 'M6 2h8l4 4v14a2 2 0 01-2 2H6a2 2 0 01-2-2V4a2 2 0 012-2zm7 0v4h4M12 9a5 5 0 105 5 5 5 0 00-5-5zm0 2v3l2 1', color: 'from-blue-600 to-indigo-700' },
      { id: 'fleet-management', title: 'Gestion de parc', description: 'Véhicules et chauffeurs', icon: 'M12 2a10 10 0 110 20 10 10 0 010-20zm0 4a6 6 0 016 6h-3a3 3 0 00-6 0H6a6 6 0 016-6zm0 7a2 2 0 110 4 2 2 0 010-4z', color: 'from-indigo-500 to-purple-600' },
      { id: 'stock', title: 'Gestion de Stock', description: 'Gérer les produits et inventaires', icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4', color: 'from-blue-500 to-indigo-600' },
      { id: 'inventory', title: 'Inventaire', description: 'Faire l\'inventaire du dépôt', icon: 'M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01', color: 'from-purple-500 to-violet-600' },
      { id: 'stock-history', title: 'Historique du stock', description: 'Archives et analyses des transactions de stock', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z', color: 'from-cyan-500 to-blue-600' },
      { id: 'client-gros', title: 'Configuration Gros', description: 'Configurer les règles et tarifs en gros', icon: 'M3 7h18M3 12h18M3 17h18', color: 'from-amber-500 to-orange-600' },
      { id: 'client-return', title: 'Retour Client', description: 'Gérer les retours clients et avoirs', icon: 'M16 15v-1a4 4 0 00-4-4H8m0 0l3 3m-3-3l3-3m5 14v-5a2 2 0 00-2-2H6a2 2 0 00-2 2v5a2 2 0 002 2h8a2 2 0 002-2z', color: 'from-rose-500 to-pink-600' }
    ];

    const map: Record<string, string> = {
      'achat': 'stock-achat',
      'documents-reception': 'stock-reception',
      'documents': 'stock-historique-docs',
      'fleet-management': 'stock-parc',
      'stock': 'stock-gestion',
      'inventory': 'stock-inventaire',
      'stock-history': 'stock-historique',
      'client-gros': 'stock-gros-config',
      'client-return': 'stock-achat'
    };

    this.actionCards = allCards.filter(card => {
      const subId = map[card.id];
      return !!subId && allowed.has(subId);
    });
  }

  hasStockSubmodule(subId: string): boolean {
    const allowed = this.getAllowedStockSubmodules();
    return allowed.has(subId);
  }

  loadDepots() {
    this.loading = true;
    this.depotsService.list().subscribe({
      next: (depots) => {
        this.depots = depots.filter(d => d.isActive);
        this.loading = false;
      },
      error: () => {
        this.error = "Erreur lors du chargement des dépôts";
        this.loading = false;
      }
    });
  }

  loadPendingDocumentsCount(): void {
    const depotId = this.sessionsService.getActiveDepotId();
    if (!depotId) return;

    this.stockDocs.getDocuments(1, 50, 'BON_ENTREE_MAGASIN', undefined, depotId).subscribe({
      next: (response) => {
        const documents = Array.isArray(response) ? response : (response?.data ?? []);
        this.pendingDocumentsCount = documents.filter((d: any) =>
          d.type === 'BON_ENTREE_MAGASIN' &&
          (d.status === 'SENT' || d.status === 'PREPARED') &&
          d.destinataireId === depotId
        ).length;
      },
      error: () => {
        this.pendingDocumentsCount = 0;
      }
    });
  }

  openWorkspace(depot: Depot): void {
    if (!depot) {
      return;
    }

    this.showDepotProductsModal = false;
    this.selectedDepot = null;
    this.cdr.detectChanges();

    requestAnimationFrame(() => {
      this.selectedDepot = depot;
      this.showDepotProductsModal = true;
      this.searchProductTerm = '';
      this.depotProducts = [];
      this.filteredProducts = [];
      this.loadingProducts = false;

      this.destinationDepotId = null;
      this.sourceDepotProducts = [];
      this.destinationDepotProducts = [];
      this.droppedSourceProducts = [];
      this.droppedDestinationProduct = null;
      this.sourceSearchTerm = '';
      this.destinationSearchTerm = '';
      this.sourceProductsError = null;
      this.destinationProductsError = null;

      this.cdr.detectChanges();

      if (depot.type !== 'SHOP') {
        requestAnimationFrame(() => {
          this.loadDepotProducts(depot);
        });
      }
    });
  }

  loadDepotProducts(depot: Depot): void {
    if (this.isLoadingProducts) {
      return;
    }

    this.isLoadingProducts = true;
    this.loadingProducts = true;
    this.depotProducts = [];
    this.filteredProducts = [];
    this.destinationDepotId = null;
    this.sourceDepotProducts = [];
    this.destinationDepotProducts = [];
    this.droppedSourceProducts = [];
    this.droppedDestinationProduct = null;
    this.sourceSearchTerm = '';
    this.destinationSearchTerm = '';
    this.sourceProductsError = null;
    this.destinationProductsError = null;

    if (depot.type !== 'SHOP') {
      this.isSettingSourceDepotProgrammatically = true;
      this.sourceDepotId = depot.id;
      this.loadSourceDepotProducts(depot.id);
      setTimeout(() => {
        this.isSettingSourceDepotProgrammatically = false;
      }, 100);
    } else {
      this.sourceDepotId = null;
      this.loadingProducts = false;
      this.isLoadingProducts = false;
    }
  }

  loadSourceDepotProducts(depotId: number): void {
    if (this.loadingSourceProducts) {
      return;
    }

    this.loadingSourceProducts = true;
    this.sourceDepotProducts = [];
    this.sourceProductsError = null;

    let sourceDepot = this.depots.find(d => d.id === depotId);

    if (!sourceDepot) {
      this.depotsService.get(depotId).subscribe({
        next: (depot) => {
          sourceDepot = depot;
          this.loadProductsForSourceDepot(depotId, depot.type);
        },
        error: () => {
          this.sourceProductsError = 'Dépôt source introuvable';
          this.loadingSourceProducts = false;
        }
      });
      return;
    }

    this.loadProductsForSourceDepot(depotId, sourceDepot.type);
  }

  private loadProductsForSourceDepot(depotId: number, depotType: string): void {
    this.inventoryService.getProductsForDepot(depotId, depotType).subscribe({
      next: (products) => {
        const validProducts = (products || []).filter(p => {
          if (!p || !p.id || isNaN(parseInt(String(p.id)))) {
            return false;
          }
          return this.canProductBeLinked(p, depotId, depotType);
        });
        this.sourceDepotProducts = validProducts;
        this.depotProducts = validProducts;
        this.filteredProducts = validProducts;
        this.sourceProductsError = null;
        this.loadingSourceProducts = false;
        this.loadingProducts = false;
        this.isLoadingProducts = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        this.sourceDepotProducts = [];
        this.depotProducts = [];
        this.filteredProducts = [];
        this.sourceProductsError = error.error?.error || error.message || 'Erreur lors du chargement des produits';
        this.loadingSourceProducts = false;
        this.loadingProducts = false;
        this.isLoadingProducts = false;
        this.cdr.detectChanges();
      }
    });
  }

  loadDestinationDepotProducts(depotId: number): void {
    this.loadingDestinationProducts = true;
    this.destinationDepotProducts = [];
    this.destinationProductsError = null;

    let destinationDepot = this.depots.find(d => d.id === depotId);

    if (!destinationDepot) {
      this.depotsService.get(depotId).subscribe({
        next: (depot) => {
          destinationDepot = depot;
          this.loadProductsForDestinationDepot(depotId, depot.type);
        },
        error: () => {
          this.destinationProductsError = 'Dépôt destination introuvable';
          this.loadingDestinationProducts = false;
        }
      });
      return;
    }

    this.loadProductsForDestinationDepot(depotId, destinationDepot.type);
  }

  private loadProductsForDestinationDepot(depotId: number, depotType: string): void {
    this.inventoryService.getProductsForDepot(depotId, depotType).subscribe({
      next: (products) => {
        const validProducts = (products || []).filter(p => {
          if (!p || !p.id || isNaN(parseInt(String(p.id)))) {
            return false;
          }
          return this.canProductBeLinked(p, depotId, depotType);
        });
        this.destinationDepotProducts = validProducts;
        this.destinationProductsError = null;
        this.loadingDestinationProducts = false;
      },
      error: (error) => {
        this.destinationDepotProducts = [];

        if (error.status === 403) {
          this.destinationProductsError = 'Accès refusé : Vous n\'avez pas les permissions pour accéder à ce dépôt';
        } else if (error.status === 400) {
          this.destinationProductsError = error.error?.error || 'Dépôt invalide ou manquant';
        } else {
          this.destinationProductsError = error.error?.error || error.message || 'Erreur lors du chargement des produits';
        }
        this.loadingDestinationProducts = false;
      }
    });
  }

  private canProductBeLinked(product: any, depotId: number, depotType: string): boolean {
    if (!product || !product.id || isNaN(parseInt(String(product.id)))) {
      return false;
    }

    const productId = parseInt(String(product.id));
    if (isNaN(productId) || productId <= 0) {
      return false;
    }

    if (depotType === 'SHOP') {
      return true;
    }

    if (depotType === 'MAIN' || depotType === 'BRANCH' || depotType === 'WAREHOUSE') {
      return true;
    }

    return false;
  }

  filterSourceProducts(): void {
    if (!this.sourceSearchTerm.trim()) {
      return;
    }
  }

  filterDestinationProducts(): void {
    if (!this.destinationSearchTerm.trim()) {
      return;
    }
  }

  getFilteredSourceProducts(): any[] {
    if (!this.sourceSearchTerm.trim()) {
      return this.sourceDepotProducts;
    }
    const searchTerm = this.sourceSearchTerm.toLowerCase().trim();
    return this.sourceDepotProducts.filter(product => {
      const name = (product.name || '').toLowerCase();
      const barcode = (product.barcode || '').toLowerCase();
      const famille = (product.famille?.name || product.familleName || '').toLowerCase();
      return name.includes(searchTerm) || barcode.includes(searchTerm) || famille.includes(searchTerm);
    });
  }

  getFilteredDestinationProducts(): any[] {
    if (!this.destinationSearchTerm.trim()) {
      return this.destinationDepotProducts;
    }
    const searchTerm = this.destinationSearchTerm.toLowerCase().trim();
    return this.destinationDepotProducts.filter(product => {
      const name = (product.name || '').toLowerCase();
      const barcode = (product.barcode || '').toLowerCase();
      const famille = (product.famille?.name || product.familleName || '').toLowerCase();
      return name.includes(searchTerm) || barcode.includes(searchTerm) || famille.includes(searchTerm);
    });
  }

  onSourceProductDragStart(event: DragEvent, product: any): void {
    if (event.dataTransfer) {
      event.dataTransfer.setData('application/json', JSON.stringify({ type: 'source', product }));
      event.dataTransfer.effectAllowed = 'move';
    }
  }

  onDestinationProductDragStart(event: DragEvent, product: any): void {
    if (event.dataTransfer) {
      event.dataTransfer.setData('application/json', JSON.stringify({ type: 'destination', product }));
      event.dataTransfer.effectAllowed = 'move';
    }
  }

  onSourceDropZoneDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
  }

  onDestinationDropZoneDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
  }

  onSourceDropZoneDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();

    try {
      const data = event.dataTransfer?.getData('application/json');
      if (data) {
        const parsed = JSON.parse(data);
        if (parsed.type === 'source' && parsed.product) {
          if (this.isBothDepotsNonShop()) {
            this.droppedSourceProducts = [parsed.product];
          } else {
            const exists = this.droppedSourceProducts.some(p => p.id === parsed.product.id);
            if (!exists) {
              this.droppedSourceProducts.push(parsed.product);
            }
          }
        }
      }
    } catch (error) {
    }
  }

  onDestinationDropZoneDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();

    try {
      const data = event.dataTransfer?.getData('application/json');
      if (data) {
        const parsed = JSON.parse(data);
        if (parsed.type === 'destination' && parsed.product) {
          this.droppedDestinationProduct = parsed.product;
        }
      }
    } catch (error) {
    }
  }

  removeSourceProduct(index: number): void {
    this.droppedSourceProducts.splice(index, 1);
  }

  clearDestinationProduct(): void {
    this.droppedDestinationProduct = null;
  }

  onSourceDepotChange(): void {
    if (this.isSettingSourceDepotProgrammatically) {
      return;
    }

    if (this.isLoadingProducts || this.loadingSourceProducts) {
      return;
    }

    if (this.sourceDepotId) {
      this.loadSourceDepotProducts(this.sourceDepotId);
      this.droppedSourceProducts = [];
    } else {
      this.sourceDepotProducts = [];
      this.droppedSourceProducts = [];
    }
  }

  onDestinationDepotChange(): void {
    if (this.destinationDepotId) {
      this.loadDestinationDepotProducts(this.destinationDepotId);
      this.droppedDestinationProduct = null;
      this.filterSourceProductsForCompatibility();
    } else {
      this.destinationDepotProducts = [];
      this.droppedDestinationProduct = null;
    }
  }

  private filterSourceProductsForCompatibility(): void {
    if (!this.sourceDepotId || !this.destinationDepotId) {
      return;
    }

    const sourceDepot = this.depots.find(d => d.id === this.sourceDepotId);
    const destinationDepot = this.depots.find(d => d.id === this.destinationDepotId);

    if (!sourceDepot || !destinationDepot) {
      return;
    }

    this.sourceDepotProducts = this.sourceDepotProducts.filter(p =>
      this.canProductBeLinked(p, this.sourceDepotId!, sourceDepot.type)
    );

    this.droppedSourceProducts = this.droppedSourceProducts.filter(p =>
      this.canProductBeLinked(p, this.sourceDepotId!, sourceDepot.type)
    );
  }

  refreshDestinationProducts(): void {
    if (this.destinationDepotId) {
      this.loadDestinationDepotProducts(this.destinationDepotId);
    }
  }

  refreshSourceProducts(): void {
    if (this.sourceDepotId) {
      this.loadSourceDepotProducts(this.sourceDepotId);
    }
  }

  getAvailableDestinations(): Depot[] {
    return this.depots.filter(d => d.id !== this.selectedDepot?.id);
  }

  isNonShopDepot(depot: Depot | null): boolean {
    if (!depot) return false;
    return depot.type === 'MAIN' || depot.type === 'BRANCH' || depot.type === 'WAREHOUSE';
  }

  isShopDepot(depot: Depot | null): boolean {
    if (!depot) return false;
    return depot.type === 'SHOP';
  }

  isBothDepotsNonShop(): boolean {
    if (!this.sourceDepotId || !this.destinationDepotId) {
      return false;
    }

    const sourceDepot = this.depots.find(d => d.id === this.sourceDepotId);
    const destinationDepot = this.depots.find(d => d.id === this.destinationDepotId);

    return sourceDepot !== undefined &&
      destinationDepot !== undefined &&
      sourceDepot.type !== 'SHOP' &&
      destinationDepot.type !== 'SHOP';
  }

  filterProducts(): void {
    if (!this.searchProductTerm.trim()) {
      this.filteredProducts = this.depotProducts;
      return;
    }

    const searchTerm = this.searchProductTerm.toLowerCase().trim();
    this.filteredProducts = this.depotProducts.filter(product => {
      const name = (product.name || '').toLowerCase();
      const barcode = (product.barcode || '').toLowerCase();
      const famille = (product.famille?.name || '').toLowerCase();
      return name.includes(searchTerm) || barcode.includes(searchTerm) || famille.includes(searchTerm);
    });
  }

  closeDepotProductsModal(): void {
    if (!this.showDepotProductsModal) {
      return;
    }
    this.showDepotProductsModal = false;
    this.selectedDepot = null;
    this.depotProducts = [];
    this.filteredProducts = [];
    this.searchProductTerm = '';
    this.sourceDepotId = null;
    this.destinationDepotId = null;
    this.sourceDepotProducts = [];
    this.destinationDepotProducts = [];
    this.droppedSourceProducts = [];
    this.droppedDestinationProduct = null;
    this.sourceSearchTerm = '';
    this.destinationSearchTerm = '';
    this.sourceProductsError = null;
    this.destinationProductsError = null;
    this.loadingProducts = false;
    this.loadingSourceProducts = false;
    this.loadingDestinationProducts = false;
    this.isLoadingProducts = false;
    this.isSettingSourceDepotProgrammatically = false;
    this.cdr.detectChanges();
  }

  openActionDepotSelection(action: string): void {
    this.selectedAction = action;
    this.error = '';

    const currentUser = this.authService.currentUser();

    if (action === 'stock') {
      if (this.isAdmin()) {
        this.showActionDepotModal = true;
        return;
      }

      const visitingDepotIdStr = sessionStorage.getItem('visitingDepotId');
      const userDepotId = currentUser?.depotId;
      const depotId = visitingDepotIdStr ? parseInt(visitingDepotIdStr) : userDepotId;

      if (depotId) {
        this.router.navigate(['/stock/shop-transfer', depotId]);
      } else {
        this.router.navigate(['/stock/produits']);
      }
      return;
    }

    if (action === 'fleet-management' || action === 'documents' || action === 'achat' || action === 'client-gros' || action === 'client-return') {
      if (action === 'achat') {
        this.showAchatDialog = true;
        return;
      }
      if (action === 'documents') {
        this.showDocumentsDialog = true;
        return;
      }
      if (action === 'fleet-management') {
        this.showFleetManagementDialog = true;
        return;
      }
      if (action === 'client-gros') {
        this.router.navigate(['/client-gros']);
        return;
      }
      if (action === 'client-return') {
        this.router.navigate(['/stock/documents/bon-retour/client-return']);
        return;
      }
      this.router.navigate(['/stock/transport']);
      return;
    }

    if (!this.isAdmin()) {
      this.routeToAssignedDepot(action);
      return;
    }

    this.showActionDepotModal = true;
  }

  onDocumentsActionSelected(actionId: 'all' | 'factures' | 'bon-livraison' | 'bon-expedition' | 'bon-transfert'): void {
    this.showDocumentsDialog = false;
    const type = actionId === 'factures'
      ? 'FACTURE'
      : actionId === 'bon-livraison'
        ? 'BON_ENTREE_MAGASIN'
        : actionId === 'bon-expedition'
          ? 'BON_EXPEDITION'
          : actionId === 'bon-transfert'
            ? 'BON_TRANSFERT'
            : '';
    const currentUser = this.authService.currentUser();
    if (this.isAdmin()) {
      this.documentsSelectedType = type;
      this.selectedAction = 'documents-list-select';
      this.showActionDepotModal = true;
      return;
    }
    const depotId = currentUser?.depotId;
    const queryParams: any = {};
    if (type) queryParams.type = type;
    if (depotId) queryParams.depotId = depotId;
    this.router.navigate(['/stock/documents'], { queryParams });
  }

  onFleetManagementActionSelected(actionId: 'vehicles' | 'drivers'): void {
    this.showFleetManagementDialog = false;
    if (actionId === 'vehicles') {
      this.router.navigate(['/stock/vehicles']);
    } else if (actionId === 'drivers') {
      this.router.navigate(['/stock/drivers']);
    }
  }

  closeFleetManagementDialog(): void {
    this.showFleetManagementDialog = false;
  }

  onAchatActionSelected(actionId: 'entry' | 'bon-retour'): void {
    this.showAchatDialog = false;

    if (this.isAdmin()) {
      this.selectedAction = actionId === 'entry' ? 'consult-entry' : 'consult-bon-retour';
      this.showActionDepotModal = true;
    } else {
      const currentUser = this.authService.currentUser();
      const depotId = currentUser?.depotId;
      if (depotId) {
        this.router.navigate(['/stock/achat-consultation', actionId, depotId]);
      } else {
        this.error = 'Utilisateur non connecté ou dépôt non assigné';
      }
    }
  }

  closeAchatDialog(): void {
    this.showAchatDialog = false;
  }

  closeActionDepotModal(): void {
    this.showActionDepotModal = false;
    this.selectedAction = null;
  }

  getAvailableDepots(): Depot[] {
    if (this.selectedAction === 'stock-history' || this.selectedAction === 'fleet-management') {
      return this.depots.filter(depot => depot.type !== 'SHOP');
    }
    return this.depots;
  }

  getNonShopDepots(): Depot[] {
    return this.depots.filter(depot => depot.type !== 'SHOP');
  }

  selectDepotForAction(depot: Depot): void {
    if (!this.selectedAction) return;

    const action = this.selectedAction;
    this.closeActionDepotModal();

    switch (action) {
      case 'stock':
        this.router.navigate(['/stock/shop-transfer', depot.id]);
        break;
      case 'entry':
        this.router.navigate(['/stock/documents/bon-entree', depot.id]);
        break;
      case 'bon-retour':
        this.router.navigate(['/stock/documents/bon-retour', depot.id]);
        break;
      case 'consult-entry':
        this.router.navigate(['/stock/achat-consultation', 'entry', depot.id]);
        break;
      case 'consult-bon-retour':
        this.router.navigate(['/stock/achat-consultation', 'bon-retour', depot.id]);
        break;
      case 'documents-reception':
        this.router.navigate(['/documents-reception', depot.id]);
        break;
      case 'inventory':
        this.router.navigate(['/inventory', depot.id]);
        break;
      case 'stock-history':
        this.router.navigate(['/stock/stock-history', depot.id]);
        break;
      case 'fleet-management':
        this.showFleetManagementDialog = true;
        break;
      case 'bon-transfert':
        this.router.navigate(['/stock/documents/bon-transfert', depot.id]);
        break;
      case 'bon-livraison':
        this.router.navigate(['/stock/documents'], { queryParams: { type: 'BON_ENTREE_MAGASIN' } });
        break;
      case 'documents-list-select': {
        const qp: any = {};
        if (this.documentsSelectedType) qp.type = this.documentsSelectedType;
        qp.depotId = depot.id;
        this.router.navigate(['/stock/documents'], { queryParams: qp });
        break;
      }
    }
  }

  getActionTitle(): string {
    switch (this.selectedAction) {
      case 'stock':
        return 'Gestion de Stock';
      case 'entry':
        return 'Bon d\'entrée';
      case 'bon-retour':
        return 'Bon de retour';
      case 'documents':
        return 'Documents';
      case 'documents-reception':
        return 'Réception Documents';
      case 'fleet-management':
        return 'Gestion de parc';
      case 'inventory':
        return 'Inventaire';
      case 'stock-history':
        return 'Historique du stock';
      default:
        return 'Action';
    }
  }

  getActionIcon(): string {
    switch (this.selectedAction) {
      case 'stock':
        return 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4';
      case 'entry':
        return 'M12 4v16m8-8H4';
      case 'bon-retour':
        return 'M19 14l-7 7m0 0l-7-7m7 7V3';
      case 'documents':
        return 'M3 7h18M3 12h18M3 17h18';
      case 'documents-reception':
        return 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z';
      case 'fleet-management':
        return 'M5 11a1 1 0 011-1h12a1 1 0 011 1v6a1 1 0 01-1 1H6a1 1 0 01-1-1v-6zM5 11V9a2 2 0 012-2h10a2 2 0 012 2v2M7 15h.01M17 15h.01';
      case 'inventory':
        return 'M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01';
      case 'stock-history':
        return 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z';
      case 'bon-sortie':
        return 'M20 12H4m16 0l-4-4m4 4l-4 4';
      case 'bon-transfert':
        return 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4';
      case 'bon-livraison':
        return 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4';
      default:
        return 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z';
    }
  }

  getActionIconClass(): string {
    switch (this.selectedAction) {
      case 'stock':
        return 'bg-gradient-to-br from-blue-500 to-cyan-600';
      case 'entry':
        return 'bg-gradient-to-br from-emerald-500 to-green-600';
      case 'bon-retour':
        return 'bg-gradient-to-br from-rose-500 to-red-600';
      case 'documents-reception':
        return 'bg-gradient-to-br from-teal-500 to-cyan-600';
      case 'fleet-management':
        return 'bg-gradient-to-br from-indigo-500 to-purple-600';
      case 'inventory':
        return 'bg-gradient-to-br from-emerald-500 to-teal-600';
      case 'stock-history':
        return 'bg-gradient-to-br from-cyan-500 to-blue-600';
      case 'documents':
        return 'bg-gradient-to-br from-blue-600 to-indigo-700';
      default:
        return 'bg-gradient-to-br from-gray-500 to-slate-600';
    }
  }



  getDepotIcon(depot: Depot): string {
    switch (depot.type) {
      case 'MAIN':
        return 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4';
      case 'BRANCH':
        return 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4';
      case 'SHOP':
        return 'M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z';
      case 'WAREHOUSE':
        return 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4';
      default:
        return 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4';
    }
  }

  getDepotIconColor(depot: Depot): string {
    switch (depot.type) {
      case 'MAIN':
        return 'text-white';
      case 'BRANCH':
        return 'text-white';
      case 'SHOP':
        return 'text-white';
      case 'WAREHOUSE':
        return 'text-white';
      default:
        return 'text-white';
    }
  }

  getDepotGradient(depot: Depot): string {
    switch (depot.type) {
      case 'MAIN':
        return 'from-emerald-500 to-green-600';
      case 'BRANCH':
        return 'from-blue-500 to-cyan-600';
      case 'SHOP':
        return 'from-orange-500 to-amber-600';
      case 'WAREHOUSE':
        return 'from-purple-500 to-indigo-600';
      default:
        return 'from-gray-500 to-slate-600';
    }
  }

  getDepotHoverGradient(depot: Depot): string {
    switch (depot.type) {
      case 'MAIN':
        return 'to-emerald-500/5';
      case 'BRANCH':
        return 'to-blue-500/5';
      case 'SHOP':
        return 'to-orange-500/5';
      case 'WAREHOUSE':
        return 'to-purple-500/5';
      default:
        return 'to-gray-500/5';
    }
  }

  getDepotHoverText(depot: Depot): string {
    switch (depot.type) {
      case 'MAIN':
        return 'group-';
      case 'BRANCH':
        return 'group-';
      case 'SHOP':
        return 'group-';
      case 'WAREHOUSE':
        return 'group-';
      default:
        return 'group-';
    }
  }

  getDepotTypeLabel(depot: Depot): string {
    switch (depot.type) {
      case 'MAIN':
        return 'Dépôt Principal';
      case 'BRANCH':
        return 'Succursale';
      case 'SHOP':
        return 'Magasin';
      case 'WAREHOUSE':
        return 'Entrepôt';
      default:
        return depot.type;
    }
  }

  isStockOnlyUser(): boolean {
    const currentUser = this.authService.currentUser();
    return currentUser?.role === 'STOCK_MANAGER';
  }

  isAdmin(): boolean {
    const currentUser = this.authService.currentUser();
    return currentUser?.role === 'ADMIN';
  }

  routeToAssignedDepot(action: string): void {
    const currentUser = this.authService.currentUser();
    if (!currentUser?.depotId) {
      this.error = 'Aucun dépôt assigné trouvé pour cet utilisateur';
      return;
    }

    const assignedDepot = this.depots.find(depot => depot.id === currentUser.depotId);
    if (!assignedDepot) {
      this.error = 'Dépôt assigné non trouvé dans les dépôts disponibles';
      return;
    }

    if (action === 'documents-reception') {
      this.router.navigate(['/documents-reception', assignedDepot.id]);
      return;
    }

    if (action === 'entry') {
      this.router.navigate(['/stock/documents/bon-entree', assignedDepot.id]);
      return;
    }

    if (action === 'bon-retour') {
      this.router.navigate(['/stock/documents/bon-retour', assignedDepot.id]);
      return;
    }

    if (action === 'inventory') {
      this.router.navigate(['/inventory', assignedDepot.id]);
      return;
    }

    if (action === 'stock-history') {
      this.router.navigate(['/stock/stock-history', assignedDepot.id]);
      return;
    }

    this.selectDepotForAction(assignedDepot);
  }

  goToDocumentsReception(): void {
    this.router.navigate(['/documents-reception']);
  }

  refreshPendingCount(): void {
    this.loadPendingDocumentsCount();
  }

  formatDate(date: string | Date): string {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleDateString('fr-FR');
  }

  getStatusLabel(status: string): string {
    const statusLabels: { [key: string]: string } = {
      'PREPARED': 'Préparé',
      'SENT': 'Envoyé',
      'RECEIVED': 'Reçu',
      'CANCELLED': 'Annulé',
      'COMPLETED': 'Terminé'
    };
    return statusLabels[status] || status;
  }

  getDocumentTotal(document: StockDocument): number {
    if (!document.items || document.items.length === 0) {
      return 0;
    }
    return document.items.reduce((sum, item) => {
      return sum + Math.abs(item.quantity * (item.purchasePrice || 0));
    }, 0);
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/auth/login']);
  }

  openDepotManagement(): void {
    this.showDepotManagementModal = true;
  }

  closeDepotManagementModal(): void {
    this.showDepotManagementModal = false;
  }

  viewProductLinks(): void {
    this.closeDepotManagementModal();
    this.router.navigate(['/stock/product-links']);
  }

  showMessage(title: string, message: string, type: 'error' | 'success' | 'warning' | 'info' = 'info'): void {
    this.messageDialogTitle = title;
    this.messageDialogMessage = message;
    this.messageDialogType = type;
    this.showMessageDialog = true;
  }

  closeMessageDialog(): void {
    this.showMessageDialog = false;
  }

  saveProductLinks(): void {
    if (!this.sourceDepotId || !this.destinationDepotId || !this.droppedDestinationProduct || this.droppedSourceProducts.length === 0) {
      return;
    }

    let sourceDepot = this.depots.find(d => d.id === this.sourceDepotId);
    let destinationDepot = this.depots.find(d => d.id === this.destinationDepotId);

    const loadDepots = () => {
      const promises: Promise<Depot>[] = [];

      if (!sourceDepot) {
        promises.push(
          new Promise<Depot>((resolve, reject) => {
            this.depotsService.get(this.sourceDepotId!).subscribe({
              next: (depot) => {
                sourceDepot = depot;
                resolve(depot);
              },
              error: reject
            });
          })
        );
      }

      if (!destinationDepot) {
        promises.push(
          new Promise<Depot>((resolve, reject) => {
            this.depotsService.get(this.destinationDepotId!).subscribe({
              next: (depot) => {
                destinationDepot = depot;
                resolve(depot);
              },
              error: reject
            });
          })
        );
      }

      if (promises.length === 0) {
        this.continueSaveProductLinks(sourceDepot!, destinationDepot!);
        return;
      }

      Promise.all(promises)
        .then(() => {
          this.continueSaveProductLinks(sourceDepot!, destinationDepot!);
        })
        .catch(() => {
          this.showMessage('Erreur', 'Impossible de trouver les informations des dépôts', 'error');
          this.savingLinks = false;
        });
    };

    loadDepots();
  }

  private continueSaveProductLinks(sourceDepot: Depot, destinationDepot: Depot | null): void {
    if (!sourceDepot || !destinationDepot) {
      this.showMessage('Erreur', 'Impossible de trouver les informations des dépôts', 'error');
      this.savingLinks = false;
      return;
    }

    const invalidSourceProducts = this.droppedSourceProducts.filter(p => {
      if (!p || !p.id || isNaN(parseInt(String(p.id)))) {
        return true;
      }
      return !this.canProductBeLinked(p, this.sourceDepotId!, sourceDepot.type);
    });

    if (invalidSourceProducts.length > 0) {
      const productNames = invalidSourceProducts.map(p => p.name || 'Produit inconnu').join(', ');
      this.showMessage('Erreur', `Les produits suivants ne peuvent pas être liés: ${productNames}`, 'error');
      this.droppedSourceProducts = this.droppedSourceProducts.filter(p => !invalidSourceProducts.includes(p));
      this.savingLinks = false;
      return;
    }

    if (!this.droppedDestinationProduct.id || isNaN(parseInt(String(this.droppedDestinationProduct.id)))) {
      this.showMessage('Erreur', 'Le produit destination a un ID invalide', 'error');
      this.savingLinks = false;
      return;
    }

    if (!this.canProductBeLinked(this.droppedDestinationProduct, this.destinationDepotId!, destinationDepot.type)) {
      this.showMessage('Erreur', 'Le produit destination ne peut pas être lié', 'error');
      this.savingLinks = false;
      return;
    }

    if (this.isBothDepotsNonShop() && this.droppedSourceProducts.length > 1) {
      this.droppedSourceProducts = [this.droppedSourceProducts[0]];
    }

    this.savingLinks = true;

    const linkPromises = this.droppedSourceProducts.map((sourceProduct) => {
      const sourceProductId = parseInt(String(sourceProduct.id));
      const destinationProductId = parseInt(String(this.droppedDestinationProduct.id));

      const linkData = {
        sourceProductId: sourceProductId,
        sourceDepotId: parseInt(String(this.sourceDepotId!)),
        destinationProductId: destinationProductId,
        destinationDepotId: parseInt(String(this.destinationDepotId!))
      };

      return this.productsService.createProductDepotLink(linkData).toPromise();
    });

    Promise.allSettled(linkPromises)
      .then((results) => {
        const successful = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected').length;

        const errors: string[] = [];
        results.forEach((result, index) => {
          if (result.status === 'rejected') {
            const error = result.reason;
            const productName = this.droppedSourceProducts[index]?.name || 'Unknown';
            const errorMsg = error.error?.error || error.message || 'Erreur inconnue';
            errors.push(`${productName}: ${errorMsg}`);
          }
        });

        this.savingLinks = false;

        if (failed > 0) {
          const errorMessage = errors.length > 0
            ? `Erreurs lors de l'enregistrement:\n${errors.join('\n')}`
            : `${failed} lien(s) n'ont pas pu être créés`;

          if (successful > 0) {
            this.showMessage(
              'Enregistrement partiel',
              `${successful} lien(s) créé(s) avec succès.\n\n${errorMessage}`,
              'warning'
            );
          } else {
            this.showMessage('Erreur', errorMessage, 'error');
            return;
          }
        } else if (successful > 0) {
          this.showMessage('Succès', `${successful} lien(s) créé(s) avec succès`, 'success');
        }

        if (failed === 0) {
          this.closeDepotProductsModal();
          setTimeout(() => {
            this.router.navigate(['/stock/product-links']);
          }, 1500);
        }
      });
  }
} 