import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ProductFamily } from '../models/product-family.model';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class FamiliesService {
  private apiUrl = environment.apiUrl + '/families';

  constructor(private http: HttpClient) { }

  getFamilies(): Observable<ProductFamily[]> {
    return this.http.get<ProductFamily[]>(this.apiUrl);
  }

  getFamily(id: number): Observable<ProductFamily> {
    return this.http.get<ProductFamily>(`${this.apiUrl}/${id}`);
  }

  createFamily(family: Partial<ProductFamily>): Observable<ProductFamily> {
    return this.http.post<ProductFamily>(this.apiUrl, family);
  }

  updateFamily(id: number, family: Partial<ProductFamily>): Observable<ProductFamily> {
    return this.http.put<ProductFamily>(`${this.apiUrl}/${id}`, family);
  }

  deleteFamily(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/${id}`);
  }

  uploadFamilyPhoto(id: number, file: File): Observable<{ message: string; imageUrl: string; family: ProductFamily }> {
    const formData = new FormData();
    formData.append('photo', file);
    
    return this.http.post<{ message: string; imageUrl: string; family: ProductFamily }>(`${this.apiUrl}/${id}/photo`, formData);
  }

  updateFamilyPhotoUrl(id: number, imageUrl: string): Observable<{ message: string; imageUrl: string; family: ProductFamily }> {
    return this.http.put<{ message: string; imageUrl: string; family: ProductFamily }>(`${this.apiUrl}/${id}`, { photo: imageUrl });
  }

  deleteFamilyPhoto(id: number): Observable<{ message: string; family: ProductFamily }> {
    return this.http.delete<{ message: string; family: ProductFamily }>(`${this.apiUrl}/${id}/photo`);
  }
}
