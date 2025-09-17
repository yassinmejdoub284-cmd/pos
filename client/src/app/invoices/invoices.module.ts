import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { InvoicesRoutingModule } from './invoices-routing.module';
import { InvoicesComponent } from './invoices.component';

@NgModule({
  declarations: [
    InvoicesComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    InvoicesRoutingModule
  ]
})
export class InvoicesModule { }
