import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { DepotReceptionComponent } from './depot-reception.component';

const routes: Routes = [
  { path: '', component: DepotReceptionComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class DepotReceptionRoutingModule { }

