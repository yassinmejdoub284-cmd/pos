import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router, RouterModule } from '@angular/router';
import { environment } from '../../environments/environment';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupplierService } from '../core/services/supplier.service';
import { PrintService } from '../core/services/print.service';
import { AuthService } from '../core/services/auth.service';
import { ExpenseService } from '../core/services/expense.service';
import {
  Supplier,
  SupplierSummary
} from '../core/models/supplier.model';

@Component({
  selector: 'app-supplier-statement',
  templateUrl: './supplier-statement.component.html',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule]
})
export class SupplierStatementComponent implements OnInit {
  suppliers: Supplier[] = [];
  supplierSummaries: SupplierSummary[] = [];
  filteredSuppliers: SupplierSummary[] = [];
  loading = false;
  isAdmin = false;
  searchQuery = '';
  selectedLetter: string | null = null;
  alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

  // Filters
  filters = {
    supplierId: null as number | null,
    startDate: '',
    endDate: ''
  };

  constructor(
    private http: HttpClient,
    public router: Router,
    private supplierService: SupplierService,
    private printService: PrintService,
    private authService: AuthService,
    private expenseService: ExpenseService
  ) { }

  ngOnInit(): void {
    this.isAdmin = this.authService.isAdmin();
    this.loadSuppliers();
    this.loadSupplierSummaries();
  }

  loadSuppliers(): void {
    this.supplierService.getSuppliers().subscribe({
      next: (suppliers) => {
        this.suppliers = suppliers;
      },
      error: (error) => {
        console.error('Error loading suppliers:', error);
      }
    });
  }

  loadSupplierSummaries(): void {
    this.loading = true;
    this.supplierService.getSupplierSummaries(this.filters.startDate, this.filters.endDate).subscribe({
      next: (summaries) => {
        this.supplierSummaries = summaries;
        this.filterSuppliers();
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading supplier summaries:', error);
        this.loading = false;
      }
    });
  }

  onSearchChange(): void {
    this.filterSuppliers();
  }

  filterSuppliers(): void {
    let filtered = this.supplierSummaries;

    // Apply letter filter
    if (this.selectedLetter) {
      filtered = filtered.filter(supplier => {
        return supplier.name?.charAt(0).toUpperCase() === this.selectedLetter;
      });
    }

    // Apply search filter
    if (this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase().trim();
      filtered = filtered.filter(supplier => 
        supplier.name?.toLowerCase().includes(query) ||
        (supplier as any).phone?.toLowerCase().includes(query) ||
        (supplier as any).email?.toLowerCase().includes(query) ||
        (supplier as any).address?.toLowerCase().includes(query)
      );
    }

    this.filteredSuppliers = filtered;
  }

  filterByLetter(letter: string): void {
    this.selectedLetter = letter;
    this.filterSuppliers();
  }

  clearLetterFilter(): void {
    this.selectedLetter = null;
    this.filterSuppliers();
  }

  onSupplierChange(): void {
    // Navigate to detail view when supplier is selected from dropdown
    if (this.filters.supplierId) {
      const queryParams: any = {};
      if (this.filters.startDate) queryParams.startDate = this.filters.startDate;
      if (this.filters.endDate) queryParams.endDate = this.filters.endDate;
      this.router.navigate(['/supplier-statement', this.filters.supplierId], { queryParams });
    }
  }

  clearFilters(): void {
    this.filters = {
      supplierId: null,
      startDate: '',
      endDate: ''
    };
    this.searchQuery = '';
    this.selectedLetter = null;
    this.filterSuppliers();
  }

  formatAmount(amount: number): string {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'TND'
    }).format(amount);
  }

  getBalanceColor(balance: number): string {
    if (balance > 0) return 'text-red-600'; // We owe money to supplier
    if (balance < 0) return 'text-green-600'; // We have credit with supplier
    return 'text-gray-600';
  }

  viewStatement(supplierId: number): void {
    this.router.navigate(['/supplier-statement', supplierId]);
  }

  printStatementA4(supplierId: number): void {
    this.router.navigate(['/supplier-statement', supplierId], {
      queryParams: { print: 'a4' }
    });
  }

  printStatementThermal(supplierId: number): void {
    this.router.navigate(['/supplier-statement', supplierId], {
      queryParams: { print: 'thermal' }
    });
  }
}
