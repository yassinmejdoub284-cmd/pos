import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { HistoriqueRoutingModule } from './historique-routing.module';
import { HistoriqueComponent } from './historique.component';

@NgModule({
  declarations: [HistoriqueComponent],
  imports: [
    CommonModule,
    FormsModule,
    HistoriqueRoutingModule
  ]
})
export class HistoriqueModule { }
