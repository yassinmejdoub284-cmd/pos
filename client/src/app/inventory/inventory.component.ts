import { Component, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { InventoryService, InventorySession } from '../core/services/inventory.service';
import { DepotsService } from '../core/services/depots.service';
import { Depot } from '../core/models/depot.model';

@Component({
  selector: 'app-inventory',
  templateUrl: './inventory.component.html',
  standalone: false
})
export class InventoryComponent implements OnInit {
  sessions: InventorySession[] = [];
  depot: Depot | null = null;
  depotId: number | null = null;
  loading = false;
  error = '';
  statusFilter = '';
  totalProducts = 0;

  constructor(
    private inventoryService: InventoryService,
    private depotsService: DepotsService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      this.depotId = +params['depotId'];
      if (this.depotId) {
        this.loadDepot();
        this.loadSessions();
        this.loadTotalProducts();
      }
    });
  }

  loadDepot(): void {
    if (!this.depotId) return;
    
    this.depotsService.get(this.depotId).subscribe({
      next: (depot: Depot) => {
        this.depot = depot;
      },
      error: (err: any) => {
        console.error('Error loading depot:', err);
        this.error = 'Erreur lors du chargement du dépôt';
      }
    });
  }

  loadSessions(): void {
    if (!this.depotId) return;
    
    this.loading = true;
    this.error = '';

    this.inventoryService.getSessions(this.statusFilter, this.depotId).subscribe({
      next: (sessions) => {
        this.sessions = sessions;
        this.loading = false;
      },
      error: (err) => {
        this.error = err.error?.error || 'Erreur lors du chargement des sessions';
        this.loading = false;
      }
    });
  }


  onStatusFilterChange(): void {
    this.loadSessions();
  }

  clearFilters(): void {
    this.statusFilter = '';
    this.loadSessions();
  }

  startInventory(): void {
    if (!this.depotId) {
      this.error = 'Dépôt non trouvé';
      return;
    }

    this.loading = true;
    this.inventoryService.createSession(this.depotId).subscribe({
      next: (session) => {
        this.loading = false;
        this.router.navigate(['/inventory', this.depotId, session.id, 'count']);
      },
      error: (err) => {
        this.error = err.error?.error || 'Erreur lors du démarrage de l\'inventaire';
        this.loading = false;
      }
    });
  }

  viewSession(session: InventorySession): void {
    if (session.status === 'DRAFT' || session.status === 'IN_PROGRESS') {
      this.router.navigate(['/inventory', this.depotId, session.id, 'count']);
    } else if (session.status === 'CLOSED') {
      this.router.navigate(['/inventory', this.depotId, session.id, 'review']);
    } else {
      this.router.navigate(['/inventory', this.depotId, session.id, 'summary']);
    }
  }

  goHome(): void {
    this.router.navigate(['/home']);
  }

  getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'DRAFT': return 'badge-secondary';
      case 'IN_PROGRESS': return 'badge-warning';
      case 'CLOSED': return 'badge-info';
      case 'POSTED': return 'badge-success';
      default: return 'badge-light';
    }
  }

  getStatusText(status: string): string {
    switch (status) {
      case 'DRAFT': return 'Brouillon';
      case 'IN_PROGRESS': return 'En cours';
      case 'CLOSED': return 'Fermé';
      case 'POSTED': return 'Posté';
      default: return status;
    }
  }

  canDelete(session: InventorySession): boolean {
    return session.status === 'DRAFT';
  }

  deleteSession(session: InventorySession): void {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette session d\'inventaire ?')) {
      return;
    }

    this.loading = true;
    this.inventoryService.deleteSession(session.id).subscribe({
      next: () => {
        this.loading = false;
        this.loadSessions();
      },
      error: (err) => {
        this.error = err.error?.error || 'Erreur lors de la suppression';
        this.loading = false;
      }
    });
  }

  formatDate(date: Date | string): string {
    return new Date(date).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }


  getSessionsByStatus(status: string): InventorySession[] {
    return this.sessions.filter(session => session.status === status);
  }

  loadTotalProducts(): void {
    if (this.depotId) {
      this.inventoryService.getInventoryCount(this.depotId).subscribe({
        next: (count) => {
          this.totalProducts = count;
        },
        error: (err) => {
          console.error('Error loading total products:', err);
          this.totalProducts = 0;
        }
      });
    }
  }

  getRecentInventories(): InventorySession[] {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    return this.sessions.filter(session => 
      session.createdAt && new Date(session.createdAt) >= oneWeekAgo
    );
  }
}
