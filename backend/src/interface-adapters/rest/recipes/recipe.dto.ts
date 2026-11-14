import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  Validate,
  ValidateNested,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import {
  MAX_RECIPE_DESCRIPTION_LENGTH,
  MAX_RECIPE_TITLE_LENGTH,
  type RecipeValue,
} from '../../../entities/recipe.vo';
import { PaginationQueryDto } from '../shared/pagination-query.dto';

/** El valor es un escalar; tipo y límites concretos los valida el use-case contra la variable. */
@ValidatorConstraint({ name: 'IsRecipeValue', async: false })
class IsRecipeValueConstraint implements ValidatorConstraintInterface {
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

export class RecipeValueDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  signalVariableName: string;

  @Validate(IsRecipeValueConstraint)
  value: RecipeValue;
}

/** Body de `POST /api/v1/machines/:machineId/recipes` (docs/specs/25-recetas.md). */
export class CreateRecipeDto {
  @IsString()
  @Matches(/\S/, { message: 'title no puede estar vacío.' })
  @MaxLength(MAX_RECIPE_TITLE_LENGTH)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_RECIPE_DESCRIPTION_LENGTH)
  description?: string | null;

  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => RecipeValueDto)
  values: RecipeValueDto[];
}

/** Body de `PUT .../recipes/:recipeId`: el contenido completo y la `version` que se leyó. */
export class UpdateRecipeDto extends CreateRecipeDto {
  @IsInt()
  @Min(1)
  version: number;
}

/** Query de `GET .../recipes`: paginación estándar y buscador. */
export class ListRecipesQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}
