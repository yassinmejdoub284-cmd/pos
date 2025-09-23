import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ImagePreloadService {
  private imageCache = new Map<string, Promise<boolean>>();
  private preloadedImages = new Set<string>();

  constructor() {}

  /**
   * Preload a single image
   */
  preloadImage(src: string): Promise<boolean> {
    if (this.preloadedImages.has(src)) {
      return Promise.resolve(true);
    }

    if (this.imageCache.has(src)) {
      return this.imageCache.get(src)!;
    }

    const promise = new Promise<boolean>((resolve) => {
      const img = new Image();
      
      img.onload = () => {
        this.preloadedImages.add(src);
        resolve(true);
      };
      
      img.onerror = () => {
        resolve(false);
      };
      
      img.src = src;
    });

    this.imageCache.set(src, promise);
    return promise;
  }

  /**
   * Preload multiple images
   */
  preloadImages(srcs: string[]): Promise<boolean[]> {
    return Promise.all(srcs.map(src => this.preloadImage(src)));
  }

  /**
   * Preload images for the next page of products
   */
  preloadNextPageImages(products: any[], currentPage: number, productsPerPage: number): void {
    const nextPageStart = (currentPage + 1) * productsPerPage;
    const nextPageEnd = nextPageStart + productsPerPage;
    const nextPageProducts = products.slice(nextPageStart, nextPageEnd);
    
    const imageSrcs = nextPageProducts
      .filter(product => product.photo)
      .map(product => product.photo!)
      .filter((src): src is string => src !== undefined);
    
    if (imageSrcs.length > 0) {
      this.preloadImages(imageSrcs);
    }
  }

  /**
   * Preload images for the previous page of products
   */
  preloadPreviousPageImages(products: any[], currentPage: number, productsPerPage: number): void {
    if (currentPage === 0) return;
    
    const prevPageStart = (currentPage - 1) * productsPerPage;
    const prevPageEnd = prevPageStart + productsPerPage;
    const prevPageProducts = products.slice(prevPageStart, prevPageEnd);
    
    const imageSrcs = prevPageProducts
      .filter(product => product.photo)
      .map(product => product.photo!)
      .filter((src): src is string => src !== undefined);
    
    if (imageSrcs.length > 0) {
      this.preloadImages(imageSrcs);
    }
  }

  /**
   * Check if an image is already preloaded
   */
  isImagePreloaded(src: string): boolean {
    return this.preloadedImages.has(src);
  }

  /**
   * Clear the image cache (useful for memory management)
   */
  clearCache(): void {
    this.imageCache.clear();
    this.preloadedImages.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { cached: number; preloaded: number } {
    return {
      cached: this.imageCache.size,
      preloaded: this.preloadedImages.size
    };
  }
}
