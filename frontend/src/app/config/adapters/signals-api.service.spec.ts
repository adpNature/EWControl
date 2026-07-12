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

  it('getValue llama a GET /machines/:machineId/signals/:id/value (docs/specs/07)', () => {
    let result: unknown;
    service.getValue('machine-1', 'signal-2').subscribe((value) => (result = value));

    const req = httpMock.expectOne('/api/v1/machines/machine-1/signals/signal-2/value');
    expect(req.request.method).toBe('GET');
    req.flush({
      signalId: 'signal-2',
      value: 24.8,
      quality: 'GOOD',
      timestamp: '2026-07-12T10:00:00Z',
      updatedAt: '2026-07-12T10:00:00Z',
    });

    expect(result).toEqual(
      expect.objectContaining({ signalId: 'signal-2', value: 24.8, quality: 'GOOD' }),
    );
  });

  it('getHistory llama a GET /machines/:machineId/signals/:id/history sin enviar resolution (docs/specs/08)', () => {
    const from = new Date('2026-07-12T09:00:00Z');
    const to = new Date('2026-07-12T10:00:00Z');
    let result: unknown;
    service
      .getHistory('machine-1', 'signal-2', { from, to })
      .subscribe((value) => (result = value));

    const req = httpMock.expectOne(
      `/api/v1/machines/machine-1/signals/signal-2/history?from=${from.toISOString()}&to=${to.toISOString()}`,
    );
    expect(req.request.method).toBe('GET');
    expect(req.request.params.has('resolution')).toBe(false);
    req.flush({
      signalId: 'signal-2',
      resolution: 'raw',
      points: [{ timestamp: '2026-07-12T09:30:00Z', value: 24.8 }],
    });

    expect(result).toEqual({
      signalId: 'signal-2',
      resolution: 'raw',
      points: [{ timestamp: '2026-07-12T09:30:00Z', value: 24.8 }],
    });
  });
});
