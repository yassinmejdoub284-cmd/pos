import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { SupplierStatementComponent } from './supplier-statement.component';
import { SupplierStatementDetailComponent } from './supplier-statement-detail/supplier-statement-detail.component';

const routes: Routes = [
  { path: '', component: SupplierStatementComponent },
  { path: ':id', component: SupplierStatementDetailComponent }
];

@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    RouterModule.forChild(routes),
    SupplierStatementComponent,
    SupplierStatementDetailComponent
  ]
})
export class SupplierStatementModule { }
