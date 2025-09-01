import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Depot, DepotType } from '../models/depot.model';

@Injectable({
  providedIn: 'root'
})
export class TransferService {
  private apiUrl = `${environment.apiUrl}/stock-documents`;

  constructor(private http: HttpClient) {}

  getAvailableDestinations(sourceDepotType: DepotType): Observable<Depot[]> {
    let destinationTypes: DepotType[] = [];
    
    switch (sourceDepotType) {
      case 'MAIN':
        destinationTypes = ['BRANCH'];
        break;
      case 'BRANCH':
        destinationTypes = ['SHOP'];
        break;
      case 'WAREHOUSE':
        destinationTypes = ['MAIN', 'BRANCH'];
        break;
      default:
        destinationTypes = [];
    }
    
    return this.http.get<Depot[]>(`${environment.apiUrl}/depots?types=${destinationTypes.join(',')}`);
  }

  getAvailableStock(depotId: number): Observable<any[]> {
    return this.http.get<any[]>(`${environment.apiUrl}/stock/inventory/${depotId}`);
  }

  createTransfer(data: {
    fromDepotId: number;
    toDepotId: number;
    items: Array<{ productId: number; quantity: number }>;
    notes?: string;
  }): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/transfer`, data);
  }

  validateTransfer(data: {
    fromDepotId: number;
    toDepotId: number;
    items: Array<{ productId: number; quantity: number }>;
  }): Observable<{ valid: boolean; errors: string[] }> {
    return this.http.post<{ valid: boolean; errors: string[] }>(`${this.apiUrl}/transfer/validate`, data);
  }
} 