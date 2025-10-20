import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { DepotsService } from '../core/services/depots.service';
import { Depot } from '../core/models/depot.model';
import { StockDocumentsService } from '../core/services/stock-documents.service';
import { AuthService } from '../core/services/auth.service';
import { StockDocumentActionDialogComponent } from '../shared/stock-document-action-dialog/stock-document-action-dialog.component';
import { SessionsService } from '../core/services/sessions.service';
import { SettingsService, AppSettings } from '../core/services/settings.service';

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

  // Modal properties
  showActionDepotModal = false;
  selectedAction: string | null = null;
  documentsSelectedType: string = '';
  // Transport modal removed
  showDocumentsDialog = false;
  showFleetManagementDialog = false;
  showAchatDialog = false;

  // Action cards shown in UI (populated only after access filtering)
  actionCards: Array<{ id: string; title: string; description: string; icon: string; color: string; }> = [];

  // Settings cache
  private appSettings: AppSettings | null = null;

  // Scan UI state (moved to dedicated page)

  constructor(
    private depotsService: DepotsService,
    public router: Router,
    private stockDocs: StockDocumentsService,
    private authService: AuthService,
    private sessionsService: SessionsService,
    private settingsService: SettingsService
  ) {}

  ngOnInit(): void {
    this.loadDepots();
    this.loadPendingDocumentsCount();
    // Load role access settings and filter visible action cards
    this.settingsService.getSettings().subscribe({
      next: (s) => {
        this.appSettings = s;
        this.filterActionCardsByAccess();
      },
      error: () => {}
    });
    // React to session depot changes
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
    // Define all possible cards locally; only permitted ones will be emitted to the UI
    const allCards: Array<{ id: string; title: string; description: string; icon: string; color: string; }> = [
      { id: 'achat', title: 'Achat', description: 'Créer un bon d\'entrée ou un bon de retour', icon: 'M12 4v16m8-8H4', color: 'from-emerald-500 to-green-600' },
      { id: 'documents-reception', title: 'Centre de Réception', description: 'Réceptionner les documents de stock', icon: 'M9 12l2 2 4-4m2-4h-3.18A2 2 0 0012 2a2 2 0 00-1.82 2H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V6a2 2 0 00-2-2z', color: 'from-teal-500 to-cyan-600' },
      { id: 'documents', title: 'Historique des documents', description: 'Consulter les documents de stock', icon: 'M6 2h8l4 4v14a2 2 0 01-2 2H6a2 2 0 01-2-2V4a2 2 0 012-2zm7 0v4h4M12 9a5 5 0 105 5 5 5 0 00-5-5zm0 2v3l2 1', color: 'from-blue-600 to-indigo-700' },
      { id: 'fleet-management', title: 'Gestion de parc', description: 'Véhicules et chauffeurs', icon: 'M12 2a10 10 0 110 20 10 10 0 010-20zm0 4a6 6 0 016 6h-3a3 3 0 00-6 0H6a6 6 0 016-6zm0 7a2 2 0 110 4 2 2 0 010-4z', color: 'from-indigo-500 to-purple-600' },
      { id: 'stock', title: 'Gestion de Stock', description: 'Gérer les produits et inventaires', icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4', color: 'from-blue-500 to-indigo-600' },
      { id: 'inventory', title: 'Inventaire', description: 'Faire l\'inventaire du dépôt', icon: 'M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01', color: 'from-purple-500 to-violet-600' },
      { id: 'stock-history', title: 'Historique du stock', description: 'Archives et analyses des transactions de stock', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z', color: 'from-cyan-500 to-blue-600' },
      { id: 'client-gros', title: 'Configuration Gros', description: 'Configurer les règles et tarifs en gros', icon: 'M3 7h18M3 12h18M3 17h18', color: 'from-amber-500 to-orange-600' }
    ];

    const map: Record<string, string> = {
      'achat': 'stock-achat',
      'documents-reception': 'stock-reception',
      'documents': 'stock-historique-docs',
      'fleet-management': 'stock-parc',
      'stock': 'stock-gestion',
      'inventory': 'stock-inventaire',
      'stock-history': 'stock-historique',
      'client-gros': 'stock-gros-config'
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

    // Do not filter by status at API; filter locally for SENT/PREPARED destined to current depot
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
    switch (depot.type) {
      case 'SHOP':
        // For shops, go to shop transfer module
        this.router.navigate(['/stock/shop-transfer', depot.id]);
        break;
      case 'MAIN':
        // For main depot, go to prepare lot module
        this.router.navigate(['/stock/prepare-lot', depot.id]);
        break;
      case 'BRANCH':
        // For branch depot, go to branch inventory module
        this.router.navigate(['/stock/branch-inventory', depot.id]);
        break;
      default:
        // Fallback to generic site module
        this.router.navigate(['/stock/site', depot.id, 'workspace']);
        break;
    }
  }

  // Action depot selection methods
  openActionDepotSelection(action: string): void {
    this.selectedAction = action;
    this.error = ''; // Clear any previous errors
    
    const currentUser = this.authService.currentUser();
    console.log('Opening action:', action, 'for user:', currentUser?.role, 'depotId:', currentUser?.depotId);

    // Actions that do NOT require depot selection
    if (action === 'fleet-management' || action === 'documents' || action === 'achat' || action === 'client-gros') {
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
      this.router.navigate(['/stock/transport']);
      return;
    }
    
    // For non-admin users, auto-route to their assigned depot
    if (!this.isAdmin()) {
      console.log('Non-admin user, auto-routing to assigned depot');
      this.routeToAssignedDepot(action);
      return;
    }
    
    // For admin users, show depot selection dialog
    console.log('Admin user, showing depot selection dialog');
    this.showActionDepotModal = true;
  }

  // Transport modal removed; use direct navigation cards

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
      // Ask admin which depot to use
      this.documentsSelectedType = type;
      this.selectedAction = 'documents-list-select';
      this.showActionDepotModal = true;
      return;
    }
    // Non-admin: use assigned depot automatically
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
    this.selectedAction = actionId;
    if (this.isAdmin()) {
      // Ask admin which depot to use for the selected sub-action
      this.showActionDepotModal = true;
      return;
    }
    // Non-admin: route using assigned depot
    this.routeToAssignedDepot(actionId);
  }

  closeAchatDialog(): void {
    this.showAchatDialog = false;
  }

  // Removed goToVehicles/goToDrivers; handled by routerLink in template

  closeActionDepotModal(): void {
    this.showActionDepotModal = false;
    this.selectedAction = null;
  }

  getAvailableDepots(): Depot[] {
    if (this.selectedAction === 'stock-history' || this.selectedAction === 'fleet-management') {
      // Exclude SHOP type depots for stock-history and fleet-management actions
      return this.depots.filter(depot => depot.type !== 'SHOP');
    }
    return this.depots;
  }

  selectDepotForAction(depot: Depot): void {
    if (!this.selectedAction) return;

    // Store the action before closing the modal
    const action = this.selectedAction;
    this.closeActionDepotModal();

    switch (action) {
      case 'stock':
        this.openWorkspace(depot);
        break;
      case 'entry':
        this.router.navigate(['/stock/documents/bon-entree', depot.id]);
        break;
      case 'bon-retour':
        // Navigate to dedicated returns list route
        this.router.navigate(['/stock/documents/bon-retour', depot.id]);
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



  // Depot type styling methods
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
      console.error('No assigned depot found for user');
      this.error = 'Aucun dépôt assigné trouvé pour cet utilisateur';
      return;
    }

    // Find the assigned depot
    const assignedDepot = this.depots.find(depot => depot.id === currentUser.depotId);
    if (!assignedDepot) {
      console.error('Assigned depot not found in available depots');
      this.error = 'Dépôt assigné non trouvé dans les dépôts disponibles';
      return;
    }

    console.log('Auto-routing to assigned depot:', assignedDepot.name, 'for action:', action);
    
    // Handle documents-reception action directly for non-admin users
    if (action === 'documents-reception') {
      this.router.navigate(['/documents-reception', assignedDepot.id]);
      return;
    }
    
    // Handle entry action directly for non-admin users - use their assigned depot
    if (action === 'entry') {
      this.router.navigate(['/stock/documents/bon-entree', assignedDepot.id]);
      return;
    }
    
    // Handle bon-retour action directly for non-admin users - use their assigned depot
    if (action === 'bon-retour') {
      this.router.navigate(['/stock/documents/bon-retour', assignedDepot.id]);
      return;
    }
    
    // Handle inventory action directly for non-admin users - use their assigned depot
    if (action === 'inventory') {
      this.router.navigate(['/inventory', assignedDepot.id]);
      return;
    }
    
    // Handle stock-history action directly for non-admin users - use their assigned depot
    if (action === 'stock-history') {
      this.router.navigate(['/stock/stock-history', assignedDepot.id]);
      return;
    }
    
    // Route directly to the assigned depot for other actions
    this.selectDepotForAction(assignedDepot);
  }

  goToDocumentsReception(): void {
    this.router.navigate(['/documents-reception']);
  }

  refreshPendingCount(): void {
    this.loadPendingDocumentsCount();
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/auth/login']);
  }
} 