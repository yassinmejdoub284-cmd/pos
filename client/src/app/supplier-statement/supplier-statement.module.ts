import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { SupplierStatementComponent } from './supplier-statement.component';

const routes: Routes = [
  { path: '', component: SupplierStatementComponent }
];

@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    RouterModule.forChild(routes),
    SupplierStatementComponent
  ]
})
export class SupplierStatementModule { }
