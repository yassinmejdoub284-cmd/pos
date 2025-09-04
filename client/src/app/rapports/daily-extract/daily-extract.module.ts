import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { HttpClientModule } from '@angular/common/http';
import { DailyExtractComponent } from './daily-extract.component';
import { DailyExtractService } from '../../core/services/daily-extract.service';

const routes: Routes = [
  { path: '', component: DailyExtractComponent }
];

@NgModule({
  declarations: [
    DailyExtractComponent
  ],
  imports: [
    CommonModule,
    HttpClientModule,
    RouterModule.forChild(routes)
  ],
  providers: [
    DailyExtractService
  ]
})
export class DailyExtractModule { }
