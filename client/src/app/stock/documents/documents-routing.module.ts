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
  // Use distinct param names to avoid confusion between depotId and documentId
  // Specific routes must come before generic :id routes
  { path: 'bon-entree/edit/:documentId', component: BonEntreeComponent },
  { path: 'bon-entree/:depotId', component: BonEntreeComponent },
  // Bon de retour has its own lazy-loaded module at /stock/documents/bon-retour
  // Generic routes come last
  { path: ':id/edit', component: DocumentComponent },
  { path: ':id', component: DocumentComponent },
  // Removed: bon-sortie, bon-transfert, bon-livraison
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class DocumentsRoutingModule {} 