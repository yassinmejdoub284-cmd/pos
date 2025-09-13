import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { BaseApiService } from './base-api.service';
import { map } from 'rxjs/operators';
import { AuthService } from './auth.service';

export interface ExpenseCategory {
  id: number;
  name: string;
  description: string;
  color: string;
  icon: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Expense {
  id: number;
  amount: number;
  description?: string;
  categoryId: number;
  supplierId?: number;
  depotId: number;
  userId: number;
  date: string;
  paymentType: PaymentType;
  collectionDate: string;
  receiptUrl?: string;
  notes?: string;
  isApproved: boolean;
  isPaid: boolean;
  isAdvance: boolean;
  approvedBy?: number;
  approvedAt?: string;
  createdAt: string;
  updatedAt: string;
  category?: ExpenseCategory;
  depot?: any;
  user?: any;
  supplier?: any;
  approver?: any;
}

export type PaymentType = 'CASH' | 'CHECK' | 'BANK_TRANSFER' | 'WIRE_TRANSFER';

export interface ExpenseStats {
  total: {
    amount: number;
    count: number;
  };
  approved: {
    amount: number;
    count: number;
  };
  pending: {
    amount: number;
    count: number;
  };
  byCategory: Array<{
    categoryId: number;
    categoryName: string;
    categoryColor: string;
    categoryIcon: string;
    totalAmount: number;
    count: number;
  }>;
}

@Injectable({
  providedIn: 'root'
})
export class ExpenseService extends BaseApiService {
  private expensesUrl = `${this.apiUrl}/expenses`;

  constructor(http: HttpClient, authService: AuthService) {
    super(http, authService);
  }

  getCategories(): Observable<ExpenseCategory[]> {
    return this.http.get<ExpenseCategory[]>(`${this.expensesUrl}/categories`, this.getRequestOptions());
  }

  createCategory(category: Partial<ExpenseCategory>): Observable<ExpenseCategory> {
    return this.http.post<ExpenseCategory>(`${this.expensesUrl}/categories`, category, this.getRequestOptions());
  }

  updateCategory(id: number, category: Partial<ExpenseCategory>): Observable<ExpenseCategory> {
    return this.http.put<ExpenseCategory>(`${this.expensesUrl}/categories/${id}`, category, this.getRequestOptions());
  }

  deleteCategory(id: number): Observable<void> {
    return this.http.delete<void>(`${this.expensesUrl}/categories/${id}`, this.getRequestOptions());
  }

  getExpenses(filters?: any): Observable<Expense[]> {
    const params = filters ? { params: filters } : {};
    const options = { ...this.getRequestOptions(), ...params };
    return this.http.get<any>(`${this.expensesUrl}`, options).pipe(
      map(response => response.expenses || response)
    );
  }

  getExpense(id: number): Observable<Expense> {
    return this.http.get<Expense>(`${this.expensesUrl}/${id}`, this.getRequestOptions());
  }

  createExpense(expense: Partial<Expense>): Observable<Expense> {
    return this.http.post<Expense>(`${this.expensesUrl}`, expense, this.getRequestOptions());
  }

  updateExpense(id: number, expense: Partial<Expense>): Observable<Expense> {
    return this.http.put<Expense>(`${this.expensesUrl}/${id}`, expense, this.getRequestOptions());
  }

  approveExpense(id: number, isApproved: boolean): Observable<Expense> {
    return this.http.patch<Expense>(`${this.expensesUrl}/${id}/approve`, { isApproved }, this.getRequestOptions());
  }

  deleteExpense(id: number): Observable<void> {
    return this.http.delete<void>(`${this.expensesUrl}/${id}`, this.getRequestOptions());
  }

  getStats(filters?: any): Observable<ExpenseStats> {
    const params = filters ? { params: filters } : {};
    const options = { ...this.getRequestOptions(), ...params };
    return this.http.get<ExpenseStats>(`${this.expensesUrl}/stats/summary`, options);
  }
} 