import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AlarmDefinitionsApiService } from './alarm-definitions-api.service';

describe('AlarmDefinitionsApiService', () => {
  let service: AlarmDefinitionsApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AlarmDefinitionsApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('list llama a GET /signals/:signalId/alarm-definitions', () => {
    service.list('signal-1').subscribe();

    const req = httpMock.expectOne('/api/v1/signals/signal-1/alarm-definitions');
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('create llama a POST /signals/:signalId/alarm-definitions con el body', () => {
    service
      .create('signal-1', {
        operator: '>',
        threshold: 80,
        priority: 'HIGH',
        notifyByEmail: true,
        showOnDashboard: true,
      })
      .subscribe();

    const req = httpMock.expectOne('/api/v1/signals/signal-1/alarm-definitions');
    expect(req.request.method).toBe('POST');
    expect(req.request.body.operator).toBe('>');
    req.flush({});
  });

  it('update llama a PATCH /alarm-definitions/:id', () => {
    service.update('def-1', { priority: 'CRITICAL' }).subscribe();

    const req = httpMock.expectOne('/api/v1/alarm-definitions/def-1');
    expect(req.request.method).toBe('PATCH');
    req.flush({});
  });

  it('deactivate llama a DELETE /alarm-definitions/:id', () => {
    service.deactivate('def-1').subscribe();

    const req = httpMock.expectOne('/api/v1/alarm-definitions/def-1');
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });
});
