import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { Supplier } from '../models/supplier.model';

@Injectable({
  providedIn: 'root'
})
export class SuppliersService {
  private apiUrl = `${environment.apiUrl}/suppliers`;

  constructor(private http: HttpClient) {}

  list(): Observable<Supplier[]> {
    return this.http.get<Supplier[]>(this.apiUrl).pipe(
      catchError((error) => throwError(() => error))
    );
  }

  get(id: number): Observable<Supplier> {
    return this.http.get<Supplier>(`${this.apiUrl}/${id}`).pipe(
      catchError((error) => throwError(() => error))
    );
  }

  create(supplier: Partial<Supplier>): Observable<Supplier> {
    return this.http.post<Supplier>(this.apiUrl, supplier).pipe(
      catchError((error) => throwError(() => error))
    );
  }

  update(id: number, supplier: Partial<Supplier>): Observable<Supplier> {
    return this.http.put<Supplier>(`${this.apiUrl}/${id}`, supplier).pipe(
      catchError((error) => throwError(() => error))
    );
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`).pipe(
      catchError((error) => throwError(() => error))
    );
  }
}
