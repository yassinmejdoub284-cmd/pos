import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { HomeRoutingModule } from './home-routing.module';
import { HomeComponent } from './home.component';
import { ExpenseActionDialogComponent } from '../shared/expense-action-dialog/expense-action-dialog.component';
import { SharedModule } from '../shared/shared.module';
import { SupplierPaymentComponent } from './supplier-payment/supplier-payment.component';
import { SupplierStatementComponent } from './supplier-statement/supplier-statement.component';
import { ClientStatementComponent } from './client-statement/client-statement.component';
import { CashStatementComponent } from './cash-statement/cash-statement.component';
import { FinanciereComponent } from './financiere/financiere.component';

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
    ExpenseActionDialogComponent,
    SharedModule,
    SupplierPaymentComponent,
    SupplierStatementComponent,
    ClientStatementComponent,
    CashStatementComponent
  ]
})
export class HomeModule { } 