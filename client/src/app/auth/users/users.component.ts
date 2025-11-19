import { Component, OnInit } from '@angular/core';
import { UsersService, User } from '../../core/services/users.service';
import { SettingsService, AppSettings } from '../../core/services/settings.service';
import { DepotsService } from '../../core/services/depots.service';
import { AuthService } from '../../core/services/auth.service';
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
    firstName: '', lastName: '', role: 'CASHIER', depotId: undefined, pin: '', token: ''
  };
  newRoleKey: string = '';
  depots: Depot[] = [];
  selectedDepot: Depot | null = null;
  selectedDepotsForUser: Depot[] = []; // Multiple depots for user assignment
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

  // Token modal
  showTokenModal = false;
  tokenData = {
    token: '',
    title: '',
    field: '' as 'newToken' | 'editToken' | 'updateToken'
  };
  tokenError = '';
  tokenLoading = false;
  currentUserForToken: User | null = null;

  // Scanner functionality for token input
  scannerBuffer = '';
  isScannerMode = false;
  scannerTimeout: any = null;
  readonly SCANNER_TIMEOUT = 100; // ms between characters to detect scanner input
  readonly SCANNER_ENTER_KEY = 'Enter';
  private boundKeyDownHandler: ((event: KeyboardEvent) => void) | null = null;

  // PIN display state
  visiblePins: { [userId: number]: boolean } = {};
  
  // Token display state
  visibleTokens: { [userId: number]: boolean } = {};

  // Depot filtering for super admin (up to 2 depots)
  selectedFilterDepots: Depot[] = [];
  showDepotFilter = false;

  constructor(
    private usersService: UsersService,
    private depotsService: DepotsService,
    private settingsService: SettingsService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.load();
    this.loadDepots();
    this.loadCurrentRoles();
    // Check if user is super admin to show depot filter
    // Also check from sessionStorage in case signal hasn't updated
    const userStr = sessionStorage.getItem('user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        const roleKey = (user as any).roleKey;
        this.showDepotFilter = roleKey === '9' || roleKey === 'SUPER_ADMIN' || this.authService.isSuperAdmin();
      } catch {
        this.showDepotFilter = this.authService.isSuperAdmin();
      }
    } else {
      this.showDepotFilter = this.authService.isSuperAdmin();
    }
  }

  load(): void {
    this.loading = true;
    const depotIds = this.selectedFilterDepots.length > 0 
      ? this.selectedFilterDepots.map(d => d.id) 
      : undefined;
    this.usersService.getUsers(depotIds).subscribe({
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
  openEdit(user: User): void {
    this.selectedUser = user;
    // Initialize roleKey selector with existing roleKey or fallback to role
    this.newRoleKey = (user as any)?.roleKey || user.role || '';
    // Initialize depotIds if available, otherwise use depotId
    if ((user as any)?.depotIds && Array.isArray((user as any).depotIds)) {
      // Already has multiple depot IDs
    } else if (user.depotId) {
      // Convert single depotId to array format
      (this.selectedUser as any).depotIds = [user.depotId];
    } else {
      (this.selectedUser as any).depotIds = [];
    }
    this.showEditModal = true;
  }
  closeEdit(): void { this.selectedUser = null; this.showEditModal = false; }
  confirmDelete(user: User): void { this.selectedUser = user; this.showDeleteConfirm = true; }
  cancelDelete(): void { this.selectedUser = null; this.showDeleteConfirm = false; }

  resetNewUser(): void {
    this.newUser = { firstName: '', lastName: '', role: 'CASHIER', depotId: undefined, pin: '', token: '' };
    (this.newUser as any).depotIds = [];
  }

  // Role Access (custom role keys from settings)
  roleAccessOptions: { key: string; label: string }[] = [];

  private loadCurrentRoles(): void {
    this.settingsService.getSettings().subscribe({
      next: (s: AppSettings) => {
        const cfg: any = s?.roleAccessConfig || {};
        const keys = Object.keys(cfg);
        this.roleAccessOptions = keys.map(k => ({ key: k, label: cfg[k]?.meta?.label || k }));
        // If there is at least one, default select the first for convenience
        if (this.roleAccessOptions.length && !this.newRoleKey) {
          this.newRoleKey = this.roleAccessOptions[0].key;
        }
      },
      error: () => {}
    });
  }

  create(): void {
    this.error = '';
    const payload: any = {
      username: `${this.newUser.firstName?.toLowerCase()}.${this.newUser.lastName?.toLowerCase()}` || '',
      email: `${this.newUser.firstName?.toLowerCase()}.${this.newUser.lastName?.toLowerCase()}@company.com` || '',
      password: 'default123',
      firstName: this.newUser.firstName || '',
      lastName: this.newUser.lastName || '',
      // Persist role as the selected custom roleKey when provided, else fallback to classic role
      role: (this.newRoleKey?.trim() || this.newUser.role || 'CASHIER') as any,
      depotId: this.newUser.depotId,
      pin: this.newUser.pin || '',
      token: this.newUser.token || '',
      roleKey: this.newRoleKey?.trim() || undefined
    };
    // Add multiple depot IDs if available
    if ((this.newUser as any).depotIds && Array.isArray((this.newUser as any).depotIds)) {
      payload.depotIds = (this.newUser as any).depotIds;
    }
    this.usersService.createUser(payload).subscribe({
      next: () => { this.closeAdd(); this.load(); },
      error: () => { this.error = "Erreur lors de l'ajout de l'utilisateur"; }
    });
  }

  save(): void {
    if (!this.selectedUser) return;
    const update: any = {
      firstName: this.selectedUser.firstName,
      lastName: this.selectedUser.lastName,
      // Persist role as the selected custom roleKey when provided to avoid empty role
      role: (this.newRoleKey?.trim() || this.selectedUser.role) as any,
      depotId: this.selectedUser.depotId,
      isActive: this.selectedUser.isActive,
      // Persist selected custom role key (global RBAC)
      roleKey: this.newRoleKey?.trim() || undefined
    };
    // Add multiple depot IDs if available
    if ((this.selectedUser as any).depotIds && Array.isArray((this.selectedUser as any).depotIds)) {
      update.depotIds = (this.selectedUser as any).depotIds;
    }
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

  // Depot selection methods (multiple selection)
  openDepotSelection(isEdit: boolean = false): void {
    this.isEditingDepot = isEdit;
    this.showDepotSelection = true;
    this.selectedDepot = null;
    // Initialize selected depots from current user (support multiple depots)
    if (isEdit && this.selectedUser) {
      const depotIds = (this.selectedUser as any)?.depotIds || [];
      if (depotIds.length > 0) {
        this.selectedDepotsForUser = this.depots.filter(d => depotIds.includes(d.id));
      } else if (this.selectedUser.depotId) {
        const currentDepot = this.depots.find(d => d.id === this.selectedUser?.depotId);
        this.selectedDepotsForUser = currentDepot ? [currentDepot] : [];
      } else {
        this.selectedDepotsForUser = [];
      }
    } else if (!isEdit) {
      const depotIds = (this.newUser as any)?.depotIds || [];
      if (depotIds.length > 0) {
        this.selectedDepotsForUser = this.depots.filter(d => depotIds.includes(d.id));
      } else if (this.newUser.depotId) {
        const currentDepot = this.depots.find(d => d.id === this.newUser.depotId);
        this.selectedDepotsForUser = currentDepot ? [currentDepot] : [];
      } else {
        this.selectedDepotsForUser = [];
      }
    } else {
      this.selectedDepotsForUser = [];
    }
  }

  closeDepotSelection(): void {
    this.showDepotSelection = false;
    this.selectedDepot = null;
    this.isEditingDepot = false;
    this.selectedDepotsForUser = [];
  }

  toggleDepotForUser(depot: Depot): void {
    const index = this.selectedDepotsForUser.findIndex(d => d.id === depot.id);
    if (index >= 0) {
      // Remove depot
      this.selectedDepotsForUser.splice(index, 1);
    } else {
      // Add depot (no limit)
      this.selectedDepotsForUser.push(depot);
    }
  }

  isDepotSelectedForUser(depotId: number): boolean {
    return this.selectedDepotsForUser.some(d => d.id === depotId);
  }

  confirmDepotSelection(): void {
    // Store first depot ID for backward compatibility (depotId field)
    // And also store all selected depot IDs in a custom field
    if (this.selectedDepotsForUser.length > 0) {
      const firstDepotId = this.selectedDepotsForUser[0].id;
      if (this.isEditingDepot && this.selectedUser) {
        this.selectedUser.depotId = firstDepotId;
        // Store multiple depot IDs in a custom property
        (this.selectedUser as any).depotIds = this.selectedDepotsForUser.map(d => d.id);
      } else {
        this.newUser.depotId = firstDepotId;
        // Store multiple depot IDs in a custom property
        (this.newUser as any).depotIds = this.selectedDepotsForUser.map(d => d.id);
      }
    } else {
      // Clear depots
      if (this.isEditingDepot && this.selectedUser) {
        this.selectedUser.depotId = undefined;
        (this.selectedUser as any).depotIds = [];
      } else {
        this.newUser.depotId = undefined;
        (this.newUser as any).depotIds = [];
      }
    }
    this.closeDepotSelection();
  }

  getDepotName(depotId: number | undefined): string {
    if (!depotId) return 'Aucun';
    const depot = this.depots.find(d => d.id === depotId);
    return depot ? depot.name : `ID: ${depotId}`;
  }

  getDepotsDisplay(user: User | Partial<User>): string {
    const depotIds = (user as any)?.depotIds || [];
    if (depotIds.length > 0) {
      const names = depotIds.map((id: number) => {
        const depot = this.depots.find(d => d.id === id);
        return depot ? depot.name : `ID: ${id}`;
      });
      return names.join(', ');
    }
    if (user.depotId) {
      return this.getDepotName(user.depotId);
    }
    return 'Aucun';
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

  // Token management methods
  openTokenModal(field: 'newToken' | 'editToken' | 'updateToken', user?: User): void {
    this.tokenData.field = field;
    this.currentUserForToken = user || null;
    this.tokenError = '';
    this.tokenLoading = false;
    
    switch (field) {
      case 'newToken':
        this.tokenData.title = 'Placer l\'iButton dans le lecteur pour enregistrer le token';
        this.tokenData.token = '';
        break;
      case 'editToken':
        this.tokenData.title = 'Placer le nouvel iButton dans le lecteur pour modifier le token';
        this.tokenData.token = this.selectedUser?.token || '';
        break;
      case 'updateToken':
        this.tokenData.title = 'Placer l\'iButton dans le lecteur pour mettre à jour le token';
        this.tokenData.token = '';
        break;
    }
    
    this.showTokenModal = true;
    this.setupTokenScannerDetection();
    
    // Focus the modal to ensure it captures keyboard events
    setTimeout(() => {
      const modal = document.querySelector('[tabindex="0"]') as HTMLElement;
      if (modal) {
        modal.focus();
      }
    }, 100);
  }

  closeTokenModal(): void {
    this.showTokenModal = false;
    this.tokenData = { token: '', title: '', field: '' as any };
    this.tokenError = '';
    this.tokenLoading = false;
    this.currentUserForToken = null;
    this.cleanupTokenScannerDetection();
  }

  // Scanner detection methods for token input
  private setupTokenScannerDetection(): void {
    this.boundKeyDownHandler = this.handleTokenKeyDown.bind(this);
    document.addEventListener('keydown', this.boundKeyDownHandler, true);
  }

  private cleanupTokenScannerDetection(): void {
    if (this.boundKeyDownHandler) {
      document.removeEventListener('keydown', this.boundKeyDownHandler, true);
      this.boundKeyDownHandler = null;
    }
    if (this.scannerTimeout) {
      clearTimeout(this.scannerTimeout);
      this.scannerTimeout = null;
    }
    this.resetTokenScannerBuffer();
  }

  private handleTokenKeyDown(event: KeyboardEvent): void {
    if (!this.showTokenModal) return;

    // Prevent default behavior for all keys to avoid form submission or navigation
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    // Additional check to prevent Enter key from causing navigation
    if (event.key === 'Enter' && !this.isScannerMode) {
      return;
    }

    if (this.scannerTimeout) {
      clearTimeout(this.scannerTimeout);
    }

    if (event.key === this.SCANNER_ENTER_KEY) {
      this.processTokenScannerInput();
      return;
    }

    this.scannerBuffer += event.key;
    this.isScannerMode = true;

    this.scannerTimeout = setTimeout(() => {
      this.resetTokenScannerBuffer();
    }, this.SCANNER_TIMEOUT);
  }

  private processTokenScannerInput(): void {
    if (this.scannerBuffer.length > 0) {
      this.tokenData.token = this.scannerBuffer;
      this.resetTokenScannerBuffer();
      
      // Auto-confirm if token is valid length
      if (this.tokenData.token.length >= 10) {
        this.confirmToken();
      }
    }
  }

  private resetTokenScannerBuffer(): void {
    this.scannerBuffer = '';
    this.isScannerMode = false;
    if (this.scannerTimeout) {
      clearTimeout(this.scannerTimeout);
      this.scannerTimeout = null;
    }
  }

  confirmToken(): void {
    this.tokenError = '';
    
    // Validation
    if (!this.tokenData.token) {
      this.tokenError = 'Veuillez saisir un token';
      return;
    }
    
    if (this.tokenData.token.length < 10) {
      this.tokenError = 'Le token doit contenir au moins 10 caractères';
      return;
    }

    switch (this.tokenData.field) {
      case 'newToken':
        // For new users, we'll store it temporarily and save it when creating the user
        this.closeTokenModal();
        break;
      case 'editToken':
        if (this.selectedUser) {
          this.selectedUser.token = this.tokenData.token;
        }
        this.closeTokenModal();
        break;
      case 'updateToken':
        if (this.currentUserForToken) {
          this.updateTokenWithModal(this.currentUserForToken, this.tokenData.token);
        }
        break;
    }
  }

  updateTokenWithModal(user: User, token: string): void {
    this.tokenLoading = true;
    this.tokenError = '';
    
    this.usersService.updateUserToken(user.id, { token }).subscribe({
      next: () => { 
        this.tokenLoading = false;
        this.closeTokenModal();
        this.load();
      },
      error: (error) => {
        this.tokenLoading = false;
        this.tokenError = error.error?.error || "Erreur lors de la mise à jour du token";
      }
    });
  }

  // Token display methods
  toggleTokenVisibility(userId: number): void {
    this.visibleTokens[userId] = !this.visibleTokens[userId];
  }

  isTokenVisible(userId: number): boolean {
    return this.visibleTokens[userId] || false;
  }

  getDisplayedToken(user: User): string {
    if (this.isTokenVisible(user.id)) {
      return user.token || 'Non défini';
    }
    return '••••••••••••••••••••';
  }

  // Depot filter methods for super admin
  toggleDepotFilter(depot: Depot): void {
    const index = this.selectedFilterDepots.findIndex(d => d.id === depot.id);
    if (index >= 0) {
      // Remove depot from filter
      this.selectedFilterDepots.splice(index, 1);
    } else {
      // Add depot to filter (no limit - can select multiple)
      this.selectedFilterDepots.push(depot);
    }
    // Reload users with new filter
    this.load();
  }

  clearDepotFilter(): void {
    this.selectedFilterDepots = [];
    this.load();
  }

  isDepotSelected(depotId: number): boolean {
    return this.selectedFilterDepots.some(d => d.id === depotId);
  }
}


