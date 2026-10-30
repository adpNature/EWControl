import { IsEnum, IsObject } from 'class-validator';
import { ProviderType } from '../../../entities/provider-type.enum';

/**
 * Body de `PUT /api/v1/machines/:machineId/connection` (docs/11-api-rest.md,
 * sección "MachineConnection"). `connectionConfig` no se valida con una forma
 * concreta aquí porque depende de `providerType`: el use-case valida la forma
 * OpcUa con `parseOpcUaConnectionConfig` (docs/specs/18-integracion-opc-ua.md,
 * criterio backend 3) y rechaza con 422 cualquier otro proveedor no soportado.
 */
export class ReplaceMachineConnectionDto {
  @IsEnum(ProviderType)
  providerType: ProviderType;

  @IsObject()
  connectionConfig: Record<string, unknown>;
}
