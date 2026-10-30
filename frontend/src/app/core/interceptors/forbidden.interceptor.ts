import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { ToastService } from '../../shared/ui/toast/toast.service';

const API_PREFIX = '/api/v1';
export const FORBIDDEN_MESSAGE = 'No tienes permiso para realizar esta acción.';

/**
 * docs/specs/19-rol-operador.md, criterio de aceptación frontend 6: un `403`
 * de la API (rol sin permiso, `RolesGuard`) se notifica con un toast sin
 * cerrar la sesión. El error se propaga igualmente para que cada pantalla
 * pueda reaccionar (p. ej. salir de su estado "Guardando…").
 */
export const forbiddenInterceptor: HttpInterceptorFn = (req, next) => {
  const toastService = inject(ToastService);

  if (!req.url.startsWith(API_PREFIX)) {
    return next(req);
  }

  return next(req).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 403) {
        toastService.show({ type: 'danger', message: FORBIDDEN_MESSAGE });
      }
      return throwError(() => error);
    }),
  );
};
