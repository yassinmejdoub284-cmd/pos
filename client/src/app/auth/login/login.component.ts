import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { VoicePlayerComponent } from '../../shared/components/voice-player/voice-player.component';
import { UsersService } from '../../core/services/users.service';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { LoginThemeService } from '../../core/services/login-theme.service';
import { DepotsService } from '../../core/services/depots.service';

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

  depots: { id: number; name: string; code: string; type?: string; city?: string; logo?: string }[] = [];
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
  private returnUrl: string | null = null;

  constructor(
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private http: HttpClient,
    private usersService: UsersService,
    private depotsService: DepotsService
  ) {}

  ngOnInit(): void {
    // Set theme based on URL/port and update favicon for login screen
    this.loginThemeService.detectAndSetTheme();
    this.loginThemeService.applyFaviconForLogin();

    // Get returnUrl from query params if present
    this.route.queryParams.subscribe((params: any) => {
      this.returnUrl = params['returnUrl'] || null;
    });

    // Check if already authenticated - check both signal and sessionStorage
    const token = sessionStorage.getItem('token');
    const userStr = sessionStorage.getItem('user');
    const isAuthenticated = this.authService.isAuthenticated();
    
    // Only restore auth state if we have both token AND user data AND signal is not set
    // This prevents redirect loops after logout
    if (token && token.trim().length > 0 && userStr && !isAuthenticated) {
      try {
        const user = JSON.parse(userStr);
        // Only restore if user data is valid
        if (user && user.id) {
          this.authService.currentUser.set(user);
          this.authService.isAuthenticated.set(true);
          // Redirect based on role (will check returnUrl and admin depot selection)
          const role = user.role || '';
          this.redirectBasedOnRole(role);
          return;
        }
      } catch (error) {
        // If parsing fails, clear corrupted data
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('user');
        sessionStorage.removeItem('permissions');
      }
    }

    // Redirect if already authenticated (user logged in before reaching login page)
    if (isAuthenticated && token && userStr) {
      const currentUser = this.authService.currentUser();
      if (currentUser) {
        // Show reminders and redirect (will check returnUrl and admin depot selection)
        this.tryShowRemindersThenRedirect('SESSION');
      }
      return;
    }

    // Not authenticated - show login screen
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
  /** Nom de la societe saisi dans Parametres > Entreprise. */
  get themeCompanyName(): string { return this.loginThemeService.theme().companyName; }
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
    const loginData: any = isToken ? { token: this.credentials.pin } : { pin: this.credentials.pin };
    
    // Add depotId ONLY if it was explicitly selected by the user in the UI
    // We avoid "guessing" from sessionStorage/localStorage here to prevent 401 errors
    // when a different user tries to log in. The theme still uses the stored values.
    if (this.selectedDepotId) {
      loginData.depotId = Number(this.selectedDepotId);
    }

    this.authService.login(loginData).subscribe({
      next: async (response) => {

        this.loading = false;
        
        // Save depotId to sessionStorage for future logins
        if (response.user.depotId) {
          sessionStorage.setItem('depotId', String(response.user.depotId));
        }
        
        // Force PIN change if entered PIN starts with '00'
        if (!isToken && this.credentials.pin.startsWith('00')) {

          // Keep token temporarily for PIN update, will logout after successful change
          this.currentUser = response.user;
          this.showPasswordChange = true;
          return;
        }
        
        // After successful login, check reminders and notifications first

        this.postLoginRole = response.user.role;
        await this.tryShowRemindersThenRedirect('LOGIN');
      },
      error: (error) => {
        console.error('Login error:', error);
        console.error('Error details:', { 
          status: error.status, 
          error: error.error,
          message: error.message 
        });
        this.loading = false;
        
        // If depotId is required but missing, show depot selection
        if (error.status === 400 && (error.error?.error?.includes('depotId') || error.error?.requiresDepotId || error.error?.error?.includes('Plusieurs utilisateurs'))) {
          this.error = 'Veuillez sélectionner un dépôt';
          this.showDepotChoice = true;
          return;
        }
        
        // Show specific error message from server
        const errorMessage = error.error?.error || error.message || 'Erreur de connexion';
        this.error = errorMessage;
        
        // If it's a 401 and we have a depotId, try removing it and retrying
        if (error.status === 401 && loginData.depotId && !isToken) {

          // Clear depotId and retry
          const retryLoginData = { ...loginData };
          delete retryLoginData.depotId;
          sessionStorage.removeItem('depotId');
          sessionStorage.removeItem('visitingDepotId');
          // Retry login without depotId
          setTimeout(() => {
            this.authService.login(retryLoginData).subscribe({
              next: async (response) => {

                this.loading = false;
                if (response.user.depotId) {
                  sessionStorage.setItem('depotId', String(response.user.depotId));
                }
                this.postLoginRole = response.user.role;
                await this.tryShowRemindersThenRedirect('LOGIN');
              },
              error: (retryError) => {
                console.error('Retry login failed:', retryError);
                this.error = retryError.error?.error || 'Code PIN invalide';
              }
            });
          }, 100);
          return;
        }
      }
    });
  }

  private async redirectBasedOnRole(role: string): Promise<void> {

    
    if (role === 'ADMIN' || role === 'SUPER_ADMIN') {
      const existingDepotId = sessionStorage.getItem('visitingDepotId');
      if (!existingDepotId) {
        this.showDepotChoice = true;
        await this.loadDepots();
        return;
      }
    }
    
    // Check if returnUrl is set (from auth guard redirect)
    if (this.returnUrl) {

      this.router.navigate([this.returnUrl]);
      return;
    }
    
    switch (role) {
      case 'ADMIN':
        this.router.navigate(['/admin-home']);
        break;
      case 'SUPER_ADMIN':
        this.router.navigate(['/home']);
        break;
      case 'MANAGER':
        this.router.navigate(['/home']);
        break;
      case 'CASHIER':
        this.router.navigate(['/caisse']);
        break;
      case 'STOCK_MANAGER':
        this.router.navigate(['/home']);
        break;
      default:
        this.router.navigate(['/home']);
    }
  }

  // ===================== Post-login redirect =====================
  private postLoginRole: string | null = null;

  private async tryShowRemindersThenRedirect(source: 'LOGIN' | 'SESSION'): Promise<void> {
    // Simplified: just redirect based on role
    const role = this.postLoginRole || this.authService.getCurrentUserRole();
    if (role) {
      await this.redirectBasedOnRole(role);
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
      this.depots = (depots || []).map(d => ({ 
        id: d.id, 
        name: d.name, 
        code: d.code, 
        type: d.type, 
        city: d.city,
        logo: d.company?.logoUrl 
      }));
      const typeSet = new Set<string>();
      this.depots.forEach(d => { if (d.type) typeSet.add(d.type); });
      this.depotTypes = Array.from(typeSet);
    } catch (e) {
      this.depots = [];
    }
  }

  async confirmDepotSelection(): Promise<void> {
    if (!this.selectedDepotId) {
      this.error = 'Veuillez sélectionner un dépôt';
      return;
    }
    // Persist selection for this session and beyond
    sessionStorage.setItem('visitingDepotId', String(this.selectedDepotId));
    sessionStorage.setItem('depotId', String(this.selectedDepotId));
    localStorage.setItem('visitingDepotId', String(this.selectedDepotId));

    // ALWAYS update theme/logo immediately based on selected depot's company
    this.depotsService.get(this.selectedDepotId).subscribe({
      next: (depot: any) => {
        const companyId = depot?.companyId ?? depot?.company?.id;
        if (companyId && Number(companyId) > 0) {
          localStorage.setItem('lastCompanyId', String(companyId));
          this.loginThemeService.setLastCompanyId(Number(companyId));
        } else {
          // Fallback to default if no company linked
          this.loginThemeService.clearLastCompany();
        }
      },
      error: () => {
        // On error, still proceed; theme remains as-is or default
      }
    });
    this.showDepotChoice = false;
    
    // If we have a PIN entered but login failed due to missing depotId, retry login
    if (this.credentials.pin && !this.authService.isAuthenticated()) {
      this.onSubmit();
      return;
    }
    
    // Proceed to redirect
    const role = this.authService.getCurrentUserRole() || 'ADMIN';
    await this.redirectBasedOnRole(role);
  }

  cancelDepotSelection(): void {
    this.showDepotChoice = false;
    // Ensure admin cannot proceed without a depot; log out
    this.authService.logout();
  }

  // UI helpers for depot cards
  getFilteredDepots(): { id: number; name: string; code: string; type?: string; city?: string; logo?: string }[] {
    if (this.activeTypeFilter === 'ALL') return this.depots;
    return this.depots.filter(d => d.type === this.activeTypeFilter);
  }

  handleDepotKeydown(event: KeyboardEvent, depotId: number): void {
    const filtered = this.getFilteredDepots();
    const currentIndex = filtered.findIndex(d => d.id === depotId);
    
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
      event.preventDefault();
      const nextIndex = (currentIndex + 1) % filtered.length;
      this.selectedDepotId = filtered[nextIndex].id;
      // Focus the next element if possible (we'd need a way to target it, maybe via ID)
      document.getElementById(`depot-card-${this.selectedDepotId}`)?.focus();
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
      event.preventDefault();
      const prevIndex = (currentIndex - 1 + filtered.length) % filtered.length;
      this.selectedDepotId = filtered[prevIndex].id;
      document.getElementById(`depot-card-${this.selectedDepotId}`)?.focus();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      this.selectedDepotId = depotId;
      this.confirmDepotSelection();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.cancelDepotSelection();
    }
  }

  getDepotIcon(type?: string): string {
    switch (type) {
      case 'MAIN': return 'building';
      case 'BRANCH': return 'globe';
      case 'SHOP': return 'store';
      case 'WAREHOUSE': return 'archive';
      default: return 'tag';
    }
  }

  getTypeLabel(type?: string): string {
    switch (type) {
      case 'MAIN': return 'Siège';
      case 'BRANCH': return 'Agence';
      case 'SHOP': return 'Magasin';
      case 'WAREHOUSE': return 'Entrepôt';
      default: return 'Dépôt';
    }
  }

  getFullLogoUrl(logo?: string): string {
    if (!logo) return this.themeLogoUrl;
    if (logo.startsWith('http')) return logo;
    const baseUrl = environment.apiUrl.replace('/api', '');
    // Ensure logo doesn't start with leading slash since baseUrl doesn't end with one after replacement usually
    const path = logo.startsWith('/') ? logo.substring(1) : logo;
    return `${baseUrl}/${path}`;
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
