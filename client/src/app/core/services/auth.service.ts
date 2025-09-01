import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
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

  constructor(private http: HttpClient) {
    this.loadStoredAuth();
  }

  login(credentials: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.API_URL}/auth/login`, credentials).pipe(
      tap(response => this.setAuthData(response))
    );
  }

  logout(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('permissions');
    this.currentUserSubject.next(null);
    this.permissionsSubject.next(null);
    this.isAuthenticated.set(false);
    this.currentUser.set(null);
  }

  getToken(): string | null {
    return localStorage.getItem('token');
  }

  private setAuthData(response: AuthResponse): void {
    localStorage.setItem('token', response.token);
    localStorage.setItem('user', JSON.stringify(response.user));
    localStorage.setItem('permissions', JSON.stringify(response.permissions));
    
    this.currentUserSubject.next(response.user);
    this.permissionsSubject.next(response.permissions);
    this.isAuthenticated.set(true);
    this.currentUser.set(response.user);
  }

  private loadStoredAuth(): void {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    const permissionsStr = localStorage.getItem('permissions');

    if (token && userStr && permissionsStr) {
      const user = JSON.parse(userStr);
      const permissions = JSON.parse(permissionsStr);
      
      this.currentUserSubject.next(user);
      this.permissionsSubject.next(permissions);
      this.isAuthenticated.set(true);
      this.currentUser.set(user);
    } else if (!environment.production) {
      // In development, always set up persistent auth
      this.setupMockUser();
    }
  }

  private setupMockUser(): void {
    const mockUser: User = {
      id: 1,
      username: 'admin',
      email: 'admin@patisserie.com',
      firstName: 'Admin',
      lastName: 'User',
      role: 'ADMIN',
      depotId: 1, // This should match the first depot in the database
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const mockPermissions: UserPermissions = {
      canManageUsers: true,
      canManageProducts: true,
      canManageStock: true,
      canApproveTransfers: true,
      canViewReports: true,
      canManageSettings: true,
      canProcessSales: true,
      canViewHistory: true
    };

    // Create a persistent token for development that won't expire
    const mockToken = 'mock-jwt-token-ADMIN-DEV-PERSISTENT';

    localStorage.setItem('token', mockToken);
    localStorage.setItem('user', JSON.stringify(mockUser));
    localStorage.setItem('permissions', JSON.stringify(mockPermissions));
    
    this.currentUserSubject.next(mockUser);
    this.permissionsSubject.next(mockPermissions);
    this.isAuthenticated.set(true);
    this.currentUser.set(mockUser);
  }

  setupMockUserForRole(role: 'ADMIN' | 'MANAGER' | 'CASHIER' | 'STOCK_MANAGER'): void {
    const mockUser: User = {
      id: 1,
      username: role.toLowerCase(),
      email: `${role.toLowerCase()}@patisserie.com`,
      firstName: role.charAt(0) + role.slice(1).toLowerCase(),
      lastName: 'User',
      role: role,
      depotId: 1, // This should match the first depot in the database
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const mockPermissions: UserPermissions = {
      canManageUsers: role === 'ADMIN',
      canManageProducts: ['ADMIN', 'MANAGER'].includes(role),
      canManageStock: ['ADMIN', 'MANAGER', 'STOCK_MANAGER'].includes(role),
      canApproveTransfers: ['ADMIN', 'MANAGER'].includes(role),
      canViewReports: ['ADMIN', 'MANAGER'].includes(role),
      canManageSettings: role === 'ADMIN',
      canProcessSales: ['ADMIN', 'MANAGER', 'CASHIER'].includes(role),
      canViewHistory: ['ADMIN', 'MANAGER'].includes(role)
    };

    const now = new Date();
    const timestamp = now.getFullYear() + 
      String(now.getMonth() + 1).padStart(2, '0') + 
      String(now.getDate()).padStart(2, '0') + 
      String(now.getHours()).padStart(2, '0') + 
      String(now.getMinutes()).padStart(2, '0') + 
      String(now.getSeconds()).padStart(2, '0') + 
      String(now.getMilliseconds()).padStart(3, '0');
    
    const mockToken = `mock-jwt-token-${role}-${timestamp}`;

    localStorage.setItem('token', mockToken);
    localStorage.setItem('user', JSON.stringify(mockUser));
    localStorage.setItem('permissions', JSON.stringify(mockPermissions));
    
    this.currentUserSubject.next(mockUser);
    this.permissionsSubject.next(mockPermissions);
    this.isAuthenticated.set(true);
    this.currentUser.set(mockUser);
  }

  clearMockUser(): void {
    this.logout();
  }
} 