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
}

export type ReturnStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'PROCESSED';
export type ReturnDisposition = 'NONE' | 'NON_REBUT' | 'REBUT';

export interface ReturnItem {
  id: number;
  productId: number;
  requestedQty: number;
  disposition?: ReturnDisposition;
  nonRebutQty?: number;
  rebutQty?: number;
  reason?: string;
  product?: any;
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
  createdAt: string;
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

  listRebuts(status: 'PENDING_AUTHORITY' | 'ARCHIVED' = 'PENDING_AUTHORITY'): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/rebuts`, { params: { status } as any });
  }

  archiveRebut(id: number): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/rebuts/${id}/archive`, {});
  }
}
