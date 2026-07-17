import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { HistoryApiService } from './history-api.service';

describe('HistoryApiService', () => {
  let service: HistoryApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(HistoryApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('getComparison llama a GET /signals/history con signalIds coma-separado, sin companyId por defecto', () => {
    service
      .getComparison(['signal-1', 'signal-2'], {
        from: new Date('2026-07-12T09:00:00Z'),
        to: new Date('2026-07-12T10:00:00Z'),
      })
      .subscribe();

    const req = httpMock.expectOne(
      '/api/v1/signals/history?signalIds=signal-1,signal-2&from=2026-07-12T09:00:00.000Z&to=2026-07-12T10:00:00.000Z',
    );
    expect(req.request.method).toBe('GET');
    req.flush({ resolution: 'raw', series: [] });
  });

  it('getComparison añade companyId solo cuando se indica explícitamente', () => {
    service
      .getComparison(
        ['signal-1'],
        { from: new Date('2026-07-12T09:00:00Z'), to: new Date('2026-07-12T10:00:00Z') },
        'company-1',
      )
      .subscribe();

    const req = httpMock.expectOne(
      '/api/v1/signals/history?signalIds=signal-1&from=2026-07-12T09:00:00.000Z&to=2026-07-12T10:00:00.000Z&companyId=company-1',
    );
    expect(req.request.method).toBe('GET');
    req.flush({ resolution: 'raw', series: [] });
  });
});
