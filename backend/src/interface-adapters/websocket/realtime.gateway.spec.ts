import { describe, expect, it, vi } from 'vitest';
import { UserRole } from '../../entities/user-role.enum';
import { SignalQuality } from '../../entities/signal-quality.enum';
import { RealtimeGateway } from './realtime.gateway';

function createFakeSocket(overrides: { auth?: unknown; query?: unknown } = {}) {
  return {
    handshake: { auth: overrides.auth ?? {}, query: overrides.query ?? {} },
    join: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn(),
  };
}

function createTokenService() {
  return {
    signAccessToken: vi.fn(),
    signRefreshToken: vi.fn(),
    verifyAccessToken: vi.fn(),
    verifyRefreshToken: vi.fn(),
  };
}

function createGateway(tokenService: ReturnType<typeof createTokenService>) {
  const gateway = new RealtimeGateway(tokenService as never);
  const server = { to: vi.fn().mockReturnThis(), emit: vi.fn() };
  (gateway as unknown as { server: unknown }).server = server;
  return { gateway, server };
}

describe('RealtimeGateway', () => {
  describe('handleConnection', () => {
    it('une el socket a la sala de su Company cuando el token del handshake.auth es válido', async () => {
      const tokenService = createTokenService();
      tokenService.verifyAccessToken.mockResolvedValue({
        sub: 'user-1',
        email: 'demo@ewcontrol.local',
        companyId: 'company-1',
        role: UserRole.AdminCliente,
      });
      const { gateway } = createGateway(tokenService);
      const client = createFakeSocket({ auth: { token: 'valid-token' } });

      await gateway.handleConnection(client as never);

      expect(tokenService.verifyAccessToken).toHaveBeenCalledWith('valid-token');
      expect(client.join).toHaveBeenCalledWith('company:company-1');
      expect(client.disconnect).not.toHaveBeenCalled();
    });

    it('acepta el token como fallback en handshake.query', async () => {
      const tokenService = createTokenService();
      tokenService.verifyAccessToken.mockResolvedValue({
        sub: 'user-1',
        email: 'demo@ewcontrol.local',
        companyId: 'company-1',
        role: UserRole.AdminCliente,
      });
      const { gateway } = createGateway(tokenService);
      const client = createFakeSocket({ query: { token: 'valid-token' } });

      await gateway.handleConnection(client as never);

      expect(client.join).toHaveBeenCalledWith('company:company-1');
    });

    it('rechaza la conexión sin token', async () => {
      const tokenService = createTokenService();
      const { gateway } = createGateway(tokenService);
      const client = createFakeSocket();

      await gateway.handleConnection(client as never);

      expect(client.disconnect).toHaveBeenCalledWith(true);
      expect(tokenService.verifyAccessToken).not.toHaveBeenCalled();
    });

    it('rechaza la conexión con un token inválido/expirado', async () => {
      const tokenService = createTokenService();
      tokenService.verifyAccessToken.mockRejectedValue(new Error('invalid'));
      const { gateway } = createGateway(tokenService);
      const client = createFakeSocket({ auth: { token: 'bad-token' } });

      await gateway.handleConnection(client as never);

      expect(client.disconnect).toHaveBeenCalledWith(true);
      expect(client.join).not.toHaveBeenCalled();
    });
  });

  describe('relay de eventos', () => {
    it('reemite SignalUpdated a la sala de la Company del payload', () => {
      const { gateway, server } = createGateway(createTokenService());
      const timestamp = new Date('2026-07-12T10:00:00Z');

      gateway.relaySignalUpdated({
        signalId: 'signal-1',
        machineId: 'machine-1',
        companyId: 'company-1',
        value: 24.8,
        quality: SignalQuality.Good,
        timestamp,
      });

      expect(server.to).toHaveBeenCalledWith('company:company-1');
      expect(server.emit).toHaveBeenCalledWith('SignalUpdated', {
        signalId: 'signal-1',
        machineId: 'machine-1',
        value: 24.8,
        quality: SignalQuality.Good,
        timestamp,
      });
    });

    it('reemite MachineConnected/MachineDisconnected a la sala de la Company del payload', () => {
      const { gateway, server } = createGateway(createTokenService());
      const timestamp = new Date('2026-07-12T10:00:00Z');

      gateway.relayMachineConnected({ machineId: 'machine-1', companyId: 'company-1', timestamp });
      gateway.relayMachineDisconnected({
        machineId: 'machine-1',
        companyId: 'company-1',
        timestamp,
      });

      expect(server.emit).toHaveBeenCalledWith('MachineConnected', {
        machineId: 'machine-1',
        timestamp,
      });
      expect(server.emit).toHaveBeenCalledWith('MachineDisconnected', {
        machineId: 'machine-1',
        timestamp,
      });
    });
  });
});
