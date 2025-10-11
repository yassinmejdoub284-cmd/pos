import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { DocumentsComponent } from './documents.component';
import { BonEntreeComponent } from './bon-entree/bon-entree.component';
import { BonSortieComponent } from './bon-sortie/bon-sortie.component';
import { BonTransfertComponent } from './bon-transfert/bon-transfert.component';
import { BonLivraisonComponent } from './bon-livraison/bon-livraison.component';
import { DocumentComponent } from './document/document.component';
import { DocumentsListComponent } from './documents/documents.component';

const routes: Routes = [
  { path: '', component: DocumentsListComponent },
  { path: 'list', component: DocumentsListComponent },
  { path: ':id', component: DocumentComponent },
  // Use distinct param names to avoid confusion between depotId and documentId
  { path: 'bon-entree/:depotId', component: BonEntreeComponent },
  { path: 'bon-entree/edit/:documentId', component: BonEntreeComponent },
  // Bon de retour list shares component with filtered mode
  { path: 'bon-retour/:depotId', component: BonEntreeComponent },
  { path: 'bon-sortie/:id', component: BonSortieComponent },
  { path: 'bon-sortie/edit/:id', component: BonSortieComponent },
  { path: 'bon-transfert/:id', component: BonTransfertComponent },
  { path: 'bon-transfert/edit/:id', component: BonTransfertComponent },
  { path: 'bon-livraison/:id', component: BonLivraisonComponent },
  { path: 'bon-livraison/edit/:id', component: BonLivraisonComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class DocumentsRoutingModule {} 