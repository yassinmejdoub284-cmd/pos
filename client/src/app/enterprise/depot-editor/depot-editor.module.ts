import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { DepotEditorComponent } from './depot-editor.component';
import { DepotEditorRoutingModule } from './depot-editor-routing.module';

@NgModule({
  declarations: [DepotEditorComponent],
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule, DepotEditorRoutingModule]
})
export class DepotEditorModule {}



