import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

export interface SessionCaisse {
  id: number;
  posId: number;
  userId: number;
  depotId?: number;
  magasinId?: number;
  openedAt: Date;
  closedAt?: Date;
  openingFund: number;
  expectedCash: number;
  countedCash?: number;
  originalCountedCash?: number;
  variance?: number;
  status: 'OPEN' | 'CLOSED' | 'REOPENED' | 'ADMIN_CORRECTED';
  xSeq: number;
  zSeq: number;
  note?: string;
  createdAt: Date;
  updatedAt: Date;
  user?: {
    firstName: string;
    lastName: string;
  };
  depot?: {
    name: string;
    code: string;
  };
  cashMovements?: CashMovement[];
  summary?: SessionSummary;
}

export interface CashMovement {
  id: number;
  sessionId: number;
  type: 'ENTREE' | 'SORTIE' | 'DEPOT_COFFRE' | 'RETRAIT_CENTRALE' | 'AJUSTEMENT';
  amount: number;
  reason: string;
  ticketId?: number;
  createdById: number;
  createdAt: Date;
}

export interface SessionSummary {
  expectedCash: number;
  cashSales: number;
  entree: number;
  sortie: number;
  salesByPayment: { [key: string]: { amount: number; count: number } };
  totalSales: number;
  totalTickets: number;
  creditOutstanding?: number;
  creditAdvancePaid?: number;
  clientPaymentsTotal?: number;
}

export interface OpenSessionRequest {
  openingFund: number;
  posId?: number;
  depotId?: number;
  note?: string;
}

export interface CashMovementRequest {
  type: 'ENTREE' | 'SORTIE' | 'DEPOT_COFFRE' | 'RETRAIT_CENTRALE' | 'AJUSTEMENT';
  amount: number;
  reason: string;
  ticketId?: number;
}

export interface CloseSessionRequest {
  countedCash: number;
  fonds: number;
  retraitCentrale?: number;
  denominations: { [key: string]: number };
  isAdminCorrection?: boolean;
}

export interface SessionFilters {
  startDate?: string;
  endDate?: string;
  userId?: number;
  posId?: number;
  status?: string;
  hasVariance?: boolean;
  page?: number;
  limit?: number;
}

export interface ZReportData {
  session: SessionCaisse;
  summary: SessionSummary;
  generatedAt: Date;
  reportType: 'Z';
}

@Injectable({
  providedIn: 'root'
})
export class SessionsService {
  private readonly API_URL = `${environment.apiUrl}/sessions`;
  
  private currentSessionSubject = new BehaviorSubject<SessionCaisse | null>(null);
  public currentSession$ = this.currentSessionSubject.asObservable();
  
  public currentSession = signal<SessionCaisse | null>(null);
  public isSessionOpen = signal(false);

  constructor(private http: HttpClient, private authService: AuthService) {
    this.loadCurrentSessionByDepot();
  }

  private getRequestOptions() {
    const token = this.authService.getToken();
    return {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
      }
    };
  }

  // Get active session for current user (DEPRECATED - use getActiveSessionByDepot instead)
  getActiveSession(posId?: number, depotId?: number): Observable<SessionCaisse | null> {
    console.warn('getActiveSession is deprecated. Use getActiveSessionByDepot instead for depot-only sessions.');
    return this.getActiveSessionByDepot(posId, depotId);
  }

  // Get active session by depot only (no user linkage)
  getActiveSessionByDepot(posId?: number, depotId?: number): Observable<SessionCaisse | null> {
    const params: any = {};
    if (posId) params.posId = posId.toString();
    if (depotId) params.depotId = depotId.toString();
    
    return this.http.get<SessionCaisse | null>(`${this.API_URL}/active-by-depot`, { 
      params,
      ...this.getRequestOptions()
    }).pipe(
      tap(session => {
        this.currentSessionSubject.next(session);
        this.currentSession.set(session);
        this.isSessionOpen.set(!!session);
      })
    );
  }

  // Open new session (DEPRECATED - use openSessionByDepot instead)
  openSession(request: OpenSessionRequest): Observable<SessionCaisse> {
    console.warn('openSession is deprecated. Use openSessionByDepot instead for depot-only sessions.');
    return this.openSessionByDepot(request);
  }

  // Open new session by depot only (no user linkage)
  openSessionByDepot(request: OpenSessionRequest): Observable<SessionCaisse> {
    return this.http.post<SessionCaisse>(`${this.API_URL}/open-by-depot`, request, this.getRequestOptions()).pipe(
      tap(session => {
        this.currentSessionSubject.next(session);
        this.currentSession.set(session);
        this.isSessionOpen.set(true);
      })
    );
  }

  // Add cash movement
  addCashMovement(sessionId: number, movement: CashMovementRequest): Observable<CashMovement> {
    return this.http.post<CashMovement>(`${this.API_URL}/${sessionId}/movements`, movement, this.getRequestOptions());
  }

  // Get session summary
  getSessionSummary(sessionId: number): Observable<SessionSummary> {
    return this.http.get<SessionSummary>(`${this.API_URL}/${sessionId}/summary`, this.getRequestOptions());
  }


  // Close session
  closeSession(sessionId: number, request: CloseSessionRequest): Observable<{
    session: SessionCaisse;
    zReport: ZReportData;
    requiresApproval: boolean;
    variance: number;
    withdrawalAmount?: number;
    remainingBalance?: number;
    updatedOpenSession?: SessionCaisse;
  }> {
    return this.http.post<any>(`${this.API_URL}/${sessionId}/close`, request, this.getRequestOptions()).pipe(
      tap(() => {
        this.currentSessionSubject.next(null);
        this.currentSession.set(null);
        this.isSessionOpen.set(false);
      })
    );
  }

  // Get sessions history
  getSessions(filters: SessionFilters = {}): Observable<SessionCaisse[]> {
    const params: any = {};
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params[key] = value.toString();
      }
    });
    
    return this.http.get<SessionCaisse[]>(`${this.API_URL}`, { 
      params,
      ...this.getRequestOptions()
    });
  }

  // Get session report (X or Z)
  getSessionReport(sessionId: number, type: 'X' | 'Z' = 'Z', format: 'html' | 'escpos' | 'pdf' = 'html'): Observable<any> {
    const params = { type, format };
    return this.http.get(`${this.API_URL}/${sessionId}/report`, { 
      params,
      ...this.getRequestOptions()
    });
  }

  // Admin: Reopen session
  reopenSession(sessionId: number, reason: string): Observable<{
    session: SessionCaisse;
    changeRequest: any;
  }> {
    return this.http.post<any>(`${this.API_URL}/${sessionId}/reopen`, { reason }, this.getRequestOptions());
  }

  // Print report
  printReport(sessionId: number, type: 'X' | 'Z' = 'Z'): Observable<any> {
    return this.getSessionReport(sessionId, type, 'escpos');
  }

  // Load current session on service initialization (DEPRECATED)
  private loadCurrentSession(): void {
    console.warn('loadCurrentSession is deprecated. Use loadCurrentSessionByDepot instead.');
    this.loadCurrentSessionByDepot();
  }

  // Load current session by depot on service initialization
  private loadCurrentSessionByDepot(): void {
    this.getActiveSessionByDepot().subscribe();
  }

  // Refresh current session
  refreshCurrentSession(): void {
    this.loadCurrentSessionByDepot();
  }

  // Resolve active depotId: prefer session depot, fallback to user depot
  getActiveDepotId(): number | undefined {
    const sess = this.currentSession();
    if (sess?.depotId) return sess.depotId;
    // For admins, prefer explicitly selected depot (visitingDepotId) from login flow
    try {
      if (this.authService.isAdmin()) {
        const visitingDepotIdStr = sessionStorage.getItem('visitingDepotId') || localStorage.getItem('visitingDepotId');
        const visitingDepotId = visitingDepotIdStr ? Number(visitingDepotIdStr) : undefined;
        if (visitingDepotId && !Number.isNaN(visitingDepotId)) return visitingDepotId;
      }
    } catch {}
    const user = this.authService.currentUser();
    return user?.depotId ?? undefined;
  }

  // Get cash movement type label in French
  getCashMovementTypeLabel(type: string): string {
    const labels: { [key: string]: string } = {
      'ENTREE': 'Entrée de caisse',
      'SORTIE': 'Sortie de caisse',
      'DEPOT_COFFRE': 'Dépôt coffre',
      'RETRAIT_CENTRALE': 'Retrait centrale',
      'AJUSTEMENT': 'Ajustement'
    };
    return labels[type] || type;
  }

  // Get session status label in French
  getSessionStatusLabel(status: string): string {
    const labels: { [key: string]: string } = {
      'OPEN': 'Ouverte',
      'CLOSED': 'Fermée',
      'REOPENED': 'Réouverte',
      'ADMIN_CORRECTED': 'Corrigée par Admin'
    };
    return labels[status] || status;
  }

  // Format currency for display
  formatCurrency(amount: number | string): string {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    return `${(isNaN(numAmount) ? 0 : numAmount).toFixed(3)} DT`;
  }

  // Calculate denominations total
  calculateDenominationsTotal(denominations: { [key: string]: number }): number {
    return Object.entries(denominations).reduce((total, [denomination, quantity]) => {
      return total + (parseFloat(denomination) * quantity);
    }, 0);
  }

  // Get default denominations
  getDefaultDenominations(): { [key: string]: number } {
    return {
      '50': 0,
      '20': 0,
      '10': 0,
      '5': 0,
      '2': 0,
      '1': 0,
      '0.5': 0,
      '0.2': 0,
      '0.1': 0,
      '0.05': 0
    };
  }

  // Validate cash counting
  validateCashCounting(countedCash: number, expectedCash: number, threshold: number = 5.0): {
    isValid: boolean;
    variance: number;
    requiresApproval: boolean;
    message: string;
  } {
    const variance = countedCash - expectedCash;
    const requiresApproval = Math.abs(variance) > threshold;
    
    let message = '';
    if (variance === 0) {
      message = 'Comptage parfait';
    } else if (variance > 0) {
      message = `Surplus de ${variance.toFixed(3)} DT`;
    } else {
      message = `Manque de ${Math.abs(variance).toFixed(3)} DT`;
    }
    
    if (requiresApproval) {
      message += ` (Approbation requise - seuil: ${threshold} DT)`;
    }
    
    return {
      isValid: true,
      variance,
      requiresApproval,
      message
    };
  }
}
