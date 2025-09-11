import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { ClientGrosRoutingModule } from './client-gros-routing.module';
import { ClientGrosComponent } from './client-gros.component';
import { CustomerSelectionDialogComponent } from './customer-selection-dialog/customer-selection-dialog.component';

@NgModule({
  declarations: [
    ClientGrosComponent,
    CustomerSelectionDialogComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    ClientGrosRoutingModule
  ]
})
export class ClientGrosModule { }
