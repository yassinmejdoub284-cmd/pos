import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { Sale, SaleItem } from '../models/sale.model';

export interface CreateSaleRequest {
  items: {
    productId: number;
    productName: string;
    quantity: number;
    unitPrice: number;
    total: number;
    discount?: number;
    // Wholesale fields
    isWholesale?: boolean;
    bundleQuantity?: number;
    bundleSize?: number;
    bundlePrice?: number;
  }[];
  total: number;
  discount: number;
  finalTotal: number;
  paymentMethodId: number;
  clientId?: number;
  amountPaid?: number;
  isWholesale?: boolean;
  paymentType?: 'COMPTANT' | 'CREDIT';
  // Advance payment fields for credit
  advancePayment?: number;
  advancePaymentMethod?: 'cash' | 'card' | 'check' | 'virement';
  advancePaymentNotes?: string;
}

export interface CreateTemporarySaleRequest {
  items: {
    productId: number;
    productName: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }[];
  total: number;
  discount: number;
  finalTotal: number;
  expectedDate: string;
  expectedTime: string;
  notes: string;
  status: string;
  clientId?: number;
  // Advance payment fields
  advancePayment?: number;
  advancePaymentMethod?: string;
  advancePaymentNotes?: string;
}

export interface CreateGiftSaleRequest {
  items: {
    productId: number;
    productName: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }[];
  total: number;
  discount: number;
  finalTotal: number;
  reason: string;
  recipient: string;
  status: string;
  clientId?: number;
}

@Injectable({
  providedIn: 'root'
})
export class SalesService {
  private apiUrl = `${environment.apiUrl}/sales`;

  constructor(
    private http: HttpClient
  ) {}

  createSale(saleData: CreateSaleRequest): Observable<Sale> {
    // Use wholesale endpoint if it's a wholesale sale
    if (saleData.isWholesale) {
      return this.http.post<Sale>(`${this.apiUrl}/wholesale`, saleData);
    }
    return this.http.post<Sale>(this.apiUrl, saleData);
  }

  createWholesaleSale(saleData: CreateSaleRequest): Observable<Sale> {
    return this.http.post<Sale>(`${this.apiUrl}/wholesale`, saleData);
  }

  createWholesaleSalePublic(saleData: CreateSaleRequest): Observable<Sale> {
    return this.http.post<Sale>(`${this.apiUrl.replace('/api/sales', '/api/sales/public')}/wholesale`, saleData);
  }

  getSales(params?: { startDate?: string; endDate?: string; status?: string; paymentMethod?: string; page?: number; limit?: number; sessionIds?: number[] }): Observable<Sale[]> {
    const options = params ? { params: Object.entries(params).reduce((acc: any, [k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        if (k === 'sessionIds' && Array.isArray(v)) {
          acc[k] = v.join(',');
        } else {
          acc[k] = String(v);
        }
      }
      return acc;
    }, {}) } : {};
    return this.http.get<Sale[]>(this.apiUrl, options).pipe(
      catchError((error) => throwError(() => error))
    );
  }

  getSale(id: number): Observable<Sale> {
    return this.http.get<Sale>(`${this.apiUrl}/${id}`).pipe(
      catchError((error) => throwError(() => error))
    );
  }

  markPrinted(saleId: number): Observable<{ success: boolean; isPrinted: boolean }> {
    return this.http.post<{ success: boolean; isPrinted: boolean }>(`${this.apiUrl}/${saleId}/printed`, {}).pipe(
      catchError((error) => throwError(() => error))
    );
  }

  getPaymentMethods(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/payment-methods/all`).pipe(
      catchError((error) => throwError(() => error))
    );
  }

  createTemporarySale(saleData: CreateTemporarySaleRequest): Observable<Sale> {
    return this.http.post<Sale>(`${this.apiUrl}/temporary`, saleData);
  }

  updateTemporarySaleToCompleted(saleId: number, paymentData: any): Observable<Sale> {
    return this.http.put<Sale>(`${this.apiUrl}/temporary/${saleId}/complete`, paymentData);
  }

  addAdvanceToTemporarySale(saleId: number, payload: { amount: number; method: 'cash' | 'card' | 'check' | 'virement'; notes?: string }): Observable<Sale> {
    return this.http.put<Sale>(`${this.apiUrl}/temporary/${saleId}/advance`, payload);
  }

  createGiftSale(saleData: CreateGiftSaleRequest): Observable<Sale> {
    return this.http.post<Sale>(`${this.apiUrl}/gift`, saleData);
  }

  approveGiftSale(saleId: number): Observable<Sale> {
    return this.http.put<Sale>(`${this.apiUrl}/gift/${saleId}/approve`, {});
  }

  rejectGiftSale(saleId: number): Observable<Sale> {
    return this.http.put<Sale>(`${this.apiUrl}/gift/${saleId}/reject`, {});
  }

  getTodaysSales(): Observable<Sale[]> {
    return this.http.get<Sale[]>(this.apiUrl).pipe(
      catchError((error) => throwError(() => error))
    );
  }

  getCurrentSessionTickets(): Observable<Sale[]> {
    return this.http.get<Sale[]>(`${this.apiUrl}/current-session/tickets`).pipe(
      catchError((error) => throwError(() => error))
    );
  }

  updateSaleStatus(saleId: number, status: string): Observable<Sale> {
    return this.http.put<Sale>(`${this.apiUrl}/${saleId}/status`, { status }).pipe(
      catchError((error) => throwError(() => error))
    );
  }
} 