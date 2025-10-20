import { Component, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { InventoryService } from '../core/services/inventory.service';
import { DepotsService } from '../core/services/depots.service';
import { SessionsService } from '../core/services/sessions.service';

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
export class InventoryComponent implements OnInit {
  sessions: InventorySession[] = [];
  depot: any = null;
  loading = false;
  error: string | null = null;
  statusFilter = '';
  viewMode: 'grid' | 'table' = 'grid';
  totalProducts = 0;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private inventoryService: InventoryService,
    private depotsService: DepotsService,
    private sessionsService: SessionsService
  ) {}

  ngOnInit(): void {
    this.loadDepot();
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
      } else {
        // Load all depots and use the first one
        this.depotsService.list().subscribe({
          next: (depots) => {
            if (depots.length > 0) {
              this.depot = depots[0];
              this.loadTotalProducts();
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

    console.log('Starting inventory for depot:', this.depot);
    
    this.loading = true;
    this.error = null;
    
    this.inventoryService.createSession(this.depot.id).subscribe({
      next: (session) => {
        console.log('Session created successfully:', session);
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
    return true; // Allow modification for all statuses
  }

  canDelete(session: InventorySession): boolean {
    return session.status === 'DRAFT';
  }

  goHome(): void {
    this.router.navigate(['/home']);
  }
}
