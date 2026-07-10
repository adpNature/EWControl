/** Documento 3, apartado 3.5 (`UserRole`). */
export type UserRole = 'SuperAdmin' | 'AdminCliente';

/** Interfaz TS pura, sin imports de Angular (Documento 8, apartado 8.2). */
export interface User {
  id: string;
  email: string;
  role: UserRole;
  companyId: string;
}
