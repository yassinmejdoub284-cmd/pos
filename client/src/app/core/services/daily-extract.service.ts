import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface DailyExtract {
  date: string;
  hasData: boolean;
  totalSales: number;
  totalRevenue: number;
  totalDiscount: number;
  totalExpenses: number;
  families: FamilySummary[];
}

export interface FamilySummary {
  id: number;
  name: string;
  totalRevenue: number;
  totalDiscount: number;
  products: ProductSummary[];
}

export interface ProductSummary {
  id: number;
  name: string;
  quantity: number;
  revenue: number;
  discount: number;
}

export interface DailyExtractDetail {
  date: string;
  families: FamilySummary[];
  totalDiscount: number;
  totalRevenue: number;
  soldeDebit: number;
  expenses: ExpenseSummary[];
  totalExpenses: number;
  totalCaisse: number;
  withdrawal: number;
  remainingCash: number;
}

export interface ExpenseSummary {
  id: number;
  description: string;
  amount: number;
  category: string;
}

@Injectable({
  providedIn: 'root'
})
export class DailyExtractService {
  private apiUrl = `${environment.apiUrl}/reports`;

  constructor(private http: HttpClient) {}

  getLast10DaysExtracts(): Observable<DailyExtract[]> {
    // Add cache-busting parameter to ensure fresh data
    const timestamp = new Date().getTime();
    return this.http.get<DailyExtract[]>(`${this.apiUrl}/daily-extracts?t=${timestamp}`);
  }

  getLastNDaysExtracts(days: number): Observable<DailyExtract[]> {
    // Add cache-busting parameter to ensure fresh data
    const timestamp = new Date().getTime();
    return this.http.get<DailyExtract[]>(`${this.apiUrl}/daily-extracts?days=${days}&t=${timestamp}`);
  }

  getExtractDetail(date: string): Observable<DailyExtractDetail> {
    return this.http.get<DailyExtractDetail>(`${this.apiUrl}/daily-extracts/${date}`);
  }

  getArchives(startDate: string, endDate: string): Observable<DailyExtract[]> {
    return this.http.get<DailyExtract[]>(`${this.apiUrl}/daily-extracts/archives`, {
      params: { startDate, endDate }
    });
  }
}
