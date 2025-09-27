import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { ProductsRoutingModule } from './products-routing.module';
import { ProductsComponent } from './products.component';
import { ProductFormComponent } from './product-form/product-form.component';
import { BulkImportComponent } from './bulk-import/bulk-import.component';
import { VracConversionFormComponent } from './vrac-conversion-form/vrac-conversion-form.component';
import { VracStatisticsComponent } from './vrac-statistics/vrac-statistics.component';
import { ImageUploadModalComponent } from '../../shared/components/image-upload-modal/image-upload-modal.component';
import { ConservationWarningsComponent } from '../../shared/components/conservation-warnings/conservation-warnings.component';
import { MultiDepotSelectorComponent } from '../../shared/multi-depot-selector/multi-depot-selector.component';

@NgModule({
  declarations: [
    ProductsComponent,
    ProductFormComponent,
    BulkImportComponent,
    VracConversionFormComponent,
    VracStatisticsComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    ProductsRoutingModule,
    ImageUploadModalComponent,
    ConservationWarningsComponent,
    MultiDepotSelectorComponent
  ]
})
export class ProductsModule { } 