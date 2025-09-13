import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { SupplierPaymentsComponent } from './supplier-payments.component';

const routes: Routes = [
  { path: '', component: SupplierPaymentsComponent }
];

@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    RouterModule.forChild(routes),
    SupplierPaymentsComponent
  ]
})
export class SupplierPaymentsModule { }
