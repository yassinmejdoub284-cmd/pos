import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { EnterpriseRoutingModule } from './enterprise-routing.module';
import { EnterpriseComponent } from './enterprise.component';
import { CompaniesListComponent } from './companies-list/companies-list.component';
import { CompanyDetailComponent } from './company-detail/company-detail.component';
import { AssignDepotComponent } from './assign-depot/assign-depot.component';
import { DepotsShopsComponent } from './depots-shops/depots-shops.component';

@NgModule({
  declarations: [
    EnterpriseComponent,
    CompaniesListComponent,
    CompanyDetailComponent,
    AssignDepotComponent,
    DepotsShopsComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    EnterpriseRoutingModule
  ]
})
export class EnterpriseModule { }
