import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { EnvService } from '../services/env.service';

export interface RequestOptions {
  headers?: HttpHeaders | Record<string, string | string[]>;
  params?: HttpParams | Record<string, string | number | boolean>;
}

@Injectable({
  providedIn: 'root',
})
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly env = inject(EnvService);

  get<T>(endpoint: string, options?: RequestOptions): Observable<T> {
    return this.http.get<T>(`${this.env.apiUrl}/${endpoint}`, options);
  }

  post<T, B = unknown>(endpoint: string, body: B, options?: RequestOptions): Observable<T> {
    return this.http.post<T>(`${this.env.apiUrl}/${endpoint}`, body, options);
  }

  update<T, B = unknown>(endpoint: string, body: B, options?: RequestOptions): Observable<T> {
    return this.http.put<T>(`${this.env.apiUrl}/${endpoint}`, body, options);
  }

  patch<T, B = unknown>(endpoint: string, body: B, options?: RequestOptions): Observable<T> {
    return this.http.patch<T>(`${this.env.apiUrl}/${endpoint}`, body, options);
  }
}
