import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { PrepareLotComponent } from './prepare-lot.component';

const routes: Routes = [
  { path: '', component: PrepareLotComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class PrepareLotRoutingModule { }

