import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ProduitsDeStockComponent } from './produits-de-caisse.component';

const routes: Routes = [
  { path: '', component: ProduitsDeStockComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ProduitsDeCaisseRoutingModule { }
