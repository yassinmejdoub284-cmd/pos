import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class FullscreenService {
  private _isFullscreen = signal(false);
  private _isSupported = signal(false);

  constructor() {
    this.checkSupport();
    this.setupEventListeners();
    this.loadFullscreenState();
  }

  get isFullscreen() {
    return this._isFullscreen.asReadonly();
  }

  get isSupported() {
    return this._isSupported.asReadonly();
  }

  private checkSupport(): void {
    const isSupported = !!(
      document.fullscreenEnabled ||
      (document as any).webkitFullscreenEnabled ||
      (document as any).mozFullScreenEnabled ||
      (document as any).msFullscreenEnabled
    );
    this._isSupported.set(isSupported);
  }

  private setupEventListeners(): void {
    // Listen for fullscreen change events
    const events = [
      'fullscreenchange',
      'webkitfullscreenchange',
      'mozfullscreenchange',
      'MSFullscreenChange'
    ];

    events.forEach(event => {
      document.addEventListener(event, () => {
        this.updateFullscreenState();
      });
    });

    // Listen for escape key to exit fullscreen
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && this._isFullscreen()) {
        this.exitFullscreen();
      }
    });
  }

  private updateFullscreenState(): void {
    const isFullscreen = !!(
      document.fullscreenElement ||
      (document as any).webkitFullscreenElement ||
      (document as any).mozFullScreenElement ||
      (document as any).msFullscreenElement
    );
    
    this._isFullscreen.set(isFullscreen);
    this.saveFullscreenState(isFullscreen);
  }

  private saveFullscreenState(isFullscreen: boolean): void {
    try {
      localStorage.setItem('pos-fullscreen-preference', JSON.stringify(isFullscreen));
    } catch (error) {
      console.warn('Could not save fullscreen preference:', error);
    }
  }

  private loadFullscreenState(): void {
    try {
      const saved = localStorage.getItem('pos-fullscreen-preference');
      if (saved) {
        const isFullscreen = JSON.parse(saved);
        if (isFullscreen && this._isSupported()) {
          // Auto-enter fullscreen if user previously chose it
          setTimeout(() => this.enterFullscreen(), 100);
        }
      }
    } catch (error) {
      console.warn('Could not load fullscreen preference:', error);
    }
  }

  async enterFullscreen(): Promise<boolean> {
    if (!this._isSupported()) {
      console.warn('Fullscreen is not supported');
      return false;
    }

    try {
      const element = document.documentElement;
      
      if (element.requestFullscreen) {
        await element.requestFullscreen();
      } else if ((element as any).webkitRequestFullscreen) {
        await (element as any).webkitRequestFullscreen();
      } else if ((element as any).mozRequestFullScreen) {
        await (element as any).mozRequestFullScreen();
      } else if ((element as any).msRequestFullscreen) {
        await (element as any).msRequestFullscreen();
      } else {
        console.warn('Fullscreen API not available');
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error entering fullscreen:', error);
      return false;
    }
  }

  async exitFullscreen(): Promise<boolean> {
    if (!this._isFullscreen()) {
      return true;
    }

    try {
      if (document.exitFullscreen) {
        await document.exitFullscreen();
      } else if ((document as any).webkitExitFullscreen) {
        await (document as any).webkitExitFullscreen();
      } else if ((document as any).mozCancelFullScreen) {
        await (document as any).mozCancelFullScreen();
      } else if ((document as any).msExitFullscreen) {
        await (document as any).msExitFullscreen();
      } else {
        console.warn('Exit fullscreen API not available');
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error exiting fullscreen:', error);
      return false;
    }
  }

  async toggleFullscreen(): Promise<boolean> {
    if (this._isFullscreen()) {
      return await this.exitFullscreen();
    } else {
      return await this.enterFullscreen();
    }
  }

  // Method to force fullscreen on app startup (can be called from app component)
  async requestFullscreenOnStartup(): Promise<void> {
    if (this._isSupported()) {
      const saved = localStorage.getItem('pos-fullscreen-preference');
      if (saved) {
        const isFullscreen = JSON.parse(saved);
        if (isFullscreen) {
          // Small delay to ensure DOM is ready
          setTimeout(() => this.enterFullscreen(), 500);
        }
      }
    }
  }
}
