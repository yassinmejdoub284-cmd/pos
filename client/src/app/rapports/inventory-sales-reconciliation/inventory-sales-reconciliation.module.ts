import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';

import { InventorySalesReconciliationComponent } from './inventory-sales-reconciliation.component';
import { TicketDetailsModalComponent } from '../../shared/ticket-details-modal/ticket-details-modal.component';

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
    RouterModule.forChild(routes),
    TicketDetailsModalComponent
  ]
})
export class InventorySalesReconciliationModule { }
