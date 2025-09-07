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
  role: 'ADMIN' | 'MANAGER' | 'CASHIER' | 'STOCK_MANAGER';
  depotId?: number;
  isActive: boolean;
  lastLogin?: Date;
  createdAt: Date;
  pin?: string;
}

export interface CreateUserRequest {
  username: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: 'ADMIN' | 'MANAGER' | 'CASHIER' | 'STOCK_MANAGER';
  depotId?: number;
  pin: string;
}

export interface UpdateUserRequest {
  firstName?: string;
  lastName?: string;
  role?: 'ADMIN' | 'MANAGER' | 'CASHIER' | 'STOCK_MANAGER';
  depotId?: number;
  isActive?: boolean;
  pin?: string;
}

export interface UpdatePinRequest {
  pin: string;
}

@Injectable({
  providedIn: 'root'
})
export class UsersService {
  private apiUrl = `${environment.apiUrl}/users`;

  constructor(private http: HttpClient) {}

  getUsers(): Observable<User[]> {
    return this.http.get<User[]>(this.apiUrl);
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

  deleteUser(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/${id}`);
  }

  getRoleDisplayName(role: string): string {
    const roleNames: { [key: string]: string } = {
      'ADMIN': 'Administrateur',
      'MANAGER': 'Responsable Magasin',
      'CASHIER': 'Caissier',
      'STOCK_MANAGER': 'Gestionnaire Stock'
    };
    return roleNames[role] || role;
  }

  getRoleColor(role: string): string {
    const roleColors: { [key: string]: string } = {
      'ADMIN': 'bg-red-500',
      'MANAGER': 'bg-blue-500',
      'CASHIER': 'bg-green-500',
      'STOCK_MANAGER': 'bg-purple-500'
    };
    return roleColors[role] || 'bg-gray-500';
  }
}
