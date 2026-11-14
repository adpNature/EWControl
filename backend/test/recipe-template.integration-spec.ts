/**
 * Test de integración (Documento 0, "Pirámide de Testing") de
 * docs/specs/26-receta-base.md: arranca `RecipesModule` real contra el Postgres
 * de `docker compose`, sin pasar por HTTP. Un único flujo ejercita lo que no
 * cubren los unitarios: el JSONB de `recipe_templates`, el alta con versión 0
 * (`ON CONFLICT DO NOTHING`), el control de versión en el `UPDATE`, el impacto
 * calculado sobre las recetas reales y que reimportar la GVL deja las variables
 * nuevas ocultas sin tocar la completitud de las recetas.
 */
import { INestApplicationContext } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { RecipeTemplateContent } from '../src/entities/recipe-template.vo';
import { UserRole } from '../src/entities/user-role.enum';
import { RecipesModule } from '../src/frameworks-drivers/recipes.module';
import { SeedModule } from '../src/frameworks-drivers/seed.module';
import { VariableCategoriesModule } from '../src/frameworks-drivers/variable-categories.module';
import { RecipeTemplateModifiedError } from '../src/use-cases/recipes/errors/recipe-template-modified.error';
import {
  GetRecipeTemplateUseCase,
  PreviewRecipeTemplateImpactUseCase,
  SaveRecipeTemplateUseCase,
} from '../src/use-cases/recipes/recipe-template.use-cases';
import {
  CreateRecipeUseCase,
  GetRecipeUseCase,
  GetRecipeVariablesUseCase,
} from '../src/use-cases/recipes/recipes.use-cases';
import { ImportVariableCategoriesUseCase } from '../src/use-cases/variable-categories/variable-categories.use-cases';
import { templateConfig } from './support/recipe-fakes';

const ROOT = 'ns=4;s=|var|PLC.Application.GVL_HMI';
const HASH = '#'.repeat(20);
const STAR = '*'.repeat(20);

function gvlCsv(recipeVariables: string[]): string {
  return [
    'Type,Name,Address,DataType,InitValue,Comment,Attribute',
    `VAR_GLOBAL,iPagina,,INT,,"${HASH}\n PAGINA PROGRAMACION RECETA \n${HASH}\n${STAR}\n PROGRAMACION PARA LA RECETA \n${STAR}",`,
    ...recipeVariables.map((name) => `VAR_GLOBAL,${name},,REAL,,,`),
    `VAR_GLOBAL,rMinEspiras,,REAL,,"${STAR}\n LIMITES DE LOS DATOS DE LA RECETA \n${STAR}",`,
  ].join('\n');
}

function mapping(name: string, dataType: string) {
  return { nodeId: `${ROOT}.${name}`, signalVariableName: name, dataType };
}

describe('Receta base (integration)', () => {
  let app: INestApplicationContext;
  let dataSource: DataSource;
  let machineId: string;
  const operador = { companyId: '', role: UserRole.Operador };
  const admin = { companyId: '', role: UserRole.AdminCliente };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [SeedModule, VariableCategoriesModule, RecipesModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    dataSource = app.get(getDataSourceToken());
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await dataSource.query(
      'TRUNCATE TABLE "recipe_templates", "recipes", "variable_catalog_entries", "variable_categories", "machine_connections", "machines", "companies" RESTART IDENTITY CASCADE',
    );
    const [company] = await dataSource.query(
      "INSERT INTO companies (name, is_active) VALUES ('Empresa', true) RETURNING id",
    );
    const [machine] = await dataSource.query(
      "INSERT INTO machines (company_id, name, is_active) VALUES ($1, 'Bobinadora', true) RETURNING id",
      [company.id],
    );
    machineId = machine.id;
    operador.companyId = company.id;
    admin.companyId = company.id;
    await dataSource.query(
      "INSERT INTO machine_connections (machine_id, provider_type, connection_config) VALUES ($1, 'OpcUa', $2)",
      [
        machineId,
        JSON.stringify({
          endpointUrl: 'opc.tcp://127.0.0.1:4840',
          securityMode: 'None',
          securityPolicy: 'None',
          authMode: 'Anonymous',
          timeoutMs: 5000,
          samplingIntervalMs: 1000,
          nodeMapping: [
            mapping('rEspiras', 'Float'),
            mapping('xSentido', 'Boolean'),
            mapping('rVelocidad', 'Float'),
            mapping('rNueva', 'Float'),
          ],
        }),
      ],
    );
    await app.get(ImportVariableCategoriesUseCase).execute({
      machineId,
      requester: admin,
      rootNodeId: ROOT,
      csv: gvlCsv(['rEspiras', 'xSentido', 'rVelocidad']),
    });
  });

  it('por defecto → guardar ocultando, fijando y estrechando → impacto → versión → variable nueva oculta', async () => {
    const getTemplate = app.get(GetRecipeTemplateUseCase);
    expect(await getTemplate.execute({ machineId, requester: admin })).toMatchObject({
      isDefault: true,
      version: 0,
    });

    const recipe = await app.get(CreateRecipeUseCase).execute({
      machineId,
      requester: operador,
      actorEmail: 'operador@ewcontrol.local',
      title: 'Bobina A',
      values: [
        { signalVariableName: 'rEspiras', value: 800 },
        { signalVariableName: 'xSentido', value: true },
        { signalVariableName: 'rVelocidad', value: 12 },
      ],
    });

    // rEspiras editable con máximo 500, xSentido fija y visible, rVelocidad oculta.
    const content: RecipeTemplateContent = {
      variables: [
        templateConfig('rEspiras', 'EDITABLE', { label: 'Espiras', max: 500 }),
        templateConfig('xSentido', 'FIXED_VISIBLE', { fixedValue: false }),
        templateConfig('rVelocidad', 'HIDDEN'),
      ],
      layout: {
        rows: [
          { items: [{ type: 'TITLE', span: 12, text: 'Bobinado' }] },
          {
            items: [
              { type: 'VARIABLE', span: 6, signalVariableName: 'rEspiras' },
              { type: 'VARIABLE', span: 6, signalVariableName: 'xSentido' },
            ],
          },
        ],
      },
    };
    const impact = await app
      .get(PreviewRecipeTemplateImpactUseCase)
      .execute({ machineId, requester: admin, content });
    expect(impact).toMatchObject({ recipesBecomingIncomplete: 1, examples: ['Bobina A'] });

    const save = app.get(SaveRecipeTemplateUseCase);
    const saved = await save.execute({
      machineId,
      requester: admin,
      content,
      version: 0,
      actorEmail: 'demo@ewcontrol.local',
    });
    expect(saved).toMatchObject({
      isDefault: false,
      version: 1,
      updatedByEmail: 'demo@ewcontrol.local',
    });
    await expect(
      save.execute({ machineId, requester: admin, content, version: 0, actorEmail: 'otro' }),
    ).rejects.toBeInstanceOf(RecipeTemplateModifiedError);

    // Incompleta por el rango, no por las variables que dejaron de ser editables.
    const getRecipe = app.get(GetRecipeUseCase);
    const narrowed = await getRecipe.execute({
      machineId,
      recipeId: recipe.id,
      requester: operador,
    });
    expect(narrowed).toMatchObject({
      isComplete: false,
      staleValues: [{ signalVariableName: 'rEspiras', value: 800, reason: 'OUT_OF_RANGE' }],
      ignoredValues: [
        { signalVariableName: 'xSentido', value: true },
        { signalVariableName: 'rVelocidad', value: 12 },
      ],
      effectiveValues: null,
    });

    await app.get(ImportVariableCategoriesUseCase).execute({
      machineId,
      requester: admin,
      rootNodeId: ROOT,
      csv: gvlCsv(['rEspiras', 'xSentido', 'rVelocidad', 'rNueva']),
    });
    const afterImport = await getTemplate.execute({ machineId, requester: admin });
    expect(
      afterImport.variables.find((entry) => entry.signalVariableName === 'rNueva'),
    ).toMatchObject({
      isUnconfigured: true,
      config: expect.objectContaining({ mode: 'HIDDEN' }),
    });

    const fixed = await app.get(CreateRecipeUseCase).execute({
      machineId,
      requester: operador,
      actorEmail: 'operador@ewcontrol.local',
      title: 'Bobina B',
      values: [{ signalVariableName: 'rEspiras', value: 300 }],
    });
    expect(fixed).toMatchObject({
      isComplete: true,
      effectiveValues: [
        { signalVariableName: 'rEspiras', value: 300, source: 'RECIPE' },
        { signalVariableName: 'xSentido', value: false, source: 'FIXED' },
      ],
    });

    const form = await app
      .get(GetRecipeVariablesUseCase)
      .execute({ machineId, requester: operador });
    expect(form.variables.map((variable) => variable.signalVariableName)).toEqual([
      'rEspiras',
      'xSentido',
    ]);
    expect(form).toMatchObject({ hiddenCount: 2, isTemplateValid: true });
  });
});
