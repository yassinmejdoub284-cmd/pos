import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { BonRetourComponent } from './bon-retour.component';
import { SharedModule } from '../../../shared/shared.module';

@NgModule({
  declarations: [
    BonRetourComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    SharedModule
  ],
  exports: [
    BonRetourComponent
  ]
})
export class BonRetourModule { }








