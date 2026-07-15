import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { render } from '@testing-library/angular';
import { of } from 'rxjs';
import { AuthStateService } from '../../../auth/use-cases/auth.state';
import { AppShellComponent } from './app-shell.component';

describe('AppShellComponent', () => {
  it('renderiza la sidebar y el router-outlet de la zona privada', async () => {
    const authState = {
      currentUser: () => ({ email: 'demo@ewcontrol.local', role: 'AdminCliente' }),
      logout: vi.fn().mockReturnValue(of(undefined)),
    };

    const { container } = await render(AppShellComponent, {
      providers: [
        { provide: AuthStateService, useValue: authState },
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    expect(container.querySelector('app-sidebar')).toBeTruthy();
    expect(container.querySelector('router-outlet')).toBeTruthy();
  });
});
