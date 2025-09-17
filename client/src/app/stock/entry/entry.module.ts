import { NgModule } from '@angular/core';
import { CommonModule, NgOptimizedImage } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { EntryComponent } from './entry.component';
import { EntryRoutingModule } from './entry.routing';

@NgModule({
  declarations: [EntryComponent],
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule, EntryRoutingModule, NgOptimizedImage],
  exports: [EntryComponent]
})
export class EntryModule {}
