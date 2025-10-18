import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/services/auth.service';
import { DOCUMENT } from '@angular/common';

export interface EnterpriseSupplier {
  id: number;
  name: string;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  taxNumber?: string;
  paymentTerms?: string;
  notes?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  currentDebt: number;
  totalExpenses: number;
  totalPayments: number;
  recentExpenses: any[];
  _count: {
    debtTransactions: number;
    expenses: number;
    payments: number;
  };
}

export interface CreateEnterpriseSupplierRequest {
  name: string;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  taxNumber?: string;
  paymentTerms?: string;
  notes?: string;
}

export interface UpdateEnterpriseSupplierRequest {
  name: string;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  taxNumber?: string;
  paymentTerms?: string;
  notes?: string;
  isActive: boolean;
}

@Component({
  selector: 'app-enterprise-suppliers',
  templateUrl: './enterprise-suppliers.component.html',
  styleUrls: ['./enterprise-suppliers.component.css'],
  standalone: false
})
export class EnterpriseSuppliersComponent implements OnInit {
  loading = false;
  error = '';
  suppliers: EnterpriseSupplier[] = [];
  enterpriseId: number = 0;

  // Component state
  activeSection = 'suppliers';

  // Filters
  searchQuery = '';
  selectedStatus: string = 'true';

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
  selectedSupplier: EnterpriseSupplier | null = null;
  
  // Initialize Solde Dialog
  initSoldeAmount: number | null = null;
  initSoldeNotes = '';

  // Form data
  createForm: CreateEnterpriseSupplierRequest = {
    name: '',
    contactName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    postalCode: '',
    taxNumber: '',
    paymentTerms: '',
    notes: ''
  };

  editForm: UpdateEnterpriseSupplierRequest = {
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
    private http: HttpClient,
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      this.enterpriseId = +params['enterpriseId'];
      if (this.enterpriseId) {
        this.loadSuppliers();
      }
    });
  }

  loadSuppliers(): void {
    this.loading = true;
    this.error = '';

    this.http.get<EnterpriseSupplier[]>(`${environment.apiUrl}/enterprise/suppliers/${this.enterpriseId}`)
      .subscribe({
        next: (suppliers) => {
          this.suppliers = suppliers;
          this.loading = false;
        },
        error: (error) => {
          console.error('Error loading enterprise suppliers:', error);
          this.error = 'Erreur lors du chargement des fournisseurs';
          this.loading = false;
        }
      });
  }

  get filteredSuppliers(): EnterpriseSupplier[] {
    let filtered = this.suppliers;

    // Filter by search query
    if (this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase();
      filtered = filtered.filter(supplier => 
        supplier.name.toLowerCase().includes(query) ||
        (supplier.contactName && supplier.contactName.toLowerCase().includes(query)) ||
        (supplier.email && supplier.email.toLowerCase().includes(query)) ||
        (supplier.phone && supplier.phone.includes(query)) ||
        (supplier.city && supplier.city.toLowerCase().includes(query))
      );
    }

    // Filter by status
    if (this.selectedStatus !== 'all') {
      const isActive = this.selectedStatus === 'true';
      filtered = filtered.filter(supplier => supplier.isActive === isActive);
    }

    return filtered;
  }

  openCreatePopup(): void {
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
      notes: ''
    };
    this.showCreatePopup = true;
  }

  openEditPopup(supplier: EnterpriseSupplier): void {
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

  openDeletePopup(supplier: EnterpriseSupplier): void {
    this.selectedSupplier = supplier;
    this.showDeletePopup = true;
  }

  openDetailsPopup(supplier: EnterpriseSupplier): void {
    this.selectedSupplier = supplier;
    this.showDetailsPopup = true;
  }

  openInitSoldePopup(supplier: EnterpriseSupplier): void {
    this.selectedSupplier = supplier;
    this.initSoldeAmount = null;
    this.initSoldeNotes = '';
    this.showInitSoldePopup = true;
  }

  closePopups(): void {
    this.showCreatePopup = false;
    this.showEditPopup = false;
    this.showDeletePopup = false;
    this.showDetailsPopup = false;
    this.showInitSoldePopup = false;
    this.selectedSupplier = null;
  }

  createSupplier(): void {
    if (!this.createForm.name.trim()) {
      this.error = 'Le nom du fournisseur est requis';
      return;
    }

    this.loading = true;
    this.error = '';

    this.http.post<EnterpriseSupplier>(`${environment.apiUrl}/enterprise/suppliers/${this.enterpriseId}`, this.createForm)
      .subscribe({
        next: (supplier) => {
          this.suppliers.push(supplier);
          this.closePopups();
          this.loading = false;
        },
        error: (error) => {
          console.error('Error creating enterprise supplier:', error);
          this.error = error.error?.error || 'Erreur lors de la création du fournisseur';
          this.loading = false;
        }
      });
  }

  updateSupplier(): void {
    if (!this.selectedSupplier || !this.editForm.name.trim()) {
      this.error = 'Le nom du fournisseur est requis';
      return;
    }

    this.loading = true;
    this.error = '';

    this.http.put<EnterpriseSupplier>(`${environment.apiUrl}/enterprise/suppliers/${this.enterpriseId}/${this.selectedSupplier.id}`, this.editForm)
      .subscribe({
        next: (updatedSupplier) => {
          const index = this.suppliers.findIndex(s => s.id === updatedSupplier.id);
          if (index !== -1) {
            this.suppliers[index] = updatedSupplier;
          }
          this.closePopups();
          this.loading = false;
        },
        error: (error) => {
          console.error('Error updating enterprise supplier:', error);
          this.error = error.error?.error || 'Erreur lors de la mise à jour du fournisseur';
          this.loading = false;
        }
      });
  }

  deleteSupplier(): void {
    if (!this.selectedSupplier) return;

    this.loading = true;
    this.error = '';

    this.http.delete(`${environment.apiUrl}/enterprise/suppliers/${this.enterpriseId}/${this.selectedSupplier.id}`)
      .subscribe({
        next: () => {
          this.suppliers = this.suppliers.filter(s => s.id !== this.selectedSupplier!.id);
          this.closePopups();
          this.loading = false;
        },
        error: (error) => {
          console.error('Error deleting enterprise supplier:', error);
          this.error = error.error?.error || 'Erreur lors de la suppression du fournisseur';
          this.loading = false;
        }
      });
  }

  toggleSupplierStatus(supplier: EnterpriseSupplier): void {
    this.loading = true;
    this.error = '';

    this.http.patch<EnterpriseSupplier>(`${environment.apiUrl}/enterprise/suppliers/${this.enterpriseId}/${supplier.id}/toggle-status`, {})
      .subscribe({
        next: (updatedSupplier) => {
          const index = this.suppliers.findIndex(s => s.id === updatedSupplier.id);
          if (index !== -1) {
            this.suppliers[index] = updatedSupplier;
          }
          this.loading = false;
        },
        error: (error) => {
          console.error('Error toggling enterprise supplier status:', error);
          this.error = error.error?.error || 'Erreur lors de la modification du statut';
          this.loading = false;
        }
      });
  }

  initializeSolde(): void {
    if (!this.selectedSupplier || this.initSoldeAmount === null) {
      this.error = 'Veuillez saisir un montant valide';
      return;
    }

    this.loading = true;
    this.error = '';

    const payload = {
      amount: this.initSoldeAmount,
      notes: this.initSoldeNotes
    };

    this.http.post<EnterpriseSupplier>(`${environment.apiUrl}/enterprise/suppliers/${this.enterpriseId}/${this.selectedSupplier.id}/solde/init`, payload)
      .subscribe({
        next: (updatedSupplier) => {
          const index = this.suppliers.findIndex(s => s.id === updatedSupplier.id);
          if (index !== -1) {
            this.suppliers[index] = updatedSupplier;
          }
          this.closePopups();
          this.loading = false;
        },
        error: (error) => {
          console.error('Error initializing enterprise supplier solde:', error);
          this.error = error.error?.error || 'Erreur lors de l\'initialisation du solde';
          this.loading = false;
        }
      });
  }

  clearError(): void {
    this.error = '';
  }

}
