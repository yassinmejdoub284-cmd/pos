import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupplierService } from '../core/services/supplier.service';
import { Supplier, CreateSupplierRequest, UpdateSupplierRequest } from '../core/models/supplier.model';
import { AuthService } from '../core/services/auth.service';

@Component({
  selector: 'app-suppliers',
  templateUrl: './suppliers.component.html',
  standalone: false
})
export class SuppliersComponent implements OnInit {
  suppliers: Supplier[] = [];
  loading = true;
  error = '';
  searchQuery = '';
  showAddModal = false;
  showEditModal = false;
  selectedSupplier: Supplier | null = null;
  currentUser: any = null;

  newSupplier: CreateSupplierRequest = {
    name: '',
    phone: '',
    address: '',
    notes: '',
    depotId: 1
  };

  editSupplier: UpdateSupplierRequest = {
    name: '',
    phone: '',
    address: '',
    notes: '',
    isActive: true
  };

  constructor(
    private supplierService: SupplierService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.loadCurrentUser();
    this.loadSuppliers();
  }

  loadCurrentUser(): void {
    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
      if (user?.depotId) {
        this.newSupplier.depotId = user.depotId;
      }
    });
  }

  loadSuppliers(): void {
    this.loading = true;
    this.error = '';
    
    this.supplierService.getSuppliers().subscribe({
      next: (suppliers) => {
        this.suppliers = suppliers;
        this.loading = false;
      },
      error: (error) => {
        this.error = 'Erreur lors du chargement des fournisseurs';
        this.loading = false;
        console.error('Error loading suppliers:', error);
      }
    });
  }

  getFilteredSuppliers(): Supplier[] {
    if (!this.searchQuery.trim()) {
      return this.suppliers;
    }
    
    const query = this.searchQuery.toLowerCase();
    return this.suppliers.filter(supplier =>
      supplier.name.toLowerCase().includes(query) ||
      supplier.phone?.includes(query) ||
      supplier.address?.toLowerCase().includes(query)
    );
  }

  openAddModal(): void {
    this.resetNewSupplier();
    this.showAddModal = true;
  }

  closeAddModal(): void {
    this.showAddModal = false;
    this.resetNewSupplier();
  }

  openEditModal(supplier: Supplier): void {
    this.selectedSupplier = supplier;
    this.editSupplier = {
      name: supplier.name,
      phone: supplier.phone || '',
      address: supplier.address || '',
      notes: supplier.notes || '',
      isActive: supplier.isActive
    };
    this.showEditModal = true;
  }

  closeEditModal(): void {
    this.showEditModal = false;
    this.selectedSupplier = null;
    this.resetEditSupplier();
  }

  resetNewSupplier(): void {
    this.newSupplier = {
      name: '',
      phone: '',
      address: '',
      notes: '',
      depotId: this.currentUser?.depotId || 1
    };
  }

  resetEditSupplier(): void {
    this.editSupplier = {
      name: '',
      phone: '',
      address: '',
      notes: '',
      isActive: true
    };
  }

  async saveSupplier(): Promise<void> {
    if (!this.newSupplier.name.trim()) {
      this.error = 'Le nom du fournisseur est obligatoire';
      return;
    }

    try {
      await this.supplierService.createSupplier(this.newSupplier).toPromise();
      this.closeAddModal();
      this.loadSuppliers();
    } catch (error) {
      this.error = 'Erreur lors de la création du fournisseur';
      console.error('Error creating supplier:', error);
    }
  }

  async updateSupplier(): Promise<void> {
    if (!this.selectedSupplier || !this.editSupplier.name?.trim()) {
      this.error = 'Le nom du fournisseur est obligatoire';
      return;
    }

    try {
      await this.supplierService.updateSupplier(this.selectedSupplier.id, this.editSupplier).toPromise();
      this.closeEditModal();
      this.loadSuppliers();
    } catch (error) {
      this.error = 'Erreur lors de la mise à jour du fournisseur';
      console.error('Error updating supplier:', error);
    }
  }

  async toggleSupplierStatus(supplier: Supplier): Promise<void> {
    try {
      await this.supplierService.toggleSupplierStatus(supplier.id).toPromise();
      this.loadSuppliers();
    } catch (error) {
      this.error = 'Erreur lors du changement de statut';
      console.error('Error toggling supplier status:', error);
    }
  }

  async deleteSupplier(supplier: Supplier): Promise<void> {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer le fournisseur "${supplier.name}" ?`)) {
      return;
    }

    try {
      await this.supplierService.deleteSupplier(supplier.id).toPromise();
      this.loadSuppliers();
    } catch (error) {
      this.error = 'Erreur lors de la suppression du fournisseur';
      console.error('Error deleting supplier:', error);
    }
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleDateString('fr-FR');
  }

  clearError(): void {
    this.error = '';
  }
}
