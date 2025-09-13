import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { SalesService } from '../core/services/sales.service';
import { Sale } from '../core/models/sale.model';
import { ExpenseService, Expense } from '../core/services/expense.service';
import { ApprovalsService, ChangeRequest, ClotureRejectReasonCode } from '../core/services/approvals.service';
import { SessionsService, SessionSummary, OpenSessionRequest } from '../core/services/sessions.service';

@Component({
  selector: 'app-approvals',
  templateUrl: './approvals.component.html',
  standalone: false
})
export class ApprovalsComponent implements OnInit {
  loading = false;
  error = '';
  allGifts: Sale[] = [];
  pendingGifts: Sale[] = [];
  approvedGifts: Sale[] = [];
  allExpenses: Expense[] = [];
  pendingExpenses: Expense[] = [];
  varianceRequests: ChangeRequest[] = [];
  historyRequests: ChangeRequest[] = [];
  clotureSummaries: { [sessionId: number]: any } = {};
  selectedTab: 'ALL' | 'PENDING_ADMIN' | 'CADEAU' | 'EXPENSES' | 'CLOTURE' | 'HISTORY' = 'ALL';
  searchQuery = '';
  startDate = '';
  endDate = '';
  showAlert = false;
  alertMessage = '';
  alertType: 'success' | 'error' | 'info' = 'info';
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

  constructor(
    private salesService: SalesService,
    private expenseService: ExpenseService,
    private approvalsService: ApprovalsService,
    private sessionsService: SessionsService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.route.queryParamMap.subscribe(params => {
      const tab = params.get('tab') as any;
      if (tab === 'PENDING_ADMIN' || tab === 'CADEAU' || tab === 'EXPENSES' || tab === 'CLOTURE' || tab === 'ALL' || tab === 'HISTORY') {
        this.selectedTab = tab;
      }
    });

    this.loadGifts();
    this.loadExpenses();
    this.loadVarianceRequests();
    this.loadHistoryRequests();
  }

  loadGifts(): void {
    this.loading = true;
    this.error = '';
    this.salesService.getSales().subscribe({
      next: (sales) => {
        const gifts = sales.filter(s => s.status === 'PENDING_ADMIN' || s.status === 'CADEAU');
        this.allGifts = gifts;
        this.applyFilters();
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
        this.applyFilters();
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
          const sessionId = req.session?.id || req.entityId;
          if (sessionId && !this.clotureSummaries[sessionId]) {
            this.sessionsService.getSessionReport(sessionId, 'Z', 'html').subscribe({
              next: (report) => {
                this.clotureSummaries[sessionId] = report;
              },
              error: () => {}
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
              const sessionId = req.session?.id || req.entityId;
              if (sessionId && !this.clotureSummaries[sessionId]) {
                this.sessionsService.getSessionReport(sessionId, 'Z', 'html').subscribe({
                  next: (report) => {
                    this.clotureSummaries[sessionId] = report;
                  },
                  error: () => {}
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

  applyFilters(): void {
    let gifts = this.allGifts;
    let expenses = this.allExpenses;
    
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      gifts = gifts.filter(s => (s.notes || '').toLowerCase().includes(q) || `${s.id}`.includes(q));
      expenses = expenses.filter(e => 
        `${e.id}`.includes(q) ||
        (e.notes || '').toLowerCase().includes(q)
      );
    }
    
    if (this.startDate && this.endDate) {
      const start = new Date(this.startDate);
      const end = new Date(this.endDate);
      gifts = gifts.filter(s => {
        const d = new Date(s.createdAt as unknown as string);
        return d >= start && d <= end;
      });
      expenses = expenses.filter(e => {
        const d = new Date(e.date);
        return d >= start && d <= end;
      });
    }
    
    this.pendingGifts = gifts.filter(s => s.status === 'PENDING_ADMIN');
    this.approvedGifts = gifts.filter(s => s.status === 'CADEAU');
    this.pendingExpenses = expenses.filter(e => !e.isApproved);
  }

  clearFilters(): void {
    this.searchQuery = '';
    this.startDate = '';
    this.endDate = '';
    this.applyFilters();
  }

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
      notes: this.rejectNotes.trim() || `Correction: montant corrigé à ${this.correctedAmount} TND` 
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
              console.log('Open session updated with corrected balance:', correctedAmount);
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
            console.log('Correction Summary Debug:', {
              sessionId,
              expectedCash: summary.expectedCash,
              cashSales: summary.cashSales,
              entree: summary.entree,
              sortie: summary.sortie,
              totalSales: summary.totalSales
            });
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
    
    console.log('Finalize Correction Debug:', {
      sessionId: this.correctionSessionId,
      correctionCountedCash: this.correctionCountedCash,
      correctionFonds: this.correctionFonds,
      correctionRetrait: this.correctionRetrait,
      correctionSummary: this.correctionSummary
    });
    
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
      next: () => {
        this.showAlertMessage('Cadeau rejeté avec succès', 'success');
        this.loadGifts();
      },
      error: () => {
        this.showAlertMessage('Erreur lors du rejet du cadeau', 'error');
      }
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
      await this.expenseService.approveExpense(expense.id, false).toPromise();
      this.showAlertMessage('Dépense rejetée avec succès', 'success');
      this.loadExpenses();
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
} 