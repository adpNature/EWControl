import { Component, inject, signal } from '@angular/core';
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

/**
 * `effect()` solo se garantiza flushed dentro de un ciclo de detección de
 * cambios real (`ComponentFixture.detectChanges()`); inyectar el servicio
 * "a pelo" con `TestBed.inject()` y forzar `TestBed.tick()` sin ningún
 * componente en pantalla resultó frágil entre entornos (funcionaba en local,
 * nunca en CI). Un host trivial reproduce cómo lo consume la app real
 * (los widgets lo inyectan dentro de un componente).
 */
@Component({ selector: 'app-test-host', standalone: true, template: '' })
class TestHostComponent {
  readonly service = inject(RealtimeSocketService);
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

  function createHost() {
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('no conecta mientras no hay accessToken', () => {
    createHost();

    expect(ioMock).not.toHaveBeenCalled();
  });

  it('conecta al namespace api/v1/realtime cuando aparece un accessToken', () => {
    createHost();

    accessTokenSignal.set('token-1');
    TestBed.tick();

    expect(ioMock).toHaveBeenCalledWith(
      '/api/v1/realtime',
      expect.objectContaining({ auth: expect.any(Function) }),
    );
  });

  it('el callback auth relee siempre el token vigente', () => {
    createHost();
    accessTokenSignal.set('token-1');
    TestBed.tick();

    const authOption = ioMock.mock.calls[0][1].auth as unknown as IoAuthOption;
    const received: { token: string | null }[] = [];
    authOption((data) => received.push(data));
    accessTokenSignal.set('token-2');
    authOption((data) => received.push(data));

    expect(received).toEqual([{ token: 'token-1' }, { token: 'token-2' }]);
  });

  it('desconecta cuando el accessToken desaparece (logout)', () => {
    createHost();
    accessTokenSignal.set('token-1');
    TestBed.tick();

    accessTokenSignal.set(null);
    TestBed.tick();

    expect(fakeSocket.disconnect).toHaveBeenCalled();
  });

  it('signalUpdates$ emite lo que recibe el socket subyacente en "SignalUpdated"', async () => {
    const fixture = createHost();
    accessTokenSignal.set('token-1');
    TestBed.tick();

    const event = {
      signalId: 'signal-1',
      machineId: 'machine-1',
      value: 24.8,
      quality: 'GOOD' as const,
      timestamp: '2026-07-12T10:00:00Z',
    };
    const promise = firstValueFrom(fixture.componentInstance.service.signalUpdates$);
    listeners.get('SignalUpdated')?.(event);

    await expect(promise).resolves.toEqual(event);
  });
});
