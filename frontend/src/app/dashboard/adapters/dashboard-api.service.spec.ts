import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { DashboardApiService } from './dashboard-api.service';

describe('DashboardApiService', () => {
  let service: DashboardApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(DashboardApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('list llama a GET /dashboards con la paginación', () => {
    service.list({ limit: 20, offset: 0 }).subscribe();

    const req = httpMock.expectOne('/api/v1/dashboards?limit=20&offset=0');
    expect(req.request.method).toBe('GET');
    req.flush({ data: [], total: 0, limit: 20, offset: 0 });
  });

  it('get llama a GET /dashboards/:id', () => {
    service.get('dashboard-1').subscribe();

    const req = httpMock.expectOne('/api/v1/dashboards/dashboard-1');
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('create llama a POST /dashboards con el body', () => {
    service.create({ name: 'Planta 1' }).subscribe();

    const req = httpMock.expectOne('/api/v1/dashboards');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ name: 'Planta 1' });
    req.flush({});
  });

  it('remove llama a DELETE /dashboards/:id', () => {
    service.remove('dashboard-1').subscribe();

    const req = httpMock.expectOne('/api/v1/dashboards/dashboard-1');
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  it('createWidget llama a POST /dashboards/:id/widgets con el body', () => {
    const request = {
      widgetType: 'VALUE' as const,
      signalIds: ['signal-1'],
      config: {},
    };
    service.createWidget('dashboard-1', request).subscribe();

    const req = httpMock.expectOne('/api/v1/dashboards/dashboard-1/widgets');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(request);
    req.flush({});
  });

  it('updateWidget llama a PATCH /dashboards/:id/widgets/:widgetId', () => {
    service.updateWidget('dashboard-1', 'widget-1', { position: 2 }).subscribe();

    const req = httpMock.expectOne('/api/v1/dashboards/dashboard-1/widgets/widget-1');
    expect(req.request.method).toBe('PATCH');
    req.flush({});
  });

  it('removeWidget llama a DELETE /dashboards/:id/widgets/:widgetId', () => {
    service.removeWidget('dashboard-1', 'widget-1').subscribe();

    const req = httpMock.expectOne('/api/v1/dashboards/dashboard-1/widgets/widget-1');
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });
});
