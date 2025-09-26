import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { VehiclesRoutingModule } from './vehicles-routing.module';
import { VehiclesComponent } from './vehicles.component';
import { VehicleListComponent } from './vehicle-list/vehicle-list.component';
import { VehicleFormComponent } from './vehicle-form/vehicle-form.component';
import { VehicleBrandsComponent } from './vehicle-brands/vehicle-brands.component';
import { BrandSelectorComponent } from '../../shared/brand-selector/brand-selector.component';
import { ModelSelectorComponent } from '../../shared/model-selector/model-selector.component';

@NgModule({
  declarations: [
    VehiclesComponent,
    VehicleListComponent,
    VehicleFormComponent,
    VehicleBrandsComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    VehiclesRoutingModule,
    BrandSelectorComponent,
    ModelSelectorComponent
  ]
})
export class VehiclesModule { }
