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


  openInventoryManagement(depot: Depot): void {
    this.closeDepotChoiceModal();
    this.router.navigate(['/inventory', depot.id]);
  }

  // Depot type styling methods
  getDepotIcon(depot: Depot): string {
    switch (depot.type) {
      case 'MAIN':
        return 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4';
      case 'BRANCH':
        return 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4';
      case 'SHOP':
        return 'M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z';
      case 'WAREHOUSE':
        return 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4';
      default:
        return 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4';
    }
  }

  getDepotIconColor(depot: Depot): string {
    switch (depot.type) {
      case 'MAIN':
        return 'text-white';
      case 'BRANCH':
        return 'text-white';
      case 'SHOP':
        return 'text-white';
      case 'WAREHOUSE':
        return 'text-white';
      default:
        return 'text-white';
    }
  }

  getDepotGradient(depot: Depot): string {
    switch (depot.type) {
      case 'MAIN':
        return 'from-emerald-500 to-green-600';
      case 'BRANCH':
        return 'from-blue-500 to-cyan-600';
      case 'SHOP':
        return 'from-orange-500 to-amber-600';
      case 'WAREHOUSE':
        return 'from-purple-500 to-indigo-600';
      default:
        return 'from-gray-500 to-slate-600';
    }
  }

  getDepotHoverGradient(depot: Depot): string {
    switch (depot.type) {
      case 'MAIN':
        return 'to-emerald-500/5';
      case 'BRANCH':
        return 'to-blue-500/5';
      case 'SHOP':
        return 'to-orange-500/5';
      case 'WAREHOUSE':
        return 'to-purple-500/5';
      default:
        return 'to-gray-500/5';
    }
  }

  getDepotHoverBorder(depot: Depot): string {
    switch (depot.type) {
      case 'MAIN':
        return 'hover:border-emerald-400/50';
      case 'BRANCH':
        return 'hover:border-blue-400/50';
      case 'SHOP':
        return 'hover:border-orange-400/50';
      case 'WAREHOUSE':
        return 'hover:border-purple-400/50';
      default:
        return 'hover:border-gray-400/50';
    }
  }

  getDepotHoverText(depot: Depot): string {
    switch (depot.type) {
      case 'MAIN':
        return 'group-hover:text-emerald-400';
      case 'BRANCH':
        return 'group-hover:text-blue-400';
      case 'SHOP':
        return 'group-hover:text-orange-400';
      case 'WAREHOUSE':
        return 'group-hover:text-purple-400';
      default:
        return 'group-hover:text-gray-400';
    }
  }

  getDepotHoverBorderRing(depot: Depot): string {
    switch (depot.type) {
      case 'MAIN':
        return 'group-hover:border-emerald-400/20';
      case 'BRANCH':
        return 'group-hover:border-blue-400/20';
      case 'SHOP':
        return 'group-hover:border-orange-400/20';
      case 'WAREHOUSE':
        return 'group-hover:border-purple-400/20';
      default:
        return 'group-hover:border-gray-400/20';
    }
  }

  getDepotTypeLabel(depot: Depot): string {
    switch (depot.type) {
      case 'MAIN':
        return 'Dépôt Principal';
      case 'BRANCH':
        return 'Succursale';
      case 'SHOP':
        return 'Magasin';
      case 'WAREHOUSE':
        return 'Entrepôt';
      default:
        return depot.type;
    }
  }
} 