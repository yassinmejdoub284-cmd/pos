import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { Product, ProductFamily, BulkImportResult, VracPrice } from '../models/product.model';

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
  addConservationBatch(productId: number, data: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/${productId}/conservation`, data);
  }

  getConservationWarnings(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/conservation/warnings`);
  }

  dismissConservationWarning(conservationId: number): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/conservation/${conservationId}/dismiss`, {});
  }

  // Vrac price management
  createVracPrice(productId: number, priceData: { price: number; startDate: string; endDate?: string }): Observable<VracPrice> {
    return this.http.post<VracPrice>(`${this.apiUrl}/${productId}/vrac-prices`, priceData);
  }

  getVracPrices(productId: number, startDate?: string, endDate?: string): Observable<VracPrice[]> {
    let params = new HttpParams();
    if (startDate) params = params.set('startDate', startDate);
    if (endDate) params = params.set('endDate', endDate);
    
    return this.http.get<VracPrice[]>(`${this.apiUrl}/${productId}/vrac-prices`, { params });
  }

  getVracStatistics(startDate: string, endDate: string): Observable<any[]> {
    const params = new HttpParams()
      .set('startDate', startDate)
      .set('endDate', endDate);
    
    return this.http.get<any[]>(`${this.apiUrl}/vrac/statistics`, { params });
  }

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

  // Product Depot Links
  getSimilarProducts(params: {
    sourceDepotIds: number[];
    productName?: string;
    barcode?: string;
    destinationProductId?: number;
  }): Observable<Product[]> {
    let httpParams = new HttpParams();
    httpParams = httpParams.set('sourceDepotIds', params.sourceDepotIds.join(','));
    if (params.productName) {
      httpParams = httpParams.set('productName', params.productName);
    }
    if (params.barcode) {
      httpParams = httpParams.set('barcode', params.barcode);
    }
    if (params.destinationProductId) {
      httpParams = httpParams.set('destinationProductId', params.destinationProductId.toString());
    }
    return this.http.get<Product[]>(`${this.apiUrl}/similar-products`, { params: httpParams });
  }

  createProductDepotLink(linkData: {
    sourceProductId: number;
    sourceDepotId: number;
    destinationProductId: number;
    destinationDepotId: number;
  }): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/depot-links`, linkData);
  }

  getProductDepotLinks(productId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/${productId}/depot-links`);
  }

  deleteProductDepotLink(linkId: number): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/depot-links/${linkId}`);
  }

  getDestinationProduct(params: {
    sourceProductId: number;
    sourceDepotId: number;
    destinationDepotId: number;
  }): Observable<Product | null> {
    let httpParams = new HttpParams();
    httpParams = httpParams.set('sourceProductId', params.sourceProductId.toString());
    httpParams = httpParams.set('sourceDepotId', params.sourceDepotId.toString());
    httpParams = httpParams.set('destinationDepotId', params.destinationDepotId.toString());
    return this.http.get<Product | null>(`${this.apiUrl}/depot-links/destination`, { params: httpParams });
  }
} 