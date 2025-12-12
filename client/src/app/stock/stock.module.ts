import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { StockRoutingModule } from './stock-routing.module';
import { StockComponent } from './stock.component';
import { DocumentSelectionDialogComponent } from './document-selection-dialog/document-selection-dialog.component';
import { StockDocumentActionDialogComponent } from '../shared/stock-document-action-dialog/stock-document-action-dialog.component';
import { MessageDialogComponent } from '../shared/message-dialog/message-dialog.component';

@NgModule({
  declarations: [
    StockComponent,
    DocumentSelectionDialogComponent
  ],
  imports: [
    CommonModule,
    StockRoutingModule,
    FormsModule,
    StockDocumentActionDialogComponent,
    MessageDialogComponent,
  ]
})
export class StockModule { }
