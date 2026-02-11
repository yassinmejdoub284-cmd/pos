import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminHomeComponent } from './admin-home.component';
import { AdminHomeRoutingModule } from './admin-home-routing.module';
import { BaseChartDirective } from 'ng2-charts';

@NgModule({
  declarations: [
    AdminHomeComponent
  ],
  imports: [
    CommonModule,
    AdminHomeRoutingModule,
    BaseChartDirective
  ]
})
export class AdminHomeModule { }
