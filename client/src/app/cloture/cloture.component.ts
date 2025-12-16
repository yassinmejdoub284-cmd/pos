import { Component, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { Observable } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SessionsService, SessionCaisse } from '../core/services/sessions.service';
import { SalesService } from '../core/services/sales.service';
import { TicketDetailsModalComponent } from '../shared/ticket-details-modal/ticket-details-modal.component';
import { AuthService } from '../core/services/auth.service';
import { PrintService } from '../core/services/print.service';
import { DailyExtractService } from '../core/services/daily-extract.service';
import { SettingsService, AppSettings } from '../core/services/settings.service';
import { DepotsService } from '../core/services/depots.service';
import { TicketCounterService } from '../core/services/ticket-counter.service';

@Component({
  selector: 'app-cloture',
  templateUrl: './cloture.component.html',
  standalone: true,
  imports: [CommonModule, FormsModule, TicketDetailsModalComponent]
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
  showAdjustForm = signal(false);
  showCreditDetailsModal = false;
  activeTab = signal<'historique' | 'cloture'>('cloture');
  showDetails = signal({
    encaissement: { clientPayments: false, advances: false, cash: false },
    decaissement: { expenses: false, suppliers: false },
    alimentations: { expanded: false }
  });
  
  // Tickets modal state
  showTicketsModal = signal(false);
  sessionTickets = signal<Array<{ id: number; amount: number; totalAmount?: number; createdAt?: string | Date; status?: string }>>([]);
  ticketsMoreFlag = false;
  ticketsTotal = computed(() => this.sessionTickets().reduce((sum, t) => {
    const status = ((t as any).status || '').toUpperCase();
    // Exclude cancelled and refunded tickets from total
    if (status === 'CANCELLED' || status === 'REFUNDED') {
      return sum;
    }
    return sum + t.amount;
  }, 0));
  
  // Store Z report sales data for totalSalesTTC calculation
  private zReportSales = signal<Array<any>>([]);

  // Cash sales detail state
  cashSalesDetails = signal<{ id: number; paidAmount: number; totalAmount: number; discount?: number; status?: string; dailyTicketNumber?: number | string }[]>([]);
  cashSalesLoading = signal(false);
  // UI local toggles for cash sales "voir plus"
  cashMoreMainFlag = false;
  cashMoreSchemaFlag = false;
  cashMoreExpandedFlag = false;

  // Detailed flows modal state
  showFlowsModal = signal(false);
  flowsDateFrom = signal<string>('');
  flowsDateTo = signal<string>('');
  flowsDepotId = signal<number | null>(null);
  flowsSearch = signal('');
  checked_schema: boolean = false;

  // App settings stream for template consumption
  settings$!: Observable<AppSettings>;
  // Ticket details modal state
  showTicketDetailsModal = signal(false);
  selectedTicketForDetails: any = null;

  openTicketDetails(ticketId: number): void {
    if (!ticketId) return;
    this.salesService.getSale(ticketId).subscribe({
      next: (full) => {
        this.selectedTicketForDetails = full;
        this.showTicketDetailsModal.set(true);
      },
      error: () => {
        this.error.set('Impossible de charger les détails du ticket');
      }
    });
  }

  closeTicketDetails(): void {
    this.showTicketDetailsModal.set(false);
    this.selectedTicketForDetails = null;
  }

  onTicketDetailsPrint(sale: any): void {
    this.printService.printSaleReceipt(sale);
  }

  onTicketDetailsReturn(_sale: any): void {
    // Not supported from clôture; handled in Historique/Caisse
  }

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
    const session = this.currentSession();
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

    // Espèces en Caisse: list each cash-paid ticket (paidAmount), excluding canceled, refunded, and gift tickets
    for (const t of this.cashSalesDetails()) {
      const status = (t.status || '').toUpperCase();
      // Exclude canceled, refunded, and gift tickets (CADEAU) from encaissement
      // Gift tickets have amount = 0 and should not be counted in encaissement
      if ((status === 'CANCELLED' || status === 'REFUNDED' || status === 'CADEAU' || status === 'PENDING_ADMIN')) {
        continue;
      }
      if ((t.paidAmount || 0) > 0) {
        rows.push({
          createdAt: new Date(this.currentSession()!.openedAt).toISOString(),
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
    const session = this.currentSession();
    if (!session) return [];

    // Helper function to extract paid amount from partial payment notes
    const extractPaidAmount = (notes: string | null | undefined, defaultAmount: number): number => {
      if (!notes) return defaultAmount;
      
      // Match pattern: "Paiement partiel: Xdt payé, reste Ydt" or "Paiement partiel: X dt payé, reste Y dt"
      const match = notes.match(/Paiement partiel:\s*([\d.]+)\s*dt?\s*payé/i);
      if (match && match[1]) {
        const paidAmount = parseFloat(match[1]);
        if (!isNaN(paidAmount) && paidAmount > 0) {
          return paidAmount;
        }
      }
      
      return defaultAmount;
    };

    const rows: Array<{ createdAt: string; label: string; amount: number }> = [];

    // Dépenses (use server details first)
    const expenses = ((session.summary as any)?.expensesDetails || []) as Array<any>;
    for (const e of expenses) {
      const parts: string[] = [];
      if (e.categoryName) parts.push(e.categoryName);
      if (e.supplierName) parts.push(`Fournisseur: ${e.supplierName}`);
      const label = parts.length ? parts.join(' · ') : (e.reason || 'Dépense');
      
      // Extract paid amount if partial payment, otherwise use full amount
      const defaultAmount = parseFloat(e.amount || 0) || 0;
      const displayAmount = extractPaidAmount(e.notes, defaultAmount);
      
      rows.push({
        createdAt: e.createdAt,
        label,
        amount: displayAmount
      });
    }

    // Règlements fournisseur (from cash movements) - exclude rejected and deleted
    const movements = (session.cashMovements || []) as Array<any>;
    for (const m of movements) {
      const reason = String(m.reason || '');
      const reasonLower = reason.toLowerCase();
      const amount = parseFloat(m.amount || 0) || 0;
      const isSupplierPayment = reasonLower.includes('règlement fournisseur') || reasonLower.includes('reglement fournisseur');
      // Exclude rejected and deleted movements
      if (m.type === 'SORTIE' && isSupplierPayment && amount > 0 && !reason.includes('[REJETÉ]') && !reason.includes('[SUPPRIMÉ]')) {
        rows.push({
          createdAt: m.createdAt,
          label: reason.replace(/#\d+\s*\(FOURN:\d+\)/i, '').trim(),
          amount: amount
        });
      }
    }

    // Remboursements (from cash movements) - exclude rejected and deleted
    for (const m of movements) {
      const reason = String(m.reason || '');
      const reasonLower = reason.toLowerCase();
      const amount = parseFloat(m.amount || 0) || 0;
      const isRefund = reasonLower.includes('remboursement') || reasonLower.includes('bon de retour');
      // Exclude rejected and deleted movements
      if (m.type === 'SORTIE' && isRefund && amount > 0 && !reason.includes('[REJETÉ]') && !reason.includes('[SUPPRIMÉ]')) {
        rows.push({
          createdAt: m.createdAt,
          label: reason || 'Remboursement',
          amount: amount
        });
      }
    }

    // Other sorties (not categorized as expenses, supplier payments, or refunds)
    // This includes: retraits, dépôts au coffre, and other SORTIE movements
    const sales = ((session as any)?.sales || []) as any[];
    const cancelledTicketIds = new Set(
      sales
        .filter(sale => ['CANCELLED', 'REFUNDED'].includes((sale.status || '').toUpperCase()))
        .map(sale => sale.id)
    );
    
    // Build a set of expense IDs that are already shown in expensesDetails
    // This prevents double counting: expenses with cash movements are shown in expensesDetails,
    // and their movements should NOT be shown again in "autres sorties"
    const expenseIdsInDetails = new Set<number>();
    const expenseRegex = /#(\d+)/;
    expenses.forEach(e => {
      // Try to extract expense ID from various fields
      const label = (e.categoryName || '') + (e.supplierName || '') + (e.reason || '');
      const match = label.match(expenseRegex);
      if (match && match[1]) {
        expenseIdsInDetails.add(parseInt(match[1]));
      }
    });
    
    for (const m of movements) {
      const reason = String(m.reason || '');
      const reasonLower = reason.toLowerCase();
      const amount = parseFloat(m.amount || 0) || 0;
      const isRejected = reason.includes('[REJETÉ]');
      const isFromCancelledTicket = m.ticketId && cancelledTicketIds.has(m.ticketId);
      
      // Check if this movement is already counted as an expense
      const expenseMatch = reason.match(/Dépense(?: approuvée)?\s*#(\d+)/i);
      const isExpenseMovement = expenseMatch && expenseIdsInDetails.has(parseInt(expenseMatch[1]));
      
      // Check if this is a sortie that hasn't been categorized yet
      const isSortie = ['SORTIE', 'DEPOT_COFFRE', 'RETRAIT_CENTRALE'].includes(m.type);
      const isExpense = reasonLower.includes('dépense') || reasonLower.includes('depense');
      const isSupplierPayment = reasonLower.includes('règlement fournisseur') || reasonLower.includes('reglement fournisseur');
      const isRefund = reasonLower.includes('remboursement') || reasonLower.includes('bon de retour');
      const isDeleted = reason.includes('[SUPPRIMÉ]');
      
      if (isSortie && amount > 0 && !isRejected && !isDeleted && !isFromCancelledTicket && 
          !isExpenseMovement && !isExpense && !isSupplierPayment && !isRefund) {
        // This is an uncategorized sortie (not an expense, supplier payment, or refund)
        const label = reason || (m.type === 'DEPOT_COFFRE' ? 'Dépôt au coffre' : 
                                 m.type === 'RETRAIT_CENTRALE' ? 'Retrait centrale' : 'Autre sortie');
        rows.push({
          createdAt: m.createdAt,
          label: label,
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

  // Refresh control
  private refreshIntervalId: any;
  private isRefreshing = false;
  isAdminUser = false;
  // Snapshot to avoid unnecessary UI updates
  private lastSessionSnapshot: string | null = null;
  private lastSalesSnapshot: string | null = null;
  private requestedSalesDataForSessionId: number | null = null;
  private lastLoadedSessionId: number | null = null;

  // Crédit and supplier payments helpers - converted to computed signal for auto-updates
  // Use getTotalCreditFromDetails() to ensure consistency with displayed credit sales details
  creditAmount = computed(() => {
    const session = this.currentSession();
    if (!session) return 0;
    
    // Calculate from credit sales details (ensures accuracy and consistency)
    const details = this.getCreditSalesDetails();
    const totalFromDetails = details.reduce((sum, credit) => sum + credit.amount, 0);
    
    // If we have details and they sum to a value, use that
    if (details.length > 0 && totalFromDetails > 0) {
      return totalFromDetails;
    }
    
    // Fallback to summary values if details aren't available yet
    const summary: any = session?.summary || {};
    const direct = parseFloat(summary.creditOutstanding || 0) || 0;
    if (direct > 0) return direct;
    const credit = (summary.salesByPayment?.CREDIT?.amount) || 0;
    return parseFloat(credit) || 0;
  });

  // Keep method for backward compatibility
  getCreditAmount(): number {
    return this.creditAmount();
  }

  // Calculate total credit from individual credit sales details (ensures consistency with displayed rows)
  getTotalCreditFromDetails(): number {
    const details = this.getCreditSalesDetails();
    return details.reduce((sum, credit) => sum + credit.amount, 0);
  }

  // Get detailed breakdown of credit sales (where the credit amount comes from)
  // This shows only sales with outstanding credit (DEBT - PAYMENT > 0)
  getCreditSalesDetails(): Array<{ saleId: number; clientName: string; amount: number; saleTotal: number; paidAmount: number; date: string }> {
    const session = this.currentSession();
    if (!session) return [];

    const sales = ((session as any)?.sales || []) as any[];
    const creditSales: Array<{ saleId: number; clientName: string; amount: number; saleTotal: number; paidAmount: number; date: string }> = [];

    // Filter sales with CREDIT payment type
    sales.forEach(sale => {
      const paymentType = (sale.paymentType || '').toUpperCase();
      const status = (sale.status || '').toUpperCase();
      
      // Only include active credit sales
      if (paymentType === 'CREDIT' && !['CANCELLED', 'REFUNDED'].includes(status)) {
        const saleTotal = parseFloat(sale.finalTotal || 0) || 0;
        
        // The server calculates paidAmount as: finalTotal - DEBT transactions
        // For credit sales: paidAmount = finalTotal - outstandingDebt
        // So outstanding credit = finalTotal - paidAmount = outstandingDebt
        // This matches the server's creditOutstanding calculation: sum(DEBT) - sum(PAYMENT)
        // Use paidAmount if available (calculated by server from DEBT transactions)
        // Otherwise fall back to advancePayment
        const paidAmount = parseFloat(sale.paidAmount ?? sale.advancePayment ?? 0) || 0;
        
        // Calculate outstanding credit: total sale amount minus what was paid
        // This matches the server calculation where outstanding = DEBT - PAYMENT
        // For display: outstanding = saleTotal - paidAmount
        const outstanding = Math.max(0, saleTotal - paidAmount);
        
        // Only include if there's outstanding credit
        if (outstanding > 0) {
          let clientName = 'Client inconnu';
          if (sale.client) {
            const firstName = sale.client.firstName || '';
            const lastName = sale.client.lastName || '';
            clientName = `${firstName} ${lastName}`.trim() || 'Client inconnu';
          }
          
          creditSales.push({
            saleId: sale.id,
            clientName,
            amount: outstanding, // This is the outstanding credit amount
            saleTotal,
            paidAmount, // Show the actual paid amount
            date: sale.createdAt || session.openedAt
          });
        }
      }
    });

    // Sort by date (newest first)
    return creditSales.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
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
    const details = (this.currentSession()?.summary as any)?.clientPaymentsDetails as Array<any> | undefined;
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
    const movements = (this.currentSession()?.cashMovements || []) as any[];
    return movements
      .filter((m: any) => (m?.type === 'ENTREE') && ((m?.reason || '').toLowerCase().includes('fonds de caisse') || (m?.reason || '').toLowerCase().includes('alimentation') || (m?.reason || '').toLowerCase().includes('alimenter')))
      .reduce((sum, m: any) => sum + (parseFloat(m.amount || 0) || 0), 0);
  }

  recentExpenses(): Array<{ createdAt: string; type: string; reason: string; amount: number; categoryName?: string | null; supplierName?: string | null; notes?: string | null }> {
    // Helper function to extract paid amount from partial payment notes
    const extractPaidAmount = (notes: string | null | undefined, defaultAmount: number): number => {
      if (!notes) return defaultAmount;
      
      // Match pattern: "Paiement partiel: Xdt payé, reste Ydt" or "Paiement partiel: X dt payé, reste Y dt"
      const match = notes.match(/Paiement partiel:\s*([\d.]+)\s*dt?\s*payé/i);
      if (match && match[1]) {
        const paidAmount = parseFloat(match[1]);
        if (!isNaN(paidAmount) && paidAmount > 0) {
          return paidAmount;
        }
      }
      
      return defaultAmount;
    };

    // Prefer server-provided details if any
    const details = (this.currentSession()?.summary as any)?.expensesDetails as Array<any> | undefined;
    if (details && details.length) {
      // Return ALL expenses, not just 10, so user can see complete details
      return details.map(d => {
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

        // Extract paid amount if partial payment, otherwise use full amount
        const defaultAmount = parseFloat(d.amount || 0) || 0;
        const displayAmount = extractPaidAmount(d.notes, defaultAmount);

        // Format notes to remove remaining amount mention
        let formattedNotes: string | null = d.notes || null;
        if (formattedNotes && formattedNotes.includes('Paiement partiel')) {
          // Remove "reste Xdt" part, keep only "Paiement partiel: Xdt payé"
          formattedNotes = formattedNotes.replace(/,\s*reste\s+[\d.]+\s*dt?/i, '');
        }

        return ({
          createdAt: d.createdAt,
          type: 'SORTIE',
          reason: fullReason,
          amount: displayAmount,
          categoryName,
          supplierName,
          notes: formattedNotes
        });
      });
    }
    // Fallback to movements with expense-like reason (exclude rejected)
    return this.getRecentMovements(10, (m: any) => {
      const reason = String(m.reason || '');
      const amount = parseFloat(m.amount || 0) || 0;
      return m.type === 'SORTIE' && 
             (reason.toLowerCase().includes('dépense') || reason.toLowerCase().includes('depense')) &&
             !reason.includes('[REJETÉ]') && 
             amount > 0;
    });
  }

  recentSupplierPayments(): Array<{ createdAt: string; type: string; reason: string; amount: number }> {
    // Only actual debit movements recorded in caisse, enriched with supplier name when available
    const movements = (this.currentSession()?.cashMovements || []) as any[];
    const details = (this.currentSession()?.summary as any)?.supplierPaymentsDetails as Array<any> | undefined;

    return movements
      .filter(m => {
        const reason = String(m.reason || '');
        const reasonLower = reason.toLowerCase();
        const isSupplierPayment = reasonLower.includes('règlement fournisseur') || reasonLower.includes('reglement fournisseur');
        const amount = parseFloat((m as any).amount || 0) || 0;
        return m.type === 'SORTIE' && isSupplierPayment && amount > 0 && !reason.includes('[REJETÉ]') && !reason.includes('[SUPPRIMÉ]');
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
    const movements = this.currentSession()?.cashMovements || [];
    return movements
      .filter(m => {
        const reason = String(m.reason || '');
        const reasonLower = reason.toLowerCase();
        const isSupplierPayment = reasonLower.includes('règlement fournisseur') || reasonLower.includes('reglement fournisseur');
        const amount = parseFloat((m as any).amount || 0) || 0;
        return m.type === 'SORTIE' && isSupplierPayment && amount > 0 && !reason.includes('[REJETÉ]') && !reason.includes('[SUPPRIMÉ]');
      })
      .reduce((sum, m) => sum + (parseFloat((m as any).amount) || 0), 0);
  }

  // Refunds (Remboursements) - excludes bon de retour (supplier returns)
  recentCancelledTickets(): Array<{ createdAt: string; type: string; reason: string; amount: number; ticketId: number }> {
    const session = this.currentSession();
    if (!session) return [];
    
    const zSales = this.zReportSales();
    const sales = zSales.length > 0 ? zSales : ((session as any)?.sales || []);
    
    return sales
      .filter((sale: any) => {
        const status = (sale.status || '').toUpperCase();
        return status === 'CANCELLED' || status === 'REFUNDED';
      })
      .map((sale: any) => {
        const amount = parseFloat((sale.paidAmount ?? sale.finalTotal ?? sale.amount ?? 0) as any) || 0;
        return {
          createdAt: sale.createdAt || session.openedAt,
          type: 'SORTIE',
          reason: `Ticket N°${sale.id} annulé`,
          amount: amount,
          ticketId: sale.id
        };
      })
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10);
  }

  recentRefunds(): Array<{ createdAt: string; type: string; reason: string; amount: number }> {
    const movements = (this.currentSession()?.cashMovements || []) as any[];
    const sales = ((this.currentSession() as any)?.sales || []) as any[];
    
    // Get cancelled/refunded ticket IDs
    const cancelledTicketIds = new Set(
      sales
        .filter(sale => ['CANCELLED', 'REFUNDED'].includes((sale.status || '').toUpperCase()))
        .map(sale => sale.id)
    );
    
    return movements
      .filter(m => {
        const reason = String(m.reason || '');
        const reasonLower = reason.toLowerCase();
        const isBonRetour = reasonLower.includes('bon de retour');
        const isRefund = reasonLower.includes('remboursement') && !isBonRetour;
        const amount = parseFloat((m as any).amount || 0) || 0;
        const isRejected = reason.includes('[REJETÉ]');
        const isFromCancelledTicket = m.ticketId && cancelledTicketIds.has(m.ticketId);
        return m.type === 'SORTIE' && isRefund && amount > 0 && !isRejected && !isFromCancelledTicket;
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

  getAllSortiesTotal(): number {
    const summary: any = this.currentSession()?.summary || {};
    const sortieFromSummary = parseFloat(summary.sortie || 0) || 0;
    if (sortieFromSummary > 0) {
      return sortieFromSummary;
    }
    
    const movements = this.currentSession()?.cashMovements || [];
    return movements
      .filter(m => {
        const reason = String(m.reason || '');
        const reasonLower = reason.toLowerCase();
        const amount = parseFloat((m as any).amount || 0) || 0;
        const isBonRetour = reasonLower.includes('bon de retour') || 
                           reasonLower.includes('bon retour') ||
                           reasonLower.match(/dépense\s*#\d+:\s*bon\s*(de\s*)?retour/i);
        return ['SORTIE', 'DEPOT_COFFRE', 'RETRAIT_CENTRALE'].includes(m.type) && 
               amount > 0 && 
               !reason.includes('[REJETÉ]') && 
               !reason.includes('[SUPPRIMÉ]') &&
               !isBonRetour;
      })
      .reduce((sum, m) => sum + (parseFloat((m as any).amount) || 0), 0);
  }

  getCancelledTicketsTotal(): number {
    const session = this.currentSession();
    if (!session) return 0;
    
    const zSales = this.zReportSales();
    const sales = zSales.length > 0 ? zSales : ((session as any)?.sales || []);
    
    return sales.reduce((total: number, sale: any) => {
      const status = (sale.status || '').toUpperCase();
      if (status === 'CANCELLED' || status === 'REFUNDED') {
        const amount = parseFloat((sale.paidAmount ?? sale.finalTotal ?? sale.amount ?? 0) as any) || 0;
        return total + amount;
      }
      return total;
    }, 0);
  }

  getRefundsTotal(): number {
    const movements = this.currentSession()?.cashMovements || [];
    const sales = ((this.currentSession() as any)?.sales || []) as any[];
    
    // Get cancelled/refunded ticket IDs
    const cancelledTicketIds = new Set(
      sales
        .filter(sale => ['CANCELLED', 'REFUNDED'].includes((sale.status || '').toUpperCase()))
        .map(sale => sale.id)
    );
    
    return movements
      .filter(m => {
        const reason = String(m.reason || '');
        const reasonLower = reason.toLowerCase();
        const isBonRetour = reasonLower.includes('bon de retour');
        const isRefund = reasonLower.includes('remboursement') && !isBonRetour;
        const amount = parseFloat((m as any).amount || 0) || 0;
        const isRejected = reason.includes('[REJETÉ]');
        const isFromCancelledTicket = m.ticketId && cancelledTicketIds.has(m.ticketId);
        return m.type === 'SORTIE' && isRefund && amount > 0 && !isRejected && !isFromCancelledTicket;
      })
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

  // Computed signal for total sales (sum of all ticket totals) - includes all sales including credit sales
  // Auto-updates when session or sales data changes
  totalSalesTTC = computed(() => {
    // Use Z report sales data (same as tickets modal) if available, otherwise fall back to session sales
    const zSales = this.zReportSales();
    const session = this.currentSession();
    const sales = zSales.length > 0 ? zSales : ((session as any)?.sales || []);
    
    // Sum up all ticket amounts - use finalTotal to include full sale amount for credit sales
    // Exclude canceled, refunded, and gift tickets (CADEAU) from total sales TTC
    return sales.reduce((total: number, sale: any) => {
      const status = (sale.status || '').toUpperCase();
      // Exclude canceled, refunded, and gift tickets from total sales TTC
      // Gift tickets (CADEAU) have amount = 0 and should not be counted in sales
      if (status === 'CANCELLED' || status === 'REFUNDED' || status === 'CADEAU' || status === 'PENDING_ADMIN') {
        return total;
      }
      // Use finalTotal first to include full sale amount (including credit sales)
      // Fallback to paidAmount or amount if finalTotal is not available
      const amount = parseFloat((sale.finalTotal ?? sale.paidAmount ?? sale.amount ?? 0) as any) || 0;
      return total + amount;
    }, 0);
  });

  // Computed signal for total tickets count - auto-updates when session changes
  totalTickets = computed(() => {
    return this.currentSession()?.summary?.totalTickets || 0;
  });

  // Computed signal for cash from sales - pure function, no side effects
  cashFromSalesNetOfCredit = computed(() => {
    // Use cashSalesDetails() which is the actual data source being displayed
    // This ensures consistency with the displayed tickets
    const cashDetails = this.cashSalesDetails();
    
    // Sum up all paid amounts, excluding canceled, refunded, and cadeau tickets
    return cashDetails.reduce((total: number, sale: any) => {
      const status = (sale.status || '').toUpperCase();
      // Exclude canceled, refunded, and cadeau tickets from encaissement
      // Cadeau tickets have amount = 0 and should not be counted in encaissement
      if (status === 'CANCELLED' || status === 'REFUNDED' || status === 'CADEAU' || status === 'PENDING_ADMIN') {
        return total;
      }
      const paidAmount = parseFloat(sale.paidAmount || 0) || 0;
      return total + paidAmount;
    }, 0);
  });

  // Keep method for backward compatibility but use computed signal
  getCashFromSalesNetOfCredit(): number {
    // Request sales data if missing (but only once per session ID)
    const session = this.currentSession();
    if (session && !(session as any)?.sales?.length && session.id && 
        session.id !== this.requestedSalesDataForSessionId && !this.isLoadingSalesData) {
      this.requestedSalesDataForSessionId = session.id;
      setTimeout(() => {
        const currentSession = this.currentSession();
        if (currentSession && currentSession.id === session.id && !((currentSession as any)?.sales?.length)) {
          this.loadSessionSalesData(session.id);
        }
      }, 0);
    }
    return this.cashFromSalesNetOfCredit();
  }

  getExpensesTotal(): number {
    // Helper function to extract paid amount from partial payment notes
    const extractPaidAmount = (notes: string | null | undefined, defaultAmount: number): number => {
      if (!notes) return defaultAmount;
      
      // Match pattern: "Paiement partiel: Xdt payé, reste Ydt" or "Paiement partiel: X dt payé, reste Y dt"
      const match = notes.match(/Paiement partiel:\s*([\d.]+)\s*dt?\s*payé/i);
      if (match && match[1]) {
        const paidAmount = parseFloat(match[1]);
        if (!isNaN(paidAmount) && paidAmount > 0) {
          return paidAmount;
        }
      }
      
      return defaultAmount;
    };

    // Calculate from expenses details if available (using paid amounts for partial payments)
    const summary: any = this.currentSession()?.summary || {};
    const expensesDetails = (summary.expensesDetails || []) as Array<any>;
    if (expensesDetails.length > 0) {
      const totalFromDetails = expensesDetails.reduce((sum, e) => {
        const defaultAmount = parseFloat(e.amount || 0) || 0;
        const displayAmount = extractPaidAmount(e.notes, defaultAmount);
        return sum + displayAmount;
      }, 0);
      if (totalFromDetails > 0) return totalFromDetails;
    }
    
    // Fallback: Prefer server-provided total if available
    const fromSummary = parseFloat(summary.expensesTotal || 0) || 0;
    if (fromSummary > 0) {
      return fromSummary;
    }
    
    // Final fallback: movements tagged as expenses or bon de retour (exclude rejected)
    const movements = this.currentSession()?.cashMovements || [];
    const totalFromMovements = movements
      .filter(m => {
        const reason = String(m.reason || '');
        const reasonLower = reason.toLowerCase();
        const amount = parseFloat((m as any).amount || 0) || 0;
        const isExpense = reasonLower.includes('dépense') || reasonLower.includes('depense');
        const isBonRetour = reasonLower.includes('bon de retour');
        return m.type === 'SORTIE' && 
               (isExpense || isBonRetour) &&
               !reason.includes('[REJETÉ]') && 
               amount > 0;
      })
      .reduce((sum, m) => sum + (parseFloat((m as any).amount) || 0), 0);
    
    return totalFromMovements;
  }

  getComputedExpectedCash(): number {
    const opening = parseFloat((this.currentSession()?.openingFund as any) || 0) || 0;
    const cashFromSales = this.cashFromSalesNetOfCredit(); // Use computed signal directly
    const clientPayments = this.getClientPaymentsTotal();
    const orderAdvances = this.getTotalOrderAdvances();
    const expenses = this.getExpensesTotal();
    const supplierRegs = this.getSupplierPaymentsTotal();
    const refunds = this.getRefundsTotal();
    return opening + cashFromSales + clientPayments + orderAdvances - expenses - supplierRegs - refunds;
  }

  // Get the actual expected cash from the session (not calculated)
  // Subtract cancelled tickets amount from the balance
  getSessionExpectedCash(): number {
    const baseExpectedCash = parseFloat((this.currentSession()?.expectedCash as any) || 0) || 0;
    const cancelledTicketsTotal = this.getCancelledTicketsTotal();
    return baseExpectedCash - cancelledTicketsTotal;
  }

  // Opening fund as computed signal for auto-updates
  openingFund = computed(() => {
    return parseFloat((this.currentSession()?.openingFund as any) || 0) || 0;
  });

  // Keep method for backward compatibility
  getOpeningFund(): number {
    return this.openingFund();
  }

  // Get user sales summary for display under solde de caisse - uses same logic as tickets modal
  getUserSalesSummary(): Array<{ userName: string; totalSales: number }> {
    const session = this.currentSession();
    if (!session) return [];

    // Use Z report sales data (same as tickets modal) if available, otherwise fall back to session sales
    const zSales = this.zReportSales();
    const sales = zSales.length > 0 ? zSales : ((session as any)?.sales || []);
    if (!sales.length) return [];

    // Group sales by user - use EXACT same calculation as tickets modal
    const userSalesMap = new Map<string, number>();
    
    sales.forEach((sale: any) => {
      const status = (sale.status || '').toUpperCase();
      // Exclude canceled, refunded, and gift tickets from user sales summary
      // Gift tickets (CADEAU) should not be counted in sales
      if (status === 'CANCELLED' || status === 'REFUNDED' || status === 'CADEAU' || status === 'PENDING_ADMIN') {
        return;
      }
      
      // Use EXACT same calculation as openTicketsModal: paidAmount ?? finalTotal ?? amount ?? 0
      const amount = parseFloat((sale.paidAmount ?? sale.finalTotal ?? sale.amount ?? 0) as any) || 0;
      
      // Get user name - handle cases where user might be missing
      let userName = 'Utilisateur inconnu';
      if (sale.user) {
        const firstName = sale.user.firstName || '';
        const lastName = sale.user.lastName || '';
        userName = `${firstName} ${lastName}`.trim() || 'Utilisateur inconnu';
      }

      // Sum up amounts per user (include all sales, even without user)
      if (userSalesMap.has(userName)) {
        userSalesMap.set(userName, userSalesMap.get(userName)! + amount);
      } else {
        userSalesMap.set(userName, amount);
      }
    });

    // Convert to array and sort by sales amount (descending)
    return Array.from(userSalesMap.entries())
      .map(([userName, totalSales]) => ({ userName, totalSales }))
      .sort((a, b) => b.totalSales - a.totalSales);
  }

  // Load and show current session tickets (id + amount)
  openTicketsModal(): void {
    const session = this.currentSession();
    if (!session) return;
    this.loading.set(true);
    this.sessionsService.getSessionReport(session.id, 'Z').subscribe({
      next: (report: any) => {
        const sales = (report?.session?.sales || []) as Array<any>;
        // Store Z report sales for totalSalesTTC calculation
        this.zReportSales.set(sales);
        // Show all tickets including cancelled ones, but exclude them from totals
        this.sessionTickets.set(sales.map(s => ({
          id: s.id,
          amount: parseFloat((s.paidAmount ?? s.finalTotal ?? s.amount ?? 0) as any) || 0,
          totalAmount: s.totalAmount ?? s.finalTotal,
          createdAt: s.createdAt,
          status: s.status,
          // carry session-local numbering fields for display in modal
          dailyTicketNumber: s.dailyTicketNumber ?? s.sessionTicketNumber ?? s.numero ?? s.sessionIndex ?? s.sessionSeq ?? null
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
  
  // Load Z report sales data for totalSalesTTC (called when session loads)
  private loadZReportSalesData(sessionId: number): void {
    this.sessionsService.getSessionReport(sessionId, 'Z').subscribe({
      next: (report: any) => {
        const sales = (report?.session?.sales || []) as Array<any>;
        this.zReportSales.set(sales);
      },
      error: () => {
        // Silently fail - will retry when tickets modal is opened
      }
    });
  }

  private lastCashSalesSnapshot: string | null = null;
  private lastLoadCashSalesSessionId: number | null = null;
  private loadCashSalesTimeout: any = null;
  loadCashSalesDetails(): void {
    const session = this.currentSession();
    if (!session || this.cashSalesLoading()) return;
    
    // Prevent loading if already loaded for this session
    if (this.lastLoadCashSalesSessionId === session.id && this.cashSalesDetails().length > 0) {
      return; // Already have data for this session
    }
    
    // Debounce rapid calls (e.g., from multiple checkbox changes)
    if (this.loadCashSalesTimeout) {
      clearTimeout(this.loadCashSalesTimeout);
    }
    
    this.loadCashSalesTimeout = setTimeout(() => {
      this.loadCashSalesTimeout = null;
      this.performLoadCashSalesDetails();
    }, 100);
  }
  
  private performLoadCashSalesDetails(): void {
    const session = this.currentSession();
    if (!session || this.cashSalesLoading()) return;
    
    // Prevent multiple simultaneous calls
    this.cashSalesLoading.set(true);
    this.lastLoadCashSalesSessionId = session.id;
    this.sessionsService.getSessionReport(session.id, 'X').subscribe({
      next: (report: any) => {
        const sales = (report?.session?.sales || []) as Array<any>;
        const cashSales = sales.filter(s => {
          const status = (s.status || '').toUpperCase();
          // Exclude canceled, refunded, and gift tickets (CADEAU) from cash sales
          // Gift tickets have amount = 0 and should not be counted in encaissement
          if (status === 'CANCELLED' || status === 'REFUNDED' || status === 'CADEAU' || status === 'PENDING_ADMIN') {
            return false;
          }
          
          const method = ((s.paymentMethod?.type || '') as string).toUpperCase();
          const paid = parseFloat(s.paidAmount ?? 0) || 0;
          const total = parseFloat((s.finalTotal ?? s.totalAmount ?? 0) as any) || 0;
          const hasCredit = total - paid > 0;
          
          // Debug log for wholesale sales
          if (s.isWholesale) {
            console.log('Wholesale sale in closure:', {
              id: s.id,
              paymentType: s.paymentType,
              method: method,
              paid: paid,
              total: total,
              hasCredit: hasCredit,
              paidAmount: s.paidAmount,
              finalTotal: s.finalTotal,
              totalAmount: s.totalAmount
            });
          }
          
          // Include all cash-related tickets; we'll style struck for cancelled/refunded
          return (method === 'CASH' || paid > 0 || hasCredit);
        });
        // Merge status from current session sales if missing
        const existing = (((this.currentSession() as any)?.sales) || []) as any[];
        const statusById = new Map<number, string>(existing.map(e => [e.id, (e.status || '').toString()]));
        const rows = cashSales.map(s => ({
          id: s.id,
          paidAmount: parseFloat(s.paidAmount ?? 0) || 0,
          totalAmount: parseFloat((s.finalTotal ?? s.totalAmount ?? 0) as any) || 0,
          discount: parseFloat(s.discount ?? 0) || 0,
          createdAt: s.createdAt,
          status: (s.status || statusById.get(s.id) || '').toString(),
          dailyTicketNumber: (s as any)?.dailyTicketNumber
        }));
        // Sort latest first (descending by createdAt, fallback by id)
        rows.sort((a: any, b: any) => {
          const ta = new Date(a.createdAt || 0).getTime();
          const tb = new Date(b.createdAt || 0).getTime();
          if (tb !== ta) return tb - ta;
          return (b.id || 0) - (a.id || 0);
        });
        
        // Check if cash sales data actually changed before updating
        const newCashSalesSnapshot = JSON.stringify({
          len: rows.length,
          total: rows.reduce((sum: number, r: any) => sum + (r.totalAmount || 0), 0),
          lastId: rows.length ? rows[0].id : null
        });
        
        // Only update if cash sales data changed
        if (this.lastCashSalesSnapshot !== newCashSalesSnapshot) {
          this.cashSalesDetails.set(rows);
          this.lastCashSalesSnapshot = newCashSalesSnapshot;
        }
        
        this.cashSalesLoading.set(false);
      },
      error: () => {
        this.lastLoadCashSalesSessionId = null; // Reset on error to allow retry
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
  
  // Fund form
  fundForm = {
    amount: ''
  };
  
  // Adjust balance form
  adjustForm = {
    newBalance: ''
  };
  

  constructor(
    private sessionsService: SessionsService,
    private authService: AuthService,
    private router: Router,
    private printService: PrintService,
    private dailyExtractService: DailyExtractService,
    private settingsService: SettingsService,
    private depotsService: DepotsService,
    private ticketCounterService: TicketCounterService,
    private salesService: SalesService
  ) {}

  ngOnInit(): void {
    this.settings$ = this.settingsService.getSettings();
    this.isAdminUser = this.authService.isAdmin();
    // Load immediately; depot scope is handled globally via header
    this.loadCurrentSession();
    // Refresh session data every 15 seconds to reduce flicker (pause when modal open or tab hidden)
    this.refreshIntervalId = setInterval(() => {
      if (document?.hidden) return;
      if (this.showCloseForm() || this.showFundForm() || this.showAdjustForm() || this.showTicketsModal()) return;
      if (this.currentSession()) {
        this.loadCurrentSession(true);
      }
    }, 15000);
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
    
    // Get depot ID for isolation (no user linkage)
    const userDepotId = this.authService.currentUser()?.depotId;
    const visitingDepotId = sessionStorage.getItem('visitingDepotId');
    const currentDepotId = visitingDepotId ? parseInt(visitingDepotId) : (userDepotId || 0);
    
    // Debug logging
    console.log('[Cloture] Loading session:', {
      userDepotId,
      visitingDepotId,
      currentDepotId,
      user: this.authService.currentUser()
    });
    
    if (!currentDepotId) {
      this.error.set('Aucun dépôt sélectionné. Veuillez sélectionner un dépôt.');
      this.loading.set(false);
      this.isRefreshing = false;
      return;
    }
    
    // Load active session for closure
    this.sessionsService.getActiveSessionByDepot(1, currentDepotId).subscribe({
      next: (session) => {
        // Build a compact snapshot to detect meaningful changes
        const snapshot = session ? JSON.stringify({
          id: session.id,
          expectedCash: (session as any)?.summary?.expectedCash ?? null,
          totalSales: (session as any)?.summary?.totalSales ?? null,
          totalTickets: (session as any)?.summary?.totalTickets ?? null,
          cmLen: (session as any)?.cashMovements?.length ?? 0
        }) : 'null';

        if (this.lastSessionSnapshot !== snapshot) {
          this.currentSession.set(session);
          this.lastSessionSnapshot = snapshot;
        }
        
        // Reset requested flag when session changes
        if (session && this.requestedSalesDataForSessionId !== session.id) {
          this.requestedSalesDataForSessionId = null;
          this.lastLoadedSessionId = null; // Reset when session changes
          this.lastLoadCashSalesSessionId = null; // Reset cash sales session tracking
          this.zReportSales.set([]); // Reset Z report sales when session changes
        }
        
        // Only load sales data if session ID changed or if we don't have sales data yet
        if (session) {
          const currentSession = this.currentSession();
          const hasSalesData = (currentSession as any)?.sales?.length > 0;
          const needsSalesData = !currentSession || 
            !hasSalesData ||
            currentSession.id !== session.id;
          
          // Only load if we actually need it and haven't already loaded it
          if (needsSalesData && !this.isLoadingSalesData && this.lastLoadedSessionId !== session.id) {
            this.requestedSalesDataForSessionId = session.id;
            this.loadSessionSalesData(session.id);
          }
          
          // Load Z report sales data for totalSalesTTC calculation
          // Refresh on every session update to ensure totalSalesTTC is always current
          if (!currentSession || currentSession.id !== session.id || this.zReportSales().length === 0) {
            this.loadZReportSalesData(session.id);
          } else if (currentSession.id === session.id) {
            // Refresh Z report sales even if session ID is same to get latest sales data
            // This ensures totalSalesTTC updates when new sales are added
            this.loadZReportSalesData(session.id);
          }
          
          // Only load cash details if we don't have them yet or session changed
          const needsCashDetails = !this.cashSalesDetails().length || 
            (currentSession && currentSession.id !== session.id);
          
          if (needsCashDetails && !this.cashSalesLoading()) {
            this.loadCashSalesDetails();
          }
        }
        
        if (!silent) this.loading.set(false);
        this.isRefreshing = false;
      },
      error: (error) => {
        this.error.set('Erreur lors du chargement de la session');
        if (!silent) this.loading.set(false);
        this.isRefreshing = false;
      }
    });
  }

  // Load specific session by ID
  loadSessionById(sessionId: number, silent: boolean = false): void {
    if (this.isRefreshing) return;
    this.isRefreshing = true;
    if (!silent) this.loading.set(true);
    
    this.sessionsService.getSessionById(sessionId).subscribe({
      next: (session) => {
        // Build a compact snapshot to detect meaningful changes
        const snapshot = session ? JSON.stringify({
          id: session.id,
          expectedCash: (session as any)?.summary?.expectedCash ?? null,
          totalSales: (session as any)?.summary?.totalSales ?? null,
          totalTickets: (session as any)?.summary?.totalTickets ?? null,
          cmLen: (session as any)?.cashMovements?.length ?? 0
        }) : 'null';

        if (this.lastSessionSnapshot !== snapshot) {
          this.currentSession.set(session);
          this.lastSessionSnapshot = snapshot;
        }
        
        // Reset requested flag when session changes
        if (session && this.requestedSalesDataForSessionId !== session.id) {
          this.requestedSalesDataForSessionId = null;
          this.lastLoadedSessionId = null; // Reset when session changes
          this.lastLoadCashSalesSessionId = null; // Reset cash sales session tracking
          this.zReportSales.set([]); // Reset Z report sales when session changes
        }
        
        // Only load sales data if session ID changed or if we don't have sales data yet
        if (session) {
          const currentSession = this.currentSession();
          const hasSalesData = (currentSession as any)?.sales?.length > 0;
          const needsSalesData = !currentSession || 
            !hasSalesData ||
            currentSession.id !== session.id;
          
          // Only load if we actually need it and haven't already loaded it
          if (needsSalesData && !this.isLoadingSalesData && this.lastLoadedSessionId !== session.id) {
            this.requestedSalesDataForSessionId = session.id;
            this.loadSessionSalesData(session.id);
          }
          
          // Load Z report sales data for totalSalesTTC calculation
          // Refresh on every session update to ensure totalSalesTTC is always current
          if (!currentSession || currentSession.id !== session.id || this.zReportSales().length === 0) {
            this.loadZReportSalesData(session.id);
          } else if (currentSession.id === session.id) {
            // Refresh Z report sales even if session ID is same to get latest sales data
            // This ensures totalSalesTTC updates when new sales are added
            this.loadZReportSalesData(session.id);
          }
          
          // Only load cash details if we don't have them yet or session changed
          const needsCashDetails = !this.cashSalesDetails().length || 
            (currentSession && currentSession.id !== session.id);
          
          if (needsCashDetails && !this.cashSalesLoading()) {
            this.loadCashSalesDetails();
          }
        }
        
        if (!silent) this.loading.set(false);
        this.isRefreshing = false;
      },
      error: (error) => {
        this.error.set('Erreur lors du chargement de la session');
        if (!silent) this.loading.set(false);
        this.isRefreshing = false;
      }
    });
  }

  // Load session sales data for user summary
  private isLoadingSalesData = false;
  private loadSessionSalesData(sessionId: number): void {
    // Prevent multiple simultaneous calls
    if (this.isLoadingSalesData) return;
    
    this.isLoadingSalesData = true;
    this.sessionsService.getSessionReport(sessionId, 'X').subscribe({
      next: (report: any) => {
        const currentSession = this.currentSession();
        if (currentSession && report?.session) {
          // Always update session with sales data, regardless of snapshot changes
          const sales = report.session.sales || [];
          
          // Check if sales data actually changed before updating
          const newSalesSnapshot = JSON.stringify({
            len: sales.length,
            lastId: sales.length ? sales[sales.length - 1].id : null,
            lastUpdated: sales.length ? sales[sales.length - 1].updatedAt || sales[sales.length - 1].createdAt : null
          });
          
          // Only update if sales data changed
          if (this.lastSalesSnapshot !== newSalesSnapshot) {
            const updatedSession = {
              ...currentSession,
              sales: sales
            } as any;
            this.currentSession.set(updatedSession);
            this.lastSalesSnapshot = newSalesSnapshot;
          }
        }
        this.isLoadingSalesData = false;
      },
      error: (error) => {
        // Silently fail - user summary is not critical
        console.debug('Failed to load sales data for user summary:', error);
        this.isLoadingSalesData = false;
      }
    });
  }

  autoOpenSession(openingFund: number = 0): void {
    this.loading.set(true);
    
    // Get depot ID for isolation (no user linkage)
    const userDepotId = this.authService.currentUser()?.depotId;
    const visitingDepotId = sessionStorage.getItem('visitingDepotId');
    const currentDepotId = visitingDepotId ? parseInt(visitingDepotId) : (userDepotId || 0);
    
    // If a session is already open for this depot, do not attempt to auto-open
    this.sessionsService.getActiveSessionByDepot(1, currentDepotId).subscribe({
      next: (active) => {
        if (active) {
          this.currentSession.set(active);
          this.loading.set(false);
          this.error.set('');
          return;
        }
        
        // Build payload: include openingFund only if it is a meaningful positive value
        const payload: any = {
          posId: 1,
          depotId: currentDepotId,
          note: 'Session automatique'
        };
        if (Number.isFinite(openingFund) && openingFund > 0) {
          payload.openingFund = openingFund;
        }
        
        this.sessionsService.openSessionByDepot(payload).subscribe({
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
      },
      error: () => {
        // If we fail to check, fallback to attempting open with guarded payload
        const payload: any = {
          posId: 1,
          depotId: currentDepotId,
          note: 'Session automatique'
        };
        if (Number.isFinite(openingFund) && openingFund > 0) {
          payload.openingFund = openingFund;
        }
        this.sessionsService.openSessionByDepot(payload).subscribe({
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
            
            // Add opening fund from current session to the session report
            if (sessionReport.session && this.currentSession()) {
              sessionReport.session.openingFund = this.currentSession()?.openingFund || 0;
            }
            
            // Print the comprehensive session extract with real company data
            this.printService.printDailyExtractWithWithdrawal(sessionReport, companyData, withdrawalAmount);
          },
          error: (error) => {
            console.error('Error fetching settings:', error);
            // Print without company data if settings fetch fails
            this.printService.printDailyExtractWithWithdrawal(sessionReport, undefined, withdrawalAmount);
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
            
            // Reset ticket counter after successful session closure
            this.ticketCounterService.resetTicketCounter();
            
            // Automatically open new session with the remaining balance
            this.autoOpenSession(resp.remainingBalance || 0);
            
            // Always return to caisse after closure
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

  printDetailedReport(): void {
    const session = this.currentSession();
    if (!session) return;

    this.loading.set(true);
    this.sessionsService.getSessionReport(session.id, 'Z').subscribe({
      next: (sessionReport) => {
        this.settingsService.getSettings().subscribe({
          next: (settings) => {
            const companyData = {
              companyName: settings.companyName,
              depotName: sessionReport.session?.depot?.name,
              address: sessionReport.session?.depot?.address || '123 Rue de la Paix',
              city: sessionReport.session?.depot?.city || 'Tunis, Tunisie',
              phone: sessionReport.session?.depot?.phone || '+216 71 123 456'
            };
            
            // Add opening fund from current session to the session report
            if (sessionReport.session && this.currentSession()) {
              sessionReport.session.openingFund = this.currentSession()?.openingFund || 0;
            }
            
            this.printService.printDetailedSessionReport(sessionReport, companyData);
            this.loading.set(false);
          },
          error: (error) => {
            console.error('Error fetching settings:', error);
            this.printService.printDetailedSessionReport(sessionReport);
            this.loading.set(false);
          }
        });
      },
      error: (error) => {
        this.error.set('Erreur lors de l\'impression du rapport détaillé');
        this.loading.set(false);
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

    if (path === 'encaissement.cash' && updated.encaissement.cash) {
      this.loadCashSalesDetails();
    }
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
    this.router.navigate(['/home']);
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

  adjustBalance(): void {
    const session = this.currentSession();
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
        this.loadCurrentSession();
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
            cashFromSales: this.cashFromSalesNetOfCredit()
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