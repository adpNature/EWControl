import { ApplicationRef, Component, inject, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { AuthStateService } from '../../auth/use-cases/auth.state';
import { RealtimeSocketService } from './realtime-socket.service';

type IoAuthOption = (callback: (data: { token: string | null }) => void) => void;

const { ioMock, fakeSocket, listeners } = vi.hoisted(() => {
  const listeners = new Map<string, (payload: unknown) => void>();
  const fakeSocket = {
    connected: false,
    on: vi.fn((event: string, cb: (payload: unknown) => void) => {
      listeners.set(event, cb);
    }),
    disconnect: vi.fn(),
  };
  const ioMock = vi.fn<(namespace: string, opts: { auth: unknown }) => typeof fakeSocket>(
    () => fakeSocket,
  );
  return { ioMock, fakeSocket, listeners };
});

vi.mock('socket.io-client', () => ({ io: ioMock }));

@Component({ selector: 'app-test-host', standalone: true, template: '' })
class TestHostComponent {
  readonly service = inject(RealtimeSocketService);
}

/**
 * El `effect()` de `RealtimeSocketService` es zoneless: `ApplicationRef.tick()`
 * síncrono no garantiza que ya se haya vaciado (el orden exacto depende del
 * scheduler de microtasks, que bajo poca concurrencia de CPU — como los
 * runners de CI — no es determinista). `ApplicationRef.whenStable()` es la
 * API oficial de Angular para esperar de forma asíncrona a que la app quede
 * estable (efectos incluidos), en vez de asumir un vaciado síncrono.
 */
async function createHost(): Promise<{ host: TestHostComponent; appRef: ApplicationRef }> {
  const fixture = TestBed.createComponent(TestHostComponent);
  const appRef = TestBed.inject(ApplicationRef);
  fixture.detectChanges();
  await appRef.whenStable();
  return { host: fixture.componentInstance, appRef };
}

describe('RealtimeSocketService', () => {
  let accessTokenSignal: ReturnType<typeof signal<string | null>>;

  beforeEach(() => {
    ioMock.mockClear();
    fakeSocket.on.mockClear();
    fakeSocket.disconnect.mockClear();
    listeners.clear();
    accessTokenSignal = signal<string | null>(null);

    TestBed.configureTestingModule({
      providers: [{ provide: AuthStateService, useValue: { accessToken: accessTokenSignal } }],
    });
  });

  it('no conecta mientras no hay accessToken', async () => {
    await createHost();

    expect(ioMock).not.toHaveBeenCalled();
  });

  it('conecta al namespace api/v1/realtime cuando aparece un accessToken', async () => {
    const { appRef } = await createHost();
    accessTokenSignal.set('token-1');
    TestBed.tick();
    await appRef.whenStable();

    expect(ioMock).toHaveBeenCalledWith(
      '/api/v1/realtime',
      expect.objectContaining({ auth: expect.any(Function) }),
    );
  });

  it('el callback auth relee siempre el token vigente', async () => {
    const { appRef } = await createHost();
    accessTokenSignal.set('token-1');
    TestBed.tick();
    await appRef.whenStable();

    const authOption = ioMock.mock.calls[0][1].auth as unknown as IoAuthOption;
    const received: { token: string | null }[] = [];
    authOption((data) => received.push(data));
    accessTokenSignal.set('token-2');
    authOption((data) => received.push(data));

    expect(received).toEqual([{ token: 'token-1' }, { token: 'token-2' }]);
  });

  it('desconecta cuando el accessToken desaparece (logout)', async () => {
    const { appRef } = await createHost();
    accessTokenSignal.set('token-1');
    TestBed.tick();
    await appRef.whenStable();

    accessTokenSignal.set(null);
    TestBed.tick();
    await appRef.whenStable();

    expect(fakeSocket.disconnect).toHaveBeenCalled();
  });

  it('signalUpdates$ emite lo que recibe el socket subyacente en "SignalUpdated"', async () => {
    const { host, appRef } = await createHost();
    accessTokenSignal.set('token-1');
    TestBed.tick();
    await appRef.whenStable();

    const event = {
      signalId: 'signal-1',
      machineId: 'machine-1',
      value: 24.8,
      quality: 'GOOD' as const,
      timestamp: '2026-07-12T10:00:00Z',
    };
    const promise = firstValueFrom(host.service.signalUpdates$);
    listeners.get('SignalUpdated')?.(event);

    await expect(promise).resolves.toEqual(event);
  });

  it('alarmTriggered$ emite lo que recibe el socket subyacente en "AlarmTriggered" (docs/specs/09-alarmas.md)', async () => {
    const { host, appRef } = await createHost();
    accessTokenSignal.set('token-1');
    TestBed.tick();
    await appRef.whenStable();

    const event = {
      alarmStateId: 'state-1',
      alarmDefinitionId: 'def-1',
      signalId: 'signal-1',
      priority: 'HIGH' as const,
      timestamp: '2026-07-12T10:00:00Z',
    };
    const promise = firstValueFrom(host.service.alarmTriggered$);
    listeners.get('AlarmTriggered')?.(event);

    await expect(promise).resolves.toEqual(event);
  });

  it('alarmCleared$ emite lo que recibe el socket subyacente en "AlarmCleared" (docs/specs/09-alarmas.md)', async () => {
    const { host, appRef } = await createHost();
    accessTokenSignal.set('token-1');
    TestBed.tick();
    await appRef.whenStable();

    const event = {
      alarmStateId: 'state-1',
      alarmDefinitionId: 'def-1',
      signalId: 'signal-1',
      timestamp: '2026-07-12T10:00:00Z',
    };
    const promise = firstValueFrom(host.service.alarmCleared$);
    listeners.get('AlarmCleared')?.(event);

    await expect(promise).resolves.toEqual(event);
  });

  it('alarmAcked$ emite lo que recibe el socket subyacente en "AlarmAcked" (docs/specs/11-ack-alarmas.md)', async () => {
    const { host, appRef } = await createHost();
    accessTokenSignal.set('token-1');
    TestBed.tick();
    await appRef.whenStable();

    const event = {
      alarmStateId: 'state-1',
      alarmDefinitionId: 'def-1',
      signalId: 'signal-1',
      ackedByUserId: 'user-1',
      ackedByEmail: 'admin@ewcontrol.local',
      ackedAt: '2026-07-12T10:00:00Z',
    };
    const promise = firstValueFrom(host.service.alarmAcked$);
    listeners.get('AlarmAcked')?.(event);

    await expect(promise).resolves.toEqual(event);
  });
});
