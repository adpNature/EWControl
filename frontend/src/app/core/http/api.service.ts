import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, throwError } from 'rxjs';
import { ApiError } from './api-error.model';

const API_BASE_URL = '/api/v1';

/**
 * Wrapper fino sobre `HttpClient` (docs/08-frontend-dashboard.md, apartado 8.2):
 * fija la base URL y normaliza cualquier error HTTP al `ApiError` uniforme de
 * docs/11-api-rest.md, para que los adapters de cada feature nunca parseen
 * `HttpErrorResponse` directamente. `withCredentials: true` para que la cookie
 * de refresh (docs/specs/05-auth-login.md) viaje en cada petición — necesario
 * si Frontend y Backend algún día viven en dominios distintos; en dev (proxy
 * de Angular CLI) y en despliegue (mismo origin detrás del Ingress) no hace
 * falta, pero no tiene coste dejarlo puesto.
 */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

  get<T>(path: string, params?: Record<string, string | number>): Observable<T> {
    return this.request(
      this.http.get<T>(`${API_BASE_URL}${path}`, { withCredentials: true, params }),
    );
  }

  post<T>(path: string, body: unknown): Observable<T> {
    return this.request(
      this.http.post<T>(`${API_BASE_URL}${path}`, body, { withCredentials: true }),
    );
  }

  patch<T>(path: string, body: unknown): Observable<T> {
    return this.request(
      this.http.patch<T>(`${API_BASE_URL}${path}`, body, { withCredentials: true }),
    );
  }

  put<T>(path: string, body: unknown): Observable<T> {
    return this.request(
      this.http.put<T>(`${API_BASE_URL}${path}`, body, { withCredentials: true }),
    );
  }

  delete<T>(path: string): Observable<T> {
    return this.request(this.http.delete<T>(`${API_BASE_URL}${path}`, { withCredentials: true }));
  }

  private request<T>(source: Observable<T>): Observable<T> {
    return source.pipe(
      catchError((error: HttpErrorResponse) => throwError(() => toApiError(error))),
    );
  }
}

function toApiError(error: HttpErrorResponse): ApiError {
  const body = error.error as Partial<ApiError> | null;
  return {
    status: error.status,
    code: body?.code ?? 'UNKNOWN_ERROR',
    message: body?.message ?? error.message,
    details: body?.details,
  };
}
