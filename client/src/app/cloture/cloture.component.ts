import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SessionsService, SessionCaisse, CashMovementRequest, CloseSessionRequest } from '../core/services/sessions.service';
import { AuthService } from '../core/services/auth.service';
import { PrintService } from '../core/services/print.service';
import { DailyExtractService } from '../core/services/daily-extract.service';
import { SettingsService } from '../core/services/settings.service';

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
  
  // Close session form - only withdrawal
  closeSessionForm = {
    retraitCentrale: ''
  };
  
  // UI state
  showCloseForm = signal(false);
  showFundForm = signal(false);
  
  // Fund form
  fundForm = {
    amount: ''
  };
  

  constructor(
    private sessionsService: SessionsService,
    private authService: AuthService,
    private router: Router,
    private printService: PrintService,
    private dailyExtractService: DailyExtractService,
    private settingsService: SettingsService
  ) {}

  ngOnInit(): void {
    this.loadCurrentSession();
    
    // Refresh session data every 5 seconds to get updated sales
    setInterval(() => {
      if (this.currentSession()) {
        this.loadCurrentSession();
      }
    }, 5000);
  }

  loadCurrentSession(): void {
    this.loading.set(true);
    this.sessionsService.getActiveSession().subscribe({
      next: (session) => {
        this.currentSession.set(session);
        this.loading.set(false);
        
        // If no active session, automatically open one
        if (!session) {
          this.autoOpenSession();
        }
      },
      error: (error) => {
        this.error.set('Erreur lors du chargement de la session');
        this.loading.set(false);
        // Try to auto-open session on error too
        this.autoOpenSession();
      }
    });
  }

  autoOpenSession(): void {
    this.loading.set(true);
    const defaultSession = {
      openingFund: 0, // No opening fund by default
      posId: 1,
      note: 'Session automatique'
    };
    
    this.sessionsService.openSession(defaultSession).subscribe({
      next: (session) => {
        this.currentSession.set(session);
        this.loading.set(false);
        this.error.set('');
      },
      error: (error) => {
        this.error.set('Erreur lors de l\'ouverture automatique de la session');
        this.loading.set(false);
      }
    });
  }


  closeSession(): void {
    const session = this.currentSession();
    if (!session) {
      this.error.set('Aucune session active trouvée');
      return;
    }

    // Simple closure - just log withdrawal and print daily extract
    const withdrawalAmount = parseFloat(this.closeSessionForm.retraitCentrale) || 0;
    
    console.log('Closing session:', session.id, 'with withdrawal:', withdrawalAmount);
    this.loading.set(true);
    
    // Get session-specific extract and company settings, then print
    this.sessionsService.getSessionReport(session.id, 'Z').subscribe({
      next: (sessionReport) => {
        // Map session report data to daily extract format for printing
        const enhancedExtract = {
          date: new Date().toISOString().split('T')[0],
          families: sessionReport.families || [],
          totalDiscount: 0, // Session reports don't track discounts separately
          totalRevenue: sessionReport.summary?.totalSales || 0,
          soldeDebit: sessionReport.summary?.expectedCash || 0,
          withdrawal: withdrawalAmount,
          remainingCash: (sessionReport.summary?.expectedCash || 0) - withdrawalAmount,
          closureTimestamp: new Date(),
          alimentations: sessionReport.session?.cashMovements?.filter((movement: any) => movement.type === 'ENTREE') || []
        };
        
        // Fetch company settings and print with real data
        this.settingsService.getSettings().subscribe({
          next: (settings) => {
            // Prepare company data for printing
            const companyData = {
              companyName: settings.companyName,
              depotName: sessionReport.session?.depot?.name,
              address: sessionReport.session?.depot?.address || '123 Rue de la Paix',
              city: sessionReport.session?.depot?.city || 'Tunis, Tunisie',
              phone: sessionReport.session?.depot?.phone || '+216 71 123 456'
            };
            
            // Print the session extract with real company data
            this.printService.printDailyExtractWithWithdrawal(enhancedExtract, companyData);
          },
          error: (error) => {
            console.error('Error fetching settings:', error);
            // Print without company data if settings fetch fails
            this.printService.printDailyExtractWithWithdrawal(enhancedExtract);
          }
        });
        
        // Ensure we have valid countedCash value
        const countedCash = sessionReport.summary?.expectedCash || 0;
        console.log('Session report data:', sessionReport);
        console.log('Enhanced extract for printing:', enhancedExtract);
        console.log('Counted cash value:', countedCash);
        
        // Close the session (simple closure)
        // Calculate remaining balance for next session's opening fund
        const remainingBalance = countedCash - withdrawalAmount;
        console.log('Sending close request for session:', session.id, 'with data:', {
          countedCash: countedCash,
          fonds: remainingBalance,
          retraitCentrale: withdrawalAmount > 0 ? withdrawalAmount : undefined,
          denominations: {}
        });
        
        this.sessionsService.closeSession(session.id, {
          countedCash: countedCash,
          fonds: remainingBalance, // Use remaining balance as opening fund for next session
          retraitCentrale: withdrawalAmount > 0 ? withdrawalAmount : undefined,
          denominations: {}
        }).subscribe({
          next: () => {
            this.showCloseForm.set(false);
            this.loading.set(false);
            this.error.set('');
            
            // Automatically open new session
            this.autoOpenSession();
            
            // Redirect to register after successful closure
            setTimeout(() => {
              this.goToRegister();
            }, 1000);
          },
          error: (error) => {
            console.error('Session closure error:', error);
            this.error.set('Erreur lors de la fermeture de la session: ' + (error.error?.error || error.message || 'Erreur inconnue'));
            this.loading.set(false);
          }
        });
      },
      error: (error) => {
        console.error('Error fetching daily extract:', error);
        this.error.set('Erreur lors de l\'impression de l\'extrait journalier');
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

  formatCurrency(amount: number): string {
    return this.sessionsService.formatCurrency(amount);
  }

  goToHistory(): void {
    this.router.navigate(['/cloture/historique']);
  }

  goToRegister(): void {
    this.router.navigate(['/caisse']);
  }

  addDigit(digit: string): void {
    const current = this.closeSessionForm.retraitCentrale.toString();
    
    if (digit === '.') {
      // Only allow one decimal point
      if (!current.includes('.')) {
        this.closeSessionForm.retraitCentrale = current + '.';
      }
    } else {
      // Add digit
      if (current === '0' || current === '') {
        this.closeSessionForm.retraitCentrale = digit;
      } else {
        this.closeSessionForm.retraitCentrale = current + digit;
      }
    }
  }

  clearAmount(): void {
    this.closeSessionForm.retraitCentrale = '';
  }

  fundCashRegister(): void {
    const session = this.currentSession();
    if (!session) {
      this.error.set('Aucune session active trouvée');
      return;
    }

    const amount = parseFloat(this.fundForm.amount) || 0;
    if (amount <= 0) {
      this.error.set('Le montant doit être positif');
      return;
    }

    this.loading.set(true);
    
    // Add cash movement for funding
    this.sessionsService.addCashMovement(session.id, {
      type: 'ENTREE',
      amount: amount,
      reason: 'Fonds de caisse ajoutés'
    }).subscribe({
      next: () => {
        this.showFundForm.set(false);
        this.fundForm.amount = '';
        this.loading.set(false);
        this.error.set('');
        // Refresh session data
        this.loadCurrentSession();
      },
      error: (error) => {
        this.error.set('Erreur lors de l\'ajout des fonds: ' + (error.error?.error || error.message || 'Erreur inconnue'));
        this.loading.set(false);
      }
    });
  }

  addFundDigit(digit: string): void {
    const current = this.fundForm.amount.toString();
    
    if (digit === '.') {
      // Only allow one decimal point
      if (!current.includes('.')) {
        this.fundForm.amount = current + '.';
      }
    } else {
      // Add digit
      if (current === '0' || current === '') {
        this.fundForm.amount = digit;
      } else {
        this.fundForm.amount = current + digit;
      }
    }
  }

  clearFundAmount(): void {
    this.fundForm.amount = '';
  }
} 