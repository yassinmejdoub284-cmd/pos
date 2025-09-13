import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface InventorySession {
  id: number;
  numero: string;
  depotId: number;
  status: 'DRAFT' | 'IN_PROGRESS' | 'CLOSED' | 'POSTED';
  startedBy: number;
  closedBy?: number;
  postedBy?: number;
  startedAt: Date;
  closedAt?: Date;
  postedAt?: Date;
  notes?: string;
  totalEcartValue?: number;
  totalEcartQty?: number;
  createdAt: Date;
  updatedAt: Date;
  depot?: {
    name: string;
    code: string;
  };
  starter?: {
    firstName: string;
    lastName: string;
    username: string;
  };
  closer?: {
    firstName: string;
    lastName: string;
    username: string;
  };
  poster?: {
    firstName: string;
    lastName: string;
    username: string;
  };
  items?: InventoryItem[];
  _count?: {
    items: number;
  };
}

export interface InventoryItem {
  id: number;
  sessionId: number;
  productId: number;
  theoreticalQuantity: number;
  countedQuantity?: number;
  ecartQuantity?: number;
  ecartValue?: number;
  reason?: 'PHYSICAL_COUNT_DIFFERENCE' | 'SUSPICION_OF_ANOMALY';
  notes?: string;
  countedAt?: Date;
  countedBy?: number;
  createdAt: Date;
  updatedAt: Date;
  product?: {
    id: number;
    name: string;
    barcode?: string;
    unite: string;
    prix_vente_TTC: number;
    famille?: {
      name: string;
    };
  };
  counter?: {
    firstName: string;
    lastName: string;
    username: string;
  };
}

export interface InventorySummary {
  session: {
    id: number;
    numero: string;
    status: string;
    startedAt: Date;
    closedAt?: Date;
    postedAt?: Date;
  };
  statistics: {
    totalItems: number;
    countedItems: number;
    remainingItems: number;
    itemsWithEcart: number;
    totalEcartValue: number;
    totalEcartQty: number;
  };
  ecarts: Array<{
    productId: number;
    productName: string;
    theoreticalQuantity: number;
    countedQuantity?: number;
    ecartQuantity?: number;
    ecartValue?: number;
    reason?: string;
    notes?: string;
  }>;
}

@Injectable({
  providedIn: 'root'
})
export class InventoryService {
  private apiUrl = `${environment.apiUrl}/inventory`;

  constructor(private http: HttpClient) {}

  // Get all inventory sessions
  getSessions(status?: string, depotId?: number): Observable<InventorySession[]> {
    const params: any = {};
    if (status) params.status = status;
    if (depotId) params.depotId = depotId;
    
    return this.http.get<InventorySession[]>(`${this.apiUrl}/sessions`, { params });
  }

  // Get single inventory session with items
  getSession(id: number): Observable<InventorySession> {
    return this.http.get<InventorySession>(`${this.apiUrl}/sessions/${id}`);
  }

  // Create new inventory session
  createSession(depotId?: number, notes?: string): Observable<InventorySession> {
    return this.http.post<InventorySession>(`${this.apiUrl}/sessions`, {
      depotId,
      notes
    });
  }

  // Update inventory session status
  updateSessionStatus(id: number, status: string, notes?: string): Observable<InventorySession> {
    return this.http.patch<InventorySession>(`${this.apiUrl}/sessions/${id}/status`, {
      status,
      notes
    });
  }

  // Update inventory item count
  updateItemCount(sessionId: number, itemId: number, countedQuantity: number | null, reason?: string, notes?: string): Observable<InventoryItem> {
    return this.http.patch<InventoryItem>(`${this.apiUrl}/sessions/${sessionId}/items/${itemId}`, {
      countedQuantity,
      reason,
      notes
    });
  }

  // Post inventory session (apply stock adjustments)
  postSession(id: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/sessions/${id}/post`, {});
  }

  // Get inventory session summary
  getSessionSummary(id: number): Observable<InventorySummary> {
    return this.http.get<InventorySummary>(`${this.apiUrl}/sessions/${id}/summary`);
  }

  // Delete inventory session (only if DRAFT)
  deleteSession(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/sessions/${id}`);
  }
}
