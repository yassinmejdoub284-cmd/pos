import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import { InvoiceExtractsComponent } from './invoice-extracts.component';

const routes: Routes = [
  { path: '', component: InvoiceExtractsComponent }
];

@NgModule({
  declarations: [
    InvoiceExtractsComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    RouterModule.forChild(routes)
  ]
})
export class InvoiceExtractsModule { }
