import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { ClotureRoutingModule } from './cloture-routing.module';
import { ClotureComponent } from './cloture.component';
import { HistoriqueComponent } from './historique/historique.component';

@NgModule({
  imports: [
    CommonModule,
    ClotureRoutingModule,
    ClotureComponent,
    HistoriqueComponent
  ]
})
export class ClotureModule { }
