import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { RapportsRoutingModule } from './rapports-routing.module';
import { RapportsComponent } from './rapports.component';

@NgModule({
  declarations: [
    RapportsComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    RapportsRoutingModule
  ]
})
export class RapportsModule { }
