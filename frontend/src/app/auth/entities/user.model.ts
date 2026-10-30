/** Documento 3, apartado 3.5 (`UserRole`); `Operador`: docs/specs/19-rol-operador.md. */
export type UserRole = 'SuperAdmin' | 'AdminCliente' | 'Operador';

/** Interfaz TS pura, sin imports de Angular (Documento 8, apartado 8.2). */
export interface User {
  id: string;
  email: string;
  role: UserRole;
  companyId: string;
}
