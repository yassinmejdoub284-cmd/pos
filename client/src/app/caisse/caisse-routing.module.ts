import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { CaisseComponent } from './caisse.component';

const routes: Routes = [
  { path: '', component: CaisseComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class CaisseRoutingModule { }
