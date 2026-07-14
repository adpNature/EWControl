import { UserRole } from '../../auth/entities/user.model';

/** Documento 3, apartado 3.2.2. Interfaz TS pura, sin imports de Angular. */
export interface ManagedUser {
  id: string;
  companyId: string;
  email: string;
  role: UserRole;
  isActive: boolean;
}

export interface CreateUserRequest {
  companyId?: string;
  email: string;
  password: string;
  role: UserRole;
}

export interface UpdateUserRequest {
  email?: string;
  role?: UserRole;
}
