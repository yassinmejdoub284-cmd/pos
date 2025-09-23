import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';

import { EntryOptionsComponent } from './entry-options.component';

const routes: Routes = [
  { path: '', component: EntryOptionsComponent }
];

@NgModule({
  declarations: [
    EntryOptionsComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    RouterModule.forChild(routes)
  ]
})
export class EntryOptionsModule { }
