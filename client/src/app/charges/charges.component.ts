import { Component, OnInit, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ExpenseService, ExpenseCategory, Expense, ExpenseStats, PaymentType } from '../core/services/expense.service';
import { SupplierService } from '../core/services/supplier.service';
import { AuthService } from '../core/services/auth.service';
import { Chart, ChartConfiguration, ChartData, ChartType } from 'chart.js';
import { registerables } from 'chart.js';

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
    private supplierService: SupplierService
  ) {}

  ngOnInit() {
    this.loadCurrentUser();
    this.loadData();
    
    // Check for action query parameter
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

    Promise.all([
      this.expenseService.getCategories().toPromise(),
      this.expenseService.getExpenses().toPromise(),
      this.expenseService.getStats().toPromise(),
      this.supplierService.getSuppliers().toPromise()
    ]).then(([categories, expenses, stats, suppliers]) => {
      this.categories = categories || [];
      this.expenses = expenses || [];
      this.stats = stats || null;
      this.suppliers = (suppliers || []).filter((s: any) => s.isActive !== false);
      this.pendingExpenses = this.expenses.filter(e => !e.isApproved);
      this.loading = false;
    }).catch(error => {
      console.error('Error loading data:', error);
      this.error = 'Erreur lors du chargement des données';
      this.loading = false;
      console.error('Error loading data:', error);
    });
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
    if (!this.stats?.byCategory) return 0;
    const breakdown = this.stats.byCategory.find(cat => cat.categoryId === categoryId);
    return breakdown ? breakdown.totalAmount : 0;
  }

  getCategoryCount(categoryId: number): number {
    if (!this.stats?.byCategory) return 0;
    const breakdown = this.stats.byCategory.find(cat => cat.categoryId === categoryId);
    return breakdown ? breakdown.count : 0;
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
    this.showApprovalModal = true;
  }

  closeApprovalModal() {
    this.showApprovalModal = false;
  }

  openStatsModal() {
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
        depotId: this.currentUser.depotId || 1,
        userId: this.currentUser.id
      };

      await this.expenseService.createExpense(expense).toPromise();
      
      this.closeAddExpenseModal();
      this.loadData();
    } catch (error) {
      this.error = 'Erreur lors de l\'enregistrement de la dépense';
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

    try {
      await this.expenseService.approveExpense(expense.id, isApproved).toPromise();
      this.loadData();
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


  getCurrentUserRole(): string {
    return this.currentUser?.role || 'Unknown';
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
    return this.expenses.slice(0, 5);
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
    this.selectedCategoryForAction = category;
    this.showCategoryActionMenu = true;
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