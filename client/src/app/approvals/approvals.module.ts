import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { ApprovalsRoutingModule } from './approvals-routing.module';
import { ApprovalsComponent } from './approvals.component';
import { ApprovalsHistoryComponent } from './approvals-history.component';

@NgModule({
  declarations: [ApprovalsComponent, ApprovalsHistoryComponent],
  imports: [
    CommonModule,
    FormsModule,
    ApprovalsRoutingModule
  ]
})
export class ApprovalsModule { }
