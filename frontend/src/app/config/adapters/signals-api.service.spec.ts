import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { SignalsApiService } from './signals-api.service';

describe('SignalsApiService', () => {
  let service: SignalsApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(SignalsApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('list llama a GET /machines/:machineId/signals', () => {
    service.list('machine-1', { limit: 20, offset: 0 }).subscribe();

    const req = httpMock.expectOne('/api/v1/machines/machine-1/signals?limit=20&offset=0');
    expect(req.request.method).toBe('GET');
    req.flush({ data: [], total: 0, limit: 20, offset: 0 });
  });

  it('get llama a GET /machines/:machineId/signals/:id (no confunde machineId con id)', () => {
    service.get('machine-1', 'signal-2').subscribe();

    const req = httpMock.expectOne('/api/v1/machines/machine-1/signals/signal-2');
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('create llama a POST /machines/:machineId/signals con el body', () => {
    service
      .create('machine-1', {
        name: 'Temperatura',
        signalType: 'DIRECT',
        signalSource: { variableName: 'temperature' },
        unit: '°C',
      })
      .subscribe();

    const req = httpMock.expectOne('/api/v1/machines/machine-1/signals');
    expect(req.request.method).toBe('POST');
    expect(req.request.body.signalType).toBe('DIRECT');
    req.flush({});
  });

  it('update llama a PATCH /machines/:machineId/signals/:id', () => {
    service.update('machine-1', 'signal-2', { name: 'Nuevo nombre' }).subscribe();

    const req = httpMock.expectOne('/api/v1/machines/machine-1/signals/signal-2');
    expect(req.request.method).toBe('PATCH');
    req.flush({});
  });

  it('remove llama a DELETE /machines/:machineId/signals/:id', () => {
    service.remove('machine-1', 'signal-2').subscribe();

    const req = httpMock.expectOne('/api/v1/machines/machine-1/signals/signal-2');
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });
});
