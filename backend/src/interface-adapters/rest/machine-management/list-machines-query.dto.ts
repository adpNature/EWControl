import { IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../shared/pagination-query.dto';

/**
 * Query de `GET /api/v1/machines`. `companyId` solo tiene efecto cuando el
 * requester es `SuperAdmin` (docs/specs/14-historicos-comparativas.md, necesario
 * para el selector cross-Machine acotado a una Company) — un `AdminCliente` lo
 * ignora siempre (`ListMachinesUseCase`). Mismo patrón que `ListUsersQueryDto`.
 */
export class ListMachinesQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID()
  companyId?: string;
}
