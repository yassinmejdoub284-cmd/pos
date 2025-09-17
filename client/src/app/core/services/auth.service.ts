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