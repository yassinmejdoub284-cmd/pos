import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';

import { ChargesRoutingModule } from './charges-routing.module';
import { ChargesComponent } from './charges.component';

@NgModule({
  declarations: [ChargesComponent],
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    ChargesRoutingModule
  ]
})
export class ChargesModule { } 