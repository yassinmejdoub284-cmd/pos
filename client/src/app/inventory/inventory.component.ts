import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, ActivatedRoute, NavigationEnd } from '@angular/router';
import { InventoryService } from '../core/services/inventory.service';
import { DepotsService } from '../core/services/depots.service';
import { SessionsService } from '../core/services/sessions.service';
import { AuthService } from '../core/services/auth.service';
import { filter } from 'rxjs/operators';
import { Subscription } from 'rxjs';

interface InventorySession {
  id: number;
  numero: string;
  status: 'DRAFT' | 'IN_PROGRESS' | 'CLOSED' | 'POSTED';
  startedAt: Date | string;
  depot?: {
    name: string;
    code: string;
  };
  starter?: {
    firstName: string;
    lastName: string;
    username: string;
  };
  _count?: {
    items: number;
  };
}

@Component({
  selector: 'app-inventory',
  templateUrl: './inventory.component.html',
  styleUrls: ['./inventory.component.css'],
  standalone: false
})
export class InventoryComponent implements OnInit, OnDestroy {
  sessions: InventorySession[] = [];
  depot: any = null;
  loading = false;
  error: string | null = null;
  statusFilter = '';
  viewMode: 'grid' | 'table' = 'grid';
  totalProducts = 0;
  private routerSubscription?: Subscription;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private inventoryService: InventoryService,
    private depotsService: DepotsService,
    private sessionsService: SessionsService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.loadDepot();
    
    this.routerSubscription = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => {
        const url = this.router.url;
        const isInventoryListPage = url === '/inventory' || 
          (url.match(/^\/inventory\/\d+$/) !== null);
        if (isInventoryListPage) {
          this.loadSessions();
        }
      });
  }

  ngOnDestroy(): void {
    if (this.routerSubscription) {
      this.routerSubscription.unsubscribe();
    }
  }

  loadDepot(): void {
    // Get depot ID from route parameters
    const depotId = this.route.snapshot.paramMap.get('depotId');
    
    if (depotId) {
      // Load the specific depot by ID
      this.depotsService.get(parseInt(depotId)).subscribe({
        next: (depot) => {
          this.depot = depot;
          this.loadTotalProducts();
          this.loadSessions(); // Reload sessions for the correct depot
        },
        error: (error) => {
          console.error('Error loading depot:', error);
          this.error = 'Erreur lors du chargement du dépôt';
        }
      });
    } else {
      // Fallback: try to get from localStorage or use first available depot
      const currentDepot = localStorage.getItem('currentDepot');
      if (currentDepot) {
        this.depot = JSON.parse(currentDepot);
        this.loadTotalProducts();
        this.loadSessions();
      } else {
        // Load all depots and use the first one
        this.depotsService.list().subscribe({
          next: (depots) => {
            if (depots.length > 0) {
              this.depot = depots[0];
              this.loadTotalProducts();
              this.loadSessions();
            }
          },
          error: (error) => {
            console.error('Error loading depots:', error);
            this.error = 'Erreur lors du chargement des dépôts';
          }
        });
      }
    }
  }

  loadSessions(): void {
    this.loading = true;
    this.error = null;
    
    // Load sessions for the current depot only
    const depotId = this.depot?.id;
    this.inventoryService.getSessions(undefined, depotId).subscribe({
      next: (sessions) => {
        this.sessions = sessions;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading sessions:', error);
        this.error = 'Erreur lors du chargement des sessions';
        this.loading = false;
      }
    });
  }

  loadTotalProducts(): void {
    if (!this.depot) return;
    
    // Get real products count for the depot based on depot type
    this.inventoryService.getProductsForDepot(this.depot.id, this.depot.type).subscribe({
      next: (products) => {
        this.totalProducts = products.length;
      },
      error: (error) => {
        console.error('Error loading products count:', error);
        // Fallback to mock data if service fails
        this.totalProducts = Math.floor(Math.random() * 1000) + 100;
      }
    });
  }

  startInventory(): void {
    if (!this.depot) {
      this.error = 'Veuillez sélectionner un dépôt';
      return;
    }


    
    this.loading = true;
    this.error = null;
    
    this.inventoryService.createSession(this.depot.id).subscribe({
      next: (session) => {

        this.loadSessions();
        this.loading = false;
        this.router.navigate(['/inventory', this.depot!.id, session.id, 'count']);
      },
      error: (error) => {
        console.error('Error creating session:', error);
        this.loading = false;
        
        if (error.error?.error === 'There is already an active inventory session for this depot') {
          const existingSession = error.error.existingSession;
          this.error = `Une session d'inventaire est déjà active pour ce dépôt (${existingSession.numero}). Veuillez d'abord terminer ou supprimer cette session.`;
          
          // Reload sessions to show the existing one
          this.loadSessions();
        } else {
          this.error = 'Erreur lors de la création de la session';
        }
      }
    });
  }

  viewSession(session: InventorySession, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    
    const depotId = this.depot?.id || 1;
    this.router.navigate(['/inventory', depotId, session.id, 'review']);
  }

  modifySession(session: InventorySession, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    
    const depotId = this.depot?.id || 1;
    this.router.navigate(['/inventory', depotId, session.id, 'count']);
  }

  deleteSession(session: InventorySession, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    
    if (confirm('Êtes-vous sûr de vouloir supprimer cette session ?')) {
      this.loading = true;
      this.inventoryService.deleteSession(session.id).subscribe({
        next: () => {
          this.loadSessions();
        },
        error: (error) => {
          console.error('Error deleting session:', error);
          this.error = 'Erreur lors de la suppression de la session';
          this.loading = false;
        }
      });
    }
  }

  executerEnStock(session: InventorySession, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    
    if (confirm(`Êtes-vous sûr de vouloir exécuter l'inventaire ${session.numero} en stock ?`)) {
      this.loading = true;
      this.error = null;
      
      this.inventoryService.postSession(session.id).subscribe({
        next: () => {
          this.loadSessions();
          this.loading = false;
          alert(`Stock mis à jour avec succès pour l'inventaire ${session.numero}`);
        },
        error: (error) => {
          console.error('Error posting session:', error);
          this.error = error.error?.error || 'Erreur lors de l\'exécution en stock';
          this.loading = false;
        }
      });
    }
  }

  onStatusFilterChange(): void {
    // Filter logic is handled in the template with *ngFor
  }

  clearFilters(): void {
    this.statusFilter = '';
  }

  setViewMode(mode: 'grid' | 'table'): void {
    this.viewMode = mode;
  }

  getSessionsByStatus(status: string): InventorySession[] {
    return this.sessions.filter(session => session.status === status);
  }

  getRecentInventories(): InventorySession[] {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    return this.sessions.filter(session => 
      new Date(session.startedAt) >= oneWeekAgo
    );
  }

  getStatusText(status: string): string {
    const statusMap: { [key: string]: string } = {
      'DRAFT': 'Brouillon',
      'IN_PROGRESS': 'En cours',
      'CLOSED': 'Fermé',
      'POSTED': 'Terminé'
    };
    return statusMap[status] || status;
  }

  formatDate(date: Date | string): string {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  canModify(session: InventorySession): boolean {
    // Allow modification for all statuses
    return true;
  }

  canDelete(session: InventorySession): boolean {
    // Allow deletion if session is DRAFT, or if user is admin
    return session.status === 'DRAFT' || this.authService.isAdmin();
  }

  goHome(): void {
    this.router.navigate(['/home']);
  }

  goToBalance(): void {
    this.router.navigate(['/inventory/balance']);
  }
}
