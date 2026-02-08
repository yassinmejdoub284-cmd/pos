import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ParametresOverviewComponent } from './sections/overview/parametres-overview.component';
import { ParametresComponent } from './parametres.component';
import { AccessRoleSelectionComponent } from './sections/access/access-role-selection.component';
import { AccessRoleConfigComponent } from './sections/access/access-role-config.component';
import { RoleCreateComponent } from './sections/access/role-create.component';
import { CompanyListComponent } from './sections/companies/company-list.component';
import { CompanyDetailComponent } from './sections/companies/company-detail.component';

const routes: Routes = [
  { path: '', component: ParametresOverviewComponent },

  { path: 'peripheriques', component: ParametresComponent },
  { path: 'fidelite', component: ParametresComponent },
  { path: 'remises-dettes', component: ParametresComponent },
  { path: 'raccourcis', component: ParametresComponent },
  { path: 'impression', component: ParametresComponent },
  { path: 'depenses', component: ParametresComponent },
  { path: 'cloture', component: ParametresComponent },
  { path: 'logs', component: ParametresComponent },
  { path: 'documents', component: ParametresComponent },
  { path: 'access', component: AccessRoleSelectionComponent },
  { path: 'access/new', component: RoleCreateComponent },
  { path: 'access/new/:id', component: RoleCreateComponent },
  { path: 'access/:role', component: AccessRoleConfigComponent },
  { path: 'entreprises', component: CompanyListComponent },
  { path: 'entreprises/new', component: CompanyDetailComponent },
  { path: 'entreprises/:id', component: CompanyDetailComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ParametresRoutingModule { }
