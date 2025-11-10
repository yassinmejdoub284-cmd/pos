import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { TransferVersVragComponent } from './transfer-vers-vrag.component';
import { TransferVersVragRoutingModule } from './transfer-vers-vrag-routing.module';
import { TransferHistoryComponent } from './transfer-history/transfer-history.component';
import { ProductsModule } from '../products/products.module';

@NgModule({
  declarations: [
    TransferVersVragComponent,
    TransferHistoryComponent
  ],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    RouterModule,
    TransferVersVragRoutingModule,
    ProductsModule
  ],
  exports: [
    TransferVersVragComponent
  ]
})
export class TransferVersVragModule { }

