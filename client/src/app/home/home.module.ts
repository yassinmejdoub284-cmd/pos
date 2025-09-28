import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { HomeRoutingModule } from './home-routing.module';
import { HomeComponent } from './home.component';
import { SharedModule } from '../shared/shared.module';
import { FinanciereComponent } from './financiere/financiere.component';
import { ExpenseActionDialogComponent } from '../shared/expense-action-dialog/expense-action-dialog.component';
import { ApprovalsActionDialogComponent } from '../shared/approvals-action-dialog/approvals-action-dialog.component';
import { BillingCenterActionDialogComponent } from '../shared/billing-center-action-dialog/billing-center-action-dialog.component';
import { SettingsActionDialogComponent } from '../shared/settings-action-dialog/settings-action-dialog.component';
import { EnterpriseActionDialogComponent } from '../shared/enterprise-action-dialog/enterprise-action-dialog.component';
import { ErpUnlockDialogComponent } from '../shared/erp-unlock-dialog/erp-unlock-dialog.component';

@NgModule({
  declarations: [
    HomeComponent,
    FinanciereComponent
  ],
  imports: [
    CommonModule,
    ExpenseActionDialogComponent,
    FormsModule,
    RouterModule,
    HomeRoutingModule,
    SharedModule,
    ApprovalsActionDialogComponent,
    BillingCenterActionDialogComponent,
    SettingsActionDialogComponent,
    EnterpriseActionDialogComponent,
    ErpUnlockDialogComponent,
  ]
})
export class HomeModule { } 