import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DepotsService } from '../../core/services/depots.service';
import { ExpenseService, ExpenseCategory, Expense, PaymentType } from '../../core/services/expense.service';
import { AuthService } from '../../core/services/auth.service';
import { Depot } from '../../core/models/depot.model';

@Component({
  selector: 'app-depot-expenses',
  templateUrl: './depot-expenses.component.html',
  standalone: false
})
export class DepotExpensesComponent implements OnInit {
  depotId!: number;
  depot: Depot | null = null;
  expenses: Expense[] = [];
  categories: ExpenseCategory[] = [];
  loading = true;
  error = '';
  currentUser: any = null;

  // Modal properties
  showAddExpenseModal = false;
  showEditExpenseModal = false;
  showDeleteConfirmModal = false;
  selectedExpense: Expense | null = null;

  newExpense = {
    amount: NaN,
    description: '',
    categoryId: 0,
    paymentType: 'CASH' as PaymentType,
    date: new Date().toISOString().split('T')[0],
    collectionDate: new Date().toISOString().split('T')[0]
  };

  selectedCategory: ExpenseCategory | null = null;

  // Payment type options
  paymentTypes = [
    { value: 'CASH', label: 'Espèces', icon: '💵' },
    { value: 'CHECK', label: 'Chèque', icon: '🏦' },
    { value: 'BANK_TRANSFER', label: 'Virement', icon: '💳' },
    { value: 'WIRE_TRANSFER', label: 'Traite', icon: '📄' }
  ];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private depotsService: DepotsService,
    private expenseService: ExpenseService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.loadCurrentUser();
    this.route.paramMap.subscribe(params => {
      const idParam = params.get('id');
      this.depotId = idParam ? parseInt(idParam, 10) : 0;
      this.loadDepot();
      this.loadExpenses();
      this.loadExpenseCategories();
    });
  }

  loadCurrentUser() {
    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
    });
  }

  loadDepot() {
    if (!this.depotId) return;
    this.depotsService.get(this.depotId).subscribe({
      next: (depot) => { 
        this.depot = depot; 
      },
      error: (error) => { 
        this.error = 'Dépôt introuvable'; 
      }
    });
  }

  loadExpenses() {
    if (!this.depotId) return;
    this.loading = true;
    this.expenseService.getExpenses({ depotId: this.depotId }).subscribe({
      next: (expenses) => {
        this.expenses = expenses || [];
        this.loading = false;
      },
      error: (error) => {
        this.error = 'Erreur lors du chargement des dépenses';
        this.loading = false;
        console.error('Error loading expenses:', error);
      }
    });
  }

  loadExpenseCategories() {
    this.expenseService.getCategories().subscribe({
      next: (categories) => {
        this.categories = categories || [];
      },
      error: (error) => {
        console.error('Error loading expense categories:', error);
      }
    });
  }

  // Modal methods
  openAddExpenseModal() {
    this.showAddExpenseModal = true;
    this.resetNewExpense();
  }

  closeAddExpenseModal() {
    this.showAddExpenseModal = false;
    this.resetNewExpense();
  }

  openEditExpenseModal(expense: Expense) {
    this.selectedExpense = expense;
    this.newExpense = {
      amount: expense.amount,
      description: expense.description || '',
      categoryId: expense.categoryId,
      paymentType: expense.paymentType,
      date: expense.date.split('T')[0],
      collectionDate: expense.collectionDate.split('T')[0]
    };
    this.selectedCategory = this.categories.find(c => c.id === expense.categoryId) || null;
    this.showEditExpenseModal = true;
  }

  closeEditExpenseModal() {
    this.showEditExpenseModal = false;
    this.selectedExpense = null;
    this.resetNewExpense();
  }

  openDeleteConfirmModal(expense: Expense) {
    this.selectedExpense = expense;
    this.showDeleteConfirmModal = true;
  }

  closeDeleteConfirmModal() {
    this.showDeleteConfirmModal = false;
    this.selectedExpense = null;
  }

  selectCategory(category: ExpenseCategory): void {
    this.selectedCategory = category;
    this.newExpense.categoryId = category.id;
  }

  selectPaymentType(paymentType: string): void {
    this.newExpense.paymentType = paymentType as PaymentType;
  }

  resetNewExpense(): void {
    this.newExpense = {
      amount: NaN,
      description: '',
      categoryId: 0,
      paymentType: 'CASH' as PaymentType,
      date: new Date().toISOString().split('T')[0],
      collectionDate: new Date().toISOString().split('T')[0]
    };
    this.selectedCategory = null;
  }

  async saveExpense(): Promise<void> {
    if (!this.newExpense.amount || !this.newExpense.categoryId) {
      this.error = 'Veuillez remplir tous les champs obligatoires';
      return;
    }

    if (!this.currentUser) {
      this.error = 'Utilisateur non connecté';
      return;
    }

    try {
      const expense = {
        ...this.newExpense,
        depotId: this.depotId,
        userId: this.currentUser.id
      };

      await this.expenseService.createExpense(expense).toPromise();
      
      this.closeAddExpenseModal();
      this.loadExpenses();
      this.error = '';
    } catch (error) {
      this.error = 'Erreur lors de l\'enregistrement de la dépense';
      console.error('Error saving expense:', error);
    }
  }

  async updateExpense(): Promise<void> {
    if (!this.selectedExpense || !this.newExpense.amount || !this.newExpense.categoryId) {
      this.error = 'Veuillez remplir tous les champs obligatoires';
      return;
    }

    try {
      const expenseData = {
        amount: this.newExpense.amount,
        categoryId: this.newExpense.categoryId,
        notes: undefined,
        receiptUrl: undefined,
        supplierId: undefined,
        description: this.newExpense.description || undefined
      };

      await this.expenseService.updateExpense(this.selectedExpense.id, expenseData).toPromise();
      
      this.closeEditExpenseModal();
      this.loadExpenses();
      this.error = '';
    } catch (error) {
      this.error = 'Erreur lors de la mise à jour de la dépense';
      console.error('Error updating expense:', error);
    }
  }

  async deleteExpense(): Promise<void> {
    if (!this.selectedExpense) return;

    try {
      await this.expenseService.deleteExpense(this.selectedExpense.id).toPromise();
      
      this.closeDeleteConfirmModal();
      this.loadExpenses();
      this.error = '';
    } catch (error) {
      this.error = 'Erreur lors de la suppression de la dépense';
      console.error('Error deleting expense:', error);
    }
  }

  async approveExpense(expense: Expense, isApproved: boolean): Promise<void> {
    try {
      await this.expenseService.approveExpense(expense.id, isApproved).toPromise();
      this.loadExpenses();
    } catch (error) {
      this.error = 'Erreur lors de l\'approbation';
      console.error('Error approving expense:', error);
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

  getPaymentTypeIcon(paymentType: PaymentType): string {
    const paymentTypeMap = {
      'CASH': '💵',
      'CHECK': '🏦',
      'BANK_TRANSFER': '💳',
      'WIRE_TRANSFER': '📄'
    };
    return paymentTypeMap[paymentType] || '💵';
  }

  getPaymentTypeLabel(paymentType: PaymentType): string {
    const paymentTypeMap = {
      'CASH': 'Espèces',
      'CHECK': 'Chèque',
      'BANK_TRANSFER': 'Virement',
      'WIRE_TRANSFER': 'Traite'
    };
    return paymentTypeMap[paymentType] || 'Espèces';
  }

  goBack() {
    this.router.navigate(['/stock']);
  }
}
