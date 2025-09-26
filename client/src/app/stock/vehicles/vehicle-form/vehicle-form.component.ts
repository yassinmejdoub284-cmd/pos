import { Component, OnInit, signal } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { VehiclesService } from '../../../core/services/vehicles.service';
import { Vehicle, VehicleBrand } from '../../../core/models/vehicle.model';

@Component({
  selector: 'app-vehicle-form',
  templateUrl: './vehicle-form.component.html',
  standalone: false
})
export class VehicleFormComponent implements OnInit {
  vehicleForm: FormGroup;
  vehicle: Vehicle | null = null;
  vehicleBrands: VehicleBrand[] = [];
  loading = false;
  error = '';
  isEditMode = false;
  
  // New selector properties
  selectedBrand = signal<VehicleBrand | null>(null);
  selectedModel = signal<string | null>(null);
  availableModels = signal<string[]>([]);

  constructor(
    private fb: FormBuilder,
    private vehiclesService: VehiclesService,
    private router: Router,
    private route: ActivatedRoute
  ) {
    this.vehicleForm = this.fb.group({
      matricule: ['', [Validators.required, Validators.maxLength(20)]],
      brand: ['', [Validators.required]],
      model: ['', [Validators.required, Validators.maxLength(100)]],
      isActive: [true]
    });
  }

  ngOnInit(): void {
    this.loadVehicleBrands();
    
    const vehicleId = this.route.snapshot.queryParams['id'];
    if (vehicleId) {
      this.isEditMode = true;
      this.loadVehicle(parseInt(vehicleId));
    }
  }

  loadVehicleBrands(): void {
    this.vehiclesService.getActiveVehicleBrands().subscribe({
      next: (brands) => {
        this.vehicleBrands = brands;
      },
      error: (error) => {
        this.error = 'Erreur lors du chargement des marques';
      }
    });
  }

  loadVehicle(id: number): void {
    this.loading = true;
    this.vehiclesService.getVehicle(id).subscribe({
      next: (vehicle) => {
        this.vehicle = vehicle;
        this.vehicleForm.patchValue({
          matricule: vehicle.matricule,
          brand: vehicle.brand,
          model: vehicle.model,
          isActive: vehicle.isActive
        });
        
        // Set selected brand and model for the selectors
        const brand = this.vehicleBrands.find(b => b.name === vehicle.brand.name);
        if (brand) {
          this.selectedBrand.set(brand);
          this.availableModels.set(brand.models);
          const model = brand.models.find(m => m === vehicle.model);
          if (model) {
            this.selectedModel.set(model);
          }
        }
        
        this.loading = false;
      },
      error: (error) => {
        this.error = 'Erreur lors du chargement du véhicule';
        this.loading = false;
      }
    });
  }

  onSubmit(): void {
    if (this.vehicleForm.valid) {
      this.loading = true;
      this.error = '';

      const formData = this.vehicleForm.value;

      if (this.isEditMode && this.vehicle) {
        this.vehiclesService.updateVehicle(this.vehicle.id, formData).subscribe({
          next: () => {
            this.router.navigate(['/stock/vehicles/list']);
          },
          error: (error) => {
            this.error = 'Erreur lors de la mise à jour du véhicule';
            this.loading = false;
          }
        });
      } else {
        this.vehiclesService.createVehicle(formData).subscribe({
          next: () => {
            this.router.navigate(['/stock/vehicles/list']);
          },
          error: (error) => {
            this.error = 'Erreur lors de la création du véhicule';
            this.loading = false;
          }
        });
      }
    } else {
      this.markFormGroupTouched();
    }
  }

  markFormGroupTouched(): void {
    Object.keys(this.vehicleForm.controls).forEach(key => {
      const control = this.vehicleForm.get(key);
      control?.markAsTouched();
    });
  }

  goBack(): void {
    this.router.navigate(['/stock/vehicles/list']);
  }

  onBrandSelected(brand: VehicleBrand | null): void {
    this.selectedBrand.set(brand);
    if (brand) {
      this.availableModels.set(brand.models);
      this.vehicleForm.patchValue({ brand: brand.name });
    } else {
      this.availableModels.set([]);
      this.selectedModel.set(null);
      this.vehicleForm.patchValue({ brand: '', model: '' });
    }
  }

  onModelSelected(model: string | null): void {
    this.selectedModel.set(model);
    this.vehicleForm.patchValue({ model: model || '' });
  }

  getFieldError(fieldName: string): string {
    const field = this.vehicleForm.get(fieldName);
    if (field?.errors && field.touched) {
      if (field.errors['required']) {
        return `${fieldName} est requis`;
      }
      if (field.errors['maxlength']) {
        return `${fieldName} est trop long`;
      }
    }
    return '';
  }
}
