import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { DepotsService } from '../core/services/depots.service';
import { Depot } from '../core/models/depot.model';
import { StockDocumentsService } from '../core/services/stock-documents.service';
import { AuthService } from '../core/services/auth.service';
import { StockDocumentActionDialogComponent } from '../shared/stock-document-action-dialog/stock-document-action-dialog.component';

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
  // Transport modal removed
  showDocumentsDialog = false;

  // Action cards configuration
  actionCards = [
    {
      id: 'entry',
      title: 'Bon d\'entrée',
      description: 'Ajouter des produits depuis un fournisseur',
      icon: 'M12 4v16m8-8H4',
      color: 'from-emerald-500 to-green-600'
    },
    {
      id: 'bon-retour',
      title: 'Bon de retour',
      description: 'Retour de produits au fournisseur',
      icon: 'M19 14l-7 7m0 0l-7-7m7 7V3',
      color: 'from-rose-500 to-red-600'
    },
    {
      id: 'documents',
      title: 'Documents',
      description: 'Consulter les documents de stock',
      icon: 'M8 4h8l4 4v12H8V4zm8 8H10m6 4H10',
      color: 'from-blue-600 to-indigo-700'
    },
    
    {
      id: 'stock',
      title: 'Gestion de Stock',
      description: 'Gérer les produits et inventaires',
      icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
      color: 'from-blue-500 to-indigo-600'
    },
    {
      id: 'inventory',
      title: 'Inventaire',
      description: 'Faire l\'inventaire du dépôt',
      icon: 'M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01',
      color: 'from-purple-500 to-violet-600'
    },
    {
      id: 'stock-history',
      title: 'Historique du stock',
      description: 'Archives et analyses des transactions de stock',
      icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
      color: 'from-cyan-500 to-blue-600'
    }
  ];

  // Scan UI state (moved to dedicated page)

  constructor(
    private depotsService: DepotsService,
    public router: Router,
    private stockDocs: StockDocumentsService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.loadDepots();
    this.loadPendingDocumentsCount();
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
    const currentUser = this.authService.currentUser();
    if (!currentUser?.depotId) return;

    this.stockDocs.getDocuments(1, 50, 'BON_ENTREE_MAGASIN', 'SENT', currentUser.depotId).subscribe({
      next: (response) => {
        const documents = Array.isArray(response) ? response : (response?.data ?? []);
        this.pendingDocumentsCount = documents.filter((d: any) => 
          d.type === 'BON_ENTREE_MAGASIN' && 
          (d.status === 'SENT' || d.status === 'PREPARED') &&
          d.destinataireId === currentUser.depotId
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
    if (action === 'drivers' || action === 'documents') {
      if (action === 'documents') {
        this.showDocumentsDialog = true;
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
    const queryParams: any = {};
    if (type) queryParams.type = type;
    this.router.navigate(['/stock/documents'], { queryParams });
  }

  // Removed goToVehicles/goToDrivers; handled by routerLink in template

  closeActionDepotModal(): void {
    this.showActionDepotModal = false;
    this.selectedAction = null;
  }

  getAvailableDepots(): Depot[] {
    if (this.selectedAction === 'stock-history' || this.selectedAction === 'drivers') {
      // Exclude SHOP type depots for stock-history and drivers actions
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
      case 'inventory':
        this.router.navigate(['/inventory', depot.id]);
        break;
      case 'stock-history':
        this.router.navigate(['/stock/stock-history', depot.id]);
        break;
      case 'drivers':
        this.router.navigate(['/stock/transport']);
        break;
      case 'bon-transfert':
        this.router.navigate(['/stock/documents/bon-transfert', depot.id]);
        break;
      case 'bon-livraison':
        this.router.navigate(['/stock/documents/bon-livraison', depot.id]);
        break;
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
      case 'inventory':
        return 'Inventaire';
      case 'stock-history':
        return 'Historique du stock';
      case 'drivers':
        return 'Gestion des Chauffeurs';
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
      case 'inventory':
        return 'M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01';
      case 'stock-history':
        return 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z';
      case 'drivers':
        return 'M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z';
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
      case 'inventory':
        return 'bg-gradient-to-br from-emerald-500 to-teal-600';
      case 'stock-history':
        return 'bg-gradient-to-br from-cyan-500 to-blue-600';
      case 'drivers':
        return 'bg-gradient-to-br from-blue-500 to-indigo-600';
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
    // Route directly to the assigned depot
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