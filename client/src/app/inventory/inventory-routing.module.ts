import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { CountComponent } from './count/count.component';
import { ReviewComponent } from './review/review.component';
import { SummaryComponent } from './summary/summary.component';
import { InventoryComponent } from './inventory.component';
import { InventoryBalanceComponent } from './inventory-balance/inventory-balance.component';

const routes: Routes = [
  { path: '', component: InventoryComponent },
  { path: ':depotId', component: InventoryComponent },
  { path: ':depotId/:id/count', component: CountComponent },
  { path: ':depotId/:id/review', component: ReviewComponent },
  { path: ':depotId/:id/summary', component: SummaryComponent },
  { path: 'balance', component: InventoryBalanceComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class InventoryRoutingModule { }
