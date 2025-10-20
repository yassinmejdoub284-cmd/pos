import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { VenteTablesComponent } from './vente-tables.component';

const routes: Routes = [
  {
    path: '',
    component: VenteTablesComponent
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class VenteTablesRoutingModule { }
