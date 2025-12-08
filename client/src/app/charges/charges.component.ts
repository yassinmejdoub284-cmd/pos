import { Component, OnInit, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ExpenseService, ExpenseCategory, Expense, ExpenseStats, PaymentType } from '../core/services/expense.service';
import { SupplierService } from '../core/services/supplier.service';
import { AuthService } from '../core/services/auth.service';
import { DepotsService } from '../core/services/depots.service';
import { Chart, ChartConfiguration, ChartData, ChartType } from 'chart.js';
import { registerables } from 'chart.js';
import { forkJoin, of } from 'rxjs';

Chart.register(...registerables);

@Component({
  selector: 'app-charges',
  templateUrl: './charges.component.html',
  standalone: false
})
export class ChargesComponent implements OnInit, AfterViewInit {
  @ViewChild('pieChartCanvas') pieChartCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('lineChartCanvas') lineChartCanvas!: ElementRef<HTMLCanvasElement>;
  
  categories: ExpenseCategory[] = [];
  suppliers: any[] = [];
  depots: any[] = [];
  supplierSearch = '';
  expenses: Expense[] = [];
  stats: ExpenseStats | null = null;
  loading = true;
  error = '';

  showAddExpenseModal = false;
  showAddCategoryModal = false;
  showApprovalModal = false;
  showStatsModal = false;
  showAllExpensesModal = false;
  showCategoryActionMenu = false;
  selectedCategoryForAction: ExpenseCategory | null = null;
  searchQuery = '';
  activeFilter = 'all';
  selectedSupplierFilter: number | null = null;
  selectedCategoryFilter: number | null = null;
  selectedDepotId: number | null = null;
  expensesViewMode: 'grid' | 'table' = 'table';
  // Wizard state
  addExpenseStep: 'category' | 'payment' | 'supplier' | 'notes' = 'category';
  payNow = true;

  newExpense = {
    amount: NaN,
    categoryId: 0,
    supplierId: undefined as number | undefined,
    paymentType: 'CASH' as PaymentType,
    date: new Date().toISOString().split('T')[0],
    collectionDate: new Date().toISOString().split('T')[0],
    notes: '',
    isPaid: false,
    isAdvance: false
  };

  newCategory = {
    name: '',
    description: '',
    color: '#3B82F6',
    icon: '💰'
  };
  editingCategory: ExpenseCategory | null = null;

  selectedCategory: ExpenseCategory | null = null;
  pendingExpenses: Expense[] = [];
  currentUser: any = null;

  // Date filters (for admin)
  startDate: string = '';
  endDate: string = '';

  private pieChart: Chart | null = null;
  private lineChart: Chart | null = null;

  // Payment type options
  paymentTypes = [
    { value: 'CASH', label: 'Espèces', icon: '💵' },
    { value: 'CHECK', label: 'Chèque', icon: '🏦' },
    { value: 'BANK_TRANSFER', label: 'Virement', icon: '💳' },
    { value: 'WIRE_TRANSFER', label: 'Traite', icon: '📄' }
  ];

  constructor(
    private expenseService: ExpenseService,
    private authService: AuthService,
    private route: ActivatedRoute,
    private supplierService: SupplierService,
    private depotsService: DepotsService
  ) {}

  ngOnInit() {
    this.loadCurrentUser();
    this.loadData();
    
    this.route.queryParams.subscribe(params => {
      if (params['action']) {
        switch (params['action']) {
          case 'add':
            this.openAddExpenseModal();
            break;
          case 'add-category':
            this.openAddCategoryModal();
            break;
          case 'statistics':
            this.openStatsModal();
            break;
        }
      }
    });
  }

  setDefaultDates(): void {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    
    this.startDate = firstDay.toISOString().split('T')[0];
    this.endDate = lastDay.toISOString().split('T')[0];
  }

  ngAfterViewInit() {
    // Charts will be initialized when stats modal is opened
  }

  loadCurrentUser() {
    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
    });
  }

  loadData() {
    this.loading = true;
    this.error = '';

    const user = this.authService.currentUser();
    const isAdminUser = user?.role === 'ADMIN';
    
    const filters: any = {
      limit: 10000
    };
    if (isAdminUser && this.startDate && this.endDate) {
      filters.startDate = this.startDate;
      filters.endDate = this.endDate;
    }
    if (this.selectedDepotId) {
      filters.depotId = this.selectedDepotId;
    }
    
    const requests: any = {
      categories: this.expenseService.getCategories(),
      expenses: this.expenseService.getExpenses(filters),
      suppliers: this.supplierService.getSuppliers(),
      depots: this.depotsService.list()
    };

    if (isAdminUser) {
      const statsFilters: any = {};
      if (this.startDate && this.endDate) {
        statsFilters.startDate = this.startDate;
        statsFilters.endDate = this.endDate;
      }
      if (this.selectedDepotId) {
        statsFilters.depotId = this.selectedDepotId;
      }
      requests.stats = this.expenseService.getStats(Object.keys(statsFilters).length > 0 ? statsFilters : undefined);
    }

    forkJoin(requests).subscribe({
      next: (results: any) => {
        this.categories = results.categories || [];
        this.expenses = results.expenses || [];
        this.suppliers = (results.suppliers || []).filter((s: any) => s.isActive !== false);
        this.depots = (results.depots || []).filter((d: any) => d.isActive !== false);
        
        if (isAdminUser && results.stats) {
          this.stats = results.stats || null;
        } else {
          this.stats = null;
        }
        
        this.pendingExpenses = this.expenses.filter(e => !e.isApproved);
        this.loading = false;
      },
      error: (error) => {
        this.error = 'Erreur lors du chargement des données';
        this.loading = false;
      }
    });
  }

  onDateFilterChange(): void {
    if (this.isAdmin()) {
      this.loadData();
    }
  }

  onDepotFilterChange(): void {
    this.loadData();
  }

  clearDepotFilter(): void {
    this.selectedDepotId = null;
    this.loadData();
  }

  selectCategory(category: ExpenseCategory) {
    this.selectedCategory = category;
    this.newExpense.categoryId = category.id;
  }

  selectPaymentType(paymentType: string) {
    this.newExpense.paymentType = paymentType as PaymentType;
  }

  get filteredSuppliers(): any[] {
    const query = this.supplierSearch.trim().toLowerCase();
    if (!query) { 
      return this.suppliers; 
    }
    const filtered = this.suppliers.filter(s =>
      (s.name || '').toLowerCase().includes(query) ||
      (s.phone || '').toString().includes(query) ||
      (s.address || '').toLowerCase().includes(query)
    );
    return filtered;
  }

  getCategoryAmount(categoryId: number): number {
    if (!this.expenses || this.expenses.length === 0) return 0;
    return this.expenses
      .filter(expense => expense.categoryId === categoryId && !expense.isRejected)
      .reduce((sum, expense) => {
        let amount = 0;
        const expenseAmount: any = expense.amount;
        if (expenseAmount != null && expenseAmount !== undefined) {
          if (typeof expenseAmount === 'string') {
            // Remove any spaces and replace comma with dot for French number format
            const cleaned = expenseAmount.replace(/\s/g, '').replace(',', '.');
            amount = parseFloat(cleaned);
          } else if (typeof expenseAmount === 'number') {
            amount = expenseAmount;
          } else {
            // Handle Prisma Decimal object or other types
            const amountStr = String(expenseAmount);
            amount = parseFloat(amountStr);
          }
        }
        return sum + (isNaN(amount) || amount < 0 ? 0 : amount);
      }, 0);
  }

  getCategoryCount(categoryId: number): number {
    if (!this.expenses || this.expenses.length === 0) return 0;
    return this.expenses.filter(expense => expense.categoryId === categoryId && !expense.isRejected).length;
  }

  openAddExpenseModal() {
    this.showAddExpenseModal = true;
    this.resetNewExpense();
    this.addExpenseStep = 'category';
    this.payNow = true;
  }

  closeAddExpenseModal() {
    this.showAddExpenseModal = false;
    this.resetNewExpense();
  }

  // Wizard navigation
  goToNextStep() {
    if (this.addExpenseStep === 'category') {
      if (!this.newExpense.categoryId) { this.error = 'Veuillez choisir une catégorie'; return; }
      this.error = '';
      this.addExpenseStep = 'payment';
      return;
    }
    if (this.addExpenseStep === 'payment') {
      if (!this.newExpense.amount || this.newExpense.amount <= 0) { this.error = 'Veuillez saisir un montant valide'; return; }
      this.error = '';
      this.addExpenseStep = 'supplier';
      return;
    }
    if (this.addExpenseStep === 'supplier') {
      if (!this.newExpense.supplierId) { this.error = 'Veuillez choisir un fournisseur'; return; }
      this.error = '';
      this.addExpenseStep = 'notes';
      return;
    }
  }

  goToPrevStep() {
    if (this.addExpenseStep === 'notes') { this.addExpenseStep = 'supplier'; return; }
    if (this.addExpenseStep === 'supplier') { this.addExpenseStep = 'payment'; return; }
    if (this.addExpenseStep === 'payment') { this.addExpenseStep = 'category'; return; }
  }

  openAddCategoryModal() {
    this.showAddCategoryModal = true;
    this.resetNewCategory();
  }

  closeAddCategoryModal() {
    this.showAddCategoryModal = false;
    this.resetNewCategory();
  }

  openApprovalModal() {
    if (!this.isAdmin()) {
      this.error = 'Accès réservé aux administrateurs';
      return;
    }
    this.showApprovalModal = true;
  }

  closeApprovalModal() {
    this.showApprovalModal = false;
  }

  openStatsModal() {
    if (!this.isAdmin()) {
      this.error = 'Accès réservé aux administrateurs';
      return;
    }
    this.showStatsModal = true;
    setTimeout(() => {
      this.initializeCharts();
    }, 100);
  }

  closeStatsModal() {
    this.showStatsModal = false;
    this.destroyCharts();
  }

  private initializeCharts() {
    this.initializePieChart();
    this.initializeLineChart();
  }

  private initializePieChart() {
    if (!this.pieChartCanvas || !this.stats?.byCategory) return;

    const ctx = this.pieChartCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    if (this.pieChart) {
      this.pieChart.destroy();
    }

    const chartData: ChartData<'pie'> = {
      labels: this.stats.byCategory.map(cat => cat.categoryName),
      datasets: [{
        data: this.stats.byCategory.map(cat => cat.totalAmount),
        backgroundColor: this.stats.byCategory.map(cat => cat.categoryColor || '#3B82F6'),
        borderColor: '#1f2937',
        borderWidth: 2,
        hoverOffset: 4
      }]
    };

    const config: ChartConfiguration<'pie'> = {
      type: 'pie',
      data: chartData,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: '#ffffff',
              font: {
                size: 12
              },
              usePointStyle: true
            }
          },
          tooltip: {
            backgroundColor: '#1f2937',
            titleColor: '#ffffff',
            bodyColor: '#ffffff',
            borderColor: '#374151',
            borderWidth: 1,
            callbacks: {
              label: (context) => {
                const value = context.parsed;
                const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
                const percentage = ((value / total) * 100).toFixed(1);
                return `${context.label}: ${this.formatCurrency(value)} (${percentage}%)`;
              }
            }
          }
        }
      }
    };

    this.pieChart = new Chart(ctx, config);
  }

  private initializeLineChart() {
    if (!this.lineChartCanvas || !this.expenses.length) return;

    const ctx = this.lineChartCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    if (this.lineChart) {
      this.lineChart.destroy();
    }

    // Group expenses by date and calculate daily totals
    const dailyData = this.groupExpensesByDate();
    const labels = Object.keys(dailyData).sort();
    const data = labels.map(date => dailyData[date]);

    const chartData: ChartData<'line'> = {
      labels: labels.map(date => this.formatDateForChart(date)),
      datasets: [{
        label: 'Dépenses quotidiennes',
        data: data,
        borderColor: '#8b5cf6',
        backgroundColor: 'rgba(139, 92, 246, 0.1)',
        borderWidth: 3,
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#8b5cf6',
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
        pointRadius: 6,
        pointHoverRadius: 8
      }]
    };

    const config: ChartConfiguration<'line'> = {
      type: 'line',
      data: chartData,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: {
              color: '#ffffff',
              font: {
                size: 14
              }
            }
          },
          tooltip: {
            backgroundColor: '#1f2937',
            titleColor: '#ffffff',
            bodyColor: '#ffffff',
            borderColor: '#374151',
            borderWidth: 1,
            callbacks: {
              label: (context) => {
                return `Dépenses: ${this.formatCurrency(context.parsed.y)}`;
              }
            }
          }
        },
        scales: {
          x: {
            ticks: {
              color: '#9ca3af',
              font: {
                size: 12
              }
            },
            grid: {
              color: '#374151'
            }
          },
          y: {
            ticks: {
              color: '#9ca3af',
              font: {
                size: 12
              },
              callback: (value) => {
                return this.formatCurrency(value as number);
              }
            },
            grid: {
              color: '#374151'
            }
          }
        }
      }
    };

    this.lineChart = new Chart(ctx, config);
  }

  private groupExpensesByDate(): { [key: string]: number } {
    const dailyData: { [key: string]: number } = {};
    
    this.expenses.forEach(expense => {
      const date = expense.date.split('T')[0]; // Get just the date part
      dailyData[date] = (dailyData[date] || 0) + expense.amount;
    });

    return dailyData;
  }

  private formatDateForChart(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', { 
      day: '2-digit', 
      month: '2-digit' 
    });
  }

  private destroyCharts() {
    if (this.pieChart) {
      this.pieChart.destroy();
      this.pieChart = null;
    }
    if (this.lineChart) {
      this.lineChart.destroy();
      this.lineChart = null;
    }
  }

  resetNewExpense() {
    this.newExpense = {
      amount: NaN,
      categoryId: 0,
      supplierId: undefined,
      paymentType: 'CASH' as PaymentType,
      date: new Date().toISOString().split('T')[0],
      collectionDate: new Date().toISOString().split('T')[0],
      notes: '',
      isPaid: false,
      isAdvance: false
    };
    this.selectedCategory = null;
  }

  resetNewCategory() {
    this.newCategory = {
      name: '',
      description: '',
      color: '#3B82F6',
      icon: '💰'
    };
  }

  async saveExpense() {
    if (!this.newExpense.amount || !this.newExpense.categoryId || !this.newExpense.supplierId) {
      this.error = 'Veuillez remplir tous les champs obligatoires';
      return;
    }

    if (!this.currentUser) {
      this.error = 'Utilisateur non connecté';
      return;
    }

    try {
      // Get current depot ID (visiting depot or user's depot)
      const visitingDepotId = sessionStorage.getItem('visitingDepotId');
      const currentDepotId = visitingDepotId ? parseInt(visitingDepotId) : (this.currentUser.depotId || null);
      
      if (!currentDepotId) {
        this.error = 'Aucun dépôt sélectionné. Veuillez sélectionner un dépôt.';
        return;
      }

      const expense = {
        ...this.newExpense,
        depotId: currentDepotId, // Use current depot ID
        userId: this.currentUser.id,
        payNow: this.payNow // Pass payment timing to server
      };



      await this.expenseService.createExpense(expense).toPromise();
      
      this.closeAddExpenseModal();
      // Reload data to show the new expense
      this.loadData();
    } catch (error: any) {
      const errorMessage = error?.error?.error || 'Erreur lors de l\'enregistrement de la dépense';
      this.error = errorMessage;
      console.error('Error saving expense:', error);
    }
  }

  async saveCategory() {
    if (!this.newCategory.name) {
      this.error = 'Veuillez saisir le nom de la catégorie';
      return;
    }

    try {
      await this.expenseService.createCategory(this.newCategory).toPromise();
      
      this.closeAddCategoryModal();
      this.loadData();
    } catch (error) {
      this.error = 'Erreur lors de la création de la catégorie';
      console.error('Error saving category:', error);
    }
  }

  async approveExpense(expense: Expense, isApproved: boolean) {
    if (!this.currentUser) {
      this.error = 'Utilisateur non connecté';
      return;
    }

    if (!this.isAdmin()) {
      this.error = 'Accès réservé aux administrateurs';
      return;
    }

    try {
      await this.expenseService.approveExpense(expense.id, isApproved).toPromise();
      this.loadData();
    } catch (error) {
      this.error = 'Erreur lors de l\'approbation';
      console.error('Error approving expense:', error);
    }
  }

  async deleteExpense(expense: Expense) {
    if (!this.currentUser) {
      this.error = 'Utilisateur non connecté';
      return;
    }

    if (!this.isAdmin()) {
      this.error = 'Accès réservé aux administrateurs';
      return;
    }

    if (!confirm(`Êtes-vous sûr de vouloir supprimer cette dépense de ${this.formatCurrency(expense.amount)} ?`)) {
      return;
    }

    try {
      await this.expenseService.deleteExpense(expense.id).toPromise();
      this.loadData();
    } catch (error: any) {
      const errorMessage = error?.error?.error || 'Erreur lors de la suppression de la dépense';
      this.error = errorMessage;
      console.error('Error deleting expense:', error);
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


  getCurrentUserRole(): string {
    return this.currentUser?.role || 'Unknown';
  }

  isAdmin(): boolean {
    const user = this.authService.currentUser();
    return user?.role === 'ADMIN';
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

  openAllExpensesModal() {
    this.showAllExpensesModal = true;
  }

  closeAllExpensesModal() {
    this.showAllExpensesModal = false;
  }

  getDisplayedExpenses(): Expense[] {
    // Use filtered expenses to respect category filter
    const filtered = this.getFilteredExpenses();
    return filtered.slice(0, 5);
  }

  getFilteredExpenses(): Expense[] {
    let filtered = this.expenses;
    
    // Apply active filter
    if (this.activeFilter !== 'all') {
      switch (this.activeFilter) {
        case 'pending':
          filtered = filtered.filter(expense => !expense.isApproved);
          break;
        case 'approved':
          filtered = filtered.filter(expense => expense.isApproved);
          break;
        case 'cash':
          filtered = filtered.filter(expense => expense.paymentType === 'CASH');
          break;
        case 'check':
          filtered = filtered.filter(expense => expense.paymentType === 'CHECK');
          break;
        case 'transfer':
          filtered = filtered.filter(expense => expense.paymentType === 'BANK_TRANSFER');
          break;
        case 'wire':
          filtered = filtered.filter(expense => expense.paymentType === 'WIRE_TRANSFER');
          break;
      }
    }
    
    // Apply supplier filter
    if (this.selectedSupplierFilter !== null) {
      filtered = filtered.filter(expense => expense.supplierId === this.selectedSupplierFilter);
    }
    
    // Apply category filter
    if (this.selectedCategoryFilter !== null) {
      filtered = filtered.filter(expense => expense.categoryId === this.selectedCategoryFilter);
    }
    
    // Apply search query
    if (this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase().trim();
      filtered = filtered.filter(expense => 
        expense.category?.name.toLowerCase().includes(query) ||
        expense.user?.firstName.toLowerCase().includes(query) ||
        expense.user?.lastName.toLowerCase().includes(query) ||
        expense.amount.toString().includes(query) ||
        expense.id.toString().includes(query)
      );
    }
    
    return filtered;
  }

  setFilter(filter: string) {
    this.activeFilter = filter;
  }

  setSupplierFilter(supplierId: number | null) {
    this.selectedSupplierFilter = supplierId;
  }

  onSupplierFilterChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    const value = target.value;
    this.selectedSupplierFilter = value ? +value : null;
  }

  clearCategoryFilter() {
    this.selectedCategoryFilter = null;
    this.selectedCategory = null;
  }

  // Category action methods
  showCategoryActions(category: ExpenseCategory, event: Event) {
    event.stopPropagation();
    event.preventDefault();
    this.selectedCategoryForAction = category;
    this.showCategoryActionMenu = true;
  }

  // Direct click on category to consult expenses
  consultCategoryDirectly(category: ExpenseCategory) {
    this.selectedCategoryForAction = category;
    this.consultCategory();
  }

  hideCategoryActions() {
    this.showCategoryActionMenu = false;
    this.selectedCategoryForAction = null;
  }

  consultCategory() {
    if (this.selectedCategoryForAction) {
      // Select the category and filter expenses by this category
      this.selectedCategory = this.selectedCategoryForAction;
      this.selectedSupplierFilter = null;
      this.selectedCategoryFilter = this.selectedCategoryForAction.id;
      this.activeFilter = 'all';
      this.searchQuery = ''; // Clear search query to show all expenses for this category
      this.hideCategoryActions();
      // Open the all expenses modal to show filtered expenses
      this.openAllExpensesModal();
      // Scroll to expenses section after a short delay to ensure modal is rendered
      setTimeout(() => {
        const expensesSection = document.querySelector('.flex-1.overflow-y-auto');
        if (expensesSection) {
          expensesSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    }
  }

  editCategory() {
    if (this.selectedCategoryForAction) {
      // Open edit category modal
      this.newCategory = {
        name: this.selectedCategoryForAction.name,
        description: this.selectedCategoryForAction.description,
        color: this.selectedCategoryForAction.color,
        icon: this.selectedCategoryForAction.icon
      };
      this.editingCategory = this.selectedCategoryForAction;
      this.showAddCategoryModal = true;
      this.hideCategoryActions();
    }
  }

  deleteCategory() {
    if (this.selectedCategoryForAction) {
      if (confirm(`Êtes-vous sûr de vouloir supprimer la catégorie "${this.selectedCategoryForAction.name}" ?`)) {
        this.expenseService.deleteCategory(this.selectedCategoryForAction.id).subscribe({
          next: () => {
            this.loadData();
            this.clearCategoryFilter(); // Clear category filter if deleted category was selected
            this.hideCategoryActions();
          },
          error: (error: any) => {
            console.error('Error deleting category:', error);
            this.error = 'Erreur lors de la suppression de la catégorie';
          }
        });
      }
    }
  }

  archiveCategory() {
    if (this.selectedCategoryForAction) {
      if (confirm(`Êtes-vous sûr de vouloir archiver la catégorie "${this.selectedCategoryForAction.name}" ?`)) {
        this.expenseService.updateCategory(this.selectedCategoryForAction.id, { isActive: false }).subscribe({
          next: () => {
            this.loadData();
            this.clearCategoryFilter(); // Clear category filter if archived category was selected
            this.hideCategoryActions();
          },
          error: (error: any) => {
            console.error('Error archiving category:', error);
            this.error = 'Erreur lors de l\'archivage de la catégorie';
          }
        });
      }
    }
  }

  clearSearch() {
    this.searchQuery = '';
    // Don't clear category filter here as it's independent of search
  }

  // Helper methods for new payment status
  getPaymentStatusIcon(expense: any): string {
    if (expense.isAdvance) return '💰';
    if (expense.isPaid) return '✅';
    return '❌';
  }

  getPaymentStatusLabel(expense: any): string {
    if (expense.isAdvance) return 'Acompte';
    if (expense.isPaid) return 'Payé';
    return 'Non Payé';
  }

  getPaymentStatusColor(expense: any): string {
    if (expense.isAdvance) return 'text-blue-600';
    if (expense.isPaid) return 'text-green-600';
    return 'text-red-600';
  }
} 