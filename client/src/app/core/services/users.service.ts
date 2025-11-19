import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface User {
  id: number;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'ADMIN' | 'MANAGER' | 'CASHIER' | 'STOCK_MANAGER' | 'EMPLOYEE';
  depotId?: number;
  isActive: boolean;
  lastLogin?: Date;
  createdAt: Date;
  pin?: string;
  token?: string;
}

export interface CreateUserRequest {
  username: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: 'ADMIN' | 'MANAGER' | 'CASHIER' | 'STOCK_MANAGER' | 'EMPLOYEE';
  depotId?: number;
  pin: string;
  token?: string;
  roleKey?: string;
}

export interface UpdateUserRequest {
  firstName?: string;
  lastName?: string;
  role?: 'ADMIN' | 'MANAGER' | 'CASHIER' | 'STOCK_MANAGER' | 'EMPLOYEE';
  depotId?: number;
  isActive?: boolean;
  pin?: string;
  roleKey?: string;
}

export interface UpdatePinRequest {
  pin: string;
}

export interface UpdateTokenRequest {
  token: string;
}

@Injectable({
  providedIn: 'root'
})
export class UsersService {
  private apiUrl = `${environment.apiUrl}/users`;

  constructor(private http: HttpClient) {}

  getUsers(depotIds?: number[]): Observable<User[]> {
    let url = this.apiUrl;
    if (depotIds && depotIds.length > 0) {
      // Send as multiple parameters: ?depotIds=1&depotIds=2&depotIds=3
      const params = depotIds.map(id => `depotIds=${id}`).join('&');
      url = `${url}?${params}`;
    }
    return this.http.get<User[]>(url);
  }

  getUser(id: number): Observable<User> {
    return this.http.get<User>(`${this.apiUrl}/${id}`);
  }

  createUser(user: CreateUserRequest): Observable<{ message: string; userId: number }> {
    return this.http.post<{ message: string; userId: number }>(`${environment.apiUrl}/auth/register`, user);
  }

  updateUser(id: number, user: UpdateUserRequest): Observable<User> {
    return this.http.put<User>(`${this.apiUrl}/${id}`, user);
  }

  updateUserPin(id: number, pinRequest: UpdatePinRequest): Observable<User> {
    return this.http.put<User>(`${this.apiUrl}/${id}/pin`, pinRequest);
  }

  updateUserToken(id: number, tokenRequest: UpdateTokenRequest): Observable<User> {
    return this.http.put<User>(`${this.apiUrl}/${id}/token`, tokenRequest);
  }

  deleteUser(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/${id}`);
  }

  getRoleDisplayName(role: string): string {
    const roleNames: { [key: string]: string } = {
      'ADMIN': 'Administrateur',
      'MANAGER': 'Responsable Magasin',
      'CASHIER': 'Caissier',
      'STOCK_MANAGER': 'Gestionnaire Stock',
      'EMPLOYEE': 'Employé'
    };
    return roleNames[role] || role;
  }

  getRoleColor(role: string): string {
    const roleColors: { [key: string]: string } = {
      'ADMIN': 'bg-red-500',
      'MANAGER': 'bg-blue-500',
      'CASHIER': 'bg-green-500',
      'STOCK_MANAGER': 'bg-purple-500',
      'EMPLOYEE': 'bg-amber-500'
    };
    return roleColors[role] || 'bg-gray-500';
  }
}
