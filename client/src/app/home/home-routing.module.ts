import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { HomeComponent } from './home.component';
import { FinanciereComponent } from './financiere/financiere.component';

const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'financiere', component: FinanciereComponent },
  { path: 'client-statement', loadComponent: () => import('./client-statement/client-statement.component').then(m => m.ClientStatementComponent) },
  { path: 'cash-statement', loadComponent: () => import('./cash-statement/cash-statement.component').then(m => m.CashStatementComponent) }
];

@NgModule({
  imports: [
    RouterModule.forChild(routes)
  ],
  exports: [RouterModule]
})
export class HomeRoutingModule { } 