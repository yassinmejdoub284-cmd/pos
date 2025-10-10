import { NgModule } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { ScanningRoutingModule } from './scanning-routing.module';
import { ScanningComponent } from './scanning.component';

@NgModule({
  declarations: [ScanningComponent],
  imports: [
    CommonModule,
    FormsModule,
    ScanningRoutingModule
  ],
  providers: [DatePipe, DecimalPipe]
})
export class ScanningModule { }
