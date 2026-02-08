import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface Company {
  id: number;
  raisonSociale: string;
  formeJuridique?: string;
  activite?: string;
  dateCreation?: Date;
  logoUrl?: string;
  brandColor?: string;
  statut?: 'ACTIF' | 'INACTIF' | 'SUSPENDU';
  adresse?: string;
  ville?: string;
  delegation?: string;
  gouvernorat?: string;
  codePostal?: string;
  telephone?: string;
  email?: string;
  siteWeb?: string;
  matriculeFiscal: string;
  rne: string;
  registreCommerce?: string;
  tvaAssujetti: boolean;
  numeroTva?: string;
  tauxTva: number;
  capitalSocial: number;
  representantNom?: string;
  representantCin?: string;
  rib?: string;
  banque?: string;
  bic?: string;
  createdAt: Date;
  updatedAt: Date;
  depotCount?: number;
}

@Injectable({
  providedIn: 'root'
})
export class CompaniesService {
  private apiUrl = `${environment.apiUrl}/companies`;

  constructor(private http: HttpClient) {}

  getAll(): Observable<Company[]> {
    return this.http.get<Company[]>(this.apiUrl);
  }

  getById(id: number): Observable<Company> {
    return this.http.get<Company>(`${this.apiUrl}/${id}`);
  }

  create(company: Partial<Company>): Observable<Company> {
    return this.http.post<Company>(this.apiUrl, company);
  }

  update(id: number, company: Partial<Company>): Observable<Company> {
    return this.http.put<Company>(`${this.apiUrl}/${id}`, company);
  }

  delete(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }

  uploadLogo(id: number, file: File): Observable<{ logoUrl: string, company: Company }> {
    const formData = new FormData();
    formData.append('logo', file);
    return this.http.post<{ logoUrl: string, company: Company }>(`${this.apiUrl}/${id}/logo`, formData);
  }
}
