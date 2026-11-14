import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  Validate,
  ValidateNested,
} from 'class-validator';
import {
  MAX_BOOLEAN_LABEL_LENGTH,
  MAX_LAYOUT_ROWS,
  MAX_LAYOUT_TEXT_LENGTH,
  MAX_OPTION_LABEL_LENGTH,
  MAX_TEMPLATE_HELP_TEXT_LENGTH,
  MAX_TEMPLATE_LABEL_LENGTH,
  MAX_TEMPLATE_OPTIONS,
  MAX_TEMPLATE_UNIT_LENGTH,
  RECIPE_LAYOUT_ITEM_TYPES,
  RECIPE_VARIABLE_MODES,
  type RecipeLayoutItemType,
  type RecipeVariableMode,
} from '../../../entities/recipe-template.vo';
import type { RecipeValue } from '../../../entities/recipe.vo';
import { IsRecipeValueConstraint } from './recipe.dto';

const NOT_BLANK = /\S/;
const FINITE = { allowNaN: false, allowInfinity: false };

export class BooleanLabelsDto {
  @IsString()
  @Matches(NOT_BLANK)
  @MaxLength(MAX_BOOLEAN_LABEL_LENGTH)
  falseLabel: string;

  @IsString()
  @Matches(NOT_BLANK)
  @MaxLength(MAX_BOOLEAN_LABEL_LENGTH)
  trueLabel: string;
}

export class RecipeOptionDto {
  @IsNumber(FINITE)
  value: number;

  @IsString()
  @Matches(NOT_BLANK)
  @MaxLength(MAX_OPTION_LABEL_LENGTH)
  label: string;
}

/**
 * Configuración de una variable (docs/specs/26-receta-base.md, "Configuración de
 * una variable"). Aquí solo se comprueban forma y tamaños; qué campos aplican a
 * cada tipo y modo, rangos y valores los valida el dominio contra la variable.
 */
export class RecipeVariableConfigDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  signalVariableName: string;

  @IsIn(RECIPE_VARIABLE_MODES)
  mode: RecipeVariableMode;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_TEMPLATE_LABEL_LENGTH)
  label?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_TEMPLATE_HELP_TEXT_LENGTH)
  helpText?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_TEMPLATE_UNIT_LENGTH)
  unit?: string | null;

  @IsOptional()
  @IsInt()
  decimals?: number | null;

  @IsOptional()
  @IsNumber(FINITE)
  min?: number | null;

  @IsOptional()
  @IsNumber(FINITE)
  max?: number | null;

  @IsOptional()
  @IsInt()
  minLength?: number | null;

  @IsOptional()
  @IsInt()
  maxLength?: number | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => BooleanLabelsDto)
  booleanLabels?: BooleanLabelsDto | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_TEMPLATE_OPTIONS)
  @ValidateNested({ each: true })
  @Type(() => RecipeOptionDto)
  options?: RecipeOptionDto[] | null;

  @IsOptional()
  @Validate(IsRecipeValueConstraint)
  defaultValue?: RecipeValue | null;

  @IsOptional()
  @Validate(IsRecipeValueConstraint)
  fixedValue?: RecipeValue | null;
}

export class RecipeLayoutItemDto {
  @IsIn(RECIPE_LAYOUT_ITEM_TYPES)
  type: RecipeLayoutItemType;

  @IsInt()
  span: number;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_LAYOUT_TEXT_LENGTH)
  text?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  signalVariableName?: string;
}

export class RecipeLayoutRowDto {
  @IsArray()
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => RecipeLayoutItemDto)
  items: RecipeLayoutItemDto[];
}

export class RecipeLayoutDto {
  @IsArray()
  @ArrayMaxSize(MAX_LAYOUT_ROWS)
  @ValidateNested({ each: true })
  @Type(() => RecipeLayoutRowDto)
  rows: RecipeLayoutRowDto[];
}

/** Body de `POST …/recipe-template/impact`: la receta base propuesta. */
export class RecipeTemplateContentDto {
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => RecipeVariableConfigDto)
  variables: RecipeVariableConfigDto[];

  @ValidateNested()
  @Type(() => RecipeLayoutDto)
  layout: RecipeLayoutDto;
}

/** Body de `PUT …/recipe-template`: la receta base y la `version` que se leyó (0 = la por defecto). */
export class SaveRecipeTemplateDto extends RecipeTemplateContentDto {
  @IsInt()
  @Min(0)
  version: number;
}
