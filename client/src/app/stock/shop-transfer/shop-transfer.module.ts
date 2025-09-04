import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ShopTransferComponent } from './shop-transfer.component';
import { ShopTransferRoutingModule } from './shop-transfer-routing.module';

@NgModule({
  declarations: [
    ShopTransferComponent
  ],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    ShopTransferRoutingModule
  ],
  exports: [
    ShopTransferComponent
  ]
})
export class ShopTransferModule { }
