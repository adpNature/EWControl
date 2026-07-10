import { IsEnum, IsObject } from 'class-validator';
import { ProviderType } from '../../../entities/provider-type.enum';

/**
 * Body de `PUT /api/v1/machines/:machineId/connection` (docs/11-api-rest.md,
 * sección "MachineConnection"). `connectionConfig` no se valida con una forma
 * concreta aquí: cualquier `providerType` distinto de Simulator responde 422
 * antes de que el use-case mire su contenido (docs/specs/06-gestion-machines-signals.md,
 * criterio de aceptación backend 4).
 */
export class ReplaceMachineConnectionDto {
  @IsEnum(ProviderType)
  providerType: ProviderType;

  @IsObject()
  connectionConfig: Record<string, unknown>;
}
