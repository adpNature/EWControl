import { signal } from '@angular/core';
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

  it('no conecta mientras no hay accessToken', () => {
    TestBed.inject(RealtimeSocketService);
    TestBed.tick();

    expect(ioMock).not.toHaveBeenCalled();
  });

  it('conecta al namespace api/v1/realtime cuando aparece un accessToken', () => {
    TestBed.inject(RealtimeSocketService);
    accessTokenSignal.set('token-1');
    TestBed.tick();

    expect(ioMock).toHaveBeenCalledWith(
      '/api/v1/realtime',
      expect.objectContaining({ auth: expect.any(Function) }),
    );
  });

  it('el callback auth relee siempre el token vigente', () => {
    TestBed.inject(RealtimeSocketService);
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
    TestBed.inject(RealtimeSocketService);
    accessTokenSignal.set('token-1');
    TestBed.tick();

    accessTokenSignal.set(null);
    TestBed.tick();

    expect(fakeSocket.disconnect).toHaveBeenCalled();
  });

  it('signalUpdates$ emite lo que recibe el socket subyacente en "SignalUpdated"', async () => {
    const service = TestBed.inject(RealtimeSocketService);
    accessTokenSignal.set('token-1');
    TestBed.tick();

    const event = {
      signalId: 'signal-1',
      machineId: 'machine-1',
      value: 24.8,
      quality: 'GOOD' as const,
      timestamp: '2026-07-12T10:00:00Z',
    };
    const promise = firstValueFrom(service.signalUpdates$);
    listeners.get('SignalUpdated')?.(event);

    await expect(promise).resolves.toEqual(event);
  });
});
