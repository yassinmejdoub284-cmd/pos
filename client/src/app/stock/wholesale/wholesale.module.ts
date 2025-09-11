import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { WholesaleComponent } from './wholesale.component';

@NgModule({
  declarations: [
    WholesaleComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    RouterModule.forChild([
      { path: '', component: WholesaleComponent }
    ])
  ]
})
export class WholesaleModule { }
