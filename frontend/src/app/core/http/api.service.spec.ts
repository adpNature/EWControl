import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ApiError } from './api-error.model';
import { ApiService } from './api.service';

describe('ApiService', () => {
  let service: ApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('antepone la base URL /api/v1 y envía la petición con credenciales', () => {
    service.post('/auth/login', { email: 'demo@ewcontrol.local' }).subscribe();

    const req = httpMock.expectOne('/api/v1/auth/login');
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.body).toEqual({ email: 'demo@ewcontrol.local' });
    req.flush({});
  });

  it('normaliza un error HTTP con envelope {code,message} al ApiError uniforme', () => {
    let captured: ApiError | undefined;
    service.post('/auth/login', {}).subscribe({ error: (error: ApiError) => (captured = error) });

    const req = httpMock.expectOne('/api/v1/auth/login');
    req.flush(
      { code: 'INVALID_CREDENTIALS', message: 'Email o contraseña incorrectos.' },
      { status: 401, statusText: 'Unauthorized' },
    );

    expect(captured).toEqual({
      status: 401,
      code: 'INVALID_CREDENTIALS',
      message: 'Email o contraseña incorrectos.',
      details: undefined,
    });
  });

  it('usa un código genérico cuando la respuesta no trae el envelope esperado (ej. error de red)', () => {
    let captured: ApiError | undefined;
    service.post('/auth/login', {}).subscribe({ error: (error: ApiError) => (captured = error) });

    const req = httpMock.expectOne('/api/v1/auth/login');
    req.error(new ProgressEvent('network error'));

    expect(captured?.code).toBe('UNKNOWN_ERROR');
  });
});
