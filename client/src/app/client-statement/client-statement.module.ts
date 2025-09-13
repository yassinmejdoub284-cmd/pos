import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { ClientStatementComponent } from './client-statement.component';

const routes: Routes = [
  { path: '', component: ClientStatementComponent }
];

@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    RouterModule.forChild(routes),
    ClientStatementComponent
  ]
})
export class ClientStatementModule { }
