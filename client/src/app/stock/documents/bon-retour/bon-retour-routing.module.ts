import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { BonRetourComponent } from './bon-retour.component';
import { BonRetourClientComponent } from './bon-retour-client/bon-retour-client.component';
import { BonRetourClientListComponent } from './bon-retour-client-list/bon-retour-client-list.component';

const routes: Routes = [
  { path: '', component: BonRetourComponent },
  { path: 'client-return', component: BonRetourClientListComponent },
  { path: 'client-return/new', component: BonRetourClientComponent },
  { path: 'client-return/edit/:id', component: BonRetourClientComponent },
  { path: 'edit/:documentId', component: BonRetourComponent },
  { path: ':depotId', component: BonRetourComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class BonRetourRoutingModule { }

