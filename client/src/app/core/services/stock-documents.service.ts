import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { StockDocument, ScanResult, TransferItem } from '../models/stock-document.model';

@Injectable({
  providedIn: 'root'
})
export class StockDocumentsService {
  private apiUrl = `${environment.apiUrl}/stock-documents`;

  constructor(private http: HttpClient) {}

  getDocuments(page: number = 1, limit: number = 20, type?: string, status?: string, depotId?: number, dateFrom?: string, dateTo?: string): Observable<any> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('limit', limit.toString());

    if (type) params = params.set('type', type);
    if (status) params = params.set('status', status);
    if (depotId) params = params.set('depotId', depotId.toString());
    if (dateFrom) params = params.set('dateFrom', dateFrom);
    if (dateTo) params = params.set('dateTo', dateTo);

    return this.http.get<any>(this.apiUrl, { params });
  }

  getDocument(id: number): Observable<StockDocument> {
    return this.http.get<StockDocument>(`${this.apiUrl}/${id}`);
  }

  createExpedition(emetteurId: number, destinataireId: number, items: any[], notes?: string): Observable<StockDocument> {
    return this.http.post<StockDocument>(`${this.apiUrl}/expedition`, {
      emetteurId,
      destinataireId,
      items,
      notes
    });
  }

  validateDocument(id: number, status: string, notes?: string): Observable<StockDocument> {
    return this.http.post<StockDocument>(`${this.apiUrl}/${id}/validate`, {
      status,
      notes
    });
  }

  scanBarcode(barcode: string, depotId: number): Observable<ScanResult> {
    return this.http.post<ScanResult>(`${this.apiUrl}/scan`, {
      barcode,
      depotId
    });
  }

  receiveDocument(id: number, depotId: number): Observable<StockDocument> {
    return this.http.post<StockDocument>(`${this.apiUrl}/${id}/receive`, {
      depotId
    });
  }

  processTransfer(fromDepotId: number, toDepotId: number, items: TransferItem[], notes?: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/transfer`, {
      fromDepotId,
      toDepotId,
      items,
      notes
    });
  }
} 