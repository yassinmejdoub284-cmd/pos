import { Injectable } from '@angular/core';
import { CanActivate, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { LoginRedirectService } from '../services/login-redirect.service';

@Injectable({
  providedIn: 'root'
})
export class LoginRedirectGuard implements CanActivate {

  constructor(
    private router: Router,
    private loginRedirectService: LoginRedirectService
  ) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): boolean {
    // Check if we're trying to access the default login route
    if (state.url === '/auth/login') {
      // If we should use Hentati theme, redirect to Hentati login
      if (this.loginRedirectService.shouldUseHentatiTheme()) {
        this.router.navigate(['/auth/login-hentati']);
        return false;
      }
    }
    
    // Check if we're trying to access the Hentati login route
    if (state.url === '/auth/login-hentati') {
      // If we should NOT use Hentati theme, redirect to default login
      if (!this.loginRedirectService.shouldUseHentatiTheme()) {
        this.router.navigate(['/auth/login']);
        return false;
      }
    }
    
    // Allow access to the appropriate login page
    return true;
  }
}
