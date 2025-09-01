import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { CaisseRoutingModule } from './caisse-routing.module';
import { CaisseComponent } from './caisse.component';

@NgModule({
  declarations: [CaisseComponent],
  imports: [
    CommonModule,
    FormsModule,
    CaisseRoutingModule
  ]
})
export class CaisseModule { }
