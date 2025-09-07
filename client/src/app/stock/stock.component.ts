import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { DepotsService } from '../core/services/depots.service';
import { Depot } from '../core/models/depot.model';

@Component({
  selector: 'app-stock',
  templateUrl: './stock.component.html',
  standalone: false
})
export class StockComponent implements OnInit {
  depots: Depot[] = [];
  loading = false;
  error = '';

  // Modal properties
  showDepotChoiceModal = false;
  selectedDepot: Depot | null = null;

  constructor(
    private depotsService: DepotsService, 
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadDepots();
  }

  loadDepots() {
    this.loading = true;
    this.depotsService.list().subscribe({
      next: (depots) => {
        this.depots = depots.filter(d => d.isActive);
        this.loading = false;
      },
      error: () => {
        this.error = "Erreur lors du chargement des dépôts";
        this.loading = false;
      }
    });
  }

  openWorkspace(depot: Depot): void {
    switch (depot.type) {
      case 'SHOP':
        // For shops, go to shop transfer module
        this.router.navigate(['/stock/shop-transfer', depot.id]);
        break;
      case 'MAIN':
        // For main depot, go to prepare lot module
        this.router.navigate(['/stock/prepare-lot', depot.id]);
        break;
      case 'BRANCH':
        // For branch depot, go to branch inventory module
        this.router.navigate(['/stock/branch-inventory', depot.id]);
        break;
      default:
        // Fallback to generic site module
        this.router.navigate(['/stock/site', depot.id, 'workspace']);
        break;
    }
  }

  // Choice modal methods
  openDepotChoiceModal(depot: Depot): void {
    this.selectedDepot = depot;
    this.showDepotChoiceModal = true;
  }

  closeDepotChoiceModal(): void {
    this.showDepotChoiceModal = false;
    this.selectedDepot = null;
  }

  openStockManagement(depot: Depot): void {
    this.closeDepotChoiceModal();
    this.openWorkspace(depot);
  }

  openExpenseManagement(depot: Depot): void {
    this.closeDepotChoiceModal();
    this.router.navigate(['/stock/depot-expenses', depot.id]);
  }
} 