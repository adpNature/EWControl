import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UserRole } from '../../../entities/user-role.enum';
import { MachineNotFoundError } from '../../../use-cases/machine-management/errors/machine-not-found.error';
import { ProviderNotSupportedError } from '../../../use-cases/machine-management/errors/provider-not-supported.error';
import { InvalidWritePackageError } from '../../../use-cases/write-packages/errors/invalid-write-package.error';
import { MachineNotConnectedError } from '../../../use-cases/write-packages/errors/machine-not-connected.error';
import { WriteInProgressError } from '../../../use-cases/write-packages/errors/write-in-progress.error';
import { WritePackageNameTakenError } from '../../../use-cases/write-packages/errors/write-package-name-taken.error';
import { WritePackageNotFoundError } from '../../../use-cases/write-packages/errors/write-package-not-found.error';
import { WritePackageOutdatedError } from '../../../use-cases/write-packages/errors/write-package-outdated.error';
import { ExecuteWritePackageUseCase } from '../../../use-cases/write-packages/execute-write-package.use-case';
import {
  CreateWritePackageUseCase,
  DeactivateWritePackageUseCase,
  GetWritePackageUseCase,
  ListWritePackageExecutionsUseCase,
  ListWritePackagesUseCase,
  UpdateWritePackageUseCase,
} from '../../../use-cases/write-packages/write-package-management.use-cases';
import { HttpExceptionFilter } from '../http-exception.filter';
import { WritePackageController } from './write-package.controller';

const FAKE_USER = {
  id: 'user-op',
  email: 'operador@ewcontrol.local',
  companyId: 'company-1',
  role: UserRole.Operador,
};
const BASE = '/machines/machine-1/write-packages';
const ITEMS = [
  { signalVariableName: 'Escritura_REAL', value: 120.5 },
  { signalVariableName: 'Escritura_BOOL', value: true },
];

describe('WritePackageController (HTTP)', () => {
  let app: INestApplication;
  const useCases = {
    list: { execute: vi.fn() },
    get: { execute: vi.fn() },
    create: { execute: vi.fn() },
    update: { execute: vi.fn() },
    deactivate: { execute: vi.fn() },
    execute: { execute: vi.fn() },
    executions: { execute: vi.fn() },
  };

  beforeEach(async () => {
    Object.values(useCases).forEach((useCase) => useCase.execute.mockReset());
    useCases.list.execute.mockResolvedValue([{ id: 'package-1' }]);
    useCases.create.execute.mockResolvedValue({ id: 'package-1' });
    useCases.update.execute.mockResolvedValue({ id: 'package-1' });
    useCases.deactivate.execute.mockResolvedValue(undefined);
    useCases.execute.execute.mockResolvedValue({ id: 'execution-1', status: 'SUCCESS' });
    useCases.executions.execute.mockResolvedValue({ data: [], total: 0, limit: 20, offset: 0 });

    const moduleRef = await Test.createTestingModule({
      controllers: [WritePackageController],
      providers: [
        { provide: ListWritePackagesUseCase, useValue: useCases.list },
        { provide: GetWritePackageUseCase, useValue: useCases.get },
        { provide: CreateWritePackageUseCase, useValue: useCases.create },
        { provide: UpdateWritePackageUseCase, useValue: useCases.update },
        { provide: DeactivateWritePackageUseCase, useValue: useCases.deactivate },
        { provide: ExecuteWritePackageUseCase, useValue: useCases.execute },
        { provide: ListWritePackageExecutionsUseCase, useValue: useCases.executions },
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

  it('GET / lista los paquetes de la Machine', async () => {
    const response = await request(app.getHttpServer()).get(BASE);

    expect(response.status).toBe(200);
    expect(useCases.list.execute).toHaveBeenCalledWith({
      machineId: 'machine-1',
      requester: { companyId: 'company-1', role: UserRole.Operador },
    });
  });

  it('POST / crea un paquete con valores numéricos, booleanos y de texto', async () => {
    const response = await request(app.getHttpServer())
      .post(BASE)
      .send({
        name: 'Formato 120 mm',
        items: [...ITEMS, { signalVariableName: 'Receta', value: 'R-42' }],
      });

    expect(response.status).toBe(201);
    expect(useCases.create.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Formato 120 mm',
        description: null,
        items: [...ITEMS, { signalVariableName: 'Receta', value: 'R-42' }],
      }),
    );
  });

  it.each([
    [{ name: '', items: ITEMS }],
    [{ name: 'X', items: [] }],
    [{ name: 'X', items: [{ signalVariableName: 'Escritura_REAL', value: { a: 1 } }] }],
    [{ name: 'X', items: [{ signalVariableName: 'Escritura_REAL' }] }],
    [{ name: 'X', items: ITEMS, nodeId: 'ns=3;s=x' }],
  ])('POST / responde 400 con un cuerpo inválido: %o', async (body) => {
    const response = await request(app.getHttpServer()).post(BASE).send(body);

    expect(response.status).toBe(400);
    expect(useCases.create.execute).not.toHaveBeenCalled();
  });

  it('POST /:id/execute ejecuta con quién lo pide y responde 200, ignorando cualquier cuerpo', async () => {
    const response = await request(app.getHttpServer()).post(`${BASE}/package-1/execute`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ id: 'execution-1', status: 'SUCCESS' });
    expect(useCases.execute.execute).toHaveBeenCalledWith({
      machineId: 'machine-1',
      packageId: 'package-1',
      requester: { companyId: 'company-1', role: UserRole.Operador },
      executedBy: { userId: 'user-op', email: 'operador@ewcontrol.local' },
    });
  });

  it('DELETE /:id responde 204', async () => {
    const response = await request(app.getHttpServer()).delete(`${BASE}/package-1`);

    expect(response.status).toBe(204);
  });

  it('PATCH /:id solo reenvía los campos presentes', async () => {
    await request(app.getHttpServer()).patch(`${BASE}/package-1`).send({ name: 'Nuevo' });

    expect(useCases.update.execute).toHaveBeenCalledWith(
      expect.objectContaining({ packageId: 'package-1', changes: { name: 'Nuevo' } }),
    );
  });

  it('GET /:id/executions pagina con valores por defecto', async () => {
    await request(app.getHttpServer()).get(`${BASE}/package-1/executions`);

    expect(useCases.executions.execute).toHaveBeenCalledWith(
      expect.objectContaining({ pagination: { limit: 20, offset: 0 } }),
    );
  });

  it.each([
    [new MachineNotFoundError('machine-1'), 404, 'MACHINE_NOT_FOUND'],
    [new WritePackageNotFoundError('package-1'), 404, 'WRITE_PACKAGE_NOT_FOUND'],
    [
      new WritePackageOutdatedError('la variable ya no es escribible'),
      409,
      'WRITE_PACKAGE_OUTDATED',
    ],
    [new MachineNotConnectedError('machine-1'), 409, 'MACHINE_NOT_CONNECTED'],
    [new WriteInProgressError('machine-1'), 409, 'WRITE_IN_PROGRESS'],
    [new ProviderNotSupportedError('Simulator'), 422, 'PROVIDER_NOT_SUPPORTED'],
    [new Error('inesperado'), 500, 'INTERNAL_ERROR'],
  ])('POST /:id/execute traduce %s a %i %s', async (error, status, code) => {
    useCases.execute.execute.mockRejectedValue(error);

    const response = await request(app.getHttpServer()).post(`${BASE}/package-1/execute`);

    expect(response.status).toBe(status);
    expect(response.body.code).toBe(code);
  });

  it('traduce los errores de validación del alta con el elemento afectado', async () => {
    useCases.create.execute.mockRejectedValueOnce(
      new InvalidWritePackageError('fuera de rango', 1),
    );
    useCases.create.execute.mockRejectedValueOnce(new WritePackageNameTakenError('X'));

    const invalid = await request(app.getHttpServer()).post(BASE).send({ name: 'X', items: ITEMS });
    const taken = await request(app.getHttpServer()).post(BASE).send({ name: 'X', items: ITEMS });

    expect(invalid.status).toBe(400);
    expect(invalid.body).toMatchObject({
      code: 'INVALID_WRITE_PACKAGE',
      details: { index: 1, reason: 'fuera de rango' },
    });
    expect(taken.status).toBe(409);
    expect(taken.body.code).toBe('WRITE_PACKAGE_NAME_TAKEN');
  });
});
