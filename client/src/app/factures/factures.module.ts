import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { FacturesComponent } from './factures.component';
import { FacturesRoutingModule } from './factures-routing.module';

@NgModule({
  declarations: [FacturesComponent],
  imports: [
    CommonModule,
    FormsModule,
    FacturesRoutingModule
  ]
})
export class FacturesModule { }

