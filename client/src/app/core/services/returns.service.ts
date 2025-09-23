import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ReturnRequestCreateItem {
  productId: number;
  quantity: number;
  reason?: string;
}

export interface ReturnRequestCreatePayload {
  depotId: number;
  items: ReturnRequestCreateItem[];
  notes?: string;
  originalSaleId?: number | null;
  originalSaleTotal?: number | null;
}

export type ReturnStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'PROCESSED';
export type ReturnDisposition = 'NONE' | 'NON_REBUT' | 'REBUT';

export interface Product {
  id: number;
  name: string;
  prix_vente_TTC: number;
  unite: string;
  famille: {
    id: number;
    name: string;
  };
}

export interface ReturnItem {
  id: number;
  productId: number;
  requestedQty: number;
  disposition?: ReturnDisposition;
  nonRebutQty?: number;
  rebutQty?: number;
  reason?: string;
  product?: Product;
}

export interface ReturnRequest {
  id: number;
  numero: string;
  status: ReturnStatus;
  depotId: number;
  requestedById: number;
  approvedById?: number;
  approvedAt?: string;
  notes?: string;
  originalSaleId?: number | null;
  originalSaleTotal?: number | null;
  createdAt: string;
  updatedAt?: string;
  items: ReturnItem[];
}

@Injectable({ providedIn: 'root' })
export class ReturnsService {
  private apiUrl = `${environment.apiUrl}/returns`;

  constructor(private http: HttpClient) {}

  createReturnRequest(payload: ReturnRequestCreatePayload): Observable<ReturnRequest> {
    return this.http.post<ReturnRequest>(`${this.apiUrl}/requests`, payload);
    }

  listReturnRequests(status: ReturnStatus = 'PENDING'): Observable<ReturnRequest[]> {
    return this.http.get<ReturnRequest[]>(`${this.apiUrl}/requests`, { params: { status } as any });
  }

  approveReturnRequest(id: number, items: Array<{ itemId: number; nonRebutQty?: number; rebutQty?: number; }>): Observable<ReturnRequest> {
    return this.http.post<ReturnRequest>(`${this.apiUrl}/requests/${id}/approve`, { items });
  }

  rejectReturnRequest(id: number, reason?: string): Observable<ReturnRequest> {
    return this.http.post<ReturnRequest>(`${this.apiUrl}/requests/${id}/reject`, { reason });
  }

  listRebuts(status: 'PENDING_AUTHORITY' | 'ARCHIVED' = 'PENDING_AUTHORITY'): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/rebuts`, { params: { status } as any });
  }

  archiveRebut(id: number): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/rebuts/${id}/archive`, {});
  }
}
