import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { ParametresRoutingModule } from './parametres-routing.module';
import { ParametresComponent } from './parametres.component';
import { ParametresOverviewComponent } from './sections/overview/parametres-overview.component';
import { AccessRoleSelectionComponent } from './sections/access/access-role-selection.component';
import { AccessRoleConfigComponent } from './sections/access/access-role-config.component';
import { RoleCreateComponent } from './sections/access/role-create.component';
import { CompanyListComponent } from './sections/companies/company-list.component';
import { CompanyDetailComponent } from './sections/companies/company-detail.component';
import { DepotsManagerComponent } from './sections/depots/depots-manager.component';

@NgModule({
  declarations: [ParametresComponent, ParametresOverviewComponent, AccessRoleSelectionComponent, AccessRoleConfigComponent, RoleCreateComponent],
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    ParametresRoutingModule,
    CompanyListComponent,
    CompanyDetailComponent,
    DepotsManagerComponent
  ]
})
export class ParametresModule { }
