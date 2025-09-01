import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface AppSettings {
  companyName?: string;
  logoUrl?: string;
  loyaltyEnabled?: boolean;
  loyaltyRate?: number;
  maxDiscountPercent?: number;
  defaultClientMaxDebt?: number;
  keyboardShortcuts?: any;
  devicesConfig?: any;
  auditRetentionDays?: number;
}

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private apiUrl = `${environment.apiUrl}/settings`;

  constructor(private http: HttpClient) {}

  getSettings(): Observable<AppSettings> {
    return this.http.get<AppSettings>(this.apiUrl);
  }

  updateSettings(data: AppSettings): Observable<AppSettings> {
    return this.http.put<AppSettings>(this.apiUrl, data);
  }
} 