import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface StockKPIData {
  todaySales: number;
  weekSales: number;
  totalEntries: number;
  totalExits: number;
  turnoverRate: number;
  todaySalesChange: number;
  weekSalesChange: number;
  entriesChange: number;
  exitsChange: number;
  turnoverChange: number;
}

export interface StockChartData {
  date: string;
  sales?: number;
  entries?: number;
  exits?: number;
}

export interface TopProduct {
  id: number;
  name: string;
  sales: number;
  quantity: number;
  revenue: number;
}

export interface TopClient {
  id: number;
  name: string;
  total: number;
  orders: number;
}

export interface StockDocument {
  id: number;
  number: string;
  date: string;
  type: string;
  supplier?: string;
  client?: string;
  total: number;
  status: string;
  user: string;
  depotId: number;
}

export interface ProductAnalytics {
  id: number;
  name: string;
  sales: number;
  quantityOut: number;
  quantityIn: number;
  margin: number;
  topClients: string[];
  dailyEvolution: number[];
  lastMovements: Array<{
    date: string;
    type: string;
    quantity: number;
  }>;
}

@Injectable({
  providedIn: 'root'
})
export class StockAnalyticsService {
  private apiUrl = `${environment.apiUrl}/reports`;

  constructor(private http: HttpClient) {}

  getKPIData(depotId: number, dateFrom?: string, dateTo?: string): Observable<StockKPIData> {
    let params = new HttpParams().set('depotId', depotId.toString());
    
    if (dateFrom) params = params.set('startDate', dateFrom);
    if (dateTo) params = params.set('endDate', dateTo);

    return this.http.get<StockKPIData>(`${this.apiUrl}/dashboard`, { params }).pipe(
      catchError((error) => throwError(() => error))
    );
  }

  getSalesChartData(depotId: number, dateFrom?: string, dateTo?: string): Observable<StockChartData[]> {
    let params = new HttpParams().set('depotId', depotId.toString());
    
    if (dateFrom) params = params.set('startDate', dateFrom);
    if (dateTo) params = params.set('endDate', dateTo);

    return this.http.get<StockChartData[]>(`${this.apiUrl}/sales`, { params }).pipe(
      catchError((error) => throwError(() => error))
    );
  }

  getStockMovements(depotId: number, dateFrom?: string, dateTo?: string): Observable<StockChartData[]> {
    let params = new HttpParams().set('depotId', depotId.toString());
    
    if (dateFrom) params = params.set('startDate', dateFrom);
    if (dateTo) params = params.set('endDate', dateTo);

    return this.http.get<StockChartData[]>(`${this.apiUrl}/stock-movements`, { params }).pipe(
      catchError((error) => throwError(() => error))
    );
  }

  getTopProducts(depotId: number, dateFrom?: string, dateTo?: string, limit: number = 10): Observable<TopProduct[]> {
    let params = new HttpParams()
      .set('depotId', depotId.toString())
      .set('limit', limit.toString());
    
    if (dateFrom) params = params.set('startDate', dateFrom);
    if (dateTo) params = params.set('endDate', dateTo);

    return this.http.get<TopProduct[]>(`${this.apiUrl}/products`, { params }).pipe(
      catchError((error) => throwError(() => error))
    );
  }

  getTopClients(depotId: number, dateFrom?: string, dateTo?: string, limit: number = 10): Observable<TopClient[]> {
    let params = new HttpParams()
      .set('depotId', depotId.toString())
      .set('limit', limit.toString());
    
    if (dateFrom) params = params.set('startDate', dateFrom);
    if (dateTo) params = params.set('endDate', dateTo);

    return this.http.get<TopClient[]>(`${this.apiUrl}/credit-sales`, { params }).pipe(
      catchError((error) => throwError(() => error))
    );
  }

  getStockDocuments(
    depotId: number, 
    type?: string, 
    status?: string, 
    dateFrom?: string, 
    dateTo?: string,
    page: number = 1,
    limit: number = 20
  ): Observable<{ documents: StockDocument[]; total: number; page: number; totalPages: number }> {
    let params = new HttpParams()
      .set('depotId', depotId.toString())
      .set('page', page.toString())
      .set('limit', limit.toString());
    
    if (type) params = params.set('type', type);
    if (status) params = params.set('status', status);
    if (dateFrom) params = params.set('dateFrom', dateFrom);
    if (dateTo) params = params.set('dateTo', dateTo);

    return this.http.get<{ documents: StockDocument[]; total: number; page: number; totalPages: number }>(
      `${environment.apiUrl}/stock-documents`, 
      { params }
    ).pipe(
      catchError((error) => throwError(() => error))
    );
  }

  getProductAnalytics(depotId: number, dateFrom?: string, dateTo?: string): Observable<ProductAnalytics[]> {
    let params = new HttpParams().set('depotId', depotId.toString());
    
    if (dateFrom) params = params.set('startDate', dateFrom);
    if (dateTo) params = params.set('endDate', dateTo);

    return this.http.get<ProductAnalytics[]>(`${this.apiUrl}/sales-by-category`, { params }).pipe(
      catchError((error) => throwError(() => error))
    );
  }

  getDailyExtracts(depotId: number, days: number = 7): Observable<any[]> {
    let params = new HttpParams()
      .set('depotId', depotId.toString())
      .set('days', days.toString());

    return this.http.get<any[]>(`${this.apiUrl}/daily-extracts`, { params }).pipe(
      catchError((error) => throwError(() => error))
    );
  }
}
