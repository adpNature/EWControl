import {
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot,
  provideRouter,
} from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { AuthStateService } from '../../auth/use-cases/auth.state';
import { redirectIfAuthenticatedGuard } from './redirect-if-authenticated.guard';

describe('redirectIfAuthenticatedGuard', () => {
  let isAuthenticated: ReturnType<typeof vi.fn>;
  let router: Router;

  beforeEach(() => {
    isAuthenticated = vi.fn();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: AuthStateService, useValue: { isAuthenticated } }],
    });
    router = TestBed.inject(Router);
  });

  it('redirige a /dashboard si ya hay sesión activa', () => {
    isAuthenticated.mockReturnValue(true);

    const result = TestBed.runInInjectionContext(() =>
      redirectIfAuthenticatedGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    );

    expect(result).toEqual(router.createUrlTree(['/dashboard']));
  });

  it('permite el acceso a la landing si no hay sesión activa', () => {
    isAuthenticated.mockReturnValue(false);

    const result = TestBed.runInInjectionContext(() =>
      redirectIfAuthenticatedGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    );

    expect(result).toBe(true);
  });
});
