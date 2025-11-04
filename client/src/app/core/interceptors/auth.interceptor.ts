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
  const token = authService.getToken();
  
  // Skip adding Authorization header for login and register endpoints
  const isAuthEndpoint = request.url.includes('/auth/login') || request.url.includes('/auth/register');
  
  if (!isAuthEndpoint) {
    const visitingDepotId = sessionStorage.getItem('visitingDepotId');
    const headers: Record<string, string> = {};
    
    // Always add Authorization header if token exists (even if empty, let server handle it)
    if (token && token.trim().length > 0) {
      headers['Authorization'] = `Bearer ${token.trim()}`;
    }
    
    if (visitingDepotId && visitingDepotId.trim().length > 0) {
      headers['X-Depot-Id'] = visitingDepotId.trim();
    }
    
    if (Object.keys(headers).length > 0) {
      request = request.clone({ setHeaders: headers });
    }
  }
  
  return next(request).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error && (error.status === 401 || error.status === 403)) {
        // Only logout if we actually had a token AND it's not a login/register endpoint
        // Also skip logout for auth endpoints to avoid loops
        const isAuthEndpoint = request.url.includes('/auth/login') || request.url.includes('/auth/register');
        if (!isAuthEndpoint) {
          const currentToken = authService.getToken();
          if (currentToken) {
            // Check if token is actually invalid by verifying it exists in sessionStorage
            const userStr = sessionStorage.getItem('user');
            // Only logout if we have both token and user (meaning we were authenticated)
            if (userStr) {
              // Token might be expired or invalid - clear session
              authService.logout();
              router.navigate(['/auth/login']);
            }
          }
        }
      }
      return throwError(() => error);
    })
  );
} 