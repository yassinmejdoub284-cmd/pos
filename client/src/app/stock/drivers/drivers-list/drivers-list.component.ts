import { Component, OnInit, signal, inject } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { DriversService } from '../../../core/services/drivers.service';
import { Driver } from '../../../core/models/driver.model';

@Component({
  selector: 'app-drivers-list',
  templateUrl: './drivers-list.component.html',
  standalone: false
})
export class DriversListComponent implements OnInit {
  private driversService = inject(DriversService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  drivers = signal<Driver[]>([]);
  loading = signal(false);
  error = signal('');
  searchQuery = signal('');
  depotId: string | null = null;
  viewMode = signal<'grid' | 'table'>('grid');

  ngOnInit(): void {
    this.depotId = this.route.snapshot.paramMap.get('depotId');
    this.loadDrivers();
  }

  loadDrivers(): void {
    this.loading.set(true);
    this.error.set('');
    
    this.driversService.getDrivers(1, 100, this.searchQuery()).subscribe({
      next: (response) => {
        this.drivers.set(response.drivers);
        this.loading.set(false);
      },
      error: (error) => {
        console.error('Error loading drivers:', error);
        this.error.set('Erreur lors du chargement des chauffeurs');
        this.loading.set(false);
      }
    });
  }

  onSearch(): void {
    this.loadDrivers();
  }

  onAddDriver(): void {
    if (this.depotId) {
      this.router.navigate(['/stock/drivers/new'], { queryParams: { depotId: this.depotId } });
    } else {
      this.router.navigate(['/stock/drivers/new']);
    }
  }

  onEditDriver(driver: Driver): void {
    if (this.depotId) {
      this.router.navigate(['/stock/drivers/edit', driver.id], { queryParams: { depotId: this.depotId } });
    } else {
      this.router.navigate(['/stock/drivers/edit', driver.id]);
    }
  }

  onDeleteDriver(driver: Driver): void {
    if (confirm(`Êtes-vous sûr de vouloir supprimer le chauffeur ${driver.prenom} ${driver.nom} ?`)) {
      this.driversService.deleteDriver(driver.id).subscribe({
        next: () => {
          this.loadDrivers();
        },
        error: (error) => {
          console.error('Error deleting driver:', error);
          this.error.set('Erreur lors de la suppression du chauffeur');
        }
      });
    }
  }

  getDriverInitials(driver: Driver): string {
    return (driver.prenom.charAt(0) + driver.nom.charAt(0)).toUpperCase();
  }

  getStatusBadgeClasses(isActive: boolean): string {
    return isActive 
      ? 'bg-green-100 text-green-800' 
      : 'bg-red-100 text-red-800';
  }

  getStatusLabel(isActive: boolean): string {
    return isActive ? 'Actif' : 'Inactif';
  }

  toggleViewMode(): void {
    this.viewMode.set(this.viewMode() === 'grid' ? 'table' : 'grid');
  }
}
