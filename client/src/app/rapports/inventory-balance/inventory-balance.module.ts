import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { RouterModule, Routes } from '@angular/router';

import { InventoryBalanceReportComponent } from './inventory-balance.component';

const routes: Routes = [
  { path: '', component: InventoryBalanceReportComponent }
];

@NgModule({
  declarations: [
    InventoryBalanceReportComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    HttpClientModule,
    RouterModule.forChild(routes)
  ],
  exports: [
    InventoryBalanceReportComponent
  ]
})
export class InventoryBalanceModule { }
