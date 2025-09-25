import { Component, OnInit } from '@angular/core';
import { UsersService, User } from '../../core/services/users.service';
import { DepotsService } from '../../core/services/depots.service';
import { Depot } from '../../core/models/depot.model';

@Component({
  selector: 'app-users',
  templateUrl: './users.component.html',
  standalone: false
})
export class UsersComponent implements OnInit {
  loading = false;
  error = '';
  users: User[] = [];
  search = '';
  showAddModal = false;
  showEditModal = false;
  showDeleteConfirm = false;
  showDepotSelection = false;
  selectedUser: User | null = null;
  newUser: Partial<User> = {
    firstName: '', lastName: '', role: 'CASHIER', depotId: undefined, pin: ''
  };
  depots: Depot[] = [];
  selectedDepot: Depot | null = null;
  isEditingDepot = false;

  // Numpad modal
  showNumpad = false;
  numpadData = {
    pin: '',
    title: '',
    field: '' as 'newPin' | 'editPin' | 'updatePin'
  };
  numpadError = '';
  numpadLoading = false;
  currentUserForPin: User | null = null;

  // PIN display state
  visiblePins: { [userId: number]: boolean } = {};

  constructor(
    private usersService: UsersService,
    private depotsService: DepotsService
  ) {}

  ngOnInit(): void {
    this.load();
    this.loadDepots();
  }

  load(): void {
    this.loading = true;
    this.usersService.getUsers().subscribe({
      next: (u) => { this.users = u; this.loading = false; },
      error: () => { this.error = 'Erreur lors du chargement des utilisateurs'; this.loading = false; }
    });
  }

  loadDepots(): void {
    this.depotsService.list().subscribe({
      next: (depots) => { this.depots = depots; },
      error: () => { this.error = 'Erreur lors du chargement des dépôts'; }
    });
  }

  // UI actions
  openAdd(): void { this.showAddModal = true; this.resetNewUser(); }
  closeAdd(): void { this.showAddModal = false; }
  openEdit(user: User): void { this.selectedUser = user; this.showEditModal = true; }
  closeEdit(): void { this.selectedUser = null; this.showEditModal = false; }
  confirmDelete(user: User): void { this.selectedUser = user; this.showDeleteConfirm = true; }
  cancelDelete(): void { this.selectedUser = null; this.showDeleteConfirm = false; }

  resetNewUser(): void {
    this.newUser = { firstName: '', lastName: '', role: 'CASHIER', depotId: undefined, pin: '' };
  }

  create(): void {
    this.error = '';
    const payload = {
      username: `${this.newUser.firstName?.toLowerCase()}.${this.newUser.lastName?.toLowerCase()}` || '',
      email: `${this.newUser.firstName?.toLowerCase()}.${this.newUser.lastName?.toLowerCase()}@company.com` || '',
      password: 'default123',
      firstName: this.newUser.firstName || '',
      lastName: this.newUser.lastName || '',
      role: (this.newUser.role || 'CASHIER') as any,
      depotId: this.newUser.depotId,
      pin: this.newUser.pin || ''
    };
    this.usersService.createUser(payload).subscribe({
      next: () => { this.closeAdd(); this.load(); },
      error: () => { this.error = "Erreur lors de l'ajout de l'utilisateur"; }
    });
  }

  save(): void {
    if (!this.selectedUser) return;
    const update = {
      firstName: this.selectedUser.firstName,
      lastName: this.selectedUser.lastName,
      role: this.selectedUser.role,
      depotId: this.selectedUser.depotId,
      isActive: this.selectedUser.isActive
    };
    this.usersService.updateUser(this.selectedUser.id, update).subscribe({
      next: (u) => { this.selectedUser = u; this.closeEdit(); this.load(); },
      error: () => { this.error = "Erreur lors de la modification de l'utilisateur"; }
    });
  }


  remove(): void {
    if (!this.selectedUser) return;
    this.usersService.deleteUser(this.selectedUser.id).subscribe({
      next: () => { this.cancelDelete(); this.load(); },
      error: () => { this.error = "Erreur lors de la suppression de l'utilisateur"; }
    });
  }

  get filteredUsers(): User[] {
    const q = this.search.trim().toLowerCase();
    if (!q) return this.users;
    return this.users.filter(u =>
      (u.username || '').toLowerCase().includes(q) ||
      (u.firstName || '').toLowerCase().includes(q) ||
      (u.lastName || '').toLowerCase().includes(q)
    );
  }

  getRoleClass(role: string): string {
    return this.usersService.getRoleColor(role);
  }

  getRoleName(role: string): string {
    return this.usersService.getRoleDisplayName(role);
  }

  // Depot selection methods
  openDepotSelection(isEdit: boolean = false): void {
    this.isEditingDepot = isEdit;
    this.showDepotSelection = true;
    this.selectedDepot = null;
  }

  closeDepotSelection(): void {
    this.showDepotSelection = false;
    this.selectedDepot = null;
    this.isEditingDepot = false;
  }

  selectDepot(depot: Depot): void {
    this.selectedDepot = depot;
  }

  confirmDepotSelection(): void {
    if (this.selectedDepot) {
      if (this.isEditingDepot && this.selectedUser) {
        this.selectedUser.depotId = this.selectedDepot.id;
      } else {
        this.newUser.depotId = this.selectedDepot.id;
      }
    }
    this.closeDepotSelection();
  }

  getDepotName(depotId: number | undefined): string {
    if (!depotId) return 'Aucun';
    const depot = this.depots.find(d => d.id === depotId);
    return depot ? depot.name : `ID: ${depotId}`;
  }

  getDepotIcon(type: string): string {
    switch (type) {
      case 'WAREHOUSE': return '🏭';
      case 'STORE': return '🏪';
      case 'OFFICE': return '🏢';
      default: return '📦';
    }
  }

  getTypeLabel(type: string): string {
    switch (type) {
      case 'WAREHOUSE': return 'Entrepôt';
      case 'STORE': return 'Magasin';
      case 'OFFICE': return 'Bureau';
      default: return 'Autre';
    }
  }

  // Numpad methods
  openNumpad(field: 'newPin' | 'editPin' | 'updatePin', user?: User): void {
    this.numpadData.field = field;
    this.currentUserForPin = user || null;
    this.numpadError = '';
    this.numpadLoading = false;
    
    switch (field) {
      case 'newPin':
        this.numpadData.title = 'Nouveau code PIN';
        this.numpadData.pin = this.newUser.pin || '';
        break;
      case 'editPin':
        this.numpadData.title = 'Modifier le code PIN';
        this.numpadData.pin = this.selectedUser?.pin || '';
        break;
      case 'updatePin':
        this.numpadData.title = 'Mettre à jour le code PIN';
        this.numpadData.pin = '';
        break;
    }
    
    this.showNumpad = true;
  }

  closeNumpad(): void {
    this.showNumpad = false;
    this.numpadData = { pin: '', title: '', field: '' as any };
    this.numpadError = '';
    this.numpadLoading = false;
    this.currentUserForPin = null;
  }

  addToNumpad(char: string): void {
    // Only allow numbers for PIN
    if (!/^[\d]$/.test(char)) {
      return;
    }
    
    // Limit PIN to 8 digits
    if (this.numpadData.pin.length >= 8) {
      return;
    }
    
    this.numpadData.pin += char;
  }

  backspaceNumpad(): void {
    if (this.numpadData.pin.length > 0) {
      this.numpadData.pin = this.numpadData.pin.slice(0, -1);
    }
  }

  clearNumpad(): void {
    this.numpadData.pin = '';
  }

  confirmNumpad(): void {
    this.numpadError = '';
    
    // Validation
    if (!this.numpadData.pin) {
      this.numpadError = 'Veuillez saisir un code PIN';
      return;
    }
    
    if (this.numpadData.pin.length < 4 || this.numpadData.pin.length > 8) {
      this.numpadError = 'Le code PIN doit contenir entre 4 et 8 chiffres';
      return;
    }

    switch (this.numpadData.field) {
      case 'newPin':
        this.newUser.pin = this.numpadData.pin;
        this.closeNumpad();
        break;
      case 'editPin':
        if (this.selectedUser) {
          this.selectedUser.pin = this.numpadData.pin;
        }
        this.closeNumpad();
        break;
      case 'updatePin':
        if (this.currentUserForPin) {
          this.updatePinWithNumpad(this.currentUserForPin, this.numpadData.pin);
        }
        break;
    }
  }

  updatePinWithNumpad(user: User, pin: string): void {
    this.numpadLoading = true;
    this.numpadError = '';
    
    this.usersService.updateUserPin(user.id, { pin }).subscribe({
      next: () => { 
        this.numpadLoading = false;
        this.closeNumpad();
        this.load();
      },
      error: (error) => {
        this.numpadLoading = false;
        this.numpadError = error.error?.error || "Erreur lors de la mise à jour du PIN";
      }
    });
  }

  // PIN display methods
  togglePinVisibility(userId: number): void {
    this.visiblePins[userId] = !this.visiblePins[userId];
  }

  isPinVisible(userId: number): boolean {
    return this.visiblePins[userId] || false;
  }

  getDisplayedPin(user: User): string {
    if (this.isPinVisible(user.id)) {
      return user.pin || 'Non défini';
    }
    return '••••••••';
  }
}


