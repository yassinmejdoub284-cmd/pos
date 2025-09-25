import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { EnterpriseComponent } from './enterprise.component';
import { CompaniesListComponent } from './companies-list/companies-list.component';
import { CompanyDetailComponent } from './company-detail/company-detail.component';
import { DepotsShopsComponent } from './depots-shops/depots-shops.component';

const routes: Routes = [
  {
    path: '',
    component: EnterpriseComponent,
    children: [
      { path: '', redirectTo: 'companies', pathMatch: 'full' },
      {
        path: 'companies',
        children: [
          { path: '', component: CompaniesListComponent },
          { path: 'new', loadChildren: () => import('./company-editor/company-editor.module').then(m => m.CompanyEditorModule) },
          { path: ':id', component: CompanyDetailComponent },
          { path: ':id/edit', loadChildren: () => import('./company-editor/company-editor.module').then(m => m.CompanyEditorModule) }
        ]
      },
      {
        path: 'depots',
        children: [
          { path: 'new', loadChildren: () => import('./depot-editor/depot-editor.module').then(m => m.DepotEditorModule) },
          { path: ':id/edit', loadChildren: () => import('./depot-editor/depot-editor.module').then(m => m.DepotEditorModule) }
        ]
      },
      { path: 'depots-shops', component: DepotsShopsComponent }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class EnterpriseRoutingModule { }
