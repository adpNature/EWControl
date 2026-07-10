import { describe, expect, it, vi } from 'vitest';
import { UserRole } from '../../entities/user-role.enum';
import { MachineInactiveError } from './errors/machine-inactive.error';
import { MachineNotFoundError } from './errors/machine-not-found.error';
import { assertMachineActive, MachineAccessResolver } from './machine-access.resolver';

const FAKE_CTX = Symbol('tx-ctx');
const MACHINE = { id: 'machine-1', companyId: 'company-1', name: 'Demo', isActive: true };

function createFakes() {
  const machineRepository = {
    create: vi.fn(),
    findById: vi.fn().mockResolvedValue(MACHINE),
    list: vi.fn(),
    update: vi.fn(),
    softDeactivate: vi.fn(),
  };
  return { machineRepository };
}

function createResolver(fakes: ReturnType<typeof createFakes>) {
  return new MachineAccessResolver(fakes.machineRepository);
}

describe('MachineAccessResolver', () => {
  describe('resolveAny', () => {
    it('devuelve la Machine cuando existe y pertenece a la Company del requester', async () => {
      const fakes = createFakes();
      const resolver = createResolver(fakes);

      const machine = await resolver.resolveAny(
        'machine-1',
        { companyId: 'company-1', role: UserRole.AdminCliente },
        FAKE_CTX,
      );

      expect(machine).toEqual(MACHINE);
    });

    it('lanza MachineNotFoundError si la Machine no existe', async () => {
      const fakes = createFakes();
      fakes.machineRepository.findById.mockResolvedValue(null);
      const resolver = createResolver(fakes);

      await expect(
        resolver.resolveAny(
          'missing',
          { companyId: 'company-1', role: UserRole.AdminCliente },
          FAKE_CTX,
        ),
      ).rejects.toBeInstanceOf(MachineNotFoundError);
    });

    it('lanza MachineNotFoundError (nunca 403) si la Machine es de otra Company y el requester es AdminCliente', async () => {
      const fakes = createFakes();
      const resolver = createResolver(fakes);

      await expect(
        resolver.resolveAny(
          'machine-1',
          { companyId: 'other-company', role: UserRole.AdminCliente },
          FAKE_CTX,
        ),
      ).rejects.toBeInstanceOf(MachineNotFoundError);
    });

    it('devuelve la Machine de otra Company si el requester es SuperAdmin', async () => {
      const fakes = createFakes();
      const resolver = createResolver(fakes);

      const machine = await resolver.resolveAny(
        'machine-1',
        { companyId: 'other-company', role: UserRole.SuperAdmin },
        FAKE_CTX,
      );

      expect(machine).toEqual(MACHINE);
    });
  });

  describe('resolveActive', () => {
    it('lanza MachineNotFoundError si la Machine existe pero está inactiva', async () => {
      const fakes = createFakes();
      fakes.machineRepository.findById.mockResolvedValue({ ...MACHINE, isActive: false });
      const resolver = createResolver(fakes);

      await expect(
        resolver.resolveActive(
          'machine-1',
          { companyId: 'company-1', role: UserRole.AdminCliente },
          FAKE_CTX,
        ),
      ).rejects.toBeInstanceOf(MachineNotFoundError);
    });

    it('devuelve la Machine si existe, pertenece a la Company y está activa', async () => {
      const fakes = createFakes();
      const resolver = createResolver(fakes);

      const machine = await resolver.resolveActive(
        'machine-1',
        { companyId: 'company-1', role: UserRole.AdminCliente },
        FAKE_CTX,
      );

      expect(machine).toEqual(MACHINE);
    });
  });
});

describe('assertMachineActive', () => {
  it('no lanza si la Machine está activa', () => {
    expect(() => assertMachineActive(MACHINE)).not.toThrow();
  });

  it('lanza MachineInactiveError si la Machine está inactiva', () => {
    expect(() => assertMachineActive({ ...MACHINE, isActive: false })).toThrow(
      MachineInactiveError,
    );
  });
});
