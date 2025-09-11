import { Component, OnInit } from '@angular/core';
import { SalesService } from '../core/services/sales.service';
import { Sale } from '../core/models/sale.model';
import { PrintService } from '../core/services/print.service';

@Component({
  selector: 'app-historique',
  templateUrl: './historique.component.html',
  standalone: false
})
export class HistoriqueComponent implements OnInit {
  sales: Sale[] = [];
  filteredSales: Sale[] = [];
  loading = false;
  error = '';

  // Filters
  searchQuery = '';
  selectedStatus = '';
  selectedPaymentMethod = '';
  selectedSaleType = '';
  startDate = '';
  endDate = '';

  // Pagination
  currentPage = 1;
  itemsPerPage = 20;
  totalItems = 0;

  // Payment methods for filter
  paymentMethods: any[] = [];

  // Alert system
  showAlert = false;
  alertMessage = '';
  alertType: 'success' | 'error' | 'info' = 'info';

  // Receipt preview modal
  showReceiptModal = false;
  selectedSaleForReceipt: Sale | null = null;
  receiptHtmlPreview = '';

  constructor(private salesService: SalesService, private printService: PrintService) {}

  ngOnInit(): void {
    this.loadSales();
    this.loadPaymentMethods();
  }

  loadSales(): void {
    this.loading = true;
    this.error = '';

    this.salesService.getSales().subscribe({
      next: (sales) => {
        console.log('Received sales data:', sales);
        console.log('First sale items:', sales[0]?.items);
        console.log('Sales count:', sales.length);
        this.sales = sales;
        this.filteredSales = sales;
        this.totalItems = sales.length;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading sales:', error);
        this.error = 'Erreur lors du chargement des ventes';
        this.loading = false;
      }
    });
  }

  loadPaymentMethods(): void {
    this.salesService.getPaymentMethods().subscribe({
      next: (methods) => {
        this.paymentMethods = methods;
      },
      error: (error) => {
        console.error('Error loading payment methods:', error);
      }
    });
  }

  applyFilters(): void {
    console.log('Applying filters to sales:', this.sales);
    this.filteredSales = this.sales.filter(sale => {
      console.log('Processing sale:', sale);
      // Search query
      if (this.searchQuery) {
        const query = this.searchQuery.toLowerCase();
        const matchesSearch = 
          sale.id.toString().includes(query) ||
          (sale.items && sale.items.some(item => item.productName.toLowerCase().includes(query))) ||
          (sale.paymentMethod && sale.paymentMethod.name.toLowerCase().includes(query));
        if (!matchesSearch) return false;
      }

      // Status filter
      if (this.selectedStatus && sale.status !== this.selectedStatus) {
        return false;
      }

      // Payment method filter
      if (this.selectedPaymentMethod && sale.paymentMethod && sale.paymentMethod.id.toString() !== this.selectedPaymentMethod) {
        return false;
      }

      // Sale type filter
      if (this.selectedSaleType) {
        const isWholesale = this.isWholesaleSale(sale);
        if (this.selectedSaleType === 'wholesale' && !isWholesale) {
          return false;
        }
        if (this.selectedSaleType === 'retail' && isWholesale) {
          return false;
        }
      }

      // Date range filter
      if (this.startDate || this.endDate) {
        const saleDate = new Date(sale.createdAt);
        if (this.startDate && saleDate < new Date(this.startDate)) {
          return false;
        }
        if (this.endDate && saleDate > new Date(this.endDate)) {
          return false;
        }
      }

      return true;
    });

    this.totalItems = this.filteredSales.length;
    this.currentPage = 1;
  }

  clearFilters(): void {
    this.searchQuery = '';
    this.selectedStatus = '';
    this.selectedPaymentMethod = '';
    this.selectedSaleType = '';
    this.startDate = '';
    this.endDate = '';
    this.filteredSales = this.sales;
    this.totalItems = this.sales.length;
    this.currentPage = 1;
  }

  isWholesaleSale(sale: Sale): boolean {
    return sale.items && sale.items.some(item => item.isWholesale);
  }

  get paginatedSales(): Sale[] {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    return this.filteredSales.slice(startIndex, endIndex);
  }

  get totalPages(): number {
    return Math.ceil(this.totalItems / this.itemsPerPage);
  }

  changePage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'COMPLETED':
        return 'bg-green-500/20 text-green-400';
      case 'PENDING':
        return 'bg-yellow-500/20 text-yellow-400';
      case 'CANCELLED':
        return 'bg-red-500/20 text-red-400';
      case 'TEMPORARY':
        return 'bg-yellow-500/20 text-yellow-400';
      case 'PENDING_ADMIN':
        return 'bg-orange-500/20 text-orange-400';
      case 'CADEAU':
        return 'bg-purple-500/20 text-purple-400';
      default:
        return 'bg-gray-500/20 text-gray-400';
    }
  }

  getStatusText(status: string): string {
    switch (status) {
      case 'COMPLETED':
        return 'Terminé';
      case 'PENDING':
        return 'En attente';
      case 'CANCELLED':
        return 'Annulé';
      case 'TEMPORARY':
        return 'Temporaire';
      case 'PENDING_ADMIN':
        return 'En attente Admin';
      case 'CADEAU':
        return 'Cadeau';
      default:
        return status;
    }
  }

  formatDate(date: string | Date): string {
    return new Date(date).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  getProductNames(items: any[]): string {
    return items.slice(0, 2).map(item => item.productName).join(', ');
  }

  showSaleDetails(sale: Sale): void {
    let details = `Vente #${sale.id}\n`;
    details += `Date: ${this.formatDate(sale.createdAt)}\n`;
    details += `Statut: ${this.getStatusText(sale.status)}\n`;
   
   if (sale.status === 'TEMPORARY' && sale.expectedDate) {
     details += `Date prévue: ${this.formatDate(sale.expectedDate)}\n`;
   }
   
   details += `Total: ${sale.finalTotal} dt\n`;
   details += `Remise: ${sale.discount} dt\n`;
   
   if (sale.notes) {
     details += `Notes: ${sale.notes}\n`;
   }
   
   details += '\nArticles:\n';
   
   if (sale.items && sale.items.length > 0) {
     sale.items.forEach((item, index) => {
       details += `${index + 1}. ${item.productName} - ${item.quantity}x ${item.unitPrice} dt = ${item.total} dt\n`;
     });
   } else {
     details += 'Aucun article';
   }
   
   this.showAlertMessage(details, 'info');
  }

  showAlertMessage(message: string, type: 'success' | 'error' | 'info' = 'info'): void {
    this.alertMessage = message;
    this.alertType = type;
    this.showAlert = true;
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
      this.hideAlert();
    }, 5000);
  }

  hideAlert(): void {
    this.showAlert = false;
    this.alertMessage = '';
  }

  getSaleSummary(sale: Sale): string {
    console.log('Getting sale summary for sale:', sale);
    console.log('Sale items:', sale.items);
    
    if (!sale.items || sale.items.length === 0) {
      console.log('No items found, returning "Aucun article"');
      return 'Aucun article';
    }
    
    const itemCount = sale.items.length;
    const totalQuantity = sale.items.reduce((sum, item) => sum + item.quantity, 0);
    const firstItems = sale.items.slice(0, 2).map(item => item.productName).join(', ');
    
    console.log('Item count:', itemCount, 'Total quantity:', totalQuantity, 'First items:', firstItems);
    return `${itemCount} article${itemCount > 1 ? 's' : ''} (${totalQuantity} unités) - ${firstItems}${sale.items.length > 2 ? '...' : ''}`;
  }

  openReceiptPreview(sale: Sale): void {
    this.selectedSaleForReceipt = sale;
    this.receiptHtmlPreview = this.printService.buildSaleReceiptHtml(sale);
    this.showReceiptModal = true;
  }

  closeReceiptPreview(): void {
    this.showReceiptModal = false;
    this.selectedSaleForReceipt = null;
    this.receiptHtmlPreview = '';
  }

  printReceipt(sale: Sale): void {
    this.printService.printSaleReceipt(sale);
    this.showAlertMessage('Reçu envoyé à l\'imprimante', 'success');
  }
} 