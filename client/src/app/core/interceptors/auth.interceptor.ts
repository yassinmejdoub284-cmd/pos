import { HttpRequest, HttpHandlerFn, HttpEvent, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, throwError } from 'rxjs';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { Router } from '@angular/router';

export function authInterceptor(
  request: HttpRequest<unknown>, 
  next: HttpHandlerFn
): Observable<HttpEvent<unknown>> {
  const authService = inject(AuthService);
  const router = inject(Router);
  
  // Log all requests for debugging

  
  // Skip adding Authorization header for login and register endpoints
  const isAuthEndpoint = request.url.includes('/auth/login') || request.url.includes('/auth/register');
  
  if (!isAuthEndpoint) {

    const visitingDepotId = sessionStorage.getItem('visitingDepotId');
    const headers: Record<string, string> = {};
    
    // Try multiple methods to get the token
    let authToken = authService.getToken();
    if (!authToken) {
      authToken = sessionStorage.getItem('token');
    }
    if (!authToken) {
      authToken = localStorage.getItem('token');
    }
    
    if (authToken && authToken.trim().length > 0) {
      headers['Authorization'] = `Bearer ${authToken.trim()}`;
      // Debug log to verify token is being added



    } else {
      // Log detailed warning if no token found for debugging
      console.error('[AuthInterceptor] No authentication token found for authenticated endpoint:', request.url);
      console.error('[AuthInterceptor] Token sources checked:', {
        authService: !!authService.getToken(),
        sessionStorage: !!sessionStorage.getItem('token'),
        localStorage: !!localStorage.getItem('token'),
        userInSession: !!sessionStorage.getItem('user')
      });
      console.error('[AuthInterceptor] Full URL:', request.url);
      console.error('[AuthInterceptor] Request method:', request.method);
    }
    
    if (visitingDepotId && visitingDepotId.trim().length > 0) {
      headers['X-Depot-Id'] = visitingDepotId.trim();

    }
    
    // Always clone request with headers if we have any headers to add
    // This ensures X-Depot-Id header is added even if no token
    if (Object.keys(headers).length > 0) {

      request = request.clone({ setHeaders: headers });
    } else {
      console.warn('[AuthInterceptor] No headers to add for request:', request.url);
    }
  } else {

  }
  
  return next(request).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error && (error.status === 401 || error.status === 403)) {
        // Skip logout for auth endpoints to avoid loops
        const isAuthEndpoint = request.url.includes('/auth/login') || request.url.includes('/auth/register');
        
        // Skip auto-logout for certain endpoints that should handle errors themselves
        const isReportEndpoint = request.url.includes('/reports/') || request.url.includes('/article-extracts');
        
        if (!isAuthEndpoint && !isReportEndpoint) {
          // Only logout for other endpoints if we actually had a token
          const currentToken = authService.getToken();
          if (currentToken) {
            // Check if token is actually invalid by verifying it exists in sessionStorage
            const userStr = sessionStorage.getItem('user');
            // Only logout if we have both token and user (meaning we were authenticated)
            if (userStr) {
              console.warn('[AuthInterceptor] 401/403 error - logging out user');
              // Token might be expired or invalid - clear session
              authService.logout();
              router.navigate(['/auth/login']);
            }
          }
        } else if (isReportEndpoint) {
          // For report endpoints, just log the error but don't logout
          // Let the component handle the error (it might be a permission issue, not auth issue)
          console.warn('[AuthInterceptor] 401/403 error on report endpoint - letting component handle it:', request.url);
        }
      }
      return throwError(() => error);
    })
  );
} 