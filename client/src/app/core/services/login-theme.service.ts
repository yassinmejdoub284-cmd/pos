import { inject, Injectable, signal, Signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { SettingsService } from './settings.service';

export interface LoginTheme {
  companyId: number;
  companyName: string;
  logoUrl: string;
  primaryColor: string;
  secondaryColor: string;
  faviconUrl?: string;
}

// Single boutique Sfax — no multi-company routing needed
const THEME_MAP: Record<string, LoginTheme> = {};

const SFAX_THEME: LoginTheme = {
  companyId: 1,
  companyName: 'Samurai Food',
  logoUrl: '/logo_sfax.webp',
  primaryColor: '#662c94',
  secondaryColor: '#1E3A8A',
  faviconUrl: '/favicon.ico'
};

// Direct mapping by companyId — only company 1 (Sfax)
const COMPANY_THEME_MAP: Record<number, LoginTheme> = {
  1: SFAX_THEME
};

const DEFAULT_THEME: LoginTheme = SFAX_THEME;

@Injectable({ providedIn: 'root' })
export class LoginThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly themeSignal = signal<LoginTheme>(DEFAULT_THEME);
  private originalFaviconHref: string | null = null;

  get theme(): Signal<LoginTheme> {
    return this.themeSignal.asReadonly();
  }

  detectAndSetTheme(): void {
    // Le nom et le logo saisis dans Parametres > Entreprise priment sur le
    // theme par defaut. L'ecran de login ne pouvant pas interroger
    // /api/settings (route authentifiee), on relit la marque memorisee par
    // la derniere session ouverte sur ce poste.
    const branding = SettingsService.readBranding();
    this.themeSignal.set({
      ...SFAX_THEME,
      companyName: branding?.companyName || SFAX_THEME.companyName,
      logoUrl: branding?.logoUrl || SFAX_THEME.logoUrl
    });
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
