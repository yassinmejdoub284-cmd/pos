import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AttendanceService } from './attendance.service';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { User, AuthResponse, LoginRequest, UserPermissions } from '../models/user.model';
import { environment } from '../../../environments/environment';

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

  constructor(private http: HttpClient, private attendanceService: AttendanceService) {
    this.loadStoredAuth();
  }

  login(credentials: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.API_URL}/auth/login`, credentials).pipe(
      tap({
        next: (response) => {
          console.log('Login successful, setting auth data');
          this.setAuthData(response);
          // Fire check-in punch after successful login (non-blocking) with a small delay
          // Temporarily disabled to debug spam issue
          // setTimeout(() => {
          //   console.log('Calling punch CHECK_IN after successful login');
          //   this.attendanceService.punch('CHECK_IN').subscribe({ 
          //     next: () => console.log('Punch check-in successful'), 
          //     error: (err) => console.log('Punch check-in failed:', err) 
          //   });
          // }, 100);
        },
        error: (error) => {
          // Don't call punch on login failure
          console.log('Login failed:', error);
        }
      })
    );
  }

  logout(): void {
    // Fire check-out punch before clearing session (best effort)
    // Temporarily disabled to debug spam issue
    // try {
    //   this.attendanceService.punch('CHECK_OUT').subscribe({ 
    //     next: () => {}, 
    //     error: (err) => console.log('Punch check-out failed:', err) 
    //   });
    // } catch {}
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