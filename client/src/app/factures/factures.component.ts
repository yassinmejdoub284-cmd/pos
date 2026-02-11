import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../core/services/auth.service';
import { PrintService } from '../core/services/print.service';
import { environment } from '../../environments/environment';
import { Subject, takeUntil } from 'rxjs';

interface Invoice {
  id: number;
  invoiceNumber: string;
  status: string;
  issueDate: string;
  customerName: string;
  totalTTC: number | string;
  saleId?: number;
  client?: any;
  lines?: InvoiceLine[];
}

interface InvoiceLine {
  id: number;
  productName: string;
  quantity: number | string;
  prixVenteTTC: number | string;
  sousTotalTTC: number | string;
  product?: {
    id: number;
    name: string;
  };
}

@Component({
  selector: 'app-factures',
  templateUrl: './factures.component.html',
  styleUrls: ['./factures.component.css'],
  standalone: false
})
export class FacturesComponent implements OnInit, OnDestroy {
  invoices: Invoice[] = [];
  filteredInvoices: Invoice[] = [];
  loading = false;
  error = '';

  // Filters
  searchQuery = '';
  selectedStatus = '';
  startDate = '';
  endDate = '';

  // Pagination
  currentPage = 1;
  totalPages = 1;
  itemsPerPage = 20;
  totalItems = 0;

  // View mode
  viewMode: 'grid' | 'table' = 'grid';

  // Invoice detail modal
  showInvoiceModal = false;
  selectedInvoice: Invoice | null = null;

  private destroy$ = new Subject<void>();

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private printService: PrintService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadInvoices();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadInvoices(): void {
    this.loading = true;
    this.error = '';
    const userDepotId = this.authService.currentUser()?.depotId;
    const params: any = {
      page: this.currentPage,
      limit: this.itemsPerPage,
      status: 'ISSUED'
    };

    if (userDepotId) {
      params.depotId = userDepotId;
    }

    if (this.startDate) {
      params.dateFrom = this.startDate;
    }

    if (this.endDate) {
      params.dateTo = this.endDate;
    }

    const queryString = new URLSearchParams(params).toString();
    const url = `${environment.apiUrl}/invoices?${queryString}`;

    this.http.get(url, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    }).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (response: any) => {
        this.invoices = response.invoices || [];
        this.totalItems = response.pagination?.total || 0;
        this.totalPages = response.pagination?.pages || 1;
        this.filterInvoices();
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (error) => {
        console.error('Error loading invoices:', error);
        this.error = 'Erreur lors du chargement des factures';
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  filterInvoices(): void {
    let filtered = [...this.invoices];

    // Filter by search query
    if (this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase().trim();
      filtered = filtered.filter(invoice =>
        invoice.invoiceNumber.toLowerCase().includes(query) ||
        invoice.customerName.toLowerCase().includes(query)
      );
    }

    // Filter by status
    if (this.selectedStatus) {
      filtered = filtered.filter(invoice => invoice.status === this.selectedStatus);
    }

    this.filteredInvoices = filtered;
  }

  onSearchChange(): void {
    this.filterInvoices();
  }

  onStatusChange(): void {
    this.currentPage = 1;
    this.loadInvoices();
  }

  onDateChange(): void {
    this.currentPage = 1;
    this.loadInvoices();
  }

  clearFilters(): void {
    this.searchQuery = '';
    this.selectedStatus = '';
    this.startDate = '';
    this.endDate = '';
    this.currentPage = 1;
    this.loadInvoices();
  }

  setViewMode(mode: 'grid' | 'table'): void {
    this.viewMode = mode;
  }

  viewInvoice(invoice: Invoice): void {
    this.loading = true;
    const url = `${environment.apiUrl}/invoices/${invoice.id}`;
    
    this.http.get(url, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    }).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (fullInvoice: any) => {
        this.selectedInvoice = fullInvoice;
        this.showInvoiceModal = true;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (error) => {
        console.error('Error loading invoice details:', error);
        this.selectedInvoice = invoice;
        this.showInvoiceModal = true;
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  closeInvoiceModal(): void {
    this.showInvoiceModal = false;
    this.selectedInvoice = null;
  }

  printInvoice(invoice: Invoice): void {
    this.printService.printInvoice(invoice);
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.loadInvoices();
    }
  }

  formatDate(date: string | Date): string {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  formatCurrency(amount: number | string): string {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(numAmount)) return '0,00 dt';
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'TND',
      minimumFractionDigits: 2
    }).format(numAmount);
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'ISSUED':
        return 'bg-emerald-100 text-emerald-700';
      case 'DRAFT':
        return 'bg-yellow-100 text-yellow-700';
      case 'CANCELLED':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  }

  getStatusText(status: string): string {
    switch (status) {
      case 'ISSUED':
        return 'Émise';
      case 'DRAFT':
        return 'Brouillon';
      case 'CANCELLED':
        return 'Annulée';
      default:
        return status;
    }
  }

  goBack(): void {
    window.history.back();
  }
}

