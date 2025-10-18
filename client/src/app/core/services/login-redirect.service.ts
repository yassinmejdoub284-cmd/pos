import { Injectable } from '@angular/core';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class LoginRedirectService {

  constructor(private router: Router) {}

  /**
   * Checks if the current URL should redirect to the Hentati login theme
   * @returns true if should use Hentati theme, false for default theme
   */
  shouldUseHentatiTheme(): boolean {
    const currentUrl = window.location.href;
    const hostname = window.location.hostname;
    const port = window.location.port;
    
    // Check for hentati.solumove.net domain
    if (hostname === 'hentati.solumove.net') {
      return true;
    }
    
    // Check for :4999 port (any hostname with port 4999)
    if (port === '4999') {
      return true;
    }
    
    // Check if URL contains :4999 anywhere (for cases like https://10.15.10.26:4999)
    if (currentUrl.includes(':4999')) {
      return true;
    }
    
    return false;
  }

  /**
   * Redirects to the appropriate login page based on URL conditions
   */
  redirectToAppropriateLogin(): void {
    if (this.shouldUseHentatiTheme()) {
      this.router.navigate(['/auth/login-hentati']);
    } else {
      this.router.navigate(['/auth/login']);
    }
  }

  /**
   * Gets the appropriate login route based on URL conditions
   * @returns the login route path
   */
  getLoginRoute(): string {
    return this.shouldUseHentatiTheme() ? '/auth/login-hentati' : '/auth/login';
  }
}
