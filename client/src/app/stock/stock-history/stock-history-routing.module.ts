import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { StockHistoryComponent } from './stock-history.component';

const routes: Routes = [
  { path: '', component: StockHistoryComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class StockHistoryRoutingModule { }
