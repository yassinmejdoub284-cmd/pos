import { Component, OnInit, ChangeDetectionStrategy, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { AdminDashboardService, AdminDashboardStats } from '../core/services/admin-dashboard.service';
import { AuthService } from '../core/services/auth.service';

@Component({
  selector: 'app-admin-home',
  templateUrl: './admin-home.component.html',
  styleUrls: ['./admin-home.component.css'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminHomeComponent implements OnInit {
  stats = signal<AdminDashboardStats | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);

  constructor(
    private adminDashboardService: AdminDashboardService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    if (!this.authService.isAdmin() && !this.authService.isSuperAdmin()) {
      this.router.navigate(['/unauthorized']);
      return;
    }
    this.loadStats();
  }

  loadStats(): void {
    this.loading.set(true);
    this.error.set(null);
    
    this.adminDashboardService.getStats().subscribe({
      next: (data) => {
        this.stats.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set('Erreur lors du chargement des statistiques');
        this.loading.set(false);
      }
    });
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('fr-TN', {
      style: 'currency',
      currency: 'TND',
      minimumFractionDigits: 3
    }).format(value);
  }

  getProductImageUrl(photo: string | null): string {
    if (!photo) return '';
    if (photo.startsWith('http://') || photo.startsWith('https://')) {
      return photo;
    }
    return `https://localhost:3255/${photo}`;
  }

  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    if (img) {
      img.style.display = 'none';
    }
  }

  goToHome(): void {
    this.router.navigate(['/home']);
  }
}

