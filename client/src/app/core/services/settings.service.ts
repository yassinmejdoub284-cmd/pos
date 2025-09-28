import { Injectable } from '@angular/core';
import { HttpClient, HttpEvent, HttpEventType } from '@angular/common/http';
import { Observable } from 'rxjs';
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
  defaultFonds: number;
  denominations: number[];
  requireApprovalForVariance: boolean;
  ticketWidth: number;
  droitDeTimbre: boolean;
  // Expenses
  autoApproveExpenseBelow: number;
  // Historique
  historyRetentionDays?: number;
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
    showCompanyDetails: boolean;
    showClientInfo: boolean;
    showPaymentMethod: boolean;
    showDiscountDetails: boolean;
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

  constructor(private http: HttpClient) {}

  getSettings(): Observable<AppSettings> {
    return this.http.get<AppSettings>(this.API_URL);
  }

  getSettingsSync(): AppSettings | null {
    // This is a simplified synchronous version - in a real app you'd want to cache settings
    // For now, return null to use defaults
    return null;
  }

  updateSettings(settings: Partial<AppSettings>): Observable<AppSettings> {
    return this.http.put<AppSettings>(this.API_URL, settings);
  }

  uploadLogo(file: File): Observable<{ logoUrl: string }> {
    const formData = new FormData();
    formData.append('logo', file);
    return this.http.post<{ logoUrl: string }>(`${this.API_URL}/logo`, formData);
  }

  /**
   * Converts a relative logo URL to an absolute URL pointing to the server
   */
  getAbsoluteLogoUrl(logoUrl: string | undefined): string {
    if (!logoUrl) return '';
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