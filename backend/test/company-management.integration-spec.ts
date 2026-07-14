/**
 * Test de integración (Documento 0, "Pirámide de Testing") de
 * docs/specs/10-gestion-companies-users.md (Company): arranca
 * `CompanyManagementModule` real contra el Postgres de `docker compose`, sin
 * pasar por HTTP (igual que `machine-management.integration-spec.ts`). El gate
 * de rol (`403` para no-SuperAdmin) es responsabilidad de `RolesGuard` y ya
 * está cubierto en `company.controller.spec.ts`, no aquí.
 */
import { INestApplicationContext } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { CompanyManagementModule } from '../src/frameworks-drivers/company-management.module';
import { SeedModule } from '../src/frameworks-drivers/seed.module';
import { CreateCompanyUseCase } from '../src/use-cases/company-management/create-company.use-case';
import { DeactivateCompanyUseCase } from '../src/use-cases/company-management/deactivate-company.use-case';
import { CompanyNotFoundError } from '../src/use-cases/company-management/errors/company-not-found.error';
import { GetCompanyUseCase } from '../src/use-cases/company-management/get-company.use-case';
import { ListCompaniesUseCase } from '../src/use-cases/company-management/list-companies.use-case';
import { UpdateCompanyUseCase } from '../src/use-cases/company-management/update-company.use-case';

async function truncateTables(dataSource: DataSource): Promise<void> {
  await dataSource.query(
    'TRUNCATE TABLE "auth_audit_log", "refresh_tokens", "signals", "machine_connections", "machines", "users", "companies" RESTART IDENTITY CASCADE',
  );
}

describe('Company management (integration)', () => {
  let app: INestApplicationContext;
  let dataSource: DataSource;
  let createCompanyUseCase: CreateCompanyUseCase;
  let listCompaniesUseCase: ListCompaniesUseCase;
  let getCompanyUseCase: GetCompanyUseCase;
  let updateCompanyUseCase: UpdateCompanyUseCase;
  let deactivateCompanyUseCase: DeactivateCompanyUseCase;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [SeedModule, CompanyManagementModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    dataSource = app.get(getDataSourceToken());
    createCompanyUseCase = app.get(CreateCompanyUseCase);
    listCompaniesUseCase = app.get(ListCompaniesUseCase);
    getCompanyUseCase = app.get(GetCompanyUseCase);
    updateCompanyUseCase = app.get(UpdateCompanyUseCase);
    deactivateCompanyUseCase = app.get(DeactivateCompanyUseCase);
  });

  beforeEach(async () => {
    await truncateTables(dataSource);
  });

  afterAll(async () => {
    await truncateTables(dataSource);
    await app.close();
  });

  it('crea una Company activa', async () => {
    const company = await createCompanyUseCase.execute({ name: 'ACME' });

    expect(company.name).toBe('ACME');
    expect(company.isActive).toBe(true);
  });

  it('lista todas las Companies, activas e inactivas, paginadas', async () => {
    const active = await createCompanyUseCase.execute({ name: 'Activa' });
    const inactive = await createCompanyUseCase.execute({ name: 'Inactiva' });
    await deactivateCompanyUseCase.execute({ companyId: inactive.id });

    const result = await listCompaniesUseCase.execute({ pagination: { limit: 20, offset: 0 } });

    expect(result.total).toBe(2);
    expect(result.data.map((c) => c.id).sort()).toEqual([active.id, inactive.id].sort());
  });

  it('actualiza el nombre de una Company existente y responde CompanyNotFoundError si no existe', async () => {
    const company = await createCompanyUseCase.execute({ name: 'ACME' });

    const updated = await updateCompanyUseCase.execute({
      companyId: company.id,
      name: 'ACME Corp',
    });
    expect(updated.name).toBe('ACME Corp');

    await expect(
      updateCompanyUseCase.execute({
        companyId: '00000000-0000-0000-0000-000000000000',
        name: 'x',
      }),
    ).rejects.toBeInstanceOf(CompanyNotFoundError);
  });

  it('la baja lógica marca isActive=false sin eliminar la fila', async () => {
    const company = await createCompanyUseCase.execute({ name: 'ACME' });

    await deactivateCompanyUseCase.execute({ companyId: company.id });

    const fetched = await getCompanyUseCase.execute({ companyId: company.id });
    expect(fetched.isActive).toBe(false);
    const [count] = await dataSource.query(
      'SELECT COUNT(*)::int AS c FROM companies WHERE id = $1',
      [company.id],
    );
    expect(count.c).toBe(1);
  });

  it('GET/PATCH/DELETE de una Company inexistente responden CompanyNotFoundError', async () => {
    await expect(
      getCompanyUseCase.execute({ companyId: '00000000-0000-0000-0000-000000000000' }),
    ).rejects.toBeInstanceOf(CompanyNotFoundError);
    await expect(
      deactivateCompanyUseCase.execute({ companyId: '00000000-0000-0000-0000-000000000000' }),
    ).rejects.toBeInstanceOf(CompanyNotFoundError);
  });
});
