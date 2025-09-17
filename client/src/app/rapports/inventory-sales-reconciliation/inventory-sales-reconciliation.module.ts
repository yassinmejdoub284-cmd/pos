import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';

import { InventorySalesReconciliationComponent } from './inventory-sales-reconciliation.component';

const routes: Routes = [
  { path: '', component: InventorySalesReconciliationComponent }
];

@NgModule({
  declarations: [
    InventorySalesReconciliationComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    RouterModule.forChild(routes)
  ]
})
export class InventorySalesReconciliationModule { }
