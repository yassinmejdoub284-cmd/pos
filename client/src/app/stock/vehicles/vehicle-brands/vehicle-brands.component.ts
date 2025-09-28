import { Component, OnInit, AfterViewInit, ViewChild, ViewContainerRef } from '@angular/core';
import { Router } from '@angular/router';
import { VehiclesService } from '../../../core/services/vehicles.service';
import { VehicleBrand } from '../../../core/models/vehicle.model';
import { ErrorHandlingService, ForeignKeyConstraintError } from '../../../core/services/error-handling.service';
import { DialogService } from '../../../shared/services/dialog.service';
import { HttpErrorResponse } from '@angular/common/http';

@Component({
  selector: 'app-vehicle-brands',
  templateUrl: './vehicle-brands.component.html',
  standalone: false
})
export class VehicleBrandsComponent implements OnInit, AfterViewInit {
  @ViewChild('dialogContainer', { read: ViewContainerRef }) dialogContainer!: ViewContainerRef;

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
    private router: Router,
    private errorHandlingService: ErrorHandlingService,
    private dialogService: DialogService
  ) {}

  ngOnInit(): void {
    this.loadBrands();
    // Set up dialog container
    if (this.dialogContainer) {
      this.dialogService.setViewContainerRef(this.dialogContainer);
    }
  }

  ngAfterViewInit(): void {
    // Set up dialog container after view is initialized
    if (this.dialogContainer) {
      this.dialogService.setViewContainerRef(this.dialogContainer);
    }
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
    this.dialogService.showConfirmationDialog(
      'Confirmer la suppression',
      `Êtes-vous sûr de vouloir supprimer la marque "${brand.name}" ?`,
      () => {
        this.performDeleteBrand(brand);
      }
    );
  }

  private performDeleteBrand(brand: VehicleBrand): void {
    this.vehiclesService.deleteVehicleBrand(brand.id).subscribe({
      next: () => {
        this.loadBrands();
        this.error = '';
      },
      error: (error: HttpErrorResponse) => {
        this.handleDeleteError(error, brand);
      }
    });
  }

  private handleDeleteError(error: HttpErrorResponse, brand: VehicleBrand): void {
    // Try to parse as foreign key constraint error
    const fkError = this.errorHandlingService.parseForeignKeyError(error);
    
    if (fkError) {
      // Show user-friendly foreign key constraint dialog
      const dialogData = this.errorHandlingService.createForeignKeyErrorDialog(
        fkError,
        () => {
          // Primary action - just close
        },
        () => {
          // Secondary action - navigate to vehicles list
          this.router.navigate(['/stock/vehicles']);
        }
      );
      
      this.dialogService.showErrorDialog(dialogData);
    } else {
      // Show generic error dialog
      const dialogData = this.errorHandlingService.createGenericErrorDialog(error);
      this.dialogService.showErrorDialog(dialogData);
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
