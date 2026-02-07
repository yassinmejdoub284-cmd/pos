import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { SalesService } from '../core/services/sales.service';
import { Sale } from '../core/models/sale.model';
import { ExpenseService, Expense } from '../core/services/expense.service';
import { ApprovalsService, ChangeRequest, ClotureRejectReasonCode } from '../core/services/approvals.service';
import { SessionsService, SessionSummary, OpenSessionRequest } from '../core/services/sessions.service';
import { HttpClient } from '@angular/common/http';
import { ReturnsService, ReturnRequest } from '../core/services/returns.service';
import { AuthService } from '../core/services/auth.service';
import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-approvals',
  templateUrl: './approvals.component.html',
  styleUrls: ['./approvals.component.css'],
  standalone: false
})
export class ApprovalsComponent implements OnInit {
  loading = false;
  error = '';
  allGifts: Sale[] = [];
  pendingGifts: Sale[] = [];
  approvedGifts: Sale[] = [];
  rejectedGifts: Sale[] = [];
  allExpenses: Expense[] = [];
  pendingExpenses: Expense[] = [];
  approvedExpensesHistory: Expense[] = [];
  rejectedExpensesHistory: Expense[] = [];
  varianceRequests: ChangeRequest[] = [];
  historyRequests: ChangeRequest[] = [];
  clotureSummaries: { [sessionId: number]: any } = {};
  selectedTab: 'ALL' | 'PENDING_ADMIN' | 'CADEAU' | 'CADEAU_REJETES' | 'EXPENSES' | 'CLOTURE' | 'INVOICES' | 'HISTORY' | 'HISTORY_CLOTURE' | 'RETURNS' | 'REButs' | 'RETURN_HISTORY' = 'ALL';
  // Filters removed
  showAlert = false;
  alertMessage = '';
  alertType: 'success' | 'error' | 'info' = 'info';
  // UI: show extra filters beyond primary tabs
  showMoreFilters = false;
  // UI: primary context selection for plus menu positioning
  mainContext: 'ALL' | 'HISTORY' = 'ALL';
  today: Date = new Date();
  // Notifications
  isNotificationsSubscribed = false;
  // Reject modal state
  showRejectModal = false;
  rejectTarget?: ChangeRequest;
  rejectReason: ClotureRejectReasonCode | '' = '';
  rejectNotes = '';
  correctedAmount: number = 0;
  // Correction mode state
  showCorrection = false;
  correctionSessionId?: number;
  correctionSummary?: SessionSummary;
  correctionCountedCash: number = 0;
  correctionFonds: number = 0;
  correctionRetrait?: number;
  correctionNote: string = '';

  // Invoice requests
  invoiceRequests: any[] = [];
  showInvoiceApprovalModal = false;
  selectedInvoiceRequest: any = null;
  invoiceApprovalData = { invoiceNumber: '' };
  submittingInvoiceApproval = false;

  // Returns
  pendingReturns: ReturnRequest[] = [];
  loadingReturns = false;
  pendingRebuts: any[] = [];
  returnHistory: ReturnRequest[] = [];
  loadingReturnHistory = false;

  constructor(
    private salesService: SalesService,
    private expenseService: ExpenseService,
    private approvalsService: ApprovalsService,
    private sessionsService: SessionsService,
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpClient,
    private returnsService: ReturnsService,
    private authService: AuthService
  ) {}

  // Get withdrawal amount from session data
  getTotalEncaissements(sessionData: any): number {
    if (!sessionData) return 0;
    
    // Get withdrawal amount from cash movements
    const cashMovements = sessionData.session?.cashMovements || [];
    const withdrawalAmount = cashMovements
      .filter((m: any) => m.type === 'RETRAIT_CENTRALE')
      .reduce((sum: number, m: any) => sum + (parseFloat(m.amount || 0) || 0), 0);
    
    return withdrawalAmount;
  }

  ngOnInit(): void {
    // Detect notifications subscription on load/refresh
    try {
      if (typeof window !== 'undefined' && 'Notification' in window) {
        this.isNotificationsSubscribed = Notification.permission === 'granted';
      }
    } catch {}
    this.route.queryParamMap.subscribe(params => {
      const tab = params.get('tab') as any;
      if (tab === 'PENDING_ADMIN' || tab === 'CADEAU' || tab === 'CADEAU_REJETES' || tab === 'EXPENSES' || tab === 'CLOTURE' || tab === 'ALL' || tab === 'HISTORY' || tab === 'RETURNS' || tab === 'INVOICES') {
        this.selectedTab = tab;
      }
    });

    this.loadInvoiceRequests();

    this.loadGifts();
    this.loadExpenses();
    this.loadVarianceRequests();
    this.loadHistoryRequests();
    this.loadPendingReturns();
    this.loadPendingRebuts();
    this.loadReturnHistory();
  }

  async subscribeToNotifications(): Promise<void> {
    try {
      if (!('Notification' in window)) {
        this.showAlertMessage('Notifications non prises en charge', 'error');
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        // Register push subscription and send to backend
        const reg = await navigator.serviceWorker.ready;
        // Replace with your real VAPID public key (Base64 URL-safe)
        const VAPID_PUBLIC_KEY = (window as any).VAPID_PUBLIC_KEY || '';
        if (!VAPID_PUBLIC_KEY) {
          console.warn('VAPID public key not set. Set window.VAPID_PUBLIC_KEY.');
        }
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: this.urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as unknown as ArrayBuffer
        });
        await fetch(`${(window as any).API_URL || ''}/api/push/subscribe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': localStorage.getItem('token') ? `Bearer ${localStorage.getItem('token')}` : '' },
          body: JSON.stringify({ subscription: sub })
        });
        this.isNotificationsSubscribed = true;
        this.showAlertMessage('Abonné aux notifications', 'success');
      } else if (permission === 'denied') {
        this.isNotificationsSubscribed = false;
        this.showAlertMessage('Notifications refusées', 'error');
      }
    } catch {
      this.showAlertMessage('Erreur abonnement notifications', 'error');
    }
  }

  private urlBase64ToUint8Array(base64: string): Uint8Array {
    const padding = '='.repeat((4 - (base64.length % 4)) % 4);
    const base64Safe = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64Safe);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  loadGifts(): void {
    this.loading = true;
    this.error = '';
    const pending$ = this.salesService.getSales({ status: 'PENDING_ADMIN' }).pipe(
      map((sales) => this.filterGiftSales(sales, 'PENDING_ADMIN')),
      catchError((error) => {
        console.error('Error loading pending gift sales:', error);
        return of([] as Sale[]);
      })
    );

    const approved$ = this.salesService.getSales({ status: 'CADEAU' }).pipe(
      map((sales) => this.filterGiftSales(sales, 'CADEAU')),
      catchError((error) => {
        console.error('Error loading approved gift sales:', error);
        return of([] as Sale[]);
      })
    );

    const rejected$ = this.salesService.getSales({ status: 'CANCELLED' }).pipe(
      map((sales) => this.filterGiftSales(sales, 'CANCELLED')),
      catchError((error) => {
        console.error('Error loading rejected gift sales:', error);
        return of([] as Sale[]);
      })
    );

    forkJoin({
      pending: pending$,
      approved: approved$,
      rejected: rejected$
    }).subscribe({
      next: ({ pending, approved, rejected }) => {
        this.allGifts = [...pending, ...approved, ...rejected];
        this.pendingGifts = pending;
        this.approvedGifts = approved;
        this.rejectedGifts = rejected;
        this.loading = false;
      },
      error: () => {
        this.error = "Erreur lors du chargement des demandes de cadeaux";
        this.loading = false;
      }
    });
  }

  loadExpenses(): void {
    this.expenseService.getExpenses().subscribe({
      next: (expenses) => {
        this.allExpenses = expenses;
        this.pendingExpenses = this.allExpenses.filter(e => !e.isApproved && !e.isRejected);
        this.approvedExpensesHistory = this.allExpenses
          .filter(e => e.isApproved)
          .sort((a, b) => new Date(b.approvedAt || b.updatedAt || b.date).getTime() - new Date(a.approvedAt || a.updatedAt || a.date).getTime());
        this.rejectedExpensesHistory = this.allExpenses
          .filter(e => !!e.isRejected)
          .sort((a, b) => new Date(b.rejectedAt || b.updatedAt || b.date).getTime() - new Date(a.rejectedAt || a.updatedAt || a.date).getTime());
      },
      error: () => {
        this.error = "Erreur lors du chargement des dépenses";
      }
    });
  }

  loadVarianceRequests(): void {
    this.approvalsService.getVarianceChangeRequests('PENDING').subscribe({
      next: (requests) => {
        this.varianceRequests = requests;
        // Load concise Z-report data for each session to display extract info
        requests.forEach((req) => {
          // Only load report if session exists in the request
          if (!req.session || !req.session.id) {
            return; // Skip if session doesn't exist (orphaned change request)
          }
          
          const sessionId = req.session.id;
          // Only use depotId from session if available - don't fallback to user's depotId
          // as it might not match the session's actual depot
          const sessionDepotId = req.session.depotId;
          // For admins, don't pass depotId to allow access to sessions from any depot
          // For non-admins, use the session's depotId if available
          const isAdmin = this.authService.isAdmin();
          const depotId = isAdmin ? undefined : sessionDepotId;
          
          if (sessionId && !this.clotureSummaries[sessionId]) {
            this.sessionsService.getSessionReport(sessionId, 'Z', 'html', depotId).subscribe({
              next: (report) => {
                this.clotureSummaries[sessionId] = report;
              },
              error: (error) => {
                // Only log 404 errors if they're not expected (e.g., session deleted)
                if (error.status !== 404) {
                  console.warn(`Failed to load session report for session ${sessionId} (depotId: ${depotId || 'not specified'}, sessionDepotId: ${sessionDepotId || 'not available'}):`, error);
                }
                // Don't show error to user as this is just for display enhancement
                // Mark as attempted to avoid retrying
                this.clotureSummaries[sessionId] = null;
              }
            });
          }
        });
      },
      error: () => {
        this.error = "Erreur lors du chargement des demandes de clôture";
      }
    });
  }

  loadHistoryRequests(): void {
    // Load both approved and rejected requests for history
    this.approvalsService.getVarianceChangeRequests('APPROVED').subscribe({
      next: (approvedRequests) => {
        this.approvalsService.getVarianceChangeRequests('REJECTED').subscribe({
          next: (rejectedRequests) => {
            this.historyRequests = [...approvedRequests, ...rejectedRequests].sort((a, b) => 
              new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
            );
            // Load Z-report data for history requests too
            this.historyRequests.forEach((req) => {
              // Only load report if session exists in the request
              if (!req.session || !req.session.id) {
                return; // Skip if session doesn't exist (orphaned change request)
              }
              
              const sessionId = req.session.id;
              // Only use depotId from session if available - don't fallback to user's depotId
              // as it might not match the session's actual depot
              const sessionDepotId = req.session.depotId;
              // For admins, don't pass depotId to allow access to sessions from any depot
              // For non-admins, use the session's depotId if available
              const isAdmin = this.authService.isAdmin();
              const depotId = isAdmin ? undefined : sessionDepotId;
              
              if (sessionId && !this.clotureSummaries[sessionId]) {
                this.sessionsService.getSessionReport(sessionId, 'Z', 'html', depotId).subscribe({
                  next: (report) => {
                    this.clotureSummaries[sessionId] = report;
                  },
                  error: (error) => {
                    // Only log 404 errors if they're not expected (e.g., session deleted)
                    if (error.status !== 404) {
                      console.warn(`Failed to load session report for session ${sessionId} (depotId: ${depotId || 'not specified'}, sessionDepotId: ${sessionDepotId || 'not available'}):`, error);
                    }
                    // Don't show error to user as this is just for display enhancement
                    // Mark as attempted to avoid retrying
                    this.clotureSummaries[sessionId] = null;
                  }
                });
              }
            });
          },
          error: () => {
            this.error = "Erreur lors du chargement de l'historique";
          }
        });
      },
      error: () => {
        this.error = "Erreur lors du chargement de l'historique";
      }
    });
  }

  // applyFilters removed

  // clearFilters removed

  approveCloture(req: ChangeRequest): void {
    this.approvalsService.approveChangeRequest(req.id).subscribe({
      next: () => {
        this.showAlertMessage('Clôture approuvée', 'success');
        this.loadVarianceRequests();
        this.loadHistoryRequests();
      },
      error: () => {
        this.showAlertMessage("Erreur lors de l'approbation de la clôture", 'error');
      }
    });
  }

  rejectCloture(req: ChangeRequest): void {
    this.rejectTarget = req;
    this.rejectReason = '';
    this.rejectNotes = '';
    this.correctedAmount = 0;
    this.showRejectModal = true;
  }

  confirmRejectWithSelectedReason(): void {
    if (!this.rejectTarget || !this.rejectReason) {
      this.showAlertMessage('Veuillez sélectionner une raison', 'error');
      return;
    }
    this.approvalsService.rejectChangeRequest(this.rejectTarget.id, { reasonCode: this.rejectReason }).subscribe({
      next: () => {
        this.showRejectModal = false;
        this.loadVarianceRequests();
        this.loadHistoryRequests();
        this.startCorrection(this.rejectTarget!);
      },
      error: () => {
        this.showAlertMessage('Erreur lors du rejet de la clôture', 'error');
      }
    });
  }

  confirmRejectWithNotes(): void {
    if (!this.rejectTarget) return;
    if (!this.rejectNotes.trim()) {
      this.showAlertMessage('Veuillez saisir une note', 'error');
      return;
    }
    this.approvalsService.rejectChangeRequest(this.rejectTarget.id, { reasonCode: 'AUTRE', notes: this.rejectNotes.trim() }).subscribe({
      next: () => {
        this.showRejectModal = false;
        this.loadVarianceRequests();
        this.loadHistoryRequests();
        this.startCorrection(this.rejectTarget!);
      },
      error: () => {
        this.showAlertMessage('Erreur lors du rejet de la clôture', 'error');
      }
    });
  }

  confirmRejectAndCorrect(): void {
    if (!this.rejectTarget || !this.correctedAmount) {
      this.showAlertMessage('Veuillez saisir le montant corrigé', 'error');
      return;
    }

    // First reject the change request
    this.approvalsService.rejectChangeRequest(this.rejectTarget.id, { 
      reasonCode: 'ECART_COMPTAGE', 
      notes: this.rejectNotes.trim() || `Correction: montant corrigé à ${this.correctedAmount} DT` 
    }).subscribe({
      next: () => {
        this.showRejectModal = false;
        this.loadVarianceRequests();
        this.loadHistoryRequests();
        
        // Then directly correct the session with the provided amount
        this.correctSessionDirectly(this.rejectTarget!, this.correctedAmount);
      },
      error: () => {
        this.showAlertMessage('Erreur lors du rejet de la clôture', 'error');
      }
    });
  }

  private correctSessionDirectly(req: ChangeRequest, correctedAmount: number): void {
    const sessionId = req.session?.id || req.entityId;
    if (!sessionId) {
      this.showAlertMessage("Session introuvable pour la clôture", 'error');
      return;
    }

    // Get the session data to calculate the adjustment
    const sessionData = this.clotureSummaries[sessionId];
    if (!sessionData) {
      this.showAlertMessage("Données de session non disponibles", 'error');
      return;
    }

    const expectedCash = sessionData.summary?.expectedCash || 0;
    
    // Send the corrected amount directly to the backend
    // The backend will calculate the proper adjustment

    // Reopen session for correction
    const reasonLabel = req.reason || 'Correction après rejet';
    this.sessionsService.reopenSession(sessionId, reasonLabel).subscribe({
      next: () => {
        // Close session with corrected amount
        this.sessionsService.closeSession(sessionId, {
          countedCash: correctedAmount,
          fonds: correctedAmount, // Use corrected amount as opening fund for next session
          retraitCentrale: undefined,
          denominations: {},
          isAdminCorrection: true
        }).subscribe({
          next: (response) => {
            this.showAlertMessage('Clôture rejetée et corrigée avec succès', 'success');
            this.loadVarianceRequests();
            this.loadHistoryRequests();
            
            // Backend automatically updates existing open session with corrected balance
            if (response.updatedOpenSession) {
            }
          },
          error: () => {
            this.showAlertMessage('Erreur lors de la correction de la clôture', 'error');
          }
        });
      },
      error: () => {
        this.showAlertMessage('Impossible de réouvrir la session pour correction', 'error');
      }
    });
  }


  private startCorrection(req: ChangeRequest): void {
    const sessionId = req.session?.id || req.entityId;
    if (!sessionId) {
      this.showAlertMessage("Session introuvable pour la clôture", 'error');
      return;
    }
    // Reopen session for correction
    const reasonLabel = req.reason || 'Correction après rejet';
    this.sessionsService.reopenSession(sessionId, reasonLabel).subscribe({
      next: () => {
        this.correctionSessionId = sessionId;
        this.showCorrection = true;
        // Load summary to assist admin
        this.sessionsService.getSessionSummary(sessionId).subscribe({
          next: (summary) => {
            this.correctionSummary = summary;
            this.correctionCountedCash = summary.expectedCash; // start from expected
            this.correctionFonds = 0;
            this.correctionRetrait = undefined;
          },
          error: () => {}
        });
      },
      error: () => {
        this.showAlertMessage('Impossible de réouvrir la session pour correction', 'error');
      }
    });
  }

  finalizeCorrection(): void {
    if (!this.correctionSessionId) return;
    const denominations: { [key: string]: number } = {}; // keep empty unless needed
    
    
    this.sessionsService.closeSession(this.correctionSessionId, {
      countedCash: Number(this.correctionCountedCash || 0),
      fonds: Number(this.correctionFonds || 0),
      retraitCentrale: this.correctionRetrait ? Number(this.correctionRetrait) : undefined,
      denominations,
      isAdminCorrection: true
    }).subscribe({
      next: () => {
        this.showAlertMessage('Clôture corrigée et validée', 'success');
        this.showCorrection = false;
        this.loadVarianceRequests();
        this.loadHistoryRequests();
      },
      error: () => {
        this.showAlertMessage('Erreur lors de la validation de la correction', 'error');
      }
    });
  }

  approve(sale: Sale): void {
    this.salesService.approveGiftSale(sale.id).subscribe({
      next: () => {
        this.showAlertMessage('Cadeau approuvé avec succès', 'success');
        this.loadGifts();
      },
      error: () => {
        this.showAlertMessage("Erreur lors de l'approbation du cadeau", 'error');
      }
    });
  }

  reject(sale: Sale): void {
    this.salesService.rejectGiftSale(sale.id).subscribe({
      next: (updatedSale) => {
        this.showAlertMessage('Cadeau rejeté avec succès', 'success');
        const rejectedCopy = (updatedSale ? { ...updatedSale } : { ...sale, status: 'CANCELLED' }) as Sale;
        // Optimistically move to rejected gifts and remove from pending
        this.pendingGifts = this.pendingGifts.filter(s => s.id !== sale.id);
        this.rejectedGifts = [rejectedCopy, ...this.rejectedGifts];
        // Switch to history so the user sees it immediately
        this.selectedTab = 'HISTORY';
        this.mainContext = 'HISTORY';
        // Refresh from server in background
        this.loadGifts();
      },
      error: () => {
        this.showAlertMessage('Erreur lors du rejet du cadeau', 'error');
      }
    });
  }

  private filterGiftSales(sales: Sale[], status?: 'PENDING_ADMIN' | 'CADEAU' | 'CANCELLED'): Sale[] {
    return (sales || []).filter((sale) => {
      const matchesStatus = !status || sale.status === status;
      const notes = sale.notes || '';
      const isGift = notes.startsWith('Cadeau -') || sale.status === 'CADEAU';
      return matchesStatus && isGift;
    });
  }

  async approveExpense(expense: Expense): Promise<void> {
    try {
      await this.expenseService.approveExpense(expense.id, true).toPromise();
      this.showAlertMessage('Dépense approuvée avec succès', 'success');
      this.loadExpenses();
    } catch (error) {
      this.showAlertMessage("Erreur lors de l'approbation de la dépense", 'error');
    }
  }

  async rejectExpense(expense: Expense): Promise<void> {
    try {
      const rejectionNotes = prompt('Raison du rejet (optionnel):', '')?.trim();
      await this.expenseService.approveExpense(expense.id, false, { rejectionNotes: rejectionNotes || undefined }).toPromise();
      this.showAlertMessage('Dépense rejetée avec succès', 'success');
      this.loadExpenses();
      // Navigate to history to show the rejected expense immediately
      this.selectedTab = 'HISTORY';
      this.mainContext = 'HISTORY';
    } catch (error) {
      this.showAlertMessage("Erreur lors du rejet de la dépense", 'error');
    }
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('fr-TN', {
      style: 'currency',
      currency: 'TND'
    }).format(amount);
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleDateString('fr-FR');
  }

  showAlertMessage(message: string, type: 'success' | 'error' | 'info'): void {
    this.alertMessage = message;
    this.alertType = type;
    this.showAlert = true;
    setTimeout(() => { this.showAlert = false; }, 3000);
  }

  getRejectionReasonLabel(reasonCode: string): string {
    switch (reasonCode) {
      case 'ECART_COMPTAGE': return 'Écart au comptage physique';
      case 'SUSPICION_ANOMALIE': return 'Suspicion d\'anomalie';
      case 'AUTRE': return 'Autre';
      default: return reasonCode;
    }
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'PENDING': return 'En attente';
      case 'APPROVED': return 'Approuvée';
      case 'REJECTED': return 'Rejetée';
      default: return status;
    }
  }

  getSessionStatusLabel(status: string): string {
    switch (status) {
      case 'OPEN': return 'Ouverte';
      case 'CLOSED': return 'Fermée';
      case 'REOPENED': return 'Réouverte';
      case 'ADMIN_CORRECTED': return 'Corrigée par Admin';
      default: return status;
    }
  }

  isAdminCorrected(req: ChangeRequest): boolean {
    return req.status === 'APPROVED' && 
           !!req.rejectionNotes && 
           req.rejectionNotes.includes('Correction effectuée par administrateur');
  }


  // Returns
  loadPendingReturns(): void {
    this.loadingReturns = true;
    this.returnsService.listReturnRequests('PENDING').subscribe({
      next: (reqs) => {
        this.pendingReturns = reqs;
        this.loadingReturns = false;
      },
      error: (error) => {
        
        this.loadingReturns = false;
        this.showAlertMessage('Erreur lors du chargement des bons de retour', 'error');
      }
    });
  }

  getTotalReturnAmount(request: ReturnRequest): number {
    return request.items.reduce((total, item) => {
      const price = item.product?.prix_vente_TTC || 0;
      return total + (item.requestedQty * price);
    }, 0);
  }

  approveReturnRequest(request: ReturnRequest): void {
    // Simple approval - all items are returned as non-rebut (restored to stock)
    const items = request.items.map(item => ({
      itemId: item.id,
      nonRebutQty: item.requestedQty,
      rebutQty: 0
    }));

    this.returnsService.approveReturnRequest(request.id, items).subscribe({
      next: () => {
        this.showAlertMessage('Bon de retour approuvé', 'success');
        this.loadPendingReturns();
        this.loadPendingRebuts();
        this.loadReturnHistory();
      },
      error: (e) => {
        
        this.showAlertMessage("Erreur lors de l'approbation du bon de retour", 'error');
      }
    });
  }

  rejectReturnRequest(request: ReturnRequest): void {
    const reason = prompt('Raison du rejet (optionnel):') || '';
    
    if (confirm('Êtes-vous sûr de vouloir rejeter ce bon de retour ?')) {
      this.returnsService.rejectReturnRequest(request.id, reason).subscribe({
        next: () => {
          this.showAlertMessage('Bon de retour rejeté', 'success');
          this.loadPendingReturns();
          this.loadReturnHistory();
        },
        error: (error) => {
        
          this.showAlertMessage("Erreur lors du rejet du bon de retour", 'error');
        }
      });
    }
  }

  loadPendingRebuts(): void {
    this.returnsService.listRebuts('PENDING_AUTHORITY').subscribe({
      next: (rows) => this.pendingRebuts = rows,
      error: () => {}
    });
  }

  loadReturnHistory(): void {
    this.loadingReturnHistory = true;
    // Load both approved and rejected requests
    this.returnsService.listReturnRequests('APPROVED').subscribe({
      next: (approved) => {
        this.returnsService.listReturnRequests('REJECTED').subscribe({
          next: (rejected) => {
            this.returnHistory = [...approved, ...rejected].sort((a, b) => 
              new Date((b as any).updatedAt || b.createdAt).getTime() - new Date((a as any).updatedAt || a.createdAt).getTime()
            );
            this.loadingReturnHistory = false;
          },
          error: () => {
            this.returnHistory = approved;
            this.loadingReturnHistory = false;
          }
        });
      },
      error: () => {
        this.loadingReturnHistory = false;
      }
    });
  }

  archiveRebut(recordId: number): void {
    if (!confirm("Confirmer l'archivage après validation de l'autorité ?")) return;
    this.returnsService.archiveRebut(recordId).subscribe({
      next: () => {
        this.showAlertMessage('Rebut archivé', 'success');
        this.loadPendingRebuts();
      },
      error: () => this.showAlertMessage("Erreur lors de l'archivage", 'error')
    });
  }

  // Invoice requests methods
  loadInvoiceRequests(): void {
    this.http.get(`${environment.apiUrl}/invoices/requests`).subscribe({
      next: (response: any) => {
        this.invoiceRequests = response.requests || [];
      },
      error: (error) => {
        console.error('Error loading invoice requests:', error);
      }
    });
  }

  openInvoiceApprovalModal(request: any): void {
    this.selectedInvoiceRequest = request;
    this.invoiceApprovalData.invoiceNumber = '';
    this.showInvoiceApprovalModal = true;
  }

  closeInvoiceApprovalModal(): void {
    this.showInvoiceApprovalModal = false;
    this.selectedInvoiceRequest = null;
    this.invoiceApprovalData.invoiceNumber = '';
  }

  getNextInvoiceNumber(): void {
    this.http.get(`${environment.apiUrl}/invoices/next-number`).subscribe({
      next: (response: any) => {
        this.invoiceApprovalData.invoiceNumber = response.nextNumber;
      },
      error: (error) => {
        console.error('Error getting next invoice number:', error);
        this.showAlertMessage('Erreur lors de la récupération du numéro de facture', 'error');
      }
    });
  }

  submitInvoiceApproval(): void {
    if (!this.selectedInvoiceRequest || !this.invoiceApprovalData.invoiceNumber) return;

    this.submittingInvoiceApproval = true;
    this.http.put(`${environment.apiUrl}/invoices/requests/${this.selectedInvoiceRequest.id}/approve`, {
      invoiceNumber: this.invoiceApprovalData.invoiceNumber
    }).subscribe({
      next: () => {
        this.showAlertMessage('Demande de facture approuvée avec succès', 'success');
        this.closeInvoiceApprovalModal();
        this.loadInvoiceRequests();
      },
      error: (error) => {
        console.error('Error approving invoice request:', error);
        this.showAlertMessage('Erreur lors de l\'approbation de la demande', 'error');
      },
      complete: () => {
        this.submittingInvoiceApproval = false;
      }
    });
  }

  rejectInvoiceRequest(request: any): void {
    if (!confirm('Voulez-vous vraiment rejeter cette demande de facture ?')) return;

    this.http.put(`${environment.apiUrl}/invoices/requests/${request.id}/reject`, {}).subscribe({
      next: () => {
        this.showAlertMessage('Demande de facture rejetée', 'success');
        this.loadInvoiceRequests();
      },
      error: (error) => {
        console.error('Error rejecting invoice request:', error);
        this.showAlertMessage('Erreur lors du rejet de la demande', 'error');
      }
    });
  }
} 