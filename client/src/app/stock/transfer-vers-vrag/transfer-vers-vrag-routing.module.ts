import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { TransferVersVragComponent } from './transfer-vers-vrag.component';
import { TransferHistoryComponent } from './transfer-history/transfer-history.component';

const routes: Routes = [
  { path: '', component: TransferVersVragComponent },
  { path: 'history', component: TransferHistoryComponent },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class TransferVersVragRoutingModule { }

