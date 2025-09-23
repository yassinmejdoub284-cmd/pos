import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';

import { ImportEntryComponent } from './import-entry.component';

const routes: Routes = [
  { path: '', component: ImportEntryComponent }
];

@NgModule({
  declarations: [
    ImportEntryComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule.forChild(routes)
  ]
})
export class ImportEntryModule { }
