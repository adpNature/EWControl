import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UserRole } from '../../../entities/user-role.enum';
import { CreateCompanyUseCase } from '../../../use-cases/company-management/create-company.use-case';
import { DeactivateCompanyUseCase } from '../../../use-cases/company-management/deactivate-company.use-case';
import { CompanyNotFoundError } from '../../../use-cases/company-management/errors/company-not-found.error';
import { GetCompanyUseCase } from '../../../use-cases/company-management/get-company.use-case';
import { ListCompaniesUseCase } from '../../../use-cases/company-management/list-companies.use-case';
import { UpdateCompanyUseCase } from '../../../use-cases/company-management/update-company.use-case';
import { RolesGuard } from '../../auth-guard/roles.guard';
import { HttpExceptionFilter } from '../http-exception.filter';
import { CompanyController } from './company.controller';

const SUPER_ADMIN = {
  id: 'user-1',
  email: 'superadmin@ewcontrol.local',
  companyId: 'company-1',
  role: UserRole.SuperAdmin,
};

const ADMIN_CLIENTE = {
  id: 'user-2',
  email: 'demo@ewcontrol.local',
  companyId: 'company-1',
  role: UserRole.AdminCliente,
};

describe('CompanyController (HTTP)', () => {
  let app: INestApplication;
  let currentUser: typeof SUPER_ADMIN | typeof ADMIN_CLIENTE;
  let createCompanyUseCase: { execute: ReturnType<typeof vi.fn> };
  let listCompaniesUseCase: { execute: ReturnType<typeof vi.fn> };
  let getCompanyUseCase: { execute: ReturnType<typeof vi.fn> };
  let updateCompanyUseCase: { execute: ReturnType<typeof vi.fn> };
  let deactivateCompanyUseCase: { execute: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    currentUser = SUPER_ADMIN;
    createCompanyUseCase = {
      execute: vi.fn().mockResolvedValue({ id: 'company-1', name: 'ACME', isActive: true }),
    };
    listCompaniesUseCase = {
      execute: vi.fn().mockResolvedValue({ data: [], total: 0, limit: 20, offset: 0 }),
    };
    getCompanyUseCase = {
      execute: vi.fn().mockResolvedValue({ id: 'company-1', name: 'ACME', isActive: true }),
    };
    updateCompanyUseCase = {
      execute: vi.fn().mockResolvedValue({ id: 'company-1', name: 'ACME Corp', isActive: true }),
    };
    deactivateCompanyUseCase = { execute: vi.fn().mockResolvedValue(undefined) };

    const moduleRef = await Test.createTestingModule({
      controllers: [CompanyController],
      providers: [
        { provide: CreateCompanyUseCase, useValue: createCompanyUseCase },
        { provide: ListCompaniesUseCase, useValue: listCompaniesUseCase },
        { provide: GetCompanyUseCase, useValue: getCompanyUseCase },
        { provide: UpdateCompanyUseCase, useValue: updateCompanyUseCase },
        { provide: DeactivateCompanyUseCase, useValue: deactivateCompanyUseCase },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use((req: { user: unknown }, _res: unknown, next: () => void) => {
      req.user = currentUser;
      next();
    });
    app.useGlobalGuards(new RolesGuard(new Reflector()));
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('POST / crea la Company cuando el requester es SuperAdmin', async () => {
    const response = await request(app.getHttpServer()).post('/companies').send({ name: 'ACME' });

    expect(response.status).toBe(201);
    expect(createCompanyUseCase.execute).toHaveBeenCalledWith({ name: 'ACME' });
  });

  it('responde 403 FORBIDDEN para cualquier endpoint si el requester es AdminCliente', async () => {
    currentUser = ADMIN_CLIENTE;

    const response = await request(app.getHttpServer()).get('/companies');

    expect(response.status).toBe(403);
    expect(response.body.code).toBe('FORBIDDEN');
    expect(listCompaniesUseCase.execute).not.toHaveBeenCalled();
  });

  it('GET / delega la paginación por defecto en el use-case', async () => {
    const response = await request(app.getHttpServer()).get('/companies');

    expect(response.status).toBe(200);
    expect(listCompaniesUseCase.execute).toHaveBeenCalledWith({
      pagination: { limit: 20, offset: 0 },
    });
  });

  it('GET /:id responde 404 COMPANY_NOT_FOUND si el use-case lo lanza', async () => {
    getCompanyUseCase.execute.mockRejectedValue(new CompanyNotFoundError('missing'));

    const response = await request(app.getHttpServer()).get('/companies/missing');

    expect(response.status).toBe(404);
    expect(response.body.code).toBe('COMPANY_NOT_FOUND');
  });

  it('PATCH /:id actualiza la Company', async () => {
    const response = await request(app.getHttpServer())
      .patch('/companies/company-1')
      .send({ name: 'ACME Corp' });

    expect(response.status).toBe(200);
    expect(updateCompanyUseCase.execute).toHaveBeenCalledWith({
      companyId: 'company-1',
      name: 'ACME Corp',
    });
  });

  it('DELETE /:id responde 204 en el caso feliz', async () => {
    const response = await request(app.getHttpServer()).delete('/companies/company-1');

    expect(response.status).toBe(204);
    expect(deactivateCompanyUseCase.execute).toHaveBeenCalledWith({ companyId: 'company-1' });
  });

  it('POST / responde 400 si el body incluye campos no declarados (Mass Assignment)', async () => {
    const response = await request(app.getHttpServer())
      .post('/companies')
      .send({ name: 'ACME', isActive: true });

    expect(response.status).toBe(400);
    expect(createCompanyUseCase.execute).not.toHaveBeenCalled();
  });

  it('responde 500 INTERNAL_ERROR ante un error no mapeado', async () => {
    updateCompanyUseCase.execute.mockRejectedValue(new Error('boom'));

    const response = await request(app.getHttpServer())
      .patch('/companies/company-1')
      .send({ name: 'x' });

    expect(response.status).toBe(500);
    expect(response.body.code).toBe('INTERNAL_ERROR');
  });
});
