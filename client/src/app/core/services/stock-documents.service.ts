import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { StockDocument, ScanResult, TransferItem } from '../models/stock-document.model';

@Injectable({
  providedIn: 'root'
})
export class StockDocumentsService {
  private apiUrl = `${environment.apiUrl}/stock-documents`;

  constructor(
    private http: HttpClient
  ) {}

  getDocuments(page: number = 1, limit: number = 20, type?: string, status?: string, depotId?: number, dateFrom?: string, dateTo?: string): Observable<any> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('limit', limit.toString());

    if (type) params = params.set('type', type);
    if (status) params = params.set('status', status);
    if (depotId) params = params.set('depotId', depotId.toString());
    if (dateFrom) params = params.set('dateFrom', dateFrom);
    if (dateTo) params = params.set('dateTo', dateTo);

    return this.http.get<any>(this.apiUrl, { params }).pipe(
      catchError((error) => throwError(() => error))
    );
  }

  getDocument(id: number): Observable<StockDocument> {
    return this.http.get<StockDocument>(`${this.apiUrl}/${id}`).pipe(
      catchError((error) => throwError(() => error))
    );
  }

  createExpedition(emetteurId: number, destinataireId: number, items: any[], notes?: string): Observable<StockDocument> {
    return this.http.post<StockDocument>(`${this.apiUrl}/expedition`, {
      emetteurId,
      destinataireId,
      items,
      notes
    });
  }

  createEntry(depotId: number, supplierId: number | null, items: any[], notes?: string): Observable<StockDocument> {
    return this.http.post<StockDocument>(`${this.apiUrl}/entry`, {
      depotId,
      supplierId,
      items,
      notes
    });
  }

  updateDocument(id: number, data: any): Observable<StockDocument> {
    return this.http.put<StockDocument>(`${this.apiUrl}/${id}`, data).pipe(
      catchError((error) => throwError(() => error))
    );
  }

  validateDocument(id: number, status: string, notes?: string): Observable<StockDocument> {
    return this.http.post<StockDocument>(`${this.apiUrl}/${id}/validate`, {
      status,
      notes
    });
  }

  scanBarcode(barcode: string, depotId: number, documentType?: string): Observable<ScanResult> {
    return this.http.post<ScanResult>(`${this.apiUrl}/scan`, {
      barcode,
      depotId,
      documentType
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

  scanTransfer(fromDepotId: number, toDepotId: number, barcode: string): Observable<ScanResult> {
    return this.http.post<ScanResult>(`${this.apiUrl}/scan-transfer`, {
      fromDepotId,
      toDepotId,
      barcode
    });
  }

  getInventory(depotId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/inventory/${depotId}`);
  }

  getStockMovements(depotId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/../stock/movements?depotId=${depotId}&limit=1000`);
  }

  createTransfer(emetteurId: number, destinataireId: number, items: any[], notes?: string): Observable<StockDocument> {
    return this.http.post<StockDocument>(`${this.apiUrl}/transfer`, {
      emetteurId,
      destinataireId,
      items,
      notes
    });
  }

  createStockDocument(data: any): Observable<StockDocument> {
    return this.http.post<StockDocument>(this.apiUrl, data).pipe(
      catchError((error) => throwError(() => error))
    );
  }

  createDocument(data: any): Observable<StockDocument> {
    return this.http.post<StockDocument>(this.apiUrl, data).pipe(
      catchError((error) => throwError(() => error))
    );
  }

  getNextDocumentNumber(documentType: string): Observable<string> {
    return this.http.get<string>(`${this.apiUrl}/next-number/${documentType}`).pipe(
      catchError((error) => throwError(() => error))
    );
  }

  convertToDelivery(documentId: number): Observable<StockDocument> {
    return this.http.post<StockDocument>(`${this.apiUrl}/${documentId}/convert-to-delivery`, {}).pipe(
      catchError((error) => throwError(() => error))
    );
  }

  approveReceipt(documentId: number, depotId: number): Observable<StockDocument> {
    return this.http.post<StockDocument>(`${this.apiUrl}/${documentId}/approve-receipt`, { depotId }).pipe(
      catchError((error) => throwError(() => error))
    );
  }
} 