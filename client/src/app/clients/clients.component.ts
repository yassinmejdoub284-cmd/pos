import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Router } from '@angular/router';
import { ClientsService } from '../core/services/clients.service';
import { Client, ClientType, CreateClientRequest, UpdateClientRequest } from '../core/models/client.model';
import { Depot, DepotType } from '../core/models/depot.model';
import { DepotsService } from '../core/services/depots.service';
import { AuthService } from '../core/services/auth.service';
import { Subject, takeUntil, debounceTime, distinctUntilChanged } from 'rxjs';

@Component({
  selector: 'app-clients',
  templateUrl: './clients.component.html',
  styleUrls: ['./clients.component.css'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ClientsComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private searchSubject = new Subject<string>();
  
  loading = false;
  error = '';
  clients: Client[] = [];
  totalClients = 0;
  currentPage = 1;
  totalPages = 1;
  itemsPerPage = 50;

  // Filters
  searchQuery = '';
  selectedType: string = '';
  selectedStatus: string = ''; // Show all clients by default
  
  // Sorting
  sortBy: string = 'id';
  sortOrder: 'asc' | 'desc' = 'asc';
  
  // View mode
  viewMode: 'grid' | 'table' = 'table';

  // Tunisian governorates (24)
  tunisianCities: string[] = [
    'Tunis', 'Ariana', 'Ben Arous', 'Manouba', 'Nabeul', 'Zaghouan', 'Bizerte', 'Beja', 'Jendouba', 'Kef',
    'Siliana', 'Sousse', 'Monastir', 'Mahdia', 'Kairouan', 'Kasserine', 'Sidi Bouzid', 'Sfax', 'Gabes', 'Medenine',
    'Tataouine', 'Gafsa', 'Tozeur', 'Kebili'
  ];

  // Client types for filter
  clientTypes: { value: string; label: string }[] = [
    { value: '', label: 'Tous les types' },
    { value: 'INDIVIDUAL', label: 'Particulier' },
    { value: 'BUSINESS', label: 'Entreprise' },
    { value: 'WHOLESALE', label: 'Gros' }
  ];

  // Available depots
  availableDepots: Depot[] = [];

  // Popup states
  showCreatePopup = false;
  showEditPopup = false;
  showDeletePopup = false;
  showDetailsPopup = false;
  showInitSoldePopup = false;
  selectedClient: Client | null = null;

  // Form data
  createForm: CreateClientRequest = {
    firstName: '',
    lastName: '',
    phone: '',
    city: 'Tunis',
    address: '',
    matriculeFiscal: '',
    clientType: 'INDIVIDUAL',
    depotId: null, // Must be selected by user
    pictureUrl: '',
    notes: '',
    allowDebt: true,
    maxDebt: null
  };

  editForm: UpdateClientRequest = {};

  // Initialize solde form
  initSoldeAmount: number | null = null;
  initSoldeNotes = '';

  // Alert system
  showAlert = false;
  alertMessage = '';
  alertType: 'success' | 'error' | 'info' = 'info';

  // Admin check
  isAdmin = false;

  constructor(
    private clientsService: ClientsService,
    private depotsService: DepotsService,
    private route: ActivatedRoute,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    // Check if user is admin
    const user = this.authService?.currentUser?.();
    this.isAdmin = user?.role === 'ADMIN';
    
    this.setupSearchDebounce();
    this.loadClients();
    this.loadDepots();
    
    // Check if we should open the create popup based on query parameters
    this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe(params => {
      if (params['action'] === 'add') {
        this.openCreatePopup();
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private setupSearchDebounce(): void {
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(searchQuery => {
      this.searchQuery = searchQuery;
      this.currentPage = 1;
      this.loadClients();
    });
  }

  loadClients(): void {
    this.loading = true;
    this.error = '';
    this.cdr.markForCheck();

    const active = this.selectedStatus === 'true' ? true : this.selectedStatus === 'false' ? false : undefined;

    this.clientsService.getClients(
      this.currentPage,
      this.itemsPerPage,
      this.searchQuery,
      this.selectedType,
      active,
      this.sortBy,
      this.sortOrder
    ).pipe(takeUntil(this.destroy$)).subscribe({
      next: (response) => {
        // Create a new array reference to trigger change detection
        this.clients = [...(response.clients || [])];
        this.totalClients = response.pagination?.total ?? response.clients?.length ?? 0;
        this.totalPages = response.pagination?.pages ?? Math.max(1, Math.ceil(this.totalClients / this.itemsPerPage));
        this.loading = false;
        // Force change detection
        this.cdr.detectChanges();
      },
      error: (error) => {
        this.error = 'Erreur lors du chargement des clients';
        this.loading = false;
        this.cdr.detectChanges();
        console.error('Error loading clients:', error);
      }
    });
  }

  loadDepots(): void {
    this.depotsService.list().pipe(takeUntil(this.destroy$)).subscribe({
      next: (depots) => {
        this.availableDepots = depots;
        this.cdr.markForCheck();
      },
      error: (error) => {
        console.error('Error loading depots:', error);
      }
    });
  }

  applyFilters(): void {
    this.currentPage = 1;
    this.loadClients();
  }

  onSearchInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.searchSubject.next(target.value);
  }

  clearFilters(): void {
    this.searchQuery = '';
    this.selectedType = '';
    this.selectedStatus = 'true';
    this.currentPage = 1;
    this.loadClients();
  }

  setType(type: string): void {
    this.selectedType = type;
    this.applyFilters();
  }

  setStatus(status: string): void {
    this.selectedStatus = status;
    this.applyFilters();
  }

  openWholesaleForClient(client: Client): void {
    if (!client || client.clientType !== 'WHOLESALE') return;
    this.router.navigate(['/client-gros'], { queryParams: { clientId: client.id } });
  }

  changePage(page: number): void {
    this.currentPage = page;
    this.loadClients();
  }

  openCreatePopup(): void {
    const user = this.authService?.currentUser?.();
    this.createForm = {
      firstName: '',
      lastName: '',
      phone: '',
      city: 'Tunis',
      address: '',
      matriculeFiscal: '',
      clientType: 'INDIVIDUAL',
      depotId: this.isAdmin ? null : (user?.depotId ?? null), // Must be selected for admin, user depot for non-admin
      pictureUrl: '',
      notes: '',
      allowDebt: true,
      maxDebt: null
    };
    this.showCreatePopup = true;
  }

  openEditPopup(client: Client): void {
    this.selectedClient = client;
    this.editForm = {
      firstName: client.firstName ?? '',
      lastName: client.lastName ?? '',
      phone: client.phone,
      city: client.city || 'Tunis',
      address: client.address || '',
      matriculeFiscal: client.matriculeFiscal || '',
      clientType: client.clientType,
      depotId: client.depotId,
      pictureUrl: client.pictureUrl,
      loyaltyPoints: client.loyaltyPoints,
      totalSpent: client.totalSpent,
      favoriteProducts: client.favoriteProducts,
      notes: client.notes,
      isActive: client.isActive,
      allowDebt: (client.allowDebt ?? true),
      maxDebt: (client.allowDebt ?? true) ? (client.maxDebt ?? undefined) : undefined
    };
    this.showEditPopup = true;
    this.cdr.markForCheck();
  }

  openDeletePopup(client: Client): void {
    this.selectedClient = client;
    this.showDeletePopup = true;
  }

  openDetailsPopup(client: Client): void {
    this.selectedClient = client;
    this.showDetailsPopup = true;
  }

  openInitSoldePopup(client: Client): void {
    this.selectedClient = client;
    this.initSoldeAmount = client.currentDebt || 0;
    this.initSoldeNotes = '';
    this.showInitSoldePopup = true;
  }

  closePopups(): void {
    this.showCreatePopup = false;
    this.showEditPopup = false;
    this.showDeletePopup = false;
    this.showDetailsPopup = false;
    this.showInitSoldePopup = false;
    this.selectedClient = null;
    this.initSoldeAmount = null;
    this.initSoldeNotes = '';
  }

  validateClientForm(): { isValid: boolean; missingFields: string[] } {
    const missingFields: string[] = [];

    // Check required fields
    if (!this.createForm.firstName || this.createForm.firstName.trim().length === 0) {
      missingFields.push('Prénom');
    }

    if (!this.createForm.lastName || this.createForm.lastName.trim().length === 0) {
      missingFields.push('Nom');
    }

    // Validate client type
    if (!this.createForm.clientType || !['INDIVIDUAL', 'BUSINESS', 'WHOLESALE'].includes(this.createForm.clientType)) {
      missingFields.push('Type de client');
    }

    // Validate depot selection - must be a specific depot (not -1 or null)
    if (this.isAdmin) {
      if (this.createForm.depotId === -1 || this.createForm.depotId === null || this.createForm.depotId === undefined || this.createForm.depotId === 0) {
        missingFields.push('Point de vente (vous devez sélectionner un point de vente spécifique)');
      }
    } else {
      // For non-admin, depotId should be set automatically, but validate it exists
      const user = this.authService?.currentUser?.();
      if (!user?.depotId) {
        missingFields.push('Point de vente (vous devez être assigné à un dépôt)');
      }
    }

    // Validate maxDebt if allowDebt is true
    if (this.createForm.allowDebt && this.createForm.maxDebt !== null && this.createForm.maxDebt !== undefined) {
      const maxDebtValue = parseFloat(String(this.createForm.maxDebt));
      if (isNaN(maxDebtValue) || maxDebtValue < 0) {
        missingFields.push('Plafond de crédit (doit être un nombre positif)');
      }
    }

    return {
      isValid: missingFields.length === 0,
      missingFields
    };
  }

  createClient(): void {
    // Smart validation with detailed feedback
    const validation = this.validateClientForm();
    
    if (!validation.isValid) {
      let errorMessage = '⚠️ Formulaire incomplet. Veuillez remplir les champs suivants :\n\n';
      validation.missingFields.forEach((field, index) => {
        errorMessage += `${index + 1}. ${field}\n`;
      });
      errorMessage += '\nTous les champs marqués (*) sont obligatoires.';
      this.showAlertMessage(errorMessage, 'error');
      return;
    }

    // For non-admin users, use their depotId
    if (!this.isAdmin) {
      const user = this.authService?.currentUser?.();
      this.createForm.depotId = user?.depotId ?? null;
    }

    this.clientsService.createClient(this.createForm).pipe(takeUntil(this.destroy$)).subscribe({
      next: (client) => {
        this.showAlertMessage('Client créé avec succès', 'success');
        this.closePopups();
        
        // Reset all filters FIRST to ensure the new client is visible
        this.searchQuery = '';
        this.selectedType = '';
        this.selectedStatus = 'true';
        this.currentPage = 1;
        
        // Force change detection after resetting filters
        this.cdr.markForCheck();
        
        // Small delay to ensure server has processed the creation
        // Then reload clients list with reset filters
        setTimeout(() => {
          this.loadClients();
        }, 100);
      },
      error: (error) => {
        const errorMessage = error?.error?.error || 'Erreur lors de la création du client';
        this.showAlertMessage(errorMessage, 'error');
        this.cdr.detectChanges();
      }
    });
  }

  updateClient(): void {
    if (!this.selectedClient) return;

    const trimmedFirstName = (this.editForm.firstName ?? '').trim();
    const trimmedLastName = (this.editForm.lastName ?? '').trim();
    if (!trimmedFirstName || !trimmedLastName) {
      this.showAlertMessage('Le prénom et le nom sont obligatoires', 'error');
      return;
    }

    // Validate depot selection
    if (!this.isDepotSelectionValid(this.editForm.depotId)) {
      this.showAlertMessage('Veuillez sélectionner un point de vente', 'error');
      return;
    }

    const payload: UpdateClientRequest = {
      ...this.editForm,
      firstName: trimmedFirstName,
      lastName: trimmedLastName,
      // if credit not allowed, omit maxDebt
      maxDebt: (this.editForm.allowDebt ?? true) ? (this.editForm.maxDebt ?? undefined) : undefined
    };

    this.clientsService.updateClient(this.selectedClient.id, payload).pipe(takeUntil(this.destroy$)).subscribe({
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

    this.clientsService.deleteClient(this.selectedClient.id).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.showAlertMessage('Client supprimé avec succès', 'success');
        this.closePopups();
        this.loadClients();
      },
      error: (error) => {
        const errorMessage = error?.error?.error || 'Erreur lors de la suppression du client';
        this.showAlertMessage(errorMessage, 'error');
        console.error('Error deleting client:', error);
      }
    });
  }

  initializeSolde(): void {
    if (!this.selectedClient || this.initSoldeAmount === null || this.initSoldeAmount === undefined) {
      this.showAlertMessage('Veuillez entrer un montant valide', 'error');
      return;
    }

    this.clientsService.initializeSolde(this.selectedClient.id, this.initSoldeAmount, this.initSoldeNotes).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.showAlertMessage('Solde défini avec succès', 'success');
        this.closePopups();
        this.loadClients();
      },
      error: (error) => {
        this.showAlertMessage('Erreur lors de la définition du solde', 'error');
        console.error('Error setting solde:', error);
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

  getDepotName(depotId?: number | null): string {
    if (depotId === null || depotId === undefined) return 'Facturation uniquement';
    if (depotId === -1) return 'Tout (Tous les points de vente)';
    const depot = this.availableDepots.find(d => d.id === depotId);
    return depot ? depot.name : 'Point de vente inconnu';
  }

  getDepotColor(depotId?: number | null): string {
    if (depotId === null || depotId === undefined) return 'bg-orange-500/20 text-orange-400';
    if (depotId === -1) return 'bg-green-500/20 text-green-400';
    return 'bg-blue-500/20 text-blue-400';
  }

  showAlertMessage(message: string, type: 'success' | 'error' | 'info'): void {
    this.alertMessage = message;
    this.alertType = type;
    this.showAlert = true;
    setTimeout(() => {
      this.showAlert = false;
    }, 3000);
  }

  hasNoDebt(client: Client): boolean {
    return !client._count?.debtTransactions || client._count.debtTransactions === 0;
  }

  getDepotTypeLabel(type: string): string {
    switch (type) {
      case 'MAIN': return 'Siège central';
      case 'BRANCH': return 'Succursale';
      case 'SHOP': return 'Point de vente';
      case 'WAREHOUSE': return 'Entrepôt';
      default: return 'Dépôt';
    }
  }


  getDepotTypeColor(type: string): string {
    switch (type) {
      case 'MAIN': return 'border-purple-500 bg-purple-50 text-purple-700';
      case 'BRANCH': return 'border-blue-500 bg-blue-50 text-blue-700';
      case 'SHOP': return 'border-green-500 bg-green-50 text-green-700';
      case 'WAREHOUSE': return 'border-orange-500 bg-orange-50 text-orange-700';
      default: return 'border-gray-500 bg-gray-50 text-gray-700';
    }
  }

  getDepotTypeBgColor(type: string): string {
    switch (type) {
      case 'MAIN': return 'bg-purple-500';
      case 'BRANCH': return 'bg-blue-500';
      case 'SHOP': return 'bg-green-500';
      case 'WAREHOUSE': return 'bg-orange-500';
      default: return 'bg-gray-500';
    }
  }


  // Helper methods for depot selection
  isDepotSelectionValid(depotId: number | null | undefined): boolean {
    // Valid if: -1 (Tout), null (Facturation uniquement), or a specific depot ID
    return depotId === -1 || depotId === null || (typeof depotId === 'number' && depotId > 0);
  }

  getDepotSelectionLabel(depotId: number | null): string {
    if (depotId === -1) return 'Tous les points de vente';
    if (depotId === null) return 'Facturation uniquement';
    const depot = this.availableDepots.find(d => d.id === depotId);
    return depot ? depot.name : 'Point de vente non trouvé';
  }

  // TrackBy functions for performance
  trackByClientId(index: number, client: Client): number {
    return client.id;
  }

  trackByDepotId(index: number, depot: Depot): number {
    return depot.id;
  }

  trackByCity(index: number, city: string): string {
    return city;
  }

  trackByPage(index: number): number {
    return index;
  }

  // Scroll optimization methods
  onScroll(event: Event): void {
    // Throttle scroll events for better performance
    if (this.scrollTimeout) {
      clearTimeout(this.scrollTimeout);
    }
    this.scrollTimeout = setTimeout(() => {
      // Handle scroll-based loading if needed
    }, 16); // ~60fps
  }

  private scrollTimeout: any;

  // View mode methods
  toggleViewMode(): void {
    this.viewMode = this.viewMode === 'grid' ? 'table' : 'grid';
  }

  // Pagination helpers
  getStartIndex(): number {
    return ((this.currentPage - 1) * this.itemsPerPage) + 1;
  }

  getEndIndex(): number {
    return Math.min(this.currentPage * this.itemsPerPage, this.totalClients);
  }

  // Sorting methods
  sortByField(field: string): void {
    if (this.sortBy === field) {
      // Toggle sort order if clicking the same field
      this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
    } else {
      // Set new sort field with default order
      this.sortBy = field;
      this.sortOrder = 'asc';
    }
    this.currentPage = 1;
    this.loadClients();
  }

  isSortActive(field: string): boolean {
    return this.sortBy === field;
  }

  // Statistics getters
  get activeClientsCount(): number {
    return this.clients.filter(c => c.isActive).length;
  }

  get inactiveClientsCount(): number {
    return this.clients.filter(c => !c.isActive).length;
  }

  getTotalDebt(): number {
    return this.clients.reduce((total, client) => {
      const debt = typeof client.currentDebt === 'number' ? client.currentDebt : parseFloat(String(client.currentDebt || 0));
      return total + (isNaN(debt) ? 0 : debt);
    }, 0);
  }
} 