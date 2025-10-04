import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';

import { StockHistoryComponent } from './stock-history.component';

const routes: Routes = [
  { path: '', component: StockHistoryComponent }
];

@NgModule({
  declarations: [
    StockHistoryComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    RouterModule.forChild(routes)
  ]
})
export class StockHistoryModule { }