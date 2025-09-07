import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { DepotExpensesComponent } from './depot-expenses.component';

const routes: Routes = [
  {
    path: '',
    component: DepotExpensesComponent
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class DepotExpensesRoutingModule { }
