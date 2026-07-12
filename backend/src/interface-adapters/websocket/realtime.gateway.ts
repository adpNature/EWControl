import { Inject } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { OnGatewayConnection, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { TOKEN_SERVICE, type ITokenService } from '../../use-cases/auth/ports/token.port';
import type {
  MachineConnectedPayload,
  MachineDisconnectedPayload,
  SignalUpdatedPayload,
} from '../../use-cases/simulator-control/ports/event-publisher.port';

/**
 * docs/specs/07-dashboard-tiempo-real.md: canal `wss://.../api/v1/realtime`,
 * unidireccional (servidor → cliente), con entrega acotada a la Company del
 * `accessToken` del handshake — mismo `ITokenService` que usa `JwtAuthGuard`.
 *
 * Corrige la cláusula de auth de docs/11-api-rest.md: Socket.IO no soporta
 * limpiamente `Sec-WebSocket-Protocol`, así que el token viaja en el objeto
 * `auth` del handshake (mecanismo idiomático), con fallback a `?token=`.
 */
@WebSocketGateway({ namespace: 'api/v1/realtime' })
export class RealtimeGateway implements OnGatewayConnection {
  @WebSocketServer() private readonly server: Server;

  constructor(@Inject(TOKEN_SERVICE) private readonly tokenService: ITokenService) {}

  async handleConnection(client: Socket): Promise<void> {
    const token = this.extractToken(client);
    if (!token) {
      client.disconnect(true);
      return;
    }
    try {
      const payload = await this.tokenService.verifyAccessToken(token);
      await client.join(this.roomFor(payload.companyId));
    } catch {
      client.disconnect(true);
    }
  }

  @OnEvent('SignalUpdated')
  relaySignalUpdated(payload: SignalUpdatedPayload): void {
    this.server.to(this.roomFor(payload.companyId)).emit('SignalUpdated', {
      signalId: payload.signalId,
      machineId: payload.machineId,
      value: payload.value,
      quality: payload.quality,
      timestamp: payload.timestamp,
    });
  }

  @OnEvent('MachineConnected')
  relayMachineConnected(payload: MachineConnectedPayload): void {
    this.server.to(this.roomFor(payload.companyId)).emit('MachineConnected', {
      machineId: payload.machineId,
      timestamp: payload.timestamp,
    });
  }

  @OnEvent('MachineDisconnected')
  relayMachineDisconnected(payload: MachineDisconnectedPayload): void {
    this.server.to(this.roomFor(payload.companyId)).emit('MachineDisconnected', {
      machineId: payload.machineId,
      timestamp: payload.timestamp,
    });
  }

  private roomFor(companyId: string): string {
    return `company:${companyId}`;
  }

  private extractToken(client: Socket): string | undefined {
    const fromAuth = client.handshake.auth?.['token'];
    if (typeof fromAuth === 'string') {
      return fromAuth;
    }
    const fromQuery = client.handshake.query?.['token'];
    return typeof fromQuery === 'string' ? fromQuery : undefined;
  }
}
