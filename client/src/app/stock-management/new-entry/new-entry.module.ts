import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';

import { NewEntryComponent } from './new-entry.component';

const routes: Routes = [
  { path: '', component: NewEntryComponent }
];

@NgModule({
  declarations: [
    NewEntryComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule.forChild(routes)
  ]
})
export class NewEntryModule { }
