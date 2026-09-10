import { Injectable } from '@angular/core';
import { HttpClient, HttpEvent, HttpEventType } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface AppSettings {
  id?: number;
  companyName?: string;
  logoUrl?: string;
  // Company details
  companyAddress?: string;
  companyPhone?: string;
  companyEmail?: string;
  companyRC?: string;
  companyMF?: string;
  loyaltyEnabled: boolean;
  loyaltyRate: number;
  maxDiscountPercent: number;
  defaultClientMaxDebt: number;
  keyboardShortcuts?: any;
  devicesConfig?: any;
  isDesktopVersion?: boolean;
  auditRetentionDays: number;
  // Clôture settings
  varianceThreshold: number;
  denominations: number[];
  requireApprovalForVariance: boolean;
  autoApproveExpenseBelow: number;
  allowNegativeStock?: boolean;
  // Historique
  historyRetentionDays?: number;
  // Role-based history limits
  roleHistoryLimits?: {
    ADMIN?: number;
    MANAGER?: number;
    CASHIER?: number;
    STOCK_MANAGER?: number;
  };
  // Print settings
  printSettings: {
    showLogo: boolean;
    logoSize: 'small' | 'medium' | 'large';
    dateFormat: 'dd/mm/yyyy' | 'mm/dd/yyyy' | 'yyyy-mm-dd';
    timeFormat: '12h' | '24h';
    currencySymbol: string;
    currencyPosition: 'before' | 'after';
    customTexts: {
      thankYouMessage: string;
      receiptTitle: string;
      companySlogan: string;
      footerMessage: string;
    };
    /** Nom imprime en tete de ticket (vide = nom de societe de l'application). */
    receiptCompanyName?: string;
    /** Ligne facultative sous le nom : point de vente, depot, succursale... */
    receiptDepotName?: string;
    showCompanyDetails: boolean;
    showClientInfo: boolean;
    showPaymentMethod: boolean;
    showDiscountDetails: boolean;
    doubleImpression: boolean;
  };
  // Document display settings
  documentDisplaySettings: {
    livraison: {
      showPackageCount: boolean; // true = show "X colis", false = show children names
    };
    sortie: {
      showPackageCount: boolean;
    };
    transfert: {
      showPackageCount: boolean;
    };
    facture: {
      showPackageCount: boolean;
      timbrePrice: number; // Fiscal stamp price in DT
    };
  };
  // Document type defaults
  documentTypeDefaults: {
    livraison: {
      client: boolean;
      depot: boolean;
      vehicle: boolean;
      driver: boolean;
      manualDestination: boolean;
      autoInvoice: boolean;
      tvaAndPrix: boolean;
      validity: boolean;
    };
    sortie: {
      client: boolean;
      depot: boolean;
      vehicle: boolean;
      driver: boolean;
      manualDestination: boolean;
      autoInvoice: boolean;
      tvaAndPrix: boolean;
      validity: boolean;
    };
    transfert: {
      client: boolean;
      depot: boolean;
      vehicle: boolean;
      driver: boolean;
      manualDestination: boolean;
      autoInvoice: boolean;
      tvaAndPrix: boolean;
      validity: boolean;
    };
    facture: {
      client: boolean;
      depot: boolean;
      vehicle: boolean;
      driver: boolean;
      manualDestination: boolean;
      autoInvoice: boolean;
      tvaAndPrix: boolean;
      validity: boolean;
    };
  };
  // Role-based home access configuration
  roleAccessConfig?: {
    [role in 'ADMIN' | 'MANAGER' | 'CASHIER' | 'STOCK_MANAGER']?: {
      blocks: {
        [blockId: string]: {
          visible: boolean;
          submodules?: { [subId: string]: boolean };
        };
      };
    };
  };
}

@Injectable({
  providedIn: 'root'
})
export class SettingsService {
  private readonly API_URL = `${environment.apiUrl}/settings`;
  private readonly BASE_URL = environment.production 
    ? 'https://patisserie.solumove.net' 
    : environment.apiUrl.replace('/api', '');

  /** Cle de cache navigateur pour la marque (nom + logo). */
  private static readonly BRANDING_KEY = 'app_branding';

  /** Derniers parametres connus : toute page abonnee se met a jour toute seule. */
  private readonly settingsSubject = new BehaviorSubject<AppSettings | null>(null);

  constructor(private http: HttpClient) {}

  /** Flux des parametres : emet a chaque chargement et a chaque sauvegarde. */
  get settingsChanges(): Observable<AppSettings | null> {
    return this.settingsSubject.asObservable();
  }

  getSettings(): Observable<AppSettings> {
    return this.http.get<AppSettings>(this.API_URL).pipe(
      tap(settings => this.publish(settings))
    );
  }

  /** Derniers parametres charges, sans requete reseau. */
  getSettingsSync(): AppSettings | null {
    return this.settingsSubject.value;
  }

  updateSettings(settings: Partial<AppSettings>): Observable<AppSettings> {
    return this.http.put<AppSettings>(this.API_URL, settings).pipe(
      // La sauvegarde renvoie les parametres a jour : on les rediffuse aussitot
      // pour que l'en-tete, les tickets et le login suivent sans rechargement.
      tap(saved => this.publish(saved))
    );
  }

  uploadLogo(file: File): Observable<{ logoUrl: string }> {
    const formData = new FormData();
    formData.append('logo', file);
    return this.http.post<{ logoUrl: string }>(`${this.API_URL}/logo`, formData).pipe(
      tap(res => {
        const current = this.settingsSubject.value;
        if (current && res?.logoUrl) {
          this.publish({ ...current, logoUrl: res.logoUrl });
        }
      })
    );
  }

  /** Diffuse les parametres et memorise la marque pour l'ecran de connexion. */
  private publish(settings: AppSettings): void {
    this.settingsSubject.next(settings);
    try {
      localStorage.setItem(SettingsService.BRANDING_KEY, JSON.stringify({
        companyName: settings?.companyName || '',
        logoUrl: this.getAbsoluteLogoUrl(settings?.logoUrl)
      }));
    } catch {
      // localStorage indisponible : la marque par defaut sera utilisee.
    }
  }

  /**
   * Marque memorisee, lisible AVANT connexion.
   * L'ecran de login ne peut pas appeler /api/settings (route authentifiee),
   * on relit donc ce que la derniere session a enregistre.
   */
  static readBranding(): { companyName: string; logoUrl: string } | null {
    try {
      const raw = localStorage.getItem(SettingsService.BRANDING_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  /**
   * Converts a relative logo URL to an absolute URL pointing to the server
   */
  getAbsoluteLogoUrl(logoUrl: string | undefined): string {
    if (!logoUrl) return '';
    if (logoUrl.startsWith('data:image/') || logoUrl.startsWith('blob:')) return logoUrl;
    const api = new URL(environment.apiUrl);
    if (environment.production && ['localhost', '127.0.0.1', '[::1]'].includes(api.hostname)) {
      // The desktop build reads bundled logos from Tauri and uploads from the local sidecar.
      // Legacy remote URLs must never make an offline receipt depend on Internet access.
      const local = new URL(logoUrl, window.location.origin);
      if (local.pathname.startsWith('/uploads/')) return api.origin + local.pathname;
      const bundledPath = /^\/logo(?:_[a-z]+)?\.webp$/i.test(local.pathname) ? local.pathname : '/logo_default.webp';
      return new URL(bundledPath, window.location.origin).href;
    }
    if (logoUrl.startsWith('http')) return logoUrl;
    
    // Handle different server configurations
    const baseUrl = this.BASE_URL;
    
    // If the logo URL starts with /uploads, ensure it's properly formatted
    if (logoUrl.startsWith('/uploads/')) {
      return `${baseUrl}${logoUrl}`;
    }
    
    // For other relative URLs, add the base URL
    return `${baseUrl}${logoUrl.startsWith('/') ? '' : '/'}${logoUrl}`;
  }
}
