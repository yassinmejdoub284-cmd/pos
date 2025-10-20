import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AttendanceService } from './attendance.service';
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
  private punchInProgress = false;
  
  public currentUser$ = this.currentUserSubject.asObservable();
  public permissions$ = this.permissionsSubject.asObservable();
  
  public isAuthenticated = signal(false);
  public currentUser = signal<User | null>(null);

  constructor(private http: HttpClient, private attendanceService: AttendanceService, private depotsService: DepotsService, private loginThemeService: LoginThemeService) {
    this.loadStoredAuth();
  }

  login(credentials: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.API_URL}/auth/login`, credentials).pipe(
      tap({
        next: (response) => {
          console.log('Login successful, setting auth data');
          this.setAuthData(response);
          
          // Only handle attendance and company theme for patisserie users
          if (response.user.userType !== 'enterprise') {
            // After setting auth, resolve and store last company for login theme
            this.resolveAndStoreCompanyForTheme(response.user);
            // Fire check-in punch after successful login (non-blocking) with a small delay
            setTimeout(() => {
              if (!this.punchInProgress) {
                this.punchInProgress = true;
                console.log('Calling punch CHECK_IN after successful login');
                this.attendanceService.punch('CHECK_IN', response.user.id).subscribe({ 
                  next: () => {
                    console.log('Punch check-in successful');
                    this.punchInProgress = false;
                  }, 
                  error: (err) => {
                    console.log('Punch check-in failed:', err);
                    this.punchInProgress = false;
                    // Don't retry on 401 - likely auth issue
                    if (err.status !== 401) {
                      console.log('Retrying punch in 2 seconds...');
                      setTimeout(() => {
                        if (!this.punchInProgress) {
                          this.punchInProgress = true;
                          this.attendanceService.punch('CHECK_IN', response.user.id).subscribe({
                            next: () => {
                              console.log('Punch check-in retry successful');
                              this.punchInProgress = false;
                            },
                            error: (retryErr) => {
                              console.log('Punch check-in retry failed:', retryErr);
                              this.punchInProgress = false;
                            }
                          });
                        }
                      }, 2000);
                    }
                  }
                });
              }
            }, 100);
          } else {
            console.log('Enterprise user login - skipping attendance punch');
          }
        },
        error: (error) => {
          // Don't call punch on login failure
          console.log('Login failed:', error);
        }
      })
    );
  }

  logout(): void {
    // Fire check-out punch before clearing session (best effort) - only for patisserie users
    const currentUser = this.currentUser();
    if (!this.punchInProgress && currentUser?.userType !== 'enterprise') {
      this.punchInProgress = true;
      try {
        this.attendanceService.punch('CHECK_OUT', currentUser?.id).subscribe({ 
          next: () => {
            console.log('Punch check-out successful');
            this.punchInProgress = false;
          }, 
          error: (err) => {
            console.log('Punch check-out failed:', err);
            this.punchInProgress = false;
          }
        });
      } catch (error) {
        console.log('Error calling punch on logout:', error);
        this.punchInProgress = false;
      }
    } else if (currentUser?.userType === 'enterprise') {
      console.log('Enterprise user logout - skipping attendance punch');
    }
    
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
      const user = JSON.parse(userStr);
      const permissions = JSON.parse(permissionsStr);
      
      this.currentUserSubject.next(user);
      this.permissionsSubject.next(permissions);
      this.isAuthenticated.set(true);
      this.currentUser.set(user);
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
} 