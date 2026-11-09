import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

/** Margen sobre el máximo de 500 entradas del `nodeMapping`: el límite real lo aplica el use-case (422). */
const MAX_ITEMS_PER_REQUEST = 2000;

/** Body de `POST /api/v1/machines/:machineId/connection/opcua/variables/sync` (docs/specs/21-sincronizacion-variables-opc-ua.md). */
export class SyncOpcUaVariablesDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1024)
  rootNodeId: string;
}

/** Variable que se guarda en el `nodeMapping` (spec 21). Forma e identificadores los valida el use-case. */
export class OpcUaVariableToSaveDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1024)
  nodeId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  signalVariableName: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  label?: string | null;

  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  dataType: string;
}

/** Body de `PUT /api/v1/machines/:machineId/connection/opcua/variables` (spec 21). */
export class SaveOpcUaVariablesDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1024)
  rootNodeId: string;

  @IsArray()
  @ArrayMaxSize(MAX_ITEMS_PER_REQUEST)
  @ValidateNested({ each: true })
  @Type(() => OpcUaVariableToSaveDto)
  variables: OpcUaVariableToSaveDto[];

  /** `nodeId` que se quitan del mapeo; ausente equivale a lista vacía. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_ITEMS_PER_REQUEST)
  @IsString({ each: true })
  @MaxLength(1024, { each: true })
  remove?: string[];
}
