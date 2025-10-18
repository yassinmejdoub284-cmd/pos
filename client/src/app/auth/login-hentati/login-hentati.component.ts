import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { UsersService } from '../../core/services/users.service';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { DepotsService } from '../../core/services/depots.service';

@Component({
  selector: 'app-login-hentati',
  templateUrl: './login-hentati.component.html',
  standalone: false
})
export class LoginHentatiComponent implements OnInit, OnDestroy {
  credentials: { username: string; password: string } = {
    username: '',
    password: ''
  };
  
  loading = false;
  error = '';
  showPassword = false;
  
  // Splash control
  showSplash = true;

  depots: { id: number; name: string; code: string; type?: string; city?: string }[] = [];
  showDepotChoice = false;
  selectedDepotId: number | null = null;
  depotTypes: string[] = [];
  activeTypeFilter: string | 'ALL' = 'ALL';

  // Billing Software theme colors and branding
  readonly BILLING_THEME = {
    logoUrl: '/logo_billing.svg', // Billing software logo
    primaryColor: '#1e40af', // Professional blue
    secondaryColor: '#3b82f6', // Light blue
    accentColor: '#60a5fa', // Lighter blue
    backgroundColor: '#f8fafc', // Light gray
    darkColor: '#1e293b', // Dark slate
    successColor: '#10b981', // Green
    warningColor: '#f59e0b', // Amber
    faviconUrl: '/favicon.ico'
  };

  constructor(
    private authService: AuthService,
    private router: Router,
    private http: HttpClient,
    private usersService: UsersService,
    private depotsService: DepotsService
  ) {}

  ngOnInit(): void {
    // Apply billing theme favicon
    this.applyBillingFavicon();

    // Redirect if already authenticated
    if (this.authService.isAuthenticated()) {
      // Session restore: redirect directly based on role
      const role = this.authService.getCurrentUserRole() || 'HOME';
      this.redirectBasedOnRole(role);
      return;
    }

    // Splash for a short time then reveal login
    setTimeout(() => {
      this.showSplash = false;
    }, 1000);
  }

  ngOnDestroy(): void {
    this.restoreOriginalFavicon();
  }

  // Theme getters for template bindings
  get themeLogoUrl(): string { return this.BILLING_THEME.logoUrl; }
  get primaryColor(): string { return this.BILLING_THEME.primaryColor; }
  get secondaryColor(): string { return this.BILLING_THEME.secondaryColor; }
  get accentColor(): string { return this.BILLING_THEME.accentColor; }
  get backgroundColor(): string { return this.BILLING_THEME.backgroundColor; }
  get darkColor(): string { return this.BILLING_THEME.darkColor; }
  get successColor(): string { return this.BILLING_THEME.successColor; }
  get warningColor(): string { return this.BILLING_THEME.warningColor; }

  private applyBillingFavicon(): void {
    const head = document.head;
    const linkEl = head.querySelector<HTMLLinkElement>("link[rel='icon']") || document.createElement('link');
    if (!linkEl.getAttribute('rel')) {
      linkEl.setAttribute('rel', 'icon');
      head.appendChild(linkEl);
    }
    linkEl.setAttribute('href', this.BILLING_THEME.faviconUrl);
  }

  private restoreOriginalFavicon(): void {
    const head = document.head;
    const linkEl = head.querySelector<HTMLLinkElement>("link[rel='icon']");
    if (linkEl) {
      linkEl.setAttribute('href', '/favicon.ico');
    }
  }

  onSubmit(): void {
    if (!this.credentials.username || !this.credentials.password) {
      this.error = 'Veuillez saisir votre nom d\'utilisateur et mot de passe';
      return;
    }

    this.loading = true;
    this.error = '';

    // Use username/password for login
    this.authService.login(this.credentials).subscribe({
      next: async (response) => {
        console.log('Login successful, response:', response);
        this.loading = false;
        
        // After successful login, redirect directly based on role
        console.log('Login successful, redirecting based on role:', response.user.role);
        this.postLoginRole = response.user.role;
        await this.redirectBasedOnRole(response.user.role);
      },
      error: (error) => {
        console.error('Login error:', error);
        this.loading = false;
        this.error = error.error?.error || 'Nom d\'utilisateur ou mot de passe invalide';
      }
    });
  }

  private async redirectBasedOnRole(role: string): Promise<void> {
    console.log('Redirecting user with role:', role);
    
    // For admin users, check depot selection first
    if (role === 'ADMIN') {
      console.log('Admin user, checking depot selection before redirect');
      const existingDepotId = sessionStorage.getItem('visitingDepotId');
      if (!existingDepotId) {
        console.log('No depot selected, showing depot choice');
        this.showDepotChoice = true;
        await this.loadDepots();
        console.log('Depot choice dialog should be visible now, showDepotChoice:', this.showDepotChoice);
        console.log('Depots loaded:', this.depots.length);
        return; // Don't redirect yet, wait for depot selection
      } else {
        console.log('Depot already selected:', existingDepotId);
        console.log('Admin with existing depot, proceeding to redirect to home');
      }
    }
    
    switch (role) {
      case 'ENTERPRISE_USER':
        this.router.navigate(['/enterprise/home']);
        break;
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
        // No automatic redirect to /stock; go to Home and let access config drive modules
        this.router.navigate(['/home']);
        break;
      default:
        this.router.navigate(['/home']);
    }
  }

  private postLoginRole: string | null = null;




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

  async confirmDepotSelection(): Promise<void> {
    if (!this.selectedDepotId) {
      this.error = 'Veuillez sélectionner un dépôt';
      return;
    }
    // Persist selection for this session and beyond
    sessionStorage.setItem('visitingDepotId', String(this.selectedDepotId));
    localStorage.setItem('visitingDepotId', String(this.selectedDepotId));

    this.showDepotChoice = false;
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

}