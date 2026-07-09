import {
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot,
  provideRouter,
} from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { AuthStateService } from '../../auth/use-cases/auth.state';
import { authGuard } from './auth.guard';

describe('authGuard', () => {
  let isAuthenticated: ReturnType<typeof vi.fn>;
  let router: Router;

  beforeEach(() => {
    isAuthenticated = vi.fn();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: AuthStateService, useValue: { isAuthenticated } }],
    });
    router = TestBed.inject(Router);
  });

  it('permite el acceso si hay sesión activa', () => {
    isAuthenticated.mockReturnValue(true);

    const result = TestBed.runInInjectionContext(() =>
      authGuard({} as ActivatedRouteSnapshot, { url: '/dashboard' } as RouterStateSnapshot),
    );

    expect(result).toBe(true);
  });

  it('redirige a /login con returnUrl si no hay sesión activa', () => {
    isAuthenticated.mockReturnValue(false);

    const result = TestBed.runInInjectionContext(() =>
      authGuard({} as ActivatedRouteSnapshot, { url: '/dashboard' } as RouterStateSnapshot),
    );

    const urlTree = router.createUrlTree(['/login'], { queryParams: { returnUrl: '/dashboard' } });
    expect(result).toEqual(urlTree);
  });
});
