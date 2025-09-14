import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { InventoryService, InventorySession, InventorySummary } from '../../core/services/inventory.service';

@Component({
  selector: 'app-summary',
  templateUrl: './summary.component.html',
  standalone: false
})
export class SummaryComponent implements OnInit {
  depotId: number | null = null;
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
    const depotId = this.route.snapshot.paramMap.get('depotId');
    const sessionId = this.route.snapshot.paramMap.get('id');
    if (depotId && sessionId) {
      this.depotId = parseInt(depotId, 10);
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
    this.router.navigate(['/inventory', this.depotId]);
  }

  goHome(): void {
    this.router.navigate(['/home']);
  }

  printReport(): void {
    // Create a print-friendly version
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      const printContent = this.generatePrintContent();
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.print();
      printWindow.close();
    }
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

  formatDate(date: Date | string | null | undefined): string {
    if (!date) return '';
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
      currency: 'TND'
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
    if (!this.summary) return 'text-slate-600';
    const value = this.summary.statistics.totalEcartValue || 0;
    if (value > 0) return 'text-emerald-600';
    if (value < 0) return 'text-red-600';
    return 'text-slate-600';
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
    const value = ecart.ecartValue || 0;
    if (value > 0) return 'bg-emerald-100 text-emerald-800';
    if (value < 0) return 'bg-red-100 text-red-800';
    return 'bg-slate-100 text-slate-800';
  }

  getValueIconClass(): string {
    const value = this.summary?.statistics?.totalEcartValue || 0;
    if (value > 0) return 'bg-emerald-100';
    if (value < 0) return 'bg-red-100';
    return 'bg-slate-100';
  }

  getValueIconColor(): string {
    const value = this.summary?.statistics?.totalEcartValue || 0;
    if (value > 0) return 'text-emerald-600';
    if (value < 0) return 'text-red-600';
    return 'text-slate-600';
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

  // New methods for the revamped UI
  trackByProductId(index: number, ecart: any): number {
    return ecart.productId;
  }

  private generatePrintContent(): string {
    if (!this.session || !this.summary) return '';

    const currentDate = new Date().toLocaleDateString('fr-FR');
    const sessionDate = this.formatDate(this.session.startedAt);
    
    let content = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Résumé d'Inventaire - ${this.session.numero}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; color: #000; }
          .header { border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; }
          .title { font-size: 24px; font-weight: bold; margin: 0; }
          .session-info { color: #666; margin: 5px 0; }
          .metrics { display: flex; gap: 20px; margin: 20px 0; }
          .metric { border: 1px solid #ddd; padding: 10px; text-align: center; min-width: 120px; }
          .metric-number { font-size: 18px; font-weight: bold; }
          .metric-label { font-size: 12px; color: #666; }
          .table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          .table th, .table td { border: 1px solid #000; padding: 8px; text-align: left; }
          .table th { background: #f0f0f0; font-weight: bold; }
          .positive { color: #166534; }
          .negative { color: #dc2626; }
          .no-ecarts { text-align: center; padding: 40px; color: #666; }
          .footer { border-top: 2px solid #000; margin-top: 30px; padding-top: 20px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1 class="title">Résumé d'Inventaire</h1>
          <div class="session-info">Session: #${this.session.numero}</div>
          <div class="session-info">Dépôt: ${this.session.depot?.name}</div>
          <div class="session-info">Date: ${sessionDate}</div>
          <div class="session-info">Statut: ${this.getStatusText(this.session.status)}</div>
          <div class="session-info">Généré le: ${currentDate}</div>
        </div>

        <div class="metrics">
          <div class="metric">
            <div class="metric-number">${this.summary.statistics.totalItems || 0}</div>
            <div class="metric-label">Articles</div>
          </div>
          <div class="metric">
            <div class="metric-number">${this.summary.statistics.countedItems || 0}</div>
            <div class="metric-label">Comptés</div>
          </div>
          <div class="metric">
            <div class="metric-number">${this.summary.statistics.itemsWithEcart || 0}</div>
            <div class="metric-label">Écarts</div>
          </div>
          <div class="metric">
            <div class="metric-number">${this.formatCurrency(this.summary.statistics.totalEcartValue || 0)}</div>
            <div class="metric-label">Valeur Écart</div>
          </div>
        </div>
    `;

    if (this.summary.ecarts.length > 0) {
      content += `
        <h2>Détail des Écarts</h2>
        <table class="table">
          <thead>
            <tr>
              <th>Produit</th>
              <th>Théorique</th>
              <th>Compté</th>
              <th>Écart</th>
              <th>Valeur Écart</th>
              <th>Raison</th>
            </tr>
          </thead>
          <tbody>
      `;

      this.summary.ecarts.forEach(ecart => {
        const ecartClass = (ecart.ecartQuantity || 0) > 0 ? 'positive' : 'negative';
        const ecartSign = (ecart.ecartQuantity || 0) > 0 ? '+' : '';
        const valueSign = (ecart.ecartValue || 0) > 0 ? '+' : '';
        
        content += `
          <tr>
            <td>${ecart.productName}</td>
            <td>${ecart.theoreticalQuantity}</td>
            <td>${ecart.countedQuantity}</td>
            <td class="${ecartClass}">${ecartSign}${ecart.ecartQuantity}</td>
            <td class="${ecartClass}">${valueSign}${this.formatCurrency(ecart.ecartValue || 0)}</td>
            <td>${this.getReasonText(ecart.reason || '')}</td>
          </tr>
        `;
      });

      content += `
          </tbody>
        </table>
      `;
    } else {
      content += `
        <div class="no-ecarts">
          <h3>Parfait ! Aucun écart détecté</h3>
          <p>Tous les comptages correspondent aux quantités théoriques.</p>
        </div>
      `;
    }

    // Add session details
    content += `
      <div class="footer">
        <h3>Informations de Session</h3>
        <p><strong>Démarré par:</strong> ${this.session.starter?.firstName} ${this.session.starter?.lastName}</p>
        ${this.session.closer ? `<p><strong>Fermé par:</strong> ${this.session.closer.firstName} ${this.session.closer.lastName}</p>` : ''}
        ${this.session.poster ? `<p><strong>Posté par:</strong> ${this.session.poster.firstName} ${this.session.poster.lastName}</p>` : ''}
        ${this.session.closedAt ? `<p><strong>Fermé le:</strong> ${this.formatDate(this.session.closedAt)}</p>` : ''}
        ${this.session.postedAt ? `<p><strong>Posté le:</strong> ${this.formatDate(this.session.postedAt)}</p>` : ''}
      </div>
    `;

    content += `
      </body>
      </html>
    `;

    return content;
  }
}
