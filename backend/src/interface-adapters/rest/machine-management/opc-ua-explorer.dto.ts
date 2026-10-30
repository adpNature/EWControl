import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Body de `POST /api/v1/machines/:machineId/connection/opcua/test`
 * (docs/specs/18-integracion-opc-ua.md). El esquema `opc.tcp://` y la allowlist
 * anti-SSRF se validan en el use-case (`OpcUaEndpointPolicy`), no aquí.
 */
export class TestOpcUaConnectionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2048)
  endpointUrl: string;
}

/** Body de `POST /api/v1/machines/:machineId/connection/opcua/browse` (spec 18). */
export class BrowseOpcUaNodesDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2048)
  endpointUrl: string;

  /** Sin `nodeId` se exploran los hijos de `ObjectsFolder`. */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(1024)
  nodeId?: string;
}
