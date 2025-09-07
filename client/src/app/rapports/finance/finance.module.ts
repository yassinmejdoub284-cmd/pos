import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import { FinanceComponent } from './finance.component';

const routes: Routes = [
  { path: '', component: FinanceComponent }
];

@NgModule({
  declarations: [
    FinanceComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    RouterModule.forChild(routes)
  ]
})
export class FinanceModule { }
