import { Router } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';
import { AuthStateService } from '../../../auth/use-cases/auth.state';
import { DashboardPage } from './dashboard-page';

describe('DashboardPage', () => {
  it('muestra el email del usuario actual', async () => {
    await render(DashboardPage, {
      providers: [
        {
          provide: AuthStateService,
          useValue: { currentUser: () => ({ email: 'demo@ewcontrol.local' }), logout: vi.fn() },
        },
        { provide: Router, useValue: { navigateByUrl: vi.fn() } },
      ],
    });

    expect(screen.getByText(/demo@ewcontrol\.local/)).toBeInTheDocument();
  });

  it('el botón "Cerrar sesión" llama a logout() y navega a /login', async () => {
    const logout = vi.fn().mockReturnValue(of(undefined));
    const navigateByUrl = vi.fn();
    await render(DashboardPage, {
      providers: [
        {
          provide: AuthStateService,
          useValue: { currentUser: () => ({ email: 'demo@ewcontrol.local' }), logout },
        },
        { provide: Router, useValue: { navigateByUrl } },
      ],
    });

    await userEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));

    expect(logout).toHaveBeenCalled();
    expect(navigateByUrl).toHaveBeenCalledWith('/login');
  });
});
