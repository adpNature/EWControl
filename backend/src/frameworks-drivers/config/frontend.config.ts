/**
 * Base URL pública del Frontend, usada para construir enlaces embebidos en
 * emails (docs/specs/10-gestion-companies-users.md, recuperación de contraseña).
 * Mismo patrón que `smtp.config.ts` para centralizar la lectura de variables de entorno.
 */
export function frontendBaseUrl(): string {
  return process.env.FRONTEND_BASE_URL ?? 'http://localhost:4200';
}
