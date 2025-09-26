import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { VehiclesService } from '../../../core/services/vehicles.service';
import { VehicleBrand } from '../../../core/models/vehicle.model';

@Component({
  selector: 'app-vehicle-brands',
  templateUrl: './vehicle-brands.component.html',
  standalone: false
})
export class VehicleBrandsComponent implements OnInit {
  brands: VehicleBrand[] = [];
  filteredBrands: VehicleBrand[] = [];
  loading = false;
  error = '';
  searchQuery = '';
  showAddForm = false;
  newBrandName = '';
  newBrandModels = '';
  newBrandLogoUrl = '';

  constructor(
    private vehiclesService: VehiclesService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadBrands();
  }

  loadBrands(): void {
    this.loading = true;
    this.error = '';
    
    this.vehiclesService.getVehicleBrands().subscribe({
      next: (brands) => {
        this.brands = brands;
        this.filteredBrands = brands;
        this.loading = false;
      },
      error: (error) => {
        this.error = 'Erreur lors du chargement des marques';
        this.loading = false;
      }
    });
  }

  onSearchChange(): void {
    if (!this.searchQuery.trim()) {
      this.filteredBrands = this.brands;
      return;
    }

    const query = this.searchQuery.toLowerCase();
    this.filteredBrands = this.brands.filter(brand =>
      brand.name.toLowerCase().includes(query)
    );
  }

  toggleAddForm(): void {
    this.showAddForm = !this.showAddForm;
    if (!this.showAddForm) {
      this.newBrandName = '';
      this.newBrandModels = '';
      this.newBrandLogoUrl = '';
    }
  }

  addBrand(): void {
    if (!this.newBrandName.trim()) {
      this.error = 'Le nom de la marque est requis';
      return;
    }

    const models = this.newBrandModels
      .split(',')
      .map(model => model.trim())
      .filter(model => model.length > 0);

    this.loading = true;
    this.vehiclesService.createVehicleBrand({
      name: this.newBrandName.trim(),
      models: models,
      logoUrl: this.newBrandLogoUrl.trim() || undefined
    }).subscribe({
      next: () => {
        this.loadBrands();
        this.toggleAddForm();
        this.error = '';
      },
      error: (error) => {
        this.error = 'Erreur lors de la création de la marque';
        this.loading = false;
      }
    });
  }

  toggleBrandStatus(brand: VehicleBrand): void {
    this.vehiclesService.updateVehicleBrand(brand.id, { 
      isActive: !brand.isActive 
    }).subscribe({
      next: () => {
        this.loadBrands();
      },
      error: (error) => {
        this.error = 'Erreur lors de la mise à jour de la marque';
      }
    });
  }

  deleteBrand(brand: VehicleBrand): void {
    if (confirm(`Êtes-vous sûr de vouloir supprimer la marque ${brand.name} ?`)) {
      this.vehiclesService.deleteVehicleBrand(brand.id).subscribe({
        next: () => {
          this.loadBrands();
        },
        error: (error) => {
          this.error = 'Erreur lors de la suppression de la marque';
        }
      });
    }
  }

  goBack(): void {
    this.router.navigate(['/stock/vehicles']);
  }

  getBrandLogo(brand: VehicleBrand): string | null {
    return brand.logoUrl || null;
  }

  onImageError(event: any): void {
    // Handle image loading errors
    event.target.style.display = 'none';
  }
}
