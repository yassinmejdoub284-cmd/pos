import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { VehiclesComponent } from './vehicles.component';
import { VehicleListComponent } from './vehicle-list/vehicle-list.component';
import { VehicleFormComponent } from './vehicle-form/vehicle-form.component';
import { VehicleBrandsComponent } from './vehicle-brands/vehicle-brands.component';

const routes: Routes = [
  { path: '', component: VehiclesComponent },
  { path: 'list', component: VehicleListComponent },
  { path: 'form', component: VehicleFormComponent },
  { path: 'brands', component: VehicleBrandsComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class VehiclesRoutingModule { }
