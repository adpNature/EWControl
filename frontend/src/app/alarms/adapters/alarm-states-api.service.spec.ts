import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AlarmStatesApiService } from './alarm-states-api.service';

describe('AlarmStatesApiService', () => {
  let service: AlarmStatesApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AlarmStatesApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('list llama a GET /alarm-states solo con limit/offset cuando no hay filtros', () => {
    service.list({}, { limit: 20, offset: 0 }).subscribe();

    const req = httpMock.expectOne('/api/v1/alarm-states?limit=20&offset=0');
    expect(req.request.method).toBe('GET');
    req.flush({ data: [], total: 0, limit: 20, offset: 0 });
  });

  it('list añade status/machineId/priority solo cuando se indican', () => {
    service
      .list(
        { status: 'ACTIVE', machineId: 'machine-1', priority: 'HIGH' },
        { limit: 20, offset: 0 },
      )
      .subscribe();

    const req = httpMock.expectOne(
      '/api/v1/alarm-states?limit=20&offset=0&status=ACTIVE&machineId=machine-1&priority=HIGH',
    );
    expect(req.request.method).toBe('GET');
    req.flush({ data: [], total: 0, limit: 20, offset: 0 });
  });

  it('get llama a GET /alarm-states/:id', () => {
    service.get('state-1').subscribe();

    const req = httpMock.expectOne('/api/v1/alarm-states/state-1');
    expect(req.request.method).toBe('GET');
    req.flush({});
  });
});
