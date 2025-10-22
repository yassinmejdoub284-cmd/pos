import { Injectable, signal, computed } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class LoadingService {
  private activeRequests = signal<Set<string>>(new Set());
  
  // Computed signal that returns true if there are any active requests
  public isLoading = computed(() => this.activeRequests().size > 0);
  
  // Computed signal that returns the count of active requests
  public activeRequestCount = computed(() => this.activeRequests().size);

  /**
   * Start loading for a specific request
   * @param requestId - Unique identifier for the request
   */
  startLoading(requestId: string): void {
    this.activeRequests.update(requests => {
      const newSet = new Set(requests);
      newSet.add(requestId);
      return newSet;
    });
  }

  /**
   * Stop loading for a specific request
   * @param requestId - Unique identifier for the request
   */
  stopLoading(requestId: string): void {
    this.activeRequests.update(requests => {
      const newSet = new Set(requests);
      newSet.delete(requestId);
      return newSet;
    });
  }

  /**
   * Clear all active requests (useful for error scenarios)
   */
  clearAll(): void {
    this.activeRequests.set(new Set());
  }

  /**
   * Generate a unique request ID based on URL and method
   * @param url - Request URL
   * @param method - HTTP method
   * @returns Unique request identifier
   */
  generateRequestId(url: string, method: string): string {
    return `${method.toUpperCase()}_${url}`;
  }
}


