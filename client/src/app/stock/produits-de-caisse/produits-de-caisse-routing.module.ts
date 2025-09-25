import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ProduitsDeCaisseComponent } from './produits-de-caisse.component';

const routes: Routes = [
  { path: '', component: ProduitsDeCaisseComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ProduitsDeCaisseRoutingModule { }
