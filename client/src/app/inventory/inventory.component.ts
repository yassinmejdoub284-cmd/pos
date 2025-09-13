import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
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
  depots: Depot[] = [];
  selectedDepot: Depot | null = null;
  loading = false;
  error = '';
  statusFilter = '';

  constructor(
    private inventoryService: InventoryService,
    private depotsService: DepotsService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadDepots();
    this.loadSessions();
  }

  loadDepots(): void {
    this.depotsService.list().subscribe({
      next: (depots) => {
        this.depots = depots.filter(d => d.isActive);
        // Auto-select user's depot if available
        const userDepot = this.depots.find(d => d.id === 1); // Assuming user depot ID is 1
        if (userDepot) {
          this.selectedDepot = userDepot;
        }
      },
      error: (err) => {
        console.error('Error loading depots:', err);
      }
    });
  }

  loadSessions(): void {
    this.loading = true;
    this.error = '';

    const depotId = this.selectedDepot?.id;
    this.inventoryService.getSessions(this.statusFilter, depotId).subscribe({
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

  onDepotChange(): void {
    this.loadSessions();
  }

  onStatusFilterChange(): void {
    this.loadSessions();
  }

  createNewSession(): void {
    if (!this.selectedDepot) {
      this.error = 'Veuillez sélectionner un dépôt';
      return;
    }

    this.loading = true;
    this.inventoryService.createSession(this.selectedDepot.id).subscribe({
      next: (session) => {
        this.loading = false;
        this.router.navigate(['/inventory', session.id, 'count']);
      },
      error: (err) => {
        this.error = err.error?.error || 'Erreur lors de la création de la session';
        this.loading = false;
      }
    });
  }

  viewSession(session: InventorySession): void {
    if (session.status === 'DRAFT' || session.status === 'IN_PROGRESS') {
      this.router.navigate(['/inventory', session.id, 'count']);
    } else if (session.status === 'CLOSED') {
      this.router.navigate(['/inventory', session.id, 'review']);
    } else {
      this.router.navigate(['/inventory', session.id, 'summary']);
    }
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

  compareDepots(a: any, b: any): boolean {
    return a?.id === b?.id;
  }

  getSessionsByStatus(status: string): InventorySession[] {
    return this.sessions.filter(session => session.status === status);
  }

  clearFilters(): void {
    this.selectedDepot = null;
    this.statusFilter = '';
    this.loadSessions();
  }
}
