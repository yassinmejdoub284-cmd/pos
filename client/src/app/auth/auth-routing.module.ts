import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LoginComponent } from './login/login.component';
import { LoginHentatiComponent } from './login-hentati/login-hentati.component';
import { UnauthorizedComponent } from '../unauthorized/unauthorized.component';
import { UsersComponent } from './users/users.component';
import { LoginRedirectGuard } from '../core/guards/login-redirect.guard';

const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent, canActivate: [LoginRedirectGuard] },
  { path: 'login-hentati', component: LoginHentatiComponent, canActivate: [LoginRedirectGuard] },
  { path: 'unauthorized', component: UnauthorizedComponent },
  { path: 'users', component: UsersComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AuthRoutingModule { }
