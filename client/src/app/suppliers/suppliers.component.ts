import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Router } from '@angular/router';
import { SupplierService } from '../core/services/supplier.service';
import { Supplier, CreateSupplierRequest, UpdateSupplierRequest } from '../core/models/supplier.model';
import { Depot } from '../core/models/depot.model';
import { DepotsService } from '../core/services/depots.service';
import { AuthService } from '../core/services/auth.service';

@Component({
  selector: 'app-suppliers',
  templateUrl: './suppliers.component.html',
  standalone: false
})
export class SuppliersComponent implements OnInit {
  loading = false;
  error = '';
  suppliers: Supplier[] = [];
  totalSuppliers = 0;
  currentPage = 1;
  totalPages = 1;
  itemsPerPage = 20;

  // Filters
  searchQuery = '';
  selectedStatus: string = 'true';

  // Available depots
  availableDepots: Depot[] = [];
  
  // Admin check
  isAdmin = false;

  // Tunisian governorates (24)
  tunisianCities: string[] = [
    'Tunis', 'Ariana', 'Ben Arous', 'Manouba', 'Nabeul', 'Zaghouan', 'Bizerte', 'Beja', 'Jendouba', 'Kef',
    'Siliana', 'Sousse', 'Monastir', 'Mahdia', 'Kairouan', 'Kasserine', 'Sidi Bouzid', 'Sfax', 'Gabes', 'Medenine',
    'Tataouine', 'Gafsa', 'Tozeur', 'Kebili'
  ];

  // Popup states
  showCreatePopup = false;
  showEditPopup = false;
  showDeletePopup = false;
  showDetailsPopup = false;
  showInitSoldePopup = false;
  selectedSupplier: Supplier | null = null;
  
  // Initialize Solde Dialog
  initSoldeAmount: number | null = null;
  initSoldeNotes = '';

  // Form data
  createForm: CreateSupplierRequest = {
    name: '',
    contactName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    postalCode: '',
    taxNumber: '',
    paymentTerms: '',
    notes: '',
    depotId: -1, // Default to "Tous les points de vente"
    currentDebt: 0
  };

  editForm: UpdateSupplierRequest = {
    name: '',
    contactName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    postalCode: '',
    taxNumber: '',
    paymentTerms: '',
    notes: '',
    isActive: true
  };

  constructor(
    private supplierService: SupplierService,
    private depotsService: DepotsService,
    private authService: AuthService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Check if user is admin
    const user = this.authService?.currentUser?.();
    this.isAdmin = user?.role === 'ADMIN';
    
    this.loadSuppliers();
    this.loadDepots();
    
    // Check if we should open the add modal
    this.route.queryParams.subscribe(params => {
      if (params['action'] === 'add') {
        this.openCreatePopup();
      }
    });
  }

  loadDepots(): void {
    this.depotsService.list().subscribe({
      next: (depots) => {
        this.availableDepots = depots;
      },
      error: (error) => {
        console.error('Error loading depots:', error);
      }
    });
  }

  loadSuppliers(): void {
    this.loading = true;
    this.supplierService.getSuppliers().subscribe({
      next: (suppliers) => {
        this.suppliers = suppliers;
        this.totalSuppliers = suppliers.length;
        this.totalPages = Math.ceil(this.totalSuppliers / this.itemsPerPage);
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading suppliers:', error);
        this.error = 'Erreur lors du chargement des fournisseurs';
        this.loading = false;
      }
    });
  }

  trackByDepotId(index: number, depot: Depot): number {
    return depot.id;
  }

  getDepotTypeLabel(type: string): string {
    switch (type) {
      case 'PRINCIPAL': return 'Principal';
      case 'SECONDAIRE': return 'Secondaire';
      case 'POINT_DE_VENTE': return 'Point de vente';
      default: return type;
    }
  }

  get filteredSuppliers(): Supplier[] {
    let filtered = this.suppliers;

    // Filter by search query
    if (this.searchQuery) {
      filtered = filtered.filter(supplier =>
        supplier.name.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
        (supplier.contactName && supplier.contactName.toLowerCase().includes(this.searchQuery.toLowerCase())) ||
        (supplier.email && supplier.email.toLowerCase().includes(this.searchQuery.toLowerCase())) ||
        (supplier.phone && supplier.phone.includes(this.searchQuery))
      );
    }

    // Filter by status
    if (this.selectedStatus !== '') {
      filtered = filtered.filter(supplier => 
        this.selectedStatus === 'true' ? supplier.isActive : !supplier.isActive
      );
    }

    return filtered;
  }

  get paginatedSuppliers(): Supplier[] {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    return this.filteredSuppliers.slice(startIndex, endIndex);
  }

  // Popup methods
  openCreatePopup(): void {
    const user = this.authService?.currentUser?.();
    this.createForm = {
      name: '',
      contactName: '',
      email: '',
      phone: '',
      address: '',
      city: '',
      postalCode: '',
      taxNumber: '',
      paymentTerms: '',
      notes: '',
      depotId: this.isAdmin ? -1 : (user?.depotId ?? null), // Default to "Tous les points de vente" for admin, user depot for non-admin
      currentDebt: 0
    };
    this.showCreatePopup = true;
  }

  openEditPopup(supplier: Supplier): void {
    this.selectedSupplier = supplier;
    this.editForm = {
      name: supplier.name,
      contactName: supplier.contactName || '',
      email: supplier.email || '',
      phone: supplier.phone || '',
      address: supplier.address || '',
      city: supplier.city || '',
      postalCode: supplier.postalCode || '',
      taxNumber: supplier.taxNumber || '',
      paymentTerms: supplier.paymentTerms || '',
      notes: supplier.notes || '',
      isActive: supplier.isActive
    };
    this.showEditPopup = true;
  }

  openDeletePopup(supplier: Supplier): void {
    this.selectedSupplier = supplier;
    this.showDeletePopup = true;
  }

  openDetailsPopup(supplier: Supplier): void {
    this.selectedSupplier = supplier;
    this.showDetailsPopup = true;
  }

  closePopups(): void {
    this.showCreatePopup = false;
    this.showEditPopup = false;
    this.showDeletePopup = false;
    this.showDetailsPopup = false;
    this.showInitSoldePopup = false;
    this.selectedSupplier = null;
    this.initSoldeAmount = null;
    this.initSoldeNotes = '';
  }

  // CRUD operations
  createSupplier(): void {
    if (!this.createForm.name.trim()) {
      alert('Le nom du fournisseur est requis');
      return;
    }

    // For non-admin users, use their depotId
    if (!this.isAdmin) {
      const user = this.authService?.currentUser?.();
      this.createForm.depotId = user?.depotId ?? null;
    }

    this.loading = true;
    this.supplierService.createSupplier(this.createForm).subscribe({
      next: () => {
        this.loadSuppliers();
        this.closePopups();
        this.loading = false;
        alert('Fournisseur créé avec succès');
      },
      error: (error) => {
        console.error('Error creating supplier:', error);
        this.loading = false;
        alert('Erreur lors de la création du fournisseur');
      }
    });
  }

  updateSupplier(): void {
    if (!this.selectedSupplier || !this.editForm.name?.trim()) {
      alert('Le nom du fournisseur est requis');
      return;
    }

    this.loading = true;
    this.supplierService.updateSupplier(this.selectedSupplier.id, this.editForm).subscribe({
      next: () => {
        this.loadSuppliers();
        this.closePopups();
        this.loading = false;
        alert('Fournisseur mis à jour avec succès');
      },
      error: (error) => {
        console.error('Error updating supplier:', error);
        this.loading = false;
        alert('Erreur lors de la mise à jour du fournisseur');
      }
    });
  }

  deleteSupplier(): void {
    if (!this.selectedSupplier) return;

    this.loading = true;
    this.supplierService.deleteSupplier(this.selectedSupplier.id).subscribe({
      next: () => {
        this.loadSuppliers();
        this.closePopups();
        this.loading = false;
        alert('Fournisseur supprimé avec succès');
      },
      error: (error) => {
        console.error('Error deleting supplier:', error);
        this.loading = false;
        alert('Erreur lors de la suppression du fournisseur');
      }
    });
  }

  toggleSupplierStatus(supplier: Supplier): void {
    this.loading = true;
    this.supplierService.toggleSupplierStatus(supplier.id).subscribe({
      next: () => {
        this.loadSuppliers();
        this.loading = false;
      },
      error: (error) => {
        console.error('Error toggling supplier status:', error);
        this.loading = false;
        alert('Erreur lors de la modification du statut du fournisseur');
      }
    });
  }

  // Pagination
  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }

  // Utility methods
  formatDate(date: Date | string): string {
    return new Date(date).toLocaleDateString('fr-FR');
  }

  getStatusColor(isActive: boolean): string {
    return isActive ? 'text-green-600 bg-green-100' : 'text-red-600 bg-red-100';
  }

  getStatusText(isActive: boolean): string {
    return isActive ? 'Actif' : 'Inactif';
  }

  // Getter methods for template
  get activeSuppliersCount(): number {
    return this.suppliers.filter(s => s.isActive).length;
  }

  get inactiveSuppliersCount(): number {
    return this.suppliers.filter(s => !s.isActive).length;
  }

  // Calculate total debt owed to all suppliers
  getTotalDebt(): number {
    return this.suppliers.reduce((total, supplier) => total + (supplier.currentDebt || 0), 0);
  }

  // Solde initialization methods
  openInitSoldePopup(supplier: Supplier): void {
    this.selectedSupplier = supplier;
    this.initSoldeAmount = supplier.currentDebt || 0;
    this.initSoldeNotes = '';
    this.showInitSoldePopup = true;
  }

  initializeSolde(): void {
    if (!this.selectedSupplier || this.initSoldeAmount === null || this.initSoldeAmount === undefined) {
      alert('Veuillez entrer un montant valide');
      return;
    }

    this.loading = true;
    this.supplierService.initializeSolde(this.selectedSupplier.id, this.initSoldeAmount, this.initSoldeNotes).subscribe({
      next: () => {
        this.loadSuppliers();
        this.closePopups();
        this.loading = false;
        alert('Solde défini avec succès');
      },
      error: (error) => {
        console.error('Error setting supplier solde:', error);
        this.loading = false;
        alert('Erreur lors de la définition du solde');
      }
    });
  }

  hasNoDebt(supplier: Supplier): boolean {
    // Check if supplier has no debt transactions, expenses, or payments
    const debtTransactionCount = supplier._count?.debtTransactions || 0;
    const expenseCount = supplier._count?.expenses || 0;
    const paymentCount = supplier._count?.payments || 0;
    const hasAnyMovement = debtTransactionCount > 0 || expenseCount > 0 || paymentCount > 0;
    
    return !hasAnyMovement;
  }

  // Math utility for template
  Math = Math;
}
