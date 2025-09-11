import { Component, OnInit } from '@angular/core';
import { SalesService } from '../core/services/sales.service';
import { Sale } from '../core/models/sale.model';
import { ExpenseService, Expense } from '../core/services/expense.service';
import { ApprovalsService, ChangeRequest } from '../core/services/approvals.service';
import { SessionsService } from '../core/services/sessions.service';

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
  clotureSummaries: { [sessionId: number]: any } = {};
  selectedTab: 'ALL' | 'PENDING_ADMIN' | 'CADEAU' | 'EXPENSES' | 'CLOTURE' = 'ALL';
  searchQuery = '';
  startDate = '';
  endDate = '';
  showAlert = false;
  alertMessage = '';
  alertType: 'success' | 'error' | 'info' = 'info';

  constructor(
    private salesService: SalesService,
    private expenseService: ExpenseService,
    private approvalsService: ApprovalsService,
    private sessionsService: SessionsService
  ) {}

  ngOnInit(): void {
    this.loadGifts();
    this.loadExpenses();
    this.loadVarianceRequests();
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
      },
      error: () => {
        this.showAlertMessage("Erreur lors de l'approbation de la clôture", 'error');
      }
    });
  }

  rejectCloture(req: ChangeRequest): void {
    this.approvalsService.rejectChangeRequest(req.id).subscribe({
      next: () => {
        this.showAlertMessage('Clôture rejetée', 'success');
        this.loadVarianceRequests();
      },
      error: () => {
        this.showAlertMessage('Erreur lors du rejet de la clôture', 'error');
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
} 