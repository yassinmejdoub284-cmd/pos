import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { BranchInventoryComponent } from './branch-inventory.component';
import { BranchInventoryRoutingModule } from './branch-inventory-routing.module';

@NgModule({
  declarations: [
    BranchInventoryComponent
  ],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    RouterModule,
    BranchInventoryRoutingModule
  ],
  exports: [
    BranchInventoryComponent
  ]
})
export class BranchInventoryModule { }
