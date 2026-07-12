/**
 * Test de integración (Documento 0, "Pirámide de Testing") de
 * docs/specs/07-dashboard-tiempo-real.md: arranca `DashboardModule` +
 * `MachineManagementModule` reales contra el Postgres de `docker compose`,
 * cubriendo el flujo completo tick → Realtime Cache → evento → WebSocket Gateway
 * → cliente, más el CRUD de Dashboard/DashboardWidget (sin pasar por HTTP para
 * el CRUD, igual que `machine-management.integration-spec.ts`; con un servidor
 * HTTP real y un cliente `socket.io-client` para el WebSocket, el único caso que
 * lo necesita).
 */
import { INestApplication } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { io, type Socket as ClientSocket } from 'socket.io-client';
import { DataSource } from 'typeorm';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { REALTIME_CACHE, type IRealtimeCache } from '../src/entities/realtime-cache';
import { SignalQuality } from '../src/entities/signal-quality.enum';
import { SignalType } from '../src/entities/signal-type.enum';
import { UserRole } from '../src/entities/user-role.enum';
import { WidgetType } from '../src/entities/widget-type.enum';
import { DashboardModule } from '../src/frameworks-drivers/dashboard.module';
import { MachineManagementModule } from '../src/frameworks-drivers/machine-management.module';
import { SeedModule } from '../src/frameworks-drivers/seed.module';
import { SimulatorModule } from '../src/frameworks-drivers/simulator.module';
import { type ITokenService, TOKEN_SERVICE } from '../src/use-cases/auth/ports/token.port';
import { CreateDashboardUseCase } from '../src/use-cases/dashboard/create-dashboard.use-case';
import { CreateWidgetUseCase } from '../src/use-cases/dashboard/create-widget.use-case';
import { DeleteDashboardUseCase } from '../src/use-cases/dashboard/delete-dashboard.use-case';
import { SignalNotFoundForWidgetError } from '../src/use-cases/dashboard/errors/signal-not-found-for-widget.error';
import { SignalValueNotAvailableError } from '../src/use-cases/dashboard/errors/signal-value-not-available.error';
import { GetDashboardUseCase } from '../src/use-cases/dashboard/get-dashboard.use-case';
import { IngestSignalTickUseCase } from '../src/use-cases/dashboard/ingest-signal-tick.use-case';
import { MarkMachineSignalsOfflineUseCase } from '../src/use-cases/dashboard/mark-machine-signals-offline.use-case';
import { CreateMachineUseCase } from '../src/use-cases/machine-management/create-machine.use-case';
import { CreateSignalUseCase } from '../src/use-cases/machine-management/create-signal.use-case';
import { GetSignalValueUseCase } from '../src/use-cases/machine-management/get-signal-value.use-case';

async function truncateTables(dataSource: DataSource): Promise<void> {
  await dataSource.query(
    'TRUNCATE TABLE "dashboard_widget_signals", "dashboard_widgets", "dashboards", "auth_audit_log", "refresh_tokens", "signals", "machine_connections", "machines", "users", "companies" RESTART IDENTITY CASCADE',
  );
}

async function insertCompany(dataSource: DataSource, name = 'Empresa Demo'): Promise<string> {
  const [row] = await dataSource.query(
    'INSERT INTO companies (name, is_active) VALUES ($1, true) RETURNING id',
    [name],
  );
  return row.id;
}

describe('Dashboard en tiempo real (integration)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let createMachineUseCase: CreateMachineUseCase;
  let createSignalUseCase: CreateSignalUseCase;
  let createDashboardUseCase: CreateDashboardUseCase;
  let createWidgetUseCase: CreateWidgetUseCase;
  let getDashboardUseCase: GetDashboardUseCase;
  let deleteDashboardUseCase: DeleteDashboardUseCase;
  let ingestSignalTick: IngestSignalTickUseCase;
  let markSignalsOffline: MarkMachineSignalsOfflineUseCase;
  let getSignalValueUseCase: GetSignalValueUseCase;
  let realtimeCache: IRealtimeCache;
  let tokenService: ITokenService;
  let baseUrl: string;
  const sockets: ClientSocket[] = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        SeedModule,
        MachineManagementModule,
        DashboardModule,
        SimulatorModule,
        EventEmitterModule.forRoot(),
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useWebSocketAdapter(new IoAdapter(app));
    await app.init();
    await app.listen(0);
    const address = app.getHttpServer().address();
    const port = typeof address === 'object' && address ? address.port : address;
    baseUrl = `http://127.0.0.1:${port}`;

    dataSource = app.get(getDataSourceToken());
    createMachineUseCase = app.get(CreateMachineUseCase);
    createSignalUseCase = app.get(CreateSignalUseCase);
    createDashboardUseCase = app.get(CreateDashboardUseCase);
    createWidgetUseCase = app.get(CreateWidgetUseCase);
    getDashboardUseCase = app.get(GetDashboardUseCase);
    deleteDashboardUseCase = app.get(DeleteDashboardUseCase);
    ingestSignalTick = app.get(IngestSignalTickUseCase);
    markSignalsOffline = app.get(MarkMachineSignalsOfflineUseCase);
    getSignalValueUseCase = app.get(GetSignalValueUseCase);
    realtimeCache = app.get(REALTIME_CACHE);
    tokenService = app.get(TOKEN_SERVICE);
  });

  beforeEach(async () => {
    await truncateTables(dataSource);
  });

  afterEach(() => {
    for (const socket of sockets.splice(0)) {
      socket.close();
    }
  });

  afterAll(async () => {
    await truncateTables(dataSource);
    await app.close();
  });

  function connectClient(auth?: { token: string }): ClientSocket {
    const socket = io(`${baseUrl}/api/v1/realtime`, {
      auth,
      forceNew: true,
      reconnection: false,
      transports: ['websocket'],
    });
    sockets.push(socket);
    return socket;
  }

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
    return { machine, signal, requester };
  }

  it('crea un Dashboard con un widget VALUE y devuelve sus Signals ya resueltas (criterio 5)', async () => {
    const companyId = await insertCompany(dataSource);
    const { machine, signal, requester } = await createFixture(companyId);

    const dashboard = await createDashboardUseCase.execute({ companyId, name: 'Planta 1' });
    await createWidgetUseCase.execute({
      dashboardId: dashboard.id,
      requester,
      widgetType: WidgetType.Value,
      widgetConfig: {},
      signalIds: [signal.id],
    });

    const detail = await getDashboardUseCase.execute({ dashboardId: dashboard.id, requester });

    expect(detail.widgets).toHaveLength(1);
    expect(detail.widgets[0].signals).toEqual([
      { id: signal.id, name: 'Temperatura', unit: '°C', machineId: machine.id },
    ]);
  });

  it('rechaza un widget que referencia una Signal de otra Company (criterio 7)', async () => {
    const companyA = await insertCompany(dataSource, 'Empresa A');
    const companyB = await insertCompany(dataSource, 'Empresa B');
    const { requester } = await createFixture(companyA);
    const { signal: signalB } = await createFixture(companyB);
    const dashboard = await createDashboardUseCase.execute({
      companyId: companyA,
      name: 'Planta 1',
    });

    await expect(
      createWidgetUseCase.execute({
        dashboardId: dashboard.id,
        requester,
        widgetType: WidgetType.Value,
        widgetConfig: {},
        signalIds: [signalB.id],
      }),
    ).rejects.toBeInstanceOf(SignalNotFoundForWidgetError);
  });

  it('DELETE elimina físicamente el Dashboard y en cascada sus widgets (criterio 6)', async () => {
    const companyId = await insertCompany(dataSource);
    const { signal, requester } = await createFixture(companyId);
    const dashboard = await createDashboardUseCase.execute({ companyId, name: 'Planta 1' });
    const widget = await createWidgetUseCase.execute({
      dashboardId: dashboard.id,
      requester,
      widgetType: WidgetType.Value,
      widgetConfig: {},
      signalIds: [signal.id],
    });

    await deleteDashboardUseCase.execute({ dashboardId: dashboard.id, requester });

    const [dashboardCount] = await dataSource.query(
      'SELECT COUNT(*)::int AS c FROM dashboards WHERE id = $1',
      [dashboard.id],
    );
    expect(dashboardCount.c).toBe(0);
    const [widgetCount] = await dataSource.query(
      'SELECT COUNT(*)::int AS c FROM dashboard_widgets WHERE id = $1',
      [widget.id],
    );
    expect(widgetCount.c).toBe(0);
  });

  it('IngestSignalTickUseCase actualiza la Realtime Cache y GetSignalValueUseCase la lee (criterios 1, 2)', async () => {
    const companyId = await insertCompany(dataSource);
    const { machine, signal, requester } = await createFixture(companyId);

    await ingestSignalTick.execute({
      machineId: machine.id,
      variableName: 'temperature',
      value: 24.8,
      quality: SignalQuality.Good,
      timestamp: new Date(),
    });

    const value = await getSignalValueUseCase.execute({
      machineId: machine.id,
      signalId: signal.id,
      requester,
    });
    expect(value.value).toBe(24.8);
    expect(value.quality).toBe(SignalQuality.Good);
  });

  it('una Signal sin tick todavía responde SignalValueNotAvailableError (criterio 2)', async () => {
    const companyId = await insertCompany(dataSource);
    const { machine, signal, requester } = await createFixture(companyId);

    await expect(
      getSignalValueUseCase.execute({ machineId: machine.id, signalId: signal.id, requester }),
    ).rejects.toBeInstanceOf(SignalValueNotAvailableError);
  });

  it('MarkMachineSignalsOfflineUseCase marca OFFLINE conservando el último valor conocido (criterio 4)', async () => {
    const companyId = await insertCompany(dataSource);
    const { machine, signal } = await createFixture(companyId);
    const timestamp = new Date('2026-07-12T10:00:00Z');
    await ingestSignalTick.execute({
      machineId: machine.id,
      variableName: 'temperature',
      value: 24.8,
      quality: SignalQuality.Good,
      timestamp,
    });

    await markSignalsOffline.execute({ machineId: machine.id, companyId });

    const entry = realtimeCache.get(signal.id);
    expect(entry?.quality).toBe(SignalQuality.Offline);
    expect(entry?.value).toBe(24.8);
    expect(entry?.timestamp).toEqual(timestamp);
  });

  it('el WebSocket Gateway rechaza una conexión sin token', async () => {
    const socket = connectClient();

    const disconnected = await new Promise<boolean>((resolve) => {
      socket.on('disconnect', () => resolve(true));
      setTimeout(() => resolve(false), 3000);
    });

    expect(disconnected).toBe(true);
  }, 10000);

  it('el WebSocket Gateway entrega SignalUpdated solo a clientes de la misma Company (criterio 3)', async () => {
    const companyA = await insertCompany(dataSource, 'Empresa A');
    const companyB = await insertCompany(dataSource, 'Empresa B');
    const { machine, signal } = await createFixture(companyA);
    await createFixture(companyB);

    const tokenA = await tokenService.signAccessToken({
      sub: 'user-a',
      email: 'a@ewcontrol.local',
      companyId: companyA,
      role: UserRole.AdminCliente,
    });
    const tokenB = await tokenService.signAccessToken({
      sub: 'user-b',
      email: 'b@ewcontrol.local',
      companyId: companyB,
      role: UserRole.AdminCliente,
    });

    const clientA = connectClient({ token: tokenA });
    const clientB = connectClient({ token: tokenB });
    await Promise.all([
      new Promise<void>((resolve, reject) => {
        clientA.on('connect', resolve);
        clientA.on('connect_error', reject);
      }),
      new Promise<void>((resolve, reject) => {
        clientB.on('connect', resolve);
        clientB.on('connect_error', reject);
      }),
    ]);

    const receivedByA: unknown[] = [];
    const receivedByB: unknown[] = [];
    clientA.on('SignalUpdated', (payload) => receivedByA.push(payload));
    clientB.on('SignalUpdated', (payload) => receivedByB.push(payload));

    const eventReceivedByA = new Promise<{ signalId: string; value: number }>((resolve) => {
      clientA.on('SignalUpdated', resolve);
    });

    await ingestSignalTick.execute({
      machineId: machine.id,
      variableName: 'temperature',
      value: 30,
      quality: SignalQuality.Good,
      timestamp: new Date(),
    });

    const event = await eventReceivedByA;
    expect(event.signalId).toBe(signal.id);
    expect(event.value).toBe(30);
    expect(receivedByB).toHaveLength(0);
  }, 10000);
});
