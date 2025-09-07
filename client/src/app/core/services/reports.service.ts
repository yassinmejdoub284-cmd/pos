import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ProductSalesData {
  productId: number;
  productName: string;
  sku: string;
  totalSold: number;
  totalRevenue: number;
  avgPrice: number;
}

@Injectable({
  providedIn: 'root'
})
export class ReportsService {
  private apiUrl = `${environment.apiUrl}/reports`;

  constructor(private http: HttpClient) {}

  getProductSales(startDate?: string, endDate?: string, depotId?: number): Observable<ProductSalesData[]> {
    let params = new HttpParams();
    
    if (startDate) {
      params = params.set('startDate', startDate);
    }
    
    if (endDate) {
      params = params.set('endDate', endDate);
    }
    
    if (depotId) {
      params = params.set('depotId', depotId.toString());
    }

    return this.http.get<ProductSalesData[]>(`${this.apiUrl}/products`, { params });
  }
}
