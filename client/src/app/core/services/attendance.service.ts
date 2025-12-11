import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface AttendanceFilters {
  startDate: string;
  endDate: string;
  employeeId?: number | null;
  department?: string | null;
  view?: 'PRESENCES' | 'RETARDS' | 'ABSENCES' | 'OVERTIME' | null;
}

@Injectable({ providedIn: 'root' })
export class AttendanceService {
  private readonly API = `${environment.apiUrl}/attendance`;

  constructor(private http: HttpClient) {}

  getHistory(filters: AttendanceFilters): Observable<any> {
    let params = new HttpParams()
      .set('startDate', filters.startDate)
      .set('endDate', filters.endDate);
    if (filters.employeeId != null) params = params.set('employeeId', String(filters.employeeId));
    if (filters.department) params = params.set('department', filters.department);
    if (filters.view) params = params.set('view', filters.view);
    return this.http.get<any>(this.API, { params });
  }

  export(format: 'csv' | 'pdf', filters: AttendanceFilters): Observable<Blob> {
    let params = new HttpParams()
      .set('startDate', filters.startDate)
      .set('endDate', filters.endDate)
      .set('format', format);
    if (filters.employeeId != null) params = params.set('employeeId', String(filters.employeeId));
    if (filters.department) params = params.set('department', filters.department);
    if (filters.view) params = params.set('view', filters.view);
    return this.http.get(`${this.API}/export`, { params, responseType: 'blob' });
  }

  requestCorrection(payload: any): Observable<any> {
    return this.http.post(`${this.API}/corrections`, payload);
  }

  reviewCorrection(id: number, action: 'APPROVE' | 'REJECT', notes?: string): Observable<any> {
    return this.http.patch(`${this.API}/corrections/${id}`, { action, notes });
  }

  punch(type: 'CHECK_IN' | 'CHECK_OUT', userId?: number): Observable<any> {

    const body: { type: 'CHECK_IN' | 'CHECK_OUT'; userId?: number } = { type };
    if (userId) {
      body.userId = userId;
    }
    return this.http.post(`${this.API}/punch`, body).pipe(
      catchError(error => {
        console.error(`Punch ${type} error:`, error);
        return throwError(() => error);
      })
    );
  }

  getDetails(userId: number, startDate?: string, endDate?: string): Observable<any> {
    let params = new HttpParams().set('userId', String(userId));
    if (startDate) params = params.set('startDate', startDate);
    if (endDate) params = params.set('endDate', endDate);
    return this.http.get<any>(`${this.API}/details/${userId}`, { params });
  }

  getTodayStatus(): Observable<any> {
    return this.http.get<any>(`${this.API}/today`);
  }

  getAllUsersTodayStatus(): Observable<any[]> {
    return this.http.get<any[]>(`${this.API}/today/all`);
  }
}


