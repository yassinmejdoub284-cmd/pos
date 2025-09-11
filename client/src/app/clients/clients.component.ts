import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ClientsService } from '../core/services/clients.service';
import { Client, ClientType, CreateClientRequest, UpdateClientRequest } from '../core/models/client.model';

@Component({
  selector: 'app-clients',
  templateUrl: './clients.component.html',
  standalone: false
})
export class ClientsComponent implements OnInit {
  loading = false;
  error = '';
  clients: Client[] = [];
  totalClients = 0;
  currentPage = 1;
  totalPages = 1;
  itemsPerPage = 20;

  // Filters
  searchQuery = '';
  selectedType: string = '';
  selectedStatus: string = 'true';

  // Tunisian cities (24)
  tunisianCities: string[] = [
    'Tunis', 'Ariana', 'Ben Arous', 'Manouba', 'Nabeul', 'Zaghouan', 'Bizerte', 'Béja', 'Jendouba', 'Le Kef',
    'Siliana', 'Sousse', 'Monastir', 'Mahdia', 'Kairouan', 'Kasserine', 'Sidi Bouzid', 'Sfax', 'Gabès', 'Médenine',
    'Tataouine', 'Gafsa', 'Tozeur', 'Kébili'
  ];

  // Client types for filter
  clientTypes: { value: string; label: string }[] = [
    { value: '', label: 'Tous les types' },
    { value: 'INDIVIDUAL', label: 'Particulier' },
    { value: 'BUSINESS', label: 'Entreprise' },
    { value: 'WHOLESALE', label: 'Gros' }
  ];

  // Popup states
  showCreatePopup = false;
  showEditPopup = false;
  showDeletePopup = false;
  showDetailsPopup = false;
  selectedClient: Client | null = null;

  // Form data
  createForm: CreateClientRequest = {
    firstName: '',
    lastName: '',
    phone: '',
    city: 'Tunis',
    clientType: 'INDIVIDUAL',
    ageGroup: 'ADULT',
    notes: ''
  };

  editForm: UpdateClientRequest = {};

  // Alert system
  showAlert = false;
  alertMessage = '';
  alertType: 'success' | 'error' | 'info' = 'info';

  constructor(
    private clientsService: ClientsService,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.loadClients();
    
    // Check if we should open the create popup based on query parameters
    this.route.queryParams.subscribe(params => {
      if (params['action'] === 'add') {
        this.openCreatePopup();
      }
    });
  }

  loadClients(): void {
    this.loading = true;
    this.error = '';

    const active = this.selectedStatus === 'true' ? true : this.selectedStatus === 'false' ? false : undefined;

    this.clientsService.getClients(
      this.currentPage,
      this.itemsPerPage,
      this.searchQuery,
      this.selectedType,
      active
    ).subscribe({
      next: (response) => {
        this.clients = response.clients;
        this.totalClients = response.pagination.total ?? response.clients.length;
        this.totalPages = response.pagination.pages ?? Math.max(1, Math.ceil(this.totalClients / this.itemsPerPage));
        this.loading = false;
      },
      error: (error) => {
        this.error = 'Erreur lors du chargement des clients';
        this.loading = false;
        console.error('Error loading clients:', error);
      }
    });
  }

  applyFilters(): void {
    this.currentPage = 1;
    this.loadClients();
  }

  clearFilters(): void {
    this.searchQuery = '';
    this.selectedType = '';
    this.selectedStatus = 'true';
    this.currentPage = 1;
    this.loadClients();
  }

  changePage(page: number): void {
    this.currentPage = page;
    this.loadClients();
  }

  openCreatePopup(): void {
    this.createForm = {
      firstName: '',
      lastName: '',
      phone: '',
      city: 'Tunis',
      clientType: 'INDIVIDUAL',
      ageGroup: 'ADULT',
      notes: ''
    };
    this.showCreatePopup = true;
  }

  openEditPopup(client: Client): void {
    this.selectedClient = client;
    this.editForm = {
      firstName: client.firstName,
      lastName: client.lastName,
      phone: client.phone,
      city: client.city || 'Tunis',
      clientType: client.clientType,
      loyaltyPoints: client.loyaltyPoints,
      totalSpent: client.totalSpent,
      favoriteProducts: client.favoriteProducts,
      notes: client.notes,
      isActive: client.isActive,
      ageGroup: client.ageGroup || 'ADULT'
    };
    this.showEditPopup = true;
  }

  openDeletePopup(client: Client): void {
    this.selectedClient = client;
    this.showDeletePopup = true;
  }

  openDetailsPopup(client: Client): void {
    this.selectedClient = client;
    this.showDetailsPopup = true;
  }

  closePopups(): void {
    this.showCreatePopup = false;
    this.showEditPopup = false;
    this.showDeletePopup = false;
    this.showDetailsPopup = false;
    this.selectedClient = null;
  }

  createClient(): void {
    if (!this.createForm.firstName || !this.createForm.lastName) {
      this.showAlertMessage('Le prénom et le nom sont obligatoires', 'error');
      return;
    }

    this.clientsService.createClient(this.createForm).subscribe({
      next: (client) => {
        this.showAlertMessage('Client créé avec succès', 'success');
        this.closePopups();
        this.loadClients();
      },
      error: (error) => {
        this.showAlertMessage('Erreur lors de la création du client', 'error');
        console.error('Error creating client:', error);
      }
    });
  }

  updateClient(): void {
    if (!this.selectedClient || !this.editForm.firstName || !this.editForm.lastName) {
      this.showAlertMessage('Le prénom et le nom sont obligatoires', 'error');
      return;
    }

    this.clientsService.updateClient(this.selectedClient.id, this.editForm).subscribe({
      next: (client) => {
        this.showAlertMessage('Client mis à jour avec succès', 'success');
        this.closePopups();
        this.loadClients();
      },
      error: (error) => {
        this.showAlertMessage('Erreur lors de la mise à jour du client', 'error');
        console.error('Error updating client:', error);
      }
    });
  }

  deleteClient(): void {
    if (!this.selectedClient) return;

    this.clientsService.deleteClient(this.selectedClient.id).subscribe({
      next: () => {
        this.showAlertMessage('Client supprimé avec succès', 'success');
        this.closePopups();
        this.loadClients();
      },
      error: (error) => {
        this.showAlertMessage('Erreur lors de la suppression du client', 'error');
        console.error('Error deleting client:', error);
      }
    });
  }

  getClientTypeLabel(type: ClientType): string {
    switch (type) {
      case 'INDIVIDUAL': return 'Particulier';
      case 'BUSINESS': return 'Entreprise';
      case 'WHOLESALE': return 'Gros';
      default: return type;
    }
  }

  getClientTypeColor(type: ClientType): string {
    switch (type) {
      case 'INDIVIDUAL': return 'bg-blue-500/20 text-blue-400';
      case 'BUSINESS': return 'bg-green-500/20 text-green-400';
      case 'WHOLESALE': return 'bg-purple-500/20 text-purple-400';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  }

  showAlertMessage(message: string, type: 'success' | 'error' | 'info'): void {
    this.alertMessage = message;
    this.alertType = type;
    this.showAlert = true;
    setTimeout(() => {
      this.showAlert = false;
    }, 3000);
  }
} 