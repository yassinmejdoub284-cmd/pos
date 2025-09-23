import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';

import { DepotSelectionComponent } from './depot-selection.component';

const routes: Routes = [
  { path: '', component: DepotSelectionComponent }
];

@NgModule({
  declarations: [
    DepotSelectionComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    RouterModule.forChild(routes)
  ]
})
export class DepotSelectionModule { }
