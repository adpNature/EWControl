import { describe, expect, it, vi } from 'vitest';
import { UserRole } from '../../entities/user-role.enum';
import { SignalNotFoundError } from './errors/signal-not-found.error';
import { SignalAccessResolver } from './signal-access.resolver';

const FAKE_CTX = Symbol('tx-ctx');
const SIGNAL = { id: 'signal-1', machineId: 'machine-1', isActive: true };
const MACHINE = { id: 'machine-1', companyId: 'company-1', name: 'Demo', isActive: true };
const REQUESTER = { companyId: 'company-1', role: UserRole.AdminCliente };

function createFakes() {
  const signalRepository = { findById: vi.fn().mockResolvedValue(SIGNAL) };
  const machineRepository = { findById: vi.fn().mockResolvedValue(MACHINE) };
  return { signalRepository, machineRepository };
}

function createResolver(fakes: ReturnType<typeof createFakes>) {
  return new SignalAccessResolver(
    fakes.signalRepository as never,
    fakes.machineRepository as never,
  );
}

describe('SignalAccessResolver', () => {
  describe('resolveActive', () => {
    it('devuelve la Signal cuando existe, está activa y su Machine pertenece a la Company', async () => {
      const fakes = createFakes();
      const resolver = createResolver(fakes);

      const signal = await resolver.resolveActive('signal-1', REQUESTER, FAKE_CTX);

      expect(signal).toEqual(SIGNAL);
    });

    it('lanza SignalNotFoundError si la Signal no existe', async () => {
      const fakes = createFakes();
      fakes.signalRepository.findById.mockResolvedValue(null);
      const resolver = createResolver(fakes);

      await expect(resolver.resolveActive('missing', REQUESTER, FAKE_CTX)).rejects.toBeInstanceOf(
        SignalNotFoundError,
      );
    });

    it('lanza SignalNotFoundError si la Signal está inactiva', async () => {
      const fakes = createFakes();
      fakes.signalRepository.findById.mockResolvedValue({ ...SIGNAL, isActive: false });
      const resolver = createResolver(fakes);

      await expect(resolver.resolveActive('signal-1', REQUESTER, FAKE_CTX)).rejects.toBeInstanceOf(
        SignalNotFoundError,
      );
    });

    it('lanza SignalNotFoundError si la Machine de la Signal no existe', async () => {
      const fakes = createFakes();
      fakes.machineRepository.findById.mockResolvedValue(null);
      const resolver = createResolver(fakes);

      await expect(resolver.resolveActive('signal-1', REQUESTER, FAKE_CTX)).rejects.toBeInstanceOf(
        SignalNotFoundError,
      );
    });

    it('lanza SignalNotFoundError si la Machine está inactiva', async () => {
      const fakes = createFakes();
      fakes.machineRepository.findById.mockResolvedValue({ ...MACHINE, isActive: false });
      const resolver = createResolver(fakes);

      await expect(resolver.resolveActive('signal-1', REQUESTER, FAKE_CTX)).rejects.toBeInstanceOf(
        SignalNotFoundError,
      );
    });

    it('lanza SignalNotFoundError (nunca 403) si la Machine es de otra Company y el requester es AdminCliente', async () => {
      const fakes = createFakes();
      const resolver = createResolver(fakes);

      await expect(
        resolver.resolveActive(
          'signal-1',
          { companyId: 'other-company', role: UserRole.AdminCliente },
          FAKE_CTX,
        ),
      ).rejects.toBeInstanceOf(SignalNotFoundError);
    });

    it('devuelve la Signal de otra Company si el requester es SuperAdmin', async () => {
      const fakes = createFakes();
      const resolver = createResolver(fakes);

      const signal = await resolver.resolveActive(
        'signal-1',
        { companyId: 'other-company', role: UserRole.SuperAdmin },
        FAKE_CTX,
      );

      expect(signal).toEqual(SIGNAL);
    });
  });
});
