/**
 * Test de integración (Documento 0, "Pirámide de Testing") de
 * docs/specs/09-alarmas.md: arranca `AlarmsModule` + `SimulatorModule`
 * (`IngestSignalTickUseCase`, el Signal Engine) + `MachineManagementModule`
 * reales contra el Postgres/InfluxDB de `docker compose`, cubriendo el flujo
 * completo tick → SignalUpdated → Alarm Engine → AlarmState, de punta a punta
 * (un test por flujo, como ya hace `dashboard-realtime.integration-spec.ts`).
 */
import { INestApplication } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AlarmPriority } from '../src/entities/alarm-priority.enum';
import { SignalQuality } from '../src/entities/signal-quality.enum';
import { SignalType } from '../src/entities/signal-type.enum';
import { UserRole } from '../src/entities/user-role.enum';
import { AlarmsModule } from '../src/frameworks-drivers/alarms.module';
import { MachineManagementModule } from '../src/frameworks-drivers/machine-management.module';
import { SeedModule } from '../src/frameworks-drivers/seed.module';
import { SimulatorModule } from '../src/frameworks-drivers/simulator.module';
import { CreateAlarmDefinitionUseCase } from '../src/use-cases/alarms/create-alarm-definition.use-case';
import { IngestSignalTickUseCase } from '../src/use-cases/dashboard/ingest-signal-tick.use-case';
import { CreateMachineUseCase } from '../src/use-cases/machine-management/create-machine.use-case';
import { CreateSignalUseCase } from '../src/use-cases/machine-management/create-signal.use-case';

async function truncateTables(dataSource: DataSource): Promise<void> {
  await dataSource.query(
    'TRUNCATE TABLE "alarm_states", "alarm_definitions", "dashboard_widget_signals", "dashboard_widgets", "dashboards", "auth_audit_log", "refresh_tokens", "signals", "machine_connections", "machines", "users", "companies" RESTART IDENTITY CASCADE',
  );
}

async function insertCompany(dataSource: DataSource, name = 'Empresa Demo'): Promise<string> {
  const [row] = await dataSource.query(
    'INSERT INTO companies (name, is_active) VALUES ($1, true) RETURNING id',
    [name],
  );
  return row.id;
}

/**
 * El Alarm Engine reacciona a `SignalUpdated` vía `@OnEvent` (`EventEmitter2`
 * no espera a los listeners asíncronos), así que su escritura en `alarm_states`
 * ocurre después de que `IngestSignalTickUseCase.execute()` ya haya resuelto.
 * Sondea la fila esperada con un timeout acotado en vez de asumir que ya existe.
 */
type AlarmStateRow = { status: string; resolvedAt: Date | null };

async function waitForAlarmState(
  dataSource: DataSource,
  alarmDefinitionId: string,
  predicate: (rows: AlarmStateRow[]) => boolean,
): Promise<AlarmStateRow[]> {
  const deadline = Date.now() + 3000;
  for (;;) {
    const rows: AlarmStateRow[] = await dataSource.query(
      'SELECT status, resolved_at AS "resolvedAt" FROM alarm_states WHERE alarm_definition_id = $1',
      [alarmDefinitionId],
    );
    if (predicate(rows)) {
      return rows;
    }
    if (Date.now() > deadline) {
      throw new Error(`Timeout esperando el AlarmState de ${alarmDefinitionId}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

describe('Alarmas (integration)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let createMachineUseCase: CreateMachineUseCase;
  let createSignalUseCase: CreateSignalUseCase;
  let createAlarmDefinitionUseCase: CreateAlarmDefinitionUseCase;
  let ingestSignalTick: IngestSignalTickUseCase;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        SeedModule,
        MachineManagementModule,
        SimulatorModule,
        AlarmsModule,
        EventEmitterModule.forRoot(),
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();

    dataSource = app.get(getDataSourceToken());
    createMachineUseCase = app.get(CreateMachineUseCase);
    createSignalUseCase = app.get(CreateSignalUseCase);
    createAlarmDefinitionUseCase = app.get(CreateAlarmDefinitionUseCase);
    ingestSignalTick = app.get(IngestSignalTickUseCase);
  });

  beforeEach(async () => {
    await truncateTables(dataSource);
  });

  afterAll(async () => {
    await truncateTables(dataSource);
    await app.close();
  });

  async function createFixture(companyId: string) {
    const { machine } = await createMachineUseCase.execute({ companyId, name: 'Bobinadora Demo' });
    const requester = { companyId, role: UserRole.AdminCliente };
    const signal = await createSignalUseCase.execute({
      machineId: machine.id,
      requester,
      name: 'Temperatura',
      signalType: SignalType.DIRECT,
      signalSource: { variableName: 'temperature' },
      unit: '°C',
    });
    const alarmDefinition = await createAlarmDefinitionUseCase.execute({
      signalId: signal.id,
      requester,
      operator: '>',
      threshold: 80,
      priority: AlarmPriority.High,
      notifyByEmail: false,
      showOnDashboard: true,
    });
    return { machine, signal, requester, alarmDefinition };
  }

  it('un tick que cruza el umbral activa la alarma, y un tick posterior que ya no lo cumple la resuelve', async () => {
    const companyId = await insertCompany(dataSource);
    const { machine, alarmDefinition } = await createFixture(companyId);

    await ingestSignalTick.execute({
      machineId: machine.id,
      variableName: 'temperature',
      value: 84,
      quality: SignalQuality.Good,
      timestamp: new Date('2026-07-13T10:00:00Z'),
    });

    const [activeRow] = await waitForAlarmState(
      dataSource,
      alarmDefinition.id,
      (rows) => rows.length === 1 && rows[0].status === 'ACTIVE',
    );
    expect(activeRow.status).toBe('ACTIVE');
    expect(activeRow.resolvedAt).toBeNull();

    await ingestSignalTick.execute({
      machineId: machine.id,
      variableName: 'temperature',
      value: 75,
      quality: SignalQuality.Good,
      timestamp: new Date('2026-07-13T10:05:00Z'),
    });

    const [resolvedRow] = await waitForAlarmState(
      dataSource,
      alarmDefinition.id,
      (rows) => rows.length === 1 && rows[0].status === 'INACTIVE',
    );
    expect(resolvedRow.status).toBe('INACTIVE');
    expect(resolvedRow.resolvedAt).not.toBeNull();
  });

  it('ticks sucesivos que siguen cumpliendo la condición no generan más de un AlarmState (sin duplicados)', async () => {
    const companyId = await insertCompany(dataSource);
    const { machine, alarmDefinition } = await createFixture(companyId);

    await ingestSignalTick.execute({
      machineId: machine.id,
      variableName: 'temperature',
      value: 84,
      quality: SignalQuality.Good,
      timestamp: new Date('2026-07-13T10:00:00Z'),
    });
    await waitForAlarmState(
      dataSource,
      alarmDefinition.id,
      (rows) => rows.length === 1 && rows[0].status === 'ACTIVE',
    );

    await ingestSignalTick.execute({
      machineId: machine.id,
      variableName: 'temperature',
      value: 86,
      quality: SignalQuality.Good,
      timestamp: new Date('2026-07-13T10:01:00Z'),
    });
    // Deja tiempo a que el listener asíncrono procese el segundo tick antes de contar filas.
    await new Promise((resolve) => setTimeout(resolve, 300));

    const rows = await dataSource.query(
      'SELECT id FROM alarm_states WHERE alarm_definition_id = $1',
      [alarmDefinition.id],
    );
    expect(rows).toHaveLength(1);
  });
});
