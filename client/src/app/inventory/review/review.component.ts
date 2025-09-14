import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { InventoryService, InventorySession, InventorySummary } from '../../core/services/inventory.service';

@Component({
  selector: 'app-review',
  templateUrl: './review.component.html',
  standalone: false
})
export class ReviewComponent implements OnInit {
  depotId: number | null = null;
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
          this.router.navigate(['/inventory', this.depotId, this.session!.id, 'summary']);
        }, 2000);
      },
      error: (err) => {
        this.error = err.error?.error || 'Erreur lors du posting';
        this.posting = false;
      }
    });
  }

  goBack(): void {
    this.router.navigate(['/inventory', this.depotId]);
  }

  goToSummary(): void {
    if (this.session) {
      this.router.navigate(['/inventory', this.depotId, this.session.id, 'summary']);
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
      currency: 'TND'
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

  // New methods for the revamped UI
  getEcartClass(ecart: any): string {
    return (ecart.ecartQuantity || 0) > 0 ? 'positive' : 'negative';
  }

  trackByProductId(index: number, ecart: any): number {
    return ecart.productId;
  }

  editEcart(ecart: any): void {
    // Simple inline editing - you can expand this to a modal if needed
    const reason = prompt('Raison de l\'écart:', ecart.reason || '');
    if (reason !== null) {
      this.updateEcartReason(ecart, reason);
    }
  }

  updateEcartReason(ecart: any, reason?: string): void {
    if (this.session) {
      this.inventoryService.updateItemCount(
        this.session.id, 
        ecart.productId, 
        ecart.countedQuantity, 
        reason || ecart.reason, 
        ecart.notes
      ).subscribe({
        next: () => {
          // Success - reason updated
          if (reason) {
            ecart.reason = reason;
          }
        },
        error: (err: any) => {
          this.error = err.error?.error || 'Erreur lors de la mise à jour de la raison';
        }
      });
    }
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

  private generatePrintContent(): string {
    if (!this.session || !this.summary) return '';

    const currentDate = new Date().toLocaleDateString('fr-FR');
    const sessionDate = this.formatDate(this.session.startedAt);
    
    let content = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Rapport d'Inventaire - ${this.session.numero}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; color: #000; }
          .header { border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; }
          .title { font-size: 24px; font-weight: bold; margin: 0; }
          .session-info { color: #666; margin: 5px 0; }
          .stats { display: flex; gap: 20px; margin: 20px 0; }
          .stat { border: 1px solid #ddd; padding: 10px; text-align: center; min-width: 120px; }
          .stat-number { font-size: 18px; font-weight: bold; }
          .stat-label { font-size: 12px; color: #666; }
          .table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          .table th, .table td { border: 1px solid #000; padding: 8px; text-align: left; }
          .table th { background: #f0f0f0; font-weight: bold; }
          .positive { color: #166534; }
          .negative { color: #dc2626; }
          .no-ecarts { text-align: center; padding: 40px; color: #666; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1 class="title">Rapport d'Inventaire</h1>
          <div class="session-info">Session: #${this.session.numero}</div>
          <div class="session-info">Dépôt: ${this.session.depot?.name}</div>
          <div class="session-info">Date: ${sessionDate}</div>
          <div class="session-info">Généré le: ${currentDate}</div>
        </div>

        <div class="stats">
          <div class="stat">
            <div class="stat-number">${this.summary.statistics.totalItems || 0}</div>
            <div class="stat-label">Articles</div>
          </div>
          <div class="stat">
            <div class="stat-number">${this.summary.statistics.countedItems || 0}</div>
            <div class="stat-label">Comptés</div>
          </div>
          <div class="stat">
            <div class="stat-number">${this.summary.statistics.itemsWithEcart || 0}</div>
            <div class="stat-label">Écarts</div>
          </div>
          <div class="stat">
            <div class="stat-number">${this.formatCurrency(this.summary.statistics.totalEcartValue || 0)}</div>
            <div class="stat-label">Valeur Écart</div>
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
          <h3>Aucun écart détecté</h3>
          <p>Tous les comptages correspondent aux quantités théoriques.</p>
        </div>
      `;
    }

    content += `
      </body>
      </html>
    `;

    return content;
  }
}
