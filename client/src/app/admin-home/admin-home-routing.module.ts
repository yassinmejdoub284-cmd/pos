import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AdminHomeComponent } from './admin-home.component';
import { RoleGuard } from '../core/guards/role.guard';

const routes: Routes = [
  {
    path: '',
    component: AdminHomeComponent,
    canActivate: [RoleGuard],
    data: { roles: ['ADMIN', 'SUPER_ADMIN'] }
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AdminHomeRoutingModule {}

