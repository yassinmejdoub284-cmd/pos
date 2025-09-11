import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { FamiliesService } from '../../../core/services/families.service';
import { ProductFamily } from '../../../core/models/product-family.model';

@Component({
  selector: 'app-family-form',
  templateUrl: './family-form.component.html',
  standalone: false
})
export class FamilyFormComponent implements OnInit {
  @Input() family: ProductFamily | null = null;
  @Output() saved = new EventEmitter<ProductFamily>();
  @Output() cancelled = new EventEmitter<void>();

  familyForm: FormGroup;
  loading = false;
  error = '';

  constructor(
    private fb: FormBuilder,
    private familiesService: FamiliesService
  ) {
    this.familyForm = this.fb.group({
      name: ['', Validators.required],
      description: [''],
      isActive: [true]
    });
  }

  ngOnInit(): void {
    if (this.family) {
      this.familyForm.patchValue({
        name: this.family.name,
        description: this.family.description || '',
        isActive: this.family.isActive
      });
    }
  }

  onSubmit(): void {
    if (this.familyForm.valid) {
      this.loading = true;
      this.error = '';

      const formData = this.familyForm.value;

      if (this.family) {
        this.familiesService.updateFamily(this.family.id, formData).subscribe({
          next: (updatedFamily) => {
            this.saved.emit(updatedFamily);
            this.loading = false;
          },
          error: (error) => {
            this.error = error.error?.error || 'Erreur lors de la mise à jour de la famille';
            this.loading = false;
          }
        });
      } else {
        this.familiesService.createFamily(formData).subscribe({
          next: (newFamily) => {
            this.saved.emit(newFamily);
            this.loading = false;
          },
          error: (error) => {
            this.error = error.error?.error || 'Erreur lors de la création de la famille';
            this.loading = false;
          }
        });
      }
    }
  }

  onCancel(): void {
    this.cancelled.emit();
  }
}
