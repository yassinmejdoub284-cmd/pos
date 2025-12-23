import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface DepotStats {
  id: number;
  name: string;
  code: string;
  soldeCaisse: number;
  expenses: {
    today: number;
    month: number;
    year: number;
  };
}

export interface BestClient {
  id: number;
  name: string;
  code: string;
  totalSpent: number;
  orderCount: number;
}

export interface BestProduct {
  id: number;
  name: string;
  photo: string | null;
  quantitySold: number;
  totalRevenue: number;
  saleCount: number;
}

export interface AdminDashboardStats {
  depots: DepotStats[];
  statistics: {
    totalClients: number;
    totalSuppliers: number;
    totalClientCredit: number;
    totalSupplierCredit: number;
    bestClients: BestClient[];
    bestProducts: BestProduct[];
    sales: {
      today: { revenue: number; transactions: number };
      month: { revenue: number; transactions: number };
      year: { revenue: number; transactions: number };
    };
    expenses: {
      today: number;
      month: number;
      year: number;
    };
  };
}

@Injectable({
  providedIn: 'root'
})
export class AdminDashboardService {
  private apiUrl = `${environment.apiUrl}/admin-dashboard`;

  constructor(private http: HttpClient) {}

  getStats(): Observable<AdminDashboardStats> {
    return this.http.get<AdminDashboardStats>(`${this.apiUrl}/stats`);
  }
}

