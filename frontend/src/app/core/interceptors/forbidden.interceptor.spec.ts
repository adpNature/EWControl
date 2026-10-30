import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { FORBIDDEN_MESSAGE, forbiddenInterceptor } from './forbidden.interceptor';

describe('forbiddenInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let toastService: { show: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    toastService = { show: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([forbiddenInterceptor])),
        provideHttpClientTesting(),
        { provide: ToastService, useValue: toastService },
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('ante un 403 de la API muestra el toast de falta de permiso y propaga el error (spec 19)', () => {
    const error = vi.fn();
    http.delete('/api/v1/machines/machine-1').subscribe({ error });

    httpMock
      .expectOne('/api/v1/machines/machine-1')
      .flush({ code: 'FORBIDDEN' }, { status: 403, statusText: 'Forbidden' });

    expect(toastService.show).toHaveBeenCalledWith({ type: 'danger', message: FORBIDDEN_MESSAGE });
    expect(error).toHaveBeenCalled();
  });

  it('no muestra nada con otros errores ni fuera de la API', () => {
    http.get('/api/v1/machines').subscribe({ error: () => undefined });
    httpMock.expectOne('/api/v1/machines').flush({}, { status: 404, statusText: 'Not Found' });
    http.get('icons/x.svg').subscribe({ error: () => undefined });
    httpMock.expectOne('icons/x.svg').flush({}, { status: 403, statusText: 'Forbidden' });

    expect(toastService.show).not.toHaveBeenCalled();
  });
});
