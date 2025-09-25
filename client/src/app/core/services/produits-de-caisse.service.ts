import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ProduitDeCaisse, CreateProduitDeCaisseRequest, UpdateProduitDeCaisseRequest } from '../models/produit-de-caisse.model';

@Injectable({
  providedIn: 'root'
})
export class ProduitsDeCaisseService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/produits-de-caisse`;

  getProduitsDeCaisse(): Observable<ProduitDeCaisse[]> {
    return this.http.get<ProduitDeCaisse[]>(this.apiUrl);
  }

  getProduitDeCaisse(id: number): Observable<ProduitDeCaisse> {
    return this.http.get<ProduitDeCaisse>(`${this.apiUrl}/${id}`);
  }

  createProduitDeCaisse(data: CreateProduitDeCaisseRequest): Observable<ProduitDeCaisse> {
    return this.http.post<ProduitDeCaisse>(this.apiUrl, data);
  }

  updateProduitDeCaisse(id: number, data: UpdateProduitDeCaisseRequest): Observable<ProduitDeCaisse> {
    return this.http.put<ProduitDeCaisse>(`${this.apiUrl}/${id}`, data);
  }

  deleteProduitDeCaisse(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  getActiveProduitsDeCaisse(): Observable<ProduitDeCaisse[]> {
    return this.http.get<ProduitDeCaisse[]>(`${this.apiUrl}/active`);
  }
}
