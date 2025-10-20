import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { RemindersService } from '../../core/services/reminders.service';
import { Reminder } from '../../core/models/reminder.model';
import { VoicePlayerComponent } from '../../shared/components/voice-player/voice-player.component';
import { UsersService } from '../../core/services/users.service';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { LoginThemeService } from '../../core/services/login-theme.service';
import { DepotsService } from '../../core/services/depots.service';
import { NotificationsService } from '../../core/services/notifications.service';

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
    private usersService: UsersService,
    private depotsService: DepotsService,
    private remindersService: RemindersService,
    private notificationsService: NotificationsService
  ) {}

  ngOnInit(): void {
    // Set theme based on URL/port and update favicon for login screen
    this.loginThemeService.detectAndSetTheme();
    this.loginThemeService.applyFaviconForLogin();

    // Redirect if already authenticated
    if (this.authService.isAuthenticated()) {
      // Session restore: show due reminders if any
      this.tryShowRemindersThenRedirect('SESSION');
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
        console.log('Login successful, response:', response);
        this.loading = false;
        
        // Force PIN change if entered PIN starts with '00'
        if (!isToken && this.credentials.pin.startsWith('00')) {
          console.log('PIN change required');
          // Keep token temporarily for PIN update, will logout after successful change
          this.currentUser = response.user;
          this.showPasswordChange = true;
          return;
        }
        
        // After successful login, check reminders and notifications first
        console.log('Calling tryShowRemindersThenRedirect with role:', response.user.role);
        this.postLoginRole = response.user.role;
        await this.tryShowRemindersThenRedirect('LOGIN');
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

  // ===================== Rappels (Surface post-login) =====================
  showReminderSurface = false;
  currentReminder: Reminder | null = null;
  reminderQueue: Reminder[] = [];
  showSnoozeMenu = false;
  snoozedUntilText = '';
  showNotificationSurface = false;
  notifications: any[] = [];
  private postLoginRole: string | null = null;

  private async tryShowRemindersThenRedirect(source: 'LOGIN' | 'SESSION'): Promise<void> {
    console.log('tryShowRemindersThenRedirect called, source:', source);
    // Fetch both reminders and notifications
    this.remindersService.fetchDue().subscribe({
      next: async (list) => {
        console.log('Reminders fetched:', list);
        const due = (list || []).slice(0, 3);
        if (due.length === 0) {
          // No reminders: fetch notifications and redirect
          console.log('No reminders found, fetching notifications...');
          await this.fetchNotificationsAndRedirect();
          return;
        }
        console.log('Found', due.length, 'reminders, showing reminder surface');
        this.reminderQueue = [...due];
        this.currentReminder = this.reminderQueue.shift() || null;
        this.showReminderSurface = !!this.currentReminder;
      },
      error: async (error) => {
        console.error('Error fetching reminders:', error);
        // On error, fetch notifications and proceed
        await this.fetchNotificationsAndRedirect();
      }
    });
  }

  private async fetchNotificationsAndRedirect(): Promise<void> {
    console.log('fetchNotificationsAndRedirect called, postLoginRole:', this.postLoginRole);
    // Fetch notifications after login
    this.notificationsService.updateUnreadCount();
    
    // Log notifications for debugging and show them if they exist
    this.notificationsService.fetchUnread().subscribe({
      next: async (notifications) => {
        console.log('Notifications fetched on login:', notifications);
        if (notifications.length > 0) {
          console.log('Found', notifications.length, 'unread notifications, showing notification surface');
          this.notifications = notifications;
          this.showNotificationSurface = true;
          // Don't redirect immediately if there are notifications to show
          return;
        }
        console.log('No notifications found, redirecting to role:', this.postLoginRole || this.authService.getCurrentUserRole() || 'HOME');
        // No notifications, proceed with redirect
        await this.redirectBasedOnRole(this.postLoginRole || this.authService.getCurrentUserRole() || 'HOME');
      },
      error: async (error) => {
        console.error('Error fetching notifications on login:', error);
        // On error, proceed with redirect
        await this.redirectBasedOnRole(this.postLoginRole || this.authService.getCurrentUserRole() || 'HOME');
      }
    });
  }

  onMarkRead(): void {
    if (!this.currentReminder) return;
    const id = this.currentReminder.id;
    this.remindersService.markRead(id).subscribe({
      next: () => {
        // Toast could be global; keep minimal UX
        // Advance to next or redirect
        this.advanceReminderQueue();
      },
      error: () => {
        this.advanceReminderQueue();
      }
    });
  }

  toggleSnoozeMenu(): void { this.showSnoozeMenu = !this.showSnoozeMenu; }

  onSnooze(minutes: number): void {
    if (!this.currentReminder) return;
    this.showSnoozeMenu = false;
    this.snoozedUntilText = '';
    this.remindersService.snooze(this.currentReminder.id, minutes, false).subscribe({
      next: () => {
        // Feedback text not strictly needed on surface after snooze; continue
        this.advanceReminderQueue();
      },
      error: () => this.advanceReminderQueue()
    });
  }

  onSnoozeDemain(): void {
    if (!this.currentReminder) return;
    this.showSnoozeMenu = false;
    this.snoozedUntilText = '08:30';
    this.remindersService.snooze(this.currentReminder.id, undefined, true).subscribe({
      next: () => this.advanceReminderQueue(),
      error: () => this.advanceReminderQueue()
    });
  }

  onVoicePlaybackComplete(): void {
    // Optional: Auto-mark as read after voice playback
    // this.onMarkRead();
  }

  private advanceReminderQueue(): void {
    if (this.reminderQueue.length > 0) {
      this.currentReminder = this.reminderQueue.shift() || null;
      this.snoozedUntilText = '';
      this.showReminderSurface = !!this.currentReminder;
      return;
    }
    this.currentReminder = null;
    this.showReminderSurface = false;
    
    // For admin users, don't automatically redirect - let them handle notifications first
    // The depot selection will happen when they try to access the main app
    if (this.postLoginRole === 'ADMIN') {
      console.log('Admin user finished reminders, proceeding to notifications without auto-redirect');
    }
    
    this.fetchNotificationsAndRedirect();
  }

  formatDue(dueAt?: string): string {
    if (!dueAt) return '';
    const d = new Date(dueAt);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return isToday ? `aujourd’hui à ${hh}:${mm}` : `${d.toLocaleDateString()} ${hh}:${mm}`;
    }

  isOverdue(dueAt?: string): boolean {
    return !!dueAt && new Date(dueAt).getTime() < Date.now();
  }

  formatPriority(p?: string): string {
    switch (p) {
      case 'ELEVEE': return 'Élevée';
      case 'FAIBLE': return 'Faible';
      default: return 'Normal';
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

  async confirmDepotSelection(): Promise<void> {
    if (!this.selectedDepotId) {
      this.error = 'Veuillez sélectionner un dépôt';
      return;
    }
    // Persist selection for this session and beyond
    sessionStorage.setItem('visitingDepotId', String(this.selectedDepotId));
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

  // Notification methods
  formatNotificationDate(createdAt: string): string {
    const date = new Date(createdAt);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.round(diffMs / (1000 * 60));
    
    if (diffMins < 1) return 'À l\'instant';
    if (diffMins < 60) return `Il y a ${diffMins} min`;
    const diffHours = Math.round(diffMins / 60);
    if (diffHours < 24) return `Il y a ${diffHours}h`;
    const diffDays = Math.round(diffHours / 24);
    if (diffDays < 7) return `Il y a ${diffDays}j`;
    
    return date.toLocaleDateString('fr-FR', { 
      day: 'numeric', 
      month: 'short', 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  }

  markNotificationAsRead(notificationId: number): void {
    this.notificationsService.markAsRead(notificationId).subscribe({
      next: () => {
        // Remove from local list
        this.notifications = this.notifications.filter(n => n.id !== notificationId);
        if (this.notifications.length === 0) {
          this.dismissNotifications();
        }
      },
      error: (error) => {
        console.error('Error marking notification as read:', error);
      }
    });
  }

  markAllNotificationsAsRead(): void {
    console.log('markAllNotificationsAsRead called - user explicitly marked all as read');
    this.notificationsService.markAllAsRead().subscribe({
      next: () => {
        console.log('Successfully marked all notifications as read');
        this.notifications = [];
        this.dismissNotifications();
      },
      error: (error) => {
        console.error('Error marking all notifications as read:', error);
      }
    });
  }

  async dismissNotifications(): Promise<void> {
    console.log('dismissNotifications called, postLoginRole:', this.postLoginRole);
    console.log('NOT marking notifications as read - just dismissing the surface');
    this.showNotificationSurface = false;
    this.notifications = [];
    await this.redirectBasedOnRole(this.postLoginRole || this.authService.getCurrentUserRole() || 'HOME');
  }
}
