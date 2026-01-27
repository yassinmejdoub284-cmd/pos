import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { BonRetourComponent } from './bon-retour.component';
import { BonRetourClientComponent } from './bon-retour-client/bon-retour-client.component';
import { BonRetourClientListComponent } from './bon-retour-client-list/bon-retour-client-list.component';
import { BonRetourRoutingModule } from './bon-retour-routing.module';
import { SharedModule } from '../../../shared/shared.module';

@NgModule({
  declarations: [
    BonRetourComponent,
    BonRetourClientComponent,
    BonRetourClientListComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    BonRetourRoutingModule,
    SharedModule
  ],
  exports: [
    BonRetourComponent
  ]
})
export class BonRetourModule { }
















