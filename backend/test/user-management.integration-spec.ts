/**
 * Test de integración (Documento 0, "Pirámide de Testing") de
 * docs/specs/10-gestion-companies-users.md (User): arranca
 * `UserManagementModule` real contra el Postgres de `docker compose`, sin
 * pasar por HTTP (igual que `company-management.integration-spec.ts`).
 */
import { INestApplicationContext } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { UserRole } from '../src/entities/user-role.enum';
import { SeedModule } from '../src/frameworks-drivers/seed.module';
import { UserManagementModule } from '../src/frameworks-drivers/user-management.module';
import { CreateUserUseCase } from '../src/use-cases/user-management/create-user.use-case';
import { DeactivateUserUseCase } from '../src/use-cases/user-management/deactivate-user.use-case';
import { CannotCreateSuperAdminError } from '../src/use-cases/user-management/errors/cannot-create-superadmin.error';
import { CannotDeactivateSelfError } from '../src/use-cases/user-management/errors/cannot-deactivate-self.error';
import { EmailAlreadyExistsError } from '../src/use-cases/user-management/errors/email-already-exists.error';
import { UserNotFoundError } from '../src/use-cases/user-management/errors/user-not-found.error';
import { GetUserUseCase } from '../src/use-cases/user-management/get-user.use-case';
import { ListUsersUseCase } from '../src/use-cases/user-management/list-users.use-case';
import { UpdateUserUseCase } from '../src/use-cases/user-management/update-user.use-case';

async function truncateTables(dataSource: DataSource): Promise<void> {
  await dataSource.query(
    'TRUNCATE TABLE "auth_audit_log", "refresh_tokens", "signals", "machine_connections", "machines", "users", "companies" RESTART IDENTITY CASCADE',
  );
}

async function insertCompany(dataSource: DataSource, name = 'Empresa Demo'): Promise<string> {
  const [row] = await dataSource.query(
    'INSERT INTO companies (name, is_active) VALUES ($1, true) RETURNING id',
    [name],
  );
  return row.id;
}

async function insertRefreshToken(
  dataSource: DataSource,
  userId: string,
  status: 'active' | 'revoked' = 'active',
): Promise<string> {
  const [row] = await dataSource.query(
    "INSERT INTO refresh_tokens (id, user_id, status, expires_at, created_at) VALUES (uuid_generate_v4(), $1, $2, now() + interval '7 days', now()) RETURNING id",
    [userId, status],
  );
  return row.id;
}

describe('User management (integration)', () => {
  let app: INestApplicationContext;
  let dataSource: DataSource;
  let createUserUseCase: CreateUserUseCase;
  let listUsersUseCase: ListUsersUseCase;
  let getUserUseCase: GetUserUseCase;
  let updateUserUseCase: UpdateUserUseCase;
  let deactivateUserUseCase: DeactivateUserUseCase;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [SeedModule, UserManagementModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    dataSource = app.get(getDataSourceToken());
    createUserUseCase = app.get(CreateUserUseCase);
    listUsersUseCase = app.get(ListUsersUseCase);
    getUserUseCase = app.get(GetUserUseCase);
    updateUserUseCase = app.get(UpdateUserUseCase);
    deactivateUserUseCase = app.get(DeactivateUserUseCase);
  });

  beforeEach(async () => {
    await truncateTables(dataSource);
  });

  afterAll(async () => {
    await truncateTables(dataSource);
    await app.close();
  });

  it('un AdminCliente crea un User en su propia Company; un SuperAdmin ve Users de todas (criterios 3, 6)', async () => {
    const companyA = await insertCompany(dataSource, 'Empresa A');
    const companyB = await insertCompany(dataSource, 'Empresa B');
    const adminA = { companyId: companyA, role: UserRole.AdminCliente };

    const created = await createUserUseCase.execute({
      requester: adminA,
      companyId: companyB, // debe ignorarse: siempre se usa companyA
      email: 'nuevo@ewcontrol.local',
      password: 'Demo1234!',
      role: UserRole.AdminCliente,
    });
    expect(created.companyId).toBe(companyA);

    const resultA = await listUsersUseCase.execute({
      requester: adminA,
      pagination: { limit: 20, offset: 0 },
    });
    expect(resultA.data.map((u) => u.id)).toEqual([created.id]);

    const superAdmin = { companyId: companyB, role: UserRole.SuperAdmin };
    const otherUser = await createUserUseCase.execute({
      requester: superAdmin,
      companyId: companyB,
      email: 'otro@ewcontrol.local',
      password: 'Demo1234!',
      role: UserRole.AdminCliente,
    });
    const resultAll = await listUsersUseCase.execute({
      requester: superAdmin,
      pagination: { limit: 20, offset: 0 },
    });
    expect(resultAll.total).toBe(2);

    await expect(
      getUserUseCase.execute({ userId: otherUser.id, requester: adminA }),
    ).rejects.toBeInstanceOf(UserNotFoundError);
  });

  it('un AdminCliente no puede crear ni ascender un SuperAdmin (criterio 4)', async () => {
    const companyId = await insertCompany(dataSource);
    const admin = { companyId, role: UserRole.AdminCliente };

    await expect(
      createUserUseCase.execute({
        requester: admin,
        email: 'nuevo@ewcontrol.local',
        password: 'Demo1234!',
        role: UserRole.SuperAdmin,
      }),
    ).rejects.toBeInstanceOf(CannotCreateSuperAdminError);

    const user = await createUserUseCase.execute({
      requester: admin,
      email: 'nuevo2@ewcontrol.local',
      password: 'Demo1234!',
      role: UserRole.AdminCliente,
    });
    await expect(
      updateUserUseCase.execute({ userId: user.id, requester: admin, role: UserRole.SuperAdmin }),
    ).rejects.toBeInstanceOf(CannotCreateSuperAdminError);
  });

  it('el email de User es único en toda la plataforma (criterio 10)', async () => {
    const companyA = await insertCompany(dataSource, 'Empresa A');
    const companyB = await insertCompany(dataSource, 'Empresa B');
    await createUserUseCase.execute({
      requester: { companyId: companyA, role: UserRole.AdminCliente },
      email: 'duplicado@ewcontrol.local',
      password: 'Demo1234!',
      role: UserRole.AdminCliente,
    });

    await expect(
      createUserUseCase.execute({
        requester: { companyId: companyB, role: UserRole.AdminCliente },
        email: 'duplicado@ewcontrol.local',
        password: 'Demo1234!',
        role: UserRole.AdminCliente,
      }),
    ).rejects.toBeInstanceOf(EmailAlreadyExistsError);
  });

  it('DELETE es baja lógica que invalida los refresh tokens activos; un User no puede darse de baja a sí mismo (criterios 5, 6)', async () => {
    const companyId = await insertCompany(dataSource);
    const admin = { companyId, role: UserRole.AdminCliente };
    const user = await createUserUseCase.execute({
      requester: admin,
      email: 'nuevo@ewcontrol.local',
      password: 'Demo1234!',
      role: UserRole.AdminCliente,
    });
    const tokenId = await insertRefreshToken(dataSource, user.id);

    await expect(
      deactivateUserUseCase.execute({ userId: user.id, requesterId: user.id, requester: admin }),
    ).rejects.toBeInstanceOf(CannotDeactivateSelfError);

    await deactivateUserUseCase.execute({
      userId: user.id,
      requesterId: 'another-requester-id',
      requester: admin,
    });

    const [userRow] = await dataSource.query('SELECT is_active FROM users WHERE id = $1', [
      user.id,
    ]);
    expect(userRow.is_active).toBe(false);
    const [tokenRow] = await dataSource.query('SELECT status FROM refresh_tokens WHERE id = $1', [
      tokenId,
    ]);
    expect(tokenRow.status).toBe('revoked');
  });
});
