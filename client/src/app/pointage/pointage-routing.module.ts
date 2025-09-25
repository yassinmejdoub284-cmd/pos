import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { PointageHistoryComponent } from './pointage-history.component';

const routes: Routes = [
  { path: '', component: PointageHistoryComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class PointageRoutingModule {}


