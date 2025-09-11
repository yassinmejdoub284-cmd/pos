import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { HomeComponent } from './home.component';
import { SupplierPaymentComponent } from './supplier-payment/supplier-payment.component';
import { SupplierStatementComponent } from './supplier-statement/supplier-statement.component';
import { ClientStatementComponent } from './client-statement/client-statement.component';
import { CashStatementComponent } from './cash-statement/cash-statement.component';
import { FinanciereComponent } from './financiere/financiere.component';

const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'financiere', component: FinanciereComponent },
  { path: 'supplier-payment', component: SupplierPaymentComponent },
  { path: 'supplier-statement', component: SupplierStatementComponent },
  { path: 'client-statement', component: ClientStatementComponent },
  { path: 'cash-statement', component: CashStatementComponent }
];

@NgModule({
  imports: [
    RouterModule.forChild(routes),
    SupplierPaymentComponent,
    SupplierStatementComponent,
    ClientStatementComponent,
    CashStatementComponent
  ],
  exports: [RouterModule]
})
export class HomeRoutingModule { } 