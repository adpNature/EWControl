import { User } from '../../../entities/user.entity';
import { UserRole } from '../../../entities/user-role.enum';

/**
 * docs/specs/10-gestion-companies-users.md, criterio de aceptación backend
 * (flujo principal): la API nunca devuelve `passwordHash`, ni siquiera hasheado.
 */
export interface UserResponse {
  id: string;
  companyId: string;
  email: string;
  role: UserRole;
  isActive: boolean;
}

export function toUserResponse(user: User): UserResponse {
  return {
    id: user.id,
    companyId: user.companyId,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
  };
}
