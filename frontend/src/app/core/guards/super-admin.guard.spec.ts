import {
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot,
  provideRouter,
} from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { AuthStateService } from '../../auth/use-cases/auth.state';
import { superAdminGuard } from './super-admin.guard';

describe('superAdminGuard', () => {
  let currentUser: ReturnType<typeof vi.fn>;
  let router: Router;

  beforeEach(() => {
    currentUser = vi.fn();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: AuthStateService, useValue: { currentUser } }],
    });
    router = TestBed.inject(Router);
  });

  it('permite el acceso si el rol es SuperAdmin', () => {
    currentUser.mockReturnValue({ role: 'SuperAdmin' });

    const result = TestBed.runInInjectionContext(() =>
      superAdminGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    );

    expect(result).toBe(true);
  });

  it('redirige a /config si el rol no es SuperAdmin', () => {
    currentUser.mockReturnValue({ role: 'AdminCliente' });

    const result = TestBed.runInInjectionContext(() =>
      superAdminGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    );

    const urlTree = router.createUrlTree(['/config']);
    expect(result).toEqual(urlTree);
  });

  it('redirige a /config si no hay usuario', () => {
    currentUser.mockReturnValue(null);

    const result = TestBed.runInInjectionContext(() =>
      superAdminGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    );

    const urlTree = router.createUrlTree(['/config']);
    expect(result).toEqual(urlTree);
  });
});
