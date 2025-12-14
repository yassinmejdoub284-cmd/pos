import { Component, OnInit, OnDestroy, signal, computed, inject, HostListener } from '@angular/core';
import { Observable, forkJoin, of } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { SessionsService, SessionCaisse, SessionFilters, CashMovementRequest, CloseSessionRequest, OpenSessionRequest } from '../../core/services/sessions.service';
import { AuthService } from '../../core/services/auth.service';
import { PrintService } from '../../core/services/print.service';
import { DailyExtractService } from '../../core/services/daily-extract.service';
import { SettingsService, AppSettings } from '../../core/services/settings.service';
import { DepotsService } from '../../core/services/depots.service';
import { TicketCounterService } from '../../core/services/ticket-counter.service';
import { SalesService } from '../../core/services/sales.service';
import { Sale } from '../../core/models/sale.model';
import { ExpenseService, Expense } from '../../core/services/expense.service';
import { Depot } from '../../core/models/depot.model';
import { Router } from '@angular/router';

export interface ReleveEntry {
  date: Date;
  designation: string;
  debit: number;
  credit: number;
  solde: number;
  sessionId?: number; // Add session ID to track which session this entry belongs to
}

@Component({
  selector: 'app-sessions-history',
  standalone: false,
  templateUrl: './sessions-history.component.html',
  styleUrls: ['./sessions-history.component.css']
})
export class SessionsHistoryComponent implements OnInit, OnDestroy {
  private readonly sessionsService = inject(SessionsService);
  private readonly authService = inject(AuthService);
  private readonly printService = inject(PrintService);
  private readonly dailyExtractService = inject(DailyExtractService);
  private readonly settingsService = inject(SettingsService);
  private readonly depotsService = inject(DepotsService);
  private readonly ticketCounterService = inject(TicketCounterService);
  private readonly salesService = inject(SalesService);
  private readonly expenseService = inject(ExpenseService);

  loading = signal(false);
  loadingDetails = signal(false);
  error = signal('');
  
  // Dropdown states
  showFamilyDropdown = false;
  showArticleDropdown = false;



  sessions = signal<SessionCaisse[]>([]);
  selectedSession = signal<SessionCaisse | null>(null);
  settings: AppSettings | null = null;

  // UI state (copied from ClotureComponent)
  showCloseForm = signal(false);
  showFundForm = signal(false);
  showAdjustForm = signal(false);
  activeTab = signal<'historique' | 'cloture'>('cloture');
  showDetails = signal({
    encaissement: { clientPayments: false, advances: false, cash: false },
    decaissement: { expenses: false, suppliers: false },
    alimentations: { expanded: false }
  });
  
  // Tickets modal state
  showTicketsModal = signal(false);
  sessionTickets = signal<Array<{ id: number; amount: number; totalAmount?: number; createdAt?: string | Date }>>([]);
  ticketsMoreFlag = false;
  ticketsTotal = computed(() => this.sessionTickets().reduce((sum, t) => sum + t.amount, 0));

  // Full-screen session selection modal state
  showSessionSelectionModal = signal(false);

  // Relevé Caisse modal states
  showReleveCaisseModal = signal(false);
  showDateRangeModal = signal(false);
  showReleveResultsModal = signal(false);
  releveDateFrom = '';
  releveDateTo = '';
  releveEntries = signal<ReleveEntry[]>([]);
  releveTitle = signal('');
  
  
  // Expense details modal state
  showExpenseDetailsModal = signal(false);
  expenseDetails = signal<Array<{ id: number; amount: number; reason: string; createdAt: string; categoryName?: string; supplierName?: string; notes?: string }>>([]);
  expenseDetailsTitle = signal('');

  // Credit sales details modal state
  showCreditSalesDetailsModal = signal(false);
  creditSalesDetails = signal<Array<{ id: number; saleId: number; amount: number; saleTotal: number; paidAmount: number; clientName: string; createdAt: string; ticketNumber?: number | string }>>([]);
  creditSalesDetailsTitle = signal('');

  // Cash sales detail state
  cashSalesDetails = signal<{ id: number; paidAmount: number; totalAmount: number; status?: string; createdAt?: string; dailyTicketNumber?: number | string }[]>([]);
  cashSalesLoading = signal(false);
  // UI local toggles for cash sales "voir plus"
  cashMoreMainFlag = false;
  cashMoreSchemaFlag = false;
  cashMoreExpandedFlag = false;
  // Ticket items expansion state
  expandedTicketId = signal<number | null>(null);
  private ticketItemsById = signal<Record<number, Array<{ name: string; quantity: number; unitPrice: number; total: number }>>>({});

  // Detailed flows modal state
  showFlowsModal = signal(false);
  flowsDateFrom = signal<string>('');
  flowsDateTo = signal<string>('');
  flowsDepotId = signal<number | null>(null);
  flowsSearch = signal('');
  checked_schema: boolean = false;

  // App settings stream for template consumption
  settings$!: Observable<AppSettings>;

  // Close session form - only withdrawal
  closeSessionForm = {
    retraitCentrale: ''
  };
  
  // Fund form
  fundForm = {
    amount: ''
  };
  
  // Adjust balance form
  adjustForm = {
    newBalance: ''
  };

  // Refresh control
  private refreshIntervalId: any;
  private isRefreshing = false;
  isAdminUser = false;

  ngOnInit(): void {
    this.settings$ = this.settingsService.getSettings();
    this.isAdminUser = this.authService.isAdmin();
    this.initializeDefaultDateRange();
    this.loadSessions();
  }

  ngOnDestroy(): void {
    if (this.refreshIntervalId) {
      clearInterval(this.refreshIntervalId);
      this.refreshIntervalId = null;
    }
  }

  initializeDefaultDateRange(): void {
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    
    // Format dates as YYYY-MM-DD for date inputs
    this.releveDateFrom = firstDayOfMonth.toISOString().split('T')[0];
    this.releveDateTo = today.toISOString().split('T')[0];
  }


  loadSettings(after?: () => void): void {
    this.settingsService.getSettings().subscribe({
      next: (settings: any) => {
        // Load sessions based on historyRetentionDays setting
        const sessionLimit = Number((settings as any).historyRetentionDays || 10);
        this.loadRecentSessions(sessionLimit, after);
      },
      error: (error) => {
        console.error('Error loading settings:', error);
        // Fallback to default session limit
        this.loadRecentSessions(10, after);
      }
    });
  }

  loadRecentSessions(limit: number, after?: () => void): void {

    this.sessionsService.getSessions({ 
      limit: limit
    }).subscribe({
      next: (sessions: any) => {

        // Sort sessions by openedAt/createdAt (newest first) and keep only last N
        const sorted = (sessions || [])
          .slice()
          .sort((a: any, b: any) => {
            const aTime = new Date(a.openedAt ?? a.createdAt).getTime();
            const bTime = new Date(b.openedAt ?? b.createdAt).getTime();
            return bTime - aTime;
          })
          .slice(0, limit);


         this.sessions.set(sorted);
         // Auto-select first session if none selected and sessions exist
         if (sorted.length > 0 && !this.selectedSession()) {
           this.selectSession(sorted[0]);
         }
         this.loading.set(false);
         if (after) after();
      },
      error: (error) => {
        console.error('Error loading recent sessions:', error);
        this.error.set('Erreur lors du chargement des sessions');
        this.loading.set(false);
        if (after) after();
      }
    });
  }

  loadSessions(): void {
    this.loading.set(true);
    this.error.set('');
    this.loadSettings();
  }

  refreshSessions(): void {
    this.loadSessions();
  }

  selectSession(s: SessionCaisse): void {
    this.selectedSession.set(s);
    this.error.set(''); // Clear any previous errors
    // Automatically load detailed data when session is selected
    this.refreshDetails(s);
  }

  refreshDetails(session: SessionCaisse): void {
    this.loadingDetails.set(true);
    // fetch Z to enrich details and allow print/export
    this.sessionsService.getSessionReport(session.id, 'Z').subscribe({
      next: (report) => {

        const enriched: SessionCaisse = {
          ...session,
          cashMovements: report.session?.cashMovements || session.cashMovements,
          summary: report.summary || session.summary,
          // Include sales data from the report (same as cloture component)
          sales: report.session?.sales || (session as any)?.sales || []
        } as any;

        this.selectedSession.set(enriched);
        // Ensure cash sales list is populated using X/Z report sales
        this.loadCashSalesDetails();
        this.loadingDetails.set(false);
      },
      error: (err) => {
        console.error('Error loading session report:', err);
        this.error.set('Erreur lors du chargement des détails de la session');
        this.loadingDetails.set(false);
      }
    });
  }

  printX(session: SessionCaisse): void {
    this.sessionsService.getSessionReport(session.id, 'X', 'html').subscribe({
      next: (data) => this.printService.printXReport(data),
      error: () => {}
    });
  }

  printZ(session: SessionCaisse): void {
    this.sessionsService.getSessionReport(session.id, 'Z').subscribe({
      next: (data) => this.printService.printZReport(data),
      error: () => {}
    });
  }

  // ===== COPIED FROM CLOTURECOMPONENT =====

  // Resolve logo URL from settings (fallback to public logo)
  getLogoUrl(settings: AppSettings | null | undefined): string {
    const url = settings?.logoUrl || '';
    const abs = this.settingsService.getAbsoluteLogoUrl(url);
    return abs && abs.length > 0 ? abs : '/logo.webp';
  }

  async flowmodal_show(): Promise<void> {
    this.loading.set(true);
    await Promise.all([
      this.loadCashSalesDetails(),
    ]).then(() => {
      this.showFlowsModal.set(true);
      this.loading.set(false);
    }).catch(error => {
      this.error.set('Erreur lors du chargement des détails: ' + (error.error?.error || error.message || 'Erreur inconnue'));      
      this.loading.set(false);
    });
  }

  // Derived rows for entries/sorties
  getDetailedEntryRows(): Array<{ createdAt: string; label: string; amount: number }> {
    const session = this.selectedSession();
    if (!session) return [];

    const rows: Array<{ createdAt: string; label: string; amount: number }> = [];

    // Opening fund (initial cash in drawer at session start)
    const openingFund = parseFloat((session.openingFund as any) || 0) || 0;
    if (openingFund > 0) {
      rows.push({
        createdAt: session.openedAt as any,
        label: 'Fonds initial',
        amount: openingFund
      });
    }

    // Encaissements Crédit Clients (from server details)
    const clientPayments = ((session.summary as any)?.clientPaymentsDetails || []) as Array<any>;
    for (const p of clientPayments) {
      rows.push({
        createdAt: p.createdAt,
        label: `Encaissement client · ${p.clientName || 'Client'}`,
        amount: parseFloat(p.amount || 0) || 0
      });
    }

    // Acomptes / Avances sur commande (cash movements labeled accordingly)
    const movements = (session.cashMovements || []) as Array<any>;
    for (const m of movements) {
      const reasonLower = (m.reason || '').toLowerCase();
      const amount = parseFloat(m.amount || 0) || 0;
      const isAdvance = reasonLower.startsWith('acompte commande')
        || reasonLower.includes('acompte')
        || reasonLower.includes('avance')
        || reasonLower.includes('advance');
      if (m.type === 'ENTREE' && isAdvance && amount > 0) {
        rows.push({
          createdAt: m.createdAt,
          label: m.reason || 'Acompte commande',
          amount: amount
        });
      }
    }

    // Espèces en Caisse: list each cash-paid ticket (paidAmount)
    // CRITICAL: Only include CASH tickets - credit tickets are excluded because their payments are in "Encaissements Crédit Clients"
    // Note: cashSalesDetails() is already filtered to only include CASH tickets, but we double-check here
    for (const t of this.cashSalesDetails()) {
      const paymentMethod = ((t as any).paymentMethod || '').toUpperCase();
      const paymentType = ((t as any).paymentType || '').toUpperCase();
      const totalAmount = typeof t.totalAmount === 'number' ? t.totalAmount : parseFloat(String(t.totalAmount || 0)) || 0;
      const paidAmount = typeof t.paidAmount === 'number' ? t.paidAmount : parseFloat(String(t.paidAmount || 0)) || 0;
      const remainingBalance = totalAmount - paidAmount;
      
      // Double-check: exclude credit tickets even if they somehow got into cashSalesDetails
      if (paymentType === 'CREDIT') continue; // Explicit credit sale
      if (remainingBalance > 0.001) continue; // Has outstanding balance = credit sale
      if (paymentMethod !== 'CASH' && paymentType !== 'COMPTANT') continue;
      if (paidAmount <= 0) continue;
      
      rows.push({
        createdAt: new Date(this.selectedSession()!.openedAt).toISOString(),
        label: `Ticket N°${t.id}`,
        amount: t.paidAmount
      });
    }

    // Filter by search
    const q = this.flowsSearch().trim().toLowerCase();
    const filtered = q ? rows.filter(r => r.label.toLowerCase().includes(q)) : rows;

    // Sort desc by createdAt
    return filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  getDetailedExitRows(): Array<{ createdAt: string; label: string; amount: number }> {
    const session = this.selectedSession();
    if (!session) return [];

    const rows: Array<{ createdAt: string; label: string; amount: number }> = [];

    // Dépenses (use server details first)
    const expenses = ((session.summary as any)?.expensesDetails || []) as Array<any>;
    for (const e of expenses) {
      const parts: string[] = [];
      if (e.categoryName) parts.push(e.categoryName);
      if (e.supplierName) parts.push(`Fournisseur: ${e.supplierName}`);
      const label = parts.length ? parts.join(' · ') : (e.reason || 'Dépense');
      rows.push({
        createdAt: e.createdAt,
        label,
        amount: parseFloat(e.amount || 0) || 0
      });
    }

    // Règlements fournisseur (from cash movements)
    const movements = (session.cashMovements || []) as Array<any>;
    for (const m of movements) {
      const reasonLower = (m.reason || '').toLowerCase();
      const amount = parseFloat(m.amount || 0) || 0;
      const isSupplierPayment = reasonLower.includes('règlement fournisseur') || reasonLower.includes('reglement fournisseur');
      if (m.type === 'SORTIE' && isSupplierPayment && amount > 0) {
        rows.push({
          createdAt: m.createdAt,
          label: (m.reason || 'Règlement fournisseur').replace(/#\d+\s*\(FOURN:\d+\)/i, '').trim(),
          amount: amount
        });
      }
    }

    // Remboursements (from cash movements)
    for (const m of movements) {
      const reasonLower = (m.reason || '').toLowerCase();
      const amount = parseFloat(m.amount || 0) || 0;
      const isRefund = reasonLower.includes('remboursement') || reasonLower.includes('bon de retour');
      if (m.type === 'SORTIE' && isRefund && amount > 0) {
        rows.push({
          createdAt: m.createdAt,
          label: m.reason || 'Remboursement',
          amount: amount
        });
      }
    }

    // Filter by search
    const q = this.flowsSearch().trim().toLowerCase();
    const filtered = q ? rows.filter(r => r.label.toLowerCase().includes(q)) : rows;

    // Sort desc by createdAt
    return filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  getDetailedTotals() {
    const entries = this.getDetailedEntryRows();
    const sorties = this.getDetailedExitRows();
    const totalEntries = entries.reduce((s, r) => s + (parseFloat(r.amount as any) || 0), 0);
    const totalSorties = sorties.reduce((s, r) => s + (parseFloat(r.amount as any) || 0), 0);
    const net = totalEntries - totalSorties;
    return { totalEntries, totalSorties, net };
  }

  exportFlowsCsv(): void {
    const entries = this.getDetailedEntryRows();
    const sorties = this.getDetailedExitRows();
    const header = 'Type,Date,Designation,Montant';
    const rows = [
      ...entries.map(e => ['ENTREE', new Date(e.createdAt).toISOString(), e.label.replace(/,/g, ' '), (e.amount || 0).toFixed(3)].join(',')),
      ...sorties.map(s => ['SORTIE', new Date(s.createdAt).toISOString(), s.label.replace(/,/g, ' '), (s.amount || 0).toFixed(3)].join(','))
    ];
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `flux_caisse_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  printFlows(): void {
    const entries = this.getDetailedEntryRows();
    const sorties = this.getDetailedExitRows();
    const totals = this.getDetailedTotals();
    const popup = window.open('', '_blank');
    if (!popup) return;
    const html = `
      <html><head><title>Détail des flux de caisse</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 16px; }
        h1 { font-size: 18px; margin: 0 0 8px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 6px 8px; border-bottom: 1px solid #ddd; font-size: 12px; }
        th { position: sticky; top: 0; background: #f8fafc; }
        .right { text-align: right; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .totals { margin-top: 12px; text-align: center; font-weight: bold; }
      </style>
      </head><body>
      <h1>Détail des flux de caisse — Entrées / Sorties</h1>
      <div class="grid">
        <div>
          <table>
            <thead><tr><th>Entrées</th><th class="right">Montant</th></tr></thead>
            <tbody>
              ${entries.map(e => `<tr><td>${e.label}</td><td class="right">${(e.amount || 0).toFixed(3)}</td></tr>`).join('')}
            </tbody>
          </table>
        </div>
        <div>
          <table>
            <thead><tr><th>Sorties</th><th class="right">Montant</th></tr></thead>
            <tbody>
              ${sorties.map(s => `<tr><td>${s.label}</td><td class="right">${(s.amount || 0).toFixed(3)}</td></tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
      <div class="totals">Total Entrées: ${(totals.totalEntries).toFixed(3)} — Total Sorties: ${(totals.totalSorties).toFixed(3)} — Solde net: ${(totals.net).toFixed(3)}</div>
      <script>window.print();</script>
      </body></html>`;
    popup.document.write(html);
    popup.document.close();
  }

  // Crédit and supplier payments helpers
  getCreditAmount(): number {
    const session = this.selectedSession();
    if (!session) return 0;
    
    const summary: any = session?.summary || {};
    // Use creditSalesTotal (total credit sales) if available
    // This represents the total amount of credit sales (sum of all DEBT transactions)
    if (summary.creditSalesTotal !== undefined && summary.creditSalesTotal !== null) {
      const creditFromSummary = parseFloat(summary.creditSalesTotal || 0) || 0;
      if (creditFromSummary > 0) {
        return creditFromSummary;
      }
    }
    
    // Fallback: calculate from sales array (same as cloture component)
    const sales = ((session as any)?.sales || []) as any[];
    if (sales.length > 0) {
      return sales.reduce((total: number, sale: any) => {
        const paymentType = (sale.paymentType || sale.paymentMethod?.type || '').toUpperCase();
        const status = (sale.status || '').toUpperCase();
        
        // Only include active credit sales
        if (paymentType === 'CREDIT' && !['CANCELLED', 'REFUNDED'].includes(status)) {
          const finalTotal = parseFloat(sale.finalTotal || 0) || 0;
          return total + finalTotal;
        }
        return total;
      }, 0);
    }
    
    // Final fallback: calculate from salesByPayment if available
    const credit = (summary.salesByPayment?.CREDIT?.amount) || 0;
    return parseFloat(credit) || 0;
  }

  // Recent movements helper (pure)
  getRecentMovements(limit: number, predicate: (m: any) => boolean): Array<{ createdAt: string; type: string; reason: string; amount: number }> {
    const movements = (this.selectedSession()?.cashMovements || []) as any[];
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
    const details = (this.selectedSession()?.summary as any)?.clientPaymentsDetails as Array<any> | undefined;
    if (details && details.length) {
      return details.slice(0, 10).map(d => {
        // If payment is linked to a sale (credit ticket payment), show ticket number
        const ticketInfo = d.ticketNumber ? ` · Ticket #${d.ticketNumber}` : '';
        return {
          createdAt: d.createdAt,
          type: 'ENTREE',
          reason: `Encaissement client · ${d.clientName || 'Client'}${ticketInfo}`,
          amount: parseFloat(d.amount || 0) || 0
        };
      });
    }
    return this.getRecentMovements(10, (m: any) => m.type === 'ENTREE' && (((m.reason || '').toLowerCase().includes('crédit')) || ((m.reason || '').toLowerCase().includes('credit'))));
  }

  recentOrderAdvances(): Array<{ createdAt: string; type: string; reason: string; amount: number }> {
    return this.getRecentMovements(10, (m: any) => m.type === 'ENTREE' && ((m.reason || '').toLowerCase().startsWith('acompte')));
  }

  // Funding (Alimentation de caisse)
  recentFundings(): Array<{ createdAt: string; type: string; reason: string; amount: number }> {
    const isFunding = (reason: string | undefined | null): boolean => {
      const r = (reason || '').toLowerCase();
      return r.includes('fonds de caisse') || r.includes('alimentation') || r.includes('alimenter');
    };
    return this.getRecentMovements(10, (m: any) => m.type === 'ENTREE' && isFunding(m.reason));
  }

  getFundingsTotal(): number {
    const movements = (this.selectedSession()?.cashMovements || []) as any[];
    return movements
      .filter((m: any) => (m?.type === 'ENTREE') && ((m?.reason || '').toLowerCase().includes('fonds de caisse') || (m?.reason || '').toLowerCase().includes('alimentation') || (m?.reason || '').toLowerCase().includes('alimenter')))
      .reduce((sum, m: any) => sum + (parseFloat(m.amount || 0) || 0), 0);
  }

  recentExpenses(): Array<{ createdAt: string; type: string; reason: string; amount: number; categoryName?: string | null; supplierName?: string | null; notes?: string | null }> {
    // Prefer server-provided details if any
    const details = (this.selectedSession()?.summary as any)?.expensesDetails as Array<any> | undefined;
    if (details && details.length) {
      return details.slice(0, 10).map(d => {
        const fullReason: string = d.reason || '';
        let categoryName: string | null = null;
        let supplierName: string | null = null;

        // First, try split by bullet separators
        const parts = fullReason.split(' · ').map(p => p.trim());
        if (parts.length >= 2 && !parts[1].toLowerCase().startsWith('fournisseur')) {
          categoryName = parts[1];
        }
        const supplierPart = parts.find(p => p.toLowerCase().startsWith('fournisseur'));
        if (supplierPart) {
          const m = supplierPart.match(/Fournisseur:\s*(.+)$/i);
          if (m && m[1]) supplierName = m[1].trim();
        }

        // Fallback: parse after colon format, e.g., "Dépense approuvée #1: Achat Consommé"
        if (!categoryName) {
          const colonIdx = fullReason.indexOf(':');
          if (colonIdx >= 0 && colonIdx < fullReason.length - 1) {
            const afterColon = fullReason.substring(colonIdx + 1).trim();
            if (afterColon && !/^fournisseur\s*:/i.test(afterColon)) {
              categoryName = afterColon;
            }
          }
        }

        // Also search anywhere for Fournisseur: <name>
        if (!supplierName) {
          const m2 = fullReason.match(/Fournisseur:\s*(.+)$/i);
          if (m2 && m2[1]) supplierName = m2[1].trim();
        }

        return ({
          createdAt: d.createdAt,
          type: 'SORTIE',
          reason: fullReason,
          amount: d.amount,
          categoryName,
          supplierName,
          notes: d.notes || null
        });
      });
    }
    // Fallback to movements with expense-like reason
    return this.getRecentMovements(10, (m: any) => m.type === 'SORTIE' && (((m.reason || '').toLowerCase().includes('dépense')) || ((m.reason || '').toLowerCase().includes('depense'))));
  }

  recentSupplierPayments(): Array<{ createdAt: string; type: string; reason: string; amount: number }> {
    // Only actual debit movements recorded in caisse, enriched with supplier name when available
    const movements = (this.selectedSession()?.cashMovements || []) as any[];
    const details = (this.selectedSession()?.summary as any)?.supplierPaymentsDetails as Array<any> | undefined;

    return movements
      .filter(m => {
        const reasonLower = (m.reason || '').toLowerCase();
        const isSupplierPayment = reasonLower.includes('règlement fournisseur') || reasonLower.includes('reglement fournisseur');
        const amount = parseFloat((m as any).amount || 0) || 0;
        return m.type === 'SORTIE' && isSupplierPayment && amount > 0;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10)
      .map(m => {
        const reason: string = m.reason || '';
        let supplierName: string | null = null;

        // Try to extract supplierPayment id from reason: "Règlement fournisseur #<id> (FOURN:<supplierId>)"
        const idMatch = reason.match(/#(\d+)/);
        const paymentId = idMatch ? parseInt(idMatch[1], 10) : null;

        if (details && details.length && paymentId) {
          const match = details.find(d => Number(d.id) === paymentId);
          if (match && match.supplierName) {
            supplierName = match.supplierName;
          }
        }

        // Fallback: if reason contains a name in parentheses not just the FOURN code, try to extract
        if (!supplierName) {
          const paren = reason.match(/\(([^)]+)\)/);
          if (paren && paren[1] && !/^FOURN:/i.test(paren[1])) {
            supplierName = paren[1].trim();
          }
        }

        const nameForDisplay = supplierName || 'Fournisseur';
        return ({
          createdAt: m.createdAt,
          type: 'SORTIE',
          reason: `Règlement fournisseur · ${nameForDisplay}`,
          amount: parseFloat((m as any).amount || 0) || 0
        });
      });
  }

  private isWithinSelectedSessionWindow(m: any): boolean {
    const s = this.selectedSession();
    if (!s) return false;
    const start = new Date(s.openedAt).getTime();
    const end = s.closedAt ? new Date(s.closedAt).getTime() : Date.now();
    const t = new Date(m.createdAt || m.date).getTime();
    return !isNaN(t) && t >= start && t <= end;
  }

  getSupplierPaymentsTotal(): number {
    const s = this.selectedSession();
    const summary: any = s?.summary || {};
    // Prefer server summary details per session if available
    if (Array.isArray(summary.supplierPaymentsDetails) && summary.supplierPaymentsDetails.length > 0) {
      return summary.supplierPaymentsDetails.reduce((sum: number, p: any) => sum + (parseFloat(p.amount || 0) || 0), 0);
    }
    const movements = s?.cashMovements || [];
    return movements
      .filter(m => {
        const reasonLower = (m.reason || '').toLowerCase();
        const isSupplierPayment = reasonLower.includes('règlement fournisseur') || reasonLower.includes('reglement fournisseur');
        const amount = parseFloat((m as any).amount || 0) || 0;
        const sameSession = (m as any).sessionId ? (m as any).sessionId === s?.id : this.isWithinSelectedSessionWindow(m);
        return sameSession && m.type === 'SORTIE' && isSupplierPayment && amount > 0;
      })
      .reduce((sum, m) => sum + (parseFloat((m as any).amount) || 0), 0);
  }

  getDecaissementTotal(): number {
    // Get total of all sorties (cash outflows) from session summary
    // Same formula as cloture component
    const session = this.selectedSession();
    const summary: any = session?.summary || {};
    // Use sortie from summary if available (includes all SORTIE, DEPOT_COFFRE, RETRAIT_CENTRALE)
    const sortieFromSummary = parseFloat(summary.sortie || 0) || 0;
    if (sortieFromSummary > 0) {
      return sortieFromSummary;
    }
    
    // Fallback: calculate from movements
    const movements = session?.cashMovements || [];
    return movements
      .filter(m => {
        const reason = String(m.reason || '');
        const reasonLower = reason.toLowerCase();
        const amount = parseFloat((m as any).amount || 0) || 0;
        const isBonRetour = reasonLower.includes('bon de retour');
        return ['SORTIE', 'DEPOT_COFFRE', 'RETRAIT_CENTRALE'].includes(m.type) && 
               amount > 0 && 
               !reason.includes('[REJETÉ]') && 
               !reason.includes('[SUPPRIMÉ]') &&
               !isBonRetour;
      })
      .reduce((sum, m) => sum + (parseFloat((m as any).amount) || 0), 0);
  }

  // Refunds (Remboursements)
  recentRefunds(): Array<{ createdAt: string; type: string; reason: string; amount: number }> {
    const s = this.selectedSession();
    const movements = (s?.cashMovements || []) as any[];
    return movements
      .filter(m => {
        const reasonLower = (m.reason || '').toLowerCase();
        const isRefund = reasonLower.includes('remboursement') || reasonLower.includes('bon de retour');
        const amount = parseFloat((m as any).amount || 0) || 0;
        const sameSession = (m as any).sessionId ? (m as any).sessionId === s?.id : this.isWithinSelectedSessionWindow(m);
        return sameSession && m.type === 'SORTIE' && isRefund && amount > 0;
      })
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .slice(0, 10)
      .map(m => ({
        createdAt: m.createdAt,
        type: 'SORTIE',
        reason: m.reason || 'Remboursement',
        amount: parseFloat((m as any).amount || 0) || 0
      }));
  }

  getRefundsTotal(): number {
    const s = this.selectedSession();
    const movements = s?.cashMovements || [];
    return movements
      .filter(m => {
        const reasonLower = (m.reason || '').toLowerCase();
        const isRefund = reasonLower.includes('remboursement') || reasonLower.includes('bon de retour');
        const amount = parseFloat((m as any).amount || 0) || 0;
        const sameSession = (m as any).sessionId ? (m as any).sessionId === s?.id : this.isWithinSelectedSessionWindow(m);
        return sameSession && m.type === 'SORTIE' && isRefund && amount > 0;
      })
      .reduce((sum, m) => sum + (parseFloat((m as any).amount) || 0), 0);
  }

  getNetAfterAdjustments(): number {
    const totalSales = parseFloat((this.selectedSession()?.summary?.totalSales as any) || 0) || 0;
    const expectedCash = parseFloat((this.selectedSession()?.summary?.expectedCash as any) || 0) || 0;
    // Use creditOutstanding (outstanding credit) for cash calculations, not total credit sales
    const summary: any = this.selectedSession()?.summary || {};
    const creditOutstanding = parseFloat(summary.creditOutstanding || 0) || 0;
    const supplierRegs = this.getSupplierPaymentsTotal();
    return totalSales + expectedCash - creditOutstanding - supplierRegs;
  }

  // New computed helpers
  getClientPaymentsTotal(): number {
    const summary: any = this.selectedSession()?.summary || {};
    // Only use server-provided client payments total (standalone payments without saleId)
    return parseFloat(summary.clientPaymentsTotal || 0) || 0;
  }

  getTotalOrderAdvances(): number {
    const s = this.selectedSession();
    const movements = s?.cashMovements || [];
    return movements
      .filter(m => {
        const reason = (m.reason || '').toLowerCase();
        const sameSession = (m as any).sessionId ? (m as any).sessionId === s?.id : this.isWithinSelectedSessionWindow(m);
        return sameSession && m.type === 'ENTREE' && (
          reason.startsWith('acompte commande') ||
          reason.includes('acompte') ||
          reason.includes('avance') ||
          reason.includes('advance')
        );
      })
      .reduce((sum, m) => sum + (parseFloat((m as any).amount) || 0), 0);
  }

  getCashFromSalesNetOfCredit(): number {
    // Sum up all paid amounts (cash portions of sales), excluding canceled tickets and cadeau tickets
    // Same formula as cloture component
    const session = this.selectedSession();
    if (!session) return 0;
    
    // Get sales data from session
    const sales = ((session as any)?.sales || []) as any[];
    
    // Sum up all paid amounts (cash portions of sales), excluding canceled tickets and cadeau tickets
    return sales.reduce((total: number, sale: any) => {
      const status = (sale.status || '').toUpperCase();
      // Exclude canceled, refunded, and cadeau tickets from encaissement
      // Cadeau tickets have amount = 0 and should only affect stock movements
      if (status === 'CANCELLED' || status === 'REFUNDED' || status === 'CADEAU' || status === 'PENDING_ADMIN') {
        return total;
      }
      const paidAmount = parseFloat(sale.paidAmount || 0) || 0;
      return total + paidAmount;
    }, 0);
  }

  getExpensesTotal(): number {
    // Compute strictly from cash movements of the selected session within the session window
    const s = this.selectedSession();
    const movements = s?.cashMovements || [];
    return movements
      .filter(m => {
        const sameSession = (m as any).sessionId ? (m as any).sessionId === s?.id : this.isWithinSelectedSessionWindow(m);
        const reasonLower = (m.reason || '').toLowerCase();
        const isExpense = reasonLower.includes('dépense') || reasonLower.includes('depense');
        const amount = parseFloat((m as any).amount || 0) || 0;
        return sameSession && m.type === 'SORTIE' && isExpense && amount > 0;
      })
      .reduce((sum, m) => sum + (parseFloat((m as any).amount) || 0), 0);
  }

  getComputedExpectedCash(): number {
    const opening = parseFloat((this.selectedSession()?.openingFund as any) || 0) || 0;
    const cashFromSales = this.getCashFromSalesNetOfCredit();
    const clientPayments = this.getClientPaymentsTotal();
    const orderAdvances = this.getTotalOrderAdvances();
    const expenses = this.getExpensesTotal();
    const supplierRegs = this.getSupplierPaymentsTotal();
    const refunds = this.getRefundsTotal();
    return opening + cashFromSales + clientPayments + orderAdvances - expenses - supplierRegs - refunds;
  }

  getOpeningFund(): number {
    return parseFloat((this.selectedSession()?.openingFund as any) || 0) || 0;
  }

  // Get user sales summary for display under solde de caisse
  getUserSalesSummary(): Array<{ userName: string; totalSales: number }> {
    const session = this.selectedSession();
    if (!session) return [];

    // Get sales data from session report if available
    const sales = (session as any).sales || [];
    if (!sales.length) return [];

    // Group sales by user
    const userSalesMap = new Map<string, number>();
    
    sales.forEach((sale: any) => {
      const userName = sale.user ? `${sale.user.firstName} ${sale.user.lastName}` : 'Utilisateur inconnu';
      const saleAmount = parseFloat(sale.finalTotal || sale.total || 0) || 0;
      
      if (userSalesMap.has(userName)) {
        userSalesMap.set(userName, userSalesMap.get(userName)! + saleAmount);
      } else {
        userSalesMap.set(userName, saleAmount);
      }
    });

    // Convert to array and sort by sales amount (descending)
    return Array.from(userSalesMap.entries())
      .map(([userName, totalSales]) => ({ userName, totalSales }))
      .sort((a, b) => b.totalSales - a.totalSales);
  }

  // Load and show current session tickets (id + amount)
  openTicketsModal(): void {
    const session = this.selectedSession();
    if (!session) return;
    this.loading.set(true);
    this.sessionsService.getSessionReport(session.id, 'Z').subscribe({
      next: (report: any) => {
        const sales = (report?.session?.sales || []) as Array<any>;
        this.sessionTickets.set(sales.map(s => ({
          id: s.id,
          amount: parseFloat((s.paidAmount ?? s.finalTotal ?? s.amount ?? 0) as any) || 0,
          totalAmount: s.totalAmount ?? s.finalTotal,
          createdAt: s.createdAt
        })));
        this.loading.set(false);
        this.showTicketsModal.set(true);
      },
      error: () => {
        this.error.set('Erreur lors du chargement des tickets');
        this.loading.set(false);
      }
    });
  }

  loadCashSalesDetails(): void {
    const session = this.selectedSession();
    if (!session || this.cashSalesLoading()) return;
    this.cashSalesLoading.set(true);
    this.sessionsService.getSessionReport(session.id, 'Z').subscribe({
      next: (report: any) => {
        const sales = (report?.session?.sales || []) as Array<any>;

        // Build items map for detail expansion
        const itemsMap: Record<number, Array<{ name: string; quantity: number; unitPrice: number; total: number }>> = {};

        const enriched = sales.map(sale => {
          const finalTotal = parseFloat((sale.finalTotal ?? sale.totalAmount ?? 0) as any) || 0;
          const explicitPaid = sale.paidAmount != null ? (parseFloat(sale.paidAmount as any) || 0) : undefined;
          let paidAmount = explicitPaid ?? 0;

          if (explicitPaid == null) {
            // Calculate paidAmount: finalTotal - DEBT for credit sales, or finalTotal for cash sales
            const method = String(sale.paymentMethod?.type || '').toUpperCase();
            if (method === 'CASH') {
              paidAmount = finalTotal;
            } else {
              // For credit sales, paidAmount is already calculated on server (finalTotal - DEBT)
              paidAmount = 0; // Will be set from paidAmount field if available
            }
          }

          // Normalize items for this sale
          const items = Array.isArray(sale.items) ? sale.items : [];
          itemsMap[sale.id] = items.map((it: any) => {
            const qty = parseFloat((it.quantity ?? it.qty ?? 0) as any) || 0;
            const total = parseFloat((it.total ?? it.lineTotal ?? it.subtotal ?? 0) as any) || 0;
            const unit = qty !== 0 ? total / qty : parseFloat((it.unitPrice ?? it.price ?? 0) as any) || 0;
            const name = (it.product?.name ?? it.name ?? 'Article') as string;
            return { name, quantity: qty, unitPrice: unit, total };
          });

          return {
            id: sale.id,
            paidAmount,
            totalAmount: finalTotal,
            createdAt: sale.createdAt,
            status: (sale.status || '').toString(),
            dailyTicketNumber: (sale as any)?.dailyTicketNumber || sale.id,
            paymentMethod: sale.paymentMethod?.type || sale.paymentType || '',
            paymentType: (sale.paymentType || sale.paymentMethod?.type || '').toUpperCase() // Store paymentType for filtering
          };
        });

        // Include ONLY CASH tickets with paidAmount > 0
        // CRITICAL: Exclude credit tickets - their payments are shown in "Encaissements Crédit Clients" only
        const cashSalesOnly = enriched
          .filter(s => {
            const status = (s.status || '').toUpperCase();
            // Exclude canceled, refunded, and gift tickets (CADEAU) from cash sales
            // Gift tickets have amount = 0 and should not be counted in encaissement
            if (status === 'CANCELLED' || status === 'REFUNDED' || status === 'CADEAU' || status === 'PENDING_ADMIN') {
              return false;
            }
            
            const paymentMethod = (s.paymentMethod || '').toUpperCase();
            const paymentType = ((s as any).paymentType || '').toUpperCase();
            const totalAmount = typeof s.totalAmount === 'number' ? s.totalAmount : parseFloat(String(s.totalAmount || 0)) || 0;
            const paidAmount = typeof s.paidAmount === 'number' ? s.paidAmount : parseFloat(String(s.paidAmount || 0)) || 0;
            const remainingBalance = totalAmount - paidAmount;
            
            // Exclude if:
            // 1. paymentMethod is not CASH
            // 2. paymentType is CREDIT (explicit credit sale)
            // 3. Has remaining balance > 0.001 (indicates credit sale with partial payment)
            // 4. paidAmount is 0 or negative
            if (paymentMethod !== 'CASH' && paymentType !== 'COMPTANT') return false;
            if (paymentType === 'CREDIT') return false; // Explicit credit sale
            if (remainingBalance > 0.001) return false; // Has outstanding balance = credit sale
            if (paidAmount <= 0) return false;
            
            return true;
          })
          .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

        this.ticketItemsById.set(itemsMap);
        this.cashSalesDetails.set(cashSalesOnly);
        this.cashSalesLoading.set(false);
      },
      error: () => {
        this.cashSalesLoading.set(false);
      }
    });
  }

  // Prefer session-local ticket numbering for display (e.g., #0005)
  getTicketDisplayNo(source: any): string {
    const candidate = source?.dailyTicketNumber
      ?? source?.sessionTicketNumber
      ?? source?.ticketNumber
      ?? source?.numero
      ?? source?.sessionIndex
      ?? source?.sessionSeq
      ?? null;
    const raw = candidate ?? source?.id;
    const num = parseInt(raw as any, 10);
    if (Number.isFinite(num)) {
      return num.toString().padStart(4, '0');
    }
    return String(raw ?? '');
  }

  toggleTicketDetails(ticketId: number): void {
    this.expandedTicketId.set(this.expandedTicketId() === ticketId ? null : ticketId);
  }

  getTicketItems(ticketId: number): Array<{ name: string; quantity: number; unitPrice: number; total: number }> {
    const map = this.ticketItemsById();
    return map[ticketId] || [];
  }

  getUniqueUsers(): number {
    const sessions = this.sessions();
    const uniqueUserIds = new Set(sessions.map(s => `${s.user?.firstName}-${s.user?.lastName}`).filter(name => name !== 'undefined-undefined'));
    return uniqueUserIds.size;
  }

  // Dropdown toggle methods
  toggleFamilyDropdown(): void {
    this.showFamilyDropdown = !this.showFamilyDropdown;
    this.showArticleDropdown = false; // Close other dropdown
  }

  toggleArticleDropdown(): void {
    this.showArticleDropdown = !this.showArticleDropdown;
    this.showFamilyDropdown = false; // Close other dropdown
  }

  // Close dropdowns when clicking outside
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.relative')) {
      this.showFamilyDropdown = false;
      this.showArticleDropdown = false;
    }
  }

  // New print methods for family and article grouping
  printWithFamily(session: SessionCaisse, format: 'A4' | '80mm' = 'A4'): void {
    if (!session) return;
    
    this.showFamilyDropdown = false; // Close dropdown after selection
    
    this.sessionsService.getSessionReport(session.id, 'Z').subscribe({
      next: (sessionReport) => {
        this.settingsService.getSettings().subscribe({
          next: (companyData) => {
            if (format === '80mm') {
              this.printService.printDetailedSessionReportWithFamilyGrouping80mm(sessionReport, companyData);
            } else {
              this.printService.printDetailedSessionReportWithFamilyGrouping(sessionReport, companyData);
            }
          },
          error: (error) => {
            console.error('Error fetching settings:', error);
            if (format === '80mm') {
              this.printService.printDetailedSessionReportWithFamilyGrouping80mm(sessionReport);
            } else {
              this.printService.printDetailedSessionReportWithFamilyGrouping(sessionReport);
            }
          }
        });
      },
      error: (error) => {
        this.error.set('Erreur lors de l\'impression du rapport avec famille');
      }
    });
  }

  printByArticle(session: SessionCaisse, format: 'A4' | '80mm' = 'A4'): void {
    if (!session) return;
    
    this.showArticleDropdown = false; // Close dropdown after selection
    
    this.sessionsService.getSessionReport(session.id, 'Z').subscribe({
      next: (sessionReport) => {
        this.settingsService.getSettings().subscribe({
          next: (companyData) => {
            if (format === '80mm') {
              this.printService.printDetailedSessionReportWithArticleGrouping80mm(sessionReport, companyData);
            } else {
              this.printService.printDetailedSessionReportWithArticleGrouping(sessionReport, companyData);
            }
          },
          error: (error) => {
            console.error('Error fetching settings:', error);
            if (format === '80mm') {
              this.printService.printDetailedSessionReportWithArticleGrouping80mm(sessionReport);
            } else {
              this.printService.printDetailedSessionReportWithArticleGrouping(sessionReport);
            }
          }
        });
      },
      error: (error) => {
        this.error.set('Erreur lors de l\'impression du rapport par article');
      }
    });
  }

  getActiveSessionsCount(): number {
    return this.sessions().filter(s => s.status === 'OPEN').length;
  }

  getClosedSessionsCount(): number {
    return this.sessions().filter(s => s.status === 'CLOSED').length;
  }

  // Calculate total amount withdrawn from cash register by responsible person
  getTotalWithdrawnAmount(): number {
    const session = this.selectedSession();
    if (!session) return 0;

    // First try to get computedWithdrawal from session summary
    const summary = session.summary as any;
    if (summary?.computedWithdrawal !== undefined) {
      return parseFloat(summary.computedWithdrawal) || 0;
    }

    // Fallback: calculate from cash movements
    if (session.cashMovements) {
      let totalWithdrawn = 0;
      session.cashMovements.forEach(movement => {
        // Count withdrawals (SORTIE, DEPOT_COFFRE, RETRAIT_CENTRALE)
        if (movement.type === 'SORTIE' || movement.type === 'DEPOT_COFFRE' || movement.type === 'RETRAIT_CENTRALE') {
          totalWithdrawn += parseFloat(movement.amount as any) || 0;
        }
      });
      return totalWithdrawn;
    }

    return 0;
  }

  // Navigation methods
  canNavigatePrevious(): boolean {
    const currentSession = this.selectedSession();
    if (!currentSession) return false;
    const currentIndex = this.sessions().findIndex(s => s.id === currentSession.id);
    return currentIndex > 0;
  }

  canNavigateNext(): boolean {
    const currentSession = this.selectedSession();
    if (!currentSession) return false;
    const currentIndex = this.sessions().findIndex(s => s.id === currentSession.id);
    return currentIndex < this.sessions().length - 1;
  }

  navigateToPreviousSession(): void {
    if (!this.canNavigatePrevious()) return;
    const currentSession = this.selectedSession();
    if (!currentSession) return;
    const currentIndex = this.sessions().findIndex(s => s.id === currentSession.id);
    const previousSession = this.sessions()[currentIndex - 1];
    this.selectSession(previousSession);
  }

  navigateToNextSession(): void {
    if (!this.canNavigateNext()) return;
    const currentSession = this.selectedSession();
    if (!currentSession) return;
    const currentIndex = this.sessions().findIndex(s => s.id === currentSession.id);
    const nextSession = this.sessions()[currentIndex + 1];
    this.selectSession(nextSession);
  }

  router = inject(Router);

  goBackToReports(): void {
    this.router.navigate(['/rapports']);
  }

  // Schema helpers: open Encaissement section and specific client payments detail
  public openEncaissementSection(): void {
    const section = document.getElementById('schema-left-open') as HTMLInputElement | null;
    if (section && !section.checked) {
      section.click();
    }
  }

  public openEncaissementClientPayments(): void {
    this.openEncaissementSection();
    const detail = document.getElementById('schema-client-payments-open') as HTMLInputElement | null;
    if (detail && !detail.checked) {
      detail.click();
    }
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

    if (path === 'encaissement.cash' && updated.encaissement.cash) {
      this.loadCashSalesDetails();
    }
  }

  // Préparer la clôture checklist (simple heuristics)
  getPreparationChecklist(): Array<{ label: string; ok: boolean }> {
    const expectedCash = parseFloat((this.selectedSession()?.summary?.expectedCash as any) || 0) || 0;
    const sales = parseFloat((this.selectedSession()?.summary?.totalSales as any) || 0) || 0;
    // Use creditOutstanding (outstanding credit) for cash calculations, not total credit sales
    const summary: any = this.selectedSession()?.summary || {};
    const creditOutstanding = parseFloat(summary.creditOutstanding || 0) || 0;
    const computedCashFromSales = Math.max(0, sales - creditOutstanding);
    const cashOk = Math.abs(expectedCash - (computedCashFromSales + this.getClientPaymentsTotal() + this.getTotalOrderAdvances() - this.getExpensesTotal() - this.getSupplierPaymentsTotal())) < 0.01;
    return [
      { label: 'Écarts de caisse', ok: cashOk },
      { label: 'Doublons potentiels', ok: true },
      { label: 'Pièces manquantes', ok: true }
    ];
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
    const session = this.selectedSession();
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
        this.refreshDetails(session);
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

  adjustBalance(): void {
    const session = this.selectedSession();
    if (!session) {
      this.error.set('Aucune session active trouvée');
      return;
    }

    const currentBalance = parseFloat((session.summary?.expectedCash as any) || 0) || 0;
    const targetBalance = parseFloat(this.adjustForm.newBalance) || 0;
    const delta = targetBalance - currentBalance;

    if (Math.abs(delta) < 0.001) {
      // No adjustment needed
      this.showAdjustForm.set(false);
      this.adjustForm.newBalance = '';
      return;
    }

    this.loading.set(true);
    
    // Add cash movement for balance adjustment
    this.sessionsService.addCashMovement(session.id, {
      type: delta > 0 ? 'ENTREE' : 'SORTIE',
      amount: Math.abs(delta),
      reason: `Ajustement solde : ${delta > 0 ? '+' : ''}${delta.toFixed(3)} DT (Ancien: ${currentBalance.toFixed(3)}, Nouveau: ${targetBalance.toFixed(3)})`
    }).subscribe({
      next: () => {
        this.showAdjustForm.set(false);
        this.adjustForm.newBalance = '';
        this.loading.set(false);
        this.error.set('');
        // Refresh session data
        this.refreshDetails(session);
      },
      error: (error) => {
        this.error.set('Erreur lors de l\'ajustement du solde: ' + (error.error?.error || error.message || 'Erreur inconnue'));
        this.loading.set(false);
      }
    });
  }

  addAdjustDigit(digit: string): void {
    const current = this.adjustForm.newBalance.toString();
    
    if (digit === '.') {
      // Only allow one decimal point
      if (!current.includes('.')) {
        this.adjustForm.newBalance = current + '.';
      }
    } else {
      // Add digit
      if (current === '0' || current === '') {
        this.adjustForm.newBalance = digit;
      } else {
        this.adjustForm.newBalance = current + digit;
      }
    }
  }

  clearAdjustAmount(): void {
    this.adjustForm.newBalance = '';
  }

  exportSessionData(): void {
    const session = this.selectedSession();
    if (!session) {
      this.error.set('Aucune session active trouvée');
      return;
    }

    this.loading.set(true);
    
    this.sessionsService.getSessionReport(session.id, 'Z').subscribe({
      next: (sessionReport) => {
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

  exportSessionDataByFamily(session: SessionCaisse): void {
    if (!session) {
      this.error.set('Aucune session active trouvée');
      return;
    }

    this.showFamilyDropdown = false;
    this.loading.set(true);
    
    this.sessionsService.getSessionReport(session.id, 'Z').subscribe({
      next: (sessionReport) => {
        const sales: any[] = (sessionReport?.session?.sales || []) as any[];
        const familyArticleTotals: Record<string, Record<string, { quantity: number; total: number; discount: number }>> = {};

        if (sales.length) {
          for (const sale of sales) {
            const status = (sale.status || '').toUpperCase();
            if (status === 'CANCELLED' || status === 'REFUNDED') {
              continue;
            }

            const items: any[] = (sale.items || []) as any[];
            for (const it of items) {
              const productName: string = (it.productName || it.product?.name || it.name || 'Produit').toString();
              const familyName: string = (it.product?.famille?.name || it.product?.family?.name || it.familyName || 'Sans famille').toString();
              const qty: number = parseFloat(String(it.quantity ?? it.qty ?? 0)) || 0;
              const lineTotal: number = parseFloat(String(it.total ?? it.revenue ?? it.amount ?? 0)) || 0;
              const lineDiscount: number = parseFloat(String(it.discount ?? 0)) || 0;
              
              if (!familyArticleTotals[familyName]) {
                familyArticleTotals[familyName] = {};
              }
              
              if (!familyArticleTotals[familyName][productName]) {
                familyArticleTotals[familyName][productName] = { quantity: 0, total: 0, discount: 0 };
              }
              
              familyArticleTotals[familyName][productName].quantity += qty;
              familyArticleTotals[familyName][productName].total += lineTotal;
              familyArticleTotals[familyName][productName].discount += lineDiscount;
            }
          }
        }

        const families = Object.keys(familyArticleTotals).sort().map(familyName => {
          const articles = Object.keys(familyArticleTotals[familyName]).sort().map(articleName => ({
            nom: articleName,
            quantite: familyArticleTotals[familyName][articleName].quantity,
            total: familyArticleTotals[familyName][articleName].total,
            remise: familyArticleTotals[familyName][articleName].discount
          }));

          const familyTotal = articles.reduce((sum, art) => sum + art.total, 0);
          const familyDiscount = articles.reduce((sum, art) => sum + art.remise, 0);

          return {
            nom: familyName,
            articles: articles,
            total: familyTotal,
            remise: familyDiscount
          };
        });

        const exportData = {
          sessionInfo: {
            id: session.id,
            openedAt: session.openedAt,
            closedAt: session.closedAt,
            user: session.user,
            depot: sessionReport.session?.depot,
            openingFund: session.openingFund
          },
          summary: {
            totalSales: sessionReport.summary?.totalSales || 0,
            totalTickets: sessionReport.summary?.totalTickets || 0,
            expectedCash: sessionReport.summary?.expectedCash || 0
          },
          familles: families,
          exportDate: new Date().toISOString(),
          exportType: 'session_by_family'
        };

        const dataStr = JSON.stringify(exportData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `session_${session.id}_par_famille_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        this.loading.set(false);
        this.error.set('');
      },
      error: (error) => {
        this.error.set('Erreur lors de l\'export par famille: ' + (error.error?.error || error.message || 'Erreur inconnue'));
        this.loading.set(false);
      }
    });
  }

  exportSessionDataByArticle(session: SessionCaisse): void {
    if (!session) {
      this.error.set('Aucune session active trouvée');
      return;
    }

    this.showArticleDropdown = false;
    this.loading.set(true);
    
    this.sessionsService.getSessionReport(session.id, 'Z').subscribe({
      next: (sessionReport) => {
        const sales: any[] = (sessionReport?.session?.sales || []) as any[];
        const articleMap: Record<string, { 
          nom: string; 
          famille: string; 
          quantite: number; 
          total: number; 
          remise: number;
          productId?: number;
        }> = {};

        if (sales.length) {
          for (const sale of sales) {
            const status = (sale.status || '').toUpperCase();
            if (status === 'CANCELLED' || status === 'REFUNDED') {
              continue;
            }

            const items: any[] = (sale.items || []) as any[];
            for (const it of items) {
              const productName: string = (it.productName || it.product?.name || it.name || 'Produit').toString();
              const familyName: string = (it.product?.famille?.name || it.product?.family?.name || it.familyName || 'Sans famille').toString();
              const productId = it.product?.id || it.productId;
              const qty: number = parseFloat(String(it.quantity ?? it.qty ?? 0)) || 0;
              const lineTotal: number = parseFloat(String(it.total ?? it.revenue ?? it.amount ?? 0)) || 0;
              const lineDiscount: number = parseFloat(String(it.discount ?? 0)) || 0;
              
              const key = `${productName}_${productId || ''}`;
              
              if (!articleMap[key]) {
                articleMap[key] = {
                  nom: productName,
                  famille: familyName,
                  quantite: 0,
                  total: 0,
                  remise: 0,
                  productId: productId
                };
              }
              
              articleMap[key].quantite += qty;
              articleMap[key].total += lineTotal;
              articleMap[key].remise += lineDiscount;
            }
          }
        }

        const articles = Object.values(articleMap).sort((a, b) => {
          if (a.famille !== b.famille) {
            return a.famille.localeCompare(b.famille);
          }
          return a.nom.localeCompare(b.nom);
        });

        const exportData = {
          sessionInfo: {
            id: session.id,
            openedAt: session.openedAt,
            closedAt: session.closedAt,
            user: session.user,
            depot: sessionReport.session?.depot,
            openingFund: session.openingFund
          },
          summary: {
            totalSales: sessionReport.summary?.totalSales || 0,
            totalTickets: sessionReport.summary?.totalTickets || 0,
            expectedCash: sessionReport.summary?.expectedCash || 0
          },
          articles: articles,
          exportDate: new Date().toISOString(),
          exportType: 'session_by_article'
        };

        const dataStr = JSON.stringify(exportData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `session_${session.id}_par_article_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        this.loading.set(false);
        this.error.set('');
      },
      error: (error) => {
        this.error.set('Erreur lors de l\'export par article: ' + (error.error?.error || error.message || 'Erreur inconnue'));
        this.loading.set(false);
      }
    });
  }

  // Session selection modal methods
  openSessionSelectionModal(): void {
    this.loading.set(true);
    // Load summary data for all sessions before showing modal
    this.loadSessionsWithSummary(() => {
      this.showSessionSelectionModal.set(true);
      this.loading.set(false);
    });
  }

  private loadSessionsWithSummary(after?: () => void): void {
    const sessions = this.sessions();
    if (sessions.length === 0) {
      if (after) after();
      return;
    }

    // Check if sessions already have summary data
    const sessionsNeedingSummary = sessions.filter(session => 
      !session.summary || 
      (session.summary.totalSales === 0 && session.summary.expectedCash === 0)
    );

    if (sessionsNeedingSummary.length === 0) {
      // All sessions already have summary data
      if (after) after();
      return;
    }



    // Load summary for sessions that need it using forkJoin for better performance
    const summaryObservables = sessionsNeedingSummary.map(session => 
      this.sessionsService.getSessionReport(session.id, 'Z').pipe(
        tap(report => console.log(`Loaded summary for session ${session.id}:`, report)),
        catchError(error => {
          console.error(`Error loading summary for session ${session.id}:`, error);
          return of({ summary: session.summary, session: { cashMovements: session.cashMovements } });
        })
      )
    );

    forkJoin(summaryObservables).subscribe({
      next: (reports) => {
        // Update only the sessions that needed summary data
        const updatedSessions = sessions.map(session => {
          const needsSummary = sessionsNeedingSummary.find(s => s.id === session.id);
          if (needsSummary) {
            const reportIndex = sessionsNeedingSummary.findIndex(s => s.id === session.id);
            return {
              ...session,
              summary: reports[reportIndex]?.summary || session.summary,
              cashMovements: reports[reportIndex]?.session?.cashMovements || session.cashMovements
            };
          }
          return session;
        });
        
        this.sessions.set(updatedSessions);
        if (after) after();
      },
      error: (error) => {
        console.error('Error loading session summaries:', error);
        if (after) after();
      }
    });
  }

  closeSessionSelectionModal(): void {
    this.showSessionSelectionModal.set(false);
  }

  selectSessionFromModal(session: SessionCaisse): void {
    this.selectSession(session);
    this.closeSessionSelectionModal();
  }

  // Relevé Caisse Methods
  openReleveCaisseModal(): void {
    this.showReleveCaisseModal.set(true);
  }

  closeReleveCaisseModal(): void {
    this.showReleveCaisseModal.set(false);
  }

  openDateRangeModal(): void {
    // Refresh default date range when opening modal
    this.initializeDefaultDateRange();
    this.showDateRangeModal.set(true);
    this.closeReleveCaisseModal();
  }

  closeDateRangeModal(): void {
    this.showDateRangeModal.set(false);
  }

  generateReleveForCurrentSession(): void {
    const session = this.selectedSession();
    if (!session) {
      console.error('No session selected');
      return;
    }

    this.releveTitle.set(`Session #${session.id} - ${session.user?.firstName} ${session.user?.lastName}`);
    const fromDate = new Date(session.openedAt);
    const toDate = session.closedAt ? new Date(session.closedAt) : new Date();
    this.generateReleveEntries(fromDate, toDate, session.id);
    this.closeReleveCaisseModal();
    this.showReleveResultsModal.set(true);
  }

  generateReleveForDateRange(): void {
    if (!this.releveDateFrom || !this.releveDateTo) {
      console.error('Date range not specified');
      return;
    }

    // Parse date-only strings and set time to start/end of day
    const fromDate = new Date(this.releveDateFrom + 'T00:00:00');
    const toDate = new Date(this.releveDateTo + 'T23:59:59');
    
    this.releveTitle.set(`Période du ${fromDate.toLocaleDateString('fr-FR')} au ${toDate.toLocaleDateString('fr-FR')}`);
    this.generateReleveEntries(fromDate, toDate);
    this.closeDateRangeModal();
    this.showReleveResultsModal.set(true);
  }

  private generateReleveEntries(fromDate: Date, toDate: Date, sessionId?: number): void {
    const entries: ReleveEntry[] = [];
    let runningBalance = 0;
    

    // Ensure dates are valid Date objects
    const validFromDate = fromDate instanceof Date ? fromDate : new Date(fromDate);
    const validToDate = toDate instanceof Date ? toDate : new Date(toDate);

    // Validate dates
    if (isNaN(validFromDate.getTime()) || isNaN(validToDate.getTime())) {
      console.error('Invalid date range provided');
      return;
    }


    
    // Fetch session summaries with aggregated sales and expenses data
    const sessionSummariesQuery = this.sessionsService.getSessionSummaries({
      startDate: validFromDate.toISOString().split('T')[0],
      endDate: validToDate.toISOString().split('T')[0]
    });

    sessionSummariesQuery.subscribe({
      next: (sessionsWithSummaries) => {

        
        // Filter sessions by the specific sessionId if provided
        const sessionsInRange = sessionsWithSummaries.filter(session => {
          return (!sessionId || session.id === sessionId);
        });

        // Sort sessions by opening date
        sessionsInRange.sort((a, b) => new Date(a.openedAt).getTime() - new Date(b.openedAt).getTime());


        this.processReleveDataWithSummaries(sessionsInRange, entries, runningBalance, validFromDate, validToDate);
      },
      error: (error) => {
        console.error('Error fetching session summaries:', error);

        this.generateReleveEntriesFallback(fromDate, toDate, sessionId);
      }
    });
  }

  private addReleveEntry(
    entries: ReleveEntry[],
    currentBalance: number,
    date: Date | string,
    designation: string,
    debit: number,
    credit: number,
    sessionId?: number
  ): number {
    const safeDebit = parseFloat((debit as any) || 0) || 0;
    const safeCredit = parseFloat((credit as any) || 0) || 0;
    const newBalance = currentBalance + safeDebit - safeCredit;
    entries.push({
      date: new Date(date),
      designation,
      debit: safeDebit,
      credit: safeCredit,
      solde: newBalance,
      sessionId
    });
    return newBalance;
  }

  private processReleveData(sessionsInRange: SessionCaisse[], sales: Sale[], entries: ReleveEntry[], runningBalance: number, fromDate: Date, toDate: Date, expenses: Expense[] = []): void {
    // Determine initial balance: use first session's opening fund
    let initialBalance = 0;
    if (sessionsInRange.length > 0) {
      initialBalance = parseFloat((sessionsInRange[0].openingFund as any) || 0) || 0;
    }
    
    // Add "Solde initial" entry at the beginning
    let currentBalance = initialBalance;
    if (sessionsInRange.length > 0) {
      const firstSession = sessionsInRange[0];
      entries.push({
        date: new Date(firstSession.openedAt),
        designation: 'Solde initial',
        debit: initialBalance,
        credit: 0,
        solde: initialBalance,
        sessionId: firstSession.id
      });
    }
    
    // Collect all entries first, then sort by date (no session grouping)
    const allEntries: Array<{ date: Date; designation: string; debit: number; credit: number; sessionId?: number }> = [];
    
    sessionsInRange.forEach(session => {
      // Add detailed sales for this session
      const sessionSales = sales.filter(sale => sale.sessionId === session.id);
      sessionSales
        .sort((a, b) => new Date(a.createdAt as any).getTime() - new Date(b.createdAt as any).getTime())
        .forEach(sale => {
          const amount = parseFloat(String(sale.paidAmount ?? 0)) || 0;
          if (amount > 0) {
            allEntries.push({
              date: new Date(sale.createdAt as any),
              designation: `Vente ticket #${sale.dailyTicketNumber || sale.id}`,
              debit: amount,
              credit: 0,
              sessionId: session.id
            });
          }
        });

      // Add expenses for this session (fallback path with expenses list)
      if (expenses && expenses.length) {
        const sessionStart = new Date(session.openedAt);
        const sessionEnd = session.closedAt ? new Date(session.closedAt) : new Date(toDate);
        const sessionExpenses = expenses.filter(e => {
          const d = new Date((e as any).createdAt || (e as any).approvedAt || (e as any).date);
          return d >= sessionStart && d <= sessionEnd;
        });

        sessionExpenses
          .sort((a: any, b: any) => new Date(a.createdAt || a.approvedAt || a.date).getTime() - new Date(b.createdAt || b.approvedAt || b.date).getTime())
          .forEach((e: any) => {
            allEntries.push({
              date: new Date((e.createdAt || e.approvedAt || e.date)),
              designation: `Dépense${e.id ? ' #' + e.id : ''}${e.notes ? ': ' + e.notes : ''}`,
              debit: 0,
              credit: parseFloat(e.amount || 0) || 0,
              sessionId: session.id
            });
          });
      }

      // Add cash movements for this session (excluding individual expense movements already handled upstream)
      if (session.cashMovements) {
        session.cashMovements
          .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
          .forEach(movement => {
            const reasonLower = (movement.reason || '').toLowerCase();
            const isExpenseMovement = reasonLower.includes('dépense') || reasonLower.includes('depense');
            if (isExpenseMovement) return;

            let debit = 0;
            let credit = 0;
            let designation = '';

            switch (movement.type) {
              case 'ENTREE':
                debit = parseFloat(String(movement.amount || 0)) || 0;
                designation = `Entrée - ${movement.reason}`;
                break;
              case 'SORTIE':
                credit = parseFloat(String(movement.amount || 0)) || 0;
                designation = `Sortie - ${movement.reason}`;
                break;
              case 'DEPOT_COFFRE':
                credit = parseFloat(String(movement.amount || 0)) || 0;
                designation = `Dépôt coffre - ${movement.reason}`;
                break;
              case 'RETRAIT_CENTRALE':
                credit = parseFloat(String(movement.amount || 0)) || 0;
                designation = `Retrait centrale - ${movement.reason}`;
                break;
              case 'AJUSTEMENT':
                const amount = parseFloat(String(movement.amount || 0)) || 0;
                if (amount > 0) {
                  debit = amount;
                  designation = `Ajustement + - ${movement.reason}`;
                } else {
                  credit = Math.abs(amount);
                  designation = `Ajustement - - ${movement.reason}`;
                }
                break;
            }

            allEntries.push({
              date: new Date(movement.createdAt),
              designation,
              debit,
              credit,
              sessionId: session.id
            });
          });
      }
    });

    // Sort all entries by date
    allEntries.sort((a, b) => a.date.getTime() - b.date.getTime());

    // Add entries in chronological order with running balance
    allEntries.forEach(entry => {
      currentBalance = this.addReleveEntry(
        entries,
        currentBalance,
        entry.date,
        entry.designation,
        entry.debit,
        entry.credit,
        entry.sessionId
      );
    });

    this.releveEntries.set(entries);
  }

  private processReleveDataWithSummaries(sessionsInRange: SessionCaisse[], entries: ReleveEntry[], runningBalance: number, fromDate: Date, toDate: Date): void {
    // Calculate session balances first to determine the initial balance
    const sessionBalances: Map<number, number> = new Map();
    
    // First pass: Calculate final balance for each session
    sessionsInRange.forEach((session, index) => {
      let sessionBalance = 0;
      
      // Determine starting balance: use previous session's balance, or session's openingFund for first session
      if (index === 0) {
        // First session uses its own openingFund
        sessionBalance = parseFloat((session.openingFund as any) || 0) || 0;
      } else {
        // Subsequent sessions start with previous session's balance (already calculated)
        const previousSession = sessionsInRange[index - 1];
        sessionBalance = sessionBalances.get(previousSession.id) || 0;
      }
      
      // Add cash sales from summary
      if (session.salesSummary?.cashSales) {
        const cashSales = typeof session.salesSummary.cashSales === 'number' 
          ? session.salesSummary.cashSales 
          : parseFloat(String(session.salesSummary.cashSales)) || 0;
        sessionBalance += cashSales;
      }
      
      // Process all cash movements in chronological order
      if (session.cashMovements) {
        const sortedMovements = [...session.cashMovements].sort((a, b) => 
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        
        sortedMovements.forEach(movement => {
          const reasonLower = (movement.reason || '').toLowerCase();
          const isExpenseMovement = reasonLower.includes('dépense') || reasonLower.includes('depense');
          const amount = parseFloat(String(movement.amount || 0)) || 0;
          
          if (movement.type === 'ENTREE') {
            sessionBalance += amount;
          } else if (movement.type === 'SORTIE') {
            sessionBalance -= amount;
          } else if (movement.type === 'DEPOT_COFFRE') {
            sessionBalance -= amount;
          } else if (movement.type === 'RETRAIT_CENTRALE') {
            sessionBalance -= amount;
          } else if ((movement.type as string) === 'AJUSTEMENT') {
            // AJUSTEMENT can be positive or negative
            sessionBalance += amount;
          }
        });
      }
      
      sessionBalances.set(session.id, sessionBalance);
    });
    
    // Determine initial balance: use first session's opening fund (starting balance for the period)
    let initialBalance = 0;
    if (sessionsInRange.length > 0) {
      // Use the first session's opening fund as the initial balance
      initialBalance = parseFloat((sessionsInRange[0].openingFund as any) || 0) || 0;
    }
    
    // Add "Solde initial" entry at the beginning
    let currentBalance = initialBalance;
    if (sessionsInRange.length > 0) {
      const firstSession = sessionsInRange[0];
      entries.push({
        date: new Date(firstSession.openedAt),
        designation: 'Solde initial',
        debit: initialBalance,
        credit: 0,
        solde: initialBalance,
        sessionId: firstSession.id
      });
    }
    
    // Second pass: Generate entries for all sessions in chronological order (no session grouping)
    // Collect all entries first, then sort by date
    const allEntries: Array<{ date: Date; designation: string; debit: number; credit: number; sessionId?: number }> = [];
    
    sessionsInRange.forEach((session) => {
      // Add sales entries from session summary
      if (session.salesSummary?.cashSales) {
        const cashSales = typeof session.salesSummary.cashSales === 'number' 
          ? session.salesSummary.cashSales 
          : parseFloat(String(session.salesSummary.cashSales)) || 0;
        if (cashSales > 0) {
          allEntries.push({
            date: new Date(session.openedAt),
            designation: `Ventes espèces (${session.salesSummary.salesCount || 0} tickets)`,
            debit: cashSales,
            credit: 0,
            sessionId: session.id
          });
        }
      }

      // Add expenses from cash movements for this session
      if (session.cashMovements) {
        const sessionExpenseMovements = session.cashMovements.filter(movement => {
          const reasonLower = (movement.reason || '').toLowerCase();
          const isExpenseMovement = reasonLower.includes('dépense') || reasonLower.includes('depense');
          return movement.type === 'SORTIE' && isExpenseMovement;
        });

        sessionExpenseMovements
          .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
          .forEach(movement => {
            // Extract the note/description from the reason
            const reason = movement.reason || 'Dépense';
            let note = reason;
            const patterns = [
              /Dépense approuvée #\d+: (.+)$/,
              /Dépense approuvée #\d+: (.+)/,
              /#\d+: (.+)$/,
              /#\d+: (.+)/
            ];
            for (const pattern of patterns) {
              const match = reason.match(pattern);
              if (match && match[1]) {
                note = match[1].trim();
                break;
              }
            }

            allEntries.push({
              date: new Date(movement.createdAt),
              designation: `Dépense #${movement.id}: ${note}`,
              debit: 0,
              credit: parseFloat(String(movement.amount || 0)) || 0,
              sessionId: session.id
            });
          });
      }

      // Add other cash movements (excluding expense movements already handled)
      if (session.cashMovements) {
        session.cashMovements
          .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
          .forEach(movement => {
            const reasonLower = (movement.reason || '').toLowerCase();
            const isExpenseMovement = reasonLower.includes('dépense') || reasonLower.includes('depense');
            if (isExpenseMovement) return;

            let debit = 0;
            let credit = 0;
            let designation = '';

            switch (movement.type) {
              case 'ENTREE':
                debit = parseFloat(String(movement.amount || 0)) || 0;
                designation = `Entrée - ${movement.reason}`;
                break;
              case 'SORTIE':
                credit = parseFloat(String(movement.amount || 0)) || 0;
                designation = `Sortie - ${movement.reason}`;
                break;
              case 'DEPOT_COFFRE':
                credit = parseFloat(String(movement.amount || 0)) || 0;
                designation = `Dépôt coffre - ${movement.reason}`;
                break;
              case 'RETRAIT_CENTRALE':
                credit = parseFloat(String(movement.amount || 0)) || 0;
                designation = `Retrait centrale - ${movement.reason}`;
                break;
              case 'AJUSTEMENT':
                const amount = parseFloat(String(movement.amount || 0)) || 0;
                if (amount > 0) {
                  debit = amount;
                  designation = `Ajustement + - ${movement.reason}`;
                } else {
                  credit = Math.abs(amount);
                  designation = `Ajustement - - ${movement.reason}`;
                }
                break;
            }

            allEntries.push({
              date: new Date(movement.createdAt),
              designation,
              debit,
              credit,
              sessionId: session.id
            });
          });
      }
    });

    // Sort all entries by date
    allEntries.sort((a, b) => a.date.getTime() - b.date.getTime());

    // Add entries in chronological order with running balance
    allEntries.forEach(entry => {
      currentBalance = this.addReleveEntry(
        entries,
        currentBalance,
        entry.date,
        entry.designation,
        entry.debit,
        entry.credit,
        entry.sessionId
      );
    });

    this.releveEntries.set(entries);
  }

  private generateReleveEntriesFallback(fromDate: Date, toDate: Date, sessionId?: number): void {
    const entries: ReleveEntry[] = [];
    let runningBalance = 0;

    // Ensure dates are valid Date objects
    const validFromDate = fromDate instanceof Date ? fromDate : new Date(fromDate);
    const validToDate = toDate instanceof Date ? toDate : new Date(toDate);

    // Validate dates
    if (isNaN(validFromDate.getTime()) || isNaN(validToDate.getTime())) {
      console.error('Invalid date range provided');
      return;
    }

    // Get all sessions in the date range
    const sessionsInRange = this.sessions().filter(session => {
      const sessionDate = new Date(session.openedAt);
      return sessionDate >= validFromDate && sessionDate <= validToDate && 
             (!sessionId || session.id === sessionId);
    });

    // Sort sessions by opening date
    sessionsInRange.sort((a, b) => new Date(a.openedAt).getTime() - new Date(b.openedAt).getTime());

    // Get session IDs for sales query
    const sessionIds = sessionsInRange.map(s => s.id);


    
    // Fetch both sales and expenses in parallel
    const salesQuery = this.salesService.getSales({});
    const expensesQuery = this.expenseService.getExpenses({
      startDate: validFromDate.toISOString().split('T')[0],
      endDate: validToDate.toISOString().split('T')[0]
    });

    // Use forkJoin to get both sales and expenses
    forkJoin({
      sales: salesQuery,
      expenses: expensesQuery
    }).subscribe({
      next: (data) => {

        const sessionSales = data.sales.filter(sale => sessionIds.includes(sale.sessionId || 0));

        
        if (sessionSales.length > 0 || data.expenses.length > 0) {

          this.processReleveData(sessionsInRange, sessionSales, entries, runningBalance, validFromDate, validToDate, data.expenses);
        } else {

          this.processReleveDataFallback(sessionsInRange, entries, runningBalance, validFromDate, validToDate);
        }
      },
      error: (error) => {
        console.error('Error fetching sales/expenses data:', error);

        this.processReleveDataFallback(sessionsInRange, entries, runningBalance, validFromDate, validToDate);
      }
    });
  }

  private processReleveDataFallback(sessionsInRange: SessionCaisse[], entries: ReleveEntry[], runningBalance: number, fromDate: Date, toDate: Date): void {
    // Determine initial balance: use first session's opening fund
    let initialBalance = 0;
    if (sessionsInRange.length > 0) {
      initialBalance = parseFloat((sessionsInRange[0].openingFund as any) || 0) || 0;
    }
    
    // Add "Solde initial" entry at the beginning
    let currentBalance = initialBalance;
    if (sessionsInRange.length > 0) {
      const firstSession = sessionsInRange[0];
      entries.push({
        date: new Date(firstSession.openedAt),
        designation: 'Solde initial',
        debit: initialBalance,
        credit: 0,
        solde: initialBalance,
        sessionId: firstSession.id
      });
    }
    
    // Collect all entries first, then sort by date (no session grouping)
    const allEntries: Array<{ date: Date; designation: string; debit: number; credit: number; sessionId?: number }> = [];
    
    sessionsInRange.forEach(session => {
      // Sales from summary (fallback)
      if ((session as any).summary?.cashSales) {
        const cashSales = parseFloat(((session as any).summary.cashSales as any) || 0) || 0;
        if (cashSales > 0) {
          allEntries.push({
            date: new Date(session.openedAt),
            designation: 'Ventes espèces (récapitulatif)',
            debit: cashSales,
            credit: 0,
            sessionId: session.id
          });
        }
      }

      // Movements
      if (session.cashMovements) {
        session.cashMovements
          .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
          .forEach(movement => {
            const reasonLower = (movement.reason || '').toLowerCase();
            const isExpenseMovement = reasonLower.includes('dépense') || reasonLower.includes('depense');
            if (isExpenseMovement) return;

            let debit = 0;
            let credit = 0;
            let designation = '';

            switch (movement.type) {
              case 'ENTREE':
                debit = parseFloat(String(movement.amount || 0)) || 0;
                designation = `Entrée - ${movement.reason}`;
                break;
              case 'SORTIE':
                credit = parseFloat(String(movement.amount || 0)) || 0;
                designation = `Sortie - ${movement.reason}`;
                break;
              case 'DEPOT_COFFRE':
                credit = parseFloat(String(movement.amount || 0)) || 0;
                designation = `Dépôt coffre - ${movement.reason}`;
                break;
              case 'RETRAIT_CENTRALE':
                credit = parseFloat(String(movement.amount || 0)) || 0;
                designation = `Retrait centrale - ${movement.reason}`;
                break;
              case 'AJUSTEMENT':
                const amount = parseFloat(String(movement.amount || 0)) || 0;
                if (amount > 0) {
                  debit = amount;
                  designation = `Ajustement + - ${movement.reason}`;
                } else {
                  credit = Math.abs(amount);
                  designation = `Ajustement - - ${movement.reason}`;
                }
                break;
            }

            allEntries.push({
              date: new Date(movement.createdAt),
              designation,
              debit,
              credit,
              sessionId: session.id
            });
          });
      }
    });

    // Sort all entries by date
    allEntries.sort((a, b) => a.date.getTime() - b.date.getTime());

    // Add entries in chronological order with running balance
    allEntries.forEach(entry => {
      currentBalance = this.addReleveEntry(
        entries,
        currentBalance,
        entry.date,
        entry.designation,
        entry.debit,
        entry.credit,
        entry.sessionId
      );
    });

    this.releveEntries.set(entries);
  }

  closeReleveResultsModal(): void {
    this.showReleveResultsModal.set(false);
    this.releveEntries.set([]);
    this.releveTitle.set('');
  }

  // Expense details modal methods
  openExpenseDetailsModal(designation: string, sessionId?: number): void {
    // Find the session that contains this expense entry
    const session = sessionId ? this.sessions().find(s => s.id === sessionId) : this.selectedSession();
    if (!session) return;



    // Always fetch fresh session report to get the most up-to-date expense data
    this.sessionsService.getSessionReport(session.id, 'Z').subscribe({
      next: (report) => {

        let expensesToShow: Array<{ id: number; amount: number; reason: string; createdAt: string; categoryName?: string; supplierName?: string; notes?: string }> = [];

        // Get expenses from the session summary (this is where the backend puts them)
        const summary = report?.summary as any;
        const summaryExpenses = summary?.expensesDetails || [];
        



        // Check if this is a "Sortie - Dépense" entry (individual cash movement)
        if (designation.includes('Sortie - Dépense')) {
          // Extract expense ID from designation like "Sortie - Dépense #26: ..."
          const expenseIdMatch = designation.match(/#(\d+)/);
          if (expenseIdMatch) {
            const expenseId = parseInt(expenseIdMatch[1], 10);
            
            // Find the specific expense by ID
            const expense = summaryExpenses.find((exp: any) => exp.id === expenseId);
            
            if (expense) {
              expensesToShow = [{
                id: expense.id,
                amount: expense.amount,
                reason: expense.reason || expense.description || `Dépense #${expense.id}`,
                createdAt: expense.createdAt || expense.date,
                categoryName: expense.categoryName || expense.category?.name,
                supplierName: expense.supplierName || expense.supplier?.name,
                notes: expense.notes
              }];
            }
          }
        } else if (designation.includes('Dépenses espèces')) {
          // This is an aggregated expense entry - show all cash expenses for the session
          if (summaryExpenses.length > 0) {
            // Use summary expenses if available
            expensesToShow = summaryExpenses.map((expense: any) => ({
              id: expense.id,
              amount: expense.amount,
              reason: expense.reason || expense.description || `Dépense #${expense.id}`,
              createdAt: expense.createdAt || expense.date,
              categoryName: expense.categoryName || expense.category?.name,
              supplierName: expense.supplierName || expense.supplier?.name,
              notes: expense.notes
            }));
          } else {
            // Fallback: extract expense info from cash movements
            const session = sessionId ? this.sessions().find(s => s.id === sessionId) : this.selectedSession();
            if (session?.cashMovements) {
              const expenseMovements = session.cashMovements.filter(movement => 
                movement.reason && 
                (movement.reason.includes('Dépense') || movement.reason.includes('depense'))
              );
              

              
              expensesToShow = expenseMovements.map((movement: any) => {
                // Extract expense ID from reason like "Dépense approuvée #26: ..."
                const expenseIdMatch = movement.reason.match(/#(\d+)/);
                const expenseId = expenseIdMatch ? parseInt(expenseIdMatch[1], 10) : movement.id;
                
                return {
                  id: expenseId,
                  amount: movement.amount,
                  reason: movement.reason,
                  createdAt: movement.createdAt,
                  categoryName: 'Non spécifié',
                  supplierName: 'Non spécifié',
                  notes: 'Détails non disponibles'
                };
              });
            }
            
            // If still no expenses found, try to fetch directly from expenses API
            if (expensesToShow.length === 0) {

              this.fetchExpensesDirectly(session, designation);
              return;
            }
          }
        }


        this.expenseDetails.set(expensesToShow);
        this.expenseDetailsTitle.set(designation);
        this.showExpenseDetailsModal.set(true);
      },
      error: (error) => {
        console.error('Error fetching session report for expense details:', error);
        this.expenseDetails.set([]);
        this.expenseDetailsTitle.set(designation);
        this.showExpenseDetailsModal.set(true);
      }
    });
  }

  closeExpenseDetailsModal(): void {
    this.showExpenseDetailsModal.set(false);
    this.expenseDetails.set([]);
    this.expenseDetailsTitle.set('');
  }

  private fetchExpensesDirectly(session: any, designation: string): void {
    // Calculate date range for the session
    const sessionStart = new Date(session.openedAt);
    const sessionEnd = session.closedAt ? new Date(session.closedAt) : new Date();
    
    // Fetch expenses directly from the expenses API
    this.expenseService.getExpenses({
      startDate: sessionStart.toISOString().split('T')[0],
      endDate: sessionEnd.toISOString().split('T')[0],
      status: 'approved'
    }).subscribe({
      next: (expensesResponse: any) => {

        const expenses = expensesResponse.expenses || expensesResponse || [];
        
        // Filter for cash expenses only
        const cashExpenses = expenses.filter((expense: any) => 
          expense.paymentType === 'CASH' && expense.isApproved
        );
        

        
        const expensesToShow = cashExpenses.map((expense: any) => ({
          id: expense.id,
          amount: expense.amount,
          reason: expense.description || `Dépense #${expense.id}`,
          createdAt: expense.approvedAt || expense.createdAt || expense.date,
          categoryName: expense.category?.name || 'Non spécifié',
          supplierName: expense.supplier?.name || 'Non spécifié',
          notes: expense.notes || ''
        }));
        

        this.expenseDetails.set(expensesToShow);
        this.expenseDetailsTitle.set(designation);
        this.showExpenseDetailsModal.set(true);
      },
      error: (error) => {
        console.error('Error fetching expenses directly:', error);
        this.expenseDetails.set([]);
        this.expenseDetailsTitle.set(designation);
        this.showExpenseDetailsModal.set(true);
      }
    });
  }

  getExpenseDetailsTotal(): number {
    return this.expenseDetails().reduce((sum, expense) => sum + expense.amount, 0);
  }

  // Credit sales details modal methods
  openCreditSalesDetailsModal(): void {
    const session = this.selectedSession();
    if (!session) return;



    // Fetch fresh session report to get credit sales details
    this.sessionsService.getSessionReport(session.id, 'Z').subscribe({
      next: (report) => {

        const sales = (report?.session?.sales || []) as Array<any>;
        
        const creditSales = sales.filter((sale: any) => {
          const status = (sale.status || '').toUpperCase();
          if (['CANCELLED', 'REFUNDED'].includes(status)) {
            return false;
          }
          const paymentType = (sale.paymentType || sale.paymentMethod?.type || '').toUpperCase();
          return paymentType === 'CREDIT';
        });



        const creditSalesDetailsList = creditSales.map((sale: any) => {
          const saleTotal = parseFloat(sale.finalTotal || 0) || 0;
          const paidAmount = parseFloat(sale.paidAmount ?? sale.advancePayment ?? 0) || 0;
          const outstanding = Math.max(0, saleTotal - paidAmount);
          
          const clientName = sale.client 
            ? `${sale.client.firstName || ''} ${sale.client.lastName || ''}`.trim() || 'Client inconnu'
            : 'Client inconnu';
          
          return {
            id: sale.id,
            saleId: sale.id,
            amount: outstanding,
            saleTotal: saleTotal,
            paidAmount: paidAmount,
            clientName: clientName,
            createdAt: sale.createdAt,
            ticketNumber: sale.dailyTicketNumber || sale.sessionTicketNumber || sale.ticketNumber || sale.id
          };
        }).filter(sale => sale.amount > 0);

        // Sort by date (newest first)
        creditSalesDetailsList.sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        this.creditSalesDetails.set(creditSalesDetailsList);
        this.creditSalesDetailsTitle.set(`Ventes à Crédit - Session #${session.id}`);
        this.showCreditSalesDetailsModal.set(true);
      },
      error: (error) => {
        console.error('Error fetching session report for credit sales details:', error);
        this.creditSalesDetails.set([]);
        this.creditSalesDetailsTitle.set('Ventes à Crédit');
        this.showCreditSalesDetailsModal.set(true);
      }
    });
  }

  closeCreditSalesDetailsModal(): void {
    this.showCreditSalesDetailsModal.set(false);
    this.creditSalesDetails.set([]);
    this.creditSalesDetailsTitle.set('');
  }

  getCreditSalesDetailsTotal(): number {
    return this.creditSalesDetails().reduce((sum, sale) => sum + sale.amount, 0);
  }

  // Group entries by session
  getSessionGroups(): Array<{sessionId: number; entries: ReleveEntry[]}> {
    const groups = new Map<number, ReleveEntry[]>();
    
    this.releveEntries().forEach(entry => {
      const sessionId = entry.sessionId || 0;
      if (!groups.has(sessionId)) {
        groups.set(sessionId, []);
      }
      groups.get(sessionId)!.push(entry);
    });
    
    // Convert to array and sort by session ID
    return Array.from(groups.entries())
      .map(([sessionId, entries]) => ({ sessionId, entries }))
      .sort((a, b) => a.sessionId - b.sessionId);
  }

  // Get session user name
  getSessionUser(sessionId: number): string {
    const session = this.sessions().find(s => s.id === sessionId);
    if (session?.user) {
      return `${session.user.firstName} ${session.user.lastName}`;
    }
    return 'Utilisateur inconnu';
  }

  // Get sequential number for a session (ascending: oldest=1, newest=N)
  getSessionNumber(sessionId: number): number {
    const sessions = this.sessions();
    const index = sessions.findIndex(s => s.id === sessionId);
    if (index < 0) return 0;
    // sessions are sorted newest first; convert to ascending numbering
    return sessions.length - index;
  }


  exportReleveCaisse(): void {
    const entries = this.releveEntries();
    if (entries.length === 0) {
      console.error('No data to export');
      return;
    }

    // Create CSV content
    const headers = ['Date', 'Désignation', 'Débit', 'Crédit', 'Solde'];
    const csvContent = [
      headers.join(','),
      ...entries.map(entry => [
        entry.date.toLocaleString('fr-FR'),
        `"${entry.designation}"`,
        entry.debit.toString(),
        entry.credit.toString(),
        entry.solde.toString()
      ].join(','))
    ].join('\n');

    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `releve_caisse_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Debug method to check sales and expenses data
  debugSalesData(): void {

    const session = this.selectedSession();
    
    if (!session) {

      return;
    }

    const salesQuery = this.salesService.getSales({});
    const expensesQuery = this.expenseService.getExpenses({});

    forkJoin({
      sales: salesQuery,
      expenses: expensesQuery
    }).subscribe({
      next: (data) => {


        
        const sessionSales = data.sales.filter(sale => sale.sessionId === session.id);

        
        sessionSales.forEach(sale => {
          console.log(`Sale ${sale.id}:`, {
            id: sale.id,
            sessionId: sale.sessionId,
            finalTotal: sale.finalTotal,
            status: sale.status,
            paymentMethod: sale.paymentMethod,
            dailyTicketNumber: sale.dailyTicketNumber,
            createdAt: sale.createdAt
          });
        });

        // Check expenses for this session period
        const sessionStart = new Date(session.openedAt);
        const sessionEnd = session.closedAt ? new Date(session.closedAt) : new Date();
        
        const sessionExpenses = data.expenses.filter(expense => {
          const expenseDate = new Date(expense.date);
          return expenseDate >= sessionStart && expenseDate <= sessionEnd;
        });
        

        
        sessionExpenses.forEach(expense => {
          console.log(`Expense ${expense.id}:`, {
            id: expense.id,
            amount: expense.amount,
            description: expense.description,
            category: expense.category?.name,
            paymentType: expense.paymentType,
            isPaid: expense.isPaid,
            date: expense.date
          });
        });
      },
      error: (error) => {
        console.error('Error fetching sales/expenses for debug:', error);
      }
    });
  }
}


