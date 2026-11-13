import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { MAX_NODE_ID_LENGTH } from '../../../entities/connection-config.vo';
import { GVL_EXPORT_LIMITS } from '../../../entities/gvl-export';

/** Body de `POST /api/v1/machines/:machineId/variable-categories/import` (docs/specs/23-categorias-variables-plc.md). */
export class ImportVariableCategoriesDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_NODE_ID_LENGTH)
  rootNodeId: string;

  /** Contenido del CSV exportado de CODESYS, ya decodificado a texto. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(GVL_EXPORT_LIMITS.maxCsvLength)
  csv: string;
}

/** Body de `PATCH /api/v1/machines/:machineId/variable-categories/:id` (spec 23). La longitud real la valida el use-case. */
export class RenameVariableCategoryDto {
  @IsString()
  @MaxLength(500)
  name: string;
}
