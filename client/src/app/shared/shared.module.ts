import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ClientActionDialogComponent } from './client-action-dialog/client-action-dialog.component';
import { SupplierActionDialogComponent } from './supplier-action-dialog/supplier-action-dialog.component';

@NgModule({
  declarations: [
    ClientActionDialogComponent,
    SupplierActionDialogComponent
  ],
  imports: [
    CommonModule
  ],
  exports: [
    ClientActionDialogComponent,
    SupplierActionDialogComponent
  ]
})
export class SharedModule { }
