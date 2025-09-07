import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import { CreditSalesComponent } from './credit-sales.component';

const routes: Routes = [
  { path: '', component: CreditSalesComponent }
];

@NgModule({
  declarations: [
    CreditSalesComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    RouterModule.forChild(routes)
  ]
})
export class CreditSalesModule { }
