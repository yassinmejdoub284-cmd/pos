import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { PointageRoutingModule } from './pointage-routing.module';
import { PointageHistoryComponent } from './pointage-history.component';
import { SharedModule } from '../shared/shared.module';

@NgModule({
  declarations: [PointageHistoryComponent],
  imports: [CommonModule, FormsModule, RouterModule, PointageRoutingModule, SharedModule]
})
export class PointageModule {}


