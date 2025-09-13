import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { InventoryService, InventorySession, InventoryItem } from '../../core/services/inventory.service';
import { ProductsService } from '../../core/services/products.service';
import { Product } from '../../core/models/product.model';

@Component({
  selector: 'app-count',
  templateUrl: './count.component.html',
  standalone: false
})
export class CountComponent implements OnInit {
  session: InventorySession | null = null;
  items: InventoryItem[] = [];
  filteredItems: InventoryItem[] = [];
  searchTerm = '';
  selectedItem: InventoryItem | null = null;
  countedQuantity: number | null = null;
  reason: 'PHYSICAL_COUNT_DIFFERENCE' | 'SUSPICION_OF_ANOMALY' = 'PHYSICAL_COUNT_DIFFERENCE';
  notes = '';
  
  loading = false;
  saving = false;
  error = '';
  success = '';
  
  // Statistics
  totalItems = 0;
  countedItems = 0;
  remainingItems = 0;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private inventoryService: InventoryService,
    private productsService: ProductsService
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

    this.inventoryService.getSession(sessionId).subscribe({
      next: (session) => {
        this.session = session;
        this.items = session.items || [];
        this.filteredItems = [...this.items];
        this.updateStatistics();
        this.loading = false;
      },
      error: (err) => {
        this.error = err.error?.error || 'Erreur lors du chargement de la session';
        this.loading = false;
      }
    });
  }

  updateStatistics(): void {
    this.totalItems = this.items.length;
    this.countedItems = this.items.filter(item => item.countedQuantity !== null).length;
    this.remainingItems = this.totalItems - this.countedItems;
  }

  onSearch(): void {
    if (!this.searchTerm.trim()) {
      this.filteredItems = [...this.items];
      return;
    }

    const term = this.searchTerm.toLowerCase();
    this.filteredItems = this.items.filter(item => 
      item.product?.name.toLowerCase().includes(term) ||
      item.product?.barcode?.toLowerCase().includes(term) ||
      item.product?.famille?.name.toLowerCase().includes(term)
    );
  }

  selectItem(item: InventoryItem): void {
    this.selectedItem = item;
    this.countedQuantity = item.countedQuantity || item.theoreticalQuantity;
    this.reason = item.reason || 'PHYSICAL_COUNT_DIFFERENCE';
    this.notes = item.notes || '';
  }

  clearSelection(): void {
    this.selectedItem = null;
    this.countedQuantity = null;
    this.reason = 'PHYSICAL_COUNT_DIFFERENCE';
    this.notes = '';
  }

  saveCount(): void {
    if (!this.selectedItem || this.countedQuantity === null) {
      this.error = 'Veuillez saisir une quantité';
      return;
    }

    this.saving = true;
    this.error = '';

    this.inventoryService.updateItemCount(
      this.selectedItem.sessionId,
      this.selectedItem.id,
      this.countedQuantity,
      this.reason,
      this.notes
    ).subscribe({
      next: (updatedItem) => {
        // Update the item in our local array
        const index = this.items.findIndex(item => item.id === updatedItem.id);
        if (index !== -1) {
          this.items[index] = updatedItem;
        }
        
        // Update filtered items
        const filteredIndex = this.filteredItems.findIndex(item => item.id === updatedItem.id);
        if (filteredIndex !== -1) {
          this.filteredItems[filteredIndex] = updatedItem;
        }

        this.updateStatistics();
        this.clearSelection();
        this.saving = false;
        this.success = 'Comptage enregistré avec succès';
        setTimeout(() => this.success = '', 3000);
      },
      error: (err) => {
        this.error = err.error?.error || 'Erreur lors de l\'enregistrement';
        this.saving = false;
      }
    });
  }

  closeSession(): void {
    if (!this.session) return;

    if (!confirm('Êtes-vous sûr de vouloir fermer cette session d\'inventaire ?')) {
      return;
    }

    this.loading = true;
    this.inventoryService.updateSessionStatus(this.session.id, 'CLOSED').subscribe({
      next: (updatedSession) => {
        this.session = updatedSession;
        this.loading = false;
        this.router.navigate(['/inventory', this.session.id, 'review']);
      },
      error: (err) => {
        this.error = err.error?.error || 'Erreur lors de la fermeture';
        this.loading = false;
      }
    });
  }

  startSession(): void {
    if (!this.session) return;

    this.loading = true;
    this.inventoryService.updateSessionStatus(this.session.id, 'IN_PROGRESS').subscribe({
      next: (updatedSession) => {
        this.session = updatedSession;
        this.loading = false;
      },
      error: (err) => {
        this.error = err.error?.error || 'Erreur lors du démarrage';
        this.loading = false;
      }
    });
  }

  goBack(): void {
    this.router.navigate(['/inventory']);
  }

  getEcartClass(item: InventoryItem): string {
    if (item.ecartQuantity === null || item.ecartQuantity === 0) {
      return '';
    }
    return (item.ecartQuantity || 0) > 0 ? 'text-success' : 'text-danger';
  }

  getEcartText(item: InventoryItem): string {
    if (item.ecartQuantity === null || item.ecartQuantity === 0) {
      return '';
    }
    const sign = (item.ecartQuantity || 0) > 0 ? '+' : '';
    return `${sign}${item.ecartQuantity}`;
  }

  getReasonText(reason: string): string {
    switch (reason) {
      case 'PHYSICAL_COUNT_DIFFERENCE': return 'Différence de comptage physique';
      case 'SUSPICION_OF_ANOMALY': return 'Suspicion d\'anomalie';
      default: return reason;
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

  // New methods for the redesigned UI
  filterStatus = 'all';

  onSearchChange(): void {
    this.onSearch();
  }

  clearSearch(): void {
    this.searchTerm = '';
    this.onSearch();
  }

  setFilter(status: string): void {
    this.filterStatus = status;
    this.applyFilters();
  }

  applyFilters(): void {
    let filtered = [...this.items];

    // Apply search filter
    if (this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(item => 
        item.product?.name.toLowerCase().includes(term) ||
        item.product?.barcode?.toLowerCase().includes(term) ||
        item.product?.famille?.name.toLowerCase().includes(term)
      );
    }

    // Apply status filter
    switch (this.filterStatus) {
      case 'counted':
        filtered = filtered.filter(item => item.countedQuantity !== null);
        break;
      case 'pending':
        filtered = filtered.filter(item => item.countedQuantity === null);
        break;
      case 'ecart':
        filtered = filtered.filter(item => 
          item.countedQuantity !== null && 
          item.ecartQuantity !== null && 
          item.ecartQuantity !== 0
        );
        break;
    }

    this.filteredItems = filtered;
  }


  clearAllFilters(): void {
    this.searchTerm = '';
    this.filterStatus = 'all';
    this.applyFilters();
  }

  getItemCardClass(item: InventoryItem): string {
    if (item.countedQuantity !== null && item.ecartQuantity !== null && item.ecartQuantity !== 0) {
      return 'ecart';
    } else if (item.countedQuantity !== null) {
      return 'counted';
    }
    return '';
  }

  getCountedItems(): number {
    return this.items.filter(item => item.countedQuantity !== null).length;
  }

  getRemainingItems(): number {
    return this.items.filter(item => item.countedQuantity === null).length;
  }

  getProgressPercentage(): number {
    if (this.items.length === 0) return 0;
    return Math.round((this.getCountedItems() / this.items.length) * 100);
  }

  incrementQuantity(item: InventoryItem): void {
    const current = item.countedQuantity || 0;
    this.updateItemQuantity(item, current + 1);
  }

  decrementQuantity(item: InventoryItem): void {
    const current = item.countedQuantity || 0;
    if (current > 0) {
      this.updateItemQuantity(item, current - 1);
    }
  }

  onQuantityChange(item: InventoryItem, event: any): void {
    const value = event.target.value;
    const quantity = value === '' ? null : parseFloat(value);
    this.updateItemQuantity(item, quantity);
  }

  onQuantityBlur(item: InventoryItem): void {
    // Recalculate ecart when quantity changes
    this.calculateEcart(item);
  }

  updateItemQuantity(item: InventoryItem, quantity: number | null): void {
    item.countedQuantity = quantity || undefined;
    this.calculateEcart(item);
    this.updateStatistics();
  }

  calculateEcart(item: InventoryItem): void {
    if (item.countedQuantity !== null) {
      item.ecartQuantity = (item.countedQuantity || 0) - item.theoreticalQuantity;
      item.ecartValue = item.ecartQuantity * (item.product?.prix_vente_TTC || 0);
    } else {
      item.ecartQuantity = undefined;
      item.ecartValue = undefined;
    }
  }

  clearQuantity(item: InventoryItem): void {
    this.updateItemQuantity(item, null);
  }

  confirmQuantity(item: InventoryItem): void {
    if (item.countedQuantity === null) return;
    
    this.saving = true;
    this.inventoryService.updateItemCount(
      item.sessionId,
      item.id,
      item.countedQuantity || null,
      item.reason || 'PHYSICAL_COUNT_DIFFERENCE',
      item.notes || ''
    ).subscribe({
      next: (updatedItem) => {
        const index = this.items.findIndex(i => i.id === updatedItem.id);
        if (index !== -1) {
          this.items[index] = updatedItem;
        }
        this.applyFilters();
        this.updateStatistics();
        this.saving = false;
      },
      error: (err) => {
        this.error = err.error?.error || 'Erreur lors de l\'enregistrement';
        this.saving = false;
      }
    });
  }

  saveProgress(): void {
    this.saving = true;
    // Save all pending changes
    const pendingItems = this.items.filter(item => 
      item.countedQuantity !== null && 
      item.countedQuantity !== item.theoreticalQuantity
    );

    if (pendingItems.length === 0) {
      this.saving = false;
      return;
    }

    // Save each item
    let completed = 0;
    pendingItems.forEach(item => {
      this.inventoryService.updateItemCount(
        item.sessionId,
        item.id,
        item.countedQuantity!,
        item.reason || 'PHYSICAL_COUNT_DIFFERENCE',
        item.notes || ''
      ).subscribe({
        next: () => {
          completed++;
          if (completed === pendingItems.length) {
            this.saving = false;
            this.success = 'Progrès sauvegardé avec succès';
            setTimeout(() => this.success = '', 3000);
          }
        },
        error: (err) => {
          this.error = err.error?.error || 'Erreur lors de la sauvegarde';
          this.saving = false;
        }
      });
    });
  }

  finishCounting(): void {
    if (!this.session) return;

    if (!confirm('Êtes-vous sûr de vouloir terminer le comptage ?')) {
      return;
    }

    this.loading = true;
    this.inventoryService.updateSessionStatus(this.session.id, 'CLOSED').subscribe({
      next: (updatedSession) => {
        this.session = updatedSession;
        this.loading = false;
        this.router.navigate(['/inventory', this.session.id, 'review']);
      },
      error: (err) => {
        this.error = err.error?.error || 'Erreur lors de la fermeture';
        this.loading = false;
      }
    });
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR'
    }).format(value);
  }
}
