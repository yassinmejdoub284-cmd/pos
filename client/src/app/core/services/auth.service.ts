import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { User, AuthResponse, LoginRequest, UserPermissions } from '../models/user.model';
import { environment } from '../../../environments/environment';
import { DepotsService } from './depots.service';
import { LoginThemeService } from './login-theme.service';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly API_URL = `${environment.apiUrl}`;
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  private permissionsSubject = new BehaviorSubject<UserPermissions | null>(null);
  
  public currentUser$ = this.currentUserSubject.asObservable();
  public permissions$ = this.permissionsSubject.asObservable();
  
  public isAuthenticated = signal(false);
  public currentUser = signal<User | null>(null);

  constructor(private http: HttpClient, private depotsService: DepotsService, private loginThemeService: LoginThemeService) {
    // Load auth state immediately on service initialization
    this.loadStoredAuth();
    
    // Also ensure token is set if available (double-check for reliability)
    const token = this.getToken();
    if (token && !this.isAuthenticated()) {
      const userStr = sessionStorage.getItem('user');
      if (userStr) {
        try {
          const user = JSON.parse(userStr);
          this.currentUser.set(user);
          this.isAuthenticated.set(true);
        } catch (error) {
          // If parsing fails, loadStoredAuth will handle it
        }
      }
    }
  }

  login(credentials: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.API_URL}/auth/login`, credentials).pipe(
      tap({
        next: (response) => {
          this.setAuthData(response);
          
          // After setting auth, resolve and store last company for login theme
          this.resolveAndStoreCompanyForTheme(response.user);
        },
        error: (error) => {
        }
      })
    );
  }

  logout(): void {
    this.clearSession();
  }

  private clearSession(): void {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    sessionStorage.removeItem('permissions');
    sessionStorage.removeItem('visitingDepotId');
    this.currentUserSubject.next(null);
    this.permissionsSubject.next(null);
    this.isAuthenticated.set(false);
    this.currentUser.set(null);
  }

  getToken(): string | null {
    return sessionStorage.getItem('token');
  }

  private setAuthData(response: AuthResponse): void {
    sessionStorage.setItem('token', response.token);
    sessionStorage.setItem('user', JSON.stringify(response.user));
    sessionStorage.setItem('permissions', JSON.stringify(response.permissions));
    // Preserve any preselected visitingDepotId if already set (e.g., from login flow)
    
    this.currentUserSubject.next(response.user);
    this.permissionsSubject.next(response.permissions);
    this.isAuthenticated.set(true);
    this.currentUser.set(response.user);
  }

  private resolveAndStoreCompanyForTheme(user: User): void {
    // Prefer an explicitly chosen depot during login if present
    // Read selected depot from session or local storage (admin selection from login)
    const visitingDepotIdStr = sessionStorage.getItem('visitingDepotId') || localStorage.getItem('visitingDepotId');
    const visitingDepotId = visitingDepotIdStr ? Number(visitingDepotIdStr) : undefined;
    const effectiveDepotId = visitingDepotId || user.depotId;
    
    // If no depot ID is available, try to use user's companyId directly
    if (!effectiveDepotId) {
      if (user.companyId && Number(user.companyId) > 0) {
        this.setCompanyTheme(Number(user.companyId), user.companyName || 'Entreprise');
        return;
      } else {
        return;
      }
    }

    this.depotsService.get(effectiveDepotId).subscribe({
      next: (depot: any) => {
        const companyId = depot?.companyId ?? depot?.company?.id;
        if (companyId && Number(companyId) > 0) {
          const companyName = depot?.company?.raisonSociale || depot?.companyName || user.companyName || 'Entreprise';
          this.setCompanyTheme(Number(companyId), companyName);
        } else {
          // Fallback to user's companyId if depot doesn't have company info
          if (user.companyId && Number(user.companyId) > 0) {
            this.setCompanyTheme(Number(user.companyId), user.companyName || 'Entreprise');
          }
        }
      },
      error: (error) => {
        // Fallback to user's companyId if depot lookup fails
        if (user.companyId && Number(user.companyId) > 0) {
          this.setCompanyTheme(Number(user.companyId), user.companyName || 'Entreprise');
        }
      }
    });
  }

  private setCompanyTheme(companyId: number, companyName: string): void {
    const previousCompanyId = Number(localStorage.getItem('lastCompanyId') || '');
    const newCompanyId = Number(companyId);

    // If company changed, set a one-time switch info message for UI
    if (!Number.isNaN(previousCompanyId) && previousCompanyId !== newCompanyId) {
      const switchInfo = {
        companyId: newCompanyId,
        companyName: companyName,
        logoUrl: null // We don't have logo URL from user data, will use theme mapping
      };
      sessionStorage.setItem('companySwitchInfo', JSON.stringify(switchInfo));
    }

    localStorage.setItem('lastCompanyId', String(newCompanyId));
    this.loginThemeService.setLastCompanyId(newCompanyId);
  }

  private loadStoredAuth(): void {
    const token = sessionStorage.getItem('token');
    const userStr = sessionStorage.getItem('user');
    const permissionsStr = sessionStorage.getItem('permissions');

    if (token && userStr && permissionsStr) {
      try {
        const user = JSON.parse(userStr);
        const permissions = JSON.parse(permissionsStr);
        
        this.currentUserSubject.next(user);
        this.permissionsSubject.next(permissions);
        this.isAuthenticated.set(true);
        this.currentUser.set(user);
      } catch (error) {
        // If parsing fails, clear corrupted data
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('user');
        sessionStorage.removeItem('permissions');
      }
    }
  }


  // Get current user role
  getCurrentUserRole(): string | null {
    const user = this.currentUser();
    return user ? user.role : null;
  }

  // Check if current user is admin
  isAdmin(): boolean {
    return this.getCurrentUserRole() === 'ADMIN';
  }

  // Check if current user is super admin (roleKey === '9' or 'SUPER_ADMIN')
  isSuperAdmin(): boolean {
    const user = this.currentUser();
    if (!user) return false;
    const roleKey = (user as any).roleKey;
    return roleKey === '9' || roleKey === 'SUPER_ADMIN';
  }
} 