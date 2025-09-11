import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface WholesaleRule {
  id: string;
  productIds: number[];
  ruleType: 'percentage' | 'fixed' | 'discount' | 'manual';
  value: number;
  description: string;
  isArchived?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CreateWholesaleRuleRequest {
  ruleType: 'percentage' | 'fixed' | 'discount' | 'manual';
  value: number;
  description: string;
}

export interface UpdateWholesaleRuleRequest {
  ruleType?: 'percentage' | 'fixed' | 'discount' | 'manual';
  value?: number;
  description?: string;
  isArchived?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class WholesaleRulesService {
  private apiUrl = `${environment.apiUrl}/wholesale-rules`;

  constructor(private http: HttpClient) {}

  getWholesaleRules(): Observable<WholesaleRule[]> {
    return this.http.get<WholesaleRule[]>(this.apiUrl).pipe(
      catchError((error) => throwError(() => error))
    );
  }

  getWholesaleRule(id: string): Observable<WholesaleRule> {
    return this.http.get<WholesaleRule>(`${this.apiUrl}/${id}`).pipe(
      catchError((error) => throwError(() => error))
    );
  }

  createWholesaleRule(ruleData: CreateWholesaleRuleRequest): Observable<WholesaleRule> {
    return this.http.post<WholesaleRule>(this.apiUrl, ruleData).pipe(
      catchError((error) => throwError(() => error))
    );
  }

  updateWholesaleRule(id: string, ruleData: UpdateWholesaleRuleRequest): Observable<WholesaleRule> {
    return this.http.put<WholesaleRule>(`${this.apiUrl}/${id}`, ruleData).pipe(
      catchError((error) => throwError(() => error))
    );
  }

  deleteWholesaleRule(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/${id}`).pipe(
      catchError((error) => throwError(() => error))
    );
  }

  archiveWholesaleRule(id: string): Observable<WholesaleRule> {
    return this.http.put<WholesaleRule>(`${this.apiUrl}/${id}/archive`, {}).pipe(
      catchError((error) => throwError(() => error))
    );
  }

  unarchiveWholesaleRule(id: string): Observable<WholesaleRule> {
    return this.http.put<WholesaleRule>(`${this.apiUrl}/${id}/unarchive`, {}).pipe(
      catchError((error) => throwError(() => error))
    );
  }
}
