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

  getProducts(): Observable<Product[]> {
    return this.http.get<Product[]>(this.apiUrl).pipe(
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
} 