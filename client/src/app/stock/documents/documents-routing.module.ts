import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { DocumentsComponent } from './documents.component';
import { BonEntreeComponent } from './bon-entree/bon-entree.component';
// Removed Bon de sortie, transfert, livraison routes and components
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
  // Removed: bon-sortie, bon-transfert, bon-livraison
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class DocumentsRoutingModule {} 