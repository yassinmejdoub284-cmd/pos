import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { ApprovalsRoutingModule } from './approvals-routing.module';
import { ApprovalsComponent } from './approvals.component';

@NgModule({
  declarations: [ApprovalsComponent],
  imports: [
    CommonModule,
    FormsModule,
    ApprovalsRoutingModule
  ]
})
export class ApprovalsModule { }
