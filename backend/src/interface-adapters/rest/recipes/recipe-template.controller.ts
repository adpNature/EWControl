import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Put } from '@nestjs/common';
import type {
  RecipeLayoutItem,
  RecipeTemplateContent,
  RecipeVariableConfig,
  TemplateImpact,
} from '../../../entities/recipe-template.vo';
import {
  GetRecipeTemplateUseCase,
  PreviewRecipeTemplateImpactUseCase,
  type RecipeTemplateView,
  SaveRecipeTemplateUseCase,
} from '../../../use-cases/recipes/recipe-template.use-cases';
import type { CurrentUser } from '../../auth-guard/current-user';
import { currentUser } from '../../auth-guard/current-user.decorator';
import { CONFIGURATION_ROLES, roles } from '../../auth-guard/roles.decorator';
import { runRecipeWork } from './recipe.controller';
import {
  type RecipeLayoutItemDto,
  RecipeTemplateContentDto,
  type RecipeVariableConfigDto,
  SaveRecipeTemplateDto,
} from './recipe-template.dto';

/**
 * docs/specs/26-receta-base.md, sección "Contrato". Solo `AdminCliente` y
 * `SuperAdmin`: el `Operador` usa el resultado en el formulario de recetas pero
 * no ve ni edita la receta base.
 */
@roles(...CONFIGURATION_ROLES)
@Controller('machines/:machineId/recipe-template')
export class RecipeTemplateController {
  constructor(
    private readonly getTemplate: GetRecipeTemplateUseCase,
    private readonly saveTemplate: SaveRecipeTemplateUseCase,
    private readonly previewImpact: PreviewRecipeTemplateImpactUseCase,
  ) {}

  @Get()
  get(
    @Param('machineId') machineId: string,
    @currentUser() user: CurrentUser,
  ): Promise<RecipeTemplateView> {
    return runRecipeWork(() =>
      this.getTemplate.execute({ machineId, requester: requesterOf(user) }),
    );
  }

  @Put()
  save(
    @Param('machineId') machineId: string,
    @Body() dto: SaveRecipeTemplateDto,
    @currentUser() user: CurrentUser,
  ): Promise<RecipeTemplateView> {
    return runRecipeWork(() =>
      this.saveTemplate.execute({
        machineId,
        requester: requesterOf(user),
        actorEmail: user.email,
        content: toTemplateContent(dto),
        version: dto.version,
      }),
    );
  }

  /** Solo calcula: no guarda nada (spec 26, criterio backend 4). */
  @Post('impact')
  @HttpCode(HttpStatus.OK)
  impact(
    @Param('machineId') machineId: string,
    @Body() dto: RecipeTemplateContentDto,
    @currentUser() user: CurrentUser,
  ): Promise<TemplateImpact> {
    return runRecipeWork(() =>
      this.previewImpact.execute({
        machineId,
        requester: requesterOf(user),
        content: toTemplateContent(dto),
      }),
    );
  }
}

function requesterOf(user: CurrentUser) {
  return { companyId: user.companyId, role: user.role };
}

/**
 * Normaliza el body al contenido del dominio: textos recortados (en blanco =
 * sin configurar), campos ausentes como `null` y cada elemento de la
 * disposición solo con los campos de su tipo.
 */
export function toTemplateContent(dto: RecipeTemplateContentDto): RecipeTemplateContent {
  return {
    variables: dto.variables.map(toVariableConfig),
    layout: { rows: dto.layout.rows.map((row) => ({ items: row.items.map(toLayoutItem) })) },
  };
}

function toVariableConfig(dto: RecipeVariableConfigDto): RecipeVariableConfig {
  return {
    signalVariableName: dto.signalVariableName,
    mode: dto.mode,
    label: textOrNull(dto.label),
    helpText: textOrNull(dto.helpText),
    unit: textOrNull(dto.unit),
    decimals: dto.decimals ?? null,
    min: dto.min ?? null,
    max: dto.max ?? null,
    minLength: dto.minLength ?? null,
    maxLength: dto.maxLength ?? null,
    booleanLabels: dto.booleanLabels
      ? {
          falseLabel: dto.booleanLabels.falseLabel.trim(),
          trueLabel: dto.booleanLabels.trueLabel.trim(),
        }
      : null,
    options: dto.options
      ? dto.options.map((option) => ({ value: option.value, label: option.label.trim() }))
      : null,
    defaultValue: dto.defaultValue ?? null,
    fixedValue: dto.fixedValue ?? null,
  };
}

function toLayoutItem(dto: RecipeLayoutItemDto): RecipeLayoutItem {
  if (dto.type === 'TITLE' || dto.type === 'TEXT') {
    return { type: dto.type, span: dto.span, text: (dto.text ?? '').trim() };
  }
  if (dto.type === 'VARIABLE') {
    return { type: 'VARIABLE', span: dto.span, signalVariableName: dto.signalVariableName ?? '' };
  }
  return { type: 'SPACER', span: dto.span };
}

function textOrNull(value: string | null | undefined): string | null {
  return value?.trim() ? value.trim() : null;
}
