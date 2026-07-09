import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { AuthApiService } from '../adapters/auth-api.service';
import { LoginResponse, RefreshResponse } from '../entities/auth-session.model';
import { User } from '../entities/user.model';
import { AuthStateService } from './auth.state';
import { decodeAccessToken } from './decode-access-token';

const DEMO_USER: User = {
  id: 'user-1',
  email: 'demo@ewcontrol.local',
  role: 'AdminCliente',
  companyId: 'company-1',
};

function fakeJwt(payload: unknown): string {
  const base64Url = (input: string) =>
    btoa(input).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${base64Url('{}')}.${base64Url(JSON.stringify(payload))}.sig`;
}

describe('AuthStateService', () => {
  let service: AuthStateService;
  let authApi: {
    login: ReturnType<typeof vi.fn>;
    refresh: ReturnType<typeof vi.fn>;
    logout: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    authApi = { login: vi.fn(), refresh: vi.fn(), logout: vi.fn() };
    TestBed.configureTestingModule({
      providers: [{ provide: AuthApiService, useValue: authApi }],
    });
    service = TestBed.inject(AuthStateService);
  });

  it('login() en éxito guarda el accessToken y el user devuelto por el backend', async () => {
    const response: LoginResponse = { accessToken: 'access-token', user: DEMO_USER };
    authApi.login.mockReturnValue(of(response));

    const user = await new Promise((resolve, reject) =>
      service.login(DEMO_USER.email, 'Demo1234!').subscribe({ next: resolve, error: reject }),
    );

    expect(user).toEqual(DEMO_USER);
    expect(service.currentUser()).toEqual(DEMO_USER);
    expect(service.accessToken()).toBe('access-token');
    expect(service.isAuthenticated()).toBe(true);
  });

  it('login() en fallo no modifica el estado de sesión', async () => {
    authApi.login.mockReturnValue(throwError(() => ({ status: 401, code: 'INVALID_CREDENTIALS' })));

    await expect(
      new Promise((resolve, reject) =>
        service.login(DEMO_USER.email, 'incorrecta').subscribe({ next: resolve, error: reject }),
      ),
    ).rejects.toBeTruthy();

    expect(service.isAuthenticated()).toBe(false);
    expect(service.accessToken()).toBeNull();
  });

  it('nunca persiste el accessToken en localStorage/sessionStorage (criterio 2)', async () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    authApi.login.mockReturnValue(of({ accessToken: 'access-token', user: DEMO_USER }));

    await new Promise((resolve, reject) =>
      service.login(DEMO_USER.email, 'Demo1234!').subscribe({ next: resolve, error: reject }),
    );

    expect(setItemSpy).not.toHaveBeenCalled();
    setItemSpy.mockRestore();
  });

  it('logout() limpia la sesión aunque la petición al backend falle', async () => {
    authApi.login.mockReturnValue(of({ accessToken: 'access-token', user: DEMO_USER }));
    await new Promise((resolve, reject) =>
      service.login(DEMO_USER.email, 'Demo1234!').subscribe({ next: resolve, error: reject }),
    );
    authApi.logout.mockReturnValue(throwError(() => new Error('network error')));

    await expect(
      new Promise((resolve, reject) =>
        service.logout().subscribe({ next: resolve, error: reject }),
      ),
    ).rejects.toBeTruthy();

    expect(service.isAuthenticated()).toBe(false);
    expect(service.accessToken()).toBeNull();
  });

  it('refresh() decodifica el nuevo accessToken y actualiza currentUser', async () => {
    const token = fakeJwt({
      sub: 'user-1',
      email: DEMO_USER.email,
      companyId: 'company-1',
      role: 'AdminCliente',
    });
    const response: RefreshResponse = { accessToken: token };
    authApi.refresh.mockReturnValue(of(response));

    const accessToken = await new Promise((resolve, reject) =>
      service.refresh().subscribe({ next: resolve, error: reject }),
    );

    expect(accessToken).toBe(token);
    expect(service.currentUser()).toEqual(decodeAccessToken(token));
    expect(service.isAuthenticated()).toBe(true);
  });

  it('refresh() es single-flight: dos llamadas concurrentes disparan una sola petición HTTP', () => {
    const subject = new Subject<RefreshResponse>();
    authApi.refresh.mockReturnValue(subject.asObservable());

    const first = service.refresh();
    const second = service.refresh();
    first.subscribe();
    second.subscribe();

    expect(authApi.refresh).toHaveBeenCalledTimes(1);
    subject.next({
      accessToken: fakeJwt({ sub: 'u', email: 'e', companyId: 'c', role: 'AdminCliente' }),
    });
    subject.complete();
  });

  it('refresh() en fallo limpia la sesión y propaga el error', async () => {
    authApi.refresh.mockReturnValue(throwError(() => new Error('refresh token inválido')));

    await expect(
      new Promise((resolve, reject) =>
        service.refresh().subscribe({ next: resolve, error: reject }),
      ),
    ).rejects.toBeTruthy();

    expect(service.isAuthenticated()).toBe(false);
  });

  it('initializeSession() nunca rechaza aunque el refresh falle (no bloquea el arranque)', async () => {
    authApi.refresh.mockReturnValue(throwError(() => new Error('sin cookie de sesión')));

    await expect(service.initializeSession()).resolves.toBeUndefined();
    expect(service.isAuthenticated()).toBe(false);
  });
});
