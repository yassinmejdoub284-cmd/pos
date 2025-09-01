import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ClotureComponent } from './cloture.component';

const routes: Routes = [
  { path: '', component: ClotureComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ClotureRoutingModule { }
