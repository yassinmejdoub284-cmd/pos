import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { ProduitsDeCaisseRoutingModule } from './produits-de-caisse-routing.module';
import { ProduitsDeCaisseComponent } from './produits-de-caisse.component';
import { ProduitsDeCaisseListComponent } from './produits-de-caisse-list/produits-de-caisse-list.component';
import { ProduitsDeCaisseFormComponent } from './produits-de-caisse-form/produits-de-caisse-form.component';
import { DepotSelectorComponent } from '../../shared/depot-selector/depot-selector.component';

@NgModule({
  declarations: [
    ProduitsDeCaisseComponent,
    ProduitsDeCaisseListComponent,
    ProduitsDeCaisseFormComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    ProduitsDeCaisseRoutingModule,
    DepotSelectorComponent
  ]
})
export class ProduitsDeCaisseModule { }
