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

function createMetrics() {
  return { incrementSignalUpdate: vi.fn(), incrementAlarmEvent: vi.fn() };
}

function createGateway(tokenService: ReturnType<typeof createTokenService>) {
  const metrics = createMetrics();
  const gateway = new RealtimeGateway(tokenService as never, metrics as never);
  const server = { to: vi.fn().mockReturnThis(), emit: vi.fn() };
  (gateway as unknown as { server: unknown }).server = server;
  return { gateway, server, metrics };
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
      const { gateway, server, metrics } = createGateway(createTokenService());
      const timestamp = new Date('2026-07-12T10:00:00Z');

      gateway.relaySignalUpdated({
        signalId: 'signal-1',
        machineId: 'machine-1',
        companyId: 'company-1',
        value: 24.8,
        quality: SignalQuality.Good,
        timestamp,
        correlationId: 'correlation-1',
      });

      expect(server.to).toHaveBeenCalledWith('company:company-1');
      expect(server.emit).toHaveBeenCalledWith('SignalUpdated', {
        signalId: 'signal-1',
        machineId: 'machine-1',
        value: 24.8,
        quality: SignalQuality.Good,
        timestamp,
        correlationId: 'correlation-1',
      });
      expect(metrics.incrementSignalUpdate).toHaveBeenCalledTimes(1);
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

    it('reemite AlarmTriggered/AlarmCleared a la sala de la Company del payload (docs/specs/09-alarmas.md)', () => {
      const { gateway, server, metrics } = createGateway(createTokenService());
      const timestamp = new Date('2026-07-12T10:00:00Z');

      gateway.relayAlarmTriggered({
        alarmStateId: 'state-1',
        alarmDefinitionId: 'def-1',
        signalId: 'signal-1',
        companyId: 'company-1',
        priority: 'HIGH' as never,
        value: 84,
        timestamp,
      });
      gateway.relayAlarmCleared({
        alarmStateId: 'state-1',
        alarmDefinitionId: 'def-1',
        signalId: 'signal-1',
        companyId: 'company-1',
        timestamp,
      });

      expect(server.to).toHaveBeenCalledWith('company:company-1');
      expect(server.emit).toHaveBeenCalledWith('AlarmTriggered', {
        alarmStateId: 'state-1',
        alarmDefinitionId: 'def-1',
        signalId: 'signal-1',
        priority: 'HIGH',
        timestamp,
      });
      expect(server.emit).toHaveBeenCalledWith('AlarmCleared', {
        alarmStateId: 'state-1',
        alarmDefinitionId: 'def-1',
        signalId: 'signal-1',
        timestamp,
      });
      expect(metrics.incrementAlarmEvent).toHaveBeenCalledWith('AlarmTriggered');
      expect(metrics.incrementAlarmEvent).toHaveBeenCalledWith('AlarmCleared');
    });

    it('reemite AlarmAcked a la sala de la Company del payload (docs/specs/11-ack-alarmas.md)', () => {
      const { gateway, server, metrics } = createGateway(createTokenService());
      const ackedAt = new Date('2026-07-12T10:00:00Z');

      gateway.relayAlarmAcked({
        alarmStateId: 'state-1',
        alarmDefinitionId: 'def-1',
        signalId: 'signal-1',
        companyId: 'company-1',
        ackedByUserId: 'user-1',
        ackedByEmail: 'admin@ewcontrol.local',
        ackedAt,
      });

      expect(server.to).toHaveBeenCalledWith('company:company-1');
      expect(server.emit).toHaveBeenCalledWith('AlarmAcked', {
        alarmStateId: 'state-1',
        alarmDefinitionId: 'def-1',
        signalId: 'signal-1',
        ackedByUserId: 'user-1',
        ackedByEmail: 'admin@ewcontrol.local',
        ackedAt,
      });
      expect(metrics.incrementAlarmEvent).toHaveBeenCalledWith('AlarmAcked');
    });
  });
});
