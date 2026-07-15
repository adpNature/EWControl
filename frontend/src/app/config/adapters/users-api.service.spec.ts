import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { UsersApiService } from './users-api.service';

describe('UsersApiService', () => {
  let service: UsersApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(UsersApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('list llama a GET /users con la paginación, sin companyId si no se indica', () => {
    service.list({ limit: 20, offset: 0 }).subscribe();

    const req = httpMock.expectOne('/api/v1/users?limit=20&offset=0');
    expect(req.request.method).toBe('GET');
    req.flush({ data: [], total: 0, limit: 20, offset: 0 });
  });

  it('list incluye companyId cuando se indica (switcher de SuperAdmin)', () => {
    service.list({ limit: 20, offset: 0, companyId: 'company-1' }).subscribe();

    const req = httpMock.expectOne('/api/v1/users?limit=20&offset=0&companyId=company-1');
    expect(req.request.method).toBe('GET');
    req.flush({ data: [], total: 0, limit: 20, offset: 0 });
  });

  it('get llama a GET /users/:id', () => {
    service.get('user-1').subscribe();

    const req = httpMock.expectOne('/api/v1/users/user-1');
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('create llama a POST /users con el body', () => {
    service.create({ email: 'x@x.com', password: 'Demo1234!', role: 'AdminCliente' }).subscribe();

    const req = httpMock.expectOne('/api/v1/users');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      email: 'x@x.com',
      password: 'Demo1234!',
      role: 'AdminCliente',
    });
    req.flush({});
  });

  it('update llama a PATCH /users/:id', () => {
    service.update('user-1', { email: 'nuevo@x.com' }).subscribe();

    const req = httpMock.expectOne('/api/v1/users/user-1');
    expect(req.request.method).toBe('PATCH');
    req.flush({});
  });

  it('remove llama a DELETE /users/:id', () => {
    service.remove('user-1').subscribe();

    const req = httpMock.expectOne('/api/v1/users/user-1');
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  it('reactivate llama a POST /users/:id/reactivate', () => {
    service.reactivate('user-1').subscribe();

    const req = httpMock.expectOne('/api/v1/users/user-1/reactivate');
    expect(req.request.method).toBe('POST');
    req.flush({});
  });
});
