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
  if (token && !request.url.includes('/auth/login') && !request.url.includes('/auth/register')) {
    const visitingDepotId = sessionStorage.getItem('visitingDepotId');
    const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
    if (visitingDepotId) {
      headers['X-Depot-Id'] = visitingDepotId;
    }
    request = request.clone({ setHeaders: headers });
  }
  
  return next(request).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error && (error.status === 401 || error.status === 403)) {
        authService.logout();
        router.navigate(['/auth/login']);
      }
      return throwError(() => error);
    })
  );
} 