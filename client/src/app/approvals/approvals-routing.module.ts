import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ApprovalsComponent } from './approvals.component';
import { ApprovalsHistoryComponent } from './approvals-history.component';

const routes: Routes = [
  { path: '', component: ApprovalsComponent },
  { path: 'history', component: ApprovalsHistoryComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ApprovalsRoutingModule { }
