import { describe, expect, it, vi } from 'vitest';
import { UserRole } from '../../entities/user-role.enum';
import { UserNotFoundError } from './errors/user-not-found.error';
import { UserAccessResolver } from './user-access.resolver';

const FAKE_CTX = Symbol('tx-ctx');
const USER = {
  id: 'user-1',
  companyId: 'company-1',
  email: 'demo@ewcontrol.local',
  role: UserRole.AdminCliente,
  isActive: true,
};

function createFakes() {
  const userRepository = {
    create: vi.fn(),
    findActiveByCompanyAndRole: vi.fn(),
    findById: vi.fn().mockResolvedValue(USER),
    findByEmail: vi.fn(),
    list: vi.fn(),
    update: vi.fn(),
    deactivate: vi.fn(),
    reactivate: vi.fn(),
    deleteAllByCompanyId: vi.fn(),
  };
  return { userRepository };
}

function createResolver(fakes: ReturnType<typeof createFakes>) {
  return new UserAccessResolver(fakes.userRepository);
}

describe('UserAccessResolver', () => {
  describe('resolveAny', () => {
    it('devuelve el User cuando existe y pertenece a la Company del requester', async () => {
      const fakes = createFakes();
      const resolver = createResolver(fakes);

      const user = await resolver.resolveAny(
        'user-1',
        { companyId: 'company-1', role: UserRole.AdminCliente },
        FAKE_CTX,
      );

      expect(user).toEqual(USER);
    });

    it('lanza UserNotFoundError si el User no existe', async () => {
      const fakes = createFakes();
      fakes.userRepository.findById.mockResolvedValue(null);
      const resolver = createResolver(fakes);

      await expect(
        resolver.resolveAny(
          'missing',
          { companyId: 'company-1', role: UserRole.AdminCliente },
          FAKE_CTX,
        ),
      ).rejects.toBeInstanceOf(UserNotFoundError);
    });

    it('lanza UserNotFoundError (nunca 403) si el User es de otra Company y el requester es AdminCliente', async () => {
      const fakes = createFakes();
      const resolver = createResolver(fakes);

      await expect(
        resolver.resolveAny(
          'user-1',
          { companyId: 'other-company', role: UserRole.AdminCliente },
          FAKE_CTX,
        ),
      ).rejects.toBeInstanceOf(UserNotFoundError);
    });

    it('devuelve el User de otra Company si el requester es SuperAdmin', async () => {
      const fakes = createFakes();
      const resolver = createResolver(fakes);

      const user = await resolver.resolveAny(
        'user-1',
        { companyId: 'other-company', role: UserRole.SuperAdmin },
        FAKE_CTX,
      );

      expect(user).toEqual(USER);
    });
  });

  describe('resolveActive', () => {
    it('lanza UserNotFoundError si el User existe pero está inactivo', async () => {
      const fakes = createFakes();
      fakes.userRepository.findById.mockResolvedValue({ ...USER, isActive: false });
      const resolver = createResolver(fakes);

      await expect(
        resolver.resolveActive(
          'user-1',
          { companyId: 'company-1', role: UserRole.AdminCliente },
          FAKE_CTX,
        ),
      ).rejects.toBeInstanceOf(UserNotFoundError);
    });

    it('devuelve el User si existe, pertenece a la Company y está activo', async () => {
      const fakes = createFakes();
      const resolver = createResolver(fakes);

      const user = await resolver.resolveActive(
        'user-1',
        { companyId: 'company-1', role: UserRole.AdminCliente },
        FAKE_CTX,
      );

      expect(user).toEqual(USER);
    });
  });
});
