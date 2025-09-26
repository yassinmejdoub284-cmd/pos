import { inject, Injectable, signal, Signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';

export interface LoginTheme {
  companyId: number;
  logoUrl: string;
  primaryColor: string;
  secondaryColor: string;
  faviconUrl?: string;
}

const THEME_MAP: Record<string, LoginTheme> = {
  '192.168.1.22:4201': {
    companyId: 1,
    logoUrl: '/logo_sfax.webp',
    primaryColor: '#662c94',
    secondaryColor: '#1E3A8A',
    faviconUrl: '/favicon.ico'
  },
  '192.168.1.22:4200': {
    companyId: 2,
    logoUrl: '/logo_tunis.webp',
    primaryColor: '#569797',
    secondaryColor: '#7C2D12',
    faviconUrl: '/favicon.ico'
  }
};

const DEFAULT_THEME: LoginTheme = {
  companyId: 0,
  logoUrl: '/logo.webp',
  primaryColor: '#569797',
  secondaryColor: '#4a7d7d',
  faviconUrl: '/favicon.ico'
};

@Injectable({ providedIn: 'root' })
export class LoginThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly themeSignal = signal<LoginTheme>(DEFAULT_THEME);
  private originalFaviconHref: string | null = null;

  get theme(): Signal<LoginTheme> {
    return this.themeSignal.asReadonly();
  }

  detectAndSetTheme(): void {
    const { location } = this.document.defaultView ?? window;
    const key = `${location.hostname}:${location.port || (location.protocol === 'https:' ? '443' : '80')}`;
    const theme = THEME_MAP[key] ?? DEFAULT_THEME;
    this.themeSignal.set(theme);
  }

  applyFaviconForLogin(): void {
    const head = this.document.head;
    const linkEl = head.querySelector<HTMLLinkElement>("link[rel='icon']") || this.document.createElement('link');
    if (!linkEl.getAttribute('rel')) {
      linkEl.setAttribute('rel', 'icon');
      head.appendChild(linkEl);
    }
    if (this.originalFaviconHref == null) {
      this.originalFaviconHref = linkEl.getAttribute('href');
    }
    const { faviconUrl } = this.themeSignal();
    if (faviconUrl) {
      linkEl.setAttribute('href', faviconUrl);
    }
  }

  restoreOriginalFavicon(): void {
    if (this.originalFaviconHref == null) return;
    const head = this.document.head;
    const linkEl = head.querySelector<HTMLLinkElement>("link[rel='icon']");
    if (linkEl) {
      linkEl.setAttribute('href', this.originalFaviconHref);
    }
    this.originalFaviconHref = null;
  }
}
