import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { CompaniesApiService } from './companies-api.service';

describe('CompaniesApiService', () => {
  let service: CompaniesApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(CompaniesApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('list llama a GET /companies con la paginación', () => {
    service.list({ limit: 20, offset: 0 }).subscribe();

    const req = httpMock.expectOne('/api/v1/companies?limit=20&offset=0');
    expect(req.request.method).toBe('GET');
    req.flush({ data: [], total: 0, limit: 20, offset: 0 });
  });

  it('get llama a GET /companies/:id', () => {
    service.get('company-1').subscribe();

    const req = httpMock.expectOne('/api/v1/companies/company-1');
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('create llama a POST /companies con el body', () => {
    service.create({ name: 'ACME' }).subscribe();

    const req = httpMock.expectOne('/api/v1/companies');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ name: 'ACME' });
    req.flush({});
  });

  it('update llama a PATCH /companies/:id', () => {
    service.update('company-1', { name: 'ACME Corp' }).subscribe();

    const req = httpMock.expectOne('/api/v1/companies/company-1');
    expect(req.request.method).toBe('PATCH');
    req.flush({});
  });

  it('remove llama a DELETE /companies/:id', () => {
    service.remove('company-1').subscribe();

    const req = httpMock.expectOne('/api/v1/companies/company-1');
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  it('reactivate llama a POST /companies/:id/reactivate', () => {
    service.reactivate('company-1').subscribe();

    const req = httpMock.expectOne('/api/v1/companies/company-1/reactivate');
    expect(req.request.method).toBe('POST');
    req.flush({});
  });

  it('purge llama a DELETE /companies/:id/purge', () => {
    service.purge('company-1').subscribe();

    const req = httpMock.expectOne('/api/v1/companies/company-1/purge');
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });
});
