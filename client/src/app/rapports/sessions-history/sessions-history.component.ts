import { Component, OnInit, OnDestroy, signal, computed, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { SessionsService, SessionCaisse, SessionFilters, CashMovementRequest, CloseSessionRequest, OpenSessionRequest } from '../../core/services/sessions.service';
import { AuthService } from '../../core/services/auth.service';
import { PrintService } from '../../core/services/print.service';
import { DailyExtractService } from '../../core/services/daily-extract.service';
import { SettingsService, AppSettings } from '../../core/services/settings.service';
import { DepotsService } from '../../core/services/depots.service';
import { TicketCounterService } from '../../core/services/ticket-counter.service';
import { Depot } from '../../core/models/depot.model';
import { Router } from '@angular/router';

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

  loading = signal(false);
  loadingDetails = signal(false);
  error = signal('');



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

  // Cash sales detail state
  cashSalesDetails = signal<{ id: number; paidAmount: number; totalAmount: number }[]>([]);
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
    this.loadSessions();
  }

  ngOnDestroy(): void {
    if (this.refreshIntervalId) {
      clearInterval(this.refreshIntervalId);
      this.refreshIntervalId = null;
    }
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
    console.log('Loading recent sessions with limit:', limit);
    this.sessionsService.getSessions({ 
      limit: limit
    }).subscribe({
      next: (sessions: any) => {
        console.log('Sessions received:', sessions);
        // Sort sessions by openedAt/createdAt (newest first) and keep only last N
        const sorted = (sessions || [])
          .slice()
          .sort((a: any, b: any) => {
            const aTime = new Date(a.openedAt ?? a.createdAt).getTime();
            const bTime = new Date(b.openedAt ?? b.createdAt).getTime();
            return bTime - aTime;
          })
          .slice(0, limit);

         console.log('Sorted sessions:', sorted);
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
        console.log('Session report loaded:', report);
        const enriched: SessionCaisse = {
          ...session,
          cashMovements: report.session?.cashMovements || session.cashMovements,
          summary: report.summary || session.summary
        };
        console.log('Enriched session:', enriched);
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
    for (const t of this.cashSalesDetails()) {
      if ((t.paidAmount || 0) > 0) {
        rows.push({
          createdAt: new Date(this.selectedSession()!.openedAt).toISOString(),
          label: `Ticket N°${t.id}`,
          amount: t.paidAmount
        });
      }
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
    const summary: any = session?.summary || {};
    const direct = parseFloat(summary.creditOutstanding || 0) || 0;
    if (direct > 0) return direct;
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
      return details.slice(0, 10).map(d => ({
        createdAt: d.createdAt,
        type: 'ENTREE',
        reason: `Encaissement client · ${d.clientName || 'Client'}`,
        amount: parseFloat(d.amount || 0) || 0
      }));
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

  getSupplierPaymentsTotal(): number {
    const movements = this.selectedSession()?.cashMovements || [];
    return movements
      .filter(m => {
        const reasonLower = (m.reason || '').toLowerCase();
        const isSupplierPayment = reasonLower.includes('règlement fournisseur') || reasonLower.includes('reglement fournisseur');
        const amount = parseFloat((m as any).amount || 0) || 0;
        return m.type === 'SORTIE' && isSupplierPayment && amount > 0;
      })
      .reduce((sum, m) => sum + (parseFloat((m as any).amount) || 0), 0);
  }

  // Refunds (Remboursements)
  recentRefunds(): Array<{ createdAt: string; type: string; reason: string; amount: number }> {
    const movements = (this.selectedSession()?.cashMovements || []) as any[];
    return movements
      .filter(m => {
        const reasonLower = (m.reason || '').toLowerCase();
        const isRefund = reasonLower.includes('remboursement') || reasonLower.includes('bon de retour');
        const amount = parseFloat((m as any).amount || 0) || 0;
        return m.type === 'SORTIE' && isRefund && amount > 0;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10)
      .map(m => ({
        createdAt: m.createdAt,
        type: 'SORTIE',
        reason: m.reason || 'Remboursement',
        amount: parseFloat((m as any).amount || 0) || 0
      }));
  }

  getRefundsTotal(): number {
    const movements = this.selectedSession()?.cashMovements || [];
    return movements
      .filter(m => {
        const reasonLower = (m.reason || '').toLowerCase();
        const isRefund = reasonLower.includes('remboursement') || reasonLower.includes('bon de retour');
        const amount = parseFloat((m as any).amount || 0) || 0;
        return m.type === 'SORTIE' && isRefund && amount > 0;
      })
      .reduce((sum, m) => sum + (parseFloat((m as any).amount) || 0), 0);
  }

  getNetAfterAdjustments(): number {
    const totalSales = parseFloat((this.selectedSession()?.summary?.totalSales as any) || 0) || 0;
    const expectedCash = parseFloat((this.selectedSession()?.summary?.expectedCash as any) || 0) || 0;
    const credit = this.getCreditAmount();
    const supplierRegs = this.getSupplierPaymentsTotal();
    return totalSales + expectedCash - credit - supplierRegs;
  }

  // New computed helpers
  getClientPaymentsTotal(): number {
    const summary: any = this.selectedSession()?.summary || {};
    // Only use server-provided client payments total (standalone payments without saleId)
    return parseFloat(summary.clientPaymentsTotal || 0) || 0;
  }

  getTotalOrderAdvances(): number {
    const movements = this.selectedSession()?.cashMovements || [];
    return movements
      .filter(m => {
        const reason = (m.reason || '').toLowerCase();
        return m.type === 'ENTREE' && (
          reason.startsWith('acompte commande') ||
          reason.includes('acompte') ||
          reason.includes('avance') ||
          reason.includes('advance')
        );
      })
      .reduce((sum, m) => sum + (parseFloat((m as any).amount) || 0), 0);
  }

  getCashFromSalesNetOfCredit(): number {
    const summary: any = this.selectedSession()?.summary || {};
    const totalSales = parseFloat(summary.totalSales || 0) || 0;
    const credit = this.getCreditAmount();
    return Math.max(0, totalSales - credit);
  }

  getExpensesTotal(): number {
    // Prefer server-provided total if available
    const summary: any = this.selectedSession()?.summary || {};
    const fromSummary = parseFloat(summary.expensesTotal || 0) || 0;
    if (fromSummary > 0) return fromSummary;
    // Fallback to movements tagged as expenses
    const movements = this.selectedSession()?.cashMovements || [];
    return movements
      .filter(m => m.type === 'SORTIE' && ((m.reason || '').toLowerCase().includes('dépense') || (m.reason || '').toLowerCase().includes('depense')))
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
    this.sessionsService.getSessionReport(session.id, 'X').subscribe({
      next: (report: any) => {
        const sales = (report?.session?.sales || []) as Array<any>;

        // Build items map for detail expansion
        const itemsMap: Record<number, Array<{ name: string; quantity: number; unitPrice: number; total: number }>> = {};

        const enriched = sales.map(sale => {
          const finalTotal = parseFloat((sale.finalTotal ?? sale.totalAmount ?? 0) as any) || 0;
          const explicitPaid = sale.paidAmount != null ? (parseFloat(sale.paidAmount as any) || 0) : undefined;
          let paidAmount = explicitPaid ?? 0;

          if (explicitPaid == null) {
            const method = String(sale.paymentMethod?.type || '').toUpperCase();
            paidAmount = method === 'CASH' ? finalTotal : 0;
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
            createdAt: sale.createdAt
          };
        });

        const cashSales = enriched.filter(s => (s.paidAmount || 0) > 0);

        this.ticketItemsById.set(itemsMap);
        this.cashSalesDetails.set(cashSales);
        this.cashSalesLoading.set(false);
      },
      error: () => {
        this.cashSalesLoading.set(false);
      }
    });
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

  // New print methods for family and article grouping
  printWithFamily(session: SessionCaisse): void {
    if (!session) return;
    
    this.sessionsService.getSessionReport(session.id, 'Z').subscribe({
      next: (sessionReport) => {
        this.settingsService.getSettings().subscribe({
          next: (companyData) => {
            this.printService.printDetailedSessionReportWithFamilyGrouping(sessionReport, companyData);
          },
          error: (error) => {
            console.error('Error fetching settings:', error);
            this.printService.printDetailedSessionReportWithFamilyGrouping(sessionReport);
          }
        });
      },
      error: (error) => {
        this.error.set('Erreur lors de l\'impression du rapport avec famille');
      }
    });
  }

  printByArticle(session: SessionCaisse): void {
    if (!session) return;
    
    this.sessionsService.getSessionReport(session.id, 'Z').subscribe({
      next: (sessionReport) => {
        this.settingsService.getSettings().subscribe({
          next: (companyData) => {
            this.printService.printDetailedSessionReportWithArticleGrouping(sessionReport, companyData);
          },
          error: (error) => {
            console.error('Error fetching settings:', error);
            this.printService.printDetailedSessionReportWithArticleGrouping(sessionReport);
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
    const credit = this.getCreditAmount();
    const computedCashFromSales = Math.max(0, sales - credit);
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
      reason: `Ajustement solde : ${delta > 0 ? '+' : ''}${delta.toFixed(3)} TND (Ancien: ${currentBalance.toFixed(3)}, Nouveau: ${targetBalance.toFixed(3)})`
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
}


