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

// Direct mapping by companyId for cross-device persistence
const COMPANY_THEME_MAP: Record<number, LoginTheme> = {
  1: {
    companyId: 1,
    logoUrl: '/logo_sfax.webp',
    primaryColor: '#662c94',
    secondaryColor: '#1E3A8A',
    faviconUrl: '/favicon.ico'
  },
  2: {
    companyId: 2,
    logoUrl: '/logo_tunis.webp',
    primaryColor: '#569797',
    secondaryColor: '#7C2D12',
    faviconUrl: '/favicon.ico'
  }
};

const DEFAULT_THEME: LoginTheme = {
  companyId: 0,
  logoUrl: '/logo_default.webp',
  primaryColor: '#7289da',
  secondaryColor: '#424549',
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
    // Only use last selected company; allow depot-based override stored during login
    // Prefer depot selection's company mapping if present
    const storedCompanyIdRaw = localStorage.getItem('lastCompanyId') || '';
    const storedCompanyId = Number(storedCompanyIdRaw);
    
    if (!Number.isNaN(storedCompanyId) && storedCompanyId > 0) {
      const companyTheme = COMPANY_THEME_MAP[storedCompanyId];
      if (companyTheme) {
        this.themeSignal.set(companyTheme);
        this.applyFaviconForLogin();
        return;
      }
    }
    // Fallback to default theme (logo_default.webp)
    this.themeSignal.set(DEFAULT_THEME);
    this.applyFaviconForLogin();
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

  // Allow other parts of the app (e.g., after login) to record the chosen company
  setLastCompanyId(companyId: number): void {
    if (typeof companyId === 'number' && companyId > 0) {
      localStorage.setItem('lastCompanyId', String(companyId));
      const theme = COMPANY_THEME_MAP[companyId] ?? {
        ...DEFAULT_THEME,
        companyId
      };
      this.themeSignal.set(theme);
      this.applyFaviconForLogin();
    }
  }

  clearLastCompany(): void {
    localStorage.removeItem('lastCompanyId');
    this.themeSignal.set(DEFAULT_THEME);
    this.applyFaviconForLogin();
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
