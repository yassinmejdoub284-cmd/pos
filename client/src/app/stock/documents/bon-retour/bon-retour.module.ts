import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { BonRetourComponent } from './bon-retour.component';
import { BonRetourRoutingModule } from './bon-retour-routing.module';
import { SharedModule } from '../../../shared/shared.module';

@NgModule({
  declarations: [
    BonRetourComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    BonRetourRoutingModule,
    SharedModule
  ],
  exports: [
    BonRetourComponent
  ]
})
export class BonRetourModule { }
















