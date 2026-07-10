import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MachinesApiService } from './machines-api.service';

describe('MachinesApiService', () => {
  let service: MachinesApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(MachinesApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('list llama a GET /machines con la paginación', () => {
    service.list({ limit: 20, offset: 0 }).subscribe();

    const req = httpMock.expectOne('/api/v1/machines?limit=20&offset=0');
    expect(req.request.method).toBe('GET');
    req.flush({ data: [], total: 0, limit: 20, offset: 0 });
  });

  it('get llama a GET /machines/:id', () => {
    service.get('machine-1').subscribe();

    const req = httpMock.expectOne('/api/v1/machines/machine-1');
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('create llama a POST /machines con el body', () => {
    service.create({ name: 'Bobinadora 1' }).subscribe();

    const req = httpMock.expectOne('/api/v1/machines');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ name: 'Bobinadora 1' });
    req.flush({});
  });

  it('update llama a PATCH /machines/:id', () => {
    service.update('machine-1', { name: 'Nuevo nombre' }).subscribe();

    const req = httpMock.expectOne('/api/v1/machines/machine-1');
    expect(req.request.method).toBe('PATCH');
    req.flush({});
  });

  it('remove llama a DELETE /machines/:id', () => {
    service.remove('machine-1').subscribe();

    const req = httpMock.expectOne('/api/v1/machines/machine-1');
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  it('getConnection llama a GET /machines/:machineId/connection', () => {
    service.getConnection('machine-1').subscribe();

    const req = httpMock.expectOne('/api/v1/machines/machine-1/connection');
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('replaceConnection llama a PUT /machines/:machineId/connection', () => {
    const request = {
      providerType: 'Simulator' as const,
      connectionConfig: { seedProfile: 'demo', signals: [] },
    };
    service.replaceConnection('machine-1', request).subscribe();

    const req = httpMock.expectOne('/api/v1/machines/machine-1/connection');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(request);
    req.flush({});
  });
});
