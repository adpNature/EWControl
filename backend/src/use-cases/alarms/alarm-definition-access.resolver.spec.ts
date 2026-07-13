import { describe, expect, it, vi } from 'vitest';
import { UserRole } from '../../entities/user-role.enum';
import { AlarmDefinitionAccessResolver } from './alarm-definition-access.resolver';
import { AlarmDefinitionNotFoundError } from './errors/alarm-definition-not-found.error';

const FAKE_CTX = Symbol('tx-ctx');
const DEFINITION = { id: 'def-1', signalId: 'signal-1' };
const SIGNAL = { id: 'signal-1', machineId: 'machine-1' };
const MACHINE = { id: 'machine-1', companyId: 'company-1' };
const REQUESTER = { companyId: 'company-1', role: UserRole.AdminCliente };

function createFakes() {
  const alarmDefinitionRepository = { findById: vi.fn().mockResolvedValue(DEFINITION) };
  const signalRepository = { findById: vi.fn().mockResolvedValue(SIGNAL) };
  const machineRepository = { findById: vi.fn().mockResolvedValue(MACHINE) };
  return { alarmDefinitionRepository, signalRepository, machineRepository };
}

function createResolver(fakes: ReturnType<typeof createFakes>) {
  return new AlarmDefinitionAccessResolver(
    fakes.alarmDefinitionRepository as never,
    fakes.signalRepository as never,
    fakes.machineRepository as never,
  );
}

describe('AlarmDefinitionAccessResolver', () => {
  describe('resolveAny', () => {
    it('devuelve la AlarmDefinition cuando su Signal/Machine pertenecen a la Company del requester', async () => {
      const fakes = createFakes();
      const resolver = createResolver(fakes);

      const definition = await resolver.resolveAny('def-1', REQUESTER, FAKE_CTX);

      expect(definition).toEqual(DEFINITION);
    });

    it('lanza AlarmDefinitionNotFoundError si la AlarmDefinition no existe', async () => {
      const fakes = createFakes();
      fakes.alarmDefinitionRepository.findById.mockResolvedValue(null);
      const resolver = createResolver(fakes);

      await expect(resolver.resolveAny('missing', REQUESTER, FAKE_CTX)).rejects.toBeInstanceOf(
        AlarmDefinitionNotFoundError,
      );
    });

    it('lanza AlarmDefinitionNotFoundError si su Signal ya no existe', async () => {
      const fakes = createFakes();
      fakes.signalRepository.findById.mockResolvedValue(null);
      const resolver = createResolver(fakes);

      await expect(resolver.resolveAny('def-1', REQUESTER, FAKE_CTX)).rejects.toBeInstanceOf(
        AlarmDefinitionNotFoundError,
      );
    });

    it('lanza AlarmDefinitionNotFoundError (nunca 403) si la Machine es de otra Company y el requester es AdminCliente', async () => {
      const fakes = createFakes();
      const resolver = createResolver(fakes);

      await expect(
        resolver.resolveAny(
          'def-1',
          { companyId: 'other-company', role: UserRole.AdminCliente },
          FAKE_CTX,
        ),
      ).rejects.toBeInstanceOf(AlarmDefinitionNotFoundError);
    });

    it('devuelve la AlarmDefinition de otra Company si el requester es SuperAdmin', async () => {
      const fakes = createFakes();
      const resolver = createResolver(fakes);

      const definition = await resolver.resolveAny(
        'def-1',
        { companyId: 'other-company', role: UserRole.SuperAdmin },
        FAKE_CTX,
      );

      expect(definition).toEqual(DEFINITION);
    });
  });
});
