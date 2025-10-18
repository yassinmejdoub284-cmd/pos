import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { ReviewComponent } from './review/review.component';
import { SummaryComponent } from './summary/summary.component';

import { InventoryRoutingModule } from './inventory-routing.module';
import { InventoryComponent } from './inventory.component';
import { CountComponent } from './count/count.component';

@NgModule({
  declarations: [
    InventoryComponent,
    CountComponent,
    ReviewComponent,
    SummaryComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    InventoryRoutingModule
  ]
})
export class InventoryModule { }
