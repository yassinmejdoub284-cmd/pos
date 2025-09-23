import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { StockCheckComponent } from './stock-check.component';

@NgModule({
  declarations: [
    StockCheckComponent
  ],
  imports: [
    CommonModule,
    FormsModule
  ],
  exports: [
    StockCheckComponent
  ]
})
export class StockCheckModule { }
