import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { ClientPaymentsComponent } from './client-payments.component';

const routes: Routes = [
  { path: '', component: ClientPaymentsComponent }
];

@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    RouterModule.forChild(routes),
    ClientPaymentsComponent
  ]
})
export class ClientPaymentsModule { }
