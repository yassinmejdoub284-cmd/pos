import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { InventoryService, InventorySession, InventoryItem, InventorySummary } from '../../core/services/inventory.service';
import { DepotsService } from '../../core/services/depots.service';

@Component({
  selector: 'app-review',
  templateUrl: './review.component.html',
  styleUrls: ['./review.component.css'],
  standalone: false
})
export class ReviewComponent implements OnInit {
  session: InventorySession | null = null;
  summary: InventorySummary | null = null;
  filteredItems: InventoryItem[] = [];
  loading = false;
  error: string | null = null;
  ecartFilter = 'with-ecart';
  viewMode: 'grid' | 'table' = 'grid';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private inventoryService: InventoryService
  ) {}

  ngOnInit(): void {
    this.loadSessionData();
  }

  loadSessionData(): void {
    this.loading = true;
    this.error = null;

    const sessionId = this.route.snapshot.paramMap.get('id');
    if (!sessionId) {
      this.error = 'ID de session manquant';
      this.loading = false;
      return;
    }

    // Load real session data
    this.inventoryService.getSession(parseInt(sessionId)).subscribe({
      next: (session) => {
        this.session = session;
        // Convert session items to InventoryItem format for display
        const allItems = this.convertSessionItemsToInventoryItems(session);
        // Apply default filter to show only items with ecart != 0
        this.filteredItems = allItems.filter(item => item.ecartQuantity !== 0);
        // Also load summary for statistics
        this.loadSessionSummary(parseInt(sessionId));
      },
      error: (error) => {
        console.error('Error loading session:', error);
        if (error.status === 404) {
          this.error = 'Session d\'inventaire introuvable. Vérifiez que l\'ID de session est correct.';
          // Try to find available sessions for this depot
          this.findAvailableSessions();
        } else {
          this.error = 'Erreur lors du chargement de la session';
        }
        this.loading = false;
      }
    });
  }

  loadSessionSummary(sessionId: number): void {
    this.inventoryService.getSessionSummary(sessionId).subscribe({
      next: (summary) => {
        this.summary = summary;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading session summary:', error);
        this.error = 'Erreur lors du chargement du résumé de session';
        this.loading = false;
      }
    });
  }

  findAvailableSessions(): void {
    const depotId = this.route.snapshot.paramMap.get('depotId');
    if (depotId) {
      this.inventoryService.getSessions(undefined, parseInt(depotId)).subscribe({
        next: (sessions) => {
          if (sessions.length > 0) {
            // Redirect to the first available session
            const firstSession = sessions[0];
            this.router.navigate(['/inventory', depotId, firstSession.id, 'review']);
          }
        },
        error: (error) => {
          console.error('Error finding available sessions:', error);
        }
      });
    }
  }

  convertSessionItemsToInventoryItems(session: any): InventoryItem[] {
    // Convert session items to InventoryItem format for display
    if (!session.items || session.items.length === 0) {
      return [];
    }
    
    return session.items.map((item: any) => ({
      id: item.id,
      sessionId: item.sessionId,
      productId: item.productId,
      theoreticalQuantity: parseFloat(item.theoreticalQuantity || 0),
      countedQuantity: parseFloat(item.countedQuantity || 0),
      ecartQuantity: parseFloat(item.ecartQuantity || 0),
      ecartValue: parseFloat(item.ecartValue || 0),
      reason: item.reason,
      notes: item.notes,
      createdAt: new Date(item.createdAt),
      updatedAt: new Date(item.updatedAt),
      product: {
        id: item.product?.id || item.productId,
        name: item.product?.name || 'Produit inconnu',
        barcode: item.product?.barcode || '',
        unite: item.product?.unite || 'pcs',
        prix_vente_TTC: parseFloat(item.product?.prix_vente_TTC || 0)
      }
    }));
  }

  convertSummaryToItems(summary: InventorySummary): InventoryItem[] {
    // Convert the summary ecarts to InventoryItem format for display
    // If no ecarts, return empty array (all items are conform)
    if (!summary.ecarts || summary.ecarts.length === 0) {
      return [];
    }
    
    return summary.ecarts.map(ecart => ({
      id: ecart.productId, // Use productId as temporary id
      sessionId: summary.session.id,
      productId: ecart.productId,
      theoreticalQuantity: ecart.theoreticalQuantity,
      countedQuantity: ecart.countedQuantity || 0,
      ecartQuantity: ecart.ecartQuantity || 0,
      ecartValue: ecart.ecartValue || 0,
      reason: ecart.reason as any,
      notes: ecart.notes,
      createdAt: new Date(),
      updatedAt: new Date(),
      product: {
        id: ecart.productId,
        name: ecart.productName,
        barcode: '',
        unite: 'pcs',
        prix_vente_TTC: ecart.ecartValue ? Math.abs(ecart.ecartValue / (ecart.ecartQuantity || 1)) : 0
      }
    }));
  }

  onFilterChange(): void {
    if (!this.session) return;

    const allItems = this.convertSessionItemsToInventoryItems(this.session);

    switch (this.ecartFilter) {
      case 'with-ecart':
        this.filteredItems = allItems.filter(item => item.ecartQuantity !== 0);
        break;
      case 'no-ecart':
        this.filteredItems = allItems.filter(item => item.ecartQuantity === 0);
        break;
      case 'positive':
        this.filteredItems = allItems.filter(item => (item.ecartQuantity || 0) > 0);
        break;
      case 'negative':
        this.filteredItems = allItems.filter(item => (item.ecartQuantity || 0) < 0);
        break;
      default:
        this.filteredItems = allItems;
    }
  }

  clearFilters(): void {
    this.ecartFilter = 'with-ecart';
    this.onFilterChange();
  }

  setViewMode(mode: 'grid' | 'table'): void {
    this.viewMode = mode;
  }

  getEcartClass(item: InventoryItem): string {
    const ecart = item.ecartQuantity || 0;
    if (ecart > 0) return 'positive';
    if (ecart < 0) return 'negative';
    return 'neutral';
  }

  getEcartText(item: InventoryItem): string {
    const ecart = item.ecartQuantity || 0;
    if (ecart > 0) return 'Surplus';
    if (ecart < 0) return 'Manquant';
    return 'Conforme';
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

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'TND',
      minimumFractionDigits: 2
    }).format(amount);
  }

  getTotalStockValue(): number {
    if (!this.session || !this.session.items) {
      return 0;
    }

    return this.session.items.reduce((total, item) => {
      // Use counted quantity after inventory (if undefined/null, treat as 0)
      const counted = typeof item.countedQuantity === 'string' ? parseFloat(item.countedQuantity) : (item.countedQuantity || 0);
      const unitPrice = typeof item.product?.prix_vente_TTC === 'string' ? parseFloat(item.product.prix_vente_TTC) : (item.product?.prix_vente_TTC || 0);
      return total + (counted * unitPrice);
    }, 0);
  }

  editItem(item: InventoryItem): void {
    // Navigate to edit mode or open modal

    // TODO: Implement edit functionality
  }

  printReport(): void {
    window.print();
  }

  goBack(): void {
    this.router.navigate(['/inventory']);
  }
}
