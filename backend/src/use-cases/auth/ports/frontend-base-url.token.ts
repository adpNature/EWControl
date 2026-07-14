/**
 * Token de inyección para la base URL pública del Frontend (docs/specs/10-gestion-companies-users.md):
 * el use-case nunca lee `process.env` directamente (Documento 0, capas), solo
 * recibe el valor ya resuelto por `frameworks-drivers/config/frontend.config.ts`.
 */
export const FRONTEND_BASE_URL = Symbol('FrontendBaseUrl');
