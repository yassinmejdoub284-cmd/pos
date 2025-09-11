import { Component, OnInit } from '@angular/core';
import { UsersService, User } from '../../core/services/users.service';
import { DepotsService } from '../../core/services/depots.service';

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
  selectedUser: User | null = null;
  newUser: Partial<User & { password: string }> = {
    username: '', email: '', firstName: '', lastName: '', role: 'CASHIER', depotId: undefined, pin: '',
    password: ''
  };

  constructor(private usersService: UsersService) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.usersService.getUsers().subscribe({
      next: (u) => { this.users = u; this.loading = false; },
      error: () => { this.error = 'Erreur lors du chargement des utilisateurs'; this.loading = false; }
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
    this.newUser = { username: '', email: '', firstName: '', lastName: '', role: 'CASHIER', depotId: undefined, pin: '', password: '' };
  }

  create(): void {
    this.error = '';
    const payload = {
      username: this.newUser.username || '',
      email: this.newUser.email || '',
      password: this.newUser.password || '',
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

  updatePin(user: User, pin: string): void {
    if (!pin || pin.length !== 8) { this.error = 'PIN doit contenir 8 chiffres'; return; }
    this.usersService.updateUserPin(user.id, { pin }).subscribe({
      next: () => { this.load(); },
      error: () => { this.error = "Erreur lors de la mise à jour du PIN"; }
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
}


