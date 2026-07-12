import { Injectable, effect, inject } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { io, type Socket } from 'socket.io-client';
import { AuthStateService } from '../../auth/use-cases/auth.state';
import {
  MachineConnectedEvent,
  MachineDisconnectedEvent,
  SignalUpdatedEvent,
} from './realtime-events.model';

const NAMESPACE = '/api/v1/realtime';

/**
 * Adapter WebSocket único de la app (docs/specs/07-dashboard-tiempo-real.md,
 * docs/11-api-rest.md sección "WebSocket"): conecta solo mientras hay sesión
 * activa (mismo `accessToken` en memoria que usa el interceptor de auth), y
 * expone un Observable por tipo de evento — el canal es "todo lo de tu
 * Company", sin protocolo de suscripción por Signal en el servidor; el
 * filtrado por `signalId` lo hace cada widget sobre `signalUpdates$`.
 */
@Injectable({ providedIn: 'root' })
export class RealtimeSocketService {
  private readonly authState = inject(AuthStateService);
  private socket: Socket | undefined;

  private readonly signalUpdatedSubject = new Subject<SignalUpdatedEvent>();
  private readonly machineConnectedSubject = new Subject<MachineConnectedEvent>();
  private readonly machineDisconnectedSubject = new Subject<MachineDisconnectedEvent>();

  readonly signalUpdates$: Observable<SignalUpdatedEvent> =
    this.signalUpdatedSubject.asObservable();
  readonly machineConnected$: Observable<MachineConnectedEvent> =
    this.machineConnectedSubject.asObservable();
  readonly machineDisconnected$: Observable<MachineDisconnectedEvent> =
    this.machineDisconnectedSubject.asObservable();

  constructor() {
    effect(() => {
      if (this.authState.accessToken()) {
        this.connect();
      } else {
        this.disconnect();
      }
    });
  }

  private connect(): void {
    if (this.socket?.connected) {
      return;
    }
    // `auth` como función (no objeto estático): socket.io-client la reinvoca en
    // cada intento de (re)conexión, así que siempre lee el token vigente sin
    // lógica manual de reconexión tras un refresh.
    this.socket = io(NAMESPACE, {
      auth: (callback: (data: { token: string | null }) => void) =>
        callback({ token: this.authState.accessToken() }),
    });
    this.socket.on('SignalUpdated', (event: SignalUpdatedEvent) =>
      this.signalUpdatedSubject.next(event),
    );
    this.socket.on('MachineConnected', (event: MachineConnectedEvent) =>
      this.machineConnectedSubject.next(event),
    );
    this.socket.on('MachineDisconnected', (event: MachineDisconnectedEvent) =>
      this.machineDisconnectedSubject.next(event),
    );
  }

  private disconnect(): void {
    this.socket?.disconnect();
    this.socket = undefined;
  }
}
