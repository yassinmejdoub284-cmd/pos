import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { NewCompanyComponent } from '../new-company/new-company.component';

// This module is mounted at both '/enterprise/companies/new' and '/enterprise/companies/:id/edit'.
// Therefore it should expose a default '' route that renders the editor in both cases.
const routes: Routes = [
  { path: '', component: NewCompanyComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class CompanyEditorRoutingModule {}


