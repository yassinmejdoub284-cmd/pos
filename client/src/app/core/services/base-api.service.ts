import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class BaseApiService {
  protected readonly apiUrl = environment.apiUrl;
  protected readonly socketUrl = environment.socketUrl;

  constructor(
    protected http: HttpClient,
    protected authService: AuthService
  ) {}

  protected getHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : ''
    });
  }

  protected getRequestOptions() {
    return {
      headers: this.getHeaders()
    };
  }
} 