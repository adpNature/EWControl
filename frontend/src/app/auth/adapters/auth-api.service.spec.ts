import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AuthApiService } from './auth-api.service';

describe('AuthApiService', () => {
  let service: AuthApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AuthApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('changePassword llama a PATCH /users/me/password con el body', () => {
    service.changePassword('actual', 'nueva').subscribe();

    const req = httpMock.expectOne('/api/v1/users/me/password');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ currentPassword: 'actual', newPassword: 'nueva' });
    req.flush({});
  });

  it('forgotPassword llama a POST /auth/forgot-password con el email', () => {
    service.forgotPassword('demo@ewcontrol.local').subscribe();

    const req = httpMock.expectOne('/api/v1/auth/forgot-password');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ email: 'demo@ewcontrol.local' });
    req.flush({});
  });

  it('resetPassword llama a POST /auth/reset-password con el token y la nueva contraseña', () => {
    service.resetPassword('token-1', 'Nueva1234!').subscribe();

    const req = httpMock.expectOne('/api/v1/auth/reset-password');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ token: 'token-1', newPassword: 'Nueva1234!' });
    req.flush({});
  });
});
