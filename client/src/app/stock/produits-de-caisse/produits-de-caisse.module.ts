import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { ProduitsDeCaisseRoutingModule } from './produits-de-caisse-routing.module';
import { ProduitsDeStockComponent } from './produits-de-caisse.component';
import { ProduitsDeCaisseListComponent } from './produits-de-caisse-list/produits-de-caisse-list.component';
import { ProduitsDeStockFormComponent } from './produits-de-caisse-form/produits-de-caisse-form.component';
import { MultiDepotSelectorComponent } from '../../shared/multi-depot-selector/multi-depot-selector.component';
import { DialogComponent } from '../../shared/dialog/dialog.component';

@NgModule({
  declarations: [
    ProduitsDeStockComponent,
    ProduitsDeCaisseListComponent,
    ProduitsDeStockFormComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    ProduitsDeCaisseRoutingModule,
    MultiDepotSelectorComponent,
    DialogComponent
  ]
})
export class ProduitsDeCaisseModule { }
