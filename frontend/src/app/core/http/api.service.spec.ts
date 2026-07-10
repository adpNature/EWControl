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

  it('get antepone la base URL y serializa params como querystring', () => {
    service.get('/machines', { limit: 20, offset: 0 }).subscribe();

    const req = httpMock.expectOne('/api/v1/machines?limit=20&offset=0');
    expect(req.request.method).toBe('GET');
    expect(req.request.withCredentials).toBe(true);
    req.flush({});
  });

  it('patch envía el body con credenciales', () => {
    service.patch('/machines/machine-1', { name: 'Nuevo nombre' }).subscribe();

    const req = httpMock.expectOne('/api/v1/machines/machine-1');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.body).toEqual({ name: 'Nuevo nombre' });
    req.flush({});
  });

  it('put envía el body con credenciales', () => {
    service.put('/machines/machine-1/connection', { providerType: 'Simulator' }).subscribe();

    const req = httpMock.expectOne('/api/v1/machines/machine-1/connection');
    expect(req.request.method).toBe('PUT');
    expect(req.request.withCredentials).toBe(true);
    req.flush({});
  });

  it('delete envía la petición con credenciales', () => {
    service.delete('/machines/machine-1').subscribe();

    const req = httpMock.expectOne('/api/v1/machines/machine-1');
    expect(req.request.method).toBe('DELETE');
    expect(req.request.withCredentials).toBe(true);
    req.flush({});
  });

  it('normaliza un error también para get/patch/put/delete', () => {
    let captured: ApiError | undefined;
    service
      .delete('/machines/missing')
      .subscribe({ error: (error: ApiError) => (captured = error) });

    const req = httpMock.expectOne('/api/v1/machines/missing');
    req.flush(
      { code: 'MACHINE_NOT_FOUND', message: 'No existe la máquina.' },
      { status: 404, statusText: 'Not Found' },
    );

    expect(captured).toEqual({
      status: 404,
      code: 'MACHINE_NOT_FOUND',
      message: 'No existe la máquina.',
      details: undefined,
    });
  });
});
