import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { AuthStateService } from './auth/use-cases/auth.state';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { forbiddenInterceptor } from './core/interceptors/forbidden.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor, forbiddenInterceptor])),
    // Refresh silencioso antes de la primera navegación (docs/specs/05-auth-login.md,
    // criterio de aceptación frontend 4): el `authGuard` ya encuentra la sesión resuelta.
    provideAppInitializer(() => inject(AuthStateService).initializeSession()),
  ],
};
