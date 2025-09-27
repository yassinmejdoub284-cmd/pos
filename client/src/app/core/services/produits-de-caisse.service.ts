import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ProduitDeStock, CreateProduitDeStockRequest, UpdateProduitDeStockRequest, ProduitDeCaisse, CreateProduitDeCaisseRequest, UpdateProduitDeCaisseRequest } from '../models/produit-de-caisse.model';

@Injectable({
  providedIn: 'root'
})
export class ProduitsDeStockService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/produits-de-caisse`;

  getProduitsDeStock(): Observable<ProduitDeStock[]> {
    return this.http.get<ProduitDeStock[]>(this.apiUrl);
  }

  getProduitDeStock(id: number): Observable<ProduitDeStock> {
    return this.http.get<ProduitDeStock>(`${this.apiUrl}/${id}`);
  }

  createProduitDeStock(data: CreateProduitDeStockRequest): Observable<ProduitDeStock> {
    return this.http.post<ProduitDeStock>(this.apiUrl, data);
  }

  updateProduitDeStock(id: number, data: UpdateProduitDeStockRequest): Observable<ProduitDeStock> {
    return this.http.put<ProduitDeStock>(`${this.apiUrl}/${id}`, data);
  }

  deleteProduitDeStock(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  getActiveProduitsDeStock(): Observable<ProduitDeStock[]> {
    return this.http.get<ProduitDeStock[]>(`${this.apiUrl}/active`);
  }

  getSubProductsByParent(parentProductId: number): Observable<ProduitDeStock[]> {
    return this.http.get<ProduitDeStock[]>(`${this.apiUrl}/parent/${parentProductId}`);
  }

  uploadImage(file: File): Observable<{ imageUrl: string }> {
    const formData = new FormData();
    formData.append('image', file);
    return this.http.post<{ imageUrl: string }>(`${this.apiUrl}/upload-image`, formData);
  }
}

// Keep backward compatibility
@Injectable({
  providedIn: 'root'
})
export class ProduitsDeCaisseService {
  private produitsDeStockService = inject(ProduitsDeStockService);

  getProduitsDeCaisse(): Observable<ProduitDeCaisse[]> {
    return this.produitsDeStockService.getProduitsDeStock();
  }

  getProduitDeCaisse(id: number): Observable<ProduitDeCaisse> {
    return this.produitsDeStockService.getProduitDeStock(id);
  }

  createProduitDeCaisse(data: CreateProduitDeCaisseRequest): Observable<ProduitDeCaisse> {
    return this.produitsDeStockService.createProduitDeStock(data);
  }

  updateProduitDeCaisse(id: number, data: UpdateProduitDeCaisseRequest): Observable<ProduitDeCaisse> {
    return this.produitsDeStockService.updateProduitDeStock(id, data);
  }

  deleteProduitDeCaisse(id: number): Observable<void> {
    return this.produitsDeStockService.deleteProduitDeStock(id);
  }

  getActiveProduitsDeCaisse(): Observable<ProduitDeCaisse[]> {
    return this.produitsDeStockService.getActiveProduitsDeStock();
  }

  uploadImage(file: File): Observable<{ imageUrl: string }> {
    return this.produitsDeStockService.uploadImage(file);
  }
}
