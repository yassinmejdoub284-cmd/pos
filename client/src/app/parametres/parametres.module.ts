import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { ParametresRoutingModule } from './parametres-routing.module';
import { ParametresComponent } from './parametres.component';

@NgModule({
  declarations: [ParametresComponent],
  imports: [
    CommonModule,
    FormsModule,
    ParametresRoutingModule
  ]
})
export class ParametresModule { }
