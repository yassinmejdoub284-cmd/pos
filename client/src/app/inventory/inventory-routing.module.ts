import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { InventoryComponent } from './inventory.component';
import { CountComponent } from './count/count.component';
import { ReviewComponent } from './review/review.component';
import { SummaryComponent } from './summary/summary.component';

const routes: Routes = [
  { path: '', component: InventoryComponent },
  { path: ':id/count', component: CountComponent },
  { path: ':id/review', component: ReviewComponent },
  { path: ':id/summary', component: SummaryComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class InventoryRoutingModule { }
