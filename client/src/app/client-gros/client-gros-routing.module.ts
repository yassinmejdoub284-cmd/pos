import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ClientGrosComponent } from './client-gros.component';

const routes: Routes = [
  { path: '', component: ClientGrosComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ClientGrosRoutingModule { }
