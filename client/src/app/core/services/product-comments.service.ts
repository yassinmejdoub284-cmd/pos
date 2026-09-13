import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ProductComment, CreateProductCommentRequest } from '../models/product-comment.model';

@Injectable({ providedIn: 'root' })
export class ProductCommentsService {
  private readonly API_URL = `${environment.apiUrl}/product-comments`;

  constructor(private http: HttpClient) {}

  /** Tous les commentaires (module de gestion). includeInactive pour la liste complete. */
  list(includeInactive = false): Observable<ProductComment[]> {
    let params = new HttpParams();
    if (includeInactive) params = params.set('all', 'true');
    return this.http.get<ProductComment[]>(this.API_URL, { params });
  }

  /** Commentaires proposes pour un produit : les siens + les globaux. */
  forProduct(productId: number): Observable<ProductComment[]> {
    return this.http.get<ProductComment[]>(this.API_URL, {
      params: new HttpParams().set('productId', String(productId))
    });
  }

  create(payload: CreateProductCommentRequest): Observable<ProductComment> {
    return this.http.post<ProductComment>(this.API_URL, payload);
  }

  update(id: number, payload: Partial<CreateProductCommentRequest> & { isActive?: boolean }): Observable<ProductComment> {
    return this.http.put<ProductComment>(`${this.API_URL}/${id}`, payload);
  }

  remove(id: number): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(`${this.API_URL}/${id}`);
  }
}
