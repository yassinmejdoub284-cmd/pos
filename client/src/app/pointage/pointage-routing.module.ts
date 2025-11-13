import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { PointageComponent } from './pointage.component';
import { PointageHistoryComponent } from './pointage-history.component';

const routes: Routes = [
  { path: '', component: PointageComponent },
  { path: 'history', component: PointageHistoryComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class PointageRoutingModule {}


