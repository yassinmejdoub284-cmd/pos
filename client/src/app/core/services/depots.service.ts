import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { Depot } from '../models/depot.model';

@Injectable({ providedIn: 'root' })
export class DepotsService {
  private apiUrl = `${environment.apiUrl}/depots`;

  constructor(
    private http: HttpClient
  ) {}

  list(): Observable<Depot[]> {
    return this.http.get<Depot[]>(this.apiUrl).pipe(
      catchError((error) => throwError(() => error))
    );
  }

  get(id: number): Observable<Depot> {
    return this.http.get<Depot>(`${this.apiUrl}/${id}`).pipe(
      catchError((error) => throwError(() => error))
    );
  }
} 