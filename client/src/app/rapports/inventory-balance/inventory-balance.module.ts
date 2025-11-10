import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';

import { InventoryBalanceReportComponent } from './inventory-balance.component';

@NgModule({
  declarations: [
    InventoryBalanceReportComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    HttpClientModule
  ],
  exports: [
    InventoryBalanceReportComponent
  ]
})
export class InventoryBalanceModule { }
