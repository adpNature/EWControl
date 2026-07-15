import { Injectable } from '@angular/core';

/**
 * Wrapper fino sobre `window.localStorage` (docs/specs/12-navegacion-shell.md):
 * primer uso de storage del navegador en el Frontend, para la preferencia de
 * colapso de la sidebar — no confundir con el `accessToken`, que nunca vive
 * aquí (`auth/use-cases/auth.state.ts`, OWASP A03). El `try/catch` evita que un
 * storage deshabilitado (modo privado, cuota agotada) rompa la aplicación.
 */
@Injectable({ providedIn: 'root' })
export class LocalStorageService {
  getItem(key: string): string | null {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  setItem(key: string, value: string): void {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // Storage deshabilitado: la preferencia simplemente no se persiste.
    }
  }
}
