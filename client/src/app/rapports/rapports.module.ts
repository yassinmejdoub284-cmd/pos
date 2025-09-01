import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { RapportsRoutingModule } from './rapports-routing.module';
import { RapportsComponent } from './rapports.component';

@NgModule({
  declarations: [RapportsComponent],
  imports: [
    CommonModule,
    RapportsRoutingModule
  ]
})
export class RapportsModule { }
