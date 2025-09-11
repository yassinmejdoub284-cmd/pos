import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ClientActionDialogComponent } from './client-action-dialog/client-action-dialog.component';

@NgModule({
  declarations: [
    ClientActionDialogComponent
  ],
  imports: [
    CommonModule
  ],
  exports: [
    ClientActionDialogComponent
  ]
})
export class SharedModule { }
