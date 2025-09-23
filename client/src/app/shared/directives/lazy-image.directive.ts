import { Directive, ElementRef, Input, OnInit, OnDestroy, inject } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';

@Directive({
  selector: '[appLazyImage]',
  standalone: true
})
export class LazyImageDirective implements OnInit, OnDestroy {
  @Input() appLazyImage: string = '';
  @Input() alt: string = '';
  @Input() fallbackSrc: string = '/assets/images/placeholder-product.svg';
  @Input() loadingSrc: string = '/assets/images/loading-placeholder.svg';

  private elementRef = inject(ElementRef);
  private observer?: IntersectionObserver;
  private isLoaded = false;

  ngOnInit(): void {
    this.setupIntersectionObserver();
  }

  ngOnDestroy(): void {
    if (this.observer) {
      this.observer.disconnect();
    }
  }

  private setupIntersectionObserver(): void {
    // Show loading placeholder initially
    this.showLoadingPlaceholder();

    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !this.isLoaded) {
            this.loadImage();
          }
        });
      },
      {
        rootMargin: '50px', // Start loading 50px before the image comes into view
        threshold: 0.1
      }
    );

    this.observer.observe(this.elementRef.nativeElement);
  }

  private showLoadingPlaceholder(): void {
    const img = this.elementRef.nativeElement as HTMLImageElement;
    img.src = this.loadingSrc;
    img.alt = this.alt;
    img.classList.add('animate-pulse', 'bg-gray-200');
  }

  private loadImage(): void {
    const img = this.elementRef.nativeElement as HTMLImageElement;
    
    // Create a new image to preload
    const preloadImg = new Image();
    
    preloadImg.onload = () => {
      // Image loaded successfully
      img.src = this.appLazyImage;
      img.classList.remove('animate-pulse', 'bg-gray-200');
      this.isLoaded = true;
      
      // Disconnect observer since image is loaded
      if (this.observer) {
        this.observer.disconnect();
      }
    };

    preloadImg.onerror = () => {
      // Image failed to load, show fallback
      img.src = this.fallbackSrc;
      img.classList.remove('animate-pulse', 'bg-gray-200');
      img.classList.add('opacity-60');
      this.isLoaded = true;
      
      // Disconnect observer
      if (this.observer) {
        this.observer.disconnect();
      }
    };

    // Start loading the actual image
    preloadImg.src = this.appLazyImage;
  }
}
