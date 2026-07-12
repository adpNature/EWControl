import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UserRole } from '../../../entities/user-role.enum';
import { CreateDashboardUseCase } from '../../../use-cases/dashboard/create-dashboard.use-case';
import { DeleteDashboardUseCase } from '../../../use-cases/dashboard/delete-dashboard.use-case';
import { DashboardNotFoundError } from '../../../use-cases/dashboard/errors/dashboard-not-found.error';
import { GetDashboardUseCase } from '../../../use-cases/dashboard/get-dashboard.use-case';
import { ListDashboardsUseCase } from '../../../use-cases/dashboard/list-dashboards.use-case';
import { UpdateDashboardUseCase } from '../../../use-cases/dashboard/update-dashboard.use-case';
import { HttpExceptionFilter } from '../http-exception.filter';
import { DashboardController } from './dashboard.controller';

const FAKE_USER = {
  id: 'user-1',
  email: 'demo@ewcontrol.local',
  companyId: 'company-1',
  role: UserRole.AdminCliente,
};

describe('DashboardController (HTTP)', () => {
  let app: INestApplication;
  let createDashboardUseCase: { execute: ReturnType<typeof vi.fn> };
  let listDashboardsUseCase: { execute: ReturnType<typeof vi.fn> };
  let getDashboardUseCase: { execute: ReturnType<typeof vi.fn> };
  let updateDashboardUseCase: { execute: ReturnType<typeof vi.fn> };
  let deleteDashboardUseCase: { execute: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    createDashboardUseCase = {
      execute: vi
        .fn()
        .mockResolvedValue({ id: 'dashboard-1', companyId: 'company-1', name: 'Planta 1' }),
    };
    listDashboardsUseCase = {
      execute: vi.fn().mockResolvedValue({ data: [], total: 0, limit: 20, offset: 0 }),
    };
    getDashboardUseCase = {
      execute: vi.fn().mockResolvedValue({ id: 'dashboard-1', name: 'Planta 1', widgets: [] }),
    };
    updateDashboardUseCase = {
      execute: vi.fn().mockResolvedValue({ id: 'dashboard-1', name: 'New' }),
    };
    deleteDashboardUseCase = { execute: vi.fn().mockResolvedValue(undefined) };

    const moduleRef = await Test.createTestingModule({
      controllers: [DashboardController],
      providers: [
        { provide: CreateDashboardUseCase, useValue: createDashboardUseCase },
        { provide: ListDashboardsUseCase, useValue: listDashboardsUseCase },
        { provide: GetDashboardUseCase, useValue: getDashboardUseCase },
        { provide: UpdateDashboardUseCase, useValue: updateDashboardUseCase },
        { provide: DeleteDashboardUseCase, useValue: deleteDashboardUseCase },
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

  it('POST / crea un Dashboard con el companyId del token', async () => {
    const response = await request(app.getHttpServer())
      .post('/dashboards')
      .send({ name: 'Planta 1' });

    expect(response.status).toBe(201);
    expect(createDashboardUseCase.execute).toHaveBeenCalledWith({
      companyId: 'company-1',
      name: 'Planta 1',
    });
  });

  it('POST / responde 400 si el body incluye companyId (Mass Assignment)', async () => {
    const response = await request(app.getHttpServer())
      .post('/dashboards')
      .send({ name: 'Planta 1', companyId: 'other-company' });

    expect(response.status).toBe(400);
    expect(createDashboardUseCase.execute).not.toHaveBeenCalled();
  });

  it('GET / lista los Dashboards paginados', async () => {
    const response = await request(app.getHttpServer()).get('/dashboards');

    expect(response.status).toBe(200);
    expect(listDashboardsUseCase.execute).toHaveBeenCalledWith({
      requester: { companyId: 'company-1', role: UserRole.AdminCliente },
      pagination: { limit: 20, offset: 0 },
    });
  });

  it('GET /:id responde 404 DASHBOARD_NOT_FOUND si el use-case lo lanza', async () => {
    getDashboardUseCase.execute.mockRejectedValue(new DashboardNotFoundError('missing'));

    const response = await request(app.getHttpServer()).get('/dashboards/missing');

    expect(response.status).toBe(404);
    expect(response.body.code).toBe('DASHBOARD_NOT_FOUND');
  });

  it('PATCH /:id renombra el Dashboard', async () => {
    const response = await request(app.getHttpServer())
      .patch('/dashboards/dashboard-1')
      .send({ name: 'New' });

    expect(response.status).toBe(200);
    expect(updateDashboardUseCase.execute).toHaveBeenCalledWith({
      dashboardId: 'dashboard-1',
      requester: { companyId: 'company-1', role: UserRole.AdminCliente },
      name: 'New',
    });
  });

  it('DELETE /:id responde 204 en el caso feliz (baja física)', async () => {
    const response = await request(app.getHttpServer()).delete('/dashboards/dashboard-1');

    expect(response.status).toBe(204);
    expect(deleteDashboardUseCase.execute).toHaveBeenCalledWith({
      dashboardId: 'dashboard-1',
      requester: { companyId: 'company-1', role: UserRole.AdminCliente },
    });
  });
});
