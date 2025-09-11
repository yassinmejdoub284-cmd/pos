import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface AppSettings {
  id?: number;
  companyName?: string;
  logoUrl?: string;
  loyaltyEnabled: boolean;
  loyaltyRate: number;
  maxDiscountPercent: number;
  defaultClientMaxDebt: number;
  keyboardShortcuts?: any;
  devicesConfig?: any;
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
}

@Injectable({
  providedIn: 'root'
})
export class SettingsService {
  private readonly API_URL = `${environment.apiUrl}/settings`;

  constructor(private http: HttpClient) {}

  getSettings(): Observable<AppSettings> {
    return this.http.get<AppSettings>(this.API_URL);
  }

  updateSettings(settings: Partial<AppSettings>): Observable<AppSettings> {
    return this.http.put<AppSettings>(this.API_URL, settings);
  }
}