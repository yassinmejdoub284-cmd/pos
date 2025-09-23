import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { DepotsService } from '../../core/services/depots.service';
import { Depot } from '../../core/models/depot.model';

@Component({
  selector: 'app-depot-selection',
  templateUrl: './depot-selection.component.html',
  standalone: false
})
export class DepotSelectionComponent implements OnInit {
  depots: Depot[] = [];
  loading = false;
  error = '';
  
  // Dialog state
  showOptionsDialog = false;
  selectedDepot: Depot | null = null;

  constructor(
    private router: Router,
    private depotsService: DepotsService
  ) {}

  ngOnInit(): void {
    this.loadDepots();
  }

  loadDepots(): void {
    this.loading = true;
    this.error = '';
    
    this.depotsService.list().subscribe({
      next: (depots) => {
        this.depots = depots.filter(depot => depot.isActive);
        this.loading = false;
      },
      error: (error) => {
        this.error = 'Erreur lors du chargement des dépôts';
        this.loading = false;
        console.error('Error loading depots:', error);
      }
    });
  }

  selectDepot(depot: Depot): void {
    this.selectedDepot = depot;
    this.showOptionsDialog = true;
  }

  closeOptionsDialog(): void {
    this.showOptionsDialog = false;
    this.selectedDepot = null;
  }

  goToStockCheck(): void {
    if (this.selectedDepot) {
      // Navigate to stock check section in site component
      this.router.navigate(['/stock/site', this.selectedDepot.id, 'stock-check']);
    }
  }

  goToEntryManagement(): void {
    if (this.selectedDepot) {
      this.router.navigate(['/stock-management/entry-options', this.selectedDepot.id]);
    }
  }

  goBack(): void {
    this.router.navigate(['/stock-management']);
  }

  getDepotTypeLabel(type: string): string {
    const typeLabels: { [key: string]: string } = {
      'MAIN': 'Principal',
      'BRANCH': 'Succursale',
      'SHOP': 'Magasin',
      'WAREHOUSE': 'Entrepôt'
    };
    return typeLabels[type] || type;
  }

  getDepotTypeColor(type: string): string {
    const typeColors: { [key: string]: string } = {
      'MAIN': 'from-blue-500 to-blue-600',
      'BRANCH': 'from-green-500 to-green-600',
      'SHOP': 'from-purple-500 to-purple-600',
      'WAREHOUSE': 'from-orange-500 to-orange-600'
    };
    return typeColors[type] || 'from-gray-500 to-gray-600';
  }
}
