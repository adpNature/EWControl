import { describe, expect, it, vi } from 'vitest';
import { UserRole } from '../../entities/user-role.enum';
import { CannotDeactivateSelfError } from './errors/cannot-deactivate-self.error';
import { DeactivateUserUseCase } from './deactivate-user.use-case';

const FAKE_CTX = Symbol('tx-ctx');
const USER = {
  id: 'user-1',
  companyId: 'company-1',
  email: 'demo@ewcontrol.local',
  role: UserRole.AdminCliente,
  isActive: true,
};

function createFakes() {
  const resolver = { resolveAny: vi.fn().mockResolvedValue(USER) };
  const userRepository = {
    create: vi.fn(),
    findActiveByCompanyAndRole: vi.fn(),
    findById: vi.fn(),
    findByEmail: vi.fn(),
    list: vi.fn(),
    update: vi.fn(),
    deactivate: vi.fn().mockResolvedValue({ ...USER, isActive: false }),
    reactivate: vi.fn(),
    deleteAllByCompanyId: vi.fn(),
  };
  const refreshTokenRepository = {
    create: vi.fn(),
    findById: vi.fn(),
    markRotated: vi.fn(),
    revokeById: vi.fn(),
    revokeAllActiveForUser: vi.fn(),
  };
  const unitOfWork = {
    runInTransaction: vi.fn((work: (ctx: unknown) => Promise<unknown>) => work(FAKE_CTX)),
  };
  return { resolver, userRepository, refreshTokenRepository, unitOfWork };
}

function createUseCase(fakes: ReturnType<typeof createFakes>) {
  return new DeactivateUserUseCase(
    fakes.resolver as never,
    fakes.userRepository,
    fakes.refreshTokenRepository,
    fakes.unitOfWork,
  );
}

describe('DeactivateUserUseCase', () => {
  it('marca el User como inactivo e invalida todos sus refresh tokens activos', async () => {
    const fakes = createFakes();
    const useCase = createUseCase(fakes);
    const requester = { companyId: 'company-1', role: UserRole.AdminCliente };

    await useCase.execute({ userId: 'user-1', requesterId: 'requester-1', requester });

    expect(fakes.userRepository.deactivate).toHaveBeenCalledWith('user-1', FAKE_CTX);
    expect(fakes.refreshTokenRepository.revokeAllActiveForUser).toHaveBeenCalledWith(
      'user-1',
      FAKE_CTX,
    );
  });

  it('lanza CannotDeactivateSelfError si el User intenta darse de baja a sí mismo', async () => {
    const fakes = createFakes();
    const useCase = createUseCase(fakes);
    const requester = { companyId: 'company-1', role: UserRole.AdminCliente };

    await expect(
      useCase.execute({ userId: 'user-1', requesterId: 'user-1', requester }),
    ).rejects.toBeInstanceOf(CannotDeactivateSelfError);
    expect(fakes.userRepository.deactivate).not.toHaveBeenCalled();
  });
});
