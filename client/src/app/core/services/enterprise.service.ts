import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface CompanyPayload {
  id?: number;
  raisonSociale: string;
  formeJuridique: string;
  activite?: string;
  dateCreation?: string;
  logoUrl?: string;
  brandColor?: string;
  statut: 'ACTIF' | 'ARCHIVE' | string;
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
  tauxTva?: number;
  capitalSocial?: number;
  representantNom?: string;
  representantCin?: string;
  rib?: string;
  banque?: string;
  bic?: string;
}

@Injectable({ providedIn: 'root' })
export class EnterpriseService {
  private readonly API = `${environment.apiUrl}/companies`;

  constructor(private http: HttpClient) {}

  listCompanies(): Observable<any[]> {
    return this.http.get<any[]>(this.API);
  }

  getCompany(id: number): Observable<any> {
    return this.http.get<any>(`${this.API}/${id}`);
  }

  createCompany(payload: CompanyPayload): Observable<any> {
    return this.http.post<any>(this.API, payload);
  }

  updateCompany(id: number, payload: Partial<CompanyPayload>): Observable<any> {
    return this.http.put<any>(`${this.API}/${id}`, payload);
  }

  deleteCompany(id: number): Observable<any> {
    return this.http.delete<any>(`${this.API}/${id}`);
  }

  listUnassignedDepots(companyId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.API}/${companyId}/unassigned-depots`);
    }

  assignDepots(companyId: number, depotIds: number[]): Observable<any[]> {
    return this.http.post<any[]>(`${this.API}/${companyId}/depots`, { depotIds });
  }

  unassignDepot(companyId: number, depotId: number): Observable<any[]> {
    return this.http.delete<any[]>(`${this.API}/${companyId}/depots/${depotId}`);
  }

  uploadCompanyLogo(file: File): Observable<{ logoUrl: string }> {
    const formData = new FormData();
    formData.append('logo', file);
    return this.http.post<{ logoUrl: string }>(`${this.API}/logo`, formData);
  }

  uploadCompanyLogoAndSave(id: number, file: File): Observable<{ logoUrl: string; company: any }> {
    const formData = new FormData();
    formData.append('logo', file);
    return this.http.post<{ logoUrl: string; company: any }>(`${this.API}/${id}/logo`, formData);
  }
}


