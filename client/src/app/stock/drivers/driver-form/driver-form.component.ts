import { Component, OnInit, Input, signal, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { DriversService } from '../../../core/services/drivers.service';
import { Driver, CreateDriverRequest, UpdateDriverRequest } from '../../../core/models/driver.model';

@Component({
  selector: 'app-driver-form',
  templateUrl: './driver-form.component.html',
  standalone: false
})
export class DriverFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private driversService = inject(DriversService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  @Input() driver: Driver | null = null;

  form!: FormGroup;
  loading = signal(false);
  error = signal('');
  isEditMode = signal(false);

  ngOnInit(): void {
    this.initializeForm();
    
    // Check if we're in edit mode
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEditMode.set(true);
      this.loadDriver(parseInt(id, 10));
    }
  }

  private initializeForm(): void {
    this.form = this.fb.group({
      nom: ['', [Validators.required, Validators.minLength(2)]],
      prenom: ['', [Validators.required, Validators.minLength(2)]],
      cin: ['', [Validators.required, Validators.pattern(/^\d{8}$/)]],
      isActive: [true]
    });
  }

  private loadDriver(id: number): void {
    this.loading.set(true);
    this.driversService.getDriver(id).subscribe({
      next: (driver) => {
        this.driver = driver;
        this.populateForm(driver);
        this.loading.set(false);
      },
      error: (error) => {
        console.error('Error loading driver:', error);
        this.error.set('Erreur lors du chargement du chauffeur');
        this.loading.set(false);
      }
    });
  }

  private populateForm(driver: Driver): void {
    this.form.patchValue({
      nom: driver.nom,
      prenom: driver.prenom,
      cin: driver.cin,
      isActive: driver.isActive
    });
  }

  onSubmit(): void {
    if (this.form.valid) {
      this.loading.set(true);
      this.error.set('');

      const formData = this.form.value;
      
      // Prepare the request data
      const requestData: CreateDriverRequest | UpdateDriverRequest = {
        nom: formData.nom,
        prenom: formData.prenom,
        cin: formData.cin
      };

      if (this.isEditMode() && this.driver) {
        // Update existing driver
        (requestData as UpdateDriverRequest).isActive = formData.isActive;
        this.driversService.updateDriver(this.driver.id, requestData as UpdateDriverRequest).subscribe({
          next: () => {
            this.router.navigate(['/stock/drivers']);
          },
          error: (error) => {
            console.error('Error updating driver:', error);
            this.error.set('Erreur lors de la mise à jour du chauffeur');
            this.loading.set(false);
          }
        });
      } else {
        // Create new driver
        this.driversService.createDriver(requestData as CreateDriverRequest).subscribe({
          next: () => {
            this.router.navigate(['/stock/drivers']);
          },
          error: (error) => {
            console.error('Error creating driver:', error);
            this.error.set('Erreur lors de la création du chauffeur');
            this.loading.set(false);
          }
        });
      }
    } else {
      this.markFormGroupTouched();
    }
  }

  onCancel(): void {
    this.router.navigate(['/stock/drivers']);
  }

  private markFormGroupTouched(): void {
    Object.keys(this.form.controls).forEach(key => {
      const control = this.form.get(key);
      control?.markAsTouched();
    });
  }

  getFieldError(fieldName: string): string {
    const control = this.form.get(fieldName);
    if (control?.errors && control.touched) {
      if (control.errors['required']) {
        return 'Ce champ est requis';
      }
      if (control.errors['minlength']) {
        return `Minimum ${control.errors['minlength'].requiredLength} caractères`;
      }
      if (control.errors['pattern']) {
        if (fieldName === 'cin') {
          return 'Le CIN doit contenir exactement 8 chiffres';
        }
      }
    }
    return '';
  }

  hasFieldError(fieldName: string): boolean {
    const control = this.form.get(fieldName);
    return !!(control?.errors && control.touched);
  }
}
