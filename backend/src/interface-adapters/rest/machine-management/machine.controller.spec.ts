import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UserRole } from '../../../entities/user-role.enum';
import { CreateMachineUseCase } from '../../../use-cases/machine-management/create-machine.use-case';
import { DeleteMachineUseCase } from '../../../use-cases/machine-management/delete-machine.use-case';
import { MachineInactiveError } from '../../../use-cases/machine-management/errors/machine-inactive.error';
import { MachineNotFoundError } from '../../../use-cases/machine-management/errors/machine-not-found.error';
import { GetMachineUseCase } from '../../../use-cases/machine-management/get-machine.use-case';
import { ListMachinesUseCase } from '../../../use-cases/machine-management/list-machines.use-case';
import { UpdateMachineUseCase } from '../../../use-cases/machine-management/update-machine.use-case';
import { HttpExceptionFilter } from '../http-exception.filter';
import { MachineController } from './machine.controller';

const FAKE_USER = {
  id: 'user-1',
  email: 'demo@ewcontrol.local',
  companyId: 'company-1',
  role: UserRole.AdminCliente,
};

describe('MachineController (HTTP)', () => {
  let app: INestApplication;
  let createMachineUseCase: { execute: ReturnType<typeof vi.fn> };
  let listMachinesUseCase: { execute: ReturnType<typeof vi.fn> };
  let getMachineUseCase: { execute: ReturnType<typeof vi.fn> };
  let updateMachineUseCase: { execute: ReturnType<typeof vi.fn> };
  let deleteMachineUseCase: { execute: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    createMachineUseCase = {
      execute: vi.fn().mockResolvedValue({ machine: { id: 'machine-1', name: 'Demo' } }),
    };
    listMachinesUseCase = {
      execute: vi.fn().mockResolvedValue({ data: [], total: 0, limit: 20, offset: 0 }),
    };
    getMachineUseCase = { execute: vi.fn().mockResolvedValue({ id: 'machine-1' }) };
    updateMachineUseCase = { execute: vi.fn().mockResolvedValue({ id: 'machine-1', name: 'New' }) };
    deleteMachineUseCase = { execute: vi.fn().mockResolvedValue(undefined) };

    const moduleRef = await Test.createTestingModule({
      controllers: [MachineController],
      providers: [
        { provide: CreateMachineUseCase, useValue: createMachineUseCase },
        { provide: ListMachinesUseCase, useValue: listMachinesUseCase },
        { provide: GetMachineUseCase, useValue: getMachineUseCase },
        { provide: UpdateMachineUseCase, useValue: updateMachineUseCase },
        { provide: DeleteMachineUseCase, useValue: deleteMachineUseCase },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use((req: { user: unknown }, _res: unknown, next: () => void) => {
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

  it('POST / crea la Machine con el companyId del currentUser, nunca del body (criterio 1)', async () => {
    const response = await request(app.getHttpServer())
      .post('/machines')
      .send({ name: 'Bobinadora 1' });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({ id: 'machine-1', name: 'Demo' });
    expect(createMachineUseCase.execute).toHaveBeenCalledWith({
      companyId: 'company-1',
      name: 'Bobinadora 1',
    });
  });

  it('POST / responde 400 si el body incluye companyId (Mass Assignment, criterio 7)', async () => {
    const response = await request(app.getHttpServer())
      .post('/machines')
      .send({ name: 'Bobinadora 1', companyId: 'other-company' });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('BAD_REQUEST');
    expect(createMachineUseCase.execute).not.toHaveBeenCalled();
  });

  it('GET / delega la paginación por defecto en el use-case', async () => {
    const response = await request(app.getHttpServer()).get('/machines');

    expect(response.status).toBe(200);
    expect(listMachinesUseCase.execute).toHaveBeenCalledWith({
      requester: { companyId: 'company-1', role: UserRole.AdminCliente },
      pagination: { limit: 20, offset: 0 },
    });
  });

  it('GET /:id responde 404 MACHINE_NOT_FOUND si el use-case lo lanza (criterio 6)', async () => {
    getMachineUseCase.execute.mockRejectedValue(new MachineNotFoundError('missing'));

    const response = await request(app.getHttpServer()).get('/machines/missing');

    expect(response.status).toBe(404);
    expect(response.body.code).toBe('MACHINE_NOT_FOUND');
  });

  it('PATCH /:id responde 422 MACHINE_INACTIVE si el use-case lo lanza (criterio 8)', async () => {
    updateMachineUseCase.execute.mockRejectedValue(new MachineInactiveError('machine-1'));

    const response = await request(app.getHttpServer())
      .patch('/machines/machine-1')
      .send({ name: 'x' });

    expect(response.status).toBe(422);
    expect(response.body.code).toBe('MACHINE_INACTIVE');
  });

  it('DELETE /:id responde 204 en el caso feliz (criterio 3)', async () => {
    const response = await request(app.getHttpServer()).delete('/machines/machine-1');

    expect(response.status).toBe(204);
    expect(deleteMachineUseCase.execute).toHaveBeenCalledWith({
      machineId: 'machine-1',
      requester: { companyId: 'company-1', role: UserRole.AdminCliente },
    });
  });

  it('POST / responde 500 INTERNAL_ERROR ante un error no mapeado', async () => {
    updateMachineUseCase.execute.mockRejectedValue(new Error('boom'));

    const response = await request(app.getHttpServer())
      .patch('/machines/machine-1')
      .send({ name: 'x' });

    expect(response.status).toBe(500);
    expect(response.body.code).toBe('INTERNAL_ERROR');
  });
});
