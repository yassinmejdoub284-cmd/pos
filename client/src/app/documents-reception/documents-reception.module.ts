import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DocumentsReceptionRoutingModule } from './documents-reception-routing.module';
import { DocumentsReceptionComponent } from './documents-reception.component';

@NgModule({
  declarations: [DocumentsReceptionComponent],
  imports: [CommonModule, FormsModule, DocumentsReceptionRoutingModule]
})
export class DocumentsReceptionModule {}


