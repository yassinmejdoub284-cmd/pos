import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { DocumentsComponent } from './documents.component';
import { BonEntreeComponent } from './bon-entree/bon-entree.component';
import { BonSortieComponent } from './bon-sortie/bon-sortie.component';
import { BonTransfertComponent } from './bon-transfert/bon-transfert.component';
import { BonLivraisonComponent } from './bon-livraison/bon-livraison.component';

const routes: Routes = [
  { path: '', component: DocumentsComponent },
  { path: 'bon-entree/:id', component: BonEntreeComponent },
  { path: 'bon-sortie/:id', component: BonSortieComponent },
  { path: 'bon-transfert/:id', component: BonTransfertComponent },
  { path: 'bon-livraison/:id', component: BonLivraisonComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class DocumentsRoutingModule {} 