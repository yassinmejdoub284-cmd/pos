import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import { DailyMonthlyComponent } from './daily-monthly.component';

const routes: Routes = [
  { path: '', component: DailyMonthlyComponent }
];

@NgModule({
  declarations: [
    DailyMonthlyComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    RouterModule.forChild(routes)
  ]
})
export class DailyMonthlyModule { }
