import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { Client, CreateClientRequest, UpdateClientRequest, ClientsResponse } from '../models/client.model';

@Injectable({
  providedIn: 'root'
})
export class ClientsService {
  private apiUrl = `${environment.apiUrl}/clients`;

  constructor(
    private http: HttpClient
  ) {}

  getClients(page: number = 1, limit: number = 20, search?: string, type?: string, active?: boolean): Observable<ClientsResponse> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('limit', limit.toString());

    if (search) {
      params = params.set('search', search);
    }
    if (type) {
      params = params.set('type', type);
    }
    if (active !== undefined) {
      params = params.set('active', active.toString());
    }

    return this.http.get<ClientsResponse>(this.apiUrl, { params }).pipe(
      catchError((error) => throwError(() => error))
    );
  }

  getClient(id: number): Observable<Client> {
    return this.http.get<Client>(`${this.apiUrl}/${id}`).pipe(
      catchError((error) => throwError(() => error))
    );
  }

  createClient(clientData: CreateClientRequest): Observable<Client> {
    return this.http.post<Client>(this.apiUrl, clientData);
  }

  updateClient(id: number, clientData: UpdateClientRequest): Observable<Client> {
    return this.http.put<Client>(`${this.apiUrl}/${id}`, clientData);
  }

  deleteClient(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/${id}`);
  }

  searchClients(query: string): Observable<{ clients: Client[] }> {
    const params = new HttpParams().set('q', query);
    return this.http.get<{ clients: Client[] }>(`${this.apiUrl}/search/pos`, { params }).pipe(
      catchError((error) => throwError(() => error))
    );
  }

  initClientMaxDebt(id: number): Observable<Client> {
    return this.http.put<Client>(`${this.apiUrl}/${id}/max-debt/init`, {});
  }

  recordDebtPayment(id: number, amount: number, notes?: string): Observable<Client> {
    return this.http.post<Client>(`${this.apiUrl}/${id}/debt/payments`, { amount, notes });
  }
} 