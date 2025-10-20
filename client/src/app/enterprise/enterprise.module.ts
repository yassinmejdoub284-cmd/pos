import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { EnterpriseHomeComponent } from './home/home.component';
import { EnterpriseComponent } from './enterprise.component';
import { EnterpriseSidebarComponent } from './shared/enterprise-sidebar/enterprise-sidebar.component';
import { EnterpriseLayoutComponent } from './shared/enterprise-layout/enterprise-layout.component';
import { EnterpriseRoutingModule } from './enterprise-routing.module';

@NgModule({
  declarations: [
    EnterpriseHomeComponent,
    EnterpriseComponent,
    EnterpriseSidebarComponent,
    EnterpriseLayoutComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    EnterpriseRoutingModule
  ]
})
export class EnterpriseModule { }