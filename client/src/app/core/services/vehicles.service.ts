import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { 
  Vehicle, 
  CreateVehicleRequest, 
  UpdateVehicleRequest,
  VehicleBrand,
  CreateVehicleBrandRequest,
  UpdateVehicleBrandRequest
} from '../models/vehicle.model';

@Injectable({
  providedIn: 'root'
})
export class VehiclesService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/vehicles`;

  // Vehicle CRUD operations
  getVehicles(): Observable<Vehicle[]> {
    return this.http.get<Vehicle[]>(this.apiUrl);
  }

  getVehicle(id: number): Observable<Vehicle> {
    return this.http.get<Vehicle>(`${this.apiUrl}/${id}`);
  }

  createVehicle(data: CreateVehicleRequest): Observable<Vehicle> {
    return this.http.post<Vehicle>(this.apiUrl, data);
  }

  updateVehicle(id: number, data: UpdateVehicleRequest): Observable<Vehicle> {
    return this.http.put<Vehicle>(`${this.apiUrl}/${id}`, data);
  }

  deleteVehicle(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  getActiveVehicles(): Observable<Vehicle[]> {
    return this.http.get<Vehicle[]>(`${this.apiUrl}/active`);
  }

  searchVehicles(query: string): Observable<Vehicle[]> {
    return this.http.get<Vehicle[]>(`${this.apiUrl}/search`, {
      params: { q: query }
    });
  }

  // Vehicle Brand CRUD operations
  getVehicleBrands(): Observable<VehicleBrand[]> {
    return this.http.get<VehicleBrand[]>(`${this.apiUrl}/brands`);
  }

  getVehicleBrand(id: number): Observable<VehicleBrand> {
    return this.http.get<VehicleBrand>(`${this.apiUrl}/brands/${id}`);
  }

  createVehicleBrand(data: CreateVehicleBrandRequest): Observable<VehicleBrand> {
    return this.http.post<VehicleBrand>(`${this.apiUrl}/brands`, data);
  }

  updateVehicleBrand(id: number, data: UpdateVehicleBrandRequest): Observable<VehicleBrand> {
    return this.http.put<VehicleBrand>(`${this.apiUrl}/brands/${id}`, data);
  }

  deleteVehicleBrand(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/brands/${id}`);
  }

  getActiveVehicleBrands(): Observable<VehicleBrand[]> {
    return this.http.get<VehicleBrand[]>(`${this.apiUrl}/brands/active`);
  }

  searchVehicleBrands(query: string): Observable<VehicleBrand[]> {
    return this.http.get<VehicleBrand[]>(`${this.apiUrl}/brands/search`, {
      params: { q: query }
    });
  }
}
