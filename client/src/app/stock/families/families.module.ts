import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { FamiliesComponent } from './families.component';
import { FamilyFormComponent } from './family-form/family-form.component';
import { FamiliesRoutingModule } from './families-routing.module';
import { ImageUploadModalComponent } from '../../shared/components/image-upload-modal/image-upload-modal.component';

@NgModule({
  declarations: [
    FamiliesComponent,
    FamilyFormComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    FamiliesRoutingModule,
    ImageUploadModalComponent
  ],
  exports: [
    FamiliesComponent
  ]
})
export class FamiliesModule { }
