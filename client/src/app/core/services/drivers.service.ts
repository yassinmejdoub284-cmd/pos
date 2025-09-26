import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Driver, CreateDriverRequest, UpdateDriverRequest, DriversResponse } from '../models/driver.model';

@Injectable({
  providedIn: 'root'
})
export class DriversService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/drivers`;

  getDrivers(page: number = 1, limit: number = 50, search?: string): Observable<DriversResponse> {
    let params: any = { page: page.toString(), limit: limit.toString() };
    if (search) {
      params.search = search;
    }
    return this.http.get<DriversResponse>(this.apiUrl, { params });
  }

  getDriver(id: number): Observable<Driver> {
    return this.http.get<Driver>(`${this.apiUrl}/${id}`);
  }

  createDriver(driver: CreateDriverRequest): Observable<Driver> {
    return this.http.post<Driver>(this.apiUrl, driver);
  }

  updateDriver(id: number, driver: UpdateDriverRequest): Observable<Driver> {
    return this.http.put<Driver>(`${this.apiUrl}/${id}`, driver);
  }

  deleteDriver(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  getActiveDrivers(): Observable<Driver[]> {
    return this.http.get<Driver[]>(`${this.apiUrl}/active`);
  }
}
