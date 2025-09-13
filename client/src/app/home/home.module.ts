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

@NgModule({
  declarations: [
    HomeComponent,
    FinanciereComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    HomeRoutingModule,
    SharedModule,
    ExpenseActionDialogComponent,
    ApprovalsActionDialogComponent
  ]
})
export class HomeModule { } 