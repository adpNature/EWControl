import { IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../shared/pagination-query.dto';

/**
 * Query de `GET /api/v1/users`. `companyId` solo tiene efecto cuando el
 * requester es `SuperAdmin` (docs/08-frontend-dashboard.md, 8.8, switcher de
 * Company) — un `AdminCliente` lo ignora siempre (`ListUsersUseCase`).
 */
export class ListUsersQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID()
  companyId?: string;
}
