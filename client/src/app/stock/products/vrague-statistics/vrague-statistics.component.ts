import { Component, OnInit } from '@angular/core';
import { ProductsService } from '../../../core/services/products.service';

@Component({
  selector: 'app-vrague-statistics',
  templateUrl: './vrague-statistics.component.html',
  styleUrls: ['./vrague-statistics.component.css'],
  standalone: false
})
export class VragueStatisticsComponent implements OnInit {
  statistics: any[] = [];
  loading = false;
  error = '';
  startDate = '';
  endDate = '';

  constructor(private productsService: ProductsService) {}

  ngOnInit(): void {
    // Set default date range to current month
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    
    this.startDate = firstDay.toISOString().split('T')[0];
    this.endDate = lastDay.toISOString().split('T')[0];
    
    this.loadStatistics();
  }

  loadStatistics(): void {
    if (!this.startDate || !this.endDate) {
      this.error = 'Veuillez sélectionner une période';
      return;
    }

    this.loading = true;
    this.error = '';

    this.productsService.getVragueStatistics(this.startDate, this.endDate).subscribe({
      next: (stats) => {
        this.statistics = stats;
        this.loading = false;
      },
      error: (error) => {
        this.error = 'Erreur lors du chargement des statistiques';
        this.loading = false;
      }
    });
  }

  onDateRangeChange(): void {
    this.loadStatistics();
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleDateString('fr-FR');
  }

  formatPrice(price: number): string {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'TND'
    }).format(price);
  }
}
