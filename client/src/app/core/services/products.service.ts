import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { Product, ProductFamily, BulkImportResult } from '../models/product.model';

@Injectable({
  providedIn: 'root'
})
export class ProductsService {
  private apiUrl = `${environment.apiUrl}/products`;

  constructor(
    private http: HttpClient
  ) {}

  getProducts(depotId?: number): Observable<Product[]> {
    let params = new HttpParams();
    
    // Always include depotId if provided, or try to get from sessionStorage
    let targetDepotId = depotId;
    if (!targetDepotId) {
      const storedDepotId = sessionStorage.getItem('depotId') || sessionStorage.getItem('visitingDepotId');
      if (storedDepotId) {
        targetDepotId = parseInt(storedDepotId);
      }
    }
    
    if (targetDepotId) {
      params = params.set('depotId', targetDepotId.toString());
    }
    
    return this.http.get<Product[]>(this.apiUrl, { params }).pipe(
      catchError((error) => throwError(() => error))
    );
  }

  getProduct(id: number): Observable<Product> {
    return this.http.get<Product>(`${this.apiUrl}/${id}`).pipe(
      catchError((error) => throwError(() => error))
    );
  }

  createProduct(product: Partial<Product>): Observable<Product> {
    return this.http.post<Product>(this.apiUrl, product);
  }

  updateProduct(id: number, product: Partial<Product>): Observable<Product> {
    return this.http.put<Product>(`${this.apiUrl}/${id}`, product);
  }

  deleteProduct(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }

  uploadImage(file: File): Observable<{ imageUrl: string }> {
    const formData = new FormData();
    formData.append('image', file);
    return this.http.post<{ imageUrl: string }>(`${this.apiUrl}/upload-image`, formData);
  }

  uploadProductPhoto(productId: number, file: File): Observable<{ imageUrl: string; product: any }> {
    const formData = new FormData();
    formData.append('photo', file);
    return this.http.post<{ imageUrl: string; product: any }>(`${this.apiUrl}/${productId}/photo`, formData);
  }

  updateProductPhotoUrl(productId: number, imageUrl: string): Observable<{ imageUrl: string; product: any }> {
    return this.http.put<{ imageUrl: string; product: any }>(`${this.apiUrl}/${productId}`, { photo: imageUrl });
  }

  deleteProductPhoto(productId: number): Observable<{ product: any }> {
    return this.http.delete<{ product: any }>(`${this.apiUrl}/${productId}/photo`);
  }

  generateBarcode(): Observable<{ barcode: string }> {
    return this.http.post<{ barcode: string }>(`${this.apiUrl}/generate-barcode`, {});
  }

  bulkImport(products: any[], dryRun: boolean = false): Observable<BulkImportResult> {
    return this.http.post<BulkImportResult>(`${this.apiUrl}/bulk-import`, { products, dryRun });
  }

  exportCsv(columns: string = 'name,famille,prix_vente_TTC,barcode'): Observable<Blob> {
    const params = new HttpParams().set('columns', columns);
    return this.http.get(`${this.apiUrl}/export/csv`, { 
      params, 
      responseType: 'blob' 
    });
  }

  getFamilles(): Observable<ProductFamily[]> {
    return this.http.get<ProductFamily[]>(`${this.apiUrl}/familles`).pipe(
      catchError((error) => throwError(() => error))
    );
  }

  // Conservation management



  updateProductOrder(updates: { id: number; displayIndex: number }[]): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/order`, { updates });
  }

  transferProduct(transferData: {
    sourceProductId: number;
    targetProductId: number;
    quantity: number;
    conversionRatio: number;
    depotId: number;
  }): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/transfer`, transferData);
  }

  transferProductMultiple(transferData: {
    sourceProductId: number;
    transfers: Array<{
      targetProductId: number;
      quantity: number;
      conversionRatio: number;
    }>;
    depotId: number;
  }): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/transfer-multiple`, transferData);
  }

  getTransferHistory(params: {
    depotId: number;
    page?: number;
    limit?: number;
    startDate?: string;
    endDate?: string;
  }): Observable<any> {
    let httpParams = new HttpParams();
    httpParams = httpParams.set('depotId', params.depotId.toString());
    if (params.page) {
      httpParams = httpParams.set('page', params.page.toString());
    }
    if (params.limit) {
      httpParams = httpParams.set('limit', params.limit.toString());
    }
    if (params.startDate) {
      httpParams = httpParams.set('startDate', params.startDate);
    }
    if (params.endDate) {
      httpParams = httpParams.set('endDate', params.endDate);
    }
    return this.http.get<any>(`${this.apiUrl}/transfer-history`, { params: httpParams });
  }

  updateTransferTransaction(transferId: number, depotId: number, updates: Array<{
    targetProductId: number;
    newQuantity: number;
    originalQuantity: number;
  }>): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/transfer-history/${transferId}`, {
      depotId,
      updates
    });
  }

  deleteTransferTransaction(transferId: number, depotId: number): Observable<any> {
    const params = new HttpParams().set('depotId', depotId.toString());
    return this.http.delete<any>(`${this.apiUrl}/transfer-history/${transferId}`, { params });
  }

  // Product Depot Links
  getVracConversions(sourceProductId: number): Observable<{
    sourceProductId: number;
    conversions: Array<{
      id: number;
      targetProductId: number;
      targetProductName: string;
      targetProductUnite: string;
      conversionRatio: number;
      prix_vente_vrac: number | null;
      prix_achat_vrac: number | null;
      isStockable: boolean;
    }>;
  }> {
    return this.http.get<{
      sourceProductId: number;
      conversions: Array<{
        id: number;
        targetProductId: number;
        targetProductName: string;
        targetProductUnite: string;
        conversionRatio: number;
        prix_vente_vrac: number | null;
        prix_achat_vrac: number | null;
        isStockable: boolean;
      }>;
    }>(`${this.apiUrl}/vrac-conversions/${sourceProductId}`);
  }

  createVracConversions(sourceProductId: number, conversions: Array<{
    targetProductId: number;
    conversionRatio: number;
    prix_vente_vrac?: number;
    prix_achat_vrac?: number;
    isStockable?: boolean;
  }>): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/vrac-conversions`, {
      sourceProductId,
      conversions
    });
  }

  deleteVracConversion(conversionId: number): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/vrac-conversions/${conversionId}`);
  }

  createFamilleConsolidation(data: {
    sourceFamilleId: number;
    sourceDepotIds: number[];
    destinationProductId: number;
    destinationDepotId: number;
  }): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/famille-consolidations`, data);
  }
} 