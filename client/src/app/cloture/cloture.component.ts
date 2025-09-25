import { Component, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SessionsService, SessionCaisse, CashMovementRequest, CloseSessionRequest, OpenSessionRequest } from '../core/services/sessions.service';
import { AuthService } from '../core/services/auth.service';
import { PrintService } from '../core/services/print.service';
import { DailyExtractService } from '../core/services/daily-extract.service';
import { SettingsService } from '../core/services/settings.service';
import { DepotsService } from '../core/services/depots.service';
import { Depot } from '../core/models/depot.model';

@Component({
  selector: 'app-cloture',
  templateUrl: './cloture.component.html',
  standalone: true,
  imports: [CommonModule, FormsModule]
})
export class ClotureComponent implements OnInit, OnDestroy {
  currentSession = signal<SessionCaisse | null>(null);
  loading = signal(false);
  error = signal('');
  // Depot selection removed; rely on visiting depot chosen at login
  
  // Close session form - only withdrawal
  closeSessionForm = {
    retraitCentrale: ''
  };
  
  // UI state
  showCloseForm = signal(false);
  showFundForm = signal(false);
  activeTab = signal<'historique' | 'cloture'>('cloture');
  showDetails = signal({
    encaissement: { clientPayments: false, advances: false, cash: false },
    decaissement: { expenses: false, suppliers: false },
    alimentations: { expanded: false }
  });
  
  // Tickets modal state
  showTicketsModal = signal(false);
  sessionTickets = signal<{ id: number; amount: number }[]>([]);
  ticketsTotal = computed(() => this.sessionTickets().reduce((sum, t) => sum + t.amount, 0));

  // Refresh control
  private refreshIntervalId: any;
  private isRefreshing = false;
  private triedAutoOpen = false;
  isAdminUser = false;

  // Crédit and supplier payments helpers
  getCreditAmount(): number {
    const session = this.currentSession();
    const summary: any = session?.summary || {};
    const direct = parseFloat(summary.creditOutstanding || 0) || 0;
    if (direct > 0) return direct;
    const credit = (summary.salesByPayment?.CREDIT?.amount) || 0;
    return parseFloat(credit) || 0;
  }

  // Recent movements helper (pure)
  getRecentMovements(limit: number, predicate: (m: any) => boolean): Array<{ createdAt: string; type: string; reason: string; amount: number }> {
    const movements = (this.currentSession()?.cashMovements || []) as any[];
    return movements
      .filter(predicate)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit)
      .map(m => ({
        createdAt: m.createdAt,
        type: m.type,
        reason: m.reason,
        amount: parseFloat(m.amount || 0) || 0
      }));
  }

  // Convenience filtered lists for template (avoid inline lambdas in template)
  recentClientPayments(): Array<{ createdAt: string; type: string; reason: string; amount: number }> {
    return this.getRecentMovements(10, (m: any) => m.type === 'ENTREE' && (((m.reason || '').toLowerCase().includes('crédit')) || ((m.reason || '').toLowerCase().includes('credit'))));
  }

  recentOrderAdvances(): Array<{ createdAt: string; type: string; reason: string; amount: number }> {
    return this.getRecentMovements(10, (m: any) => m.type === 'ENTREE' && ((m.reason || '').toLowerCase().startsWith('acompte')));
  }

  recentExpenses(): Array<{ createdAt: string; type: string; reason: string; amount: number }> {
    // Prefer server-provided details if any
    const details = (this.currentSession()?.summary as any)?.expensesDetails as Array<any> | undefined;
    if (details && details.length) {
      return details.slice(0, 10).map(d => ({
        createdAt: d.createdAt,
        type: 'SORTIE',
        reason: d.reason,
        amount: d.amount
      }));
    }
    // Fallback to movements with expense-like reason
    return this.getRecentMovements(10, (m: any) => m.type === 'SORTIE' && (((m.reason || '').toLowerCase().includes('dépense')) || ((m.reason || '').toLowerCase().includes('depense'))));
  }

  recentSupplierPayments(): Array<{ createdAt: string; type: string; reason: string; amount: number }> {
    const details = (this.currentSession()?.summary as any)?.supplierPaymentsDetails as Array<any> | undefined;
    if (details && details.length) {
      return details.slice(0, 10).map(d => ({
        createdAt: d.createdAt,
        type: 'SORTIE',
        reason: `Règlement fournisseur #${d.supplierId} (${d.supplierName})`,
        amount: d.amount
      }));
    }
    return this.getRecentMovements(10, (m: any) => m.type === 'SORTIE' && ((m.reason || '').toLowerCase().includes('règlement fournisseur')));
  }

  getSupplierPaymentsTotal(): number {
    const movements = this.currentSession()?.cashMovements || [];
    return movements
      .filter(m => m.type === 'SORTIE' && (m.reason || '').toLowerCase().includes('règlement fournisseur'))
      .reduce((sum, m) => sum + (parseFloat((m as any).amount) || 0), 0);
  }

  getNetAfterAdjustments(): number {
    const totalSales = parseFloat((this.currentSession()?.summary?.totalSales as any) || 0) || 0;
    const expectedCash = parseFloat((this.currentSession()?.summary?.expectedCash as any) || 0) || 0;
    const credit = this.getCreditAmount();
    const supplierRegs = this.getSupplierPaymentsTotal();
    return totalSales + expectedCash - credit - supplierRegs;
  }

  // New computed helpers
  getClientPaymentsTotal(): number {
    const summary: any = this.currentSession()?.summary || {};
    // Only use server-provided client payments total (standalone payments without saleId)
    return parseFloat(summary.clientPaymentsTotal || 0) || 0;
  }

  getTotalOrderAdvances(): number {
    const movements = this.currentSession()?.cashMovements || [];
    return movements
      .filter(m => m.type === 'ENTREE' && (m.reason || '').toLowerCase().startsWith('acompte commande'))
      .reduce((sum, m) => sum + (parseFloat((m as any).amount) || 0), 0);
  }

  getCashFromSalesNetOfCredit(): number {
    const summary: any = this.currentSession()?.summary || {};
    const totalSales = parseFloat(summary.totalSales || 0) || 0;
    const credit = this.getCreditAmount();
    return Math.max(0, totalSales - credit);
  }

  getExpensesTotal(): number {
    // Prefer server-provided total if available
    const summary: any = this.currentSession()?.summary || {};
    const fromSummary = parseFloat(summary.expensesTotal || 0) || 0;
    if (fromSummary > 0) return fromSummary;
    // Fallback to movements tagged as expenses
    const movements = this.currentSession()?.cashMovements || [];
    return movements
      .filter(m => m.type === 'SORTIE' && ((m.reason || '').toLowerCase().includes('dépense') || (m.reason || '').toLowerCase().includes('depense')))
      .reduce((sum, m) => sum + (parseFloat((m as any).amount) || 0), 0);
  }

  // Load and show current session tickets (id + amount)
  openTicketsModal(): void {
    const session = this.currentSession();
    if (!session) return;
    this.loading.set(true);
    this.sessionsService.getSessionReport(session.id, 'Z').subscribe({
      next: (report: any) => {
        const sales = (report?.session?.sales || []) as Array<{ id: number; finalTotal: number }>
        this.sessionTickets.set(sales.map(s => ({ id: s.id, amount: parseFloat((s as any).finalTotal || 0) })));
        this.loading.set(false);
        this.showTicketsModal.set(true);
      },
      error: () => {
        this.error.set('Erreur lors du chargement des tickets');
        this.loading.set(false);
      }
    });
  }
  
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
    private settingsService: SettingsService,
    private depotsService: DepotsService
  ) {}

  ngOnInit(): void {
    this.isAdminUser = this.authService.isAdmin();
    // Load immediately; depot scope is handled globally via header
    this.loadCurrentSession();
    // Refresh session data every 5 seconds to get updated sales (pause when modal open or tab hidden)
    this.refreshIntervalId = setInterval(() => {
      if (document?.hidden) return;
      if (this.showCloseForm() || this.showFundForm() || this.showTicketsModal()) return;
      if (this.currentSession()) {
        this.loadCurrentSession(true);
      }
    }, 5000);
  }

  ngOnDestroy(): void {
    if (this.refreshIntervalId) {
      clearInterval(this.refreshIntervalId);
      this.refreshIntervalId = null;
    }
  }

  loadCurrentSession(silent: boolean = false): void {
    if (this.isRefreshing) return;
    this.isRefreshing = true;
    if (!silent) this.loading.set(true);
    this.sessionsService.getActiveSession(undefined, undefined).subscribe({
      next: (session) => {
        this.currentSession.set(session);
        if (!silent) this.loading.set(false);
        this.isRefreshing = false;
        
        // If no active session, automatically open one
        if (!session && !this.triedAutoOpen) {
          this.triedAutoOpen = true;
          this.autoOpenSession();
        }
      },
      error: (error) => {
        this.error.set('Erreur lors du chargement de la session');
        if (!silent) this.loading.set(false);
        this.isRefreshing = false;
        if (!this.triedAutoOpen) {
          this.triedAutoOpen = true;
          this.autoOpenSession();
        }
      }
    });
  }

  autoOpenSession(): void {
    this.loading.set(true);
    const defaultSession: OpenSessionRequest = {
      openingFund: 0,
      posId: 1,
      note: 'Session automatique'
    };
    // Depot is inferred from visiting depot header; no explicit depotId needed
    try { console.debug('[Cloture] Opening session payload', defaultSession); } catch {}
    
    this.sessionsService.openSession(defaultSession).subscribe({
      next: (session) => {
        this.currentSession.set(session);
        this.loading.set(false);
        this.error.set('');
      },
      error: (error) => {
        const msg = error?.error?.error || 'Erreur lors de l\'ouverture automatique de la session';
        this.error.set(msg);
        this.loading.set(false);
      }
    });
  }

  // Depot choosing removed

  


  closeSession(): void {
    const session = this.currentSession();
    if (!session) {
      this.error.set('Aucune session active trouvée');
      return;
    }

    // Simple closure - just log withdrawal and print daily extract
    const withdrawalAmount = parseFloat(this.closeSessionForm.retraitCentrale) || 0;
    
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
        
        // Close the session (simple closure)
        // Calculate remaining balance for next session's opening fund
        const remainingBalance = countedCash - withdrawalAmount;
        
        this.sessionsService.closeSession(session.id, {
          countedCash: countedCash,
          fonds: remainingBalance, // Use remaining balance as opening fund for next session
          retraitCentrale: withdrawalAmount > 0 ? withdrawalAmount : undefined,
          denominations: {}
        }).subscribe({
          next: (resp) => {
            this.showCloseForm.set(false);
            this.loading.set(false);
            this.error.set('');
            
            // Automatically open new session
            this.autoOpenSession();
            
            // If approval is required, redirect to approvals center, else back to caisse
            setTimeout(() => {
              if (resp?.requiresApproval) {
                this.router.navigate(['/approvals']);
              } else {
                this.goToRegister();
              }
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

  // UI actions
  switchTab(tab: 'historique' | 'cloture'): void {
    this.activeTab.set(tab);
  }

  scrollTo(sectionId: string): void {
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  toggleDetail(path: 'encaissement.clientPayments' | 'encaissement.advances' | 'encaissement.cash' | 'decaissement.expenses' | 'decaissement.suppliers' | 'alimentations.expanded'): void {
    const current = this.showDetails();
    const updated = JSON.parse(JSON.stringify(current));
    const [group, key] = path.split('.') as [keyof typeof current, string];
    updated[group][key] = !updated[group][key];
    this.showDetails.set(updated);
  }

  // Préparer la clôture checklist (simple heuristics)
  getPreparationChecklist(): Array<{ label: string; ok: boolean }> {
    const expectedCash = parseFloat((this.currentSession()?.summary?.expectedCash as any) || 0) || 0;
    const sales = parseFloat((this.currentSession()?.summary?.totalSales as any) || 0) || 0;
    const credit = this.getCreditAmount();
    const computedCashFromSales = Math.max(0, sales - credit);
    const cashOk = Math.abs(expectedCash - (computedCashFromSales + this.getClientPaymentsTotal() + this.getTotalOrderAdvances() - this.getExpensesTotal() - this.getSupplierPaymentsTotal())) < 0.01;
    return [
      { label: 'Écarts de caisse', ok: cashOk },
      { label: 'Doublons potentiels', ok: true },
      { label: 'Pièces manquantes', ok: true }
    ];
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

  exportSessionData(): void {
    const session = this.currentSession();
    if (!session) {
      this.error.set('Aucune session active trouvée');
      return;
    }

    this.loading.set(true);
    
    // Get session report data
    this.sessionsService.getSessionReport(session.id, 'Z').subscribe({
      next: (sessionReport) => {
        // Prepare export data
        const exportData = {
          sessionInfo: {
            id: session.id,
            openedAt: session.openedAt,
            user: session.user,
            depot: sessionReport.session?.depot,
            openingFund: session.openingFund
          },
          summary: {
            totalSales: sessionReport.summary?.totalSales || 0,
            totalTickets: sessionReport.summary?.totalTickets || 0,
            expectedCash: sessionReport.summary?.expectedCash || 0,
            creditAmount: this.getCreditAmount(),
            clientPaymentsTotal: this.getClientPaymentsTotal(),
            totalOrderAdvances: this.getTotalOrderAdvances(),
            expensesTotal: this.getExpensesTotal(),
            supplierPaymentsTotal: this.getSupplierPaymentsTotal(),
            cashFromSales: this.getCashFromSalesNetOfCredit()
          },
          sales: sessionReport.session?.sales || [],
          cashMovements: sessionReport.session?.cashMovements || [],
          families: sessionReport.families || [],
          exportDate: new Date().toISOString(),
          exportType: 'session_closure'
        };

        // Create and download JSON file
        const dataStr = JSON.stringify(exportData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `session_${session.id}_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        this.loading.set(false);
        this.error.set('');
      },
      error: (error) => {
        this.error.set('Erreur lors de l\'export des données: ' + (error.error?.error || error.message || 'Erreur inconnue'));
        this.loading.set(false);
      }
    });
  }

  // Depot search removed
} 