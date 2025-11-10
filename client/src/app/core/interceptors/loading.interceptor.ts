import { HttpRequest, HttpHandlerFn, HttpEvent, HttpErrorResponse } from '@angular/common/http';
import { Observable, finalize, catchError, throwError } from 'rxjs';
import { inject } from '@angular/core';
import { LoadingService } from '../services/loading.service';

export function loadingInterceptor(
  request: HttpRequest<unknown>, 
  next: HttpHandlerFn
): Observable<HttpEvent<unknown>> {
  const loadingService = inject(LoadingService);
  
  // Generate unique request ID
  const requestId = loadingService.generateRequestId(request.url, request.method);
  
  // Skip loading for certain requests if needed (optional)
  const skipLoading = shouldSkipLoading(request);
  
  if (!skipLoading) {
    // Start loading
    loadingService.startLoading(requestId);
  }
  
  return next(request).pipe(
    finalize(() => {
      // Always stop loading when request completes (success or error)
      if (!skipLoading) {
        loadingService.stopLoading(requestId);
      }
    }),
    catchError((error: HttpErrorResponse) => {
      // Handle errors but don't prevent loading from stopping
      return throwError(() => error);
    })
  );
}

/**
 * Determine if loading should be skipped for this request
 * @param request - HTTP request
 * @returns true if loading should be skipped
 */
function shouldSkipLoading(request: HttpRequest<unknown>): boolean {
  // Skip loading for certain endpoints that are very fast or not user-facing
  const skipPatterns = [
    '/health',
    '/ping',
    '/status',
    '/active-by-depot',  // Skip for frequently polled session endpoint
    '/sessions/active-by-depot'  // Alternative path format
  ];
  
  // Skip loading for requests with specific headers
  if (request.headers.has('X-Skip-Loading')) {
    return true;
  }
  
  // Skip loading for certain URL patterns
  return skipPatterns.some(pattern => request.url.includes(pattern));
}
