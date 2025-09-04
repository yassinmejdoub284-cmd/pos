import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { ProductsRoutingModule } from './products-routing.module';
import { ProductsComponent } from './products.component';
import { ProductFormComponent } from './product-form/product-form.component';
import { BulkImportComponent } from './bulk-import/bulk-import.component';
import { VragueConversionFormComponent } from './vrague-conversion-form/vrague-conversion-form.component';
import { VragueStatisticsComponent } from './vrague-statistics/vrague-statistics.component';
import { ImageUploadModalComponent } from '../../shared/components/image-upload-modal/image-upload-modal.component';
import { ConservationWarningsComponent } from '../../shared/components/conservation-warnings/conservation-warnings.component';

@NgModule({
  declarations: [
    ProductsComponent,
    ProductFormComponent,
    BulkImportComponent,
    VragueConversionFormComponent,
    VragueStatisticsComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    ProductsRoutingModule,
    ImageUploadModalComponent,
    ConservationWarningsComponent
  ]
})
export class ProductsModule { } 