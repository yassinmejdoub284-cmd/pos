import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import { SalesByCategoryComponent } from './sales-by-category.component';

const routes: Routes = [
  { path: '', component: SalesByCategoryComponent }
];

@NgModule({
  declarations: [
    SalesByCategoryComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    RouterModule.forChild(routes)
  ]
})
export class SalesByCategoryModule { }
