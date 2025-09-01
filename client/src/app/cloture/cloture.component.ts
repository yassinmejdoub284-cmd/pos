import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SessionsService, SessionCaisse, CashMovementRequest, CloseSessionRequest } from '../core/services/sessions.service';
import { AuthService } from '../core/services/auth.service';
import { PrintService } from '../core/services/print.service';

@Component({
  selector: 'app-cloture',
  templateUrl: './cloture.component.html',
  standalone: true,
  imports: [CommonModule, FormsModule]
})
export class ClotureComponent implements OnInit {
  currentSession = signal<SessionCaisse | null>(null);
  loading = signal(false);
  error = signal('');
  
  // Open session form
  openSessionForm = {
    openingFund: 50,
    posId: 1,
    note: ''
  };
  
  // Cash movement form
  cashMovementForm = {
    type: 'ENTREE' as 'ENTREE' | 'SORTIE' | 'DEPOT_COFFRE' | 'RETRAIT_CENTRALE' | 'AJUSTEMENT',
    amount: 0,
    reason: '',
    ticketId: ''
  };
  
  // Close session form
  closeSessionForm = {
    countedCash: 0,
    fonds: 50,
    retraitCentrale: 0,
    denominations: {} as { [key: string]: number }
  };
  
  // UI state
  showOpenForm = signal(false);
  showCashMovementModal = signal(false);
  showCloseForm = signal(false);
  showDenominations = signal(false);
  
  // Computed values
  denominationsTotal = computed(() => 
    this.sessionsService.calculateDenominationsTotal(this.closeSessionForm.denominations)
  );
  
  varianceInfo = computed(() => {
    const session = this.currentSession();
    if (!session || !this.closeSessionForm.countedCash) {
      return null;
    }
    return this.sessionsService.validateCashCounting(
      this.closeSessionForm.countedCash,
      session.expectedCash,
      5.0 // TODO: Get from settings
    );
  });

  constructor(
    private sessionsService: SessionsService,
    private authService: AuthService,
    private router: Router,
    private printService: PrintService
  ) {
    // Initialize denominations after service is available
    this.closeSessionForm.denominations = this.sessionsService.getDefaultDenominations();
  }

  ngOnInit(): void {
    this.loadCurrentSession();
  }

  loadCurrentSession(): void {
    this.loading.set(true);
    this.sessionsService.getActiveSession().subscribe({
      next: (session) => {
        this.currentSession.set(session);
        this.loading.set(false);
      },
      error: (error) => {
        this.error.set('Erreur lors du chargement de la session');
        this.loading.set(false);
      }
    });
  }

  openSession(): void {
    if (!this.openSessionForm.openingFund || this.openSessionForm.openingFund < 0) {
      this.error.set('Fonds de caisse requis et doit être positif');
      return;
    }

    this.loading.set(true);
    this.sessionsService.openSession(this.openSessionForm).subscribe({
      next: (session) => {
        this.currentSession.set(session);
        this.showOpenForm.set(false);
        this.loading.set(false);
        this.error.set('');
      },
      error: (error) => {
        this.error.set(error.error?.error || 'Erreur lors de l\'ouverture de la session');
        this.loading.set(false);
      }
    });
  }

  addCashMovement(): void {
    if (!this.cashMovementForm.amount || !this.cashMovementForm.reason) {
      this.error.set('Montant et motif requis');
      return;
    }

    const session = this.currentSession();
    if (!session) return;

    const movement: CashMovementRequest = {
      type: this.cashMovementForm.type,
      amount: this.cashMovementForm.amount,
      reason: this.cashMovementForm.reason,
      ticketId: this.cashMovementForm.ticketId ? parseInt(this.cashMovementForm.ticketId) : undefined
    };

    this.loading.set(true);
    this.sessionsService.addCashMovement(session.id, movement).subscribe({
      next: () => {
        this.loadCurrentSession(); // Refresh session data
        this.showCashMovementModal.set(false);
        this.cashMovementForm = {
          type: 'ENTREE',
          amount: 0,
          reason: '',
          ticketId: ''
        };
        this.loading.set(false);
        this.error.set('');
      },
      error: (error) => {
        this.error.set(error.error?.error || 'Erreur lors de l\'ajout du mouvement');
        this.loading.set(false);
      }
    });
  }

  closeSession(): void {
    const session = this.currentSession();
    if (!session) return;

    if (!this.closeSessionForm.countedCash || this.closeSessionForm.countedCash < 0) {
      this.error.set('Espèces comptées requises et doivent être positives');
      return;
    }

    const request: CloseSessionRequest = {
      countedCash: this.closeSessionForm.countedCash,
      fonds: this.closeSessionForm.fonds,
      retraitCentrale: this.closeSessionForm.retraitCentrale || undefined,
      denominations: this.closeSessionForm.denominations
    };

    this.loading.set(true);
    this.sessionsService.closeSession(session.id, request).subscribe({
      next: (result) => {
        this.currentSession.set(null);
        this.showCloseForm.set(false);
        this.loading.set(false);
        this.error.set('');
        
        // TODO: Handle approval requirement
        if (result.requiresApproval) {
          this.error.set('Session fermée - Approbation requise pour l\'écart');
        }
        
        // TODO: Print Z report
        this.printZReport(result.zReport);
      },
      error: (error) => {
        this.error.set(error.error?.error || 'Erreur lors de la fermeture de la session');
        this.loading.set(false);
      }
    });
  }

  printXReport(): void {
    const session = this.currentSession();
    if (!session) return;

    this.sessionsService.getSessionReport(session.id, 'X', 'html').subscribe({
      next: (data) => {
        this.printService.printXReport(data);
      },
      error: (error) => {
        this.error.set('Erreur lors de l\'impression du rapport X');
      }
    });
  }

  printZReport(zReport: any): void {
    this.printService.printZReport(zReport);
  }

  updateDenominationsTotal(): void {
    this.closeSessionForm.countedCash = this.denominationsTotal();
  }

  getCashMovementTypeLabel(type: string): string {
    return this.sessionsService.getCashMovementTypeLabel(type);
  }

  formatCurrency(amount: number): string {
    return this.sessionsService.formatCurrency(amount);
  }

  goToHistory(): void {
    this.router.navigate(['/cloture/historique']);
  }

  getDenominationKeys(): string[] {
    return Object.keys(this.closeSessionForm.denominations);
  }
} 