import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import { SuppliersComponent } from './suppliers.component';

const routes: Routes = [
  { path: '', component: SuppliersComponent }
];

@NgModule({
  declarations: [
    SuppliersComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    RouterModule.forChild(routes)
  ]
})
export class SuppliersModule { }
