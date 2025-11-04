import { Component, OnInit } from '@angular/core';
import { SalesService } from '../core/services/sales.service';
import { ExpenseService, Expense } from '../core/services/expense.service';
import { ApprovalsService, ChangeRequest } from '../core/services/approvals.service';
import { Sale } from '../core/models/sale.model';

@Component({
  selector: 'app-approvals-history',
  templateUrl: './approvals-history.component.html',
  standalone: false
})
export class ApprovalsHistoryComponent implements OnInit {
  loading = false;
  error = '';
  approvedGifts: Sale[] = [];
  approvedExpenses: Expense[] = [];
  searchQuery = '';
  startDate = '';
  endDate = '';
  selectedTab: 'ALL' | 'GIFTS' | 'EXPENSES' | 'CLOTURE' = 'ALL';
  sortOrder: 'desc' | 'asc' = 'desc';
  showAlert = false;
  alertMessage = '';
  alertType: 'success' | 'error' | 'info' = 'info';

  clotureHistory: ChangeRequest[] = [];

  constructor(
    private salesService: SalesService,
    private expenseService: ExpenseService,
    private approvalsService: ApprovalsService
  ) {}

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading = true;
    this.error = '';
    this.salesService.getSales().subscribe({
      next: (sales) => {
        this.approvedGifts = (sales || []).filter(s => s.status === 'CADEAU' || s.status === 'CANCELLED');
        this.loading = false;
      },
      error: () => {
        this.error = "Erreur lors du chargement des ventes approuvées";
        this.loading = false;
      }
    });
    this.expenseService.getExpenses().subscribe({
      next: (expenses) => {
        this.approvedExpenses = (expenses || []).filter(e => !!e.isApproved);
      },
      error: () => {
        this.error = this.error || "Erreur lors du chargement des dépenses approuvées";
      }
    });

    // Load approved and rejected clôture requests
    this.approvalsService.getVarianceChangeRequests('APPROVED').subscribe({
      next: (approved) => {
        const a = approved || [];
        this.approvalsService.getVarianceChangeRequests('REJECTED').subscribe({
          next: (rejected) => {
            const r = rejected || [];
            // Merge and sort later in getters
            this.clotureHistory = [...a, ...r];
          },
          error: () => {
            this.clotureHistory = a;
          }
        });
      },
      error: () => {}
    });
  }

  applyFilters(): void {}

  clearFilters(): void {
    this.searchQuery = '';
    this.startDate = '';
    this.endDate = '';
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('fr-TN', { style: 'currency', currency: 'TND' }).format(amount);
  }

  async revertExpense(expenseId: number): Promise<void> {
    const expense = this.approvedExpenses.find(e => e.id === expenseId);
    if (!expense) return;
    const ok = window.confirm(`Annuler l'approbation de la dépense #${expenseId} ?`);
    if (!ok) return;
    try {
      await this.expenseService.approveExpense(expenseId, false).toPromise();
      this.showMessage('Dépense déplacée en attente', 'success');
      this.loadData();
    } catch (e) {
      this.showMessage("Impossible d'annuler cette dépense", 'error');
    }
  }

  async revertGift(saleId: number): Promise<void> {
    const gift = this.approvedGifts.find(s => s.id === saleId);
    if (!gift) return;
    const ok = window.confirm(`Annuler le cadeau #${saleId} et le retirer des approuvés ?`);
    if (!ok) return;
    try {
      // Backend may not support reverting an approved gift; we attempt reject endpoint
      await this.salesService.rejectGiftSale(saleId).toPromise();
      this.showMessage('Cadeau annulé', 'success');
      this.loadData();
    } catch (e) {
      this.showMessage("Impossible d'annuler ce cadeau", 'error');
    }
  }

  private showMessage(message: string, type: 'success' | 'error' | 'info'): void {
    this.alertMessage = message;
    this.alertType = type;
    this.showAlert = true;
    setTimeout(() => { this.showAlert = false; }, 2500);
  }

  get filteredGifts(): Sale[] {
    let list = this.approvedGifts;
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      list = list.filter(s => (s.notes || '').toLowerCase().includes(q) || `${s.id}`.includes(q));
    }
    if (this.startDate && this.endDate) {
      const start = new Date(this.startDate);
      const end = new Date(this.endDate);
      list = list.filter(s => {
        const d = new Date(s.createdAt as unknown as string);
        return d >= start && d <= end;
      });
    }
    return list;
  }

  get filteredExpenses(): Expense[] {
    let list = this.approvedExpenses;
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      list = list.filter(e => `${e.id}`.includes(q) || (e.description || '').toLowerCase().includes(q) || (e.notes || '').toLowerCase().includes(q));
    }
    if (this.startDate && this.endDate) {
      const start = new Date(this.startDate);
      const end = new Date(this.endDate);
      list = list.filter(e => {
        const d = new Date(e.date);
        return d >= start && d <= end;
      });
    }
    return list;
  }

  get filteredCloture(): ChangeRequest[] {
    let list = this.clotureHistory;
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      list = list.filter(cr => `${cr.entityId}`.includes(q) || (cr.reason || '').toLowerCase().includes(q));
    }
    if (this.startDate && this.endDate) {
      const start = new Date(this.startDate);
      const end = new Date(this.endDate);
      list = list.filter(cr => {
        const d = new Date(cr.createdAt);
        return d >= start && d <= end;
      });
    }
    return list;
  }

  get historyItems(): Array<{
    type: 'GIFT' | 'EXPENSE' | 'CLOTURE';
    id: number;
    date: Date;
    title: string;
    subtitle?: string;
    amount?: number;
    status?: string;
  }> {
    const gifts = this.filteredGifts.map(s => ({
      type: 'GIFT' as const,
      id: s.id,
      date: new Date(s.createdAt as unknown as string),
      title: `Cadeau #${s.id}`,
      subtitle: s.notes || '',
      amount: 0
    }));

    const expenses = this.filteredExpenses.map(e => ({
      type: 'EXPENSE' as const,
      id: e.id,
      date: new Date(e.date),
      title: `Dépense #${e.id}`,
      subtitle: e.description || '',
      amount: e.amount
    }));

    const clotures = this.filteredCloture.map(cr => ({
      type: 'CLOTURE' as const,
      id: cr.session?.id || cr.entityId,
      date: new Date(cr.updatedAt || cr.createdAt),
      title: `Clôture • Session #${cr.session?.id || cr.entityId}`,
      subtitle: cr.reason || '',
      amount: undefined,
      status: cr.status
    }));

    const merged = [...gifts, ...expenses, ...clotures];
    merged.sort((a, b) => (this.sortOrder === 'desc' ? b.date.getTime() - a.date.getTime() : a.date.getTime() - b.date.getTime()));
    return merged;
  }
}


