import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Validate,
  ValidateNested,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import type { WriteValue } from '../../../entities/write-package.vo';

/** El valor de un elemento es un escalar; tipo y límites concretos los valida el use-case. */
@ValidatorConstraint({ name: 'IsWriteValue', async: false })
class IsWriteValueConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return (
      typeof value === 'boolean' ||
      typeof value === 'string' ||
      (typeof value === 'number' && Number.isFinite(value))
    );
  }

  defaultMessage(): string {
    return 'value debe ser un número, un booleano o un texto.';
  }
}

export class WritePackageItemDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  signalVariableName: string;

  @Validate(IsWriteValueConstraint)
  value: WriteValue;
}

/**
 * Body de `POST /api/v1/machines/:machineId/write-packages`
 * (docs/specs/20-paquetes-escritura-opc-ua.md).
 */
export class CreateWritePackageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => WritePackageItemDto)
  items: WritePackageItemDto[];
}

/** Body de `PATCH .../write-packages/:id`: todos los campos opcionales. */
export class UpdateWritePackageDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => WritePackageItemDto)
  items?: WritePackageItemDto[];
}
