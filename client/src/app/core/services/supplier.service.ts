import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { 
  Supplier, 
  CreateSupplierRequest, 
  UpdateSupplierRequest,
  SupplierStatement,
  SupplierSummary,
  SupplierPayment
} from '../models/supplier.model';

@Injectable({
  providedIn: 'root'
})
export class SupplierService {
  private apiUrl = `${environment.apiUrl}/suppliers`;

  constructor(private http: HttpClient) {}

  getSuppliers(): Observable<Supplier[]> {
    return this.http.get<Supplier[]>(this.apiUrl);
  }

  getSupplier(id: number): Observable<Supplier> {
    return this.http.get<Supplier>(`${this.apiUrl}/${id}`);
  }

  createSupplier(supplier: CreateSupplierRequest): Observable<Supplier> {
    return this.http.post<Supplier>(this.apiUrl, supplier);
  }

  updateSupplier(id: number, supplier: UpdateSupplierRequest): Observable<Supplier> {
    return this.http.put<Supplier>(`${this.apiUrl}/${id}`, supplier);
  }

  deleteSupplier(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  toggleSupplierStatus(id: number): Observable<Supplier> {
    return this.http.patch<Supplier>(`${this.apiUrl}/${id}/toggle-status`, {});
  }

  // Supplier Statement methods
  getSupplierSummaries(startDate?: string, endDate?: string): Observable<SupplierSummary[]> {
    let url = `${this.apiUrl}/statements/summary?`;
    const params = new URLSearchParams();
    
    if (startDate) {
      params.append('startDate', startDate);
    }
    if (endDate) {
      params.append('endDate', endDate);
    }
    
    url += params.toString();
    return this.http.get<SupplierSummary[]>(url);
  }

  getSupplierStatement(supplierId: number, startDate?: string, endDate?: string): Observable<SupplierStatement> {
    let url = `${this.apiUrl}/${supplierId}/statement?`;
    const params = new URLSearchParams();
    
    if (startDate) {
      params.append('startDate', startDate);
    }
    if (endDate) {
      params.append('endDate', endDate);
    }
    
    url += params.toString();
    return this.http.get<SupplierStatement>(url);
  }

  // Supplier Payment methods
  getSupplierPayments(clientId?: number, startDate?: string, endDate?: string): Observable<SupplierPayment[]> {
    let url = `${environment.apiUrl}/supplier-payments?`;
    const params = new URLSearchParams();
    
    if (clientId) {
      params.append('supplierId', clientId.toString());
    }
    if (startDate) {
      params.append('startDate', startDate);
    }
    if (endDate) {
      params.append('endDate', endDate);
    }
    
    url += params.toString();
    return this.http.get<SupplierPayment[]>(url);
  }

  createSupplierPayment(payment: { supplierId: number; amount: number; notes?: string }): Observable<SupplierPayment> {
    return this.http.post<SupplierPayment>(`${environment.apiUrl}/supplier-payments`, payment);
  }
}
