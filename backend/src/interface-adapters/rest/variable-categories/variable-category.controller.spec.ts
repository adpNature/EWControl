import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UserRole } from '../../../entities/user-role.enum';
import { MachineInactiveError } from '../../../use-cases/machine-management/errors/machine-inactive.error';
import { MachineNotFoundError } from '../../../use-cases/machine-management/errors/machine-not-found.error';
import { InvalidGvlExportError } from '../../../use-cases/variable-categories/errors/invalid-gvl-export.error';
import { InvalidVariableCategoryNameError } from '../../../use-cases/variable-categories/errors/invalid-variable-category-name.error';
import { VariableCategoryNameTakenError } from '../../../use-cases/variable-categories/errors/variable-category-name-taken.error';
import { VariableCategoryNotFoundError } from '../../../use-cases/variable-categories/errors/variable-category-not-found.error';
import {
  ImportVariableCategoriesUseCase,
  ListVariableCategoriesUseCase,
  RenameVariableCategoryUseCase,
} from '../../../use-cases/variable-categories/variable-categories.use-cases';
import { HttpExceptionFilter } from '../http-exception.filter';
import { VariableCategoryController } from './variable-category.controller';

const FAKE_USER = {
  id: 'user-1',
  email: 'demo@ewcontrol.local',
  companyId: 'company-1',
  role: UserRole.AdminCliente,
};
const REQUESTER = { companyId: 'company-1', role: UserRole.AdminCliente };
const BASE = '/machines/machine-1/variable-categories';
const ROOT = 'ns=4;s=|var|PLC.Application.GVL_HMI';

describe('VariableCategoryController (HTTP, docs/specs/23-categorias-variables-plc.md)', () => {
  let app: INestApplication;
  const useCases = {
    list: { execute: vi.fn() },
    import: { execute: vi.fn() },
    rename: { execute: vi.fn() },
  };

  beforeEach(async () => {
    Object.values(useCases).forEach((useCase) => useCase.execute.mockReset());
    useCases.list.execute.mockResolvedValue({ categories: [], variables: [] });
    useCases.import.execute.mockResolvedValue({ categories: 1, variables: 2 });
    useCases.rename.execute.mockResolvedValue({ id: 'c-1', name: 'Nuevo' });

    const moduleRef = await Test.createTestingModule({
      controllers: [VariableCategoryController],
      providers: [
        { provide: ListVariableCategoriesUseCase, useValue: useCases.list },
        { provide: ImportVariableCategoriesUseCase, useValue: useCases.import },
        { provide: RenameVariableCategoryUseCase, useValue: useCases.rename },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use((req: { user: unknown }, res: unknown, next: () => void) => {
      req.user = FAKE_USER;
      next();
    });
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET / devuelve categorías y catálogo de la Machine', async () => {
    const response = await request(app.getHttpServer()).get(BASE);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ categories: [], variables: [] });
    expect(useCases.list.execute).toHaveBeenCalledWith({
      machineId: 'machine-1',
      requester: REQUESTER,
    });
  });

  it('POST /import responde 200 con el resumen y reenvía carpeta y CSV', async () => {
    const response = await request(app.getHttpServer())
      .post(`${BASE}/import`)
      .send({ rootNodeId: ROOT, csv: 'Type,Name,Comment\nVAR_GLOBAL,a,' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ categories: 1, variables: 2 });
    expect(useCases.import.execute).toHaveBeenCalledWith({
      machineId: 'machine-1',
      requester: REQUESTER,
      rootNodeId: ROOT,
      csv: 'Type,Name,Comment\nVAR_GLOBAL,a,',
    });
  });

  it.each([
    [{ csv: 'x' }],
    [{ rootNodeId: ROOT }],
    [{ rootNodeId: '', csv: 'x' }],
    [{ rootNodeId: ROOT, csv: 'x'.repeat(90_001) }],
    [{ rootNodeId: ROOT, csv: 'x', extra: true }],
  ])('POST /import responde 400 con un body mal formado (%#)', async (body) => {
    const response = await request(app.getHttpServer()).post(`${BASE}/import`).send(body);

    expect(response.status).toBe(400);
    expect(useCases.import.execute).not.toHaveBeenCalled();
  });

  it('PATCH /:id reenvía el nombre y devuelve la categoría', async () => {
    const response = await request(app.getHttpServer())
      .patch(`${BASE}/c-1`)
      .send({ name: 'Nuevo' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ id: 'c-1', name: 'Nuevo' });
    expect(useCases.rename.execute).toHaveBeenCalledWith({
      machineId: 'machine-1',
      categoryId: 'c-1',
      requester: REQUESTER,
      name: 'Nuevo',
    });
  });

  it.each([
    [
      new InvalidGvlExportError('sin Comment'),
      400,
      'INVALID_GVL_EXPORT',
      { reason: 'sin Comment' },
    ],
    [new MachineNotFoundError('machine-1'), 404, 'MACHINE_NOT_FOUND', undefined],
    [new MachineInactiveError('machine-1'), 422, 'MACHINE_INACTIVE', undefined],
  ])('POST /import traduce %s a %i %s', async (error, status, code, details) => {
    useCases.import.execute.mockRejectedValue(error);

    const response = await request(app.getHttpServer())
      .post(`${BASE}/import`)
      .send({ rootNodeId: ROOT, csv: 'x' });

    expect(response.status).toBe(status);
    expect(response.body.code).toBe(code);
    if (details) expect(response.body.details).toEqual(details);
  });

  it.each([
    [new InvalidVariableCategoryNameError(120), 400, 'INVALID_VARIABLE_CATEGORY_NAME'],
    [new VariableCategoryNameTakenError('x'), 409, 'VARIABLE_CATEGORY_NAME_TAKEN'],
    [new VariableCategoryNotFoundError('c-9'), 404, 'VARIABLE_CATEGORY_NOT_FOUND'],
    [new Error('inesperado'), 500, undefined],
  ])('PATCH /:id traduce %s a %i', async (error, status, code) => {
    useCases.rename.execute.mockRejectedValue(error);

    const response = await request(app.getHttpServer()).patch(`${BASE}/c-9`).send({ name: 'x' });

    expect(response.status).toBe(status);
    if (code) expect(response.body.code).toBe(code);
  });
});
