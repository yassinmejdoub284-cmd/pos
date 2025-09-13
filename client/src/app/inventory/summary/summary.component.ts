import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { InventoryService, InventorySession, InventorySummary } from '../../core/services/inventory.service';

@Component({
  selector: 'app-summary',
  templateUrl: './summary.component.html',
  standalone: false
})
export class SummaryComponent implements OnInit {
  session: InventorySession | null = null;
  summary: InventorySummary | null = null;
  loading = false;
  error = '';

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

  goBack(): void {
    this.router.navigate(['/inventory']);
  }

  printReport(): void {
    window.print();
  }

  exportToPDF(): void {
    // TODO: Implement PDF export
    alert('Export PDF à implémenter');
  }

  exportToExcel(): void {
    // TODO: Implement Excel export
    alert('Export Excel à implémenter');
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

  getCurrentDate(): string {
    return this.formatDate(new Date());
  }

  // New methods for the redesigned UI
  getCountedPercentage(): number {
    if (!this.summary || this.summary.statistics.totalItems === 0) return 0;
    return Math.round((this.summary.statistics.countedItems / this.summary.statistics.totalItems) * 100);
  }

  getEcartPercentage(): number {
    if (!this.summary || this.summary.statistics.countedItems === 0) return 0;
    return Math.round((this.summary.statistics.itemsWithEcart / this.summary.statistics.countedItems) * 100);
  }

  getValueClass(): string {
    if (!this.summary) return '';
    return (this.summary.statistics.totalEcartValue || 0) > 0 ? 'positive' : 'negative';
  }

  getQuantityClass(): string {
    if (!this.summary) return '';
    return (this.summary.statistics.totalEcartQty || 0) > 0 ? 'positive' : 'negative';
  }

  getEcartRowClass(ecart: any): string {
    return (ecart.ecartQuantity || 0) > 0 ? 'positive' : 'negative';
  }

  getEcartBadgeClass(ecart: any): string {
    return (ecart.ecartQuantity || 0) > 0 ? 'positive' : 'negative';
  }

  getEcartValueClass(ecart: any): string {
    return (ecart.ecartValue || 0) > 0 ? 'positive' : 'negative';
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
}
