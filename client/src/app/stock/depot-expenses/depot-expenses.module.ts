import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { DepotExpensesRoutingModule } from './depot-expenses-routing.module';
import { DepotExpensesComponent } from './depot-expenses.component';

@NgModule({
  declarations: [DepotExpensesComponent],
  imports: [
    CommonModule,
    FormsModule,
    DepotExpensesRoutingModule
  ]
})
export class DepotExpensesModule { }
