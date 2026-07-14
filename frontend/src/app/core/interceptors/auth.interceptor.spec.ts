import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AuthStateService } from '../../auth/use-cases/auth.state';
import { authInterceptor } from './auth.interceptor';

describe('authInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let authState: { accessToken: ReturnType<typeof vi.fn>; refresh: ReturnType<typeof vi.fn> };
  let router: { navigateByUrl: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    authState = { accessToken: vi.fn().mockReturnValue('current-token'), refresh: vi.fn() };
    router = { navigateByUrl: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthStateService, useValue: authState },
        { provide: Router, useValue: router },
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('adjunta el Bearer token a peticiones de /api/v1, no a otras URLs', () => {
    http.get('/api/v1/machines').subscribe();
    const apiReq = httpMock.expectOne('/api/v1/machines');
    expect(apiReq.request.headers.get('Authorization')).toBe('Bearer current-token');
    apiReq.flush({});

    http.get('icons/alert.svg').subscribe();
    const iconReq = httpMock.expectOne('icons/alert.svg');
    expect(iconReq.request.headers.has('Authorization')).toBe(false);
    iconReq.flush('');
  });

  it('ante un 401 dispara un refresh y reintenta la petición original con el nuevo token', () => {
    authState.refresh.mockReturnValue(of('new-token'));
    let result: unknown;
    http.get('/api/v1/machines').subscribe((response) => (result = response));

    const firstAttempt = httpMock.expectOne('/api/v1/machines');
    firstAttempt.flush({ code: 'UNAUTHENTICATED' }, { status: 401, statusText: 'Unauthorized' });

    expect(authState.refresh).toHaveBeenCalledTimes(1);
    const retry = httpMock.expectOne('/api/v1/machines');
    expect(retry.request.headers.get('Authorization')).toBe('Bearer new-token');
    retry.flush({ ok: true });

    expect(result).toEqual({ ok: true });
  });

  it('un 401 en /auth/login se propaga sin disparar refresh (evita enmascarar credenciales inválidas)', () => {
    let error: unknown;
    http.post('/api/v1/auth/login', {}).subscribe({ error: (e) => (error = e) });

    const req = httpMock.expectOne('/api/v1/auth/login');
    req.flush({ code: 'INVALID_CREDENTIALS' }, { status: 401, statusText: 'Unauthorized' });

    expect(authState.refresh).not.toHaveBeenCalled();
    expect(error).toBeTruthy();
  });

  it('un 401 en /auth/forgot-password se propaga sin disparar refresh', () => {
    let error: unknown;
    http.post('/api/v1/auth/forgot-password', {}).subscribe({ error: (e) => (error = e) });

    const req = httpMock.expectOne('/api/v1/auth/forgot-password');
    req.flush({ code: 'BAD_REQUEST' }, { status: 401, statusText: 'Unauthorized' });

    expect(authState.refresh).not.toHaveBeenCalled();
    expect(error).toBeTruthy();
  });

  it('un 401 en /auth/refresh se propaga sin volver a llamar a refresh (evita un loop)', () => {
    let error: unknown;
    http.post('/api/v1/auth/refresh', {}).subscribe({ error: (e) => (error = e) });

    const req = httpMock.expectOne('/api/v1/auth/refresh');
    req.flush({ code: 'INVALID_REFRESH_TOKEN' }, { status: 401, statusText: 'Unauthorized' });

    expect(authState.refresh).not.toHaveBeenCalled();
    expect(error).toBeTruthy();
  });

  it('si el refresh también falla, navega a /login', () => {
    authState.refresh.mockReturnValue(throwError(() => new Error('refresh inválido')));
    let error: unknown;
    http.get('/api/v1/machines').subscribe({ error: (e) => (error = e) });

    const req = httpMock.expectOne('/api/v1/machines');
    req.flush({ code: 'UNAUTHENTICATED' }, { status: 401, statusText: 'Unauthorized' });

    expect(router.navigateByUrl).toHaveBeenCalledWith('/login');
    expect(error).toBeTruthy();
  });
});
