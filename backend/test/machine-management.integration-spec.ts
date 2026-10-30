/**
 * Test de integración (Documento 0, "Pirámide de Testing") de
 * docs/specs/06-gestion-machines-signals.md: arranca `MachineManagementModule`
 * real contra el Postgres de `docker compose`, sin pasar por HTTP (igual que
 * `auth.integration-spec.ts`). Cubre los criterios de aceptación backend 1-6 y 8;
 * el criterio 7 (rechazo de campos no declarados vía whitelist/forbidNonWhitelisted)
 * es un comportamiento del `ValidationPipe` HTTP y ya está cubierto en
 * `machine.controller.spec.ts` / `signal.controller.spec.ts`, no aquí.
 */
import { INestApplicationContext } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { getDataSourceToken } from '@nestjs/typeorm';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ProviderType } from '../src/entities/provider-type.enum';
import { SignalType } from '../src/entities/signal-type.enum';
import { UserRole } from '../src/entities/user-role.enum';
import { MachineManagementModule } from '../src/frameworks-drivers/machine-management.module';
import { SeedModule } from '../src/frameworks-drivers/seed.module';
import {
  ISignalRepository,
  SIGNAL_REPOSITORY,
} from '../src/use-cases/seed-demo-environment/ports/signal-repository.port';
import {
  IUnitOfWork,
  UNIT_OF_WORK,
} from '../src/use-cases/seed-demo-environment/ports/unit-of-work.port';
import { CreateMachineUseCase } from '../src/use-cases/machine-management/create-machine.use-case';
import { CreateSignalUseCase } from '../src/use-cases/machine-management/create-signal.use-case';
import { DeleteMachineUseCase } from '../src/use-cases/machine-management/delete-machine.use-case';
import { FormulaReferencesUnknownVariableError } from '../src/use-cases/machine-management/errors/formula-references-unknown-variable.error';
import { InvalidConnectionConfigError } from '../src/use-cases/machine-management/errors/invalid-connection-config.error';
import { MachineInactiveError } from '../src/use-cases/machine-management/errors/machine-inactive.error';
import { MachineNotFoundError } from '../src/use-cases/machine-management/errors/machine-not-found.error';
import { ProviderNotSupportedError } from '../src/use-cases/machine-management/errors/provider-not-supported.error';
import { GetMachineConnectionUseCase } from '../src/use-cases/machine-management/get-machine-connection.use-case';
import { GetMachineUseCase } from '../src/use-cases/machine-management/get-machine.use-case';
import { ListMachinesUseCase } from '../src/use-cases/machine-management/list-machines.use-case';
import { ReplaceMachineConnectionUseCase } from '../src/use-cases/machine-management/replace-machine-connection.use-case';
import { UpdateMachineUseCase } from '../src/use-cases/machine-management/update-machine.use-case';

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

async function insertMachine(
  dataSource: DataSource,
  companyId: string,
  options: { name?: string; isActive?: boolean } = {},
): Promise<string> {
  const [row] = await dataSource.query(
    'INSERT INTO machines (company_id, name, is_active) VALUES ($1, $2, $3) RETURNING id',
    [companyId, options.name ?? 'Bobinadora Demo', options.isActive ?? true],
  );
  return row.id;
}

async function insertMachineConnection(
  dataSource: DataSource,
  machineId: string,
  connectionConfig: unknown,
): Promise<void> {
  await dataSource.query(
    'INSERT INTO machine_connections (machine_id, provider_type, connection_config) VALUES ($1, $2, $3)',
    [machineId, ProviderType.Simulator, JSON.stringify(connectionConfig)],
  );
}

describe('Machine/Signal management (integration)', () => {
  let app: INestApplicationContext;
  let dataSource: DataSource;
  let createMachineUseCase: CreateMachineUseCase;
  let listMachinesUseCase: ListMachinesUseCase;
  let getMachineUseCase: GetMachineUseCase;
  let updateMachineUseCase: UpdateMachineUseCase;
  let deleteMachineUseCase: DeleteMachineUseCase;
  let getMachineConnectionUseCase: GetMachineConnectionUseCase;
  let replaceMachineConnectionUseCase: ReplaceMachineConnectionUseCase;
  let createSignalUseCase: CreateSignalUseCase;
  let signalRepository: ISignalRepository;
  let unitOfWork: IUnitOfWork;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [SeedModule, MachineManagementModule, EventEmitterModule.forRoot()],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    dataSource = app.get(getDataSourceToken());
    createMachineUseCase = app.get(CreateMachineUseCase);
    listMachinesUseCase = app.get(ListMachinesUseCase);
    getMachineUseCase = app.get(GetMachineUseCase);
    updateMachineUseCase = app.get(UpdateMachineUseCase);
    deleteMachineUseCase = app.get(DeleteMachineUseCase);
    getMachineConnectionUseCase = app.get(GetMachineConnectionUseCase);
    replaceMachineConnectionUseCase = app.get(ReplaceMachineConnectionUseCase);
    createSignalUseCase = app.get(CreateSignalUseCase);
    signalRepository = app.get(SIGNAL_REPOSITORY);
    unitOfWork = app.get(UNIT_OF_WORK);
  });

  beforeEach(async () => {
    await truncateTables(dataSource);
  });

  afterAll(async () => {
    await truncateTables(dataSource);
    await app.close();
  });

  it('crea la Machine y su MachineConnection Simulator por defecto atómicamente (criterio 1)', async () => {
    const companyId = await insertCompany(dataSource);

    const { machine, connection } = await createMachineUseCase.execute({
      companyId,
      name: 'Bobinadora 1',
    });

    expect(machine.name).toBe('Bobinadora 1');
    expect(connection.providerType).toBe(ProviderType.Simulator);
    const [row] = await dataSource.query(
      'SELECT provider_type, connection_config FROM machine_connections WHERE machine_id = $1',
      [machine.id],
    );
    expect(row.provider_type).toBe(ProviderType.Simulator);
    expect(row.connection_config).toEqual({ seedProfile: 'empty', signals: [] });
  });

  it('lista y consulta solo Machines activas de la Company del requester; un SuperAdmin ve todas (criterios 2, 6)', async () => {
    const companyA = await insertCompany(dataSource, 'Empresa A');
    const companyB = await insertCompany(dataSource, 'Empresa B');
    const activeInA = await insertMachine(dataSource, companyA, { name: 'Activa A' });
    await insertMachine(dataSource, companyA, { name: 'Inactiva A', isActive: false });
    const machineInB = await insertMachine(dataSource, companyB, { name: 'Activa B' });

    const adminA = { companyId: companyA, role: UserRole.AdminCliente };
    const resultA = await listMachinesUseCase.execute({
      requester: adminA,
      pagination: { limit: 20, offset: 0 },
    });
    expect(resultA.data.map((m) => m.id)).toEqual([activeInA]);

    const superAdmin = { companyId: companyA, role: UserRole.SuperAdmin };
    const resultAll = await listMachinesUseCase.execute({
      requester: superAdmin,
      pagination: { limit: 20, offset: 0 },
    });
    expect(resultAll.total).toBe(2); // las 2 activas, de ambas Companies

    await expect(
      getMachineUseCase.execute({ machineId: machineInB, requester: adminA }),
    ).rejects.toBeInstanceOf(MachineNotFoundError);

    const machine = await getMachineUseCase.execute({
      machineId: machineInB,
      requester: superAdmin,
    });
    expect(machine.id).toBe(machineInB);
  });

  it('la baja lógica de una Machine desactiva en cascada todas sus Signals reales, sin borrar filas (criterio 3)', async () => {
    const companyId = await insertCompany(dataSource);
    const machineId = await insertMachine(dataSource, companyId);
    await insertMachineConnection(dataSource, machineId, { seedProfile: 'empty', signals: [] });
    const requester = { companyId, role: UserRole.AdminCliente };
    const signal = await createSignalUseCase.execute({
      machineId,
      requester,
      name: 'Temperatura',
      signalType: SignalType.DIRECT,
      signalSource: { variableName: 'temperature' },
      unit: '°C',
    });

    await deleteMachineUseCase.execute({ machineId, requester });

    const [machineRow] = await dataSource.query('SELECT is_active FROM machines WHERE id = $1', [
      machineId,
    ]);
    expect(machineRow.is_active).toBe(false);
    const [signalRow] = await dataSource.query('SELECT is_active FROM signals WHERE id = $1', [
      signal.id,
    ]);
    expect(signalRow.is_active).toBe(false);
    const [count] = await dataSource.query('SELECT COUNT(*)::int AS c FROM signals WHERE id = $1', [
      signal.id,
    ]);
    expect(count.c).toBe(1); // la fila sigue existiendo, no se borra
  });

  it('PUT connection con Simulator reemplaza la config; un provider no soportado responde 422 (criterio 4, ampliado por spec 18)', async () => {
    const companyId = await insertCompany(dataSource);
    const machineId = await insertMachine(dataSource, companyId);
    await insertMachineConnection(dataSource, machineId, { seedProfile: 'empty', signals: [] });
    const requester = { companyId, role: UserRole.AdminCliente };

    const replaced = await replaceMachineConnectionUseCase.execute({
      machineId,
      requester,
      providerType: ProviderType.Simulator,
      connectionConfig: { seedProfile: 'demo', signals: [] },
    });
    expect(replaced.connectionConfig).toEqual({ seedProfile: 'demo', signals: [] });

    await expect(
      replaceMachineConnectionUseCase.execute({
        machineId,
        requester,
        providerType: ProviderType.Mqtt,
        connectionConfig: {},
      }),
    ).rejects.toBeInstanceOf(ProviderNotSupportedError);

    const connection = await getMachineConnectionUseCase.execute({ machineId, requester });
    expect(connection?.connectionConfig).toEqual({ seedProfile: 'demo', signals: [] });
  });

  it('PUT connection OpcUa: una config inválida no toca la conexión; una válida se persiste normalizada (spec 18, criterios 1 y 3)', async () => {
    const companyId = await insertCompany(dataSource);
    const machineId = await insertMachine(dataSource, companyId);
    await insertMachineConnection(dataSource, machineId, { seedProfile: 'demo', signals: [] });
    const requester = { companyId, role: UserRole.AdminCliente };

    await expect(
      replaceMachineConnectionUseCase.execute({
        machineId,
        requester,
        providerType: ProviderType.OpcUa,
        connectionConfig: {},
      }),
    ).rejects.toBeInstanceOf(InvalidConnectionConfigError);
    const unchanged = await getMachineConnectionUseCase.execute({ machineId, requester });
    expect(unchanged?.providerType).toBe(ProviderType.Simulator);

    const nodeMapping = [
      { nodeId: 'ns=3;s="Lectura"."REAL_1"', signalVariableName: 'Lectura_REAL_1' },
    ];
    await replaceMachineConnectionUseCase.execute({
      machineId,
      requester,
      providerType: ProviderType.OpcUa,
      connectionConfig: { endpointUrl: 'opc.tcp://192.168.1.1:4840', nodeMapping },
    });

    const connection = await getMachineConnectionUseCase.execute({ machineId, requester });
    expect(connection?.providerType).toBe(ProviderType.OpcUa);
    expect(connection?.connectionConfig).toEqual({
      endpointUrl: 'opc.tcp://192.168.1.1:4840',
      securityMode: 'None',
      securityPolicy: 'None',
      authMode: 'Anonymous',
      timeoutMs: 5000,
      samplingIntervalMs: 1000,
      nodeMapping,
    });
  });

  it('una Signal FORMULA solo puede referenciar variables reales de la MachineConnection (criterio 5)', async () => {
    const companyId = await insertCompany(dataSource);
    const machineId = await insertMachine(dataSource, companyId);
    await insertMachineConnection(dataSource, machineId, {
      seedProfile: 'demo',
      signals: [{ variableName: 'temperature', min: 0, max: 100, stepMax: 1 }],
    });
    const requester = { companyId, role: UserRole.AdminCliente };

    const signal = await createSignalUseCase.execute({
      machineId,
      requester,
      name: 'Doble temperatura',
      signalType: SignalType.FORMULA,
      signalSource: { expression: 'temperature * 2', variables: ['temperature'] },
      unit: '°C',
    });
    expect(signal.signalType).toBe(SignalType.FORMULA);

    await expect(
      createSignalUseCase.execute({
        machineId,
        requester,
        name: 'Inválida',
        signalType: SignalType.FORMULA,
        signalSource: { expression: 'pressure * 2', variables: ['pressure'] },
        unit: 'bar',
      }),
    ).rejects.toBeInstanceOf(FormulaReferencesUnknownVariableError);

    const [count] = await dataSource.query(
      'SELECT COUNT(*)::int AS c FROM signals WHERE machine_id = $1',
      [machineId],
    );
    expect(count.c).toBe(1); // la Signal inválida nunca se persistió
  });

  it('operar sobre una Machine ya inactiva responde 422, incluyendo la doble baja (criterio 8)', async () => {
    const companyId = await insertCompany(dataSource);
    const machineId = await insertMachine(dataSource, companyId);
    await insertMachineConnection(dataSource, machineId, { seedProfile: 'empty', signals: [] });
    const requester = { companyId, role: UserRole.AdminCliente };

    await deleteMachineUseCase.execute({ machineId, requester });

    await expect(deleteMachineUseCase.execute({ machineId, requester })).rejects.toBeInstanceOf(
      MachineInactiveError,
    );

    await expect(
      updateMachineUseCase.execute({ machineId, requester, name: 'Nuevo nombre' }),
    ).rejects.toBeInstanceOf(MachineInactiveError);

    await expect(
      createSignalUseCase.execute({
        machineId,
        requester,
        name: 'Temperatura',
        signalType: SignalType.DIRECT,
        signalSource: { variableName: 'temperature' },
        unit: '°C',
      }),
    ).rejects.toBeInstanceOf(MachineInactiveError);
  });

  it('findActiveDirectByMachineAndVariableName resuelve solo la Signal DIRECT activa que expone esa variable (docs/specs/07)', async () => {
    const companyId = await insertCompany(dataSource);
    const machineId = await insertMachine(dataSource, companyId);
    await insertMachineConnection(dataSource, machineId, {
      seedProfile: 'demo',
      signals: [{ variableName: 'temperature', min: 0, max: 100, stepMax: 1 }],
    });
    const requester = { companyId, role: UserRole.AdminCliente };
    const directSignal = await createSignalUseCase.execute({
      machineId,
      requester,
      name: 'Temperatura',
      signalType: SignalType.DIRECT,
      signalSource: { variableName: 'temperature' },
      unit: '°C',
    });
    await createSignalUseCase.execute({
      machineId,
      requester,
      name: 'Doble temperatura',
      signalType: SignalType.FORMULA,
      signalSource: { expression: 'temperature * 2', variables: ['temperature'] },
      unit: '°C',
    });

    const found = await unitOfWork.runInTransaction((ctx) =>
      signalRepository.findActiveDirectByMachineAndVariableName(machineId, 'temperature', ctx),
    );

    expect(found?.id).toBe(directSignal.id);

    const notFound = await unitOfWork.runInTransaction((ctx) =>
      signalRepository.findActiveDirectByMachineAndVariableName(machineId, 'pressure', ctx),
    );
    expect(notFound).toBeNull();
  });

  it('findActiveFormulasByMachineAndVariableName resuelve solo las Signals FORMULA activas que referencian esa variable (docs/specs/13)', async () => {
    const companyId = await insertCompany(dataSource);
    const machineId = await insertMachine(dataSource, companyId);
    await insertMachineConnection(dataSource, machineId, {
      seedProfile: 'demo',
      signals: [
        { variableName: 'voltage', min: 0, max: 400, stepMax: 1 },
        { variableName: 'current', min: 0, max: 25, stepMax: 1 },
      ],
    });
    const requester = { companyId, role: UserRole.AdminCliente };
    await createSignalUseCase.execute({
      machineId,
      requester,
      name: 'Voltaje',
      signalType: SignalType.DIRECT,
      signalSource: { variableName: 'voltage' },
      unit: 'V',
    });
    const power = await createSignalUseCase.execute({
      machineId,
      requester,
      name: 'Potencia',
      signalType: SignalType.FORMULA,
      signalSource: { expression: 'voltage * current', variables: ['voltage', 'current'] },
      unit: 'W',
    });
    const doubleCurrent = await createSignalUseCase.execute({
      machineId,
      requester,
      name: 'Doble corriente',
      signalType: SignalType.FORMULA,
      signalSource: { expression: 'current * 2', variables: ['current'] },
      unit: 'A',
    });

    const referencingVoltage = await unitOfWork.runInTransaction((ctx) =>
      signalRepository.findActiveFormulasByMachineAndVariableName(machineId, 'voltage', ctx),
    );
    expect(referencingVoltage.map((signal) => signal.id)).toEqual([power.id]);

    const referencingCurrent = await unitOfWork.runInTransaction((ctx) =>
      signalRepository.findActiveFormulasByMachineAndVariableName(machineId, 'current', ctx),
    );
    expect(referencingCurrent.map((signal) => signal.id).sort()).toEqual(
      [power.id, doubleCurrent.id].sort(),
    );

    const referencingUnused = await unitOfWork.runInTransaction((ctx) =>
      signalRepository.findActiveFormulasByMachineAndVariableName(machineId, 'unused', ctx),
    );
    expect(referencingUnused).toEqual([]);
  });
});
