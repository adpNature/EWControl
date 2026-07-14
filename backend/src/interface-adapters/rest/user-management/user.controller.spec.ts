import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UserRole } from '../../../entities/user-role.enum';
import { CreateUserUseCase } from '../../../use-cases/user-management/create-user.use-case';
import { DeactivateUserUseCase } from '../../../use-cases/user-management/deactivate-user.use-case';
import { CannotCreateSuperAdminError } from '../../../use-cases/user-management/errors/cannot-create-superadmin.error';
import { CannotDeactivateSelfError } from '../../../use-cases/user-management/errors/cannot-deactivate-self.error';
import { EmailAlreadyExistsError } from '../../../use-cases/user-management/errors/email-already-exists.error';
import { UserNotFoundError } from '../../../use-cases/user-management/errors/user-not-found.error';
import { GetUserUseCase } from '../../../use-cases/user-management/get-user.use-case';
import { ListUsersUseCase } from '../../../use-cases/user-management/list-users.use-case';
import { UpdateUserUseCase } from '../../../use-cases/user-management/update-user.use-case';
import { HttpExceptionFilter } from '../http-exception.filter';
import { UserController } from './user.controller';

const FAKE_USER = {
  id: 'user-1',
  email: 'demo@ewcontrol.local',
  companyId: 'company-1',
  role: UserRole.AdminCliente,
};

describe('UserController (HTTP)', () => {
  let app: INestApplication;
  let createUserUseCase: { execute: ReturnType<typeof vi.fn> };
  let listUsersUseCase: { execute: ReturnType<typeof vi.fn> };
  let getUserUseCase: { execute: ReturnType<typeof vi.fn> };
  let updateUserUseCase: { execute: ReturnType<typeof vi.fn> };
  let deactivateUserUseCase: { execute: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    createUserUseCase = {
      execute: vi.fn().mockResolvedValue({
        id: 'user-2',
        companyId: 'company-1',
        email: 'nuevo@ewcontrol.local',
        passwordHash: '$2b$10$secret',
        role: UserRole.AdminCliente,
        isActive: true,
      }),
    };
    listUsersUseCase = {
      execute: vi.fn().mockResolvedValue({
        data: [
          {
            id: 'user-2',
            companyId: 'company-1',
            email: 'nuevo@ewcontrol.local',
            passwordHash: '$2b$10$secret',
            role: UserRole.AdminCliente,
            isActive: true,
          },
        ],
        total: 1,
        limit: 20,
        offset: 0,
      }),
    };
    getUserUseCase = { execute: vi.fn().mockResolvedValue({ id: 'user-2' }) };
    updateUserUseCase = {
      execute: vi.fn().mockResolvedValue({ id: 'user-2', email: 'new@x.com' }),
    };
    deactivateUserUseCase = { execute: vi.fn().mockResolvedValue(undefined) };

    const moduleRef = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        { provide: CreateUserUseCase, useValue: createUserUseCase },
        { provide: ListUsersUseCase, useValue: listUsersUseCase },
        { provide: GetUserUseCase, useValue: getUserUseCase },
        { provide: UpdateUserUseCase, useValue: updateUserUseCase },
        { provide: DeactivateUserUseCase, useValue: deactivateUserUseCase },
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

  it('POST / crea el User con el requester del token', async () => {
    const response = await request(app.getHttpServer())
      .post('/users')
      .send({ email: 'nuevo@ewcontrol.local', password: 'Demo1234!', role: 'AdminCliente' });

    expect(response.status).toBe(201);
    expect(createUserUseCase.execute).toHaveBeenCalledWith({
      requester: { companyId: 'company-1', role: UserRole.AdminCliente },
      companyId: undefined,
      email: 'nuevo@ewcontrol.local',
      password: 'Demo1234!',
      role: 'AdminCliente',
    });
  });

  it('POST / nunca devuelve passwordHash en la respuesta', async () => {
    const response = await request(app.getHttpServer())
      .post('/users')
      .send({ email: 'nuevo@ewcontrol.local', password: 'Demo1234!', role: 'AdminCliente' });

    expect(response.body).not.toHaveProperty('passwordHash');
    expect(response.body).toEqual({
      id: 'user-2',
      companyId: 'company-1',
      email: 'nuevo@ewcontrol.local',
      role: 'AdminCliente',
      isActive: true,
    });
  });

  it('POST / responde 400 si la contraseña no cumple la política', async () => {
    const response = await request(app.getHttpServer())
      .post('/users')
      .send({ email: 'nuevo@ewcontrol.local', password: 'short', role: 'AdminCliente' });

    expect(response.status).toBe(400);
    expect(createUserUseCase.execute).not.toHaveBeenCalled();
  });

  it('POST / responde 403 FORBIDDEN si el use-case lanza CannotCreateSuperAdminError', async () => {
    createUserUseCase.execute.mockRejectedValue(new CannotCreateSuperAdminError());

    const response = await request(app.getHttpServer())
      .post('/users')
      .send({ email: 'nuevo@ewcontrol.local', password: 'Demo1234!', role: 'SuperAdmin' });

    expect(response.status).toBe(403);
    expect(response.body.code).toBe('FORBIDDEN');
  });

  it('POST / responde 409 EMAIL_ALREADY_EXISTS si el use-case lo lanza', async () => {
    createUserUseCase.execute.mockRejectedValue(new EmailAlreadyExistsError('x@x.com'));

    const response = await request(app.getHttpServer())
      .post('/users')
      .send({ email: 'x@x.com', password: 'Demo1234!', role: 'AdminCliente' });

    expect(response.status).toBe(409);
    expect(response.body.code).toBe('EMAIL_ALREADY_EXISTS');
  });

  it('GET / delega la paginación por defecto en el use-case', async () => {
    const response = await request(app.getHttpServer()).get('/users');

    expect(response.status).toBe(200);
    expect(listUsersUseCase.execute).toHaveBeenCalledWith({
      requester: { companyId: 'company-1', role: UserRole.AdminCliente },
      pagination: { limit: 20, offset: 0 },
    });
  });

  it('GET / nunca devuelve passwordHash en ninguno de los Users listados', async () => {
    const response = await request(app.getHttpServer()).get('/users');

    expect(response.body.data).toEqual([
      {
        id: 'user-2',
        companyId: 'company-1',
        email: 'nuevo@ewcontrol.local',
        role: 'AdminCliente',
        isActive: true,
      },
    ]);
  });

  it('GET /:id responde 404 USER_NOT_FOUND si el use-case lo lanza', async () => {
    getUserUseCase.execute.mockRejectedValue(new UserNotFoundError('missing'));

    const response = await request(app.getHttpServer()).get('/users/missing');

    expect(response.status).toBe(404);
    expect(response.body.code).toBe('USER_NOT_FOUND');
  });

  it('DELETE /:id responde 422 CANNOT_DEACTIVATE_SELF si el use-case lo lanza', async () => {
    deactivateUserUseCase.execute.mockRejectedValue(new CannotDeactivateSelfError());

    const response = await request(app.getHttpServer()).delete('/users/user-1');

    expect(response.status).toBe(422);
    expect(response.body.code).toBe('CANNOT_DEACTIVATE_SELF');
  });

  it('DELETE /:id responde 204 en el caso feliz', async () => {
    const response = await request(app.getHttpServer()).delete('/users/user-2');

    expect(response.status).toBe(204);
    expect(deactivateUserUseCase.execute).toHaveBeenCalledWith({
      userId: 'user-2',
      requesterId: 'user-1',
      requester: { companyId: 'company-1', role: UserRole.AdminCliente },
    });
  });

  it('PATCH /:id responde 500 INTERNAL_ERROR ante un error no mapeado', async () => {
    updateUserUseCase.execute.mockRejectedValue(new Error('boom'));

    const response = await request(app.getHttpServer())
      .patch('/users/user-2')
      .send({ email: 'x@x.com' });

    expect(response.status).toBe(500);
    expect(response.body.code).toBe('INTERNAL_ERROR');
  });
});
