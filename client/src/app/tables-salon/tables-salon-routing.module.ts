import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { TablesSalonComponent } from './tables-salon.component';

const routes: Routes = [
  {
    path: '',
    component: TablesSalonComponent
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class TablesSalonRoutingModule { }
