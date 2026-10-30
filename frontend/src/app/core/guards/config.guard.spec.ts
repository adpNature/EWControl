import {
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot,
  provideRouter,
} from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { AuthStateService } from '../../auth/use-cases/auth.state';
import { configGuard } from './config.guard';

describe('configGuard', () => {
  let currentUser: ReturnType<typeof vi.fn>;
  let router: Router;

  beforeEach(() => {
    currentUser = vi.fn();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: AuthStateService, useValue: { currentUser } }],
    });
    router = TestBed.inject(Router);
  });

  function runGuard() {
    return TestBed.runInInjectionContext(() =>
      configGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    );
  }

  it.each(['AdminCliente', 'SuperAdmin'])('permite el acceso a /config al rol %s', (role) => {
    currentUser.mockReturnValue({ role });

    expect(runGuard()).toBe(true);
  });

  it('redirige al Dashboard a un Operador (spec 19, criterio frontend 3)', () => {
    currentUser.mockReturnValue({ role: 'Operador' });

    expect(runGuard()).toEqual(router.createUrlTree(['/dashboard']));
  });

  it('redirige al Dashboard si no hay usuario', () => {
    currentUser.mockReturnValue(null);

    expect(runGuard()).toEqual(router.createUrlTree(['/dashboard']));
  });
});
