/**
 * Test de integración (Documento 0, "Pirámide de Testing") de
 * docs/specs/10-gestion-companies-users.md (reactivar Company + borrado
 * permanente): arranca `CompanyManagementModule` real contra el Postgres y el
 * InfluxDB de `docker compose`, sin pasar por HTTP (igual que
 * `company-management.integration-spec.ts`). Cubre de extremo a extremo que
 * `DeleteCompanyPermanentlyUseCase` borra en cascada Users/Machines/
 * MachineConnections/Signals/Dashboards en Postgres y el histórico de
 * InfluxDB de la Company (criterio de aceptación backend 15).
 */
import { INestApplicationContext } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ProviderType } from '../src/entities/provider-type.enum';
import { CompanyManagementModule } from '../src/frameworks-drivers/company-management.module';
import { HistoryPersistenceModule } from '../src/frameworks-drivers/history-persistence.module';
import { SeedModule } from '../src/frameworks-drivers/seed.module';
import { HISTORY_READER, IHistoryReader } from '../src/use-cases/history/ports/history-reader.port';
import { HISTORY_WRITER, IHistoryWriter } from '../src/use-cases/history/ports/history-writer.port';
import { CreateCompanyUseCase } from '../src/use-cases/company-management/create-company.use-case';
import { DeactivateCompanyUseCase } from '../src/use-cases/company-management/deactivate-company.use-case';
import { DeleteCompanyPermanentlyUseCase } from '../src/use-cases/company-management/delete-company-permanently.use-case';
import { CompanyNotFoundError } from '../src/use-cases/company-management/errors/company-not-found.error';
import { GetCompanyUseCase } from '../src/use-cases/company-management/get-company.use-case';
import { ReactivateCompanyUseCase } from '../src/use-cases/company-management/reactivate-company.use-case';

async function truncateTables(dataSource: DataSource): Promise<void> {
  await dataSource.query(
    'TRUNCATE TABLE "auth_audit_log", "refresh_tokens", "dashboard_widget_signals", "dashboard_widgets", "dashboards", "signals", "machine_connections", "machines", "users", "companies" RESTART IDENTITY CASCADE',
  );
}

async function insertUser(dataSource: DataSource, companyId: string): Promise<string> {
  const [row] = await dataSource.query(
    'INSERT INTO users (company_id, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id',
    [companyId, `user-${Date.now()}-${Math.random()}@ewcontrol.local`, 'hash', 'AdminCliente'],
  );
  return row.id;
}

async function insertMachine(dataSource: DataSource, companyId: string): Promise<string> {
  const [row] = await dataSource.query(
    'INSERT INTO machines (company_id, name, is_active) VALUES ($1, $2, true) RETURNING id',
    [companyId, 'Bobinadora Demo'],
  );
  return row.id;
}

async function insertMachineConnection(dataSource: DataSource, machineId: string): Promise<void> {
  await dataSource.query(
    'INSERT INTO machine_connections (machine_id, provider_type, connection_config) VALUES ($1, $2, $3)',
    [machineId, ProviderType.Simulator, JSON.stringify({ simulationProfile: 'stable' })],
  );
}

async function insertSignal(dataSource: DataSource, machineId: string): Promise<string> {
  const [row] = await dataSource.query(
    `INSERT INTO signals (machine_id, name, signal_type, signal_source, unit, history_enabled)
     VALUES ($1, $2, $3, $4, $5, false) RETURNING id`,
    [machineId, 'Temperatura', 'DIRECT', JSON.stringify({ variableName: 'temperature' }), 'C'],
  );
  return row.id;
}

async function insertDashboard(dataSource: DataSource, companyId: string): Promise<string> {
  const [row] = await dataSource.query(
    'INSERT INTO dashboards (company_id, name) VALUES ($1, $2) RETURNING id',
    [companyId, 'Dashboard Demo'],
  );
  return row.id;
}

async function countRows(dataSource: DataSource, table: string, where: string, param: string) {
  const [{ c }] = await dataSource.query(`SELECT COUNT(*)::int AS c FROM ${table} WHERE ${where}`, [
    param,
  ]);
  return c;
}

describe('Company reactivate + purge (integration)', () => {
  let app: INestApplicationContext;
  let dataSource: DataSource;
  let createCompanyUseCase: CreateCompanyUseCase;
  let deactivateCompanyUseCase: DeactivateCompanyUseCase;
  let reactivateCompanyUseCase: ReactivateCompanyUseCase;
  let deleteCompanyPermanentlyUseCase: DeleteCompanyPermanentlyUseCase;
  let getCompanyUseCase: GetCompanyUseCase;
  let historyWriter: IHistoryWriter;
  let historyReader: IHistoryReader;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [SeedModule, CompanyManagementModule, HistoryPersistenceModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    dataSource = app.get(getDataSourceToken());
    createCompanyUseCase = app.get(CreateCompanyUseCase);
    deactivateCompanyUseCase = app.get(DeactivateCompanyUseCase);
    reactivateCompanyUseCase = app.get(ReactivateCompanyUseCase);
    deleteCompanyPermanentlyUseCase = app.get(DeleteCompanyPermanentlyUseCase);
    getCompanyUseCase = app.get(GetCompanyUseCase);
    historyWriter = app.get<IHistoryWriter>(HISTORY_WRITER);
    historyReader = app.get<IHistoryReader>(HISTORY_READER);
  });

  beforeEach(async () => {
    await truncateTables(dataSource);
  });

  afterAll(async () => {
    await truncateTables(dataSource);
    await app.close();
  });

  it('reactiva una Company dada de baja, restaurando isActive=true (criterio 14)', async () => {
    const company = await createCompanyUseCase.execute({ name: 'ACME' });
    await deactivateCompanyUseCase.execute({ companyId: company.id });

    const reactivated = await reactivateCompanyUseCase.execute({ companyId: company.id });

    expect(reactivated.isActive).toBe(true);
    const fetched = await getCompanyUseCase.execute({ companyId: company.id });
    expect(fetched.isActive).toBe(true);
  });

  it('reactivar es idempotente y responde CompanyNotFoundError si no existe', async () => {
    const company = await createCompanyUseCase.execute({ name: 'ACME' });

    await expect(reactivateCompanyUseCase.execute({ companyId: company.id })).resolves.toBeTruthy();
    await expect(
      reactivateCompanyUseCase.execute({ companyId: '00000000-0000-0000-0000-000000000000' }),
    ).rejects.toBeInstanceOf(CompanyNotFoundError);
  });

  it('el borrado permanente elimina la Company y todos sus recursos en Postgres, y su histórico en InfluxDB (criterio 15)', async () => {
    const company = await createCompanyUseCase.execute({ name: 'ACME Purge' });
    const userId = await insertUser(dataSource, company.id);
    const machineId = await insertMachine(dataSource, company.id);
    await insertMachineConnection(dataSource, machineId);
    const signalId = await insertSignal(dataSource, machineId);
    const dashboardId = await insertDashboard(dataSource, company.id);

    const from = new Date('2026-01-01T00:00:00Z');
    await historyWriter.writeBatch([
      { companyId: company.id, machineId, signalId, value: 42, timestamp: from },
    ]);
    const wideTo = new Date(from.getTime() + 24 * 60 * 60 * 1000);
    expect(
      await historyReader.queryRange({ signalId, from, to: wideTo, resolution: 'raw' }),
    ).toHaveLength(1);

    await deleteCompanyPermanentlyUseCase.execute({ companyId: company.id });

    expect(await countRows(dataSource, 'companies', 'id = $1', company.id)).toBe(0);
    expect(await countRows(dataSource, 'users', 'id = $1', userId)).toBe(0);
    expect(await countRows(dataSource, 'machines', 'id = $1', machineId)).toBe(0);
    expect(await countRows(dataSource, 'machine_connections', 'machine_id = $1', machineId)).toBe(
      0,
    );
    expect(await countRows(dataSource, 'signals', 'id = $1', signalId)).toBe(0);
    expect(await countRows(dataSource, 'dashboards', 'id = $1', dashboardId)).toBe(0);

    await expect(getCompanyUseCase.execute({ companyId: company.id })).rejects.toBeInstanceOf(
      CompanyNotFoundError,
    );

    const remainingPoints = await historyReader.queryRange({
      signalId,
      from,
      to: wideTo,
      resolution: 'raw',
    });
    expect(remainingPoints).toEqual([]);
  });

  it('el borrado permanente funciona igual sobre una Company inactiva y responde CompanyNotFoundError si no existe', async () => {
    const company = await createCompanyUseCase.execute({ name: 'Inactiva Purge' });
    await deactivateCompanyUseCase.execute({ companyId: company.id });

    await deleteCompanyPermanentlyUseCase.execute({ companyId: company.id });

    expect(await countRows(dataSource, 'companies', 'id = $1', company.id)).toBe(0);
    await expect(
      deleteCompanyPermanentlyUseCase.execute({
        companyId: '00000000-0000-0000-0000-000000000000',
      }),
    ).rejects.toBeInstanceOf(CompanyNotFoundError);
  });
});
