import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import { DriversComponent } from './drivers.component';
import { DriversListComponent } from './drivers-list/drivers-list.component';
import { DriverFormComponent } from './driver-form/driver-form.component';

const routes: Routes = [
  { path: '', component: DriversComponent },
  { path: 'list', component: DriversListComponent },
  { path: 'new', component: DriverFormComponent },
  { path: 'edit/:id', component: DriverFormComponent },
  { path: ':depotId', component: DriversListComponent }
];

@NgModule({
  declarations: [
    DriversComponent,
    DriversListComponent,
    DriverFormComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule.forChild(routes)
  ]
})
export class DriversModule { }
