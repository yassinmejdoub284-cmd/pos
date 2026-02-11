import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { ClientStatementComponent } from './client-statement.component';
import { ClientStatementDetailComponent } from './client-statement-detail/client-statement-detail.component';

const routes: Routes = [
  { path: '', component: ClientStatementComponent },
  { path: ':id', component: ClientStatementDetailComponent }
];

@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    RouterModule.forChild(routes),
    ClientStatementComponent,
    ClientStatementDetailComponent
  ]
})
export class ClientStatementModule { }
