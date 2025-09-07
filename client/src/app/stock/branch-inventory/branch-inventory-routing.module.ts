import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { BranchInventoryComponent } from './branch-inventory.component';

const routes: Routes = [
  {
    path: '',
    component: BranchInventoryComponent
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class BranchInventoryRoutingModule { }
