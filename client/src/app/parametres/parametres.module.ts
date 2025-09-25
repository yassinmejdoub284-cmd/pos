import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { ParametresRoutingModule } from './parametres-routing.module';
import { ParametresComponent } from './parametres.component';
import { ParametresOverviewComponent } from './sections/overview/parametres-overview.component';

@NgModule({
  declarations: [ParametresComponent, ParametresOverviewComponent],
  imports: [
    CommonModule,
    FormsModule,
    ParametresRoutingModule
  ]
})
export class ParametresModule { }
