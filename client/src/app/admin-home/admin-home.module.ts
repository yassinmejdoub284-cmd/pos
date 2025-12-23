import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminHomeComponent } from './admin-home.component';
import { AdminHomeRoutingModule } from './admin-home-routing.module';

@NgModule({
  declarations: [
    AdminHomeComponent
  ],
  imports: [
    CommonModule,
    AdminHomeRoutingModule
  ]
})
export class AdminHomeModule {}

