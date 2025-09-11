import { Component, EventEmitter, Input, Output, OnInit } from '@angular/core';
import { ClientsService } from '../../core/services/clients.service';
import { Client } from '../../core/models/client.model';
import { Router } from '@angular/router';

@Component({
  selector: 'app-customer-selection-dialog',
  templateUrl: './customer-selection-dialog.component.html',
  standalone: false
})
export class CustomerSelectionDialogComponent implements OnInit {
  @Input() isVisible = false;
  @Output() customerSelected = new EventEmitter<Client>();
  @Output() dialogClosed = new EventEmitter<void>();

  customers: Client[] = [];
  filteredCustomers: Client[] = [];
  searchQuery = '';
  loading = false;
  selectedCustomer: Client | null = null;

  constructor(private clientsService: ClientsService, private router: Router) {}

  ngOnInit(): void {
    this.loadCustomers();
  }

  loadCustomers(): void {
    this.loading = true;
    this.clientsService.getClients(1, 100, '', '', true).subscribe({
      next: (response) => {
        this.customers = response.clients;
        this.filteredCustomers = response.clients;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading customers:', error);
        this.loading = false;
      }
    });
  }

  onSearchChange(): void {
    if (!this.searchQuery.trim()) {
      this.filteredCustomers = this.customers;
    } else {
      this.filteredCustomers = this.customers.filter(customer =>
        customer.firstName.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
        customer.lastName.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
        customer.code.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
        (customer.phone && customer.phone.includes(this.searchQuery))
      );
    }
  }

  selectCustomer(customer: Client): void {
    this.selectedCustomer = customer;
  }

  confirmSelection(): void {
    if (this.selectedCustomer) {
      this.customerSelected.emit(this.selectedCustomer);
    }
  }

  onClose(): void {
    this.router.navigate(['/home']);
  }

  onBackdropClick(event: Event): void {
    if (event.target === event.currentTarget) {
      this.onClose();
    }
  }

  getCustomerTypeLabel(type: string): string {
    switch (type) {
      case 'INDIVIDUAL': return 'Particulier';
      case 'BUSINESS': return 'Entreprise';
      case 'WHOLESALE': return 'Gros';
      default: return type;
    }
  }

  getCustomerTypeColor(type: string): string {
    switch (type) {
      case 'INDIVIDUAL': return 'bg-blue-500/20 text-blue-400';
      case 'BUSINESS': return 'bg-green-500/20 text-green-400';
      case 'WHOLESALE': return 'bg-purple-500/20 text-purple-400';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  }
}
