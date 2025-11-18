import { CanActivateFn, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = (route: ActivatedRouteSnapshot, state: RouterStateSnapshot) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Check token in sessionStorage first (most reliable source of truth)
  const token = sessionStorage.getItem('token');
  const userStr = sessionStorage.getItem('user');
  
  console.log('[AuthGuard] Checking authentication for:', state.url);
  console.log('[AuthGuard] Token exists:', !!token);
  console.log('[AuthGuard] User exists:', !!userStr);
  
  // If we have a valid token and user in storage, allow access
  // This is the most reliable check - sessionStorage persists across refreshes
  if (token && token.trim().length > 0 && userStr) {
    try {
      // Verify user data is valid JSON
      const user = JSON.parse(userStr);
      
      // Ensure signals are set (refresh auth state if needed)
      const isAuthenticated = authService.isAuthenticated();
      const currentUser = authService.currentUser();
      
      if (!isAuthenticated || !currentUser) {
        console.log('[AuthGuard] Restoring auth state from sessionStorage');
        // Reload auth state into signals
        const permissionsStr = sessionStorage.getItem('permissions');
        const permissions = permissionsStr ? JSON.parse(permissionsStr) : null;
        
        authService.currentUser.set(user);
        authService.isAuthenticated.set(true);
        
        // Try to update subjects if accessible (non-critical)
        try {
          const service = authService as any;
          if (service.currentUserSubject) {
            service.currentUserSubject.next(user);
          }
          if (service.permissionsSubject && permissions) {
            service.permissionsSubject.next(permissions);
          }
        } catch (e) {
          // Subjects are private, but signals are set, so continue
          console.warn('[AuthGuard] Could not update subjects:', e);
        }
      }
      
      console.log('[AuthGuard] Authentication successful, allowing access');
      // Allow access - we have valid token and user
      return true;
    } catch (error) {
      console.error('[AuthGuard] Error parsing stored auth data:', error);
      // If parsing fails, clear corrupted data
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('user');
      sessionStorage.removeItem('permissions');
    }
  }
  
  // Also check service signals as fallback (in case sessionStorage check missed something)
  const isAuthenticated = authService.isAuthenticated();
  const currentUser = authService.currentUser();
  
  if (isAuthenticated && currentUser) {
    console.log('[AuthGuard] Authentication successful via signals, allowing access');
    return true;
  }

  // Not authenticated - redirect to login
  console.warn('[AuthGuard] Not authenticated, redirecting to login');
  const currentUrl = state.url || router.url || '';
  if (!currentUrl.includes('/auth/login')) {
    // Store the intended URL for redirect after login
    const returnUrl = currentUrl !== '/' ? currentUrl : undefined;
    router.navigate(['/auth/login'], returnUrl ? { queryParams: { returnUrl } } : {});
  }
  return false;
};
