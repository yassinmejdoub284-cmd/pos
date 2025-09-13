import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { InventoryService, InventorySession, InventorySummary } from '../../core/services/inventory.service';

@Component({
  selector: 'app-review',
  templateUrl: './review.component.html',
  standalone: false
})
export class ReviewComponent implements OnInit {
  session: InventorySession | null = null;
  summary: InventorySummary | null = null;
  loading = false;
  posting = false;
  error = '';
  success = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private inventoryService: InventoryService
  ) {}

  ngOnInit(): void {
    const sessionId = this.route.snapshot.paramMap.get('id');
    if (sessionId) {
      this.loadSession(parseInt(sessionId, 10));
    }
  }

  loadSession(sessionId: number): void {
    this.loading = true;
    this.error = '';

    // Load session details and summary in parallel
    Promise.all([
      this.inventoryService.getSession(sessionId).toPromise(),
      this.inventoryService.getSessionSummary(sessionId).toPromise()
    ]).then(([session, summary]) => {
      this.session = session || null;
      this.summary = summary || null;
      this.loading = false;
    }).catch((err) => {
      this.error = err.error?.error || 'Erreur lors du chargement de la session';
      this.loading = false;
    });
  }

  postSession(): void {
    if (!this.session) return;

    if (!confirm('Êtes-vous sûr de vouloir poster cette session d\'inventaire ? Cette action est irréversible et appliquera les ajustements de stock.')) {
      return;
    }

    this.posting = true;
    this.error = '';

    this.inventoryService.postSession(this.session.id).subscribe({
      next: (result) => {
        this.posting = false;
        this.success = `Session postée avec succès ! ${result.adjustmentsApplied} ajustements appliqués.`;
        // Reload the session to get updated status
        this.loadSession(this.session!.id);
        setTimeout(() => {
          this.router.navigate(['/inventory', this.session!.id, 'summary']);
        }, 2000);
      },
      error: (err) => {
        this.error = err.error?.error || 'Erreur lors du posting';
        this.posting = false;
      }
    });
  }

  goBack(): void {
    this.router.navigate(['/inventory']);
  }

  goToSummary(): void {
    if (this.session) {
      this.router.navigate(['/inventory', this.session.id, 'summary']);
    }
  }

  getReasonText(reason: string): string {
    switch (reason) {
      case 'PHYSICAL_COUNT_DIFFERENCE': return 'Différence de comptage physique';
      case 'SUSPICION_OF_ANOMALY': return 'Suspicion d\'anomalie';
      default: return reason;
    }
  }

  getReasonBadgeClass(reason: string): string {
    switch (reason) {
      case 'PHYSICAL_COUNT_DIFFERENCE': return 'bg-warning';
      case 'SUSPICION_OF_ANOMALY': return 'bg-danger';
      default: return 'bg-secondary';
    }
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

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  }

  canPost(): boolean {
    return this.session?.status === 'CLOSED' && (this.summary?.statistics.itemsWithEcart || 0) > 0;
  }

  // New methods for the redesigned UI
  getEcartCardClass(ecart: any): string {
    return (ecart.ecartQuantity || 0) > 0 ? 'positive' : 'negative';
  }

  getEcartBadgeClass(ecart: any): string {
    return (ecart.ecartQuantity || 0) > 0 ? 'positive' : 'negative';
  }

  getEcartBadgeText(ecart: any): string {
    return (ecart.ecartQuantity || 0) > 0 ? 'Surplus' : 'Manquant';
  }

  getEcartValueClass(ecart: any): string {
    return (ecart.ecartQuantity || 0) > 0 ? 'positive' : 'negative';
  }

  updateEcartReason(ecart: any): void {
    // Update the reason for this ecart using updateItemCount
    if (this.session) {
      this.inventoryService.updateItemCount(
        this.session.id, 
        ecart.productId, 
        ecart.countedQuantity, 
        ecart.reason, 
        ecart.notes
      ).subscribe({
        next: () => {
          // Success - reason updated
        },
        error: (err: any) => {
          this.error = err.error?.error || 'Erreur lors de la mise à jour de la raison';
        }
      });
    }
  }

  updateEcartNotes(ecart: any): void {
    // Update the notes for this ecart using updateItemCount
    if (this.session) {
      this.inventoryService.updateItemCount(
        this.session.id, 
        ecart.productId, 
        ecart.countedQuantity, 
        ecart.reason, 
        ecart.notes
      ).subscribe({
        next: () => {
          // Success - notes updated
        },
        error: (err: any) => {
          this.error = err.error?.error || 'Erreur lors de la mise à jour des notes';
        }
      });
    }
  }

  postInventory(): void {
    this.postSession();
  }
}
