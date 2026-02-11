import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { EtatMvtStockDepotComponent } from './etat-mvt-stock-depot.component';

const routes: Routes = [
  { path: '', component: EtatMvtStockDepotComponent }
];

@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    RouterModule.forChild(routes),
    EtatMvtStockDepotComponent
  ]
})
export class EtatMvtStockDepotModule { }
