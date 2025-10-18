import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { EnterpriseHomeComponent } from './home/home.component';
import { EnterpriseSuppliersComponent } from './suppliers/enterprise-suppliers.component';

const routes: Routes = [
  { path: '', redirectTo: 'home', pathMatch: 'full' },
  { path: 'home', component: EnterpriseHomeComponent },
  { path: 'suppliers/:enterpriseId', component: EnterpriseSuppliersComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class EnterpriseRoutingModule { }