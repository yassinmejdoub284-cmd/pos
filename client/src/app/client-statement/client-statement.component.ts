import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router, RouterModule } from '@angular/router';
import { environment } from '../../environments/environment';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../core/services/auth.service';

interface Client {
  id: number;
  code: string;
  firstName: string;
  lastName: string;
  currentDebt: number;
}

interface ClientSummary {
  id: number;
  code: string;
  firstName: string;
  lastName: string;
  currentDebt: number;
  totalSpent: number;
  totalDebit: number;
  totalCredit: number;
  currentBalance: number;
  operationCount: number;
  _count: {
    sales: number;
    debtTransactions: number;
  };
}

@Component({
  selector: 'app-client-statement',
  templateUrl: './client-statement.component.html',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule]
})
export class ClientStatementComponent implements OnInit {
  clientSummaries: ClientSummary[] = [];
  filteredClientSummaries: ClientSummary[] = [];
  loading = false;
  isAdmin = false;
  searchQuery = '';
  selectedLetter: string | null = null;
  alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

  // Filters
  filters = {
    clientId: null as number | null,
    startDate: '',
    endDate: ''
  };

  constructor(
    private http: HttpClient,
    public router: Router,
    private authService: AuthService
  ) { }

  ngOnInit(): void {
    this.isAdmin = this.authService.isAdmin();
    this.loadClientSummaries();
  }

  loadClientSummaries(): void {
    this.loading = true;
    let url = `${environment.apiUrl}/client-statements/statements/summary?`;
    const params = new URLSearchParams();

    if (this.filters.startDate) {
      params.append('startDate', this.filters.startDate);
    }
    if (this.filters.endDate) {
      params.append('endDate', this.filters.endDate);
    }

    url += params.toString();

    this.http.get<ClientSummary[]>(url).subscribe({
      next: (summaries) => {
        this.clientSummaries = summaries;
        this.filteredClientSummaries = summaries;
        this.applySearch();
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading client summaries:', error);
        this.loading = false;
      }
    });
  }

  onSearchChange(): void {
    this.applySearch();
  }

  applySearch(): void {
    let filtered = this.clientSummaries;

    // Apply letter filter
    if (this.selectedLetter) {
      filtered = filtered.filter(client => {
        const fullName = this.getClientFullName(client);
        return fullName.charAt(0).toUpperCase() === this.selectedLetter;
      });
    }

    // Apply search filter
    if (this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase().trim();
      filtered = filtered.filter(client => {
        const fullName = this.getClientFullName(client).toLowerCase();
        const code = client.code.toLowerCase();
        
        return fullName.includes(query) || code.includes(query);
      });
    }

    this.filteredClientSummaries = filtered;
  }

  filterByLetter(letter: string): void {
    this.selectedLetter = letter;
    this.applySearch();
  }

  clearLetterFilter(): void {
    this.selectedLetter = null;
    this.applySearch();
  }

  onClientChange(): void {
    // Navigate to detail view when client is selected from dropdown
    if (this.filters.clientId) {
      const queryParams: any = {};
      if (this.filters.startDate) queryParams.startDate = this.filters.startDate;
      if (this.filters.endDate) queryParams.endDate = this.filters.endDate;
      this.router.navigate(['/client-statement', this.filters.clientId], { queryParams });
    }
  }

  clearFilters(): void {
    this.filters = {
      clientId: null,
      startDate: '',
      endDate: ''
    };
    this.searchQuery = '';
    this.selectedLetter = null;
    this.loadClientSummaries();
  }

  formatAmount(amount: number): string {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'TND'
    }).format(amount);
  }

  getClientFullName(client: ClientSummary | Client): string {
    return `${client.firstName} ${client.lastName}`;
  }

  getBalanceColor(balance: number): string {
    if (balance > 0) return 'text-green-600'; // Client has paid in advance
    if (balance < 0) return 'text-red-600';   // Client still owes money
    return 'text-gray-600';
  }

  viewStatement(clientId: number): void {
    this.router.navigate(['/client-statement', clientId]);
  }

  printStatementA4(clientId: number): void {
    this.router.navigate(['/client-statement', clientId], {
      queryParams: { print: 'a4' }
    });
  }

  printStatementThermal(clientId: number): void {
    this.router.navigate(['/client-statement', clientId], {
      queryParams: { print: 'thermal' }
    });
  }
}
