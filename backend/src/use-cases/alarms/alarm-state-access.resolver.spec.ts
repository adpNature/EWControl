import { describe, expect, it, vi } from 'vitest';
import { UserRole } from '../../entities/user-role.enum';
import { AlarmStateAccessResolver } from './alarm-state-access.resolver';
import { AlarmStateNotFoundError } from './errors/alarm-state-not-found.error';

const FAKE_CTX = Symbol('tx-ctx');
const ALARM_STATE = { id: 'state-1', alarmDefinitionId: 'def-1', signalId: 'signal-1' };
const SIGNAL = { id: 'signal-1', machineId: 'machine-1' };
const MACHINE = { id: 'machine-1', companyId: 'company-1' };
const REQUESTER = { companyId: 'company-1', role: UserRole.AdminCliente };

function createFakes() {
  const alarmStateRepository = { findById: vi.fn().mockResolvedValue(ALARM_STATE) };
  const signalRepository = { findById: vi.fn().mockResolvedValue(SIGNAL) };
  const machineRepository = { findById: vi.fn().mockResolvedValue(MACHINE) };
  return { alarmStateRepository, signalRepository, machineRepository };
}

function createResolver(fakes: ReturnType<typeof createFakes>) {
  return new AlarmStateAccessResolver(
    fakes.alarmStateRepository as never,
    fakes.signalRepository as never,
    fakes.machineRepository as never,
  );
}

describe('AlarmStateAccessResolver', () => {
  describe('resolveAny', () => {
    it('devuelve el AlarmState y el companyId cuando su Signal/Machine pertenecen a la Company del requester', async () => {
      const fakes = createFakes();
      const resolver = createResolver(fakes);

      const result = await resolver.resolveAny('state-1', REQUESTER, FAKE_CTX);

      expect(result).toEqual({ alarmState: ALARM_STATE, companyId: 'company-1' });
    });

    it('lanza AlarmStateNotFoundError si el AlarmState no existe', async () => {
      const fakes = createFakes();
      fakes.alarmStateRepository.findById.mockResolvedValue(null);
      const resolver = createResolver(fakes);

      await expect(resolver.resolveAny('missing', REQUESTER, FAKE_CTX)).rejects.toBeInstanceOf(
        AlarmStateNotFoundError,
      );
    });

    it('lanza AlarmStateNotFoundError (nunca 403) si la Machine es de otra Company y el requester es AdminCliente', async () => {
      const fakes = createFakes();
      const resolver = createResolver(fakes);

      await expect(
        resolver.resolveAny(
          'state-1',
          { companyId: 'other-company', role: UserRole.AdminCliente },
          FAKE_CTX,
        ),
      ).rejects.toBeInstanceOf(AlarmStateNotFoundError);
    });

    it('devuelve el AlarmState y el companyId real de otra Company si el requester es SuperAdmin', async () => {
      const fakes = createFakes();
      const resolver = createResolver(fakes);

      const result = await resolver.resolveAny(
        'state-1',
        { companyId: 'other-company', role: UserRole.SuperAdmin },
        FAKE_CTX,
      );

      expect(result).toEqual({ alarmState: ALARM_STATE, companyId: 'company-1' });
    });
  });
});
