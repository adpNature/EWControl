import { describe, expect, it, vi } from 'vitest';
import { UserRole } from '../../../entities/user-role.enum';
import { InvalidRecipeTemplateError } from '../../../use-cases/recipes/errors/invalid-recipe-template.error';
import { RecipeTemplateInvalidError } from '../../../use-cases/recipes/errors/recipe-template-invalid.error';
import { RecipeTemplateModifiedError } from '../../../use-cases/recipes/errors/recipe-template-modified.error';
import type { CurrentUser } from '../../auth-guard/current-user';
import { toHttpException } from './recipe.controller';
import { RecipeTemplateController, toTemplateContent } from './recipe-template.controller';
import type { RecipeTemplateContentDto, SaveRecipeTemplateDto } from './recipe-template.dto';

const USER: CurrentUser = {
  id: 'user-1',
  email: 'admin@ewcontrol.local',
  companyId: 'company-1',
  role: UserRole.AdminCliente,
};

const DTO: RecipeTemplateContentDto = {
  variables: [
    {
      signalVariableName: 'rEspiras',
      mode: 'EDITABLE',
      label: '  Espiras ',
      helpText: '   ',
      unit: 'vueltas',
      max: 500,
    },
    {
      signalVariableName: 'xSentidoCabezal',
      mode: 'FIXED_VISIBLE',
      booleanLabels: { falseLabel: ' Horario ', trueLabel: 'Antihorario ' },
      fixedValue: false,
    },
    {
      signalVariableName: 'iModo',
      mode: 'EDITABLE',
      options: [
        { value: 0, label: ' A ' },
        { value: 1, label: 'B' },
      ],
      defaultValue: 0,
    },
  ],
  layout: {
    rows: [
      { items: [{ type: 'TITLE', span: 12, text: '  Bobinado ', signalVariableName: 'x' }] },
      {
        items: [
          { type: 'VARIABLE', span: 6, signalVariableName: 'rEspiras', text: 'x' },
          { type: 'SPACER', span: 6, text: 'x' },
        ],
      },
      { items: [{ type: 'VARIABLE', span: 12 }] },
    ],
  },
};

function createController() {
  const useCases = {
    get: { execute: vi.fn().mockResolvedValue({ isDefault: true }) },
    save: { execute: vi.fn().mockResolvedValue({ isDefault: false }) },
    impact: { execute: vi.fn().mockResolvedValue({ recipesBecomingIncomplete: 0 }) },
  };
  const controller = new RecipeTemplateController(
    useCases.get as never,
    useCases.save as never,
    useCases.impact as never,
  );
  return { controller, useCases };
}

describe('RecipeTemplateController (docs/specs/26-receta-base.md)', () => {
  it('consulta la receta base de la Machine', async () => {
    const { controller, useCases } = createController();

    await controller.get('machine-1', USER);

    expect(useCases.get.execute).toHaveBeenCalledWith({
      machineId: 'machine-1',
      requester: { companyId: 'company-1', role: UserRole.AdminCliente },
    });
  });

  it('guarda con el email del usuario y la versión leída', async () => {
    const { controller, useCases } = createController();
    const dto = { ...DTO, version: 3 } as SaveRecipeTemplateDto;

    await controller.save('machine-1', dto, USER);

    expect(useCases.save.execute).toHaveBeenCalledWith({
      machineId: 'machine-1',
      requester: { companyId: 'company-1', role: UserRole.AdminCliente },
      actorEmail: 'admin@ewcontrol.local',
      content: toTemplateContent(DTO),
      version: 3,
    });
  });

  it('calcula el impacto con el contenido propuesto', async () => {
    const { controller, useCases } = createController();

    await controller.impact('machine-1', DTO, USER);

    expect(useCases.impact.execute).toHaveBeenCalledWith(
      expect.objectContaining({ content: toTemplateContent(DTO) }),
    );
  });

  it('convierte los errores del caso de uso en la respuesta HTTP', async () => {
    const { controller, useCases } = createController();
    useCases.save.execute.mockRejectedValue(new RecipeTemplateModifiedError('machine-1'));

    await expect(
      controller.save('machine-1', { ...DTO, version: 1 } as SaveRecipeTemplateDto, USER),
    ).rejects.toMatchObject({ status: 409 });
  });
});

describe('toTemplateContent', () => {
  it('recorta textos, deja en null lo vacío o ausente y limpia cada elemento según su tipo', () => {
    const content = toTemplateContent(DTO);

    expect(content.variables[0]).toEqual({
      signalVariableName: 'rEspiras',
      mode: 'EDITABLE',
      label: 'Espiras',
      helpText: null,
      unit: 'vueltas',
      decimals: null,
      min: null,
      max: 500,
      minLength: null,
      maxLength: null,
      booleanLabels: null,
      options: null,
      defaultValue: null,
      fixedValue: null,
    });
    expect(content.variables[1]).toMatchObject({
      booleanLabels: { falseLabel: 'Horario', trueLabel: 'Antihorario' },
      fixedValue: false,
    });
    expect(content.variables[2]).toMatchObject({
      options: [
        { value: 0, label: 'A' },
        { value: 1, label: 'B' },
      ],
      defaultValue: 0,
    });
    expect(content.layout.rows).toEqual([
      { items: [{ type: 'TITLE', span: 12, text: 'Bobinado' }] },
      {
        items: [
          { type: 'VARIABLE', span: 6, signalVariableName: 'rEspiras' },
          { type: 'SPACER', span: 6 },
        ],
      },
      { items: [{ type: 'VARIABLE', span: 12, signalVariableName: '' }] },
    ]);
  });
});

describe('toHttpException (spec 26)', () => {
  it('INVALID_RECIPE_TEMPLATE lleva el detalle por variable y por fila', () => {
    const issues = [{ row: 0, reason: 'EMPTY_ROW' as const }];
    const exception = toHttpException(new InvalidRecipeTemplateError(issues));

    expect(exception.getStatus()).toBe(400);
    expect(exception.getResponse()).toMatchObject({
      code: 'INVALID_RECIPE_TEMPLATE',
      details: issues,
    });
  });

  it('RECIPE_TEMPLATE_MODIFIED y RECIPE_TEMPLATE_INVALID son 409', () => {
    for (const [error, code] of [
      [new RecipeTemplateModifiedError('m'), 'RECIPE_TEMPLATE_MODIFIED'],
      [new RecipeTemplateInvalidError('m'), 'RECIPE_TEMPLATE_INVALID'],
    ] as const) {
      const exception = toHttpException(error);
      expect(exception.getStatus()).toBe(409);
      expect(exception.getResponse()).toMatchObject({ code });
    }
  });
});
