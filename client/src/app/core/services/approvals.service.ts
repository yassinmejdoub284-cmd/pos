import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ChangeRequest {
  id: number;
  type: string; // VARIANCE_APPROVAL, SESSION_REOPEN
  entityId: number;
  entityType: string; // SESSION_CAISSE
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  requestedBy: number;
  approvedBy?: number;
  approvedAt?: string;
  rejectionReasonCode?: string; // ECART_COMPTAGE, SUSPICION_ANOMALIE, AUTRE
  rejectionNotes?: string;
  createdAt: string;
  updatedAt: string;
  session?: {
    id: number;
    depotId?: number;
    openedAt: string;
    closedAt?: string;
    variance?: number;
    status?: string;
    user?: { firstName: string; lastName: string };
    depot?: { name: string; code: string };
  };
}

export type ClotureRejectReasonCode = 'ECART_COMPTAGE' | 'SUSPICION_ANOMALIE' | 'AUTRE';

@Injectable({ providedIn: 'root' })
export class ApprovalsService {
  private readonly API_URL = `${environment.apiUrl}/approvals`;

  constructor(private http: HttpClient) {}

  getVarianceChangeRequests(status: 'PENDING' | 'APPROVED' | 'REJECTED' = 'PENDING'): Observable<ChangeRequest[]> {
    const params = new HttpParams().set('type', 'VARIANCE_APPROVAL').set('status', status);
    return this.http.get<ChangeRequest[]>(`${this.API_URL}/change-requests`, { params });
  }

  approveChangeRequest(id: number): Observable<ChangeRequest> {
    return this.http.put<ChangeRequest>(`${this.API_URL}/change-requests/${id}/approve`, {});
  }

  rejectChangeRequest(id: number, payload?: { reasonCode?: ClotureRejectReasonCode; notes?: string }): Observable<ChangeRequest> {
    return this.http.put<ChangeRequest>(`${this.API_URL}/change-requests/${id}/reject`, payload || {});
  }
}


