import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface Salon {
  id: number;
  name: string;
  maxTables: number;
  location?: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  tables?: Table[];
}

export interface Table {
  id: number;
  name: string;
  number: string;
  color: string;
  salonId: number;
  notes?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  salon?: Salon;
}

@Injectable({
  providedIn: 'root'
})
export class SalonService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  // Salon methods
  getSalons(): Observable<Salon[]> {
    return this.http.get<Salon[]>(`${this.apiUrl}/salons`);
  }

  getSalon(id: number): Observable<Salon> {
    return this.http.get<Salon>(`${this.apiUrl}/salons/${id}`);
  }

  createSalon(salon: Partial<Salon>): Observable<Salon> {
    return this.http.post<Salon>(`${this.apiUrl}/salons`, salon);
  }

  updateSalon(id: number, salon: Partial<Salon>): Observable<Salon> {
    return this.http.put<Salon>(`${this.apiUrl}/salons/${id}`, salon);
  }

  deleteSalon(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/salons/${id}`);
  }

  // Table methods
  getTables(): Observable<Table[]> {
    return this.http.get<Table[]>(`${this.apiUrl}/tables`);
  }

  getTablesBySalon(salonId: number): Observable<Table[]> {
    return this.http.get<Table[]>(`${this.apiUrl}/tables/salon/${salonId}`);
  }

  getTable(id: number): Observable<Table> {
    return this.http.get<Table>(`${this.apiUrl}/tables/${id}`);
  }

  createTable(table: Partial<Table>): Observable<Table> {
    return this.http.post<Table>(`${this.apiUrl}/tables`, table);
  }

  updateTable(id: number, table: Partial<Table>): Observable<Table> {
    return this.http.put<Table>(`${this.apiUrl}/tables/${id}`, table);
  }


  deleteTable(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/tables/${id}`);
  }
}
