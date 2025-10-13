import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { UsersService } from '../../core/services/users.service';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { LoginThemeService } from '../../core/services/login-theme.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  standalone: false
})
export class LoginComponent implements OnInit, OnDestroy {
  credentials = {
    pin: ''
  };
  
  loading = false;
  error = '';
  showPassword = false;
  isShiftPressed = false;
  
  // Splash control
  showSplash = true;

  // QWERTY keyboard layout
  qwertyRow1 = ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'];
  qwertyRow2 = ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'];
  qwertyRow3 = ['Z', 'X', 'C', 'V', 'B', 'N', 'M'];

  depots: { id: number; name: string; code: string; type?: string; city?: string }[] = [];
  showDepotChoice = false;
  selectedDepotId: number | null = null;
  depotTypes: string[] = [];
  activeTypeFilter: string | 'ALL' = 'ALL';

  // Password change modal
  showPasswordChange = false;
  passwordChangeData = {
    newPin: '',
    confirmPin: ''
  };
  passwordChangeError = '';
  passwordChangeLoading = false;
  currentUser: any = null;
  passwordChangeStep: 'new' | 'confirm' = 'new';

  // Scanner functionality
  scannerBuffer = '';
  isScannerMode = false;
  scannerTimeout: any = null;
  readonly SCANNER_TIMEOUT = 100; // ms between characters to detect scanner input
  readonly SCANNER_ENTER_KEY = 'Enter';

  private readonly loginThemeService = inject(LoginThemeService);

  constructor(
    private authService: AuthService,
    private router: Router,
    private http: HttpClient,
    private usersService: UsersService
  ) {}

  ngOnInit(): void {
    // Set theme based on URL/port and update favicon for login screen
    this.loginThemeService.detectAndSetTheme();
    this.loginThemeService.applyFaviconForLogin();

    // Redirect if already authenticated
    if (this.authService.isAuthenticated()) {
      this.router.navigate(['/home']);
      return;
    }

    // Setup scanner detection
    this.setupScannerDetection();

    // Splash for a short time then reveal login
    setTimeout(() => {
      this.showSplash = false;
    }, 1000);
  }

  ngOnDestroy(): void {
    this.loginThemeService.restoreOriginalFavicon();
    // Clean up scanner timeout
    if (this.scannerTimeout) {
      clearTimeout(this.scannerTimeout);
    }
  }

  // Theme getters for template bindings
  get themeLogoUrl(): string { return this.loginThemeService.theme().logoUrl; }
  get primaryColor(): string { return this.loginThemeService.theme().primaryColor; }
  get secondaryColor(): string { return this.loginThemeService.theme().secondaryColor; }

  onSubmit(): void {
    if (!this.credentials.pin) {
      this.error = 'Veuillez saisir votre code PIN ou scanner votre badge';
      return;
    }

    // Check if it's a scanner token (longer than 8 characters) or regular PIN
    const isToken = this.credentials.pin.length > 8;
    
    if (!isToken && (this.credentials.pin.length < 4 || this.credentials.pin.length > 8)) {
      this.error = 'Le code PIN doit contenir entre 4 et 8 chiffres';
      return;
    }

    this.loading = true;
    this.error = '';

    // Prepare login data - use token field for scanner input, pin for manual input
    const loginData = isToken ? { token: this.credentials.pin } : this.credentials;

    this.authService.login(loginData).subscribe({
      next: async (response) => {
        this.loading = false;
        
        // Force PIN change if entered PIN starts with '00'
        if (!isToken && this.credentials.pin.startsWith('00')) {
          // Keep token temporarily for PIN update, will logout after successful change
          this.currentUser = response.user;
          this.showPasswordChange = true;
          return;
        }
        
        // If admin, force depot selection if not already chosen in this session
        if (response.user.role === 'ADMIN') {
          const existing = sessionStorage.getItem('visitingDepotId');
          if (!existing) {
            await this.loadDepots();
            this.showDepotChoice = true;
            return;
          }
        }
        // Redirect based on user role
        this.redirectBasedOnRole(response.user.role);
      },
      error: (error) => {
        console.error('Login error:', error);
        this.loading = false;
        this.error = isToken ? 
          (error.error?.error || 'Token de badge invalide') : 
          (error.error?.error || 'Code PIN invalide');
      }
    });
  }

  private redirectBasedOnRole(role: string): void {
    switch (role) {
      case 'ADMIN':
        this.router.navigate(['/home']);
        break;
      case 'MANAGER':
        this.router.navigate(['/home']);
        break;
      case 'CASHIER':
        this.router.navigate(['/caisse']);
        break;
      case 'STOCK_MANAGER':
        this.router.navigate(['/stock']);
        break;
      default:
        this.router.navigate(['/home']);
    }
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  getRoleDisplayName(role: string): string {
    switch (role) {
      case 'ADMIN': return 'Administrateur';
      case 'MANAGER': return 'Responsable Magasin';
      case 'CASHIER': return 'Caissier';
      case 'STOCK_MANAGER': return 'Gestionnaire Stock';
      default: return role;
    }
  }

  // Virtual keyboard methods
  addToInput(char: string): void {
    // Only allow numbers for PIN
    if (!/^[\d]$/.test(char)) {
      return;
    }
    
    // Limit PIN to 8 digits
    if (this.credentials.pin.length >= 8) {
      return;
    }
    
    this.credentials.pin += char;
  }

  backspace(): void {
    if (this.credentials.pin.length > 0) {
      this.credentials.pin = this.credentials.pin.slice(0, -1);
    }
  }

  clearAll(): void {
    this.credentials.pin = '';
  }

  toggleShift(): void {
    this.isShiftPressed = !this.isShiftPressed;
  }

  // Admin depot selection helpers
  private async loadDepots(): Promise<void> {
    try {
      const depots = await this.http.get<any[]>(`${environment.apiUrl}/depots`).toPromise();
      this.depots = (depots || []).map(d => ({ id: d.id, name: d.name, code: d.code, type: d.type, city: d.city }));
      const typeSet = new Set<string>();
      this.depots.forEach(d => { if (d.type) typeSet.add(d.type); });
      this.depotTypes = Array.from(typeSet);
    } catch (e) {
      this.depots = [];
    }
  }

  confirmDepotSelection(): void {
    if (!this.selectedDepotId) {
      this.error = 'Veuillez sélectionner un dépôt';
      return;
    }
    sessionStorage.setItem('visitingDepotId', String(this.selectedDepotId));
    this.showDepotChoice = false;
    // Proceed to redirect
    const role = this.authService.getCurrentUserRole() || 'ADMIN';
    this.redirectBasedOnRole(role);
  }

  cancelDepotSelection(): void {
    this.showDepotChoice = false;
    // Ensure admin cannot proceed without a depot; log out
    this.authService.logout();
  }

  // UI helpers for depot cards
  getFilteredDepots(): { id: number; name: string; code: string; type?: string; city?: string }[] {
    if (this.activeTypeFilter === 'ALL') return this.depots;
    return this.depots.filter(d => d.type === this.activeTypeFilter);
  }

  getDepotIcon(type?: string): string {
    switch (type) {
      case 'MAIN': return '🏢';
      case 'BRANCH': return '🌐';
      case 'SHOP': return '🛍️';
      case 'WAREHOUSE': return '🏬';
      default: return '🏷️';
    }
  }

  getTypeLabel(type?: string): string {
    switch (type) {
      case 'MAIN': return 'Siège';
      case 'BRANCH': return 'Agence';
      case 'SHOP': return 'Magasin';
      case 'WAREHOUSE': return 'Entrepôt';
      default: return 'Autre';
    }
  }

  // Password change methods
  closePasswordChange(): void {
    this.showPasswordChange = false;
    this.passwordChangeData = { newPin: '', confirmPin: '' };
    this.passwordChangeError = '';
    this.passwordChangeLoading = false;
    this.currentUser = null;
    this.passwordChangeStep = 'new';
    // Log out user since they need to change password
    this.authService.logout();
  }

  nextStep(): void {
    this.passwordChangeError = '';
    
    // Validation for new PIN
    if (!this.passwordChangeData.newPin) {
      this.passwordChangeError = 'Veuillez saisir un nouveau code PIN';
      return;
    }
    
    if (this.passwordChangeData.newPin.length < 4 || this.passwordChangeData.newPin.length > 8) {
      this.passwordChangeError = 'Le code PIN doit contenir entre 4 et 8 chiffres';
      return;
    }
    
    if (this.passwordChangeData.newPin.startsWith('00')) {
      this.passwordChangeError = 'Le nouveau code PIN ne doit pas commencer par 00';
      return;
    }

    // Move to confirmation step
    this.passwordChangeStep = 'confirm';
    this.passwordChangeData.confirmPin = '';
  }

  updatePassword(): void {
    this.passwordChangeError = '';
    
    // Validation for confirmation
    if (!this.passwordChangeData.confirmPin) {
      this.passwordChangeError = 'Veuillez confirmer le code PIN';
      return;
    }
    
    if (this.passwordChangeData.newPin !== this.passwordChangeData.confirmPin) {
      this.passwordChangeError = 'Les codes PIN ne correspondent pas';
      return;
    }

    this.passwordChangeLoading = true;
    
    this.usersService.updateUserPin(this.currentUser.id, { pin: this.passwordChangeData.newPin }).subscribe({
      next: () => {
        this.passwordChangeLoading = false;
        this.showPasswordChange = false;
        this.passwordChangeData = { newPin: '', confirmPin: '' };
        this.passwordChangeError = '';
        this.passwordChangeStep = 'new';
        
        // Logout after successful PIN change
        this.authService.logout();
        
        // Show success message and redirect to login
        this.error = '';
        this.credentials.pin = '';
        alert('Code PIN mis à jour avec succès. Veuillez vous reconnecter avec votre nouveau code PIN.');
      },
      error: (error) => {
        this.passwordChangeLoading = false;
        this.passwordChangeError = error.error?.error || 'Erreur lors de la mise à jour du code PIN';
      }
    });
  }

  // Virtual keyboard for password change
  addToPasswordInput(char: string, field: 'newPin' | 'confirmPin'): void {
    // Only allow numbers for PIN
    if (!/^[\d]$/.test(char)) {
      return;
    }
    
    // Limit PIN to 8 digits
    const currentField = this.passwordChangeStep === 'new' ? 'newPin' : 'confirmPin';
    if (this.passwordChangeData[currentField].length >= 8) {
      return;
    }
    
    this.passwordChangeData[currentField] += char;
  }

  backspacePassword(field: 'newPin' | 'confirmPin'): void {
    const currentField = this.passwordChangeStep === 'new' ? 'newPin' : 'confirmPin';
    if (this.passwordChangeData[currentField].length > 0) {
      this.passwordChangeData[currentField] = this.passwordChangeData[currentField].slice(0, -1);
    }
  }

  clearPassword(field: 'newPin' | 'confirmPin'): void {
    const currentField = this.passwordChangeStep === 'new' ? 'newPin' : 'confirmPin';
    this.passwordChangeData[currentField] = '';
  }

  // Scanner detection methods
  private setupScannerDetection(): void {
    // Listen for keydown events to detect scanner input
    document.addEventListener('keydown', this.handleKeyDown.bind(this));
  }

  private handleKeyDown(event: KeyboardEvent): void {
    // Clear any existing timeout
    if (this.scannerTimeout) {
      clearTimeout(this.scannerTimeout);
    }

    // If it's the Enter key, process the scanner buffer
    if (event.key === this.SCANNER_ENTER_KEY) {
      event.preventDefault();
      this.processScannerInput();
      return;
    }

    // Add character to buffer
    this.scannerBuffer += event.key;
    this.isScannerMode = true;

    // Set timeout to clear buffer if no more input comes
    this.scannerTimeout = setTimeout(() => {
      this.resetScannerBuffer();
    }, this.SCANNER_TIMEOUT);
  }

  private processScannerInput(): void {
    if (this.scannerBuffer.length > 0) {
      // Set the credentials.pin to the scanned token
      this.credentials.pin = this.scannerBuffer;
      
      // Auto-submit if it looks like a valid token (longer than 8 chars)
      if (this.scannerBuffer.length > 8) {
        this.onSubmit();
      }
      
      this.resetScannerBuffer();
    }
  }

  private resetScannerBuffer(): void {
    this.scannerBuffer = '';
    this.isScannerMode = false;
    if (this.scannerTimeout) {
      clearTimeout(this.scannerTimeout);
      this.scannerTimeout = null;
    }
  }

  // Getter for scanner status display
  get scannerStatusText(): string {
    return this.isScannerMode ? 'Scanner détecté...' : 'Prêt pour scanner';
  }
}
