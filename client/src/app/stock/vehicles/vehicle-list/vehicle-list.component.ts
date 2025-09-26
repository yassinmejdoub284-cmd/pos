import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { VehiclesService } from '../../../core/services/vehicles.service';
import { Vehicle } from '../../../core/models/vehicle.model';

@Component({
  selector: 'app-vehicle-list',
  templateUrl: './vehicle-list.component.html',
  standalone: false
})
export class VehicleListComponent implements OnInit {
  vehicles: Vehicle[] = [];
  filteredVehicles: Vehicle[] = [];
  loading = false;
  error = '';
  searchQuery = '';

  constructor(
    private vehiclesService: VehiclesService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadVehicles();
  }

  loadVehicles(): void {
    this.loading = true;
    this.error = '';
    
    this.vehiclesService.getVehicles().subscribe({
      next: (vehicles) => {
        this.vehicles = vehicles;
        this.filteredVehicles = vehicles;
        this.loading = false;
      },
      error: (error) => {
        this.error = 'Erreur lors du chargement des véhicules';
        this.loading = false;
      }
    });
  }

  onSearchChange(): void {
    if (!this.searchQuery.trim()) {
      this.filteredVehicles = this.vehicles;
      return;
    }

    const query = this.searchQuery.toLowerCase();
    this.filteredVehicles = this.vehicles.filter(vehicle =>
      vehicle.matricule.toLowerCase().includes(query) ||
      vehicle.model.toLowerCase().includes(query) ||
      vehicle.brand.name.toLowerCase().includes(query)
    );
  }

  editVehicle(vehicle: Vehicle): void {
    this.router.navigate(['/stock/vehicles/form'], { 
      queryParams: { id: vehicle.id } 
    });
  }

  deleteVehicle(vehicle: Vehicle): void {
    if (confirm(`Êtes-vous sûr de vouloir supprimer le véhicule ${vehicle.matricule} ?`)) {
      this.vehiclesService.deleteVehicle(vehicle.id).subscribe({
        next: () => {
          this.loadVehicles();
        },
        error: (error) => {
          this.error = 'Erreur lors de la suppression du véhicule';
        }
      });
    }
  }

  toggleVehicleStatus(vehicle: Vehicle): void {
    this.vehiclesService.updateVehicle(vehicle.id, { 
      isActive: !vehicle.isActive 
    }).subscribe({
      next: () => {
        this.loadVehicles();
      },
      error: (error) => {
        this.error = 'Erreur lors de la mise à jour du véhicule';
      }
    });
  }

  addNewVehicle(): void {
    this.router.navigate(['/stock/vehicles/form']);
  }

  goBack(): void {
    this.router.navigate(['/stock/vehicles']);
  }
}
