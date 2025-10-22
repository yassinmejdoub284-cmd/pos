import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { VenteTablesComponent } from './vente-tables.component';
import { VenteTablesRoutingModule } from './vente-tables-routing.module';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    VenteTablesRoutingModule,
    VenteTablesComponent // Now imported directly as it's standalone
  ]
})
export class VenteTablesModule { }
