import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ClotureComponent } from './cloture.component';
import { HistoriqueComponent } from './historique/historique.component';

const routes: Routes = [
  { path: '', component: ClotureComponent },
  { path: 'historique', component: HistoriqueComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ClotureRoutingModule { }
